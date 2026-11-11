import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAction, legalActions, isLegal, virtualVP, actor } from "../engine/core.js";
import { actionPath } from "../engine/paths.js";
import { position, at } from "./helpers.js";

const KOS = { set1: "KoS", set2: "KoS" };
const byAbility = (s, ability) => legalActions(s).filter((a) => a.ability === ability);
const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
const face = (s, f, dir) => { s.board[at(f)].dir = dir; return s; };
// Rows from top (row 7) to bottom (row 1); columns a..g. Player 1 faces up, player 2 down.

test("KoS alignment: Shield, Spear and Stag choose their alignment with every Movement", () => {
  const s = position(["......f", ".......", ".......", "...3...", ".......", ".......", "......."], KOS);
  const moves = legalActions(s).filter((a) => a.type === "move" && a.from === at("d4") && a.to === at("d5") && a.pre === undefined);
  assert.deepEqual(moves.map((a) => a.face).sort(), [0, 1, 2, 3]);
  assert.deepEqual(actionPath(moves[1]), [at("d4"), at("d5"), "Face →"]);
  const t = applyAction(s, moves.find((a) => a.face === RIGHT));
  assert.equal(t.board[at("d5")].dir, RIGHT);
});

test("KoS alignment: the Loyal Shield turns before OR after, the Silver Spear before and/or after", () => {
  // Loyal Shield (2) on d4, facing up.
  let s = position(["......f", ".......", ".......", "...2...", ".......", ".......", "......."], KOS);
  let moves = legalActions(s).filter((a) => a.from === at("d4") && a.to === at("d5"));
  assert.equal(moves.filter((a) => a.pre === undefined).length, 4, "no turn before: any alignment after");
  const pre = moves.filter((a) => a.pre !== undefined);
  assert.deepEqual(pre.map((a) => a.pre).sort(), [1, 2, 3], "turned before: no turn after");
  assert.ok(pre.every((a) => a.face === undefined));
  assert.deepEqual(actionPath(pre[0]), [at("d4"), "Turn →", at("d5")]);
  assert.equal(applyAction(s, pre[0]).board[at("d5")].dir, RIGHT);
  // Silver Spear (3): turned before and afterwards again.
  s = position(["......f", ".......", ".......", "...3...", ".......", ".......", "......."], KOS);
  moves = legalActions(s).filter((a) => a.from === at("d4") && a.to === at("d5"));
  assert.equal(moves.length, 4 + 3 * 4);
  const both = moves.find((a) => a.pre === RIGHT && a.face === LEFT);
  assert.deepEqual(actionPath(both), [at("d4"), "Turn →", at("d5"), "Face ←"]);
  assert.equal(applyAction(s, both).board[at("d5")].dir, LEFT);
});

test("KoS.shield.shield_strike: sideways only after turning, then no turn afterwards", () => {
  // Shield d3 facing up, opposing 4 on e3 (to the right).
  const s = position(["......f", ".......", ".......", ".......", "...2d..", ".......", "......."], KOS);
  const strikes = byAbility(s, "KoS.shield.shield_strike").filter((a) => a.target === at("e3"));
  assert.equal(strikes.length, 1);
  assert.equal(strikes[0].pre, RIGHT);
  assert.equal(strikes[0].face, undefined);
  assert.deepEqual(actionPath(strikes[0]), [at("d3"), "Turn →", "Shield Strike", at("e3")]);
  const t = applyAction(s, strikes[0]);
  assert.equal(t.board[at("e3")].level, 2);
  assert.equal(t.board[at("e3")].dir, RIGHT);
  assert.equal(t.board[at("f3")].level, 4);
});

test("KoS.sword.agile and relentless: diagonal moves, then another First Sword may act", () => {
  let s = position(["......f", ".......", ".......", "...1...", ".......", ".......", "1......"], KOS);
  assert.ok(byAbility(s, "KoS.sword.agile").some((a) => a.from === at("d4") && a.to === at("e5")));
  s = applyAction(s, { type: "move", ability: "KoS.sword.agile", from: at("d4"), to: at("e5") });
  assert.equal(actor(s), 1);
  const opts = legalActions(s);
  assert.ok(opts.every((o) => o.skip || o.sub.from === at("a1") || o.sub.at === at("a1")), "only the sword that has not acted");
  s = applyAction(s, opts.find((o) => o.sub && o.sub.to === at("a2")));
  assert.equal(s.current, 2, "no further First Sword left");
});

test("KoS.sword.support: -1 for an opposing creature, the Sword returns to the Reserve", () => {
  const s = position(["......f", ".......", ".......", "...1d..", ".......", ".......", "......."], KOS);
  const t = applyAction(s, { type: "spell", ability: "KoS.sword.support", at: at("d4"), target: at("e4"), delta: -1 });
  assert.equal(t.board[at("e4")].level, 3);
  assert.equal(t.board[at("d4")], null);
});

