// "Rules enforced" mode for the board UI. The rules engine (engine/) is the
// source of truth; this module projects the engine state onto the classic UI
// state in index.html and turns clicks into legal actions.
//
// Uses globals of the classic script in index.html: state, onlineState,
// updateBoardDOM, refreshPlayerPanels, updateRoundDisplay, updateCurrentDieView,
// setStatus, sendGameState.

import {
  createGame, applyAction, legalActions, actor, validateSetup, virtualVP, totalVP,
  SETUP_POWER, END_OF_WAR_TURNS,
} from "../engine/core.js";
import { IMPLEMENTED_SETS } from "../engine/sets/index.js";
import { IMPLEMENTED_LOCATIONS } from "../engine/locations/index.js";
import { actionPath, pendingPrompt, abilityName, TURN_LABELS, FACE_LABELS } from "../engine/paths.js";
import { getSet } from "../engine/sets/index.js";
import { SIZE, sq, rowOf, colOf, supplyRow, defaultDir } from "../engine/board.js";
import { captureDice, play as playAnimation, animateTurnAt, getSpeed, setSpeed } from "./animate.js";

// UI dice set id -> engine set id
// "Numbers" is deliberately not mapped: it is played without rules (by humans only),
// e.g. to try out a new tribe whose rules are not in the engine yet.
const ENGINE_SET = { RoX: "RoX", BoD: "BoD", LoD: "LoD", RoM: "RoM", KoS: "KoS", DoA: "DoA" };
const LOCATION_TILE_TYPE = { craters: "RoX", oracle: "BoD", ruins: "LoD", camp: "RoM", knoll: "KoS", river: "DoA" };
const RIVER_ROWS = [2, 3, 4]; // rows the DoA River flows through

const rm = {
  active: false,
  game: null,
  undo: [],
  redo: [],
  prefix: [],        // tokens chosen so far
  setupDraft: {},    // col -> level during the setup phase
  setupDir: {},      // col -> alignment during the setup phase (KoS)
  setupRotate: false, // KoS setup: clicks turn the dice instead of raising the level
  message: "",
  ai: null,          // { player, level } when playing against the AI
  aiToken: 0,        // invalidates running AI requests (undo, new game)
  thinking: false,
  animating: Promise.resolve(), // animation of the last action
  ringDismissed: false, // radial menu closed with "Move / Attack": only the board fields count
  turnMode: false,      // radial menu shows the four directions of "Turn" (KoS)
};

// Abilities that upgrade a creature: shown at the top of the radial menu.
const UPGRADE_ABILITIES = new Set(["BoD.hunter.dark_fusion", "RoM.protectress.symbiosis"]);

const engineSet = (uiSet) => ENGINE_SET[uiSet];

function isAvailable(p1Set, p2Set) {
  return [p1Set, p2Set].every((s) => engineSet(s) && IMPLEMENTED_SETS.includes(engineSet(s)));
}

function start(p1Set, p2Set, { locations = [], startingPlayer, ai = null, riverCol = 1 } = {}) {
  rm.active = true;
  rm.ai = ai;
  rm.aiToken++;
  rm.thinking = false;
  rm.game = createGame({
    set1: engineSet(p1Set),
    set2: engineSet(p2Set),
    startingPlayer: startingPlayer || (Math.random() < 0.5 ? 1 : 2),
    locations,
    riverCol,
  });
  rm.undo = [];
  rm.redo = [];
  rm.prefix = [];
  rm.setupDraft = {};
  rm.setupDir = {};
  rm.setupRotate = false;
  rm.message = `${playerName(rm.game.startingPlayer)} ${rm.ai ? (rm.game.startingPlayer === rm.ai.player ? "starts" : "start") : "starts"} (rolled the higher number).`;
  document.getElementById("app").classList.add("rules-mode");
  render();
}

