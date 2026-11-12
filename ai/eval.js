// Static evaluation of a position for the AI, in "VP x 100" units.

import { actor, totalVP, diceOf, standardAttacks } from "../engine/core.js";
import { opponent, fieldBonus, rowOf, colOf, SQUARES } from "../engine/board.js";
import { getLocation } from "../engine/locations/index.js";

/** Value of a won game. */
export const WIN = 1_000_000;

/** Evaluation weights in "VP x 100" units. */
export const DEFAULT_WEIGHTS = {
  tp: 12, reserve: 3, advance: 6, fieldBonus: 10, nearPrey: 12,
  craterOne: 35, craterBoth: 100, oracle: 40, ruin: 40, threatToMove: 70, threatOther: 20,
};
const LEVEL_VALUE = [0, 20, 30, 45, 55, 65, 80];

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** Best VP gain of a standard attack available to `p` right now. */
function bestCapture(s, p) {
  let best = 0;
  for (const from of diceOf(s, p)) {
    for (const to of standardAttacks(s, from)) {
      const v = s.board[to].level + fieldBonus(p, to);
      if (v > best) best = v;
    }
  }
  return best;
}

function sideValue(s, p, W) {
  const pl = s.players[p];
  let v = 100 * totalVP(s, p) + W.tp * pl.tp + W.reserve * pl.reserve;
  const enemies = diceOf(s, opponent(p));
  for (const at of diceOf(s, p)) {
    const d = s.board[at];
    v += LEVEL_VALUE[d.level];
    const c = colOf(at), r = rowOf(at);
    v += 3 - Math.abs(3 - c) * 0.5; // central columns
    if (d.level >= 2) {
      // Pressure: advance into the opposing half, where defeats give the Field Bonus.
      const advanced = p === 1 ? 6 - r : r;
      v += W.advance * advanced + W.fieldBonus * fieldBonus(p, at);
      // Attack potential: weaker enemies close by.
      for (const e of enemies) {
        const dist = Math.abs(rowOf(e) - r) + Math.abs(colOf(e) - c);
        if (dist <= 2 && s.board[e].level < d.level) v += W.nearPrey;
      }
    }
  }
  if (s.locations.includes("craters")) {
    // Craters give 1 VP every turn while both are held with level 2+.
    const held = getLocation("craters").squares
      .filter((at) => s.board[at] && s.board[at].owner === p && s.board[at].level >= 2).length;
    v += W.craterOne * held + (held === 2 ? W.craterBoth : 0);
  }
  if (s.locations.includes("ruins")) {
    // Holding all Ruins at the end of the own turn wins the game.
    const held = getLocation("ruins").squares.filter((at) => s.board[at] && s.board[at].owner === p).length;
    v += W.ruin * held * held;
  }
  if (s.locations.includes("oracle")) {
    // The Oracle gives 1 TP per turn and sets its occupant to level 4.
    const d = s.board[getLocation("oracle").squares[0]];
    if (d && d.owner === p) v += W.oracle;
  }
  return v;
}

/** Static evaluation of state `s` from the point of view of `me`. */
export function evaluate(s, me, W = DEFAULT_WEIGHTS) {
  if (s.phase === "over") {
    const w = s.result.winner;
    return w === 0 ? 0 : w === me ? WIN : -WIN;
  }
  const opp = opponent(me);
  let v = sideValue(s, me, W) - sideValue(s, opp, W);
  // Threats: the side to move can cash in its best capture, the other side less likely.
  const toMove = s.pending.length ? actor(s) : s.current;
  const mine = bestCapture(s, me), theirs = bestCapture(s, opp);
  v += toMove === me ? W.threatToMove * mine - W.threatOther * theirs : W.threatOther * mine - W.threatToMove * theirs;
  return v;
}

// ---------------------------------------------------------------------------
// Expert level
// ---------------------------------------------------------------------------

/** Evaluation weights of the expert level. Threats are not rated here: the
 *  expert search plays captures out (quiescence) before it evaluates. */
export const EXPERT_WEIGHTS = {
  tp: 12, reserve: 3, advance: 6, fieldBonus: 10, nearPrey: 12,
  craterOne: 35, craterBoth: 100, oracle: 40, ruin: 40,
};

const CRATERS = getLocation("craters").squares;
const RUINS = getLocation("ruins").squares;
const ORACLE = getLocation("oracle").squares[0];

// Squares of the dice of both players, refilled for every evaluation.
const squaresOf = [null, new Int32Array(SQUARES), new Int32Array(SQUARES)];
const countOf = [0, 0, 0];

function expertSide(s, p, W) {
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
        let held = 0;
        for (const at of RUINS) { const d = board[at]; if (d && d.owner === p) held++; }
        v += W.ruin * held * held;
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

/** Static evaluation of state `s` from the point of view of `me` (expert level). */
export function evaluateExpert(s, me, W = EXPERT_WEIGHTS) {
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
  return expertSide(s, me, W) - expertSide(s, 3 - me, W);
}
