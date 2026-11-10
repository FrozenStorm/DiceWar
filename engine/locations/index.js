// Location tiles (optional variants). Each location lists the squares it
// occupies and may hook into the start or end of a turn.

import { sq } from "../board.js";
import { removeDie, gainVP } from "../core.js";

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

const LOCATIONS = { craters };

export const IMPLEMENTED_LOCATIONS = Object.keys(LOCATIONS);

export function getLocation(id) {
  const loc = LOCATIONS[id];
  if (!loc) throw new Error(`Location "${id}" is not implemented in the rules engine yet.`);
  return loc;
}
