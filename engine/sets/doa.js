// Dice set DoA (Dawn of Awakening). Rules: docs/rules/DoA.md

import {
  adjacent, surrounding, step, rowOf, colOf, sq, SQUARES, SURROUND, onBoard, inOwnZone, opponent,
} from "../board.js";
import {
  diceOf, countLevel, placeDie, removeDie, setLevel, gainTP, exileFromReserve, pushChoice,
  relocate, defeat, defaultBeats, canMove, canRaise, isProtected, standardMoves, emit,
  finishMoveOrAttack, MAX_LEVEL,
  canPlace,
} from "../core.js";

const FISHER = 1, DREAM = 2, WATCH = 3, WEAVER = 4, OHTILIA = 5, AWAKENING = 6;
const SINT_FLUT_TP = 10;
const DIR_LABELS = ["↑", "→", "↓", "←"];

const A = {
  godcatcher: "DoA.fisher.godcatcher",
  waterPath: "DoA.dreambringer.water_path",
  waveRide: "DoA.riverwatch.wave_ride",
  ghostCall: "DoA.weaver.ghost_call",
  threadOfFate: "DoA.weaver.thread_of_fate",
  fromTheFog: "DoA.ohtilia.from_the_fog",
  newBeginning: "DoA.awakening.new_beginning",
  sintFlut: "DoA.awakening.sint_flut",
};

const empty = (s, at) => at >= 0 && !s.board[at];
const isOwn = (s, at, player, level) => {
  const d = s.board[at];
  return !!d && d.owner === player && (level === undefined || d.level === level);
};
const raisable = (s, at) => s.board[at].level < MAX_LEVEL && canRaise(s, at);

/** Step in one of the 8 directions (SURROUND deltas), -1 off the board. */
function step8(at, [dr, dc]) {
  const r = rowOf(at) + dr, c = colOf(at) + dc;
  return onBoard(r, c) ? sq(r, c) : -1;
}

// --- Tidal Fisher -----------------------------------------------------------------------

/** DoA.fisher.godcatcher: options while more than 3 own Fishers are in the
 *  Warlands: one Fisher to the Reserve, and (if possible) +1 for a friendly
 *  creature in the own zone. */
function godcatcherOptions(s, player) {
  const fishers = diceOf(s, player, FISHER);
  if (fishers.length <= 3) return [];
  const out = [];
  for (const remove of fishers) {
    const targets = diceOf(s, player).filter((t) => t !== remove && inOwnZone(player, t) && raisable(s, t));
    if (!targets.length) out.push({ type: "choice", kind: A.godcatcher, remove });
    for (const upgrade of targets) out.push({ type: "choice", kind: A.godcatcher, remove, upgrade });
  }
  return out;
}

// --- Dream Bringer -------------------------------------------------------------------------

/** DoA.dreambringer.water_path: straight in any of the 8 directions, up to 3
 *  free fields, no attack. (1 field orthogonally is the standard Movement.) */
function waterPathActions(s, from) {
  const out = [];
  for (const delta of SURROUND) {
    const ortho = delta[0] === 0 || delta[1] === 0;
    let at = from;
    for (let n = 1; n <= 3; n++) {
      at = step8(at, delta);
      if (!empty(s, at)) break;
      if (n === 1 && ortho) continue;
      out.push({ type: "move", ability: A.waterPath, from, to: at, n, delta });
    }
  }
  return out;
}

/** Is the creature on `at` next to an opposing Dream Bringer (World Sleep)? */
function asleep(s, at) {
  const d = s.board[at];
  return !!d && surrounding(at).some((n) => {
    const o = s.board[n];
    return o && o.owner !== d.owner && o.level === DREAM && s.players[o.owner].set === "DoA";
  });
}

// --- River Watch ------------------------------------------------------------------------------

/** DoA.riverwatch.wave_ride: any distance over free fields (orthogonal steps)
 *  that surround friendly creatures; ends on such a field, not the start. */
function waveRideActions(s, from) {
  const player = s.board[from].owner;
  const ring = new Set();
  for (const f of diceOf(s, player)) {
    if (f === from) continue;
    for (const n of surrounding(f)) if (empty(s, n) || n === from) ring.add(n);
  }
  if (!ring.has(from)) return [];
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    for (const n of adjacent(at)) {
      if (prev.has(n) || !ring.has(n) || !empty(s, n)) continue;
      prev.set(n, at);
      queue.push(n);
    }
  }
  const out = [];
  for (const to of prev.keys()) {
    if (to === from || adjacent(from).includes(to)) continue; // 1 field = standard Movement
    const path = [];
    for (let at = to; at !== null; at = prev.get(at)) path.unshift(at);
    out.push({ type: "move", ability: A.waveRide, from, to, path });
  }
  return out;
}

