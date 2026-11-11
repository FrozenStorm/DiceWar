// AI opponent for DiceWar. Works on top of the rules engine, so it supports
// every dice set the engine implements.
//
// Search: minimax with alpha-beta pruning over whole turns (decisions inside a
// turn such as Balance or Force of Attraction do not cost depth), iterative
// deepening with a time limit (or a fixed node budget for reproducible games),
// and a heuristic evaluation in "VP x 100" units. Among equally rated moves the
// AI picks one at random (opts.random, seedable).

import {
  legalActions, applyAction, actor, totalVP, diceOf, standardAttacks,
  setupLevelCombinations,
} from "../engine/core.js";
import { opponent, fieldBonus, rowOf, colOf, defaultDir } from "../engine/board.js";
import { getLocation } from "../engine/locations/index.js";
import { getSet } from "../engine/sets/index.js";

export const LEVELS = {
  easy: { maxDepth: 2, timeMs: 800, noise: 30, width: 16, book: false },
  medium: { maxDepth: 4, timeMs: 2500, noise: 0, width: 20, book: false },
  hard: { maxDepth: 8, timeMs: 5000, noise: 0, width: 24, book: false },
};

const WIN = 1_000_000;

/** Two root moves count as equally good when their values differ by less than this. */
const TIE_EPS = 1e-6;

/** Node budgets per level for reproducible games (AI Lab). Calibrated so that
 *  they roughly match the time limits above on an average computer. */
export const NODE_BUDGETS = { easy: 50_000, medium: 150_000, hard: 300_000 };

/** Evaluation weights in "VP x 100" units. */
export const DEFAULT_WEIGHTS = {
  tp: 12, reserve: 3, advance: 6, fieldBonus: 10, nearPrey: 12,
  craterOne: 35, craterBoth: 100, oracle: 40, ruin: 40, threatToMove: 70, threatOther: 20,
};
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

function sideValue(s, p, W) {
  const pl = s.players[p];
  let v = 100 * totalVP(s, p) + W.tp * pl.tp + W.reserve * pl.reserve;
  const enemies = diceOf(s, opponent(p));
  for (const at of diceOf(s, p)) {
    const d = s.board[at];
    v += LEVEL_VALUE[d.level];
    const c = colOf(at), r = rowOf(at);
    v += 3 - Math.abs(3 - c) * 0.5; // central columns
    if (d.level >= 2) {
      // Pressure: advance into the opposing half, where defeats give the Field Bonus.
      const advanced = p === 1 ? 6 - r : r;
      v += W.advance * advanced + W.fieldBonus * fieldBonus(p, at);
      // Attack potential: weaker enemies close by.
      for (const e of enemies) {
        const dist = Math.abs(rowOf(e) - r) + Math.abs(colOf(e) - c);
        if (dist <= 2 && s.board[e].level < d.level) v += W.nearPrey;
      }
    }
  }
  if (s.locations.includes("craters")) {
    // Craters give 1 VP every turn while both are held with level 2+.
    const held = getLocation("craters").squares
      .filter((at) => s.board[at] && s.board[at].owner === p && s.board[at].level >= 2).length;
    v += W.craterOne * held + (held === 2 ? W.craterBoth : 0);
  }
  if (s.locations.includes("ruins")) {
    // Holding all Ruins at the end of the own turn wins the game.
    const held = getLocation("ruins").squares.filter((at) => s.board[at] && s.board[at].owner === p).length;
    v += W.ruin * held * held;
  }
  if (s.locations.includes("oracle")) {
    // The Oracle gives 1 TP per turn and sets its occupant to level 4.
    const d = s.board[getLocation("oracle").squares[0]];
    if (d && d.owner === p) v += W.oracle;
  }
  return v;
}

/** Static evaluation of state `s` from the point of view of `me`. */
export function evaluate(s, me, W = DEFAULT_WEIGHTS) {
  if (s.phase === "over") {
    const w = s.result.winner;
    return w === 0 ? 0 : w === me ? WIN : -WIN;
  }
  const opp = opponent(me);
  let v = sideValue(s, me, W) - sideValue(s, opp, W);
  // Threats: the side to move can cash in its best capture, the other side less likely.
  const toMove = s.pending.length ? actor(s) : s.current;
  const mine = bestCapture(s, me), theirs = bestCapture(s, opp);
  v += toMove === me ? W.threatToMove * mine - W.threatOther * theirs : W.threatOther * mine - W.threatToMove * theirs;
  return v;
}

