// Location tiles (optional variants). Each location lists the squares it
// occupies and may hook into the start or end of a turn, and may forbid
// raising the Power Level of a creature (blocksRaise).

import { sq } from "../board.js";
import { removeDie, gainVP, gainTP, setLevel, exileFromReserve, defeat, emit } from "../core.js";
import { supplyRow, opponent, colOf, SIZE } from "../board.js";

/** RoX: The Craters. Rules: docs/rules/RoX.md, "Location: The Craters". */
const craters = {
  id: "craters",
  name: "The Craters",
  squares: [sq(2, 1), sq(4, 5)],
  onTurnStart(s, player) {
    // Both craters occupied by your creatures with Power Level 2+: gain 1 VP.
    const ok = this.squares.every((at) => {
      const d = s.board[at];
      return d && d.owner === player && d.level >= 2;
    });
    if (ok) gainVP(s, player, 1);
  },
  onTurnEnd(s) {
    // Creatures with Power Level 1 on a crater go back to the Reserve at the end of every turn.
    for (const at of this.squares) {
      const d = s.board[at];
      if (d && d.level === 1) removeDie(s, at, "reserve", "crater");
    }
  },
};

/** BoD: The Oracle. Rules: docs/rules/BoD.md, "Location: The Oracle". */
const oracle = {
  id: "oracle",
  name: "The Oracle",
  squares: [sq(3, 3)],
  onTurnStart(s, player) {
    // 1 additional TP at the beginning of your turn while you own the Oracle.
    const d = s.board[this.squares[0]];
    if (d && d.owner === player) gainTP(s, player, 1);
  },
  onTurnEnd(s, player) {
    // Your creature on the Oracle at the end of your turn rises or falls to 4.
    const at = this.squares[0];
    const d = s.board[at];
    if (d && d.owner === player && d.level !== 4) setLevel(s, at, 4);
  },
  // Card note "cannot raise Power Level": every action is allowed, but the
  // level is set back to 4 at the end of the turn anyway (BoD6, confirmed).
};

/** LoD: The Ruins. Rules: docs/rules/LoD.md, "Location: The Ruins". */
const ruins = {
  id: "ruins",
  name: "The Ruins",
  squares: [sq(1, 5), sq(3, 3), sq(5, 1)],
  // Creatures with Power Level 1 on a ruin go to the Reserve immediately.
  afterAction(s) {
    for (const at of this.squares) {
      const d = s.board[at];
      if (d && d.level === 1) removeDie(s, at, "reserve", "ruins");
    }
  },
  // Alternative victory: all ruins occupied by your creatures at the end of your turn.
  winsAtTurnEnd(s, player) {
    return this.squares.every((at) => s.board[at] && s.board[at].owner === player);
  },
};

/** RoM/KoS: The Camp. Rules: docs/rules/RoM.md, "Location: The Camp".
 *  Both players place a camp on a free field of their Supply Zone in the setup. */
const camp = {
  id: "camp",
  name: "The Camp",
  squares: [], // placed during the setup (s.camps)
  validateSetup(s, player, placements, extra) {
    const col = extra.camp;
    if (!Number.isInteger(col) || col < 0 || col > 6) return "Place your camp on a free field of your Supply Zone.";
    if (placements.some((p) => p.col === col)) return "The camp needs a free field.";
    return null;
  },
  onSetup(s, player, action) {
    const at = sq(supplyRow(player), action.camp);
    s.camps = { ...(s.camps || {}), [player]: at };
    s.tiles = [...s.tiles]; // tiles are shared between states
    s.tiles[at] = "camp";
  },
  // A creature moved into a camp: own camp -> back to the Reserve; opposing
  // camp -> into the own Exile, and the camp owner exiles as many Reserve Dice
  // as its Power Level (as far as possible).
  afterAction(s) {
    if (!s.camps) return;
    for (const ev of s.events) {
      if (ev.t !== "move") continue;
      const at = ev.path[ev.path.length - 1];
      const d = s.board[at];
      if (!d) continue;
      for (const owner of [1, 2]) {
        if (s.camps[owner] !== at) continue;
        if (d.owner === owner) removeDie(s, at, "reserve", "camp");
        else {
          removeDie(s, at, "exile", "camp");
          exileFromReserve(s, owner, Math.min(d.level, s.players[owner].reserve));
        }
      }
    }
  },
};

/** KoS: The Knoll. Rules: docs/rules/KoS.md, "Location: The Knoll". */
const knoll = {
  id: "knoll",
  name: "The Knoll",
  squares: [sq(2, 2), sq(2, 4), sq(4, 2), sq(4, 4)],
  // From a knoll a creature also defeats opposing creatures of the same Power Level.
  beats(s, from, att, def) {
    return this.squares.includes(from) && att.level === def.level ? true : undefined;
  },
};

/** DoA: The River. Rules: docs/rules/DoA.md, "Location: The River".
 *  The tile covers the three middle rows of one column (any column, DoA4);
 *  the flow always points to the right (seen from player 1). */
const RIVER_ROWS = [2, 3, 4];
const river = {
  id: "river",
  name: "The River",
  squares: RIVER_ROWS.map((r) => sq(r, 1)),
  squaresFor: (options) => RIVER_ROWS.map((r) => sq(r, options.riverCol ?? 1)),
  // At the end of each turn of the starting player, creatures on free fields
  // (no location tile) in the three middle rows are pushed 1 field downstream.
  onTurnEnd(s, player) {
    if (player !== s.startingPlayer) return;
    for (const r of RIVER_ROWS) {
      for (let c = SIZE - 1; c >= 0; c--) {
        const at = sq(r, c);
        if (s.board[at] && !s.tiles[at]) riverPush(s, at);
      }
    }
  },
};

/** Push the creature on `at` 1 field downstream. A creature in the way is
 *  pushed on first (e.g. one standing on a location tile). Over the edge it
 *  goes into Exile and the opponent of its owner receives its Power Level as
 *  VP, without Field Bonus (DoA5). Pushing is not a Movement: it also moves
 *  creatures that cannot move themselves. */
function riverPush(s, at) {
  const die = s.board[at];
  if (colOf(at) === SIZE - 1) {
    defeat(s, at, opponent(die.owner), { fieldBonus: false, cause: "river" });
    return;
  }
  const to = at + 1;
  if (s.board[to]) riverPush(s, to);
  if (s.board[to]) return; // cannot happen, kept as a safety net
  s.board[at] = null;
  s.board[to] = die;
  emit(s, { t: "move", path: [at, to] });
}

const LOCATIONS = { craters, oracle, ruins, camp, knoll, river };

export const IMPLEMENTED_LOCATIONS = Object.keys(LOCATIONS);

export function getLocation(id) {
  const loc = LOCATIONS[id];
  if (!loc) throw new Error(`Location "${id}" is not implemented in the rules engine yet.`);
  return loc;
}
