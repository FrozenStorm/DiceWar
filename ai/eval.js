// Static evaluation of a position for the AI, in "VP x 100" units.
//
// The evaluation is linear: a list of features (counts measured on the board)
// times their weights, own side minus the other side. General features apply to
// every set; each set adds the material value of its six creatures and may add
// its own features through the hook `evalTerms` of its set module:
//
//   evalTerms: { names: ["barrierSouls", ...], add(s, player, f, base, sign, own, n) }
//
// `add` adds sign * value to f[base + i] for its i-th name; own[0..n-1] are the
// squares of the player's dice. The weights of all
// features live in WEIGHTS under "name" (general) or "<set>.<name>" (set).
// tools/features.mjs extracts the same features for learning the weights.

import { actor, totalVP } from "../engine/core.js";
import { adjacent, SQUARES } from "../engine/board.js";
import { getLocation } from "../engine/locations/index.js";
import { getSet } from "../engine/sets/index.js";

/** Value of a won game. */
export const WIN = 1_000_000;

const SET_IDS = ["RoX", "BoD", "LoD", "RoM", "KoS", "DoA", "plain"];
const LEVEL_VALUE = [0, 20, 30, 45, 55, 65, 80];

// General features, measured for each side.
const GENERAL = [
  "vp", "tp", "reserve", "center", "advance", "fieldBonus", "nearPrey",
  "craterOne", "craterBoth", "oracle", "ruinHeld", "ruinThreatToMove", "ruinThreatOther",
  "toMove", "threatened", "ruinNear", "lateVP",
];

/** Names of all features, in the order of the feature vector. */
export const FEATURES = [...GENERAL];
const SET_BASE = {}, SET_END = {}; // set id -> range of its features
for (const id of SET_IDS) {
  SET_BASE[id] = FEATURES.length;
  for (let level = 1; level <= 6; level++) FEATURES.push(`${id}.L${level}`);
  for (const name of getSet(id).evalTerms?.names || []) FEATURES.push(`${id}.${name}`);
  SET_END[id] = FEATURES.length;
}
// Indices of the general features (constants: faster than a lookup by name).
const [VP, TP, RESERVE, CENTER, ADVANCE, FIELD_BONUS, NEAR_PREY, CRATER_ONE, CRATER_BOTH, ORACLE_HELD,
  RUIN_HELD, RUIN_THREAT_TO_MOVE, RUIN_THREAT_OTHER, TO_MOVE, THREATENED, RUIN_NEAR, LATE_VP] = GENERAL.keys();

/** Evaluation weights in "VP x 100" units. Threats are not rated here: the
 *  search plays captures out (quiescence) before it evaluates. */
export const WEIGHTS = {
  vp: 100, tp: 12, reserve: 3, center: 1, advance: 6, fieldBonus: 10, nearPrey: 12,
  craterOne: 35, craterBoth: 100, oracle: 40,
  // Ruins held (counted squared: 1, 4, 9).
  ruinHeld: 40,
  // Two Ruins held and the third one free next to an own creature (level 2+):
  // a win is one Movement away, for the player to move / for the other player.
  ruinThreatToMove: 500, ruinThreatOther: 120,
  toMove: 0, threatened: 0, ruinNear: 0, lateVP: 0,
};
for (const id of SET_IDS) {
  for (let level = 1; level <= 6; level++) WEIGHTS[`${id}.L${level}`] = LEVEL_VALUE[level];
  for (const name of getSet(id).evalTerms?.names || []) WEIGHTS[`${id}.${name}`] = 0;
}

const CRATERS = getLocation("craters").squares;
const RUINS = getLocation("ruins").squares;
const ORACLE = getLocation("oracle").squares[0];
const LATE_FROM_TURN = 60;

// Squares of the dice of both players, refilled for every evaluation.
const squaresOf = [null, new Int32Array(SQUARES), new Int32Array(SQUARES)];
const countOf = [0, 0, 0];
const features = new Float64Array(FEATURES.length);

/** Attacker level `a` defeats defender level `d` by the base hierarchy. */
const beatsLevel = (a, d) => (a > d && a >= 2) || (a === 3 && d === 6);

// Features that the evaluation can skip because their weight is 0 (set by
// evaluate for its weights; featureVector computes everything).
let skipThreatened = false, skipRuinNear = false, skipSetTerms = {};
const NO_SKIP = {};

