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
import { actionPath, pendingPrompt, abilityName } from "../engine/paths.js";
import { getSet } from "../engine/sets/index.js";
import { SIZE, sq, rowOf, colOf, supplyRow } from "../engine/board.js";
import { captureDice, play as playAnimation, getSpeed, setSpeed } from "./animate.js";

// UI dice set id -> engine set id
const ENGINE_SET = { numbers: "plain", RoX: "RoX", BoD: "BoD", LoD: "LoD" };
const LOCATION_TILE_TYPE = { craters: "RoX", oracle: "BoD", ruins: "LoD" };

const rm = {
  active: false,
  game: null,
  undo: [],
  redo: [],
  prefix: [],        // tokens chosen so far
  setupDraft: {},    // col -> level during the setup phase
  message: "",
  ai: null,          // { player, level } when playing against the AI
  aiToken: 0,        // invalidates running AI requests (undo, new game)
  thinking: false,
  animating: Promise.resolve(), // animation of the last action
};

const engineSet = (uiSet) => ENGINE_SET[uiSet];

function isAvailable(p1Set, p2Set) {
  return [p1Set, p2Set].every((s) => engineSet(s) && IMPLEMENTED_SETS.includes(engineSet(s)));
}

function start(p1Set, p2Set, { locations = [], startingPlayer, ai = null } = {}) {
  rm.active = true;
  rm.ai = ai;
  rm.aiToken++;
  rm.thinking = false;
  rm.game = createGame({
    set1: engineSet(p1Set),
    set2: engineSet(p2Set),
    startingPlayer: startingPlayer || (Math.random() < 0.5 ? 1 : 2),
    locations,
  });
  rm.undo = [];
  rm.redo = [];
  rm.prefix = [];
  rm.setupDraft = {};
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
  const panel = document.getElementById("rules-panel");
  if (panel) panel.style.display = "none";
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
    rm.message = "";
  } catch (err) {
    console.error(err);
    rm.message = err.message;
  }
  render();
  if (next) rm.animating = playAnimation(next.events, before, { slow: byAI }).catch((e) => console.error(e));
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
  if (isUpdate) rm.animating = playAnimation(game.events, before, { slow: true }).catch((e) => console.error(e));
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
  render();
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
  const level = ((rm.setupDraft[c] || 0) + 1) % 7; // empty -> 1 .. 6 -> empty
  if (level) rm.setupDraft[c] = level;
  else delete rm.setupDraft[c];
  rm.message = "";
  render();
}

function confirmSetup() {
  const player = rm.game.current;
  const placements = Object.entries(rm.setupDraft).map(([col, level]) => ({ col: Number(col), level }));
  const err = validateSetup(rm.game, player, placements);
  if (err) { rm.message = err; return render(); }
  rm.setupDraft = {};
  perform({ type: "setup", placements });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

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
        rotation: 0,
      };
    }
  }
  if (g.phase === "setup") {
    const row = supplyRow(g.current);
    for (const [col, level] of Object.entries(rm.setupDraft)) {
      state.board[row][Number(col)] = { ...state.board[row][Number(col)], owner: g.current, value: level };
    }
  }
  for (const p of [1, 2]) {
    const ep = g.players[p];
    Object.assign(state.players[p], { reserve: ep.reserve, exile: ep.exile, trigger: ep.tp, victory: ep.vp });
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
  for (const p of [1, 2]) {
    const v = virtualVP(rm.game, p);
    if (v) document.getElementById(`p${p}-victory`).textContent = `${rm.game.players[p].vp} +${v}`;
  }
  setStatus(statusText());
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

function renderPanel() {
  let panel = document.getElementById("rules-panel");
  if (!panel) return;
  panel.style.display = "block";
  const g = rm.game;
  const lines = [];
  const buttons = [];

  if (g.phase === "setup") {
    const sum = Object.values(rm.setupDraft).reduce((a, b) => a + b, 0);
    lines.push(`Click fields in your back row to place dice (each click raises the level). Total Power Level: ${sum} / ${SETUP_POWER}.`);
    if (localCanAct()) buttons.push(["Confirm lineup", confirmSetup, sum === SETUP_POWER]);
    else if (isAiTurn()) lines.push("The AI is setting up…");
  } else if (g.phase === "war") {
    if (g.endOfWar) {
      lines.push(`End of War declared by Player ${g.endOfWar.declaredBy}: Player ${g.endOfWar.chased} has fled ${g.endOfWar.turnsFled} / ${END_OF_WAR_TURNS} turns.`);
    }
    if (localCanAct()) {
      const first = rm.prefix.find((t) => typeof t === "string" && t.length > 0);
      const cand = candidates(rm.prefix)[0];
      const ability = cand && cand.ability;
      const hint = ability && getSet(ability.split(".")[0]).stepHint?.(ability, rm.prefix.length);
      if (hint) lines.push(hint);
      else if (!rm.prefix.length && !g.pending.length) lines.push("Select one of your creatures.");
      else if (rm.prefix.length === 1) lines.push("Choose a highlighted field or an action.");
      if (ability && !first) lines.push(abilityName(ability));
      for (const t of nextTokens()) if (typeof t === "string") buttons.push([t, () => choose(t), true]);
      if (rm.prefix.length) buttons.push(["Cancel", () => { rm.prefix = []; render(); }, true]);
    } else {
      lines.push(isAiTurn() ? "The AI is thinking…" : "Waiting for the opponent…");
    }
    lines.push(`Total VP: P1 ${totalVP(g, 1)} · P2 ${totalVP(g, 2)}`);
  }
  if (rm.message) lines.push(rm.message);

  panel.innerHTML = "";
  for (const l of lines) {
    const div = document.createElement("div");
    div.className = "rules-panel-text";
    div.textContent = l;
    panel.appendChild(div);
  }
  for (const [label, fn, enabled] of buttons) {
    const b = document.createElement("button");
    b.className = "btn" + (label === "Cancel" ? "" : " primary");
    b.textContent = label;
    b.disabled = !enabled;
    b.addEventListener("click", fn);
    panel.appendChild(b);
  }
}

window.RulesMode = {
  get active() { return rm.active; },
  get game() { return rm.game; },
  get prefix() { return [...rm.prefix]; },
  isAvailable, start, stop, load, render, onCellClick, undo, redo, localCanAct,
  getAnimationSpeed: getSpeed, setAnimationSpeed: setSpeed,
  implementedLocations: IMPLEMENTED_LOCATIONS,
  canUndo: () => rm.undo.length > 0 && state.gameMode !== "online",
  canRedo: () => rm.redo.length > 0 && state.gameMode !== "online",
};
window.dispatchEvent(new Event("rules-mode-ready"));
