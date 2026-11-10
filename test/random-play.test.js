import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, applyAction, legalActions, setupLevelCombinations, actor } from "../engine/core.js";

// Small deterministic PRNG so failures are reproducible.
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function randomSetup(rand) {
  const combos = setupLevelCombinations();
  const levels = combos[Math.floor(rand() * combos.length)];
  const cols = [0, 1, 2, 3, 4, 5, 6].sort(() => rand() - 0.5);
  return { type: "setup", placements: levels.map((level, i) => ({ col: cols[i], level })) };
}

test("random RoX games always reach a valid end without errors", () => {
  for (let g = 0; g < 40; g++) {
    const rand = rng(g + 1);
    let s = createGame({ set1: "RoX", set2: "RoX", startingPlayer: (g % 2) + 1, locations: g % 2 ? ["craters"] : [], maxTurns: 300 });
    s = applyAction(s, randomSetup(rand));
    s = applyAction(s, randomSetup(rand));
    let steps = 0;
    while (s.phase !== "over") {
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
