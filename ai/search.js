// Search of the AI. All levels use it; they differ only in their settings
// (thinking time, depth, quiescence, noise: see LEVELS in ai.js).
//
// - transposition table: positions reached again by another order of moves
//   are not searched twice, and their best move is tried first next time;
// - move ordering (table move, captures, killer moves, history) so that
//   alpha-beta cuts off early;
// - late moves are searched with reduced depth and only re-searched when they
//   turn out to be good, instead of dropping moves;
// - every decision inside a turn (where to place a die, which First Sword acts
//   next, how to spend Blood Trade TP) is searched like a move. A turn costs
//   PLY units of depth and a decision inside it CHOICE_COST, so chains of
//   decisions are searched exactly near the root; only beyond the horizon is
//   a decision taken by the evaluation of its options;
// - quiescence search: at the horizon, captures are played out before the
//   position is rated, so the AI does not stop thinking in the middle of an
//   exchange;
// - wins are worth more the sooner they happen, so a won game is finished.
//
// Values are always seen from the player `p` passed to the function (negamax).

import { legalActions, mainActions, applyAction, actor, totalVP, diceOf } from "../engine/core.js";
import { fieldBonus, SQUARES } from "../engine/board.js";
import { WIN, evaluate, WEIGHTS } from "./eval.js";

/** Thrown inside a search when its time or node budget is used up. */
class Timeout extends Error {}

/** Variants with the same result as another action (KoS: turning before
 *  instead of after a Movement; placements in another order) are skipped. */
const isRedundant = (a) => !!(a.redundant || (a.sub && a.sub.redundant));

const MAX_PLY = 64;
/** Units of depth: a whole turn, and one decision inside a turn. */
const PLY = 4, CHOICE_COST = 1;
/** Share of the thinking time for a decision inside a turn (e.g. where to place a die). */
const CHOICE_SHARE = 0.2;
/** Default plies of captures searched beyond the horizon. */
const QUIESCENCE_PLIES = 4;
/** The AI declares the End of War when it leads, the game is past this turn
 *  and the opponent has at most this many creatures left (a chase). */
const END_OF_WAR_FROM_TURN = 40, END_OF_WAR_MAX_DICE = 2;

// --- Position keys -----------------------------------------------------------
// Two independent 32-bit hashes of a position (Zobrist): one is the slot in
// the table, the other one is stored to recognise the position.

const zrand = (() => {
  let a = 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) | 0;
  };
})();
const zobrist = (n) => Int32Array.from({ length: n }, zrand);
// die: square x (owner 2, level 6, alignment 4)
const Z_DIE = [zobrist(SQUARES * 48), zobrist(SQUARES * 48)];
// counters of both players: reserve, exile, TP, VP (0..15 each)
const Z_BAR = [zobrist(2 * 4 * 16), zobrist(2 * 4 * 16)];
const Z_TURN = [zrand(), zrand()];
const Z_EOW = [zobrist(2 * 8), zobrist(2 * 8)];

const key = [0, 0];
/** Hash the position `s` (at the start of a turn, no open decision) into `key`. */
function hashState(s) {
  let h0 = 0, h1 = 0;
  const board = s.board;
  for (let i = 0; i < SQUARES; i++) {
    const d = board[i];
    if (!d) continue;
    const z = i * 48 + (d.owner - 1) * 24 + (d.level - 1) * 4 + d.dir;
    h0 ^= Z_DIE[0][z]; h1 ^= Z_DIE[1][z];
  }
  for (let p = 1; p <= 2; p++) {
    const pl = s.players[p];
    const base = (p - 1) * 64;
    const a = base + (pl.reserve & 15), b = base + 16 + (pl.exile & 15), c = base + 32 + (pl.tp & 15), d = base + 48 + (pl.vp & 15);
    h0 ^= Z_BAR[0][a] ^ Z_BAR[0][b] ^ Z_BAR[0][c] ^ Z_BAR[0][d];
    h1 ^= Z_BAR[1][a] ^ Z_BAR[1][b] ^ Z_BAR[1][c] ^ Z_BAR[1][d];
  }
  if (s.current === 2) { h0 ^= Z_TURN[0]; h1 ^= Z_TURN[1]; }
  const eow = s.endOfWar;
  if (eow) {
    const z = (eow.chased - 1) * 8 + (eow.turnsFled & 7);
    h0 ^= Z_EOW[0][z]; h1 ^= Z_EOW[1][z];
  }
  key[0] = h0; key[1] = h1;
}

