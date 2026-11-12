import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAction, legalActions, isLegal, virtualVP, actor, createGame } from "../engine/core.js";
import { actionPath } from "../engine/paths.js";
import { position, at } from "./helpers.js";

const DOA = { set1: "DoA", set2: "DoA" };
const byAbility = (s, ability) => legalActions(s).filter((a) => a.ability === ability);
const sorted = (xs) => [...xs].sort((a, b) => a - b);
// Rows from top (row 7) to bottom (row 1); columns a..g. Player 1 at the bottom.

test("DoA.fisher.rest_breaker: attacking, a Fisher has the level of the number of own Fishers", () => {
  // One Fisher: defeats nobody.
  let s = position(["......f", ".......", ".......", "...a...", "...1...", ".......", "......."], DOA);
  assert.ok(!isLegal(s, { type: "attack", from: at("d3"), to: at("d4") }));
  // Two Fishers: defeat 1.
  s = position(["......f", ".......", ".......", "...a...", "...1...", ".......", "1......"], DOA);
  assert.ok(isLegal(s, { type: "attack", from: at("d3"), to: at("d4") }));
  // Three Fishers: defeat 1, 2 and 6, but not 3.
  s = position(["......f", ".......", ".......", "..fcb..", "..111..", ".......", "......."], DOA);
  assert.ok(isLegal(s, { type: "attack", from: at("c3"), to: at("c4") }));
  assert.ok(!isLegal(s, { type: "attack", from: at("d3"), to: at("d4") }));
  assert.ok(isLegal(s, { type: "attack", from: at("e3"), to: at("e4") }));
  // Four Fishers: defeat 3, not 6.
  s = position(["......f", ".......", ".......", "..fc...", "..11...", ".......", "11....."], DOA);
  assert.ok(!isLegal(s, { type: "attack", from: at("c3"), to: at("c4") }));
  assert.ok(isLegal(s, { type: "attack", from: at("d3"), to: at("d4") }));
});

test("DoA.fisher.rest_breaker: as a defender the Fisher stays level 1", () => {
  const s = position(["......f", ".......", ".......", "...b...", "...1...", ".......", "11....."], { ...DOA, current: 2 });
  assert.ok(isLegal(s, { type: "attack", from: at("d4"), to: at("d3") }));
});

test("DoA.fisher.godcatcher: more than 3 Fishers: one to the Reserve, +1 in the own zone", () => {
  let s = position(["......f", ".......", ".......", ".......", ".......", "....3..", "1111..."], DOA);
  s = applyAction(s, { type: "move", from: at("e2"), to: at("e3") }); // e3 is still in the own zone
  assert.equal(actor(s), 1);
  const opts = legalActions(s);
  assert.ok(opts.every((o) => o.kind === "DoA.fisher.godcatcher"));
  assert.ok(opts.some((o) => o.remove === at("a1") && o.upgrade === at("e3")));
  s = applyAction(s, opts.find((o) => o.remove === at("a1") && o.upgrade === at("e3")));
  assert.equal(s.board[at("a1")], null);
  assert.equal(s.board[at("e3")].level, 4);
  assert.equal(s.current, 2, "3 Fishers left: the turn ends");
});

test("DoA.dreambringer.water_path: straight up to 3 free fields, also diagonally, no attack", () => {
  const s = position(["......f", ".......", ".......", "...2...", "....a..", ".......", "......."], DOA);
  const targets = byAbility(s, "DoA.dreambringer.water_path").filter((a) => a.from === at("d4")).map((a) => a.to);
  assert.ok(targets.includes(at("d7")) && targets.includes(at("a7")) && targets.includes(at("g4")));
  assert.ok(!targets.includes(at("e3")) && !targets.includes(at("f2")), "blocked diagonal");
  assert.ok(!targets.includes(at("d5")), "1 field orthogonally is the standard Movement");
  assert.ok(byAbility(s, "DoA.dreambringer.water_path").every((a) => a.type === "move"));
});

test("DoA.dreambringer.depth_rapture: 2 TP when the Dream Bringer is defeated", () => {
  let s = position(["......f", ".......", ".......", "...b...", "...3...", ".......", "......."], DOA);
  s = applyAction(s, { type: "attack", from: at("d3"), to: at("d4") });
  assert.equal(s.players[2].tp, 2);
});

