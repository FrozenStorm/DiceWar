// AI opponent for DiceWar. Works on top of the rules engine, so it supports
// every dice set the engine implements.
//
// Search: minimax with alpha-beta pruning over whole turns (decisions inside a
// turn such as Balance or Force of Attraction do not cost depth), iterative
// deepening with a time limit (or a fixed node budget for reproducible games),
// and a heuristic evaluation in "VP x 100" units. Among equally rated moves the
// AI picks one at random (opts.random, seedable).

import { legalActions, applyAction, actor } from "../engine/core.js";
import { evaluate, DEFAULT_WEIGHTS, WIN } from "./eval.js";
import { chooseExpertAction } from "./expert.js";
import { Timeout, isRedundant, greedyPending, greedyChoice, resolveGreedy } from "./common.js";

export { evaluate, DEFAULT_WEIGHTS } from "./eval.js";
export { chooseSetup } from "./setup.js";

export const LEVELS = {
  easy: { maxDepth: 2, timeMs: 800, noise: 30, width: 16 },
  medium: { maxDepth: 4, timeMs: 2500, noise: 0, width: 20 },
  hard: { maxDepth: 8, timeMs: 5000, noise: 0, width: 24 },
  // Own search (expert.js): looks deeper and plays captures out.
  expert: { engine: "expert", maxDepth: 40, timeMs: 10000 },
};

/** Two root moves count as equally good when their values differ by less than this. */
const TIE_EPS = 1e-6;

/** Node budgets per level for reproducible games (AI Lab). Calibrated so that
 *  they roughly match the time limits above on an average computer. */
export const NODE_BUDGETS = { easy: 50_000, medium: 150_000, hard: 300_000, expert: 600_000 };

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
  if (cfg.engine === "expert") return chooseExpertAction(s, cfg, random, opts.maxNodes || cfg.maxNodes || 0);
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