// --- Transposition table -------------------------------------------------------

const TT_BITS = 18, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
const EXACT = 1, LOWER = 2, UPPER = 3;
const ttCheck = new Int32Array(TT_SIZE);
const ttMeta = new Int32Array(TT_SIZE); // depth * 4 + bound, 0 = empty
const ttMove = new Int32Array(TT_SIZE);
const ttValue = new Float64Array(TT_SIZE);

// --- Move ordering ---------------------------------------------------------------

/** Number that identifies an action well enough for move ordering. */
function signature(a) {
  if (a.sub) a = a.sub;
  const origin = a.from !== undefined ? a.from : a.at !== undefined ? a.at : 62;
  const dest = a.to !== undefined ? a.to : a.target !== undefined ? a.target
    : a.place !== undefined ? a.place : a.upgrade !== undefined ? a.upgrade : 62;
  const kind = a.type === "attack" ? 1 : a.type === "move" ? 2 : a.type === "upgrade" ? 3 : 0;
  return ((kind * 64 + origin + 1) * 64 + dest + 1) * 2 + (a.ability ? 1 : 0);
}
const SIGNATURES = 4 * 64 * 64 * 2 + 256;

const isCapture = (a) => a.type === "attack" || (a.follow !== undefined && a.follow.type === "attack")
  || (a.sub !== undefined && a.sub.type === "attack");

/** Rough gain of a capture: VP for the victim, cheap attackers first. */
function captureGain(s, p, a) {
  if (a.sub) a = a.sub;
  const to = a.follow ? a.follow.to : a.to;
  const victim = s.board[to];
  const attacker = s.board[a.from];
  return (victim ? victim.level + fieldBonus(p, to) : 0) * 8 - (attacker ? attacker.level : 0);
}

function staticOrder(s, a) {
  switch (a.type) {
    case "spell": return 500;
    case "choice": return a.sub ? staticOrder(s, a.sub) : 400;
    case "upgrade": return a.ability ? 600 : 200 + s.board[a.at].level;
    default: return 100;
  }
}

/** Actions of the player to act, best candidates first. */
function orderedActions(s, p, ctx, ply, tableMove) {
  const all = s.pending.length ? legalActions(s) : mainActions(s);
  const acts = [], scores = [];
  const history = ctx.history[p - 1];
  const k0 = ctx.killers[2 * ply], k1 = ctx.killers[2 * ply + 1];
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (a.type === "declareEndOfWar" || isRedundant(a)) continue;
    const sig = signature(a);
    let score;
    if (sig === tableMove) score = 3e9;
    else if (isCapture(a)) score = 2e9 + captureGain(s, p, a);
    else if (sig === k0 || sig === k1) score = 1e9;
    else score = Math.min(history[sig], 9e5) * 1000 + staticOrder(s, a);
    acts.push(a); scores.push(score);
  }
  // Sort by score, keeping the order of generation among equals.
  const index = acts.map((_, i) => i);
  index.sort((x, y) => scores[y] - scores[x] || x - y);
  return index.map((i) => acts[i]);
}

// --- Search -------------------------------------------------------------------

/** Value of a finished game for `p`; earlier wins and later losses are better. */
const overValue = (s, p, ply) => {
  const w = s.result.winner;
  return w === 0 ? 0 : w === p ? WIN - ply : ply - WIN;
};

function tick(ctx) {
  if (++ctx.nodes >= ctx.maxNodes || (ctx.nodes % 128 === 0 && Date.now() > ctx.deadline)) throw new Timeout();
}

/** Depth left after `child` was reached from `s` by one action. */
const nextDepth = (s, child, depth) =>
  depth - (child.phase === "over" || child.current !== s.current ? PLY : CHOICE_COST);

/** Value of `child` for `p`, searched with the given routine. */
function childValue(child, p, search, depth, alpha, beta, ply, ctx) {
  if (child.phase === "over") return overValue(child, p, ply);
  const q = actor(child);
  return q === p ? search(child, p, depth, alpha, beta, ply, ctx) : -search(child, q, depth, -beta, -alpha, ply, ctx);
}