test("DoA.dreambringer.world_sleep: no spells for opposing creatures around a Dream Bringer", () => {
  const s = position(["......f", ".......", ".......", "...4b..", ".......", ".......", "1......"], { ...DOA, players: { 1: { tp: 2 } } });
  assert.equal(byAbility(s, "DoA.weaver.ghost_call").length, 0);
  assert.equal(byAbility(s, "DoA.weaver.thread_of_fate").length, 0);
  const t = position(["......f", ".......", ".......", "...4.b.", ".......", ".......", "1......"], { ...DOA, players: { 1: { tp: 2 } } });
  assert.ok(byAbility(t, "DoA.weaver.ghost_call").length > 0);
});

test("DoA.riverwatch.wave_ride: orthogonal path around friendly creatures", () => {
  // River Watch d3 next to its own Fisher on d4: the ring around d4.
  const s = position(["......f", ".......", ".......", "...1...", "...3...", ".......", "......."], DOA);
  const rides = byAbility(s, "DoA.riverwatch.wave_ride").filter((a) => a.from === at("d3"));
  const targets = rides.map((a) => a.to);
  assert.deepEqual(sorted(targets), sorted([at("c4"), at("e4"), at("c5"), at("d5"), at("e5")]));
  const ride = rides.find((a) => a.to === at("d5"));
  const t = applyAction(s, ride);
  assert.equal(t.board[at("d5")].level, 3);
  assert.equal(t.events[0].path.length, 5, "around the Fisher: d3 c3 c4 c5 d5 or the other way");
  // Without a friendly neighbour no Wave Ride.
  const u = position(["......f", ".......", ".......", ".......", "...3...", ".......", "1......"], DOA);
  assert.equal(byAbility(u, "DoA.riverwatch.wave_ride").length, 0);
});

test("DoA.riverwatch.wave_ride: only around one group, no change to the ring of another group", () => {
  // River Watch d3 next to the Fisher d4. A second Fisher on g4 is not adjacent
  // to d4 (another group): its ring (f3..f5) touches the ring of d4 at e3..e5.
  const s = position(["......f", ".......", ".......", "...1..1", "...3...", ".......", "......."], DOA);
  const targets = byAbility(s, "DoA.riverwatch.wave_ride").filter((a) => a.from === at("d3")).map((a) => a.to);
  assert.deepEqual(sorted(targets), sorted([at("c4"), at("e4"), at("c5"), at("d5"), at("e5")]));
  // Fishers on d4 and e4 are one group: the ride goes around both.
  const u = position(["......f", ".......", ".......", "...11..", "...3...", ".......", "......."], DOA);
  const around = byAbility(u, "DoA.riverwatch.wave_ride").filter((a) => a.from === at("d3")).map((a) => a.to);
  assert.deepEqual(sorted(around), sorted([at("c4"), at("c5"), at("d5"), at("e5"), at("f5"), at("f4"), at("f3")]));
});

test("DoA.weaver.water_pearls: +1 TP at the start of the own turn, -1 when the last Weaver leaves", () => {
  let s = position(["......f", ".......", ".......", ".......", ".......", ".......", "4......"], { ...DOA, current: 2 });
  s = applyAction(s, { type: "move", from: at("g7"), to: at("f7") });
  assert.equal(s.players[1].tp, 1);
  s = applyAction(s, { type: "spell", ability: "DoA.weaver.ghost_call", at: at("a1"), watch: at("b1"), fisher: at("b2") });
  assert.equal(s.players[1].tp, 0);
  assert.equal(s.board[at("a1")], null);
  assert.equal(s.board[at("b1")].level, 3);
  assert.equal(s.board[at("b2")].level, 1);
});

test("DoA.weaver.ghost_call: River Watch next to the Weaver, Fisher next to it (or reversed)", () => {
  const s = position(["......f", ".......", ".......", "...4...", ".......", ".......", "......."], DOA);
  const calls = byAbility(s, "DoA.weaver.ghost_call");
  assert.ok(calls.some((a) => a.watch === at("e4") && a.fisher === at("e3")));
  assert.ok(calls.some((a) => a.fisher === at("e4") && a.watch === at("e3")));
  assert.ok(!calls.some((a) => a.watch === at("e3") && a.fisher === at("e2")), "one of them must be next to the Weaver");
  assert.ok(!calls.some((a) => a.fisher === at("d4") || a.watch === at("d4")));
  assert.deepEqual(actionPath(calls[0]).slice(0, 2), [at("d4"), "Ghost Call"]);
});

