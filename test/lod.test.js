import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAction, legalActions, isLegal, virtualVP, actor } from "../engine/core.js";
import { position, at } from "./helpers.js";

const LOD = { set1: "LoD", set2: "LoD" };
const byAbility = (s, ability) => legalActions(s).filter((a) => a.ability === ability);
const sorted = (xs) => [...xs].sort((a, b) => a - b);
// Rows from top (row 7) to bottom (row 1); columns a..g.

test("LoD.soul.floating: over a chain of own Souls, direction may change", () => {
  // Souls on b2, c2, c3 (chain turns upwards). Soul on a2 floats.
  const s = position(["......f", ".......", ".......", ".......", "..1....", "111....", "......."], LOD);
  const targets = byAbility(s, "LoD.soul.floating").filter((a) => a.from === at("a2")).map((a) => a.to);
  // Next to b2: b1, b3; next to c2: d2, c1; next to c3: c4, d3, b3. Not a1/a3 (standard moves).
  assert.deepEqual(sorted(targets), sorted([at("b1"), at("b3"), at("d2"), at("c1"), at("c4"), at("d3")]));
});

test("LoD.soul.protective_barrier: 3 to 6 connected Souls are immune to attacks", () => {
  let s = position(["......f", ".......", ".......", "...a...", "...3...", "...a...", "...a..."], { set1: "RoX", set2: "LoD" });
  // d4 is a Soul of player 2 in a group of 3 (d4 is not connected to d2/d1: d3 is the attacker).
  assert.ok(isLegal(s, { type: "attack", from: at("d3"), to: at("d4") }));
  s = position(["......f", ".......", "...a...", "...a...", "...3...", ".......", "......."], { set1: "RoX", set2: "LoD" });
  assert.ok(isLegal(s, { type: "attack", from: at("d3"), to: at("d4") }), "2 Souls are no barrier");
  s = position(["......f", "...a...", "...a...", "...a...", "...3...", ".......", "......."], { set1: "RoX", set2: "LoD" });
  assert.ok(!isLegal(s, { type: "attack", from: at("d3"), to: at("d4") }), "3 Souls form a barrier");
});

test("LoD.soul.protective_barrier: more than 6 Souls, the owner returns the rest", () => {
  // 7 Souls in a row; the 7th arrives by a standard move.
  let s = position(["......f", ".......", ".......", ".......", ".......", "111111.", "......1"], LOD);
  s = applyAction(s, { type: "move", from: at("g1"), to: at("g2") });
  assert.equal(actor(s), 1);
  const opts = legalActions(s);
  // Only the ends can go, the remaining 6 stay connected.
  assert.deepEqual(sorted(opts.map((o) => o.remove)), sorted([at("a2"), at("g2")]));
  s = applyAction(s, opts[0]);
  assert.equal(s.current, 2);
  assert.equal(s.board.filter((d) => d && d.owner === 1).length, 6);
});

test("LoD.ghost.ghosttrail + lifepulling: 2 fields straight through a creature", () => {
  const s = position(["......f", ".......", ".......", "...d...", "...2...", ".......", "......."], LOD);
  const a = byAbility(s, "LoD.ghost.ghosttrail").find((x) => x.from === at("d3") && x.to === at("d5"));
  assert.ok(a);
  const t = applyAction(s, a);
  assert.equal(t.board[at("d5")].level, 2);
  assert.equal(t.board[at("d4")].level, 3, "the creature moved through loses 1 level");
  assert.equal(t.players[1].tp, 1);
});

test("LoD.ghost.lifepulling: opposing level 1 goes to the Exile, own to the Reserve", () => {
  let s = position(["......f", ".......", ".......", "...a...", "...2...", ".......", "......."], LOD);
  let t = applyAction(s, { type: "move", ability: "LoD.ghost.ghosttrail", from: at("d3"), over: at("d4"), to: at("d5") });
  assert.equal(t.board[at("d4")], null);
  assert.equal(t.players[2].exile, 1);
  s = position(["......f", ".......", ".......", "...1...", "...2...", ".......", "......."], LOD);
  const reserve = s.players[1].reserve;
  t = applyAction(s, { type: "move", ability: "LoD.ghost.ghosttrail", from: at("d3"), over: at("d4"), to: at("d5") });
  assert.equal(t.players[1].reserve, reserve + 1);
});

test("LoD.ghost.ghosttrail: attack on the 2nd field", () => {
  const s = position(["......f", ".......", "...a...", "...c...", "...2...", ".......", "......."], LOD);
  const a = byAbility(s, "LoD.ghost.ghosttrail").find((x) => x.type === "attack" && x.to === at("d5"));
  assert.ok(a);
  const t = applyAction(s, a);
  assert.equal(t.board[at("d5")].owner, 1);
  assert.equal(t.board[at("d4")].level, 2);
  assert.equal(t.players[1].vp, 1 + 1); // level 1 + Field Bonus +1
});

