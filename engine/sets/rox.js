// Dice set RoX (Rise of Xeladron). Rules: docs/rules/RoX.md

import { adjacent, diagonal, surrounding, inOwnZone, SQUARES } from "../board.js";
import {
  diceOf, countLevel, placeDie, removeDie, defeat, setLevel, gainTP, exileFromReserve,
  pushChoice, doMove, canDefeatWith, finishMoveOrAttack, canMove, gainVP, canRaise, emit, relocate,
} from "../core.js";

const PORTAL = 1, BEARER = 2, GUARDIAN = 3, EMISSARY = 4, ENCHANTRESS = 5, XELADRON = 6;

const A = {
  aerial: "RoX.bearer.aerial_maneuver",
  wormhole: "RoX.portal.wormhole",
  newPaths: "RoX.guardian.new_paths",
  summoning: "RoX.emissary.dimensional_summoning",
  decay: "RoX.xeladron.decay",
  impact: "RoX.xeladron.impact",
  balance: "RoX.bearer.balance",
  attraction: "RoX.enchantress.force_of_attraction",
};

const empty = (s, at) => !s.board[at];
const levelAt = (s, at) => s.board[at] && s.board[at].level;

// --- Movement abilities ------------------------------------------------------

/** RoX.bearer.aerial_maneuver: jump over an adjacent creature to a free field
 *  adjacent to that creature, never back to the starting field. One jump. */
function aerialMoves(s, from) {
  const seen = new Set();
  const out = [];
  for (const over of adjacent(from)) {
    if (empty(s, over)) continue;
    for (const to of adjacent(over)) {
      if (to === from || !empty(s, to) || seen.has(to)) continue;
      seen.add(to);
      out.push({ type: "move", ability: A.aerial, from, to, over });
    }
  }
  return out;
}

/** RoX.portal.wormhole: move a friendly creature onto an own Portal, continue
 *  from a friendly Portal Bearer with a mandatory Movement or Attack. */
function wormholeMoves(s, player) {
  const bearers = diceOf(s, player, BEARER);
  if (!bearers.length) return [];
  const out = [];
  for (const from of diceOf(s, player)) {
    const die = s.board[from];
    if (die.level === PORTAL) continue; // Unmovable
    for (const portal of adjacent(from)) {
      const p = s.board[portal];
      if (!p || p.owner !== player || p.level !== PORTAL) continue;
      for (const bearer of bearers) {
        if (bearer === from) continue; // must be a *friendly* Portal Bearer
        for (const to of adjacent(bearer)) {
          if (to === from || empty(s, to)) {
            out.push({ type: "move", ability: A.wormhole, from, to: portal, bearer, follow: { type: "move", to } });
          } else if (canDefeatWith(s, die, bearer, to)) {
            out.push({ type: "move", ability: A.wormhole, from, to: portal, bearer, follow: { type: "attack", to } });
          }
        }
      }
    }
  }
  return out;
}

function applyWormhole(s, a) {
  const die = s.board[a.from];
  emit(s, { t: "move", path: [a.from, a.to, a.bearer, a.follow.to] });
  s.board[a.from] = null;
  if (a.follow.type === "attack") defeat(s, a.follow.to, die.owner);
  s.board[a.follow.to] = die;
  s.turn.movedDieId = die.id;
  removeDie(s, a.to, "reserve", "wormhole");
  setLevel(s, a.bearer, levelAt(s, a.bearer) - 1);
  finishMoveOrAttack(s, a.follow.to);
}

// --- Spells ------------------------------------------------------------------

/** RoX.guardian.new_paths: split into 1 Portal Bearer and 1 Portal, placed
 *  adjacent to the Guardian and diagonal to each other. */
function newPathsActions(s, at) {
  if (s.players[s.board[at].owner].reserve < 2) return [];
  const adj = adjacent(at);
  const out = [];
  for (const a of adj) {
    for (const b of adj) {
      if (a === b || !empty(s, a) || !empty(s, b)) continue;
      // two fields adjacent to the Guardian are diagonal to each other unless opposite
      if (Math.abs(a - b) === 2 || Math.abs(a - b) === 14) continue;
      out.push({ type: "spell", ability: A.newPaths, at, bearer: a, portal: b });
    }
  }
  return out;
}

/** RoX.emissary.dimensional_summoning: exile 1 Reserve Die, spend X TP and place
 *  a creature of level X adjacent to a friendly Portal Bearer. */
function summoningActions(s, at) {
  const player = s.board[at].owner;
  const p = s.players[player];
  if (p.reserve < 2 || p.tp < 1) return [];
  const targets = new Set();
  for (const b of diceOf(s, player, BEARER)) for (const t of adjacent(b)) if (empty(s, t)) targets.add(t);
  const out = [];
  for (let level = 1; level <= Math.min(6, p.tp); level++) {
    for (const target of [...targets].sort((x, y) => x - y)) {
      out.push({ type: "spell", ability: A.summoning, at, level, target });
    }
  }
  return out;
}

