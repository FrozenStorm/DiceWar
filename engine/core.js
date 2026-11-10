// DiceWar rules engine: game state, legal actions and action resolution.
// Rules reference: docs/rules/base-rules.md. Set-specific rules live in
// engine/sets/<SET>.js and location tiles in engine/locations/.
//
// The engine is pure: applyAction() never mutates its input and returns a new
// state, so the UI can keep a history and the AI can search freely.

import {
  SQUARES, adjacent, opponent, supplyRow, sq, fieldBonus, defaultDir,
} from "./board.js";
import { getSet } from "./sets/index.js";
import { getLocation } from "./locations/index.js";

export const DICE_PER_PLAYER = 15;
export const SETUP_POWER = 10;
export const WIN_VP = 10;
export const MAX_BAR = 10;
export const MAX_LEVEL = 6;
export const END_OF_WAR_TURNS = 5;
export const DEFAULT_MAX_TURNS = 400;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Create a new game.
 * @param {object} opts
 * @param {string} opts.set1 dice set of player 1 (e.g. "RoX")
 * @param {string} opts.set2 dice set of player 2
 * @param {1|2} [opts.startingPlayer=1]
 * @param {string[]} [opts.locations=[]] location tiles, e.g. ["craters"]
 * @param {number} [opts.maxTurns] safety net: after this many turns VP decide
 */
export function createGame({ set1, set2, startingPlayer = 1, locations = [], maxTurns = DEFAULT_MAX_TURNS }) {
  getSet(set1); getSet(set2); // throws on unknown sets
  const tiles = new Array(SQUARES).fill(null);
  for (const id of locations) {
    for (const s of getLocation(id).squares) tiles[s] = id;
  }
  return {
    board: new Array(SQUARES).fill(null),
    tiles,
    locations: [...locations],
    players: {
      1: { set: set1, reserve: DICE_PER_PLAYER, exile: 0, tp: 0, vp: 0 },
      2: { set: set2, reserve: DICE_PER_PLAYER, exile: 0, tp: 0, vp: 0 },
    },
    phase: "setup",
    startingPlayer,
    current: startingPlayer,
    turnNumber: 0,
    maxTurns,
    pending: [],
    turn: freshTurnInfo(),
    endOfWar: null,
    nextDieId: 1,
    result: null,
    events: [],
  };
}

function freshTurnInfo() {
  return { main: null, movedDieId: null, onlyMovement: true, declared: false, flags: {} };
}

/** Fast structural copy of a game state (much faster than structuredClone,
 *  which matters for the AI search). Tiles and locations never change during
 *  a game and are shared; actions stored in the state are never mutated. */
export function clone(s) {
  return {
    ...s,
    board: s.board.map((d) => (d ? { ...d } : null)),
    players: { 1: { ...s.players[1] }, 2: { ...s.players[2] } },
    pending: s.pending.map((p) => ({ ...p, data: { ...p.data } })),
    turn: { ...s.turn, flags: { ...s.turn.flags } },
    endOfWar: s.endOfWar ? { ...s.endOfWar } : null,
    result: s.result ? { ...s.result } : null,
    events: [], // events of the next applyAction only
  };
}

/** Record what happened during the current action, for animations in the UI:
 *  move {path}, place {at,owner,level}, remove {at,owner,level,dest},
 *  level {at,from,to}, reserveToExile {player,n}. */
export function emit(s, event) {
  s.events.push(event);
}

export const setOf = (s, player) => getSet(s.players[player].set);

/** All squares holding a die of `player`, optionally filtered by level. */
export function diceOf(s, player, level) {
  const out = [];
  for (let i = 0; i < SQUARES; i++) {
    const d = s.board[i];
    if (d && d.owner === player && (level === undefined || d.level === level)) out.push(i);
  }
  return out;
}

export const countLevel = (s, player, level) => diceOf(s, player, level).length;

export function virtualVP(s, player) {
  const set = setOf(s, player);
  return set.virtualVP ? set.virtualVP(s, player) : 0;
}

export const totalVP = (s, player) => s.players[player].vp + virtualVP(s, player);

