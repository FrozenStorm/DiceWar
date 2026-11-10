import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAction, legalActions, isLegal, virtualVP, actor, totalVP } from "../engine/core.js";
import { position, at } from "./helpers.js";

const byAbility = (s, ability) => legalActions(s).filter((a) => a.ability === ability);
const sorted = (xs) => [...xs].sort((a, b) => a - b);

test("RoX.portal.unmovable: Portals neither move nor attack", () => {
  const s = position(["......f", ".......", ".......", "...1...", ".......", ".......", "......."]);
  const fromPortal = legalActions(s).filter((a) => a.from === at("d4"));
  assert.deepEqual(fromPortal, []);
  assert.ok(isLegal(s, { type: "upgrade", at: at("d4") }));
});

test("RoX.portal.resistance: Portals are immune while #Portals <= #Portal Bearers", () => {
  // Player 2 has 1 Portal and 1 Portal Bearer: immune.
  let s = position(["......b", ".......", ".......", "...3a..", ".......", ".......", "......."]);
  assert.ok(!isLegal(s, { type: "attack", from: at("d4"), to: at("e4") }));
  // A second Portal makes them vulnerable.
  s = position(["a.....b", ".......", ".......", "...3a..", ".......", ".......", "......."]);
  assert.ok(isLegal(s, { type: "attack", from: at("d4"), to: at("e4") }));
});

test("RoX.bearer.aerial_maneuver: jump over an adjacent creature, land next to it, not back", () => {
  // Card example: Portal Bearer below an opposing 4; lands left, right or above the 4.
  const s = position(["......a", ".......", "...d...", "...2...", ".......", ".......", "......."]);
  const targets = byAbility(s, "RoX.bearer.aerial_maneuver").map((a) => a.to);
  assert.deepEqual(sorted(targets), sorted([at("c5"), at("e5"), at("d6")]));
  const t = applyAction(s, { type: "move", ability: "RoX.bearer.aerial_maneuver", from: at("d4"), to: at("d6"), over: at("d5") });
  assert.equal(t.board[at("d6")].level, 2);
  assert.equal(t.board[at("d5")].level, 4); // jumped creature is not defeated
});

test("RoX.portal.wormhole: enter an own Portal, continue from a Portal Bearer", () => {
  const s = position(["......a", ".......", ".......", ".......", ".....2.", ".......", "61....."]);
  const moves = byAbility(s, "RoX.portal.wormhole");
  // Xeladron on a1 enters the Portal on b1 and continues from the Bearer on f3 to its 4 neighbours.
  assert.deepEqual(sorted(moves.map((a) => a.follow.to)), sorted([at("f4"), at("e3"), at("g3"), at("f2")]));
  const a = moves.find((m) => m.follow.to === at("f4"));
  const t = applyAction(s, a);
  assert.equal(t.board[at("f4")].level, 6);
  assert.equal(t.board[at("a1")], null);
  assert.equal(t.board[at("b1")], null); // Portal back to the Reserve
  assert.equal(t.board[at("f3")].level, 1); // Portal Bearer downgraded to a Portal
  assert.equal(t.players[1].reserve, s.players[1].reserve + 1);
});

test("RoX.portal.wormhole: follow-up attack, and no Wormhole without a valid follow-up", () => {
  // The Bearer on f3 is surrounded by opposing 6s that Xeladron cannot defeat.
  let s = position(["......a", ".......", ".......", ".....f.", "....f2f", ".....f.", "61....."]);
  const moves = byAbility(s, "RoX.portal.wormhole");
  assert.deepEqual(moves.map((a) => [a.follow.type, a.follow.to]), []);
  s = position(["......a", ".......", ".......", ".....c.", "....f2f", ".....f.", "61....."]);
  const m = byAbility(s, "RoX.portal.wormhole");
  assert.deepEqual(m.map((a) => [a.follow.type, a.follow.to]), [["attack", at("f4")]]);
  const t = applyAction(s, m[0]);
  assert.equal(t.players[1].vp, 3);
  assert.equal(t.board[at("f4")].level, 6);
});

test("RoX.portal.wormhole: needs a friendly Portal Bearer other than the moving creature", () => {
  const s = position(["......a", ".......", ".......", ".......", ".......", ".......", "21....."]);
  assert.deepEqual(byAbility(s, "RoX.portal.wormhole"), []);
});

