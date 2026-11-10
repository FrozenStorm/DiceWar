// Dice set RoM (Roots of Mali). Rules: docs/rules/RoM.md

import { adjacent, step, rowOf, colOf, sq, SIZE, SQUARES, inOwnZone, opponent } from "../board.js";
import {
  diceOf, countLevel, placeDie, removeDie, setLevel, gainTP, exileFromReserve,
  pushChoice, doMove, doAttack, relocate, canDefeatWith, standardActionsOf, performAction,
  finishMoveOrAttack, lineSplits,
} from "../core.js";

const FRUIT = 1, SPROUT = 2, TORCH = 3, PROTECTRESS = 4, RUNNER = 5, MALI = 6;
const LEAPABLE = [FRUIT, SPROUT, MALI];
const MAX_CHAIN = 6;

const A = {
  breeding: "RoM.fruit.breeding",
  velocity: "RoM.sprout.velocity",
  seed: "RoM.sprout.golden_seed",
  fireDemon: "RoM.torch.fire_demon",
  breath: "RoM.protectress.breath_of_life",
  symbiosis: "RoM.protectress.symbiosis",
  pathway: "RoM.runner.secret_pathway",
  pathwayFollow: "RoM.runner.secret_pathway_follow",
  outOfDark: "RoM.runner.out_of_the_dark",
  children: "RoM.mali.children_of_the_woods",
};

const empty = (s, at) => !s.board[at];
const isOwn = (s, at, player, level) => {
  const d = s.board[at];
  return !!d && d.owner === player && (level === undefined || d.level === level);
};

/** Step in direction d (0 up, 1 right, 2 down, 3 left); left/right wrap around
 *  the side lines of the board (RoM Secret Pathway). Returns [square, wrapped]. */
function wrapStep(at, d) {
  const n = step(at, d);
  if (n >= 0) return [n, false];
  if (d === 1) return [sq(rowOf(at), 0), true];
  if (d === 3) return [sq(rowOf(at), SIZE - 1), true];
  return [-1, false];
}

// --- Golden Fruit --------------------------------------------------------------------

/** RoM.fruit.breeding: 2 Golden Fruits on opposite sides of this one (both
 *  horizontally or both vertically adjacent, like BoD Servitude). */
function breedingActions(s, at) {
  if (s.players[s.board[at].owner].reserve < 2) return [];
  return lineSplits(s, at).map((l) => ({ type: "spell", ability: A.breeding, at, ...l }));
}

// --- Sprout ----------------------------------------------------------------------------

/** RoM.sprout.velocity: 2 fields in a straight line over a free field (the
 *  1-field versions are the standard Movement and Attack). */
function velocityActions(s, from) {
  const die = s.board[from];
  const out = [];
  for (let d = 0; d < 4; d++) {
    const over = step(from, d);
    if (over < 0 || !empty(s, over)) continue;
    const to = step(over, d);
    if (to < 0) continue;
    if (empty(s, to)) out.push({ type: "move", ability: A.velocity, from, over, to });
    else if (canDefeatWith(s, die, from, to)) out.push({ type: "attack", ability: A.velocity, from, over, to });
  }
  return out;
}

// --- Torch Bearer ----------------------------------------------------------------------

/** RoM.torch.fire_demon: leap over a chain of own creatures of level 1, 2 or 6
 *  (around corners too) and land next to the last one; they go to the Reserve. */
function fireDemonActions(s, from) {
  const die = s.board[from];
  const player = die.owner;
  const out = [];
  const used = new Set([from]);
  const rec = (last, chain) => {
    for (const n of adjacent(last)) {
      if (used.has(n)) continue;
      const d = s.board[n];
      if (d && d.owner === player && LEAPABLE.includes(d.level)) {
        if (chain.length >= MAX_CHAIN) continue;
        used.add(n);
        rec(n, [...chain, n]);
        used.delete(n);
      } else if (chain.length) {
        if (!d) out.push({ type: "move", ability: A.fireDemon, from, chain, to: n });
        else if (canDefeatWith(s, die, from, n)) out.push({ type: "attack", ability: A.fireDemon, from, chain, to: n });
      }
    }
  };
  rec(from, []);
  return out;
}

