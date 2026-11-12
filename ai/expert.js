// Search of the "expert" AI level.
//
// Compared with the classic search (ai.js) it looks deeper in the same time:
// - transposition table: positions reached again by another order of moves
//   are not searched twice, and their best move is tried first next time;
// - move ordering (table move, captures, killer moves, history) so that
//   alpha-beta cuts off early;
// - late moves are searched with reduced depth and only re-searched when they
//   turn out to be good, instead of dropping all moves beyond a fixed width;
// - quiescence search: at the horizon, captures are played out before the
//   position is rated, so the AI does not stop thinking in the middle of an
//   exchange;
// - wins are worth more the sooner they happen, so a won game is finished.
//
// Values are always seen from the player `p` passed to the function
// (negamax); a turn is one ply of depth, decisions inside a turn are free.

import { legalActions, mainActions, applyAction, actor, totalVP, diceOf } from "../engine/core.js";
import { fieldBonus, SQUARES } from "../engine/board.js";
import { WIN, evaluateExpert, EXPERT_WEIGHTS } from "./eval.js";
import { Timeout, isRedundant, greedyPending, resolveGreedy } from "./common.js";

const MAX_PLY = 64;
/** Share of the thinking time for a decision inside a turn (e.g. where to place a die). */
const CHOICE_SHARE = 0.2;
/** Plies of captures searched beyond the horizon. */
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

/** Apply `a`, settle the decisions the AI takes greedily. */
const play = (s, a, ctx) => resolveGreedy(applyAction(s, a), ctx.W, ctx.evalFn, true);

/** Value of `child` for `p`, searched with the given routine. */
function childValue(child, p, search, depth, alpha, beta, ply, ctx) {
  if (child.phase === "over") return overValue(child, p, ply);
  const q = actor(child);
  return q === p ? search(child, p, depth, alpha, beta, ply, ctx) : -search(child, q, depth, -beta, -alpha, ply, ctx);
}

