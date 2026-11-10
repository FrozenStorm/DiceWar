import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, applyAction, legalActions, isLegal, virtualVP, actor, validateSetup } from "../engine/core.js";
import { position, at } from "./helpers.js";

const ROM = { set1: "RoM", set2: "RoM" };
const byAbility = (s, ability) => legalActions(s).filter((a) => a.ability === ability);
const sorted = (xs) => [...xs].sort((a, b) => a - b);
// Rows from top (row 7) to bottom (row 1); columns a..g.

test("RoM.fruit.fake_gold: no movement, no upgrade, no VP, back to the owner's Reserve", () => {
  let s = position(["......f", ".......", ".......", "...1...", ".......", ".......", "......."], ROM);
  assert.ok(!legalActions(s).some((a) => a.from === at("d4") && a.type === "move"));
  assert.ok(!isLegal(s, { type: "upgrade", at: at("d4") }));
  s = position(["......f", ".......", ".......", "...a...", "...3...", ".......", "......."], ROM);
  const reserve = s.players[2].reserve;
  s = applyAction(s, { type: "attack", from: at("d3"), to: at("d4") });
  assert.equal(s.players[1].vp, 0);
  assert.equal(s.players[2].reserve, reserve + 1);
  assert.equal(s.players[2].exile, 0);
});

test("RoM.fruit.breeding: 2 Golden Fruits next to it, the original goes to the Reserve", () => {
  const s = position(["......f", ".......", ".......", "...1...", ".......", ".......", "......."], ROM);
  const t = applyAction(s, { type: "spell", ability: "RoM.fruit.breeding", at: at("d4"), a: at("c4"), b: at("d5") });
  assert.equal(t.board[at("d4")], null);
  assert.equal(t.board[at("c4")].level, 1);
  assert.equal(t.board[at("d5")].level, 1);
});

test("RoM.sprout.velocity: 2 fields straight over a free field only", () => {
  const s = position(["......f", ".......", ".......", "...a...", "...2...", ".......", "......."], ROM);
  const targets = byAbility(s, "RoM.sprout.velocity").map((a) => a.to);
  assert.ok(!targets.includes(at("d5")), "not through a creature");
  assert.ok(targets.includes(at("b3")) && targets.includes(at("d1")));
});

test("RoM.sprout.golden_seed: only after a 1-field Movement", () => {
  let s = position(["......f", ".......", ".......", ".......", "...2...", ".......", "......."], ROM);
  s = applyAction(s, { type: "move", from: at("d3"), to: at("d4") });
  assert.equal(actor(s), 1);
  s = applyAction(s, { type: "choice", kind: "RoM.sprout.golden_seed", place: at("d3") });
  assert.equal(s.board[at("d3")].level, 1);
  // Not after an attack.
  s = position(["......f", ".......", ".......", "...a...", "...2...", ".......", "......."], ROM);
  s = applyAction(s, { type: "attack", from: at("d3"), to: at("d4") });
  assert.equal(s.current, 2);
});

test("RoM.sprout.tenacity: the attacker exiles 2 Reserve Dice", () => {
  let s = position(["......f", ".......", ".......", "...b...", "...4...", ".......", "......."], { set1: "RoX", set2: "RoM" });
  const reserve = s.players[1].reserve;
  s = applyAction(s, { type: "attack", from: at("d3"), to: at("d4") });
  assert.equal(s.players[1].reserve, reserve - 2);
  assert.equal(s.players[1].exile, 2);
});

test("RoM.torch.fire_demon: leap over a chain (around corners), the chain goes to the Reserve", () => {
  // Torch on a3, chain b3 (1), c3 (2), c4 (6). Lands next to the Mali.
  const s = position(["......f", ".......", ".......", "..6....", "312....", ".......", "......."], ROM);
  const acts = byAbility(s, "RoM.torch.fire_demon");
  const a = acts.find((x) => x.chain.length === 3 && x.to === at("d4"));
  assert.ok(a, "around the corner");
  const reserve = s.players[1].reserve;
  const t = applyAction(s, a);
  assert.equal(t.board[at("d4")].level, 3);
  for (const f of ["b3", "c3", "c4"]) assert.equal(t.board[at(f)], null);
  assert.equal(t.players[1].reserve, reserve + 3);
});