/** RoX.xeladron.decay: Emissary diagonal to Xeladron, Portal Bearer anywhere
 *  free in the own zone, Xeladron back to the Reserve. */
function decayActions(s, at) {
  const player = s.board[at].owner;
  if (s.players[player].reserve < 2) return [];
  const out = [];
  for (const emissary of diagonal(at)) {
    if (!empty(s, emissary)) continue;
    for (let bearer = 0; bearer < SQUARES; bearer++) {
      if (bearer === emissary || !empty(s, bearer) || !inOwnZone(player, bearer)) continue;
      out.push({ type: "spell", ability: A.decay, at, emissary, bearer });
    }
  }
  return out;
}

function impactActions(s, at) {
  return s.players[s.board[at].owner].tp >= 6 ? [{ type: "spell", ability: A.impact, at }] : [];
}

function applyImpact(s, a) {
  const player = s.board[a.at].owner;
  gainTP(s, player, -6);
  for (const t of surrounding(a.at)) {
    const d = s.board[t];
    if (!d) continue;
    // Impact does not defeat creatures, it puts them straight into the Exile
    // (confirmed by the publisher): no Balance or other "defeated" effects.
    removeDie(s, t, "exile", "impact");
    if (d.owner !== player) gainVP(s, player, 1);
  }
  removeDie(s, a.at, "exile", "impact");
}

// --- Decisions -----------------------------------------------------------------

function balanceOptions(s, player) {
  const out = [];
  if (s.players[player].reserve > 0) {
    for (let at = 0; at < SQUARES; at++) if (empty(s, at)) out.push({ type: "choice", kind: A.balance, place: at });
  }
  for (const at of diceOf(s, player, PORTAL)) {
    if (canRaise(s, at)) out.push({ type: "choice", kind: A.balance, upgrade: at });
  }
  return out;
}

function attractionOptions(s, at) {
  const me = s.board[at];
  if (!me || me.level !== ENCHANTRESS) return [];
  const out = [];
  for (const from of diagonal(at)) {
    const d = s.board[from];
    if (!d || d.owner === me.owner || !canMove(s, from)) continue; // e.g. Portals are unmovable
    for (const to of adjacent(at)) {
      if (empty(s, to) && adjacent(from).includes(to)) {
        out.push({ type: "choice", kind: A.attraction, from, to });
      }
    }
  }
  if (out.length) out.push({ type: "choice", kind: A.attraction, skip: true });
  return out;
}

// --- Virtual VP ------------------------------------------------------------------

/** RoX.xeladron.forceful_alliance: maximum number of disjoint adjacent
 *  Xeladron/Portal pairs (bipartite matching). */
function forcefulAlliance(s, player) {
  const xs = diceOf(s, player, XELADRON);
  if (!xs.length) return 0;
  const matchOf = new Map(); // portal square -> xeladron square
  const tryAssign = (x, seen) => {
    for (const p of adjacent(x)) {
      const d = s.board[p];
      if (!d || d.owner !== player || d.level !== PORTAL || seen.has(p)) continue;
      seen.add(p);
      if (!matchOf.has(p) || tryAssign(matchOf.get(p), seen)) { matchOf.set(p, x); return true; }
    }
    return false;
  };
  let pairs = 0;
  for (const x of xs) if (tryAssign(x, new Set())) pairs++;
  return pairs;
}

// --- Set definition --------------------------------------------------------------

