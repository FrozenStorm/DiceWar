// Several location tiles in the same game (Daniel, 2026-11-12): every
// combination is allowed, a field can carry up to three tiles, the River is
// resolved first, and the Ruins also act on creatures washed onto them.
import test from "node:test";
import assert from "node:assert/strict";
import { createGame, applyAction } from "../engine/core.js";
import { IMPLEMENTED_LOCATIONS } from "../engine/locations/index.js";
import { position, at } from "./helpers.js";

const DOA = { set1: "DoA", set2: "DoA" };

test("Locations: all landscapes can be combined; shared fields keep every tile", () => {
  const g = createGame({ set1: "RoX", set2: "BoD", locations: ["knoll", "ruins", "oracle", "craters", "camp", "river"], riverCol: 3 });
  assert.deepEqual(g.locations, ["river", "craters", "oracle", "ruins", "camp", "knoll"], "River first, then the fixed order");
  assert.deepEqual(g.tiles[at("d4")], ["river", "oracle", "ruins"], "centre field: three tiles");
  assert.deepEqual(g.tiles[at("d5")], ["river"]);
  assert.deepEqual(g.tiles[at("c5")], ["knoll"]);
  assert.deepEqual(g.tiles[at("b5")], ["craters"]);
  assert.equal(g.tiles[at("a4")], null);
  assert.deepEqual(createGame({ set1: "RoX", set2: "RoX", locations: ["river", "craters"] }).tiles[at("b5")], ["river", "craters"]);
  assert.deepEqual(IMPLEMENTED_LOCATIONS.length, 6);
});

test("Locations: duplicate ids are ignored", () => {
  const g = createGame({ set1: "RoX", set2: "RoX", locations: ["ruins", "ruins"] });
  assert.deepEqual(g.locations, ["ruins"]);
  assert.deepEqual(g.tiles[at("d4")], ["ruins"]);
});

test("Locations: a level-1 creature washed onto a ruin goes to the Reserve immediately", () => {
  let s = position(["......f", ".......", ".......", "..1....", ".......", ".......", "6......"], { ...DOA, locations: ["ruins", "river"] });
  const reserve = s.players[1].reserve;
  s = applyAction(s, { type: "move", from: at("a1"), to: at("b1") });
  assert.equal(s.board[at("c4")], null);
  assert.equal(s.board[at("d4")], null, "washed onto the ruin and removed");
  assert.equal(s.players[1].reserve, reserve + 1);
});

test("Locations: the River flows before the Craters check their level-1 creatures", () => {
  // River in column b also covers crater A (b5).
  let s = position(["......f", ".......", "1......", ".......", ".......", ".......", "6......"], { ...DOA, locations: ["craters", "river"] });
  const reserve = s.players[1].reserve;
  s = applyAction(s, { type: "move", from: at("a1"), to: at("b1") });
  assert.equal(s.board[at("a5")], null);
  assert.equal(s.board[at("b5")], null, "washed onto the crater and returned in the same turn");
  assert.equal(s.players[1].reserve, reserve + 1);
});

test("Locations: Oracle and Ruin on the centre field both apply", () => {
  let s = position(["......f", ".......", ".......", ".......", "...3...", ".......", "......."], { set1: "RoX", set2: "RoX", locations: ["oracle", "ruins"] });
  s = applyAction(s, { type: "move", from: at("d3"), to: at("d4") });
  assert.equal(s.board[at("d4")].level, 4, "Oracle sets the creature to 4");
});