/** Captures only, until the position is quiet. */
function quiescence(s, p, depth, alpha, beta, ply, ctx) {
  tick(ctx);
  const open = s.pending.length > 0; // a decision has to be taken: no standing pat
  let best = -Infinity;
  // Safety net: a chain of decisions inside one turn must not run on forever.
  if (open && ply >= MAX_PLY) return ctx.evalFn(s, p, ctx.W);
  if (!open) {
    best = ctx.evalFn(s, p, ctx.W);
    if (depth <= 0 || best >= beta || ply >= MAX_PLY) return best;
    if (best > alpha) alpha = best;
  }
  const all = open ? legalActions(s) : mainActions(s);
  let caps = [];
  for (let i = 0; i < all.length; i++) {
    const a = all[i];
    if (isRedundant(a) || a.type === "declareEndOfWar") continue;
    if (open || isCapture(a)) caps.push(a);
  }
  if (!open && caps.length > 1) {
    const gain = caps.map((a) => captureGain(s, p, a));
    caps = caps.map((a, i) => i).sort((x, y) => gain[y] - gain[x] || x - y).map((i) => caps[i]);
  }
  for (let i = 0; i < caps.length; i++) {
    const child = play(s, caps[i], ctx);
    const next = child.phase !== "over" && child.current !== s.current ? depth - 1 : depth;
    const v = childValue(child, p, quiescence, next, alpha, beta, ply + 1, ctx);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function negamax(s, p, depth, alpha, beta, ply, ctx) {
  if (depth <= 0 || ply >= MAX_PLY) return quiescence(s, p, QUIESCENCE_PLIES, alpha, beta, ply, ctx);
  tick(ctx);

  // Transposition table (only for positions at the start of a turn).
  const useTable = s.pending.length === 0;
  let slot = 0, check = 0, tableMove = -1;
  const alpha0 = alpha;
  if (useTable) {
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

  const acts = orderedActions(s, p, ctx, ply, tableMove);
  if (!acts.length) return ctx.evalFn(s, p, ctx.W);
  let best = -Infinity, bestSig = -1;
  for (let i = 0; i < acts.length; i++) {
    const a = acts[i];
    const child = play(s, a, ctx);
    const turnOver = child.phase === "over" || child.current !== s.current;
    const next = turnOver ? depth - 1 : depth;
    let v;
    if (i === 0 || !turnOver) {
      v = childValue(child, p, negamax, next, alpha, beta, ply + 1, ctx);
    } else {
      // Late quiet moves: reduced depth and a minimal window first.
      let reduced = next;
      if (depth >= 2 && i >= ctx.lateFrom && !isCapture(a)) reduced -= i >= ctx.veryLateFrom && depth >= 3 ? 2 : 1;
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

  if (useTable) {
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

/**
 * Choose an action for the player who has to act in `s`.
 * @param {object} s engine state (war phase)
 * @param {object} cfg level settings: maxDepth, timeMs, weights, lateFrom, veryLateFrom
 * @param {() => number} random
 * @param {number} [maxNodes] node budget instead of the time limit (reproducible)
 * @returns {{action: object, score: number, depth: number, nodes: number, ties: number}}
 */
export function chooseExpertAction(s, cfg, random, maxNodes = 0) {
  const me = actor(s);
  const W = { ...EXPERT_WEIGHTS, ...(cfg.weights || {}) };
  const evalFn = evaluateExpert;
  // Small decisions inside a turn (which the look-ahead settles greedily) are
  // searched like any other move here, with a part of the thinking time.
  const share = greedyPending(s) ? CHOICE_SHARE : 1;

  // The End of War costs no action. When the opponent has only a few
  // creatures left and could run away for ever, the leading side declares it.
  if (!s.pending.length && !s.endOfWar && !s.turn.declared && s.turnNumber >= END_OF_WAR_FROM_TURN
    && totalVP(s, me) > totalVP(s, 3 - me) && diceOf(s, 3 - me).length <= END_OF_WAR_MAX_DICE) {
    return { action: { type: "declareEndOfWar" }, score: 0, depth: 0, nodes: 0, ties: 1 };
  }

  const ctx = {
    nodes: 0,
    deadline: maxNodes ? Infinity : Date.now() + cfg.timeMs * share,
    maxNodes: maxNodes ? Math.ceil(maxNodes * share) : Infinity,
    W, evalFn,
    lateFrom: cfg.lateFrom ?? 4,
    veryLateFrom: cfg.veryLateFrom ?? 12,
    killers: new Int32Array(2 * (MAX_PLY + 2)).fill(-1),
    history: [new Float64Array(SIGNATURES), new Float64Array(SIGNATURES)],
  };
  // The table is kept between the moves of a game, but values from another
  // game or evaluation must not leak in: it is cleared for every search.
  ttMeta.fill(0);

  const actions = orderedActions(s, me, ctx, 0, -1);
  if (actions.length === 1) return { action: actions[0], score: 0, depth: 0, nodes: 0, ties: 1 };

  // Every root action is played once; a small random number breaks ties, so
  // equal moves are not always tried (and chosen) in the same order.
  let root = actions.map((a) => {
    const child = play(s, a, ctx);
    const v = child.phase === "over" ? overValue(child, me, 1) : evalFn(child, me, W);
    return { a, child, v, jitter: random() };
  });
  root.sort((x, y) => y.v - x.v || x.jitter - y.jitter);
  let best = root[0];
  let reached = 0;
  const started = Date.now();

  for (let depth = 1; depth <= cfg.maxDepth; depth++) {
    let alpha = -Infinity;
    let iterationBest = null;
    try {
      for (let i = 0; i < root.length; i++) {
        const item = root[i];
        const turnOver = item.child.phase === "over" || item.child.current !== s.current;
        const next = turnOver ? depth - 1 : depth;
        let v;
        if (i === 0) v = childValue(item.child, me, negamax, next, -Infinity, Infinity, 1, ctx);
        else {
          v = childValue(item.child, me, negamax, next, alpha, alpha + 1e-3, 1, ctx);
          if (v > alpha) v = childValue(item.child, me, negamax, next, alpha, Infinity, 1, ctx);
        }
        item.v = v;
        if (v > alpha) { alpha = v; iterationBest = item; }
      }
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      // An unfinished iteration still counts if it found a move that is
      // better than the first one (the best of the previous iteration).
      if (iterationBest) best = iterationBest;
      break;
    }
    best = iterationBest;
    reached = depth;
    // Best move first for the next iteration; the others keep their order.
    root = [best, ...root.filter((x) => x !== best)];
    if (Math.abs(best.v) >= WIN / 2) break; // forced result found
    // The next iteration takes several times as long: stop if it cannot finish.
    if (!maxNodes && Date.now() - started > cfg.timeMs * share * 0.6) break;
  }
  return { action: best.a, score: best.v, depth: reached, nodes: ctx.nodes, ties: 1 };
}