function stop() {
  rm.active = false;
  rm.game = null;
  rm.ai = null;
  rm.aiToken++;
  rm.thinking = false;
  document.getElementById("app").classList.remove("rules-mode");
  if (window.Ring) Ring.hide();
  for (const p of [1, 2]) if (state.players[p]) state.players[p].virtualVP = 0;
}

/** May the person at this device act right now? */
function localCanAct() {
  if (!rm.game || rm.game.phase === "over") return false;
  const who = whoActs();
  if (rm.ai && who === rm.ai.player) return false;
  if (state.gameMode === "online") return who === onlineState.localPlayer;
  return true;
}

const whoActs = (g = rm.game) => (g.phase === "setup" ? g.current : actor(g));
const isAiTurn = (g = rm.game) => rm.ai && g.phase !== "over" && whoActs(g) === rm.ai.player;

// ---------------------------------------------------------------------------
// AI opponent (runs in a Web Worker, falls back to the main thread)
// ---------------------------------------------------------------------------

let worker = null;
let workerFailed = false;
let requestId = 0;
const waiting = new Map();

function getWorker() {
  if (worker || workerFailed) return worker;
  try {
    worker = new Worker(new URL("./ai-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const cb = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      if (cb) cb(e.data);
    };
    worker.onerror = (e) => {
      console.warn("AI worker failed, using the main thread", e);
      workerFailed = true;
      worker = null;
      for (const cb of waiting.values()) cb({ retry: true });
      waiting.clear();
    };
  } catch (err) {
    workerFailed = true;
    worker = null;
  }
  return worker;
}

async function askAI(game, level) {
  const w = getWorker();
  if (w) {
    const res = await new Promise((resolve) => {
      const id = ++requestId;
      waiting.set(id, resolve);
      w.postMessage({ id, state: game, level });
    });
    if (!res.retry) {
      if (res.error) throw new Error(res.error);
      return res.action;
    }
  }
  const ai = await import("../ai/ai.js");
  return game.phase === "setup" ? ai.chooseSetup(game, { level }) : ai.chooseAction(game, { level }).action;
}

async function maybeRunAI() {
  if (!rm.active || !rm.game || rm.thinking || !isAiTurn()) return;
  rm.thinking = true;
  const token = rm.aiToken;
  const started = Date.now();
  renderPanel();
  try {
    const action = await askAI(rm.game, rm.ai.level);
    const wait = 500 - (Date.now() - started); // let the human see what happens
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    await rm.animating; // let the previous action finish its animation first
    if (token !== rm.aiToken) return;
    rm.thinking = false;
    perform(action);
  } catch (err) {
    console.error(err);
    rm.message = "AI error: " + err.message;
    rm.thinking = false;
    render();
  } finally {
    if (token === rm.aiToken) rm.thinking = false;
  }
}

// ---------------------------------------------------------------------------
// Applying actions
// ---------------------------------------------------------------------------

function perform(action) {
  const before = captureDice();
  const byAI = isAiTurn();
  let next = null;
  try {
    next = applyAction(rm.game, action);
    rm.undo.push(rm.game);
    if (rm.undo.length > 200) rm.undo.shift();
    rm.redo = [];
    rm.game = next;
    rm.prefix = [];
    rm.ringDismissed = false;
    rm.turnMode = false;
    rm.message = "";
  } catch (err) {
    console.error(err);
    rm.message = err.message;
  }
  render();
  // A turn before the action was already shown while the player chose it.
  const preShown = !byAI && (action.pre !== undefined || (action.sub && action.sub.pre !== undefined));
  if (next) rm.animating = playAnimation(next.events, before, { slow: byAI, alignDeg, preShown }).catch((e) => console.error(e));
  if (state.gameMode === "online") sendGameState();
}

// Against the AI, undo/redo jump over the AI's actions to the human's next decision.
function undo() {
  if (!rm.undo.length || state.gameMode === "online") return;
  rm.aiToken++;
  rm.thinking = false;
  do {
    rm.redo.push(rm.game);
    rm.game = rm.undo.pop();
  } while (rm.ai && rm.undo.length && isAiTurn());
  rm.prefix = [];
  render();
}

function redo() {
  if (!rm.redo.length || state.gameMode === "online") return;
  rm.aiToken++;
  rm.thinking = false;
  do {
    rm.undo.push(rm.game);
    rm.game = rm.redo.pop();
  } while (rm.ai && rm.redo.length && isAiTurn());
  rm.prefix = [];
  render();
}

/** State received from the online opponent or loaded from a file. */
function load(game, { resetHistory = false } = {}) {
  const before = captureDice();
  const isUpdate = rm.active && rm.game && !resetHistory && game.turnNumber >= rm.game.turnNumber
    && JSON.stringify(game.board) !== JSON.stringify(rm.game.board);
  rm.active = true;
  document.getElementById("app").classList.add("rules-mode");
  rm.game = game;
  rm.prefix = [];
  if (resetHistory) { rm.undo = []; rm.redo = []; }
  render();
  // Online: show the opponent's action as an animation.
  if (isUpdate) rm.animating = playAnimation(game.events, before, { slow: true, alignDeg }).catch((e) => console.error(e));
}

// ---------------------------------------------------------------------------
// Click handling
// ---------------------------------------------------------------------------

const candidates = (prefix) => legalActions(rm.game).filter((a) => {
  const p = actionPath(a);
  return prefix.every((t, i) => p[i] === t);
});

function choose(token) {
  if (!localCanAct()) return;
  let prefix = [...rm.prefix, token];
  let cands = candidates(prefix);
  if (!cands.length) {
    // Start over with this square if it begins an action (e.g. another own die).
    prefix = typeof token === "number" && candidates([token]).length ? [token] : [];
    cands = candidates(prefix);
  }
  // Auto-advance when every remaining action continues with the same square.
  for (;;) {
    const next = new Set(cands.map((a) => actionPath(a)[prefix.length]));
    if (next.size !== 1) break;
    const [t] = next;
    if (typeof t !== "number") break;
    prefix = [...prefix, t];
  }
  const complete = cands.filter((a) => actionPath(a).length === prefix.length);
  if (complete.length === 1 && cands.length === 1) {
    perform(complete[0]);
    return;
  }
  rm.prefix = prefix;
  rm.ringDismissed = false;
  rm.turnMode = false;
  render();
  // "Turn …" (KoS): the die turns on the board right away.
  const dir = TURN_LABELS.indexOf(token);
  const die = dir >= 0 && typeof prefix[0] === "number" ? rm.game.board[prefix[0]] : null;
  if (die) animateTurnAt(prefix[0], alignDeg(die.owner, die.dir), alignDeg(die.owner, dir));
}

function onCellClick(r, c) {
  if (!rm.game) return;
  if (rm.game.phase === "setup") return onSetupClick(r, c);
  choose(sq(r, c));
}

function onSetupClick(r, c) {
  if (!localCanAct()) return;
  const player = rm.game.current;
  if (r !== supplyRow(player)) {
    rm.message = "Place your starting lineup in your Supply Zone (your back row).";
    return render();
  }
  // KoS: in alignment mode a click turns a placed die by 90 degrees (clockwise).
  if (setupNeedsAlignment() && rm.setupRotate) {
    if (typeof rm.setupDraft[c] !== "number") {
      rm.message = "Place a die there first, then turn it.";
      return render();
    }
    rm.setupDir[c] = ((rm.setupDir[c] ?? defaultDir(player)) + 1) % 4;
    rm.message = "";
    return render();
  }
  // Each click cycles the field: empty -> 1 .. 6 -> (camp, with The Camp) -> empty.
  const cycle = [1, 2, 3, 4, 5, 6];
  if (rm.game.locations.includes("camp")) cycle.push("camp");
  const cur = rm.setupDraft[c];
  const next = cur === undefined ? cycle[0] : cycle[cycle.indexOf(cur) + 1];
  if (next === "camp") for (const k of Object.keys(rm.setupDraft)) if (rm.setupDraft[k] === "camp") delete rm.setupDraft[k];
  if (next !== undefined) rm.setupDraft[c] = next;
  else { delete rm.setupDraft[c]; delete rm.setupDir[c]; }
  rm.message = "";
  render();
}

/** KoS dice get their alignment in the setup (they keep it when upgraded). */
function setupNeedsAlignment(g = rm.game) {
  return g.phase === "setup" && g.players[g.current].set === "KoS";
}

function confirmSetup() {
  const player = rm.game.current;
  const entries = Object.entries(rm.setupDraft);
  const placements = entries.filter(([, v]) => v !== "camp").map(([col, level]) => (
    setupNeedsAlignment() ? { col: Number(col), level, dir: rm.setupDir[col] ?? defaultDir(player) } : { col: Number(col), level }));
  const campEntry = entries.find(([, v]) => v === "camp");
  const extra = campEntry ? { camp: Number(campEntry[0]) } : {};
  const err = validateSetup(rm.game, player, placements, extra);
  if (err) { rm.message = err; return render(); }
  rm.setupDraft = {};
  rm.setupDir = {};
  rm.setupRotate = false;
  perform({ type: "setup", placements, ...extra });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** KoS alignment: rotate the die image so its arrow points in die.dir (0 up,
 *  1 right, 2 down, 3 left on screen). Player 2's dice are already turned by
 *  180 degrees in duel and online games. */
function alignmentRotation(d) {
  if (rm.game.players[d.owner].set !== "KoS") return 0;
  const base = (state.gameMode === "duel" || state.gameMode === "online") && d.owner === 2 ? 180 : 0;
  return (d.dir * 90 - base + 360) % 360;
}

/** Total rotation of a die image with alignment `dir`, as rendered by index.html
 *  (the 180 degrees for player 2 in duel and online games included). */
function alignDeg(owner, dir) {
  const base = (state.gameMode === "duel" || state.gameMode === "online") && owner === 2 ? 180 : 0;
  return base + alignmentRotation({ owner, dir });
}

function project() {
  const g = rm.game;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const d = g.board[sq(r, c)];
      const tile = g.tiles[sq(r, c)];
      state.board[r][c] = {
        owner: d ? d.owner : null,
        value: d ? d.level : null,
        type: tile ? (LOCATION_TILE_TYPE[tile] || "neutral") : "neutral",
        rotation: d ? alignmentRotation(d) : 0,
        flow: g.locations.includes("river") && RIVER_ROWS.includes(r) && !tile,
      };
    }
  }
  // While choosing an action: a die turned before the action ("Turn …") is shown turned.
  if (g.phase === "war" && typeof rm.prefix[0] === "number" && typeof rm.prefix[1] === "string") {
    const dir = TURN_LABELS.indexOf(rm.prefix[1]);
    const d = g.board[rm.prefix[0]];
    if (dir >= 0 && d) state.board[rowOf(rm.prefix[0])][colOf(rm.prefix[0])].rotation = alignmentRotation({ ...d, dir });
  }
  if (g.phase === "setup") {
    const row = supplyRow(g.current);
    for (const [col, level] of Object.entries(rm.setupDraft)) {
      const cell = state.board[row][Number(col)];
      const dir = rm.setupDir[col] ?? defaultDir(g.current);
      state.board[row][Number(col)] = level === "camp" ? { ...cell, type: "RoM" }
        : { ...cell, owner: g.current, value: level, rotation: alignmentRotation({ owner: g.current, dir }) };
    }
  }
  for (const p of [1, 2]) {
    const ep = g.players[p];
    Object.assign(state.players[p], { reserve: ep.reserve, exile: ep.exile, trigger: ep.tp, victory: ep.vp, virtualVP: g.phase === "war" ? virtualVP(g, p) : 0 });
  }
  state.currentPlayer = g.phase === "setup" ? g.current : actor(g);
  state.roundNumber = Math.max(1, Math.ceil(g.turnNumber / 2));
  const first = rm.prefix[0];
  state.selected = typeof first === "number" ? { type: "board", row: rowOf(first), col: colOf(first) } : null;
}

