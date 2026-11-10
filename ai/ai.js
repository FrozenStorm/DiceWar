// AI opponent for DiceWar. Works on top of the rules engine, so it supports
// every dice set the engine implements.
//
// Search: minimax with alpha-beta pruning over whole turns (decisions inside a
// turn such as Balance or Force of Attraction do not cost depth), iterative
// deepening with a time limit, and a heuristic evaluation in "VP x 100" units.

import {
  legalActions, applyAction, actor, totalVP, diceOf, standardAttacks,
  setupLevelCombinations,
} from "../engine/core.js";
import { opponent, fieldBonus, rowOf, colOf } from "../engine/board.js";
import { getLocation } from "../engine/locations/index.js";

export const LEVELS = {
  easy: { maxDepth: 1, timeMs: 400, noise: 120, width: 12 },
  medium: { maxDepth: 2, timeMs: 1500, noise: 15, width: 24 },
  hard: { maxDepth: 3, timeMs: 4000, noise: 0, width: 30 },
};

const WIN = 1_000_000;
const LEVEL_VALUE = [0, 20, 30, 45, 55, 65, 80];

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** Best VP gain of a standard attack available to `p` right now. */
function bestCapture(s, p) {
  let best = 0;
  for (const from of diceOf(s, p)) {
    for (const to of standardAttacks(s, from)) {
      const v = s.board[to].level + fieldBonus(p, to);
      if (v > best) best = v;
    }
  }
  return best;
}

function sideValue(s, p) {
  const pl = s.players[p];
  let v = 100 * totalVP(s, p) + 12 * pl.tp + 3 * pl.reserve;
  for (const at of diceOf(s, p)) {
    const d = s.board[at];
    v += LEVEL_VALUE[d.level];
    v += 4 * fieldBonus(p, at); // pressure on the opposing half
    const c = colOf(at), r = rowOf(at);
    v += 3 - Math.abs(3 - c) * 0.5 - Math.abs(3 - r) * 0.5; // central squares
  }
  for (const id of s.locations) {
    const loc = getLocation(id);
    if (id === "craters" && loc.squares.every((at) => s.board[at] && s.board[at].owner === p && s.board[at].level >= 2)) {
      v += 60;
    }
  }
  return v;
}

/** Static evaluation of state `s` from the point of view of `me`. */
export function evaluate(s, me) {
  if (s.phase === "over") {
    const w = s.result.winner;
    return w === 0 ? 0 : w === me ? WIN : -WIN;
  }
  const opp = opponent(me);
  let v = sideValue(s, me) - sideValue(s, opp);
  // Threats: the side to move can cash in its best capture, the other side less likely.
  const toMove = s.pending.length ? actor(s) : s.current;
  const mine = bestCapture(s, me), theirs = bestCapture(s, opp);
  v += toMove === me ? 70 * mine - 20 * theirs : 20 * mine - 70 * theirs;
  return v;
}

// ---------------------------------------------------------------------------
// Move ordering
// ---------------------------------------------------------------------------

function quickScore(s, a) {
  switch (a.type) {
    case "attack": return 1000 + 10 * (s.board[a.to] ? s.board[a.to].level : 0);
    case "spell": return 500;
    case "choice": return 400;
    case "upgrade": return 200 + s.board[a.at].level;
    case "move":
      if (a.follow && a.follow.type === "attack") return 900;
      return 100;
    default: return 0;
  }
}

function orderedActions(s, width) {
  const acts = legalActions(s).filter((a) => a.type !== "declareEndOfWar");
  acts.sort((x, y) => quickScore(s, y) - quickScore(s, x));
  if (width && acts.length > width) {
    // Keep all captures plus the best-ranked rest.
    const caps = acts.filter((a) => quickScore(s, a) >= 900);
    const rest = acts.filter((a) => quickScore(s, a) < 900);
    return [...caps, ...rest.slice(0, Math.max(0, width - caps.length))];
  }
  return acts;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

class Timeout extends Error {}

function minimax(s, depth, alpha, beta, me, ctx) {
  if (++ctx.nodes % 256 === 0 && Date.now() > ctx.deadline) throw new Timeout();
  if (s.phase === "over" || depth === 0) return evaluate(s, me);
  const acts = orderedActions(s, ctx.width);
  if (!acts.length) return evaluate(s, me);
  const maximizing = actor(s) === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const a of acts) {
    const child = applyAction(s, a);
    const nextDepth = child.phase === "over" || child.current !== s.current ? depth - 1 : depth;
    const v = minimax(child, nextDepth, alpha, beta, me, ctx);
    if (maximizing) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Choose an action for the player who has to act in `s`.
 * @param {object} s engine state (war phase)
 * @param {object} [opts] { level: "easy"|"medium"|"hard", random: () => number }
 * @returns {{action: object, score: number, depth: number, nodes: number}}
 */
export function chooseAction(s, opts = {}) {
  const cfg = { ...LEVELS[opts.level || "medium"], ...(opts.overrides || {}) };
  const random = opts.random || Math.random;
  const me = actor(s);
  const ctx = { nodes: 0, deadline: Date.now() + cfg.timeMs, width: cfg.width };
  const root = orderedActions(s, 0);
  if (root.length === 1) return { action: root[0], score: 0, depth: 0, nodes: 0 };

  // Evaluate every root action once (depth 1 = finish my turn) for ordering and as fallback.
  let scored = root.map((a) => {
    const child = applyAction(s, a);
    return { a, child, v: evaluate(child, me) + (cfg.noise ? (random() - 0.5) * 2 * cfg.noise : 0) };
  });
  scored.sort((x, y) => y.v - x.v);
  let best = scored[0];
  let reached = 0;

  for (let depth = 1; depth <= cfg.maxDepth; depth++) {
    try {
      let alpha = -Infinity;
      const results = [];
      for (const item of scored) {
        const childDepth = item.child.phase === "over" || item.child.current !== s.current ? depth - 1 : depth;
        let v = minimax(item.child, childDepth, alpha, Infinity, me, ctx);
        if (cfg.noise) v += (random() - 0.5) * 2 * cfg.noise;
        results.push({ ...item, v });
        if (v > alpha) alpha = v;
      }
      results.sort((x, y) => y.v - x.v);
      scored = results;
      best = results[0];
      reached = depth;
      if (Math.abs(best.v) >= WIN / 2) break; // forced result found
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      break;
    }
  }
  return { action: best.a, score: best.v, depth: reached, nodes: ctx.nodes };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const PREFERRED_LINEUPS = [[6, 4], [5, 3, 2], [6, 2, 2], [4, 3, 2, 1], [5, 4, 1], [3, 3, 2, 2]];

/** Choose a starting lineup (Power Level 10 in the Supply Zone). */
export function chooseSetup(s, opts = {}) {
  const random = opts.random || Math.random;
  const pool = opts.level === "easy" ? setupLevelCombinations().filter((c) => c.length <= 5) : PREFERRED_LINEUPS;
  const levels = [...pool[Math.floor(random() * pool.length)]];
  // Strongest creatures in the centre, spread out.
  const order = [3, 2, 4, 1, 5, 0, 6];
  const start = Math.floor(random() * 2);
  const cols = order.slice(start, start + levels.length);
  if (cols.length < levels.length) cols.push(...order.filter((c) => !cols.includes(c)).slice(0, levels.length - cols.length));
  levels.sort((a, b) => b - a);
  return { type: "setup", placements: levels.map((level, i) => ({ col: cols[i], level })) };
}