// --- Water Weaver ----------------------------------------------------------------------------

/** DoA.weaver.ghost_call: a River Watch next to the Weaver and a Tidal Fisher
 *  next to that one (or the reverse); the Weaver goes back to the Reserve. */
function ghostCallActions(s, at) {
  const player = s.board[at].owner;
  if (s.players[player].reserve < 2) return [];
  const out = [];
  const seen = new Set();
  for (const first of adjacent(at)) {
    if (!canPlace(s, first)) continue;
    for (const second of adjacent(first)) {
      if (second === at || !canPlace(s, second)) continue;
      for (const [watch, fisher] of [[first, second], [second, first]]) {
        const key = `${watch},${fisher}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ type: "spell", ability: A.ghostCall, at, watch, fisher });
      }
    }
  }
  return out;
}

/** DoA.weaver.thread_of_fate: exile 1 Reserve Die, 2 TP; a surrounding
 *  opposing creature +-1 and a surrounding friendly creature the reverse. */
function threadActions(s, at) {
  const player = s.board[at].owner;
  const p = s.players[player];
  if (p.reserve < 1 || p.tp < 2) return [];
  const around = surrounding(at);
  const foes = around.filter((n) => s.board[n] && s.board[n].owner !== player && !isProtected(s, n, "spell"));
  const friends = around.filter((n) => isOwn(s, n, player));
  const out = [];
  for (const foe of foes) {
    for (const delta of [-1, 1]) {
      if (delta > 0 && !raisable(s, foe)) continue;
      for (const friend of friends) {
        if (delta < 0 && !raisable(s, friend)) continue;
        out.push({ type: "spell", ability: A.threadOfFate, at, foe, delta, friend });
      }
    }
  }
  return out;
}

// --- Ohtilia ------------------------------------------------------------------------------------

/** DoA.ohtilia.from_the_fog: swap with an adjacent creature, then a standard
 *  Movement if possible (mandatory; DoA3). */
function fogActions(s, from) {
  const me = s.board[from];
  const out = [];
  for (const swap of adjacent(from)) {
    const d = s.board[swap];
    if (!d) continue;
    if (d.owner !== me.owner && (!canMove(s, swap) || isProtected(s, swap, "speciality"))) continue;
    const t = { ...s, board: [...s.board] };
    t.board[from] = d;
    t.board[swap] = me;
    const moves = standardMoves(t, swap);
    if (!moves.length) out.push({ type: "move", ability: A.fromTheFog, from, swap });
    for (const to of moves) out.push({ type: "move", ability: A.fromTheFog, from, swap, to });
  }
  return out;
}

function applyFog(s, a) {
  const me = s.board[a.from], other = s.board[a.swap];
  s.board[a.from] = other;
  s.board[a.swap] = me;
  emit(s, { t: "move", path: [a.swap, a.from] });
  if (a.to !== undefined) {
    s.board[a.swap] = null;
    s.board[a.to] = me;
    emit(s, { t: "move", path: [a.from, a.swap, a.to] });
  } else {
    emit(s, { t: "move", path: [a.from, a.swap] });
  }
  s.turn.movedDieId = me.id;
  finishMoveOrAttack(s, a.to !== undefined ? a.to : a.swap);
}

// --- Awakening ---------------------------------------------------------------------------------

/** DoA.awakening.twilight_hour: does the Awakening on `at` see a friendly
 *  Awakening in an open horizontal or vertical line (at least 1 free field between)? */
function twilight(s, at, player) {
  for (let d = 0; d < 4; d++) {
    let n = step(at, d), gap = 0;
    while (n >= 0 && !s.board[n]) { gap++; n = step(n, d); }
    if (n >= 0 && gap >= 1 && isOwn(s, n, player, AWAKENING)) return true;
  }
  return false;
}

function freeFields(s) {
  const out = [];
  for (let at = 0; at < SQUARES; at++) if (canPlace(s, at)) out.push(at);
  return out;
}

function newBeginningActions(s, at) {
  const player = s.board[at].owner;
  if (s.players[player].reserve < 3 || freeFields(s).length < 3) return [];
  return [{ type: "spell", ability: A.newBeginning, at }];
}

function sintFlutActions(s, at) {
  const player = s.board[at].owner;
  const p = s.players[player];
  if (p.reserve < 1 || p.tp < SINT_FLUT_TP) return [];
  return [0, 1, 2, 3].map((dir) => ({ type: "spell", ability: A.sintFlut, at, dir }));
}

/** DoA.awakening.sint_flut: all opposing creatures are pushed 1 field in
 *  direction `dir`, front first. Pushing is not a Movement, so it also moves
 *  creatures that cannot move and ignores immunities (Daniel, 2026-11-11).
 *  Own creatures block (and so do the opposing creatures stuck behind them).
 *  Over the edge: defeated, 1 VP each, no Field Bonus. */
function applySintFlut(s, player, dir) {
  const foe = opponent(player);
  const key = (at) => [-rowOf(at), colOf(at), rowOf(at), -colOf(at)][dir];
  const dice = diceOf(s, foe).sort((x, y) => key(y) - key(x)); // front first
  for (const at of dice) {
    if (!s.board[at]) continue;
    const to = step(at, dir);
    if (to < 0) {
      defeat(s, at, player, { vp: 1, fieldBonus: false, cause: "sint_flut" });
    } else if (!s.board[to]) {
      relocate(s, [at, to]);
    }
  }
}

// --- Set definition -----------------------------------------------------------------------------

export const DoA = {
  id: "DoA",
  name: "Dawn of Awakening",
  creatures: {
    1: "Tidal Fisher", 2: "Dream Bringer", 3: "River Watch",
    4: "Water Weaver", 5: "Ohtilia", 6: "Awakening",
  },

  // DoA.fisher.rest_breaker: attacking, a Tidal Fisher has the Power Level of
  // the number of own Tidal Fishers in the Warlands (1: nobody, 2: 1,
  // 3: 1, 2 and 6, 4: 1, 2 and 3).
  beats(s, from, att, def) {
    if (att.level !== FISHER) return undefined;
    const n = Math.max(1, countLevel(s, att.owner, FISHER));
    return defaultBeats(Math.min(n, MAX_LEVEL), def.level);
  },

  // DoA.dreambringer.world_sleep: opposing creatures next to a Dream Bringer cast no spells.
  constrainOpponent(s, player, actions) {
    return actions.filter((a) => a.type !== "spell" || !asleep(s, a.at !== undefined ? a.at : a.from));
  },

  extraActions(s, player) {
    const out = [];
    for (const at of diceOf(s, player)) {
      switch (s.board[at].level) {
        case DREAM: if (canMove(s, at)) out.push(...waterPathActions(s, at)); break;
        case WATCH: if (canMove(s, at)) out.push(...waveRideActions(s, at)); break;
        case WEAVER: out.push(...ghostCallActions(s, at), ...threadActions(s, at)); break;
        case OHTILIA: if (canMove(s, at)) out.push(...fogActions(s, at)); break;
        case AWAKENING: out.push(...newBeginningActions(s, at), ...sintFlutActions(s, at)); break;
      }
    }
    return out;
  },

  applyAbility(s, a) {
    const player = s.current;
    switch (a.ability) {
      case A.waterPath: {
        const path = [a.from];
        for (let i = 0; i < a.n; i++) path.push(step8(path[path.length - 1], a.delta));
        const die = relocate(s, path);
        s.turn.movedDieId = die.id;
        finishMoveOrAttack(s, a.to);
        break;
      }
      case A.waveRide: {
        const die = relocate(s, a.path);
        s.turn.movedDieId = die.id;
        finishMoveOrAttack(s, a.to);
        break;
      }
      case A.ghostCall:
        placeDie(s, a.watch, player, WATCH);
        placeDie(s, a.fisher, player, FISHER);
        removeDie(s, a.at, "reserve", "split");
        break;
      case A.threadOfFate:
        exileFromReserve(s, player, 1);
        gainTP(s, player, -2);
        setLevel(s, a.foe, s.board[a.foe].level + a.delta, { byPlayer: player });
        if (s.board[a.friend]) {
          // Below level 1 also a friendly creature goes into the Exile (Daniel, 2026-11-11, for now).
          const level = s.board[a.friend].level - a.delta;
          if (level < 1) removeDie(s, a.friend, "exile", "downgrade");
          else setLevel(s, a.friend, level);
        }
        break;
      case A.fromTheFog:
        applyFog(s, a);
        break;
      case A.newBeginning:
        pushChoice(s, player, A.newBeginning, { at: a.at, left: 3 });
        break;
      case A.sintFlut:
        exileFromReserve(s, player, 1);
        gainTP(s, player, -SINT_FLUT_TP);
        applySintFlut(s, player, a.dir);
        break;
      default:
        throw new Error(`Unknown DoA ability: ${a.ability}`);
    }
  },

  // DoA.dreambringer.depth_rapture: 2 TP when a Dream Bringer is defeated.
  onDefeated(s, at, die) {
    if (die.level === DREAM) gainTP(s, die.owner, 2);
  },

  // DoA.weaver.water_pearls: losing the last Water Weaver costs 1 TP.
  onLeave(s, at, die) {
    if (die.level === WEAVER && countLevel(s, die.owner, WEAVER) === 0) gainTP(s, die.owner, -1);
  },
  onLevelChange(s, at, die, oldLevel) {
    if (oldLevel === WEAVER && countLevel(s, die.owner, WEAVER) === 0) gainTP(s, die.owner, -1);
  },

  // DoA.weaver.water_pearls: +1 TP at the start of the own turn with a Water Weaver (DoA2).
  onTurnStart(s, player) {
    if (countLevel(s, player, WEAVER) > 0) gainTP(s, player, 1);
  },

  // DoA.fisher.godcatcher: at the end of the turn, while more than 3 Fishers.
  beforeTurnEnd(s, player) {
    if (godcatcherOptions(s, player).length) pushChoice(s, player, A.godcatcher);
  },

  choiceOptions(s, pending) {
    switch (pending.kind) {
      case A.godcatcher:
        return godcatcherOptions(s, pending.player);
      case A.newBeginning:
        if (s.players[pending.player].reserve < 1) return [];
        return freeFields(s).map((place) => ({ type: "choice", kind: A.newBeginning, place }));
      default:
        return [];
    }
  },

  resolveChoice(s, pending, a) {
    const player = pending.player;
    switch (pending.kind) {
      case A.godcatcher:
        removeDie(s, a.remove, "reserve", "godcatcher");
        if (a.upgrade !== undefined && s.board[a.upgrade]) setLevel(s, a.upgrade, s.board[a.upgrade].level + 1);
        break;
      case A.newBeginning: {
        placeDie(s, a.place, player, FISHER);
        const left = pending.data.left - 1;
        const { at } = pending.data;
        if (left > 0 && s.players[player].reserve > 0 && freeFields(s).length) {
          pushChoice(s, player, A.newBeginning, { ...pending.data, left });
        } else if (isOwn(s, at, player, AWAKENING)) {
          setLevel(s, at, WATCH);
        }
        break;
      }
      default:
        throw new Error(`Unknown DoA choice: ${pending.kind}`);
    }
  },

  // DoA.awakening.twilight_hour: 1 virtual VP per Awakening in an open line to another.
  virtualVP: (s, player) => diceOf(s, player, AWAKENING).filter((at) => twilight(s, at, player)).length,

  aiGreedyChoices: [A.godcatcher, A.newBeginning],

  actionPath(a) {
    switch (a.ability || a.kind) {
      case A.waterPath: return [a.from, a.to];
      case A.waveRide: return [a.from, a.to];
      case A.ghostCall: return [a.at, "Ghost Call", a.watch, a.fisher];
      case A.threadOfFate: return [a.at, "Thread of Fate", a.foe, a.delta > 0 ? "Opponent +1, own −1" : "Opponent −1, own +1", a.friend];
      case A.fromTheFog: return a.to !== undefined ? [a.from, "From the Fog", a.swap, a.to] : [a.from, "From the Fog", a.swap];
      case A.newBeginning: return a.place !== undefined ? [a.place] : [a.at, "New Beginning"];
      case A.sintFlut: return [a.at, "Sint Flut", `Flood ${DIR_LABELS[a.dir]}`];
      case A.godcatcher: return a.upgrade !== undefined ? [a.remove, a.upgrade] : [a.remove];
      default: throw new Error(`No click path for ${a.ability || a.kind}`);
    }
  },

  pendingPrompt(p) {
    switch (p.kind) {
      case A.godcatcher: return "Godcatcher: choose a Tidal Fisher to return to the Reserve, then a friendly creature in your zone to upgrade.";
      case A.newBeginning: return `New Beginning: place a Tidal Fisher on any empty field (${p.data.left} left).`;
      default: return "Make a choice.";
    }
  },

  stepHint(ability, index) {
    const hints = {
      [A.ghostCall]: { 2: "Field of the River Watch.", 3: "Field of the Tidal Fisher." },
      [A.threadOfFate]: { 2: "Choose a surrounding opposing creature.", 4: "Choose a surrounding friendly creature." },
      [A.fromTheFog]: { 2: "Choose the adjacent creature to swap with.", 3: "Standard Movement after the swap." },
      [A.sintFlut]: { 2: "Choose the direction of the flood." },
    };
    return hints[ability] && hints[ability][index];
  },
};

