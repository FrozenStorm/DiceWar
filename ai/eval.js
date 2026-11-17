// Static evaluation of a position for the AI, in "VP x 100" units.

import { actor, totalVP } from "../engine/core.js";
import { adjacent, SQUARES } from "../engine/board.js";
import { getLocation } from "../engine/locations/index.js";

/** Value of a won game. */
export const WIN = 1_000_000;

const LEVEL_VALUE = [0, 20, 30, 45, 55, 65, 80];

/** Evaluation weights in "VP x 100" units. Threats are not rated here: the
 *  search plays captures out (quiescence) before it evaluates. */
export const WEIGHTS = {
  tp: 12, reserve: 3, advance: 6, fieldBonus: 10, nearPrey: 12,
  craterOne: 35, craterBoth: 100, oracle: 40, ruin: 40,
  // Two Ruins held and the third one free next to an own creature (level 2+):
  // a win is one Movement away, for the player to move / for the other player.
  ruinThreatToMove: 500, ruinThreatOther: 120,
};

const CRATERS = getLocation("craters").squares;
const RUINS = getLocation("ruins").squares;
const ORACLE = getLocation("oracle").squares[0];

// Squares of the dice of both players, refilled for every evaluation.
const squaresOf = [null, new Int32Array(SQUARES), new Int32Array(SQUARES)];
const countOf = [0, 0, 0];

function sideValue(s, p, W, toMove) {
  const board = s.board;
  const pl = s.players[p];
  const o = 3 - p;
  const own = squaresOf[p], n = countOf[p], foes = squaresOf[o], m = countOf[o];
  let v = 100 * totalVP(s, p) + W.tp * pl.tp + W.reserve * pl.reserve;
  for (let i = 0; i < n; i++) {
    const at = own[i];
    const level = board[at].level;
    const r = (at / 7) | 0, c = at % 7;
    v += LEVEL_VALUE[level] + 3 - Math.abs(3 - c) * 0.5; // material, central columns
    if (level >= 2) {
      // Pressure: advance into the opposing half, where defeats give the Field Bonus.
      const advanced = p === 1 ? 6 - r : r;
      const bonus = p === 1 ? (r <= 2 ? 3 - r : 0) : (r >= 4 ? r - 3 : 0);
      v += W.advance * advanced + W.fieldBonus * bonus;
      // Attack potential: weaker enemies close by.
      for (let k = 0; k < m; k++) {
        const e = foes[k];
        const dist = Math.abs(((e / 7) | 0) - r) + Math.abs((e % 7) - c);
        if (dist <= 2 && board[e].level < level) v += W.nearPrey;
      }
    }
  }
  const locations = s.locations;
  for (let i = 0; i < locations.length; i++) {
    switch (locations[i]) {
      case "craters": {
        // Craters give 1 VP every turn while both are held with level 2+.
        let held = 0;
        for (const at of CRATERS) { const d = board[at]; if (d && d.owner === p && d.level >= 2) held++; }
        v += W.craterOne * held + (held === 2 ? W.craterBoth : 0);
        break;
      }
      case "ruins": {
        // Holding all Ruins at the end of the own turn wins the game.
        let held = 0, open = -1;
        for (const at of RUINS) { const d = board[at]; if (d && d.owner === p) held++; else if (!d) open = at; }
        v += W.ruin * held * held;
        if (held === RUINS.length - 1 && open >= 0) {
          const adj = adjacent(open);
          for (let k = 0; k < adj.length; k++) {
            const d = board[adj[k]];
            if (d && d.owner === p && d.level >= 2 && !RUINS.includes(adj[k])) {
              v += toMove === p ? W.ruinThreatToMove : W.ruinThreatOther;
              break;
            }
          }
        }
        break;
      }
      case "oracle": {
        // The Oracle gives 1 TP per turn and sets its occupant to level 4.
        const d = board[ORACLE];
        if (d && d.owner === p) v += W.oracle;
        break;
      }
    }
  }
  return v;
}

/** Static evaluation of state `s` from the point of view of `me`. */
export function evaluate(s, me, W = WEIGHTS) {
  if (s.phase === "over") {
    const w = s.result.winner;
    return w === 0 ? 0 : w === me ? WIN : -WIN;
  }
  const board = s.board;
  let n1 = 0, n2 = 0;
  for (let i = 0; i < SQUARES; i++) {
    const d = board[i];
    if (d) { if (d.owner === 1) squaresOf[1][n1++] = i; else squaresOf[2][n2++] = i; }
  }
  countOf[1] = n1; countOf[2] = n2;
  const toMove = s.pending.length ? actor(s) : s.current;
  return sideValue(s, me, W, toMove) - sideValue(s, 3 - me, W, toMove);
}
