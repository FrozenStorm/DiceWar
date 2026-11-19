// Swapping the players (engine/mirror.js) must give the same game seen from
// the other side: the same legal actions and the same results, mirrored.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, applyAction, legalActions } from "../engine/core.js";
import { mirrorGame, mirrorAction, gameKey, mirrorWithHistory } from "../engine/mirror.js";
import { chooseSetup } from "../ai/ai.js";

const SETS = ["RoX", "BoD", "LoD", "RoM", "KoS", "DoA"];
const LANDSCAPES = [[], ["craters"], ["oracle"], ["ruins"], ["camp"], ["knoll"], ["river"], ["camp", "river", "ruins"]];

const canonGame = gameKey;

/** JSON with sorted keys and without the events of the last action. */
function canon(x) {
  return JSON.stringify(x, (k, v) => {
    if (k === "events") return undefined;
    if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]]));
    return v;
  });
}

function rng(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

test("mirrored games have the mirrored legal actions and results", () => {
  const rnd = rng(7);
  let steps = 0;
  for (const set1 of SETS) for (const set2 of SETS) for (const locations of LANDSCAPES) {
    let g = createGame({ set1, set2, startingPlayer: rnd() < 0.5 ? 1 : 2, locations, riverCol: Math.floor(rnd() * 7) });
    assert.equal(canon(mirrorGame(mirrorGame(g))), canon(g));
    const start = g, actions = [];
    let m = mirrorGame(g); // played along with mirrored actions
    for (let i = 0; i < 60 && g.phase !== "over"; i++) {
      let a;
      if (g.phase === "setup") {
        a = chooseSetup(g, { level: "easy" });
      } else {
        const acts = legalActions(g);
        // Same actions; where two actions lead to the same result (e.g. two ways
        // around a corner), the engine may list either one.
        const outcome = (state, x) => {
          const r = applyAction(state, x);
          return canonGame({ ...r, turn: { ...r.turn, main: r.turn.main && r.turn.main.type } });
        };
        const outcomes = (state, list) => [...new Set(list.map((x) => outcome(state, x)))].sort();
        assert.deepEqual(outcomes(m, legalActions(m)), outcomes(m, acts.map(mirrorAction)), `${set1}-${set2} ${locations} step ${i}`);
        a = acts[Math.floor(rnd() * acts.length)];
      }
      const next = applyAction(g, a);
      m = applyAction(m, mirrorAction(a));
      assert.equal(canon(m), canon(mirrorGame(next)), `${set1}-${set2} ${locations} step ${i}`);
      actions.push(a);
      g = next;
      steps++;
    }
    const res = mirrorWithHistory(g, { start, actions }, applyAction, legalActions);
    assert.ok(res.history, `history carried over ${set1}-${set2} ${locations}`);
    assert.equal(gameKey(res.game), gameKey(mirrorGame(g)));
  }
  assert.ok(steps > 5000, `only ${steps} steps`);
});