test("DoA.weaver.thread_of_fate: opposing creature -1, friendly creature +1", () => {
  const s = position(["......f", ".......", ".......", "...4e..", "..1....", ".......", "......."], { ...DOA, players: { 1: { tp: 3 } } });
  const a = byAbility(s, "DoA.weaver.thread_of_fate").find((x) => x.foe === at("e4") && x.delta === -1 && x.friend === at("c3"));
  assert.ok(a);
  const t = applyAction(s, a);
  assert.equal(t.board[at("e4")].level, 4);
  assert.equal(t.board[at("c3")].level, 2);
  assert.equal(t.players[1].tp, 1);
  assert.equal(t.players[1].exile, 1);
  assert.equal(byAbility(position(["......f", ".......", ".......", "...4e..", "..1....", ".......", "......."], { ...DOA, players: { 1: { tp: 1 } } }), "DoA.weaver.thread_of_fate").length, 0, "needs 2 TP");
});

test("DoA.ohtilia.from_the_fog: swap with an adjacent creature, then a mandatory standard Movement", () => {
  const s = position(["......f", ".......", ".......", "...f...", "...5...", ".......", "......."], DOA);
  const fog = byAbility(s, "DoA.ohtilia.from_the_fog").filter((a) => a.swap === at("d4"));
  assert.ok(fog.length && fog.every((a) => a.to !== undefined), "the follow-up Movement is mandatory");
  assert.ok(!fog.some((a) => a.to === at("d3")));
  const t = applyAction(s, fog.find((a) => a.to === at("d5")));
  assert.equal(t.board[at("d3")].level, 6);
  assert.equal(t.board[at("d3")].owner, 2);
  assert.equal(t.board[at("d5")].level, 5);
  assert.equal(t.board[at("d4")], null);
  assert.deepEqual(actionPath(fog[0]).slice(0, 3), [at("d3"), "From the Fog", at("d4")]);
});

test("DoA.ohtilia.from_the_fog: only the swap if no Movement is possible", () => {
  // Ohtilia a1 swaps with the own Fisher a2; from a2 all fields are blocked.
  const s = position(["......f", ".......", ".......", ".......", "a......", "1b.....", "5c....."], DOA);
  const fog = byAbility(s, "DoA.ohtilia.from_the_fog").filter((a) => a.swap === at("a2"));
  assert.deepEqual(fog, [{ type: "move", ability: "DoA.ohtilia.from_the_fog", from: at("a1"), swap: at("a2") }]);
});

test("DoA.awakening.twilight_hour: virtual VP for Awakenings in an open line", () => {
  assert.equal(virtualVP(position(["......f", ".......", ".......", "6..6...", ".......", ".......", "......."], DOA), 1), 2);
  assert.equal(virtualVP(position(["......f", ".......", ".......", "66.....", ".......", ".......", "......."], DOA), 1), 0, "a free field between");
  assert.equal(virtualVP(position(["......f", ".......", ".......", "6.a6...", ".......", ".......", "......."], DOA), 1), 0, "open line");
  assert.equal(virtualVP(position(["......f", ".......", ".......", "6.6.6..", ".......", ".......", "......."], DOA), 1), 3, "max 1 per Awakening");
});

test("DoA.awakening.new_beginning: 3 Fishers on any empty fields, the Awakening becomes a River Watch", () => {
  let s = position(["......f", ".......", ".......", "...6...", ".......", ".......", "......."], DOA);
  s = applyAction(s, { type: "spell", ability: "DoA.awakening.new_beginning", at: at("d4") });
  for (const f of ["a7", "b6", "g4"]) s = applyAction(s, { type: "choice", kind: "DoA.awakening.new_beginning", place: at(f) });
  assert.equal(s.board[at("d4")].level, 3);
  assert.equal(s.board[at("a7")].level, 1);
  assert.equal(s.board[at("a7")].owner, 1);
  assert.equal(s.current, 2);
});