// ---------------------------------------------------------------------------
// Primitive state changes (used by core and set modules)
// ---------------------------------------------------------------------------

export function gainTP(s, player, n) {
  const p = s.players[player];
  p.tp = Math.max(0, Math.min(MAX_BAR, p.tp + n));
}

export function gainVP(s, player, n) {
  const p = s.players[player];
  p.vp = Math.max(0, Math.min(MAX_BAR, p.vp + n));
}

/** Place a die from the owner's Reserve onto an empty square. */
export function placeDie(s, at, owner, level, { dir = defaultDir(owner), cause = "ability" } = {}) {
  if (s.board[at]) throw new Error("placeDie: square occupied");
  if (s.players[owner].reserve <= 0) throw new Error("placeDie: reserve empty");
  s.players[owner].reserve--;
  const die = { id: s.nextDieId++, owner, level, dir };
  s.board[at] = die;
  emit(s, { t: "place", at, owner, level, cause });
  const set = setOf(s, owner);
  if (set.onPlaced) set.onPlaced(s, at, die, cause);
  return die;
}

/** Remove a die from the board into its owner's Reserve or Exile. */
export function removeDie(s, at, dest, cause = "ability") {
  const die = s.board[at];
  if (!die) throw new Error("removeDie: empty square");
  s.board[at] = null;
  s.players[die.owner][dest]++;
  emit(s, { t: "remove", at, owner: die.owner, level: die.level, dest, cause });
  const set = setOf(s, die.owner);
  if (set.onLeave) set.onLeave(s, at, die, cause);
  return die;
}

/** Move a Reserve Die of `player` into their Exile (spell costs). */
export function exileFromReserve(s, player, n = 1) {
  const p = s.players[player];
  if (p.reserve < n) throw new Error("exileFromReserve: not enough dice");
  p.reserve -= n;
  p.exile += n;
  emit(s, { t: "reserveToExile", player, n });
}

/**
 * Defeat the creature on `at`: it goes into its owner's Exile and `byPlayer`
 * receives VP (Power Level, plus Field Bonus unless disabled).
 */
export function defeat(s, at, byPlayer, { vp = "level", fieldBonus: withBonus = true, cause = "attack" } = {}) {
  const die = s.board[at];
  const owner = die.owner;
  const set = setOf(s, owner);
  let points = vp === "level" ? die.level : vp;
  if (set.defeatVP) points = set.defeatVP(s, at, die, points);
  if (withBonus && vp === "level") points += fieldBonus(byPlayer, at);
  removeDie(s, at, "exile", cause);
  if (points) gainVP(s, byPlayer, points);
  if (set.onDefeated) set.onDefeated(s, at, die, byPlayer, cause);
  return die;
}

/** Change the Power Level of a die (upgrade/downgrade). Below 1 removes it. */
export function setLevel(s, at, level, { byPlayer } = {}) {
  const die = s.board[at];
  if (level < 1) {
    // Opposing creatures go to Exile, own creatures to the Reserve.
    removeDie(s, at, byPlayer !== undefined && byPlayer !== die.owner ? "exile" : "reserve", "downgrade");
    return;
  }
  const oldLevel = die.level;
  die.level = Math.min(MAX_LEVEL, level);
  const set = setOf(s, die.owner);
  if (die.level !== oldLevel) emit(s, { t: "level", at, from: oldLevel, to: die.level });
  if (die.level !== oldLevel && set.onLevelChange) set.onLevelChange(s, at, die, oldLevel);
}

/** Queue a decision for `player` (resolved before the turn ends). */
export function pushChoice(s, player, kind, data = {}) {
  s.pending.push({ player, kind, data });
}

// ---------------------------------------------------------------------------
// Power hierarchy
// ---------------------------------------------------------------------------

export function defaultBeats(attLevel, defLevel) {
  if (attLevel === 3 && defLevel === 6) return true;
  return attLevel > defLevel;
}

/** Can the die on `from` defeat the die on `to` (hierarchy + immunities)? */
export function canDefeat(s, from, to) {
  return canDefeatWith(s, s.board[from], from, to);
}