function render() {
  if (!rm.active || !rm.game) return;
  project();
  updateBoardDOM();
  refreshPlayerPanels();
  updateRoundDisplay();
  updateCurrentDieView();
  decorateBoard();
  renderPanel();
  maybeRunAI();
}

function decorateBoard() {
  const cells = document.getElementById("board").querySelectorAll(".cell");
  cells.forEach((el) => el.classList.remove("hint", "hint-attack", "in-path"));
  if (rm.game.phase !== "war" || !localCanAct()) return;
  const cellAt = (s) => cells[s];
  rm.prefix.forEach((t) => { if (typeof t === "number") cellAt(t).classList.add("in-path"); });
  for (const t of nextTokens()) {
    if (typeof t !== "number") continue;
    const d = rm.game.board[t];
    const enemy = d && d.owner !== actor(rm.game);
    cellAt(t).classList.add(enemy ? "hint-attack" : "hint");
  }
}

function nextTokens() {
  const n = rm.prefix.length;
  const set = new Set();
  for (const a of candidates(rm.prefix)) {
    const t = actionPath(a)[n];
    if (t !== undefined && (n > 0 || rm.game.pending.length || typeof t === "string")) set.add(t);
  }
  return [...set];
}

/** "Player 1" in two-player games, "You" / "AI" against the AI. */
function playerName(p) {
  if (!rm.ai) return `Player ${p}`;
  return p === rm.ai.player ? "AI" : "You";
}