export const RoX = {
  id: "RoX",
  name: "Rise of Xeladron",
  creatures: {
    1: "Portal", 2: "Portal Bearer", 3: "Portal Guardian",
    4: "Emissary", 5: "Enchantress of Gravity", 6: "Xeladron",
  },

  // RoX.portal.unmovable
  canMove: (s, at, die) => die.level !== PORTAL,
  canAttack: (s, at, die) => die.level !== PORTAL,

  // RoX.portal.resistance: Portals are immune against attacks while
  // #Portals <= #Portal Bearers of their owner.
  isImmuneToAttack(s, to) {
    const d = s.board[to];
    return d.level === PORTAL && countLevel(s, d.owner, PORTAL) <= countLevel(s, d.owner, BEARER);
  },

  extraActions(s, player) {
    const out = [];
    for (const at of diceOf(s, player)) {
      switch (s.board[at].level) {
        case BEARER: out.push(...aerialMoves(s, at)); break;
        case GUARDIAN: out.push(...newPathsActions(s, at)); break;
        case EMISSARY: out.push(...summoningActions(s, at)); break;
        case XELADRON: out.push(...decayActions(s, at), ...impactActions(s, at)); break;
      }
    }
    out.push(...wormholeMoves(s, player));
    return out;
  },

  applyAbility(s, a) {
    const player = s.current;
    switch (a.ability) {
      case A.aerial:
        doMove(s, a.from, a.to);
        break;
      case A.wormhole:
        applyWormhole(s, a);
        break;
      case A.newPaths:
        placeDie(s, a.bearer, player, BEARER);
        placeDie(s, a.portal, player, PORTAL);
        removeDie(s, a.at, "reserve", "split");
        break;
      case A.summoning:
        exileFromReserve(s, player, 1);
        gainTP(s, player, -a.level);
        placeDie(s, a.target, player, a.level);
        break;
      case A.decay:
        placeDie(s, a.emissary, player, EMISSARY);
        placeDie(s, a.bearer, player, BEARER);
        removeDie(s, a.at, "reserve", "split");
        break;
      case A.impact:
        applyImpact(s, a);
        break;
      default:
        throw new Error(`Unknown RoX ability: ${a.ability}`);
    }
  },

  // RoX.bearer.arrival: +1 TP when a Portal Bearer is placed into the game
  // (only new placements; upgrades/downgrades and the setup do not count).
  onPlaced(s, at, die, cause) {
    if (die.level === BEARER && cause !== "setup") gainTP(s, die.owner, 1);
  },

  // RoX.emissary.energy_circle (second sentence): lose 4 TP when the last Emissary leaves the board.
  onLeave(s, at, die) {
    if (die.level === EMISSARY && countLevel(s, die.owner, EMISSARY) === 0) gainTP(s, die.owner, -4);
  },

  // RoX.emissary.energy_circle: upgrading or downgrading the last Emissary also costs 4 TP.
  onLevelChange(s, at, die, oldLevel) {
    if (oldLevel === EMISSARY && countLevel(s, die.owner, EMISSARY) === 0) gainTP(s, die.owner, -4);
  },

  // RoX.bearer.balance
  onDefeated(s, at, die) {
    if (die.level === BEARER) pushChoice(s, die.owner, A.balance);
  },

  // RoX.enchantress.force_of_attraction
  afterMoveOrAttack(s, at, die) {
    if (die.level === ENCHANTRESS) pushChoice(s, die.owner, A.attraction, { at });
  },

  // RoX.emissary.energy_circle: max. 1 TP at the beginning of the turn.
  onTurnStart(s, player) {
    if (countLevel(s, player, PORTAL) && countLevel(s, player, BEARER) && countLevel(s, player, EMISSARY)) {
      gainTP(s, player, 1);
    }
  },

  choiceOptions(s, pending) {
    if (pending.kind === A.balance) return balanceOptions(s, pending.player);
    if (pending.kind === A.attraction) return attractionOptions(s, pending.data.at);
    return [];
  },

  resolveChoice(s, pending, a) {
    if (pending.kind === A.balance) {
      if (a.place !== undefined) placeDie(s, a.place, pending.player, PORTAL, { cause: "balance" });
      else setLevel(s, a.upgrade, levelAt(s, a.upgrade) + 1);
    } else if (pending.kind === A.attraction) {
      if (!a.skip) relocate(s, [a.from, a.to]);
    }
  },

  virtualVP: forcefulAlliance,

  // Opening knowledge for the AI (from experienced players): lineup 1-6-3,
  // then split Xeladron (Decay) and afterwards the Portal Guardian (New Paths).
  aiBook: {
    setups: [
      [{ col: 2, level: 1 }, { col: 3, level: 6 }, { col: 4, level: 3 }],
      [{ col: 2, level: 3 }, { col: 3, level: 6 }, { col: 4, level: 1 }],
    ],
    opening: [A.decay, A.newPaths],
  },

  // Click paths for the user interface (see engine/paths.js).
  actionPath(a) {
    switch (a.ability || a.kind) {
      case A.aerial: return [a.from, a.to];
      case A.wormhole: return [a.from, a.to, a.bearer, a.follow.to];
      case A.newPaths: return [a.at, "New Paths", a.bearer, a.portal];
      case A.summoning: return [a.at, "Dimensional Summoning", `${a.level} TP`, a.target];
      case A.decay: return [a.at, "Decay", a.emissary, a.bearer];
      case A.impact: return [a.at, "Impact (6 TP)"];
      case A.balance: return [a.place ?? a.upgrade];
      case A.attraction: return a.skip ? ["Skip"] : [a.from, a.to];
      default: throw new Error(`No click path for ${a.ability || a.kind}`);
    }
  },

  pendingPrompt(p) {
    if (p.kind === A.balance) {
      return "Balance: place a Portal from the Reserve on any free field, or upgrade one of your Portals.";
    }
    if (p.kind === A.attraction) {
      return "Force of Attraction: pull a diagonal opposing creature next to the Enchantress, or skip.";
    }
    return "Make a choice.";
  },

  // Hints shown while an ability is being entered (index = number of tokens chosen).
  stepHint(ability, index) {
    const hints = {
      [A.wormhole]: { 2: "Choose the Portal Bearer to come out at.", 3: "Choose the mandatory Movement or Attack." },
      [A.newPaths]: { 2: "Choose the field for the Portal Bearer.", 3: "Choose the field for the Portal." },
      [A.summoning]: { 2: "How many TP do you spend (= Power Level)?", 3: "Choose a field next to a Portal Bearer." },
      [A.decay]: { 2: "Choose the field for the Emissary (diagonal).", 3: "Choose the field for the Portal Bearer (own zone)." },
    };
    return hints[ability] && hints[ability][index];
  },
};
