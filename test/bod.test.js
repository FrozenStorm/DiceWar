import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAction, legalActions, isLegal, virtualVP, actor } from "../engine/core.js";
import { position, at } from "./helpers.js";

const BOD = { set1: "BoD", set2: "BoD" };
const byAbility = (s, ability) => legalActions(s).filter((a) => a.ability === ability);
const sorted = (xs) => [...xs].sort((a, b) => a - b);

test("BoD.gnome.protective_aura: own creatures with level 2+ next to a Gnome cannot be attacked", () => {
  // Player 2: Possessed (b) on d4 next to a Gnome (a) on e4. Player 1 Hunter on d3.
  let s = position(["......f", ".......", ".......", "...ba..", "...3...", ".......", "......."], BOD);
  assert.ok(!isLegal(s, { type: "attack", from: at("d3"), to: at("d4") }));
  // Without the Gnome the attack is possible (and even forced by Temptation).
  s = position(["......f", ".......", ".......", "...b...", "...3...", ".......", "......."], BOD);
  assert.ok(isLegal(s, { type: "attack", from: at("d3"), to: at("d4") }));
});

test("BoD.gnome.protective_aura: Gnomes themselves are not protected", () => {
  const s = position(["......f", ".......", ".......", "...aa..", "...3...", ".......", "......."], BOD);
  assert.ok(isLegal(s, { type: "attack", from: at("d3"), to: at("d4") }));
});

test("BoD.possessed.temptation: adjacent level 3+ creatures have to attack the Possessed", () => {
  // Player 1 (RoX) Portal Guardian on d3 next to the BoD Possessed on d4.
  const s = position(["......f", ".......", ".......", "...b...", "...3...", ".......", "5......"], { set1: "RoX", set2: "BoD" });
  const acts = legalActions(s).filter((a) => a.type !== "declareEndOfWar");
  assert.deepEqual(acts, [{ type: "attack", from: at("d3"), to: at("d4") }]);
});

test("BoD.possessed.temptation: no obligation if the Possessed is immune", () => {
  const s = position(["......f", ".......", ".......", "...ba..", "...3...", ".......", "5......"], { set1: "RoX", set2: "BoD" });
  const acts = legalActions(s).filter((a) => a.type !== "declareEndOfWar");
  assert.ok(acts.length > 1);
  assert.ok(!acts.some((a) => a.type === "attack" && a.to === at("d4")));
});

test("BoD.possessed.temptation: level 2 creatures are not forced", () => {
  const s = position(["......f", ".......", ".......", "...b...", "...2...", ".......", "......."], { set1: "RoX", set2: "BoD" });
  assert.ok(legalActions(s).some((a) => a.type === "move"));
});

test("BoD.hunter.hunters_path: up to 2 fields over free fields, straight or around a corner", () => {
  const s = position(["......f", ".......", ".......", "...3a..", ".......", ".......", "......."], BOD);
  const targets = byAbility(s, "BoD.hunter.hunters_path").filter((a) => a.from === at("d4")).map((a) => a.to);
  // e4 is blocked, so f4 cannot be reached in 2 fields.
  assert.deepEqual(sorted(targets), sorted([at("d6"), at("d2"), at("b4"), at("c5"), at("c3"), at("e5"), at("e3")]));
});

test("BoD.hunter.dark_fusion: fuse with a Hunter 2 fields away, become a Demon, additional action", () => {
  const s = position(["......f", ".......", ".......", ".3.3...", ".......", ".......", "......."], BOD);
  const fusion = byAbility(s, "BoD.hunter.dark_fusion").find((a) => a.from === at("b4") && a.to === at("d4"));
  assert.ok(fusion, "fusion over 2 fields in a straight line");
  let t = applyAction(s, fusion);
  assert.equal(t.board[at("b4")], null);
  assert.equal(t.board[at("d4")].level, 6);
  assert.equal(t.players[1].exile, 1);
  // No Hunter left: the Demon may take an additional action.
  assert.equal(actor(t), 1);
  const opts = legalActions(t);
  assert.ok(opts.some((o) => o.skip));
  const move = opts.find((o) => o.sub && o.sub.type === "move" && o.sub.to === at("d5"));
  t = applyAction(t, move);
  assert.equal(t.board[at("d5")].level, 6);
  assert.equal(t.current, 2);
});

test("BoD.hunter.dark_fusion: no fusion over an occupied field, no additional action with a 3rd Hunter", () => {
  let s = position(["......f", ".......", ".......", ".3a3...", ".......", ".......", "......."], BOD);
  assert.ok(!byAbility(s, "BoD.hunter.dark_fusion").some((a) => a.from === at("b4") && a.to === at("d4")));
  s = position(["......f", ".......", ".......", ".33....", ".......", ".......", "3......"], BOD);
  const t = applyAction(s, { type: "upgrade", ability: "BoD.hunter.dark_fusion", from: at("b4"), to: at("c4") });
  assert.equal(t.current, 2);
});