test("RoX.guardian.new_paths: Bearer and Portal adjacent to the Guardian and diagonal to each other; Arrival +1 TP", () => {
  const s = position(["......a", ".......", ".......", "...3...", ".......", ".......", "......."]);
  const acts = byAbility(s, "RoX.guardian.new_paths");
  assert.equal(acts.length, 8); // 4 diagonal pairs x 2 assignments
  const a = acts.find((x) => x.bearer === at("d5") && x.portal === at("e4"));
  const t = applyAction(s, a);
  assert.equal(t.board[at("d5")].level, 2);
  assert.equal(t.board[at("e4")].level, 1);
  assert.equal(t.board[at("d4")], null);
  assert.equal(t.players[1].tp, 1);
  assert.equal(t.players[1].reserve, s.players[1].reserve - 1); // 2 placed, Guardian returned
});

test("RoX.guardian.new_paths needs 2 Reserve Dice", () => {
  const s = position(["......a", ".......", ".......", "...3...", ".......", ".......", "......."], { players: { 1: { reserve: 1 } } });
  assert.deepEqual(byAbility(s, "RoX.guardian.new_paths"), []);
});

test("RoX.emissary.dimensional_summoning: exile 1, spend X TP, place level X next to a Portal Bearer", () => {
  const s = position(["......a", ".......", ".......", ".2.4...", ".......", ".......", "......."], { players: { 1: { tp: 3 } } });
  const acts = byAbility(s, "RoX.emissary.dimensional_summoning");
  assert.deepEqual([...new Set(acts.map((a) => a.level))], [1, 2, 3]);
  const t = applyAction(s, acts.find((a) => a.level === 2 && a.target === at("b5")));
  assert.equal(t.board[at("b5")].level, 2);
  assert.equal(t.players[1].tp, 3 - 2 + 1); // Arrival
  assert.equal(t.players[1].exile, 1);
  assert.equal(t.players[1].reserve, s.players[1].reserve - 2);
});

test("RoX.xeladron.decay: Emissary diagonal, Portal Bearer in the own zone", () => {
  const s = position(["......a", ".......", ".......", "...6...", ".......", ".......", "......."]);
  const acts = byAbility(s, "RoX.xeladron.decay");
  for (const a of acts) assert.ok(Math.floor(a.bearer / 7) >= 4);
  const t = applyAction(s, acts.find((a) => a.emissary === at("c5") && a.bearer === at("a1")));
  assert.equal(t.board[at("c5")].level, 4);
  assert.equal(t.board[at("a1")].level, 2);
  assert.equal(t.board[at("d4")], null);
  assert.equal(t.players[1].tp, 1);
});

test("RoX.xeladron.impact: 6 TP, everything around goes to Exile, 1 VP per opposing creature", () => {
  const s = position(["......a", ".......", "..fc...", "..36e..", "...2...", ".......", "......."], { players: { 1: { tp: 7 } } });
  const t = applyAction(s, { type: "spell", ability: "RoX.xeladron.impact", at: at("d4") });
  for (const n of ["c5", "d5", "c4", "d4", "e4", "d3"]) assert.equal(t.board[at(n)], null, n);
  assert.equal(t.players[1].vp, 3);
  assert.equal(t.players[1].tp, 1);
  assert.equal(t.players[1].exile, 3);
  assert.equal(t.players[2].exile, 3);
});

test("RoX.emissary.energy_circle: +1 TP per turn with Portal, Bearer and Emissary; -4 TP when the last Emissary leaves", () => {
  let s = position(["......a", ".......", ".......", ".......", ".......", ".......", "124...."], { current: 2, players: { 1: { tp: 2 } } });
  s = applyAction(s, { type: "move", from: at("g7"), to: at("f7") });
  assert.equal(s.players[1].tp, 3);

  s = position(["......a", ".......", ".......", ".......", ".......", "..f....", "124...."], { current: 2, players: { 1: { tp: 3 } } });
  s = applyAction(s, { type: "attack", from: at("c2"), to: at("c1") });
  assert.equal(s.players[1].tp, 0); // 3 - 4, floored at 0; no Energy Circle without Emissary
});