test("KoS.sword.relentless: an exiled First Sword may return on an edge field", () => {
  let s = position(["......f", ".......", ".......", "...a...", "...3...", ".......", "......."], { ...KOS });
  s = applyAction(s, { type: "attack", from: at("d3"), to: at("d4"), face: UP });
  assert.equal(actor(s), 2, "the owner of the Sword decides");
  const opts = legalActions(s);
  assert.ok(opts.some((o) => o.place === at("a4")) && !opts.some((o) => o.place === at("a1")), "not the opposing Supply Zone");
  s = applyAction(s, opts.find((o) => o.place === at("a4") && o.face === RIGHT));
  assert.equal(s.board[at("a4")].dir, RIGHT);
  assert.equal(s.board[at("a4")].level, 1);
  assert.equal(s.players[2].exile, 0);
});

test("KoS.shield.shield_strike: push against an own creature defeats it, no Field Bonus", () => {
  // Shield d3 facing up, opposing 4 on d4, own First Sword on d5.
  const s = position(["......f", ".......", "...1...", "...d...", "...2...", ".......", "......."], KOS);
  const strike = byAbility(s, "KoS.shield.shield_strike").find((a) => a.target === at("d4") && a.face === UP);
  assert.ok(strike);
  const t = applyAction(s, strike);
  assert.equal(t.board[at("d4")].level, 2);
  assert.equal(t.board[at("d4")].owner, 1);
  assert.equal(t.players[1].vp, 4);
  // Onto a free field it is only pushed.
  const s2 = position(["......f", ".......", ".......", "...d...", "...2...", ".......", "......."], KOS);
  const t2 = applyAction(s2, byAbility(s2, "KoS.shield.shield_strike").find((a) => a.target === at("d4") && a.face === UP));
  assert.equal(t2.board[at("d5")].level, 4);
  assert.equal(t2.players[1].vp, 0);
});

test("KoS.shield.resistance: not attacked from the frontally adjacent field", () => {
  // Player 2 Shield on d4 facing down (towards d3).
  const s = position(["......f", ".......", ".......", "...b...", "...3...", ".......", "......."], KOS);
  assert.ok(!legalActions(s).some((a) => a.type === "attack" && a.to === at("d4")));
  face(s, "d4", UP);
  assert.ok(legalActions(s).some((a) => a.type === "attack" && a.to === at("d4")));
});

test("KoS.spear.phalanx: an opposing creature in front of the Spear loses 1 level", () => {
  // Player 2 moves a 4 from e4 to d4, right in front of player 1's Spear on d3 (facing up).
  let s = position(["......f", ".......", ".......", "....d..", "...3...", ".......", "......."], { ...KOS, current: 2 });
  s = applyAction(s, { type: "move", from: at("e4"), to: at("d4") });
  assert.equal(s.board[at("d4")].level, 3);
});

test("KoS.spear.heart_thrust: attack over an own Loyal Shield", () => {
  const s = position(["......f", ".......", "...f...", "...2...", "...3...", ".......", "......."], KOS);
  const a = byAbility(s, "KoS.spear.heart_thrust").find((x) => x.to === at("d5"));
  assert.ok(a);
  const t = applyAction(s, a);
  assert.equal(t.board[at("d5")].level, 3);
});

test("KoS.commander: Moral Boost, Leadership moves creatures for TP = Power Level", () => {
  let s = position(["......f", ".......", ".......", ".......", "...4...", "....3..", "..2...."], { ...KOS, current: 2 });
  s = applyAction(s, { type: "move", from: at("g7"), to: at("f7") });
  assert.equal(s.players[1].tp, 1);
  s.players[1].tp = 5;
  s = applyAction(s, { type: "spell", ability: "KoS.commander.leadership", at: at("d3") });
  assert.ok(!legalActions(s).some((o) => o.sub && o.sub.from === at("d3")), "not the Commander himself");
  s = applyAction(s, legalActions(s).find((o) => o.sub && o.sub.from === at("e2") && o.sub.to === at("e3") && o.sub.face === UP));
  assert.equal(s.players[1].tp, 2);
  s = applyAction(s, legalActions(s).find((o) => o.sub && o.sub.from === at("c1") && o.sub.to === at("c2") && o.sub.face === UP));
  assert.equal(s.players[1].tp, 0);
  assert.equal(s.current, 2);
});

