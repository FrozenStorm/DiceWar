import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame, applyAction, legalActions, validateSetup, isLegal, setupLevelCombinations,
} from "../engine/core.js";
import { sq } from "../engine/board.js";
import { position, at } from "./helpers.js";

const plain = { set1: "plain", set2: "plain" };
const has = (s, a) => isLegal(s, a);

test("setup: lineup must sum to exactly 10 in the Supply Zone", () => {
  const s = createGame({ ...plain, startingPlayer: 2 });
  assert.equal(s.current, 2);
  assert.match(validateSetup(s, 2, [{ col: 0, level: 6 }]), /exactly 10/);
  assert.match(validateSetup(s, 2, [{ col: 0, level: 6 }, { col: 0, level: 4 }]), /one die per field/);
  assert.equal(validateSetup(s, 1, [{ col: 0, level: 6 }, { col: 1, level: 4 }]), "It is not this player's setup.");

  let t = applyAction(s, { type: "setup", placements: [{ col: 2, level: 4 }, { col: 3, level: 6 }] });
  assert.equal(t.board[sq(0, 2)].level, 4); // player 2 sets up in the top row
  assert.equal(t.players[2].reserve, 13);
  assert.equal(t.phase, "setup");
  assert.equal(t.current, 1);
  t = applyAction(t, { type: "setup", placements: [{ col: 1, level: 2 }, { col: 2, level: 3 }, { col: 3, level: 5 }] });
  assert.equal(t.board[sq(6, 3)].level, 5);
  assert.equal(t.phase, "war");
  assert.equal(t.current, 2); // starting player opens the war phase
});

test("setup: all level combinations sum to 10 with at most 7 dice", () => {
  const combos = setupLevelCombinations();
  assert.ok(combos.length > 20);
  for (const c of combos) {
    assert.equal(c.reduce((a, b) => a + b, 0), 10);
    assert.ok(c.length <= 7);
  }
});

test("movement: one field horizontally or vertically onto a free field", () => {
  const s = position(["c......", ".......", ".......", "...2...", "...a...", ".......", "......."], plain);
  const moves = legalActions(s).filter((a) => a.type === "move").map((a) => a.to).sort((a, b) => a - b);
  assert.deepEqual(moves, [at("d5"), at("c4"), at("e4")].sort((a, b) => a - b));
});

test("power hierarchy: higher beats lower, 3 beats 6, equal levels do not", () => {
  const cases = [
    ["4", "c", true], ["4", "d", false], ["4", "e", false],
    ["3", "f", true], ["6", "c", true], ["2", "a", true], ["1", "a", false],
  ];
  for (const [mine, theirs, ok] of cases) {
    const s = position([".......", ".......", ".......", `...${mine}${theirs}..`, ".......", "......f", "......."], plain);
    assert.equal(has(s, { type: "attack", from: at("d4"), to: at("e4") }), ok, `${mine} vs ${theirs}`);
  }
});

test("attack: defeated creature goes to Exile, VP = level + Field Bonus", () => {
  // Player 1's 4 on b6 attacks player 2's 3 in player 2's Supply Zone (b7): 3 + 3 = 6 VP.
  const s = position([".c....f", ".4.....", ".......", ".......", ".......", ".......", "......1"], plain);
  const t = applyAction(s, { type: "attack", from: at("b6"), to: at("b7") });
  assert.equal(t.players[1].vp, 6);
  assert.equal(t.players[2].exile, 1);
  assert.equal(t.board[at("b7")].owner, 1);
  assert.equal(t.current, 2);
});

test("attack in your own half gives no Field Bonus", () => {
  const s = position(["......f", ".......", ".......", ".......", ".......", ".4c....", "......1"], plain);
  const t = applyAction(s, { type: "attack", from: at("b2"), to: at("c2") });
  assert.equal(t.players[1].vp, 3);
});