function applyFireDemon(s, a) {
  const path = [a.from, ...a.chain, a.to];
  if (a.type === "attack") doAttack(s, a.from, a.to, path);
  else {
    const die = relocate(s, path);
    s.turn.movedDieId = die.id;
    finishMoveOrAttack(s, a.to);
  }
  for (const c of a.chain) removeDie(s, c, "reserve", "fire_demon");
}

// --- Protectress of the Woods ------------------------------------------------------

/** RoM.protectress.breath_of_life: exile 1 Reserve Die, spend TP to raise one
 *  own Golden Fruit by that many levels (up to 6). */
function breathActions(s, at) {
  const player = s.board[at].owner;
  const p = s.players[player];
  if (p.reserve < 1 || p.tp < 1) return [];
  const out = [];
  for (const fruit of diceOf(s, player, FRUIT)) {
    for (let tp = 1; tp <= Math.min(p.tp, 6 - FRUIT); tp++) out.push({ type: "spell", ability: A.breath, at, fruit, tp });
  }
  return out;
}

/** RoM.protectress.symbiosis: move onto an adjacent own Golden Fruit (to the
 *  Reserve) and become a Shadow Runner. */
function symbiosisActions(s, from) {
  const player = s.board[from].owner;
  return adjacent(from)
    .filter((t) => isOwn(s, t, player, FRUIT))
    .map((to) => ({ type: "upgrade", ability: A.symbiosis, from, to }));
}

// --- Shadow Runner ------------------------------------------------------------------

/** RoM.runner.secret_pathway and out_of_the_dark (may be combined). */
function runnerActions(s, from) {
  const die = s.board[from];
  const player = die.owner;
  const out = [];
  const add = (ability, to, extra) => {
    if (to < 0 || to === from) return;
    if (empty(s, to)) out.push({ type: "move", ability, from, to, ...extra });
    else if (canDefeatWith(s, die, from, to)) out.push({ type: "attack", ability, from, to, ...extra });
  };
  // Secret Pathway: over the side line and back in on the opposite side.
  for (const d of [1, 3]) {
    const [to, wrapped] = wrapStep(from, d);
    if (wrapped) add(A.pathway, to, { wrap: true });
  }
  // Out of the Dark: leap over an adjacent own Shadow Runner (also over the side line).
  for (let d = 0; d < 4; d++) {
    const [over, w1] = wrapStep(from, d);
    if (over < 0 || !isOwn(s, over, player, RUNNER)) continue;
    const [to, w2] = wrapStep(over, d);
    add(A.outOfDark, to, { over, wrap: w1 || w2 });
  }
  return out;
}

function applyRunner(s, a) {
  const path = a.over !== undefined ? [a.from, a.over, a.to] : [a.from, a.to];
  if (a.type === "attack") doAttack(s, a.from, a.to, path);
  else {
    const die = relocate(s, path);
    s.turn.movedDieId = die.id;
    finishMoveOrAttack(s, a.to);
  }
  // Secret Pathway (once per turn): afterwards one more Movement or Attack.
  if (a.wrap) pushChoice(s, s.current, A.pathwayFollow, { at: a.to });
}

function followOptions(s, pending) {
  const { at } = pending.data;
  if (!isOwn(s, at, pending.player, RUNNER)) return [];
  const subs = standardActionsOf(s, at, { upgrade: false });
  if (!subs.length) return [];
  return [...subs.map((sub) => ({ type: "choice", kind: A.pathwayFollow, sub })), { type: "choice", kind: A.pathwayFollow, skip: true }];
}

// --- Mali ---------------------------------------------------------------------------------