// ---------------------------------------------------------------------------
// Move ordering
// ---------------------------------------------------------------------------

function quickScore(s, a) {
  switch (a.type) {
    case "attack": return 1000 + 10 * (s.board[a.to] ? s.board[a.to].level : 0);
    case "spell": return 500;
    case "choice": return a.sub ? quickScore(s, a.sub) : 400;
    case "upgrade": return a.ability ? 600 : 200 + s.board[a.at].level;
    case "move":
      if (a.follow && a.follow.type === "attack") return 900;
      return 100;
    default: return 0;
  }
}

/** Variants with the same result as another action (e.g. KoS: turning before
 *  instead of after a Movement) are left out of the search. */
const isRedundant = (a) => !!(a.redundant || (a.sub && a.sub.redundant));

function orderedActions(s, width) {
  const acts = legalActions(s).filter((a) => a.type !== "declareEndOfWar" && !isRedundant(a));
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

/** Is the next step a decision the AI makes greedily (long chains of small
 *  steps such as LoD Blood Trade upgrades would blow up the search)? */
function greedyPending(s) {
  if (!s.pending.length || s.phase === "over") return false;
  const p = s.pending[0];
  const set = getSet(s.players[p.player].set);
  return !!(set.aiGreedyChoices && set.aiGreedyChoices.includes(p.kind));
}

/** Best option of a greedy decision by static evaluation for the deciding player. */
function greedyChoice(s, W) {
  const who = actor(s);
  let best = null, bestV = -Infinity;
  for (const a of legalActions(s)) {
    if (isRedundant(a)) continue;
    const v = evaluate(applyAction(s, a), who, W);
    if (v > bestV) { bestV = v; best = a; }
  }
  return best;
}

/** Resolve greedy decisions until the state needs a real choice again. */
function resolveGreedy(s, W) {
  let guard = 0;
  while (greedyPending(s) && guard++ < 20) s = applyAction(s, greedyChoice(s, W));
  return s;
}

function minimax(s, depth, alpha, beta, me, ctx) {
  if (++ctx.nodes >= ctx.maxNodes || (ctx.nodes % 256 === 0 && Date.now() > ctx.deadline)) throw new Timeout();
  if (greedyPending(s)) {
    const t = resolveGreedy(s, ctx.W);
    const nextDepth = t.phase === "over" || t.current !== s.current ? depth - 1 : depth;
    return minimax(t, nextDepth, alpha, beta, me, ctx);
  }
  if (s.phase === "over" || depth === 0) return evaluate(s, me, ctx.W);
  const acts = orderedActions(s, ctx.width);
  if (!acts.length) return evaluate(s, me, ctx.W);
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
 * @param {object} [opts] { level: "easy"|"medium"|"hard", random: () => number,
 *   maxNodes: node budget instead of the level's time limit (reproducible),
 *   overrides: level settings to replace }
 * @returns {{action: object, score: number, depth: number, nodes: number, ties: number}}
 */
export function chooseAction(s, opts = {}) {
  const cfg = { ...LEVELS[opts.level || "medium"], ...(opts.overrides || {}) };
  const random = opts.random || Math.random;
  const me = actor(s);
  const W = { ...DEFAULT_WEIGHTS, ...(cfg.weights || {}) };
  const maxNodes = opts.maxNodes || cfg.maxNodes || 0;
  const ctx = {
    nodes: 0,
    deadline: maxNodes ? Infinity : Date.now() + cfg.timeMs,
    maxNodes: maxNodes || Infinity,
    width: cfg.width,
    W,
  };
  if (greedyPending(s)) return { action: greedyChoice(s, W), score: 0, depth: 0, nodes: 0, ties: 1 };
  let root = orderedActions(s, 0);
  if (cfg.book) {
    const preferred = bookAbility(s, me);
    const inBook = preferred && root.filter((a) => a.ability === preferred);
    // Follow the book, but never miss a capture.
    if (inBook && inBook.length) root = [...inBook, ...root.filter((a) => quickScore(s, a) >= 900)];
  }
  if (root.length === 1) return { action: root[0], score: 0, depth: 0, nodes: 0, ties: 1 };

  // Evaluate every root action once (depth 1 = finish my turn) for ordering and as fallback.
  let scored = root.map((a) => {
    const child = resolveGreedy(applyAction(s, a), W);
    return { a, child, v: evaluate(child, me, W) + (cfg.noise ? (random() - 0.5) * 2 * cfg.noise : 0) };
  });
  scored.sort((x, y) => y.v - x.v);
  let reached = 0;

  for (let depth = 1; depth <= cfg.maxDepth; depth++) {
    try {
      let alpha = -Infinity;
      const results = [];
      for (const item of scored) {
        const childDepth = item.child.phase === "over" || item.child.current !== s.current ? depth - 1 : depth;
        // The window starts just below the best value so far: a move as good as
        // the best one gets its exact value (not only an upper bound) and can
        // take part in the random choice among equal moves.
        let v = minimax(item.child, childDepth, alpha - TIE_EPS, Infinity, me, ctx);
        if (cfg.noise) v += (random() - 0.5) * 2 * cfg.noise;
        results.push({ ...item, v });
        if (v > alpha) alpha = v;
      }
      results.sort((x, y) => y.v - x.v);
      scored = results;
      reached = depth;
      if (Math.abs(results[0].v) >= WIN / 2) break; // forced result found
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      break;
    }
  }
  // Random choice among the moves rated as good as the best one.
  const ties = scored.filter((x) => x.v >= scored[0].v - TIE_EPS);
  const best = ties.length > 1 ? ties[Math.floor(random() * ties.length)] : ties[0];
  return { action: best.a, score: best.v, depth: reached, nodes: ctx.nodes, ties: ties.length };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const PREFERRED_LINEUPS = [[6, 4], [5, 3, 2], [6, 2, 2], [4, 3, 2, 1], [5, 4, 1], [3, 3, 2, 2]];

/** Opening book of a dice set: ability to play in this own turn, if any. */
function bookAbility(s, me) {
  const book = getSet(s.players[me].set).aiBook;
  if (!book || !book.opening || s.pending.length) return null;
  const ownTurn = Math.ceil((s.turnNumber + (s.startingPlayer === me ? 0 : -1)) / 2);
  return book.opening[ownTurn - 1] || null;
}

/** Choose a starting lineup (Power Level 10 in the Supply Zone). */
export function chooseSetup(s, opts = {}) {
  const action = chooseLineup(s, opts);
  if (s.players[s.current].set === "KoS") chooseAlignments(s, action);
  if (s.locations.includes("camp")) {
    // The Camp: on a free field of the Supply Zone, preferably at the side.
    const random = opts.random || Math.random;
    const used = new Set(action.placements.map((p) => p.col));
    const free = [0, 6, 1, 5, 2, 4, 3].filter((c) => !used.has(c));
    action.camp = free[Math.min(free.length - 1, Math.floor(random() * 2))];
  }
  return action;
}

/** KoS: every die of the lineup gets an alignment (kept when upgraded). The
 *  AI tries the 4 alignments die by die and keeps the best evaluated one
 *  (facing the opponent on ties). */
function chooseAlignments(s, action) {
  const me = s.current;
  const forward = defaultDir(me);
  const order = [forward, 1, 3, (forward + 2) % 4];
  action.placements = action.placements.map((p) => ({ ...p, dir: forward }));
  for (const p of action.placements) {
    let best = forward, bestV = -Infinity;
    for (const dir of order) {
      p.dir = dir;
      const v = evaluate(applyAction(s, action), me);
      if (v > bestV + 1e-9) { bestV = v; best = dir; }
    }
    p.dir = best;
  }
}

function chooseLineup(s, opts) {
  const random = opts.random || Math.random;
  const book = getSet(s.players[s.current].set).aiBook;
  if (book && book.setups && opts.level !== "easy") {
    return { type: "setup", placements: book.setups[Math.floor(random() * book.setups.length)] };
  }
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