test("DoA.awakening.sint_flut: all opposing creatures 1 field, own creatures block, over the edge 1 VP", () => {
  // Flood to the right: g7 and g4 go over the edge, f4 follows onto g4; c4 is blocked by the own 3 on d4,
  // and b4 behind it is blocked as well.
  const s = position(["......f", ".......", ".......", "bb3..cd", ".......", ".......", "6......"], { ...DOA, players: { 1: { tp: 10 } } });
  const a = byAbility(s, "DoA.awakening.sint_flut").find((x) => x.dir === 1);
  assert.ok(a);
  const t = applyAction(s, a);
  assert.equal(t.players[1].vp, 2, "1 VP each, no Field Bonus");
  assert.equal(t.players[2].exile, 2);
  assert.equal(t.board[at("g4")].level, 3);
  assert.equal(t.board[at("f4")], null);
  assert.equal(t.board[at("a4")].level, 2);
  assert.equal(t.board[at("b4")].level, 2);
  assert.equal(t.board[at("g7")], null, "pushed over the right edge too");
  assert.equal(t.players[1].tp, 0);
  assert.equal(byAbility(position(["......f", ".......", ".......", ".......", ".......", ".......", "6......"], { ...DOA, players: { 1: { tp: 9 } } }), "DoA.awakening.sint_flut").length, 0);
});

test("DoA River: the flow pushes creatures in the middle rows at the end of the starting player's turn", () => {
  let s = position(["......f", ".......", "......d", ".a.....", "2......", ".......", "......."], { ...DOA, locations: ["river"] });
  // River in column b (default): b5, b4 and b3 are river fields.
  assert.deepEqual(s.tiles[at("b4")], ["river"]);
  s = applyAction(s, { type: "move", from: at("a3"), to: at("a2") }); // leaves the middle rows
  // b4 stands on the river tile and is not moved; g5 is pushed over the edge: 4 VP for player 1.
  assert.equal(s.board[at("b4")].level, 1);
  assert.equal(s.board[at("g5")], null);
  assert.equal(s.players[1].vp, 4);
  assert.equal(s.players[2].exile, 1);
  // Player 2's turn: no flow.
  s = applyAction(s, { type: "move", from: at("b4"), to: at("c4") });
  assert.equal(s.board[at("c4")].level, 1);
  // Player 1 again: c4 flows to d4.
  s = applyAction(s, { type: "move", from: at("a2"), to: at("a1") });
  assert.equal(s.board[at("d4")].level, 1);
});

test("DoA River: a creature flowing onto an occupied location tile pushes the occupant downstream", () => {
  const g = createGame({ set1: "DoA", set2: "DoA", locations: ["river"], riverCol: 3 });
  assert.deepEqual(g.tiles[at("d4")], ["river"]);
  assert.equal(g.tiles[at("b4")], null);
  let s = position(["......f", ".......", ".......", "..1a...", ".......", ".......", "1......"], { ...DOA, locations: ["river"] });
  s.tiles = g.tiles;
  s = applyAction(s, { type: "move", from: at("a1"), to: at("b1") });
  assert.equal(s.board[at("d4")].owner, 1, "player 1's Fisher flowed onto the river tile");
  assert.equal(s.board[at("e4")].owner, 2, "the occupant was pushed off");
});

test("DoA decisions 2026-11-11: Thread of Fate exiles an own level 1, Sint Flut pushes everything, river is no defeat", async () => {
  // Thread of Fate: opposing +1, own Fisher -1 -> Exile (not the Reserve).
  let s = position(["......f", ".......", ".......", "...4c..", "..1....", ".......", "......."], { ...DOA, players: { 1: { tp: 2 } } });
  const reserve = s.players[1].reserve;
  s = applyAction(s, byAbility(s, "DoA.weaver.thread_of_fate").find((a) => a.foe === at("e4") && a.delta === 1 && a.friend === at("c3")));
  assert.equal(s.board[at("c3")], null);
  assert.equal(s.players[1].exile, 2, "1 for the spell, 1 for the Fisher");
  assert.equal(s.players[1].reserve, reserve - 1);
  // Sint Flut also pushes creatures that cannot move (RoX Portal on g4).
  s = position(["......f", ".......", ".......", "......a", ".......", ".......", "6......"], { set1: "DoA", set2: "RoX", players: { 1: { tp: 10 } } });
  s = applyAction(s, byAbility(s, "DoA.awakening.sint_flut").find((a) => a.dir === 1));
  assert.equal(s.board[at("g4")], null);
  assert.equal(s.players[1].vp, 2);
  // River: a Dream Bringer flowing over the edge is no defeat (no Depth Rapture), the opponent gets its level.
  s = position(["......f", ".......", "......b", ".......", ".......", ".......", "1......"], { ...DOA, locations: ["river"] });
  s = applyAction(s, { type: "move", from: at("a1"), to: at("b1") });
  assert.equal(s.board[at("g5")], null);
  assert.equal(s.players[2].tp, 0, "no Depth Rapture");
  assert.equal(s.players[1].vp, 2);
});