/** The options of the decision open in `s` with their results, best rated
 *  first for the player who decides. */
function optionsByEvaluation(s, ctx) {
  const who = actor(s);
  const all = legalActions(s);
  const acts = [], children = [], values = [];
  for (let i = 0; i < all.length; i++) {
    if (isRedundant(all[i])) continue;
    const child = applyAction(s, all[i]);
    acts.push(all[i]); children.push(child);
    values.push(child.phase === "over" ? overValue(child, who, 0) : ctx.evalFn(child, who, ctx.W));
  }
  const index = acts.map((_, i) => i);
  index.sort((x, y) => values[y] - values[x] || x - y);
  return { acts: index.map((i) => acts[i]), children: index.map((i) => children[i]) };
}

/** Captures only, until the position is quiet. */
function quiescence(s, p, depth, alpha, beta, ply, ctx) {
  tick(ctx);
  if (s.pending.length) {
    // Beyond the horizon a decision inside the turn is taken by the
    // evaluation of its options.
    const { children } = optionsByEvaluation(s, ctx);
    if (!children.length || ply >= MAX_PLY) return ctx.evalFn(s, p, ctx.W);
    const child = children[0];
    const next = child.phase !== "over" && child.current !== s.current ? depth - 1 : depth;
    return childValue(child, p, quiescence, next, alpha, beta, ply + 1, ctx);
  }
  let best = ctx.evalFn(s, p, ctx.W);
  if (depth <= 0 || best >= beta || ply >= MAX_PLY) return best;
  if (best > alpha) alpha = best;
  const all = mainActions(s);
  let caps = [];
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (isCapture(a) && !isRedundant(a)) caps.push(a);
  }
  if (caps.length > 1) {
    const gain = caps.map((a) => captureGain(s, p, a));
    caps = caps.map((a, i) => i).sort((x, y) => gain[y] - gain[x] || x - y).map((i) => caps[i]);
  }
  for (let i = 0; i < caps.length; i++) {
    const child = applyAction(s, caps[i]);
    const next = child.phase !== "over" && child.current !== s.current ? depth - 1 : depth;
    const v = childValue(child, p, quiescence, next, alpha, beta, ply + 1, ctx);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function negamax(s, p, depth, alpha, beta, ply, ctx) {
  if (depth <= 0 || ply >= MAX_PLY) return quiescence(s, p, ctx.quiescence, alpha, beta, ply, ctx);
  tick(ctx);

  // Transposition table (only for positions at the start of a turn: inside
  // a turn, what happened so far differs between orders of moves).
  const inTurn = s.pending.length > 0;
  let slot = 0, check = 0, tableMove = -1;
  const alpha0 = alpha;
  if (!inTurn) {
    hashState(s);
    slot = key[0] & TT_MASK; check = key[1] || 1;
    if (ttCheck[slot] === check && ttMeta[slot] !== 0) {
      tableMove = ttMove[slot];
      const meta = ttMeta[slot];
      if ((meta >> 2) >= depth) {
        let v = ttValue[slot];
        if (v > WIN / 2) v -= ply; else if (v < -WIN / 2) v += ply;
        const bound = meta & 3;
        if (bound === EXACT) return v;
        if (bound === LOWER && v > alpha) alpha = v;
        else if (bound === UPPER && v < beta) beta = v;
        if (alpha >= beta) return v;
      }
    }
  }

  // Decisions inside a turn: options in the order of their evaluation (their
  // results are needed anyway). Main actions: the usual move ordering.
  let acts, children = null;
  if (inTurn) ({ acts, children } = optionsByEvaluation(s, ctx));
  else acts = orderedActions(s, p, ctx, ply, tableMove);
  if (!acts.length) return ctx.evalFn(s, p, ctx.W);
  let best = -Infinity, bestSig = -1;
  for (let i = 0; i < acts.length; i++) {
    const a = acts[i];
    const child = children ? children[i] : applyAction(s, a);
    const next = nextDepth(s, child, depth);
    let v;
    if (i === 0) {
      v = childValue(child, p, negamax, next, alpha, beta, ply + 1, ctx);
    } else {
      // Late moves: reduced depth and a minimal window first. Late options of
      // a decision inside a turn are always reduced (they come in the order of
      // the evaluation of their results); beyond the horizon the rest of the
      // turn is then decided by that evaluation.
      let reduced = next;
      const from = inTurn ? 0 : 2 * PLY;
      if (depth > from && i >= ctx.lateFrom && !isCapture(a)) reduced -= i >= ctx.veryLateFrom && depth >= from + PLY ? 2 * PLY : PLY;
      v = childValue(child, p, negamax, reduced, alpha, alpha + 1e-3, ply + 1, ctx);
      if (v > alpha && (reduced < next || v < beta)) v = childValue(child, p, negamax, next, alpha, beta, ply + 1, ctx);
    }
    if (v > best) { best = v; bestSig = signature(a); }
    if (best > alpha) alpha = best;
    if (alpha >= beta) {
      if (!isCapture(a)) {
        // Remember quiet moves that refute the opponent's play.
        const sig = signature(a);
        if (ctx.killers[2 * ply] !== sig) { ctx.killers[2 * ply + 1] = ctx.killers[2 * ply]; ctx.killers[2 * ply] = sig; }
        ctx.history[p - 1][sig] += depth * depth;
      }
      break;
    }
  }

  if (!inTurn) {
    const old = ttMeta[slot];
    if (ttCheck[slot] !== check || (old >> 2) <= depth) {
      let v = best;
      if (v > WIN / 2) v += ply; else if (v < -WIN / 2) v -= ply;
      ttCheck[slot] = check;
      ttMeta[slot] = depth * 4 + (best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT);
      ttMove[slot] = bestSig;
      ttValue[slot] = v;
    }
  }
  return best;
}

const newContext = (cfg) => ({
  nodes: 0,
  deadline: Infinity,
  maxNodes: Infinity,
  W: { ...WEIGHTS, ...(cfg.weights || {}) },
  evalFn: evaluate,
  quiescence: cfg.quiescence ?? QUIESCENCE_PLIES,
  lateFrom: cfg.lateFrom ?? 4,
  veryLateFrom: cfg.veryLateFrom ?? 12,
  killers: new Int32Array(2 * (MAX_PLY + 2)).fill(-1),
  history: [new Float64Array(SIGNATURES), new Float64Array(SIGNATURES)],
});

/** The End of War costs no action. When the opponent has only a few creatures
 *  left and could run away for ever, the leading side declares it. */
function declaresEndOfWar(s, me) {
  return !s.pending.length && !s.endOfWar && !s.turn.declared && s.turnNumber >= END_OF_WAR_FROM_TURN
    && totalVP(s, me) > totalVP(s, 3 - me) && diceOf(s, 3 - me).length <= END_OF_WAR_MAX_DICE;
}

/**
 * The start of a search: either the decision is clear without searching
 * (`result`), or the root actions come back with their results, sorted by a
 * first rating (plus the level's noise).
 */
function rootStart(s, cfg, random, ctx) {
  const me = actor(s);
  if (declaresEndOfWar(s, me)) return { result: { action: { type: "declareEndOfWar" }, score: 0, depth: 0, nodes: 0 } };
  const actions = s.pending.length ? optionsByEvaluation(s, ctx).acts : orderedActions(s, me, ctx, 0, -1);
  if (actions.length === 1) return { result: { action: actions[0], score: 0, depth: 0, nodes: 0 } };
  const root = actions.map((a) => {
    const child = applyAction(s, a);
    const v = child.phase === "over" ? overValue(child, me, 1) : ctx.evalFn(child, me, ctx.W);
    // Noise (weaker levels): a fixed random amount per move for this search.
    return { a, child, v, noise: cfg.noise ? (random() - 0.5) * 2 * cfg.noise : 0, jitter: random() };
  });
  root.sort((x, y) => y.v + y.noise - x.v - x.noise || x.jitter - y.jitter);
  return { root, share: s.pending.length ? CHOICE_SHARE : 1 };
}

/**
 * Choose an action for the player who has to act in `s`.
 * @param {object} s engine state (war phase)
 * @param {object} cfg level settings: timeMs, maxDepth, quiescence, noise, weights, lateFrom, veryLateFrom
 * @param {() => number} random
 * @param {number} [maxNodes] node budget instead of the time limit (reproducible)
 * @returns {{action: object, score: number, depth: number, nodes: number}}
 */
export function chooseSearchAction(s, cfg, random, maxNodes = 0) {
  const me = actor(s);
  const ctx = newContext(cfg);
  const start = rootStart(s, cfg, random, ctx);
  if (start.result) return start.result;
  const { share } = start;
  let root = start.root;
  ctx.deadline = maxNodes ? Infinity : Date.now() + cfg.timeMs * share;
  ctx.maxNodes = maxNodes ? Math.ceil(maxNodes * share) : Infinity;
  // The table is kept between the moves of a game, but values from another
  // game or evaluation must not leak in: it is cleared for every search.
  ttMeta.fill(0);

  // With noise, moves up to twice the noise below the best one get exact
  // values: after adding the noise, any of them can come out on top.
  const margin = 2 * (cfg.noise || 0);
  const score = (item) => item.v + item.noise;
  let best = root[0];
  let reached = 0;
  const started = Date.now();

  for (let d = 1; d <= cfg.maxDepth; d++) {
    const depth = d * PLY;
    let alpha = -Infinity;
    let iterationBest = null;
    try {
      for (let i = 0; i < root.length; i++) {
        const item = root[i];
        const next = nextDepth(s, item.child, depth);
        let v;
        if (i === 0) v = childValue(item.child, me, negamax, next, -Infinity, Infinity, 1, ctx);
        else {
          const low = alpha - margin;
          v = childValue(item.child, me, negamax, next, low, low + 1e-3, 1, ctx);
          if (v > low) v = childValue(item.child, me, negamax, next, low, Infinity, 1, ctx);
        }
        item.v = v;
        if (v > alpha) alpha = v;
        if (!iterationBest || score(item) > score(iterationBest)) iterationBest = item;
      }
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      // An unfinished iteration still counts if it found a move that is
      // better than the first one (the best of the previous iteration).
      if (iterationBest && iterationBest !== root[0]) best = iterationBest;
      break;
    }
    best = iterationBest;
    reached = d;
    // Best move first for the next iteration; the others keep their order.
    root = [best, ...root.filter((x) => x !== best)];
    if (Math.abs(best.v) >= WIN / 2) break; // forced result found
    // The next iteration takes several times as long: stop if it cannot finish.
    if (!maxNodes && Date.now() - started > cfg.timeMs * share * 0.6) break;
  }
  return { action: best.a, score: best.v, depth: reached, nodes: ctx.nodes };
}

// ---------------------------------------------------------------------------
// Parts for the multi-core search (parallel.js): the root is split up,
// several background threads each search single root actions.
// ---------------------------------------------------------------------------

/**
 * The start of a multi-core search: either the decision is clear without
 * searching (`result`), or the root actions come back in their first order.
 * @returns {{result: object}|{share: number, actions: object[], values: number[]}}
 */
export function searchRoot(s, cfg, random) {
  const start = rootStart(s, cfg, random, newContext(cfg));
  if (start.result) return start;
  return { share: start.share, actions: start.root.map((x) => x.a), values: start.root.map((x) => x.v) };
}

/**
 * One thread of the multi-core search. `start` takes the position and its
 * root actions; `run` searches one of them to the given depth (in turns).
 * With `alpha` the thread first only checks whether the action beats that
 * value and searches it exactly only if it does (null: exact straight away).
 */
export function createRootSearcher() {
  let ctx = null, me = 0, state = null, children = [];
  return {
    start(s, cfg, actions) {
      ctx = newContext(cfg);
      me = actor(s);
      state = s;
      ttMeta.fill(0);
      children = actions.map((a) => applyAction(s, a));
    },
    run(index, turns, alpha, deadline) {
      const child = children[index];
      const next = nextDepth(state, child, turns * PLY);
      const before = ctx.nodes;
      ctx.deadline = deadline;
      try {
        let v;
        if (alpha === null) v = childValue(child, me, negamax, next, -Infinity, Infinity, 1, ctx);
        else {
          v = childValue(child, me, negamax, next, alpha, alpha + 1e-3, 1, ctx);
          if (v > alpha) v = childValue(child, me, negamax, next, alpha, Infinity, 1, ctx);
        }
        return { v, nodes: ctx.nodes - before };
      } catch (e) {
        if (!(e instanceof Timeout)) throw e;
        return { timeout: true, nodes: ctx.nodes - before };
      }
    },
  };
}
