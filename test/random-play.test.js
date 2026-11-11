import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, applyAction, legalActions, setupLevelCombinations, actor } from "../engine/core.js";
import { actionPath } from "../engine/paths.js";

/** Every legal action needs a unique click path, and no complete path may be a prefix of another. */
function assertPathsUnambiguous(actions) {
  const paths = actions.map((a) => actionPath(a).map(String));
  const keys = new Set(paths.map((p) => p.join("|")));
  assert.equal(keys.size, paths.length, "duplicate click paths");
  for (const p of paths) {
    for (let n = 1; n < p.length; n++) {
      assert.ok(!keys.has(p.slice(0, n).join("|")), `path ${p.join(">")} has a complete path as prefix`);
    }
  }
}

// Small deterministic PRNG so failures are reproducible.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function randomSetup(rand, camp = false) {
  const combos = setupLevelCombinations().filter((c) => !camp || c.length < 7);
  const levels = combos[Math.floor(rand() * combos.length)];
  const cols = [0, 1, 2, 3, 4, 5, 6].sort(() => rand() - 0.5);
  const action = { type: "setup", placements: levels.map((level, i) => ({ col: cols[i], level })) };
  if (camp) action.camp = cols[levels.length];
  return action;
}

const MATCHUPS = [
  { name: "RoX vs RoX", set1: "RoX", set2: "RoX", locations: (g) => (g % 2 ? ["craters"] : []) },
  { name: "BoD vs BoD", set1: "BoD", set2: "BoD", locations: (g) => (g % 2 ? ["oracle"] : []) },
  { name: "BoD vs RoX", set1: "BoD", set2: "RoX", locations: (g) => [["oracle"], ["craters"], []][g % 3] },
  { name: "LoD vs LoD", set1: "LoD", set2: "LoD", locations: (g) => (g % 2 ? ["ruins"] : []) },
  { name: "LoD vs RoX", set1: "LoD", set2: "RoX", locations: (g) => [["ruins"], ["craters"], ["knoll"]][g % 3] },
  { name: "BoD vs LoD", set1: "BoD", set2: "LoD", locations: (g) => [["oracle"], ["ruins"], []][g % 3] },
  { name: "RoM vs RoM", set1: "RoM", set2: "RoM", locations: (g) => (g % 2 ? ["camp"] : []) },
  { name: "RoM vs LoD", set1: "RoM", set2: "LoD", locations: (g) => [["camp"], ["ruins"], []][g % 3] },
  { name: "RoX vs RoM", set1: "RoX", set2: "RoM", locations: (g) => [["camp"], ["craters"], ["oracle"]][g % 3] },
  { name: "BoD vs RoM", set1: "BoD", set2: "RoM", locations: (g) => [["camp"], ["oracle"], []][g % 3] },
  { name: "KoS vs KoS", set1: "KoS", set2: "KoS", locations: (g) => (g % 2 ? ["knoll"] : []) },
  { name: "KoS vs RoX", set1: "KoS", set2: "RoX", locations: (g) => [["knoll"], ["craters"], ["camp"]][g % 3] },
  { name: "LoD vs KoS", set1: "LoD", set2: "KoS", locations: (g) => [["ruins"], ["knoll"], []][g % 3] },
  { name: "KoS vs BoD", set1: "KoS", set2: "BoD", locations: (g) => [["oracle"], ["knoll"], []][g % 3] },
  { name: "RoM vs KoS", set1: "RoM", set2: "KoS", locations: (g) => [["camp"], ["knoll"], []][g % 3] },
  { name: "DoA vs DoA", set1: "DoA", set2: "DoA", locations: (g) => (g % 2 ? ["river"] : []) },
  { name: "DoA vs RoX", set1: "DoA", set2: "RoX", locations: (g) => [["river"], ["craters"], []][g % 3] },
  { name: "LoD vs DoA", set1: "LoD", set2: "DoA", locations: (g) => [["river"], ["ruins"], ["knoll"]][g % 3] },
  { name: "DoA vs RoM", set1: "DoA", set2: "RoM", locations: (g) => [["river"], ["camp"], []][g % 3] },
  { name: "KoS vs DoA", set1: "KoS", set2: "DoA", locations: (g) => [["river"], ["knoll"], ["oracle"]][g % 3] },
  { name: "DoA vs BoD", set1: "DoA", set2: "BoD", locations: (g) => [["river"], ["oracle"], []][g % 3] },
];

for (const m of MATCHUPS) test(`random ${m.name} games always reach a valid end without errors`, () => {
  for (let g = 0; g < 40; g++) {
    const rand = rng(g + 1);
    let s = createGame({ set1: m.set1, set2: m.set2, startingPlayer: (g % 2) + 1, locations: m.locations(g), maxTurns: 300, riverCol: g % 7 });
    s = applyAction(s, randomSetup(rand, s.locations.includes("camp")));
    s = applyAction(s, randomSetup(rand, s.locations.includes("camp")));
    let steps = 0;
    while (s.phase !== "over") {
      assertPathsUnambiguous(legalActions(s));
      const acts = legalActions(s).filter((a) => a.type !== "declareEndOfWar");
      assert.ok(acts.length > 0, `game ${g}: no actions for player ${actor(s)} but game not over`);
      s = applyAction(s, acts[Math.floor(rand() * acts.length)]);
      for (const p of [1, 2]) {
        const pl = s.players[p];
        const onBoard = s.board.filter((d) => d && d.owner === p).length;
        assert.equal(pl.reserve + pl.exile + onBoard, 15, `game ${g}: dice of player ${p} must always add up to 15`);
        assert.ok(pl.tp >= 0 && pl.tp <= 10 && pl.vp >= 0 && pl.vp <= 10);
      }
      assert.ok(++steps < 2000);
    }
    assert.ok([0, 1, 2].includes(s.result.winner));
  }
});