test("RoX.emissary.energy_circle: upgrading the last Emissary also costs 4 TP", () => {
  const s = position(["......a", ".......", ".......", "...4...", ".......", ".......", "......."], { players: { 1: { tp: 5 } } });
  const t = applyAction(s, { type: "upgrade", at: at("d4") });
  assert.equal(t.players[1].tp, 1);
  const s2 = position(["......a", ".......", ".......", "...4...", "...4...", ".......", "......."], { players: { 1: { tp: 5 } } });
  assert.equal(applyAction(s2, { type: "upgrade", at: at("d4") }).players[1].tp, 5); // another Emissary remains
});

test("RoX.bearer.balance: owner places a Portal or upgrades a Portal after the Bearer is defeated", () => {
  let s = position(["......a", ".......", ".......", "...4b..", ".......", ".......", "......."]);
  s = applyAction(s, { type: "attack", from: at("d4"), to: at("e4") });
  assert.equal(actor(s), 2);
  const opts = legalActions(s);
  assert.ok(opts.some((o) => o.upgrade === at("g7")));
  assert.ok(!opts.some((o) => o.place === at("e4"))); // attacker now stands there
  s = applyAction(s, { type: "choice", kind: "RoX.bearer.balance", place: at("a1") });
  assert.equal(s.board[at("a1")].level, 1);
  assert.equal(s.board[at("a1")].owner, 2);
  assert.equal(s.players[2].tp, 0); // placing a Portal is not Arrival
  assert.equal(s.current, 2);
});

test("RoX.enchantress.force_of_attraction: optionally pull a diagonal opposing creature next to her", () => {
  let s = position(["......a", ".......", "....c..", ".......", "...5...", ".......", "......."]);
  s = applyAction(s, { type: "move", from: at("d3"), to: at("d4") });
  assert.equal(s.current, 1);
  const opts = legalActions(s);
  assert.deepEqual(sorted(opts.filter((o) => !o.skip).map((o) => o.to)), sorted([at("d5"), at("e4")]));
  s = applyAction(s, { type: "choice", kind: "RoX.enchantress.force_of_attraction", from: at("e5"), to: at("e4") });
  assert.equal(s.board[at("e4")].level, 3);
  assert.equal(s.board[at("e5")], null);
  assert.equal(s.current, 2);
});

test("RoX.enchantress.force_of_attraction cannot pull unmovable Portals", () => {
  let s = position(["......a", "......b", "....a..", ".......", "...5...", ".......", "......."]);
  s = applyAction(s, { type: "move", from: at("d3"), to: at("d4") });
  assert.equal(s.current, 2); // no decision: the only diagonal creature is a Portal
});

test("RoX.xeladron.impact does not trigger Balance (exile, not defeat)", () => {
  const s = position(["......a", ".......", ".......", "..b6...", ".......", ".......", "......."], { players: { 1: { tp: 6 } } });
  const t = applyAction(s, { type: "spell", ability: "RoX.xeladron.impact", at: at("d4") });
  assert.equal(t.pending.length, 0);
  assert.equal(t.current, 2);
  assert.equal(t.players[1].vp, 1);
  assert.equal(t.players[2].exile, 1);
});

test("RoX.xeladron.forceful_alliance: 1 virtual VP per adjacent Xeladron/Portal pair", () => {
  // Card example: 2 Xeladrons and 2 Portals = 2 virtual VP.
  const s = position(["......a", ".......", ".......", ".......", ".......", "...616.", ".....1."]);
  assert.equal(virtualVP(s, 1), 2);
  assert.equal(totalVP(s, 1), 2);
});

test("RoX craters: 1 VP at turn start when both are held with level 2+", () => {
  // Craters: b5 (row 3, col 2) and f3 (row 5, col 6).
  let s = position(["......a", ".......", ".3.....", ".......", ".....2.", ".......", "......."], { locations: ["craters"], current: 2 });
  s = applyAction(s, { type: "upgrade", at: at("g7") });
  assert.equal(s.players[1].vp, 1);
  assert.equal(s.current, 1);
});

test("RoX craters: level 1 creatures on a crater go to the Reserve at the end of every turn", () => {
  let s = position(["......a", ".......", ".1.....", ".......", ".....a.", ".......", "4......"], { locations: ["craters"] });
  s = applyAction(s, { type: "move", from: at("a1"), to: at("a2") });
  assert.equal(s.board[at("b5")], null);
  assert.equal(s.board[at("f3")], null);
  assert.equal(s.players[1].reserve, 15 - 1);
  assert.equal(s.players[2].reserve, 15 - 1);
});