/** Like canDefeat, for an attacker `att` that attacks from square `from`
 *  (which may differ from where the die currently stands, e.g. Wormhole). */
export function canDefeatWith(s, att, from, to) {
  const def = s.board[to];
  if (!att || !def || att.owner === def.owner) return false;
  const attSet = setOf(s, att.owner);
  const beats = attSet.beats ? attSet.beats(s, from, att, def) : undefined;
  if (!(beats ?? defaultBeats(att.level, def.level))) return false;
  const defSet = setOf(s, def.owner);
  if (defSet.isImmuneToAttack && defSet.isImmuneToAttack(s, to, from)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Standard actions
// ---------------------------------------------------------------------------

/** Can the die on `at` be moved? Abilities that *move* a creature (also an
 *  opposing one, e.g. Force of Attraction) respect this; effects that *push*
 *  creatures (e.g. the DoA River) do not. */
export const canMove = (s, at) => {
  const set = setOf(s, s.board[at].owner);
  return set.canMove ? set.canMove(s, at, s.board[at]) : true;
};
const canAttackFrom = (s, at) => {
  const set = setOf(s, s.board[at].owner);
  return set.canAttack ? set.canAttack(s, at, s.board[at]) : canMove(s, at);
};
/** May the Power Level of the die on `at` be raised? Locations can forbid it
 *  (e.g. BoD Oracle). Applies to Upgrades and to abilities that raise levels. */
export function canRaise(s, at) {
  for (const id of s.locations) {
    const loc = getLocation(id);
    if (loc.blocksRaise && loc.blocksRaise(s, at)) return false;
  }
  return true;
}

const canUpgrade = (s, at) => {
  const d = s.board[at];
  if (d.level >= MAX_LEVEL || !canRaise(s, at)) return false;
  const set = setOf(s, d.owner);
  return set.canUpgrade ? set.canUpgrade(s, at, d) : true;
};

/** Standard Movement targets (1 field, adjacent, unoccupied). */
export function standardMoves(s, from) {
  if (!canMove(s, from)) return [];
  return adjacent(from).filter((t) => !s.board[t]);
}

/** Standard Attack targets (adjacent opposing creatures that can be defeated). */
export function standardAttacks(s, from) {
  if (!canAttackFrom(s, from)) return [];
  return adjacent(from).filter((t) => s.board[t] && canDefeat(s, from, t));
}

/** Move a die along `path` (squares, first = current field) to the last,
 *  empty square without triggering anything. */
export function relocate(s, path) {
  const from = path[0], to = path[path.length - 1];
  const die = s.board[from];
  s.board[from] = null;
  s.board[to] = die;
  emit(s, { t: "move", path });
  return die;
}

/** Resolve a movement of the die on `from` to the empty square `to`. */
export function doMove(s, from, to) {
  const die = relocate(s, [from, to]);
  s.turn.movedDieId = die.id;
  finishMoveOrAttack(s, to);
}

/** Resolve an attack of the die on `from` against the die on `to`. */
export function doAttack(s, from, to) {
  const die = s.board[from];
  emit(s, { t: "move", path: [from, to] }); // the attacker moves in, then the defeated die leaves
  defeat(s, to, die.owner);
  s.board[from] = null;
  s.board[to] = die;
  s.turn.movedDieId = die.id;
  finishMoveOrAttack(s, to);
}

/** Call the "ends its Movement or Attack on `at`" hook of the die's set. */
export function finishMoveOrAttack(s, at) {
  const die = s.board[at];
  if (!die) return;
  const set = setOf(s, die.owner);
  if (set.afterMoveOrAttack) set.afterMoveOrAttack(s, at, die);
}

// ---------------------------------------------------------------------------
// Legal actions
// ---------------------------------------------------------------------------

/** The player who has to act now (may differ from s.current during choices). */
export function actor(s) {
  if (s.pending.length) return s.pending[0].player;
  return s.current;
}

/** All legal actions for the player who has to act. */
export function legalActions(s) {
  if (s.phase === "over") return [];
  if (s.phase === "setup") return []; // setups are validated with validateSetup()
  if (s.pending.length) {
    const p = s.pending[0];
    return setOf(s, p.player).choiceOptions(s, p);
  }
  const actions = mainActions(s);
  if (!s.endOfWar && !s.turn.declared) actions.push({ type: "declareEndOfWar" });
  return actions;
}

/** Standard actions (and set abilities) of the current player. */
export function mainActions(s) {
  const player = s.current;
  let out = [];
  for (const from of diceOf(s, player)) out.push(...standardActionsOf(s, from));
  const set = setOf(s, player);
  if (set.extraActions) out.push(...set.extraActions(s, player));
  // The opponent's creatures may restrict the choice (e.g. BoD Temptation).
  const other = setOf(s, opponent(player));
  if (other.constrainOpponent) out = other.constrainOpponent(s, player, out);
  return out;
}

/** Standard Movement, Attack and Upgrade actions of the die on `from`. */
export function standardActionsOf(s, from, { upgrade = true } = {}) {
  const out = [];
  for (const to of standardMoves(s, from)) out.push({ type: "move", from, to });
  for (const to of standardAttacks(s, from)) out.push({ type: "attack", from, to });
  if (upgrade && canUpgrade(s, from)) out.push({ type: "upgrade", at: from });
  return out;
}

/** Square an action starts from (the die that performs it). */
export const actionOrigin = (a) => (a.from !== undefined ? a.from : a.at);

export const actionKey = (a) => JSON.stringify(a);

export function isLegal(s, action) {
  const key = actionKey(action);
  return legalActions(s).some((a) => actionKey(a) === key);
}

// ---------------------------------------------------------------------------
// Setup phase
// ---------------------------------------------------------------------------

/**
 * Check a starting lineup: dice in the player's Supply Zone with a combined
 * Power Level of exactly 10, one die per field.
 * @param {{col:number, level:number, dir?:number}[]} placements
 * @returns {string|null} error message, or null if valid
 */
export function validateSetup(s, player, placements) {
  if (s.phase !== "setup") return "Not in the setup phase.";
  if (player !== s.current) return "It is not this player's setup.";
  if (!placements.length) return "Place at least one die.";
  const cols = new Set();
  let sum = 0;
  for (const { col, level } of placements) {
    if (!Number.isInteger(col) || col < 0 || col > 6) return "Invalid column.";
    if (cols.has(col)) return "Only one die per field.";
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return "Invalid Power Level.";
    cols.add(col);
    sum += level;
  }
  if (placements.length > s.players[player].reserve) return "Not enough dice in the Reserve.";
  if (sum !== SETUP_POWER) return `The combined Power Level must be exactly ${SETUP_POWER} (currently ${sum}).`;
  return null;
}

/** All multisets of Power Levels that form a legal starting lineup (sum 10, at most 7 dice). */
export function setupLevelCombinations() {
  const out = [];
  const rec = (rest, max, acc) => {
    if (rest === 0) { out.push([...acc]); return; }
    if (acc.length === 7) return;
    for (let l = Math.min(max, rest); l >= 1; l--) { acc.push(l); rec(rest - l, l, acc); acc.pop(); }
  };
  rec(SETUP_POWER, MAX_LEVEL, []);
  return out;
}

function applySetup(s, action) {
  const player = s.current;
  const err = validateSetup(s, player, action.placements);
  if (err) throw new Error(err);
  const row = supplyRow(player);
  for (const { col, level, dir } of action.placements) {
    placeDie(s, sq(row, col), player, level, { dir: dir ?? defaultDir(player), cause: "setup" });
  }
  const other = opponent(player);
  if (player === s.startingPlayer) {
    s.current = other;
  } else {
    s.phase = "war";
    s.current = s.startingPlayer;
    s.turnNumber = 1;
    startTurn(s);
  }
}

// ---------------------------------------------------------------------------
// Applying actions and turn flow
// ---------------------------------------------------------------------------

/** Apply an action and return the new state. The input state is not changed. */
export function applyAction(state, action) {
  if (state.phase === "over") throw new Error("The game is over.");
  const s = clone(state);
  if (action.type === "setup") {
    applySetup(s, action);
    return s;
  }
  if (s.pending.length) {
    const p = s.pending.shift();
    setOf(s, p.player).resolveChoice(s, p, action);
  } else if (action.type === "declareEndOfWar") {
    if (s.endOfWar || s.turn.declared) throw new Error("End of War cannot be declared now.");
    s.turn.declared = true;
    s.endOfWar = { declaredBy: s.current, chased: opponent(s.current), turnsFled: 0, dieId: null };
    return s;
  } else {
    applyMain(s, action);
  }
  settlePending(s);
  if (!s.pending.length && s.turn.main) endTurn(s);
  return s;
}

function applyMain(s, action) {
  s.turn.main = action;
  if (action.type !== "move") s.turn.onlyMovement = false;
  performAction(s, action);
}

/** Resolve a standard action or ability (also used for additional actions). */
export function performAction(s, action) {
  if (action.ability) {
    setOf(s, s.current).applyAbility(s, action);
    return;
  }
  switch (action.type) {
    case "move": doMove(s, action.from, action.to); break;
    case "attack": doAttack(s, action.from, action.to); break;
    case "upgrade": setLevel(s, action.at, s.board[action.at].level + 1); break;
    default: throw new Error(`Unknown action type: ${action.type}`);
  }
}

/** Drop pending decisions that have no options left. */
function settlePending(s) {
  while (s.pending.length) {
    const p = s.pending[0];
    if (setOf(s, p.player).choiceOptions(s, p).length) break;
    s.pending.shift();
  }
}

function startTurn(s) {
  s.turn = freshTurnInfo();
  const player = s.current;
  // Step 1 of a turn: "check your TP bar" — all start-of-turn effects.
  for (const id of s.locations) {
    const loc = getLocation(id);
    if (loc.onTurnStart) loc.onTurnStart(s, player);
  }
  const set = setOf(s, player);
  if (set.onTurnStart) set.onTurnStart(s, player);
  settlePending(s);
  // A player without any valid action loses.
  if (!s.pending.length && mainActions(s).length === 0) {
    finish(s, opponent(player), "noValidAction");
  }
}

function endTurn(s) {
  const player = s.current;
  const set = setOf(s, player);
  if (set.onTurnEnd) set.onTurnEnd(s, player);
  for (const id of s.locations) {
    const loc = getLocation(id);
    if (loc.onTurnEnd) loc.onTurnEnd(s, player);
  }

  // Step 3: check the VP bar.
  if (totalVP(s, player) >= WIN_VP) return finish(s, player, "victoryPoints");
  const other = opponent(player);
  if (totalVP(s, other) >= WIN_VP) return finish(s, other, "victoryPoints");

  if (trackEndOfWar(s, player)) return;

  if (s.turnNumber >= s.maxTurns) return finishByVP(s, "turnLimit");

  s.current = other;
  s.turnNumber++;
  startTurn(s);
}

/** Returns true if the game ended through End of War. */
function trackEndOfWar(s, player) {
  const eow = s.endOfWar;
  if (!eow || eow.chased !== player) return false;
  const main = s.turn.main;
  const fled = main && main.type === "move" && !(main.follow && main.follow.type === "attack")
    && s.turn.movedDieId !== null && (eow.dieId === null || eow.dieId === s.turn.movedDieId);
  if (!fled) {
    s.endOfWar = null;
    return false;
  }
  eow.dieId = s.turn.movedDieId;
  eow.turnsFled++;
  if (eow.turnsFled >= END_OF_WAR_TURNS) {
    finishByVP(s, "endOfWar");
    return true;
  }
  return false;
}

function finishByVP(s, reason) {
  const a = totalVP(s, 1), b = totalVP(s, 2);
  finish(s, a === b ? 0 : a > b ? 1 : 2, reason);
}

function finish(s, winner, reason) {
  s.phase = "over";
  s.pending = [];
  s.result = { winner, reason };
}
