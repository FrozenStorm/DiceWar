// Helpers shared by the AI searches.

import { legalActions, applyAction, actor } from "../engine/core.js";
import { getSet } from "../engine/sets/index.js";
import { evaluate } from "./eval.js";

/** Thrown inside a search when its time or node budget is used up. */
export class Timeout extends Error {}

/** Variants with the same result as another action (e.g. KoS: turning before
 *  instead of after a Movement) are left out of the search. */
export const isRedundant = (a) => !!(a.redundant || (a.sub && a.sub.redundant));

/** Is the next step a decision the AI makes greedily (long chains of small
 *  steps such as LoD Blood Trade upgrades would blow up the search)? */
export function greedyPending(s) {
  if (!s.pending.length || s.phase === "over") return false;
  const p = s.pending[0];
  const set = getSet(s.players[p.player].set);
  return !!(set.aiGreedyChoices && set.aiGreedyChoices.includes(p.kind));
}

/** Best option of a greedy decision by static evaluation for the deciding player. */
export function greedyChoice(s, W, evalFn = evaluate) {
  const who = actor(s);
  let best = null, bestV = -Infinity;
  for (const a of legalActions(s)) {
    if (isRedundant(a)) continue;
    const v = evalFn(applyAction(s, a), who, W);
    if (v > bestV) { bestV = v; best = a; }
  }
  return best;
}

/** Resolve greedy decisions until the state needs a real choice again.
 *  `inSearch`: decisions a set marks with aiSkipInSearch get that fixed answer
 *  (keeps the look-ahead of the expert level fast). */
export function resolveGreedy(s, W, evalFn = evaluate, inSearch = false) {
  let guard = 0;
  while (greedyPending(s) && guard++ < 20) {
    const p = s.pending[0];
    const set = getSet(s.players[p.player].set);
    const fixed = inSearch && set.aiSkipInSearch ? set.aiSkipInSearch(p) : null;
    s = applyAction(s, fixed || greedyChoice(s, W, evalFn));
  }
  return s;
}