const freeOwnZone = (s, player) => {
  const out = [];
  for (let at = 0; at < SQUARES; at++) if (empty(s, at) && inOwnZone(player, at)) out.push(at);
  return out;
};

/** RoM.mali.children_of_the_woods: 3 Sprouts anywhere in your zone (placed one
 *  by one), then the Mali goes back to the Reserve. */
function childrenActions(s, at) {
  const player = s.board[at].owner;
  if (s.players[player].reserve < 3 || freeOwnZone(s, player).length < 3) return [];
  return [{ type: "spell", ability: A.children, at }];
}

// --- Specialities that need the owner ------------------------------------------------

function checkFellowship(s, player) {
  if (countLevel(s, player, PROTECTRESS) === 0) s.players[player].tp = 0;
}

// --- Set definition -------------------------------------------------------------------------

export const RoM = {
  id: "RoM",
  name: "Roots of Mali",
  creatures: {
    1: "Golden Fruit", 2: "Sprout", 3: "Torch Bearer",
    4: "Protectress of the Woods", 5: "Shadow Runner", 6: "Mali",
  },

  // RoM.fruit.fake_gold: Golden Fruits cannot move and cannot be upgraded.
  canMove: (s, at, die) => die.level !== FRUIT,
  canUpgrade: (s, at, die) => die.level !== FRUIT,
  // ... and give no VP or Field Bonus when defeated; they go back to the owner's Reserve.
  defeatRules: (s, at, die) => (die.level === FRUIT ? { noVP: true, dest: "reserve" } : null),

  extraActions(s, player) {
    const out = [];
    for (const at of diceOf(s, player)) {
      switch (s.board[at].level) {
        case FRUIT: out.push(...breedingActions(s, at)); break;
        case SPROUT: out.push(...velocityActions(s, at)); break;
        case TORCH: out.push(...fireDemonActions(s, at)); break;
        case PROTECTRESS: out.push(...breathActions(s, at), ...symbiosisActions(s, at)); break;
        case RUNNER: out.push(...runnerActions(s, at)); break;
        case MALI: out.push(...childrenActions(s, at)); break;
      }
    }
    return out;
  },

  applyAbility(s, a) {
    const player = s.current;
    switch (a.ability) {
      case A.breeding:
        placeDie(s, a.a, player, FRUIT);
        placeDie(s, a.b, player, FRUIT);
        removeDie(s, a.at, "reserve", "split");
        break;
      case A.velocity: {
        const path = [a.from, a.over, a.to];
        if (a.type === "attack") doAttack(s, a.from, a.to, path);
        else {
          const die = relocate(s, path);
          s.turn.movedDieId = die.id;
        }
        break;
      }
      case A.fireDemon:
        applyFireDemon(s, a);
        break;
      case A.breath:
        exileFromReserve(s, player, 1);
        gainTP(s, player, -a.tp);
        setLevel(s, a.fruit, s.board[a.fruit].level + a.tp);
        break;
      case A.symbiosis:
        removeDie(s, a.to, "reserve", "symbiosis");
        relocate(s, [a.from, a.to]);
        setLevel(s, a.to, s.board[a.to].level + 1);
        break;
      case A.pathway:
      case A.outOfDark:
        applyRunner(s, a);
        break;
      case A.children:
        pushChoice(s, player, A.children, { at: a.at, left: 3 });
        break;
      default:
        throw new Error(`Unknown RoM ability: ${a.ability}`);
    }
  },

  // RoM.sprout.golden_seed: after a 1-field Movement of a Sprout, a Golden Fruit
  // from the Reserve may be placed on the field it came from.
  afterMoveOrAttack(s, at, die) {
    const last = s.turn.lastStep;
    if (die.level !== SPROUT || !last || last.attack || last.to !== at) return;
    if (!adjacent(at).includes(last.from) || !empty(s, last.from) || s.players[die.owner].reserve < 1) return;
    pushChoice(s, die.owner, A.seed, { at: last.from });
  },

  // RoM.sprout.tenacity: whoever defeats a Sprout exiles 2 of their Reserve Dice (if possible).
  afterDefeatedBy(s, at, defeated) {
    if (defeated.level !== SPROUT) return;
    const attacker = s.board[at];
    if (!attacker) return;
    exileFromReserve(s, attacker.owner, Math.min(2, s.players[attacker.owner].reserve));
  },

  onLeave(s, at, die) {
    checkFellowship(s, die.owner);
  },

  onLevelChange(s, at, die) {
    checkFellowship(s, die.owner);
  },

  // RoM.protectress.fellowship: 1 TP per own Protectress at the beginning of the turn.
  onTurnStart(s, player) {
    gainTP(s, player, countLevel(s, player, PROTECTRESS));
  },

  choiceOptions(s, pending) {
    switch (pending.kind) {
      case A.seed:
        if (!empty(s, pending.data.at) || s.players[pending.player].reserve < 1) return [];
        return [{ type: "choice", kind: A.seed, place: pending.data.at }, { type: "choice", kind: A.seed, skip: true }];
      case A.pathwayFollow:
        return followOptions(s, pending);
      case A.children:
        if (s.players[pending.player].reserve < 1) return [];
        return freeOwnZone(s, pending.player).map((place) => ({ type: "choice", kind: A.children, place }));
      default:
        return [];
    }
  },

  resolveChoice(s, pending, a) {
    const player = pending.player;
    switch (pending.kind) {
      case A.seed:
        if (!a.skip) placeDie(s, a.place, player, FRUIT);
        break;
      case A.pathwayFollow:
        if (!a.skip) performAction(s, a.sub);
        break;
      case A.children: {
        placeDie(s, a.place, player, SPROUT);
        const left = pending.data.left - 1;
        if (left > 0) pushChoice(s, player, A.children, { ...pending.data, left });
        else removeDie(s, pending.data.at, "reserve", "split");
        break;
      }
      default:
        throw new Error(`Unknown RoM choice: ${pending.kind}`);
    }
  },

  // RoM.mali.deep_roots: 1 virtual VP per own Mali in the opponent's zone.
  virtualVP: (s, player) => diceOf(s, player, MALI).filter((at) => inOwnZone(opponent(player), at)).length,

  aiGreedyChoices: [A.children],

  actionPath(a) {
    switch (a.ability || a.kind) {
      case A.breeding: return [a.at, `Breeding (${a.line})`];
      case A.velocity: return [a.from, a.to];
      case A.fireDemon: return [a.from, ...a.chain, a.to];
      case A.breath: return [a.at, "Breath of Life", a.fruit, `+${a.tp} (${a.tp} TP)`];
      case A.symbiosis: return [a.from, a.to];
      case A.pathway: return [a.from, a.to];
      case A.outOfDark: return [a.from, a.to];
      case A.seed: return a.skip ? ["Skip"] : [a.place];
      case A.pathwayFollow: return ["Skip"]; // other options use the path of their action
      case A.children: return a.place !== undefined ? [a.place] : [a.at, "Children of the Woods"];
      default: throw new Error(`No click path for ${a.ability || a.kind}`);
    }
  },

  pendingPrompt(p) {
    switch (p.kind) {
      case A.seed: return "Golden Seed: place a Golden Fruit on the field the Sprout came from, or skip.";
      case A.pathwayFollow: return "Secret Pathway: one more Movement or Attack with the Shadow Runner, or skip.";
      case A.children: return `Children of the Woods: place a Sprout anywhere in your zone (${p.data.left} left).`;
      default: return "Make a choice.";
    }
  },

  stepHint(ability, index) {
    const hints = {
      [A.breath]: { 2: "Choose your Golden Fruit.", 3: "How many TP (= levels)?" },
    };
    return hints[ability] && hints[ability][index];
  },
};