/** Adds sign * (features of player p) to f. */
function addSide(s, p, toMove, f, sign) {
  const board = s.board;
  const pl = s.players[p];
  const o = 3 - p;
  const own = squaresOf[p], n = countOf[p], foes = squaresOf[o], m = countOf[o];
  const vp = totalVP(s, p);
  f[VP] += sign * vp;
  f[TP] += sign * pl.tp;
  f[RESERVE] += sign * pl.reserve;
  if (p === toMove) f[TO_MOVE] += sign;
  if (s.turnNumber > LATE_FROM_TURN) f[LATE_VP] += sign * vp * (s.turnNumber - LATE_FROM_TURN) / 100;
  const set = getSet(pl.set);
  const base = SET_BASE[set.id] - 1;
  let center = 0, advance = 0, fieldBonus = 0, nearPrey = 0, threatened = 0;
  for (let i = 0; i < n; i++) {
    const at = own[i];
    const level = board[at].level;
    const r = (at / 7) | 0, c = at % 7;
    f[base + level] += sign;
    center += 3 - Math.abs(3 - c) * 0.5;
    if (!skipThreatened) {
      const adj = adjacent(at);
      for (let k = 0; k < adj.length; k++) {
        const e = board[adj[k]];
        if (e && e.owner === o && beatsLevel(e.level, level)) { threatened++; break; }
      }
    }
    if (level >= 2) {
      // Pressure: advance into the opposing half, where defeats give the Field Bonus.
      advance += p === 1 ? 6 - r : r;
      fieldBonus += p === 1 ? (r <= 2 ? 3 - r : 0) : (r >= 4 ? r - 3 : 0);
      // Attack potential: weaker enemies close by.
      for (let k = 0; k < m; k++) {
        const e = foes[k];
        const dist = Math.abs(((e / 7) | 0) - r) + Math.abs((e % 7) - c);
        if (dist <= 2 && board[e].level < level) nearPrey++;
      }
    }
  }
  f[CENTER] += sign * center;
  f[ADVANCE] += sign * advance;
  f[FIELD_BONUS] += sign * fieldBonus;
  f[NEAR_PREY] += sign * nearPrey;
  f[THREATENED] += sign * threatened;
  const locations = s.locations;
  for (let i = 0; i < locations.length; i++) {
    switch (locations[i]) {
      case "craters": {
        // Craters give 1 VP every turn while both are held with level 2+.
        let held = 0;
        for (const at of CRATERS) { const d = board[at]; if (d && d.owner === p && d.level >= 2) held++; }
        f[CRATER_ONE] += sign * held;
        if (held === 2) f[CRATER_BOTH] += sign;
        break;
      }
      case "ruins": {
        // Holding all Ruins at the end of the own turn wins the game.
        let held = 0, open = -1, near = 0;
        for (const at of RUINS) {
          const d = board[at];
          if (d && d.owner === p) { held++; continue; }
          if (!d) open = at;
          if (skipRuinNear) continue;
          const adj = adjacent(at);
          for (let k = 0; k < adj.length; k++) {
            const x = board[adj[k]];
            if (x && x.owner === p && x.level >= 2) { near++; break; }
          }
        }
        f[RUIN_HELD] += sign * held * held;
        f[RUIN_NEAR] += sign * near;
        if (held === RUINS.length - 1 && open >= 0) {
          const adj = adjacent(open);
          for (let k = 0; k < adj.length; k++) {
            const d = board[adj[k]];
            if (d && d.owner === p && d.level >= 2 && !RUINS.includes(adj[k])) {
              f[toMove === p ? RUIN_THREAT_TO_MOVE : RUIN_THREAT_OTHER] += sign;
              break;
            }
          }
        }
        break;
      }
      case "oracle": {
        // The Oracle gives 1 TP per turn and sets its occupant to level 4.
        const d = board[ORACLE];
        if (d && d.owner === p) f[ORACLE_HELD] += sign;
        break;
      }
    }
  }
  if (set.evalTerms && !skipSetTerms[set.id]) set.evalTerms.add(s, p, f, base + 7, sign, own, n);
}

/** Fills `f` with the features of state `s` from the point of view of `me`
 *  (own minus other side). Returns f. */
export function featureVector(s, me, f = new Float64Array(FEATURES.length)) {
  skipThreatened = skipRuinNear = false;
  skipSetTerms = NO_SKIP;
  return fillFeatures(s, me, f);
}

function fillFeatures(s, me, f) {
  f.fill(0);
  const board = s.board;
  let n1 = 0, n2 = 0;
  for (let i = 0; i < SQUARES; i++) {
    const d = board[i];
    if (d) { if (d.owner === 1) squaresOf[1][n1++] = i; else squaresOf[2][n2++] = i; }
  }
  countOf[1] = n1; countOf[2] = n2;
  const toMove = s.pending.length ? actor(s) : s.current;
  addSide(s, me, toMove, f, 1);
  addSide(s, 3 - me, toMove, f, -1);
  return f;
}

// Weight vector of the last weight object (a search uses one object throughout),
// and which features it can skip because their weight is 0.
let lastWeights = null, weightVector = null, skips = null;
function vectorOf(W) {
  if (W !== lastWeights) {
    weightVector = Float64Array.from(FEATURES, (name) => W[name] ?? WEIGHTS[name]);
    lastWeights = W;
    const sets = {};
    for (const id of SET_IDS) {
      let zero = true;
      for (let i = SET_BASE[id] + 6; i < SET_END[id]; i++) if (weightVector[i] !== 0) zero = false;
      sets[id] = zero;
    }
    skips = { threatened: weightVector[THREATENED] === 0, ruinNear: weightVector[RUIN_NEAR] === 0, sets };
  }
  skipThreatened = skips.threatened;
  skipRuinNear = skips.ruinNear;
  skipSetTerms = skips.sets;
  return weightVector;
}

/** Static evaluation of state `s` from the point of view of `me`. */
export function evaluate(s, me, W = WEIGHTS) {
  if (s.phase === "over") {
    const w = s.result.winner;
    return w === 0 ? 0 : w === me ? WIN : -WIN;
  }
  const w = vectorOf(W);
  const f = fillFeatures(s, me, features);
  let v = 0;
  for (let i = 0; i < GENERAL.length; i++) v += w[i] * f[i];
  // Only the features of the two sets in play can be non-zero.
  const a = s.players[1].set, b = s.players[2].set;
  for (let i = SET_BASE[a], end = SET_END[a]; i < end; i++) v += w[i] * f[i];
  if (b !== a) for (let i = SET_BASE[b], end = SET_END[b]; i < end; i++) v += w[i] * f[i];
  return v;
}