test("KoS.commander.supply: only if not threatened, 4 First Swords on the edges", () => {
  let s = position(["......f", ".......", ".......", ".......", "...4...", ".......", "......."], KOS);
  assert.equal(byAbility(s, "KoS.commander.supply").length, 1);
  s = position(["......f", ".......", ".......", "...e...", "...4...", ".......", "......."], KOS);
  assert.equal(byAbility(s, "KoS.commander.supply").length, 0, "threatened by the opposing 5");
});

test("KoS.stag.crown_path: frontal fields or 1 back", () => {
  const s = position(["......f", ".......", ".......", "...5...", ".......", ".......", "......."], KOS);
  const targets = new Set(legalActions(s).filter((a) => a.from === at("d4") && a.type === "move").map((a) => a.to));
  assert.deepEqual([...targets].sort((x, y) => x - y), [at("c5"), at("d5"), at("e5"), at("d3")].sort((x, y) => x - y));
});

test("KoS.knight: Breakthrough formations of 9+, Reinforcements", () => {
  const s = position(["......f", ".......", ".......", "...6...", "...3...", ".......", "......."], KOS);
  assert.equal(virtualVP(s, 1), 1);
  let t = applyAction(s, { type: "spell", ability: "KoS.knight.reinforcements", at: at("d4") });
  t = applyAction(t, { type: "choice", kind: "KoS.knight.reinforcements", place: at("c4"), face: LEFT });
  t = applyAction(t, { type: "choice", kind: "KoS.knight.reinforcements", place: at("e4"), face: RIGHT });
  assert.ok(legalActions(t).filter((o) => o.place === at("d5")).length === 4, "the First Sword chooses its alignment too");
  t = applyAction(t, { type: "choice", kind: "KoS.knight.reinforcements", place: at("d5"), face: DOWN });
  assert.equal(t.board[at("d4")], null);
  assert.equal(t.board[at("c4")].level, 3);
  assert.equal(t.board[at("c4")].dir, LEFT);
  assert.equal(t.board[at("e4")].level, 2);
  assert.equal(t.board[at("d5")].level, 1);
  assert.equal(t.board[at("d5")].dir, DOWN);
});

test("KoS alignment: chosen in the setup and with Supply and Relentless, kept when upgraded", async () => {
  const { createGame, validateSetup } = await import("../engine/core.js");
  let g = createGame({ set1: "KoS", set2: "KoS" });
  const placements = [{ col: 2, level: 4, dir: RIGHT }, { col: 3, level: 6, dir: LEFT }];
  assert.equal(validateSetup(g, 1, placements), null);
  assert.equal(validateSetup(g, 1, [{ col: 2, level: 10, dir: 5 }]), "Invalid Power Level.");
  assert.equal(validateSetup(g, 1, [{ col: 2, level: 4, dir: 7 }, { col: 3, level: 6 }]), "Invalid alignment.");
  g = applyAction(g, { type: "setup", placements });
  assert.equal(g.board[at("c1")].dir, RIGHT);
  // Supply: every First Sword chooses its alignment.
  let s = position(["......f", ".......", ".......", ".......", "...4...", ".......", "......."], KOS);
  s = applyAction(s, { type: "spell", ability: "KoS.commander.supply", at: at("d3") });
  const opts = legalActions(s).filter((o) => o.place === at("a1"));
  assert.deepEqual(opts.map((o) => o.face).sort(), [0, 1, 2, 3]);
  s = applyAction(s, opts.find((o) => o.face === LEFT));
  assert.equal(s.board[at("a1")].dir, LEFT);
  // The alignment stays when the die is upgraded.
  const u = position(["......f", ".......", ".......", ".......", ".......", ".......", "1......"], KOS);
  u.board[at("a1")].dir = RIGHT;
  assert.equal(applyAction(u, { type: "upgrade", at: at("a1") }).board[at("a1")].dir, RIGHT);
});

test("KoS.shield.to_the_spears: more than 3 Shields at the start of the turn", () => {
  let s = position(["......f", ".......", ".......", ".......", ".......", ".......", "2222..."], { ...KOS, current: 2 });
  s = applyAction(s, { type: "move", from: at("g7"), to: at("f7") });
  assert.equal(actor(s), 1);
  s = applyAction(s, legalActions(s).find((o) => o.upgrade === at("a1")));
  assert.equal(s.board[at("a1")].level, 3);
  assert.ok(legalActions(s).every((o) => o.kind !== "KoS.shield.to_the_spears"));
});

test("KoS: the AI chooses the alignment of its starting lineup", async () => {
  const { createGame } = await import("../engine/core.js");
  const { chooseSetup } = await import("../ai/ai.js");
  const g = createGame({ set1: "KoS", set2: "KoS" });
  const a = chooseSetup(g, { level: "medium", random: () => 0.3 });
  assert.ok(a.placements.every((p) => [0, 1, 2, 3].includes(p.dir)));
  assert.ok(applyAction(g, a));
});