test("RoM.protectress: Fellowship TP, Breath of Life, Symbiosis", () => {
  let s = position(["......f", ".......", ".......", "...41..", ".......", ".......", "4......"], { ...ROM, current: 2 });
  s = applyAction(s, { type: "move", from: at("g7"), to: at("f7") });
  assert.equal(s.players[1].tp, 2); // two Protectresses
  const breath = byAbility(s, "RoM.protectress.breath_of_life").filter((a) => a.at === at("d4"));
  assert.deepEqual(breath.map((a) => a.tp), [1, 2]);
  let t = applyAction(s, breath.find((a) => a.tp === 2));
  assert.equal(t.board[at("e4")].level, 3);
  assert.equal(t.players[1].tp, 0);
  t = applyAction(s, { type: "upgrade", ability: "RoM.protectress.symbiosis", from: at("d4"), to: at("e4") });
  assert.equal(t.board[at("e4")].level, 5);
  assert.equal(t.board[at("d4")], null);
});

test("RoM.protectress.fellowship: all TP lost without a Protectress", () => {
  let s = position(["......f", ".......", ".......", ".......", ".......", ".......", "4e....."], { ...ROM, current: 2, players: { 1: { tp: 4 } } });
  s = applyAction(s, { type: "attack", from: at("b1"), to: at("a1") });
  assert.equal(s.players[1].tp, 0);
});

test("RoM.runner: Secret Pathway over the side line, then one more action", () => {
  let s = position(["......f", ".......", ".......", "5......", ".......", ".......", "......."], ROM);
  const a = byAbility(s, "RoM.runner.secret_pathway").find((x) => x.to === at("g4"));
  assert.ok(a);
  s = applyAction(s, a);
  assert.equal(s.board[at("g4")].level, 5);
  assert.equal(actor(s), 1);
  s = applyAction(s, legalActions(s).find((o) => o.sub && o.sub.to === at("g5")));
  assert.equal(s.board[at("g5")].level, 5);
  assert.equal(s.current, 2);
});

test("RoM.runner.out_of_the_dark: leap over an own Shadow Runner, also over the side line", () => {
  const s = position(["......f", ".......", ".......", "55.....", ".......", ".......", "......."], ROM);
  const targets = byAbility(s, "RoM.runner.out_of_the_dark").filter((a) => a.from === at("b4")).map((a) => a.to);
  assert.ok(targets.includes(at("g4")), "over a4 and the side line");
  const t2 = byAbility(s, "RoM.runner.out_of_the_dark").filter((a) => a.from === at("a4")).map((a) => a.to);
  assert.ok(t2.includes(at("c4")));
});

test("RoM.mali: Children of the Woods places 3 Sprouts in the own zone, Deep Roots", () => {
  let s = position(["......f", ".......", ".......", "...6...", ".......", ".......", "......."], ROM);
  s = applyAction(s, { type: "spell", ability: "RoM.mali.children_of_the_woods", at: at("d4") });
  for (const f of ["a1", "b1", "c1"]) {
    assert.equal(actor(s), 1);
    s = applyAction(s, { type: "choice", kind: "RoM.mali.children_of_the_woods", place: at(f) });
  }
  assert.equal(s.board[at("d4")], null);
  assert.equal(s.board[at("c1")].level, 2);
  const v = position(["......f", "6......", ".......", "...6...", ".......", ".......", "......."], ROM);
  assert.equal(virtualVP(v, 1), 1);
});

test("Camp: placed in the setup; own creature back to the Reserve, opposing camp costs the owner dice", () => {
  let s = createGame({ set1: "RoM", set2: "RoX", startingPlayer: 1, locations: ["camp"] });
  assert.match(validateSetup(s, 1, [{ col: 0, level: 6 }, { col: 1, level: 4 }]), /camp/);
  s = applyAction(s, { type: "setup", placements: [{ col: 0, level: 6 }, { col: 1, level: 4 }], camp: 3 });
  s = applyAction(s, { type: "setup", placements: [{ col: 0, level: 6 }, { col: 1, level: 4 }], camp: 6 });
  assert.equal(s.camps[1], at("d1"));
  assert.equal(s.camps[2], at("g7"));
  // Player 1's Protectress (4) on c1 moves into the own camp: back to the Reserve.
  s.board[at("c1")] = { id: 99, owner: 1, level: 4, dir: 0 };
  s.players[1].reserve--;
  const reserve = s.players[1].reserve;
  const t = applyAction(s, { type: "move", from: at("c1"), to: at("d1") });
  assert.equal(t.board[at("d1")], null);
  assert.equal(t.players[1].reserve, reserve + 1);
  // A creature moved into the opposing camp goes to its own Exile, the camp owner exiles its level.
  const u = structuredClone(s);
  u.board[at("f7")] = { id: 98, owner: 1, level: 2, dir: 0 };
  u.players[1].reserve--;
  const r2 = u.players[2].reserve;
  const w = applyAction(u, { type: "move", from: at("f7"), to: at("g7") });
  assert.equal(w.board[at("g7")], null);
  assert.equal(w.players[1].exile, 1);
  assert.equal(w.players[2].reserve, r2 - 2);
});
