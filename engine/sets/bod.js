// Dice set BoD (Bond of Demons). Rules: docs/rules/BoD.md

import { adjacent } from "../board.js";
import {
  diceOf, countLevel, placeDie, removeDie, setLevel, gainTP, exileFromReserve,
  pushChoice, doMove, canRaise, standardActionsOf, actionOrigin, performAction, relocate,
} from "../core.js";

const GNOME = 1, POSSESSED = 2, HUNTER = 3, HAG = 4, GATHERER = 5, DEMON = 6;

const A = {
  hunterPath: "BoD.hunter.hunters_path",
  fusion: "BoD.hunter.dark_fusion",
  voodoo: "BoD.hag.voodoo",
  servitude: "BoD.hag.servitude",
  mercy: "BoD.gatherer.mercy",
  sacrifice: "BoD.gatherer.sacrifice",
  allegiance: "BoD.demon.allegiance",
  free: "BoD.free_action", // additional action after Dark Fusion or Sacrifice
};

const VOODOO_MOVE_TP = 3, VOODOO_RAISE_TP = 2;

const empty = (s, at) => !s.board[at];
const isOwn = (s, at, player, level) => {
  const d = s.board[at];
  return !!d && d.owner === player && (level === undefined || d.level === level);
};

/** Squares reachable in exactly `steps` orthogonal steps over free fields
 *  (no field visited twice, the start counts as visited). */
function walk(s, from, steps) {
  const out = new Set();
  const visited = new Set([from]);
  const rec = (at, left) => {
    if (left === 0) { out.add(at); return; }
    for (const n of adjacent(at)) {
      if (visited.has(n) || !empty(s, n)) continue;
      visited.add(n);
      rec(n, left - 1);
      visited.delete(n);
    }
  };
  rec(from, steps);
  return [...out].sort((a, b) => a - b);
}

// --- Hunter of Death ---------------------------------------------------------

/** BoD.hunter.hunters_path: up to 2 fields over free fields, straight or around
 *  a corner. One-field moves are standard Movements, so only 2-field moves here. */
function hunterPathMoves(s, from) {
  return walk(s, from, 2).map((to) => ({ type: "move", ability: A.hunterPath, from, to }));
}

/** BoD.hunter.dark_fusion: move onto another friendly Hunter (adjacent, or 2
 *  fields away via Hunter's Path), exile one, upgrade the other to a Demon. */
function fusionActions(s, from) {
  const player = s.board[from].owner;
  const out = [];
  for (const other of diceOf(s, player, HUNTER)) {
    if (other === from || !canRaise(s, other)) continue;
    const reachable = adjacent(from).includes(other)
      || adjacent(from).some((m) => empty(s, m) && adjacent(m).includes(other));
    if (reachable) out.push({ type: "upgrade", ability: A.fusion, from, to: other });
  }
  return out;
}

function applyFusion(s, a) {
  const player = s.board[a.from].owner;
  removeDie(s, a.from, "exile", "fusion");
  setLevel(s, a.to, DEMON);
  s.turn.movedDieId = s.board[a.to].id;
  if (countLevel(s, player, HUNTER) === 0) {
    pushChoice(s, player, A.free, { at: a.to, upgrade: true, abilities: true });
  }
}

// --- Swamp Hag ------------------------------------------------------------------

/** BoD.hag.voodoo: exile 1 Reserve Die, then move one Possessed up to 3 fields
 *  (3 TP, movement only) and/or raise another Possessed by 2 levels (2 TP). */
function voodooActions(s, at) {
  const player = s.board[at].owner;
  const p = s.players[player];
  if (p.reserve < 1 || p.tp < VOODOO_RAISE_TP) return [];
  const possessed = diceOf(s, player, POSSESSED);
  const moves = p.tp >= VOODOO_MOVE_TP
    ? possessed.flatMap((from) => [...new Set([1, 2, 3].flatMap((n) => walk(s, from, n)))].sort((a, b) => a - b).map((to) => ({ from, to })))
    : [];
  const raises = possessed.filter((q) => canRaise(s, q));
  const out = [];
  for (const m of moves) out.push({ type: "spell", ability: A.voodoo, at, move: m });
  for (const q of raises) out.push({ type: "spell", ability: A.voodoo, at, raise: q });
  if (p.tp >= VOODOO_MOVE_TP + VOODOO_RAISE_TP) {
    for (const m of moves) {
      for (const q of raises) if (q !== m.from) out.push({ type: "spell", ability: A.voodoo, at, move: m, raise: q });
    }
  }
  return out;
}

