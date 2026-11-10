// Location tiles (optional variants). Each location lists the squares it
// occupies and may hook into the start or end of a turn, and may forbid
// raising the Power Level of a creature (blocksRaise).

import { sq } from "../board.js";
import { removeDie, gainVP, gainTP, setLevel } from "../core.js";

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

const LOCATIONS = { craters, oracle };

export const IMPLEMENTED_LOCATIONS = Object.keys(LOCATIONS);

export function getLocation(id) {
  const loc = LOCATIONS[id];
  if (!loc) throw new Error(`Location "${id}" is not implemented in the rules engine yet.`);
  return loc;
}
