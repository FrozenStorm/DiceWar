import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, applyAction, legalActions, isLegal, actor } from "../engine/core.js";
import { chooseAction, chooseSetup } from "../ai/ai.js";
import { position, at } from "./helpers.js";

function rng(seed) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

test("AI setup is a legal lineup", () => {
  const s = createGame({ set1: "RoX", set2: "RoX" });
  for (let i = 0; i < 20; i++) {
    const a = chooseSetup(s, { random: rng(i + 1), level: i % 2 ? "easy" : "medium" });
    assert.doesNotThrow(() => applyAction(s, a));
  }
});

test("AI takes a free winning capture", () => {
  // Player 1 has 6 VP; defeating the 4 gives 4 VP and wins.
  const s = position(["......a", ".......", ".......", "...6d..", ".......", ".......", "......."], { players: { 1: { vp: 6 } } });
  const { action } = chooseAction(s, { level: "easy", overrides: { noise: 0 } });
  assert.deepEqual(action, { type: "attack", from: at("d4"), to: at("e4") });
});

test("AI only plays legal actions, also for pending decisions", () => {
  let s = position(["......a", ".......", ".......", "...4b..", ".......", ".......", "......."]);
  s = applyAction(s, { type: "attack", from: at("d4"), to: at("e4") }); // Balance for player 2
  assert.equal(actor(s), 2);
  const { action } = chooseAction(s, { level: "medium" });
  assert.ok(isLegal(s, action));
});

test("easy AI beats random play", () => {
  const rand = rng(42);
  let wins = 0;
  for (let g = 0; g < 4; g++) {
    let s = createGame({ set1: "RoX", set2: "RoX", startingPlayer: (g % 2) + 1, maxTurns: 200 });
    s = applyAction(s, chooseSetup(s, { random: rand }));
    s = applyAction(s, chooseSetup(s, { random: rand }));
    while (s.phase !== "over") {
      let a;
      if (actor(s) === 1) a = chooseAction(s, { level: "easy", random: rand }).action;
      else {
        const acts = legalActions(s).filter((x) => x.type !== "declareEndOfWar");
        a = acts[Math.floor(rand() * acts.length)];
      }
      s = applyAction(s, a);
    }
    if (s.result.winner === 1) wins++;
  }
  assert.ok(wins >= 3, `easy AI won only ${wins} of 4 games`);
});