function statusText() {
  const g = rm.game;
  if (g.phase === "over") {
    const { winner, reason } = g.result;
    const why = {
      victoryPoints: "reached 10 victory points",
      noValidAction: "the opponent had no valid action left",
      endOfWar: "End of War: more victory points",
      turnLimit: "turn limit reached: more victory points",
    }[reason] || reason;
    if (!winner) return `Draw (${why}).`;
    if (rm.ai) return winner === rm.ai.player ? `The AI wins (${why}).` : `You win (${why})!`;
    return `Player ${winner} wins (${why}).`;
  }
  if (g.phase === "setup") return `${playerName(g.current)}: set up the starting lineup.`;
  if (g.pending.length) return `${playerName(actor(g))}: ${pendingPrompt(g.pending[0])}`;
  return rm.ai ? (g.current === rm.ai.player ? "AI's turn." : "Your turn.") : `Player ${g.current}'s turn.`;
}

/** Screen direction (0 up, 1 right, 2 down, 3 left) of engine direction `dir`. */
function screenDir(dir) {
  const flipped = document.getElementById("app").classList.contains("online-player2");
  return flipped ? (dir + 2) % 4 : dir;
}

const SIDE_NAMES = ["top", "right", "bottom", "left"];

/** Is the radial menu turned towards player 2 (duel on one device, portrait)? */
function ringFlipped(player) {
  return state.gameMode === "duel" && player === 2 && !(window.GameUI && GameUI.isLandscape());
}