test("BoD.hag.black_magic: +1 TP per turn with a Swamp Hag, TP lost without Hag and Possessed", () => {
  let s = position(["......f", ".......", ".......", ".......", ".......", ".......", "4......"], { ...BOD, current: 2 });
  s = applyAction(s, { type: "move", from: at("g7"), to: at("f7") });
  assert.equal(s.players[1].tp, 1);
  // The Hag is defeated: no Hag and no Possessed left, so the TP are lost.
  s = position(["......f", ".......", ".......", ".......", ".......", ".......", "4e....."], { ...BOD, current: 2, players: { 1: { tp: 5 } } });
  s = applyAction(s, { type: "attack", from: at("b1"), to: at("a1") });
  assert.equal(s.players[1].tp, 0);
});

test("BoD.hag.voodoo: move a Possessed exactly 3 fields and raise another by 2", () => {
  const s = position(["......f", ".......", ".......", ".......", ".......", ".......", "42.2..."], { ...BOD, players: { 1: { tp: 5 } } });
  const acts = byAbility(s, "BoD.hag.voodoo");
  assert.ok(acts.some((a) => a.move && a.move.from === at("b1") && a.move.to === at("b4")));
  assert.ok(!acts.some((a) => a.move && a.move.to === at("b3")), "exactly 3 fields");
  const both = acts.find((a) => a.move && a.move.from === at("b1") && a.move.to === at("b4") && a.raise === at("d1"));
  const t = applyAction(s, both);
  assert.equal(t.board[at("b4")].level, 2);
  assert.equal(t.board[at("d1")].level, 4);
  assert.equal(t.players[1].tp, 0);
  assert.equal(t.players[1].exile, 1);
});

test("BoD.hag.voodoo: needs TP and a Reserve Die", () => {
  let s = position(["......f", ".......", ".......", ".......", ".......", ".......", "42....."], { ...BOD, players: { 1: { tp: 1 } } });
  assert.equal(byAbility(s, "BoD.hag.voodoo").length, 0);
  s = position(["......f", ".......", ".......", ".......", ".......", ".......", "42....."], { ...BOD, players: { 1: { tp: 2 } } });
  assert.ok(byAbility(s, "BoD.hag.voodoo").every((a) => !a.move && a.raise === at("b1")));
});

test("BoD.hag.servitude: split into 2 Possessed next to the Hag", () => {
  const s = position(["......f", ".......", ".......", "...4...", ".......", ".......", "......."], BOD);
  const t = applyAction(s, { type: "spell", ability: "BoD.hag.servitude", at: at("d4"), a: at("d5"), b: at("e4") });
  assert.equal(t.board[at("d4")], null);
  assert.equal(t.board[at("d5")].level, 2);
  assert.equal(t.board[at("e4")].level, 2);
});

test("BoD.gatherer.mercy and sacrifice", () => {
  let s = position(["......f", ".......", ".......", "...5...", ".......", ".......", "......."], BOD);
  s = applyAction(s, { type: "spell", ability: "BoD.gatherer.mercy", at: at("d4"), target: at("d3") });
  assert.equal(s.board[at("d3")].level, 1);
  // Sacrifice: Gatherer moves onto the Gnome, Gnome to the Reserve, then one more action.
  s = position(["......f", ".......", ".......", "...5...", "...1...", ".......", "......."], BOD);
  const reserve = s.players[1].reserve;
  let t = applyAction(s, { type: "move", ability: "BoD.gatherer.sacrifice", from: at("d4"), to: at("d3") });
  assert.equal(t.board[at("d3")].level, 5);
  assert.equal(t.players[1].reserve, reserve + 1);
  assert.equal(actor(t), 1);
  const opts = legalActions(t);
  assert.ok(opts.some((o) => o.sub && o.sub.type === "upgrade"));
  assert.ok(!opts.some((o) => o.sub && o.sub.ability), "only upgrade, move or attack");
  t = applyAction(t, opts.find((o) => o.skip));
  assert.equal(t.current, 2);
});

test("BoD.demon.allegiance and bound", () => {
  const s = position(["......f", ".......", ".......", "...6...", ".......", ".......", "6......"], BOD);
  assert.equal(virtualVP(s, 1), 0);
  const t = applyAction(s, { type: "spell", ability: "BoD.demon.allegiance", at: at("d4"), hag: at("e4") });
  assert.equal(t.board[at("d4")].level, 2);
  assert.equal(t.board[at("e4")].level, 4);
  assert.equal(virtualVP(t, 1), 1); // 1 Demon + 1 Possessed
});

test("BoD Oracle: TP for the owner, level set to 4, no raising on the Oracle", () => {
  let s = position(["......f", ".......", ".......", ".......", "...6...", ".......", "......."], { set1: "RoX", set2: "BoD", locations: ["oracle"] });
  s = applyAction(s, { type: "move", from: at("d3"), to: at("d4") });
  assert.equal(s.board[at("d4")].level, 4); // falls to 4 at the end of the turn
  s = applyAction(s, { type: "move", from: at("g7"), to: at("f7") });
  assert.equal(s.players[1].tp, 1); // owns the Oracle at the beginning of the turn
  assert.ok(!isLegal(s, { type: "upgrade", at: at("d4") }));
});