function applyVoodoo(s, a) {
  const player = s.current;
  exileFromReserve(s, player, 1);
  if (a.move) {
    gainTP(s, player, -VOODOO_MOVE_TP);
    relocate(s, [a.move.from, a.move.to]);
  }
  if (a.raise !== undefined) {
    gainTP(s, player, -VOODOO_RAISE_TP);
    setLevel(s, a.raise, s.board[a.raise].level + 2);
  }
}

/** BoD.hag.servitude: split into 2 Possessed on free fields adjacent to the Hag. */
function servitudeActions(s, at) {
  if (s.players[s.board[at].owner].reserve < 2) return [];
  const free = adjacent(at).filter((t) => empty(s, t));
  const out = [];
  for (const a of free) for (const b of free) if (a !== b) out.push({ type: "spell", ability: A.servitude, at, a, b });
  return out;
}

// --- Gatherer ---------------------------------------------------------------------

function mercyActions(s, at) {
  if (s.players[s.board[at].owner].reserve < 1) return [];
  return adjacent(at).filter((t) => empty(s, t)).map((target) => ({ type: "spell", ability: A.mercy, at, target }));
}

/** BoD.gatherer.sacrifice: move onto an adjacent own Gnome, the Gnome returns
 *  to the Reserve; optionally one more Upgrade, Movement or Attack. */
function sacrificeMoves(s, from) {
  const player = s.board[from].owner;
  return adjacent(from)
    .filter((t) => isOwn(s, t, player, GNOME))
    .map((to) => ({ type: "move", ability: A.sacrifice, from, to }));
}

function applySacrifice(s, a) {
  const player = s.current;
  removeDie(s, a.to, "reserve", "sacrifice");
  doMove(s, a.from, a.to);
  pushChoice(s, player, A.free, { at: a.to, upgrade: true, abilities: false });
}

// --- Demon of Darkness ------------------------------------------------------------

/** BoD.demon.allegiance: downgrade to a Possessed and place a Swamp Hag next to it. */
function allegianceActions(s, at) {
  if (s.players[s.board[at].owner].reserve < 1) return [];
  return adjacent(at).filter((t) => empty(s, t)).map((hag) => ({ type: "spell", ability: A.allegiance, at, hag }));
}

// --- Additional action ----------------------------------------------------------------

/** Abilities of a single own die (its specials and spells). */
function abilitiesOf(s, at) {
  const d = s.board[at];
  switch (d.level) {
    case HUNTER: return [...hunterPathMoves(s, at), ...fusionActions(s, at)];
    case HAG: return [...voodooActions(s, at), ...servitudeActions(s, at)];
    case GATHERER: return [...mercyActions(s, at), ...sacrificeMoves(s, at)];
    case DEMON: return allegianceActions(s, at);
    default: return [];
  }
}

function freeActionOptions(s, pending) {
  const { at, upgrade, abilities } = pending.data;
  if (!isOwn(s, at, pending.player)) return [];
  const subs = standardActionsOf(s, at, { upgrade });
  if (abilities) subs.push(...abilitiesOf(s, at).filter((a) => actionOrigin(a) === at));
  if (!subs.length) return [];
  return [...subs.map((sub) => ({ type: "choice", kind: A.free, sub })), { type: "choice", kind: A.free, skip: true }];
}

// --- Black Magic ----------------------------------------------------------------------

/** BoD.hag.black_magic (note): without own Swamp Hag or Possessed the TP are lost. */
function checkBlackMagic(s, player) {
  if (countLevel(s, player, HAG) === 0 && countLevel(s, player, POSSESSED) === 0) {
    s.players[player].tp = 0;
  }
}

// --- Set definition -------------------------------------------------------------------

