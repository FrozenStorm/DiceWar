// Swap the two players of a game: the board is turned by 180 degrees and
// player 1 becomes player 2 (and the other way round). The game is symmetric,
// so the swapped game is the same game seen from the other side. Used to load
// a save so that the person at this device plays player 2's position as
// player 1 (at the bottom), e.g. against the AI.

import { SQUARES } from "./board.js";

const LAST = SQUARES - 1;

// Keys that hold a board square in actions, pending decisions and events.
const SQUARE_KEYS = new Set([
  "a", "b", "at", "bearer", "caster", "emissary", "fisher", "foe", "friend", "from", "fruit", "hag",
  "over", "place", "portal", "raise", "remove", "swap", "target", "to", "upgrade", "watch",
]);
// Keys that hold a player number.
const PLAYER_KEYS = new Set(["player", "owner", "declaredBy", "chased", "winner"]);
// Keys that hold a direction (0 up, 1 right, 2 down, 3 left).
const DIR_KEYS = new Set(["dir", "face", "pre"]);

export const mirrorSquare = (s) => (Number.isInteger(s) && s >= 0 && s <= LAST ? LAST - s : s);
const mirrorPlayer = (p) => (p === 1 ? 2 : p === 2 ? 1 : p);
const mirrorDir = (d) => (Number.isInteger(d) ? (d + 2) % 4 : d);

function mirrorEntry(key, v) {
  if (v === null || v === undefined || typeof v === "boolean" || typeof v === "string") return v;
  if (typeof v === "number") {
    if (SQUARE_KEYS.has(key)) return mirrorSquare(v);
    if (PLAYER_KEYS.has(key)) return mirrorPlayer(v);
    if (DIR_KEYS.has(key)) return mirrorDir(v);
    if (key === "col" || key === "camp") return 6 - v; // setup: column in the Supply Zone
    return v; // levels, counts, die ids, deltas of levels
  }
  if (Array.isArray(v)) {
    if (key === "path" || key === "chain") return v.map(mirrorSquare);
    if (key === "delta") return v.map((x) => -x); // step direction [dr, dc]
    return v.map((x) => mirrorEntry(key, x));
  }
  return mirrorObject(v);
}

function mirrorObject(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) out[k] = mirrorEntry(k, v);
  // Splits in a line keep `a` and `b` as they are (not as core.js lineSplits
  // would list them), so the new dice get the same ids in the same order.
  return out;
}

/** An action (or event) seen from the other side. */
export const mirrorAction = (a) => (a ? mirrorObject(a) : a);

/** The game with both players swapped. The input is not changed. */
export function mirrorGame(g) {
  const board = new Array(SQUARES).fill(null);
  g.board.forEach((d, s) => {
    if (d) board[LAST - s] = { ...d, owner: mirrorPlayer(d.owner), dir: mirrorDir(d.dir) };
  });
  const tiles = new Array(SQUARES).fill(null);
  g.tiles.forEach((t, s) => { tiles[LAST - s] = t ? [...t] : null; });
  const out = {
    ...g,
    // options.mirrored: the rules that are not symmetric between the players
    // (River flow, order of the players' after-action effects) keep working
    // as seen from the original players.
    options: {
      ...g.options,
      riverCol: 6 - (g.options && Number.isInteger(g.options.riverCol) ? g.options.riverCol : 1),
      mirrored: g.options && g.options.mirrored ? undefined : true,
    },
    board,
    tiles,
    players: { 1: { ...g.players[2] }, 2: { ...g.players[1] } },
    startingPlayer: mirrorPlayer(g.startingPlayer),
    current: mirrorPlayer(g.current),
    pending: g.pending.map((p) => ({ ...mirrorObject(p), kind: p.kind })),
    turn: mirrorObject(g.turn),
    endOfWar: g.endOfWar ? mirrorObject(g.endOfWar) : g.endOfWar,
    result: g.result ? mirrorObject(g.result) : g.result,
    events: (g.events || []).map(mirrorObject),
  };
  if (g.camps) out.camps = Object.fromEntries(Object.entries(g.camps).map(([p, s]) => [mirrorPlayer(Number(p)), mirrorSquare(s)]));
  return out;
}

/** JSON of a game for comparisons: sorted keys, no events, and die ids
 *  renumbered by board position (two dice placed at once may get their ids
 *  in the other order in a mirrored game). */
export function gameKey(g) {
  const ids = new Map();
  g.board.forEach((d) => { if (d && !ids.has(d.id)) ids.set(d.id, -(ids.size + 1)); });
  const id = (x) => (ids.has(x) ? ids.get(x) : x);
  return JSON.stringify(g, (k, v) => {
    if (k === "events") return undefined;
    if (k === "id" || k === "movedDieId" || k === "dieId") return id(v);
    if ((k === "swordsActed" || k === "moved") && Array.isArray(v)) return v.map(id).sort((a, b) => a - b);
    if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]));
    return v;
  });
}

/**
 * Swap the players of a game together with its history (start state and the
 * actions from there). Returns { game, history } where history is null if it
 * could not be carried over.
 * @param {object} game
 * @param {{start: object, actions: object[]}|null} history
 * @param {(state: object, action: object) => object} applyAction
 * @param {(state: object) => object[]} legalActions
 */
export function mirrorWithHistory(game, history, applyAction, legalActions) {
  const mirrored = mirrorGame(game);
  if (!history || !history.start || !Array.isArray(history.actions)) return { game: mirrored, history: null };
  try {
    let orig = history.start;
    let m = mirrorGame(orig);
    const start = m;
    const actions = [];
    for (const a of history.actions) {
      const next = applyAction(orig, a);
      const want = gameKey(mirrorGame(next));
      let b = mirrorAction(a);
      let mNext = null;
      try { mNext = applyAction(m, b); } catch (e) { mNext = null; }
      if (!mNext || gameKey(mNext) !== want) {
        // Same move by another route (e.g. around the other side of a corner).
        mNext = null;
        for (const c of m.phase === "setup" ? [] : legalActions(m)) {
          const r = applyAction(m, c);
          if (gameKey(r) === want) { b = c; mNext = r; break; }
        }
        if (!mNext) return { game: mirrored, history: null };
      }
      actions.push(b);
      orig = next;
      m = mNext;
    }
    if (gameKey(m) !== gameKey(mirrored)) return { game: mirrored, history: null };
    return { game: m, history: { start, actions } };
  } catch (err) {
    return { game: mirrored, history: null };
  }
}