test("player 2 gets the Field Bonus in player 1's half", () => {
  const s = position(["......f", ".......", ".......", ".......", ".......", ".......", "...3d.."], { ...plain, current: 2 });
  const t = applyAction(s, { type: "attack", from: at("e1"), to: at("d1") });
  assert.equal(t.players[2].vp, 6);
});

test("upgrade: +1 level, a 6 cannot be upgraded", () => {
  const s = position(["......f", ".......", ".......", "...6...", "...5...", ".......", "......."], plain);
  assert.ok(!has(s, { type: "upgrade", at: at("d4") }));
  const t = applyAction(s, { type: "upgrade", at: at("d3") });
  assert.equal(t.board[at("d3")].level, 6);
});

test("reaching 10 VP wins the game", () => {
  const s = position([".......", ".......", ".......", "...6e..", ".......", ".......", "......a"], { ...plain, players: { 1: { vp: 5 } } });
  const t = applyAction(s, { type: "attack", from: at("d4"), to: at("e4") });
  assert.equal(t.phase, "over");
  assert.deepEqual(t.result, { winner: 1, reason: "victoryPoints" });
});

test("a player without any valid action loses", () => {
  // Player 2's only creature is defeated; player 2 cannot act and loses.
  const s = position([".......", ".......", ".......", "...6b..", ".......", ".......", "......."], plain);
  const t = applyAction(s, { type: "attack", from: at("d4"), to: at("e4") });
  assert.deepEqual(t.result, { winner: 1, reason: "noValidAction" });
});

test("End of War: chased player fleeing 5 turns with the same die ends the game, VP decide", () => {
  let s = position(["f......", ".......", ".......", "...6...", ".......", ".......", "a......"], { ...plain, players: { 1: { vp: 3 }, 2: { vp: 1 } } });
  s = applyAction(s, { type: "declareEndOfWar" });
  assert.equal(s.endOfWar.chased, 2);
  assert.ok(!legalActions(s).some((a) => a.type === "declareEndOfWar"));
  const p1 = [at("d4"), at("d5")];
  const p2 = [at("a7"), at("b7")];
  for (let i = 0; i < 5; i++) {
    assert.equal(s.phase, "war");
    s = applyAction(s, { type: "move", from: p1[i % 2], to: p1[(i + 1) % 2] });
    s = applyAction(s, { type: "move", from: p2[i % 2], to: p2[(i + 1) % 2] });
  }
  assert.deepEqual(s.result, { winner: 1, reason: "endOfWar" });
});

test("End of War is cancelled if the chased player does anything but moving the same die", () => {
  let s = position(["f......", ".......", ".......", "...6...", ".......", ".......", "a......"], plain);
  s = applyAction(s, { type: "declareEndOfWar" });
  s = applyAction(s, { type: "move", from: at("d4"), to: at("d5") });
  s = applyAction(s, { type: "move", from: at("a7"), to: at("b7") });
  assert.equal(s.endOfWar.turnsFled, 1);
  s = applyAction(s, { type: "move", from: at("d5"), to: at("d4") });
  s = applyAction(s, { type: "move", from: at("a1"), to: at("b1") }); // different die
  assert.equal(s.endOfWar, null);
});

test("turn limit safety net: VP decide, draw on a tie", () => {
  let s = position(["f......", ".......", ".......", "...6...", ".......", ".......", "......."], plain);
  s.maxTurns = 2;
  s = applyAction(s, { type: "move", from: at("d4"), to: at("d5") });
  s = applyAction(s, { type: "move", from: at("a7"), to: at("b7") });
  assert.deepEqual(s.result, { winner: 0, reason: "turnLimit" });
});

test("applyAction does not mutate its input", () => {
  const s = position(["f......", ".......", ".......", "...6...", ".......", ".......", "......."], plain);
  const before = JSON.stringify(s);
  applyAction(s, { type: "move", from: at("d4"), to: at("d5") });
  assert.equal(JSON.stringify(s), before);
});