export const BoD = {
  id: "BoD",
  name: "Bond of Demons",
  creatures: {
    1: "Gnome", 2: "Possessed", 3: "Hunter of Death",
    4: "Swamp Hag", 5: "Gatherer", 6: "Demon of Darkness",
  },

  // BoD.gnome.protective_aura: own creatures with Power Level 2+ adjacent to
  // an own Gnome cannot be attacked.
  isImmuneToAttack(s, to) {
    const d = s.board[to];
    return d.level >= 2 && adjacent(to).some((n) => isOwn(s, n, d.owner, GNOME));
  },

  // BoD.possessed.temptation: opposing creatures with Power Level 3+ next to a
  // Possessed have to attack it if they can (immune Possessed don't count).
  constrainOpponent(s, player, actions) {
    const forced = actions.filter((a) => {
      if (a.type !== "attack" || a.ability) return false;
      const target = s.board[a.to];
      return target.owner !== player && target.level === POSSESSED && s.board[a.from].level >= 3;
    });
    return forced.length ? forced : actions;
  },

  extraActions(s, player) {
    const out = [];
    for (const at of diceOf(s, player)) out.push(...abilitiesOf(s, at));
    return out;
  },

  applyAbility(s, a) {
    const player = s.current;
    switch (a.ability) {
      case A.hunterPath:
        doMove(s, a.from, a.to);
        break;
      case A.fusion:
        applyFusion(s, a);
        break;
      case A.voodoo:
        applyVoodoo(s, a);
        break;
      case A.servitude:
        placeDie(s, a.a, player, POSSESSED);
        placeDie(s, a.b, player, POSSESSED);
        removeDie(s, a.at, "reserve", "split");
        break;
      case A.mercy:
        placeDie(s, a.target, player, GNOME);
        break;
      case A.sacrifice:
        applySacrifice(s, a);
        break;
      case A.allegiance:
        setLevel(s, a.at, POSSESSED);
        placeDie(s, a.hag, player, HAG);
        break;
      default:
        throw new Error(`Unknown BoD ability: ${a.ability}`);
    }
  },

  onLeave(s, at, die) {
    checkBlackMagic(s, die.owner);
  },

  onLevelChange(s, at, die) {
    checkBlackMagic(s, die.owner);
  },

  // BoD.hag.black_magic: +1 TP at the beginning of the turn with a Swamp Hag in play.
  onTurnStart(s, player) {
    if (countLevel(s, player, HAG)) gainTP(s, player, 1);
  },

  choiceOptions(s, pending) {
    if (pending.kind === A.free) return freeActionOptions(s, pending);
    return [];
  },

  resolveChoice(s, pending, a) {
    if (pending.kind === A.free && !a.skip) performAction(s, a.sub);
  },

  // BoD.demon.bound: 1 virtual VP per pair of Demon and Possessed.
  virtualVP: (s, player) => Math.min(countLevel(s, player, DEMON), countLevel(s, player, POSSESSED)),

  // Click paths for the user interface (see engine/paths.js).
  actionPath(a) {
    switch (a.ability || a.kind) {
      case A.hunterPath: return [a.from, a.to];
      case A.fusion: return [a.from, "Dark Fusion", a.to];
      case A.voodoo:
        if (a.move && a.raise !== undefined) return [a.at, "Voodoo: move + raise (5 TP)", a.move.from, a.move.to, a.raise];
        if (a.move) return [a.at, "Voodoo: move (3 TP)", a.move.from, a.move.to];
        return [a.at, "Voodoo: raise (2 TP)", a.raise];
      case A.servitude: return [a.at, "Servitude", a.a, a.b];
      case A.mercy: return [a.at, "Mercy", a.target];
      case A.sacrifice: return [a.from, a.to];
      case A.allegiance: return [a.at, "Allegiance", a.hag];
      case A.free: return ["Skip"]; // other options use the path of their action
      default: throw new Error(`No click path for ${a.ability || a.kind}`);
    }
  },

  pendingPrompt(p) {
    if (p.kind === A.free) {
      return p.data.abilities
        ? "Additional action: you may take one more action with the Demon of Darkness, or skip."
        : "Sacrifice: you may upgrade, move or attack with the Gatherer once more, or skip.";
    }
    return "Make a choice.";
  },

  stepHint(ability, index) {
    const hints = {
      [A.fusion]: { 2: "Choose the other Hunter of Death to fuse with." },
      [A.voodoo]: { 2: "Choose the Possessed.", 3: "Choose the target field (up to 3 fields).", 4: "Choose another Possessed to raise by 2." },
      [A.servitude]: { 2: "Choose the field for the first Possessed.", 3: "Choose the field for the second Possessed." },
      [A.mercy]: { 2: "Choose a free adjacent field for the Gnome." },
      [A.allegiance]: { 2: "Choose a free field next to the new Possessed for the Swamp Hag." },
    };
    return hints[ability] && hints[ability][index];
  },
};