test("LoD.ghost.cursed: the attacker of a Ghost is downgraded by 2", () => {
  const s = position(["......f", ".......", ".......", "...b...", "...5...", ".......", "......."], { set1: "RoX", set2: "LoD" });
  const t = applyAction(s, { type: "attack", from: at("d3"), to: at("d4") });
  assert.equal(t.board[at("d4")].level, 3);
});

test("LoD.warrior.brotherhood: 3 Souls in a line", () => {
  const s = position(["......f", ".......", ".......", "...3...", ".......", ".......", "......."], LOD);
  const acts = byAbility(s, "LoD.warrior.brotherhood");
  assert.equal(acts.length, 2);
  const t = applyAction(s, acts.find((a) => a.line === "horizontal"));
  for (const f of ["c4", "d4", "e4"]) assert.equal(t.board[at(f)].level, 1);
});

test("LoD.mage.blood_trade: exile up to X dice, X+1 TP, upgrade others, all TP lapse", () => {
  // Two Blood Mages: up to 2 dice. Player already has 3 TP.
  let s = position(["......f", ".......", ".......", ".......", ".......", ".......", "44.2..."], { ...LOD, players: { 1: { tp: 3 } } });
  const acts = byAbility(s, "LoD.mage.blood_trade").filter((a) => a.at === at("a1"));
  assert.deepEqual(acts.map((a) => a.exile), [1, 2]);
  s = applyAction(s, acts[0]); // exile 1 -> +2 TP = 5
  assert.equal(s.players[1].tp, 5);
  assert.equal(actor(s), 1);
  // The caster (a1) cannot be upgraded.
  assert.ok(!legalActions(s).some((o) => o.upgrade === at("a1")));
  s = applyAction(s, { type: "choice", kind: "LoD.mage.blood_trade_upgrade", upgrade: at("d1") });
  s = applyAction(s, { type: "choice", kind: "LoD.mage.blood_trade_upgrade", upgrade: at("d1") });
  assert.equal(s.board[at("d1")].level, 4);
  s = applyAction(s, { type: "choice", kind: "LoD.mage.blood_trade_upgrade", finish: true });
  assert.equal(s.players[1].tp, 0);
  assert.equal(s.current, 2);
});

test("LoD.basilisk: moves and attacks diagonally, Inner Fire after a defeat", () => {
  let s = position(["......f", ".......", ".....a.", "....b..", "...5...", ".......", "......."], LOD);
  const moves = legalActions(s).filter((a) => a.from === at("d3") && !a.ability && a.type !== "upgrade");
  assert.ok(moves.every((a) => Math.abs(a.to - at("d3")) === 6 || Math.abs(a.to - at("d3")) === 8), "diagonal only");
  s = applyAction(s, { type: "attack", from: at("d3"), to: at("e4") });
  // Ghost defeated: Cursed downgrades the Basilisk to 3, so no Inner Fire.
  assert.equal(s.board[at("e4")].level, 3);
  assert.equal(s.current, 2);
  // Against a Soul: Inner Fire chains.
  s = position(["......f", ".......", ".....a.", "....a..", "...5...", ".......", "......."], LOD);
  s = applyAction(s, { type: "attack", from: at("d3"), to: at("e4") });
  assert.equal(actor(s), 1);
  const again = legalActions(s).find((o) => o.sub && o.sub.type === "attack" && o.sub.to === at("f5"));
  assert.ok(again);
  s = applyAction(s, again);
  assert.equal(actor(s), 1, "can chain");
});

test("LoD.dragon: Dragon Blood in a line, Luminous Flame virtual VP", () => {
  const s = position(["......f", ".......", ".......", "...6...", ".......", ".......", "6......"], LOD);
  assert.equal(virtualVP(s, 1), 1); // 2 Dragons vs 1
  const t = applyAction(s, byAbility(s, "LoD.dragon.dragon_blood").find((a) => a.at === at("d4") && a.line === "vertical"));
  assert.equal(t.board[at("d5")].level, 3);
  assert.equal(t.board[at("d3")].level, 3);
  assert.equal(t.board[at("d4")], null);
  assert.equal(virtualVP(t, 1), 0);
});

test("LoD Ruins: level 1 goes to the Reserve, holding all ruins wins", () => {
  let s = position(["......f", ".....3.", ".......", "...3...", ".1.....", ".......", "......."], { ...LOD, locations: ["ruins"] });
  s = applyAction(s, { type: "move", from: at("b3"), to: at("b2") });
  assert.equal(s.board[at("b2")], null, "level 1 on a ruin goes to the Reserve");
  s = position(["......f", ".....3.", ".......", "...3...", ".......", "..3....", "......."], { ...LOD, locations: ["ruins"] });
  s = applyAction(s, { type: "move", from: at("c2"), to: at("b2") });
  assert.equal(s.phase, "over");
  assert.equal(s.result.winner, 1);
});
