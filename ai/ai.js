// AI opponent for DiceWar. Works on top of the rules engine, so it supports
// every dice set the engine implements. All levels use the same search
// (search.js); they differ only in their settings.

import { chooseSearchAction } from "./search.js";

export { evaluate, WEIGHTS } from "./eval.js";
export { chooseSetup } from "./setup.js";

/**
 * Settings of the levels:
 * - timeMs: thinking time per move (one core; see ui/rules-mode.js for several)
 * - maxDepth: at most this many turns ahead
 * - quiescence: turns of captures played out beyond the horizon
 * - noise: random amount added to the rating of every move (makes mistakes)
 * Depth and time as the levels of the earlier classic search. Measured against
 * those (42 games each, all pairings): Easy 71 %, Medium 63 %, Hard 71 %.
 */
export const LEVELS = {
  easy: { timeMs: 800, maxDepth: 2, quiescence: 2, noise: 30 },
  medium: { timeMs: 2500, maxDepth: 4, quiescence: 4, noise: 0 },
  hard: { timeMs: 5000, maxDepth: 8, quiescence: 4, noise: 0 },
  expert: { timeMs: 10000, maxDepth: 40, quiescence: 4, noise: 0 },
};

/** Node budgets per level for reproducible games (AI Lab), roughly matching
 *  the time limits above on an average computer. */
export const NODE_BUDGETS = { easy: 50_000, medium: 150_000, hard: 300_000, expert: 600_000 };

/**
 * Choose an action for the player who has to act in `s`.
 * @param {object} s engine state (war phase)
 * @param {object} [opts] { level: "easy"|"medium"|"hard"|"expert", random: () => number,
 *   maxNodes: node budget instead of the level's time limit (reproducible),
 *   overrides: level settings to replace }
 * @returns {{action: object, score: number, depth: number, nodes: number}}
 */
export function chooseAction(s, opts = {}) {
  const cfg = { ...LEVELS[opts.level || "medium"], ...(opts.overrides || {}) };
  return chooseSearchAction(s, cfg, opts.random || Math.random, opts.maxNodes || cfg.maxNodes || 0);
}