function arrowItems(labels, tokens, flip) {
  const items = { top: [], right: [], bottom: [], left: [] };
  labels.forEach((label, dir) => {
    if (!tokens.includes(label)) return;
    const side = (screenDir(dir) + (flip ? 2 : 0)) % 4;
    const names = ["Up", "Right", "Down", "Left"];
    items[SIDE_NAMES[side]].push({ label: "", kind: "arrow", ariaLabel: `${label.split(" ")[0]} ${names[screenDir(dir)]}`, onClick: () => choose(label) });
  });
  return items;
}

function dieImageOf(at) {
  const d = rm.game.board[at];
  const set = d && state.players[d.owner] && state.players[d.owner].diceSet;
  if (!d || !set) return null;
  const b = state.players[1].diceSet === state.players[2].diceSet && d.owner === 2 ? "b" : "";
  return `img/${set}/${d.level}${b}.png`;
}

function dieImageRotation(at) {
  const cell = state.board[rowOf(at)][colOf(at)];
  let rot = cell.rotation || 0;
  if ((state.gameMode === "duel" || state.gameMode === "online") && cell.owner === 2) rot += 180;
  return rot;
}

/** The radial menu for the current click path, or null. */
function ringModel() {
  const g = rm.game;
  if (g.phase !== "war" || !localCanAct()) return null;
  const prefix = rm.prefix;
  const next = nextTokens();
  const strings = next.filter((t) => typeof t === "string");
  const nums = next.filter((t) => typeof t === "number");
  const player = actor(g);
  const flip = ringFlipped(player);
  const spellColor = window.GameUI ? GameUI.setColor(player) : undefined;
  const cancel = () => { rm.prefix = []; rm.ringDismissed = false; rm.turnMode = false; render(); };

  // Alignment after the action (KoS "Face …"): arrows around the new field.
  if (strings.length && strings.every((t) => FACE_LABELS.includes(t)) && !nums.length) {
    const at = [...prefix].reverse().find((t) => typeof t === "number");
    if (at === undefined) return null;
    return {
      square: { row: rowOf(at), col: colOf(at) }, flip, spellColor,
      dieImg: dieImageOf(prefix.find((t) => typeof t === "number")),
      items: arrowItems(FACE_LABELS, strings, flip),
      onCancel: cancel,
      text: "Choose the new alignment of the creature.",
    };
  }

  const atDie = typeof prefix[0] === "number"
    && (prefix.length === 1 || (prefix.length === 2 && TURN_LABELS.includes(prefix[1])));
  if (!atDie || !strings.length || rm.ringDismissed) return null;
  const at = prefix[0];
  const turns = strings.filter((t) => TURN_LABELS.includes(t));
  const others = strings.filter((t) => !TURN_LABELS.includes(t));
  const base = { square: { row: rowOf(at), col: colOf(at) }, flip, spellColor, dieImg: dieImageOf(at), dieRotation: dieImageRotation(at) };

  if (rm.turnMode && turns.length) {
    return { ...base, items: arrowItems(TURN_LABELS, turns, flip), onCancel: () => { rm.turnMode = false; render(); },
      text: "Choose the new alignment, then the action." };
  }

  const items = { top: [], right: [], bottom: [], left: [] };
  const spells = [];
  for (const t of others) {
    const a = candidates([...prefix, t])[0];
    const upgrade = a && (a.type === "upgrade" || UPGRADE_ABILITIES.has(a.ability));
    (upgrade ? items.top : spells).push({ label: t, kind: upgrade ? "upgrade" : "spell", onClick: () => choose(t) });
  }
  const half = Math.ceil(spells.length / 2);
  items.left = spells.slice(0, half);
  items.right = spells.slice(half);
  if (nums.length) {
    const attacks = nums.filter((t) => rm.game.board[t] && rm.game.board[t].owner !== player).length;
    const label = attacks === nums.length ? "Attack" : attacks ? "Move / Attack" : "Move";
    items.bottom = [{ label, kind: "move", onClick: () => { rm.ringDismissed = true; render(); } }];
  }
  return {
    ...base, items, onCancel: cancel,
    center: turns.length ? { label: "Turn", onClick: () => { rm.turnMode = true; render(); } } : null,
    text: turns.length ? "Choose an action, or tap the die to turn it. Tap outside to cancel." : "Choose an action in the circle. Tap outside to cancel.",
  };
}

