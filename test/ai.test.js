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

// --- Expert level ---------------------------------------------------------------

const PLAIN = { set1: "plain", set2: "plain" };
const fast = { level: "expert", maxNodes: 4000 };

test("expert AI takes a free winning capture", () => {
  const s = position(["......a", ".......", ".......", "...6d..", ".......", ".......", "......."], { players: { 1: { vp: 6 } } });
  const { action } = chooseAction(s, fast);
  assert.deepEqual(action, { type: "attack", from: at("d4"), to: at("e4") });
});

test("expert AI only plays legal actions, also for pending decisions", () => {
  let s = position(["......a", ".......", ".......", "...4b..", ".......", ".......", "......."]);
  s = applyAction(s, { type: "attack", from: at("d4"), to: at("e4") }); // Balance for player 2
  assert.equal(actor(s), 2);
  const { action } = chooseAction(s, fast);
  assert.ok(isLegal(s, action));
});

test("expert AI wins by occupying the last Ruin", () => {
  // Player 1 holds the Ruins f6 and d4; b3 steps onto the Ruin b2.
  const s = position(["......f", ".....3.", ".......", "...3...", ".2.....", ".......", "......."], { ...PLAIN, locations: ["ruins"] });
  const { action } = chooseAction(s, fast);
  const t = applyAction(s, action);
  assert.equal(t.phase, "over");
  assert.deepEqual(t.result, { winner: 1, reason: "ruins" });
});

test("expert AI stops the opponent from taking the last Ruin", () => {
  // Player 2 holds f6 and d4 and stands next to b2 with a 2; player 1's 3 on c2 can step in or capture.
  const s = position([".......", ".....c.", ".......", "...c...", ".b.....", "..3....", "......."], { ...PLAIN, locations: ["ruins"] });
  const t = applyAction(s, chooseAction(s, fast).action);
  const lost = legalActions(t).some((a) => {
    if (a.type === "declareEndOfWar") return false;
    const u = applyAction(t, a);
    return u.phase === "over" && u.result.winner === 2;
  });
  assert.equal(lost, false, "player 2 must not be able to win with the next action");
});

test("expert AI with a node budget and a seed is repeatable", () => {
  const play = () => {
    const rand = rng(11);
    let s = createGame({ set1: "LoD", set2: "BoD", maxTurns: 12 });
    s = applyAction(s, chooseSetup(s, { random: rand, level: "expert" }));
    s = applyAction(s, chooseSetup(s, { random: rand, level: "expert" }));
    const actions = [];
    while (s.phase !== "over") {
      const { action } = chooseAction(s, { level: "expert", random: rand, maxNodes: 1500 });
      assert.ok(isLegal(s, action));
      actions.push(action);
      s = applyAction(s, action);
    }
    return JSON.stringify(actions);
  };
  assert.equal(play(), play());
});

test("AI setup is legal for every set, level and landscape", () => {
  for (const set of ["RoX", "BoD", "LoD", "RoM", "KoS", "DoA"]) {
    for (const level of ["easy", "medium", "hard", "expert"]) {
      for (const locations of [[], ["camp"], ["ruins", "river"]]) {
        const s = createGame({ set1: set, set2: set, locations });
        const a = chooseSetup(s, { random: rng(5), level });
        assert.doesNotThrow(() => applyAction(s, a), `${set} ${level} ${locations}`);
      }
    }
  }
});