function renderPanel() {
  if (!document.getElementById("hint") || !window.GameUI) return;
  const g = rm.game;
  const acting = whoActs(g);
  const color = GameUI.setColor(g.phase === "over" ? (g.result && g.result.winner) || acting : acting);
  const turnTitle = `${playerName(acting)}${playerName(acting) === "You" ? "r" : "'s"} turn · Round ${state.roundNumber}`;
  let title = turnTitle;
  let text = "";
  const msgs = [];
  const buttons = [];
  let ring = null;

  if (g.phase === "setup") {
    title = `Setup · ${playerName(acting)}`;
    if (localCanAct()) {
      const values = Object.values(rm.setupDraft);
      const sum = values.filter((v) => v !== "camp").reduce((a, b) => a + b, 0);
      const needsCamp = g.locations.includes("camp");
      const hasCamp = values.includes("camp");
      text = `Tap fields in your back row to place dice; each tap raises the level. Power ${sum} / ${SETUP_POWER}.`;
      if (needsCamp) msgs.push(`Camp: tap a field past level 6 to place your camp (${hasCamp ? "placed" : "not placed yet"}).`);
      if (setupNeedsAlignment()) {
        msgs.push(rm.setupRotate ? "Tap a die to turn it by 90°." : "Use \"Turn dice\" to choose the alignment of each die.");
        buttons.push({ label: rm.setupRotate ? "Set levels" : "Turn dice", secondary: true, onClick: () => { rm.setupRotate = !rm.setupRotate; rm.message = ""; render(); } });
      }
      buttons.push({ label: "Confirm lineup", onClick: confirmSetup, disabled: !(sum === SETUP_POWER && (!needsCamp || hasCamp)) });
    } else {
      text = isAiTurn() ? "The AI is setting up…" : "Waiting for the opponent…";
    }
  } else if (g.phase === "war") {
    if (g.endOfWar) msgs.push(`End of War declared by ${playerName(g.endOfWar.declaredBy)}: ${playerName(g.endOfWar.chased)} has fled ${g.endOfWar.turnsFled} / ${END_OF_WAR_TURNS} turns.`);
    if (localCanAct()) {
      ring = ringModel();
      const cand = candidates(rm.prefix)[0];
      const ability = cand && cand.ability;
      const chosen = rm.prefix.find((t) => typeof t === "string" && !TURN_LABELS.includes(t));
      if (ability && chosen) title = abilityName(ability);
      else if (g.pending.length) title = `${playerName(acting)} · decision`;
      const hint = ability && getSet(ability.split(".")[0]).stepHint?.(ability, rm.prefix.length);
      if (ring) text = ring.text;
      else if (hint) text = hint;
      else if (g.pending.length) text = pendingPrompt(g.pending[0]);
      else if (!rm.prefix.length) text = "Tap one of your creatures.";
      else text = "Tap a highlighted field.";
      const ringTokens = ring ? nextTokens().filter((t) => typeof t === "string") : [];
      for (const t of nextTokens()) {
        if (typeof t !== "string" || ringTokens.includes(t)) continue;
        if (rm.ringDismissed && rm.prefix.length === 1) continue; // "Move / Attack" chosen: fields only
        buttons.push({ label: t, onClick: () => choose(t) });
      }
      if (rm.prefix.length) buttons.push({ label: "Cancel", secondary: true, onClick: () => { rm.prefix = []; rm.ringDismissed = false; rm.turnMode = false; render(); } });
    } else {
      text = isAiTurn() ? "The AI is thinking…" : "Waiting for the opponent…";
    }
  } else {
    title = "Game over";
    text = statusText();
  }
  if (rm.message) msgs.push(rm.message);

  GameUI.renderHint({ title, text, msg: msgs.join(" "), color, buttons });
  if (ring) Ring.show(ring);
  else Ring.hide();
}

window.RulesMode = {
  get active() { return rm.active; },
  get game() { return rm.game; },
  get prefix() { return [...rm.prefix]; },
  isAvailable, start, stop, load, render, onCellClick, undo, redo, localCanAct, playerName,
  actingPlayer: () => (rm.game ? whoActs(rm.game) : state.currentPlayer),
  get ai() { return rm.ai; },
  getAnimationSpeed: getSpeed, setAnimationSpeed: setSpeed,
  implementedLocations: IMPLEMENTED_LOCATIONS,
  canUndo: () => rm.undo.length > 0 && state.gameMode !== "online",
  canRedo: () => rm.redo.length > 0 && state.gameMode !== "online",
};
window.dispatchEvent(new Event("rules-mode-ready"));
