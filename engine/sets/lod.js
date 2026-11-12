// Dice set LoD (Light of Dragons, base game). Rules: docs/rules/LoD.md

import { adjacent, diagonal, step, opponent } from "../board.js";
import {
  diceOf, countLevel, placeDie, removeDie, setLevel, gainTP, exileFromReserve,
  pushChoice, doMove, doAttack, relocate, canDefeatWith, canRaise, isProtected,
  standardActionsOf, performAction, lineSplits,
} from "../core.js";

const SOUL = 1, GHOST = 2, WARRIOR = 3, MAGE = 4, BASILISK = 5, DRAGON = 6;
const BARRIER_MIN = 3, BARRIER_MAX = 6;

const A = {
  floating: "LoD.soul.floating",
  excess: "LoD.soul.protective_barrier", // too many Souls in one group
  ghosttrail: "LoD.ghost.ghosttrail",
  brotherhood: "LoD.warrior.brotherhood",
  bloodTrade: "LoD.mage.blood_trade",
  bloodUpgrade: "LoD.mage.blood_trade_upgrade",
  innerFire: "LoD.basilisk.inner_fire",
  dragonBlood: "LoD.dragon.dragon_blood",
};

const empty = (s, at) => !s.board[at];
const isOwn = (s, at, player, level) => {
  const d = s.board[at];
  return !!d && d.owner === player && (level === undefined || d.level === level);
};

// --- Souls -----------------------------------------------------------------------

/** Connected group (orthogonal) of own Souls containing `at`. */
function soulGroup(s, at, without = -1) {
  const player = s.board[at].owner;
  const group = new Set([at]);
  const stack = [at];
  while (stack.length) {
    const x = stack.pop();
    for (const n of adjacent(x)) {
      if (n === without || group.has(n) || !isOwn(s, n, player, SOUL)) continue;
      group.add(n);
      stack.push(n);
    }
  }
  return group;
}

/** LoD.soul.protective_barrier: a Soul in a group of 3 to 6 Souls. */
function inBarrier(s, at) {
  const d = s.board[at];
  if (!d || d.level !== SOUL) return false;
  const n = soulGroup(s, at).size;
  return n >= BARRIER_MIN && n <= BARRIER_MAX;
}

/** LoD.soul.floating: move over a chain of adjacent friendly Souls (the direction
 *  may change) to a free field next to a Soul of that chain. One Movement. */
function floatingMoves(s, from) {
  const player = s.board[from].owner;
  const chain = new Set();
  const stack = adjacent(from).filter((n) => isOwn(s, n, player, SOUL));
  stack.forEach((n) => chain.add(n));
  while (stack.length) {
    const x = stack.pop();
    for (const n of adjacent(x)) {
      if (n === from || chain.has(n) || !isOwn(s, n, player, SOUL)) continue;
      chain.add(n);
      stack.push(n);
    }
  }
  const direct = new Set(adjacent(from));
  const targets = new Set();
  for (const c of chain) {
    for (const t of adjacent(c)) if (t !== from && empty(s, t) && !direct.has(t)) targets.add(t);
  }
  return [...targets].sort((a, b) => a - b).map((to) => ({ type: "move", ability: A.floating, from, to }));
}

/** More than 6 Souls in a group: the owner returns Souls to the Reserve one by
 *  one; the rest of the group has to stay connected. */
function excessOptions(s, player) {
  const out = [];
  const seen = new Set();
  for (const at of diceOf(s, player, SOUL)) {
    if (seen.has(at)) continue;
    const group = soulGroup(s, at);
    group.forEach((g) => seen.add(g));
    if (group.size <= BARRIER_MAX) continue;
    for (const g of group) {
      const rest = [...group].filter((x) => x !== g);
      if (soulGroup(s, rest[0], g).size === rest.length) out.push({ type: "choice", kind: A.excess, remove: g });
    }
  }
  return out.sort((a, b) => a.remove - b.remove);
}

// --- Ghost ---------------------------------------------------------------------------

/** LoD.ghost.ghosttrail: up to 2 fields in a straight line, through creatures.
 *  The 1-field versions are the standard Movement and Attack. */
function ghosttrailActions(s, from) {
  const die = s.board[from];
  const out = [];
  for (let d = 0; d < 4; d++) {
    const over = step(from, d);
    if (over < 0) continue;
    const to = step(over, d);
    if (to < 0) continue;
    if (empty(s, to)) out.push({ type: "move", ability: A.ghosttrail, from, over, to });
    else if (canDefeatWith(s, die, from, to)) out.push({ type: "attack", ability: A.ghosttrail, from, over, to });
  }
  return out;
}

/** LoD.ghost.lifepulling: a creature the Ghost moves through loses 1 Power Level
 *  (opposing ones below 1 go to the Exile, own ones to the Reserve); +1 TP. */
function lifepull(s, ghostOwner, at) {
  const d = s.board[at];
  if (!d) return;
  if (d.owner !== ghostOwner && isProtected(s, at, "speciality")) return;
  setLevel(s, at, d.level - 1, { byPlayer: ghostOwner });
  gainTP(s, ghostOwner, 1);
}

function applyGhosttrail(s, a) {
  const player = s.board[a.from].owner;
  lifepull(s, player, a.over);
  if (a.type === "attack") doAttack(s, a.from, a.to, [a.from, a.over, a.to]);
  else {
    const die = relocate(s, [a.from, a.over, a.to]);
    s.turn.movedDieId = die.id;
  }
}

// --- Spells ------------------------------------------------------------------------

/** LoD.warrior.brotherhood: 2 Souls in a line with the Warrior, who becomes a Soul. */
function brotherhoodActions(s, at) {
  if (s.players[s.board[at].owner].reserve < 2) return [];
  return lineSplits(s, at).map((l) => ({ type: "spell", ability: A.brotherhood, at, ...l }));
}

/** LoD.dragon.dragon_blood: 2 Dragon Warriors in a line with the Dragon, who goes to the Reserve. */
function dragonBloodActions(s, at) {
  if (s.players[s.board[at].owner].reserve < 2) return [];
  return lineSplits(s, at).map((l) => ({ type: "spell", ability: A.dragonBlood, at, ...l }));
}

/** LoD.mage.blood_trade: exile 1..X Reserve Dice (X = own Blood Mages), gain
 *  that many + 1 TP, then upgrade other friendly creatures for 1 TP per level.
 *  All TP lapse at the end of the spell. */
function bloodTradeActions(s, at) {
  const player = s.board[at].owner;
  const max = Math.min(countLevel(s, player, MAGE), s.players[player].reserve);
  const out = [];
  for (let n = 1; n <= max; n++) out.push({ type: "spell", ability: A.bloodTrade, at, exile: n });
  return out;
}

const upgradeTargets = (s, player, caster) =>
  diceOf(s, player).filter((at) => at !== caster && s.board[at].level < 6 && canRaise(s, at));

function bloodUpgradeOptions(s, pending) {
  const { player } = pending;
  if (s.players[player].tp <= 0) return [];
  const targets = upgradeTargets(s, player, pending.data.caster);
  if (!targets.length) return [];
  return [
    ...targets.map((t) => ({ type: "choice", kind: A.bloodUpgrade, upgrade: t })),
    { type: "choice", kind: A.bloodUpgrade, finish: true },
  ];
}

/** End the spell if nothing more can be upgraded: all TP lapse. */
function settleBloodTrade(s, player, caster) {
  if (s.players[player].tp <= 0 || !upgradeTargets(s, player, caster).length) s.players[player].tp = 0;
}

// --- Fire Basilisk ------------------------------------------------------------------

function innerFireOptions(s, pending) {
  const { at } = pending.data;
  if (!isOwn(s, at, pending.player, BASILISK)) return [];
  const subs = standardActionsOf(s, at, { upgrade: false });
  if (!subs.length) return [];
  return [...subs.map((sub) => ({ type: "choice", kind: A.innerFire, sub })), { type: "choice", kind: A.innerFire, skip: true }];
}

// --- Set definition ----------------------------------------------------------------

export const LoD = {
  id: "LoD",
  name: "Light of Dragons",
  creatures: {
    1: "Soul", 2: "Ghost", 3: "Dragon Warrior",
    4: "Blood Mage", 5: "Fire Basilisk", 6: "Light Dragon",
  },

  // LoD.soul.protective_barrier: immune to the opponent's attacks, spells and specialities.
  immuneTo: (s, at) => inBarrier(s, at),

  // LoD.basilisk.serpent_trail: the Fire Basilisk moves and attacks diagonally only.
  stepTargets: (s, from, die) => (die.level === BASILISK ? diagonal(from) : null),

  extraActions(s, player) {
    const out = [];
    for (const at of diceOf(s, player)) {
      switch (s.board[at].level) {
        case SOUL: out.push(...floatingMoves(s, at)); break;
        case GHOST: out.push(...ghosttrailActions(s, at)); break;
        case WARRIOR: out.push(...brotherhoodActions(s, at)); break;
        case MAGE: out.push(...bloodTradeActions(s, at)); break;
        case DRAGON: out.push(...dragonBloodActions(s, at)); break;
      }
    }
    return out;
  },

  applyAbility(s, a) {
    const player = s.current;
    switch (a.ability) {
      case A.floating:
        doMove(s, a.from, a.to);
        break;
      case A.ghosttrail:
        applyGhosttrail(s, a);
        break;
      case A.brotherhood:
        placeDie(s, a.a, player, SOUL);
        placeDie(s, a.b, player, SOUL);
        setLevel(s, a.at, SOUL);
        break;
      case A.dragonBlood:
        placeDie(s, a.a, player, WARRIOR);
        placeDie(s, a.b, player, WARRIOR);
        removeDie(s, a.at, "reserve", "split");
        break;
      case A.bloodTrade:
        exileFromReserve(s, player, a.exile);
        gainTP(s, player, a.exile + 1);
        pushChoice(s, player, A.bloodUpgrade, { caster: a.at });
        settleBloodTrade(s, player, a.at);
        break;
      default:
        throw new Error(`Unknown LoD ability: ${a.ability}`);
    }
  },

  // LoD.ghost.cursed: the creature that defeats a Ghost is downgraded by 2.
  afterDefeatedBy(s, at, defeated) {
    if (defeated.level !== GHOST) return;
    const attacker = s.board[at];
    if (!attacker || isProtected(s, at, "speciality")) return;
    setLevel(s, at, attacker.level - 2, { byPlayer: defeated.owner });
  },

  // LoD.basilisk.inner_fire: after a defeat, one more Movement or Attack (can chain).
  afterAttack(s, at, die) {
    if (die.level === BASILISK) pushChoice(s, die.owner, A.innerFire, { at });
  },

  // LoD.soul.protective_barrier (note): more than 6 connected Souls at the end
  // of your turn: return Souls to the Reserve until 6 remain.
  beforeTurnEnd(s, player) {
    if (excessOptions(s, player).length) pushChoice(s, player, A.excess);
  },

  choiceOptions(s, pending) {
    switch (pending.kind) {
      case A.excess: return excessOptions(s, pending.player);
      case A.bloodUpgrade: return bloodUpgradeOptions(s, pending);
      case A.innerFire: return innerFireOptions(s, pending);
      default: return [];
    }
  },

  resolveChoice(s, pending, a) {
    const player = pending.player;
    switch (pending.kind) {
      case A.excess:
        removeDie(s, a.remove, "reserve", "barrier");
        break;
      case A.bloodUpgrade:
        if (a.finish) {
          s.players[player].tp = 0;
        } else {
          gainTP(s, player, -1);
          setLevel(s, a.upgrade, s.board[a.upgrade].level + 1);
          pushChoice(s, player, A.bloodUpgrade, pending.data);
          settleBloodTrade(s, player, pending.data.caster);
        }
        break;
      case A.innerFire:
        if (!a.skip) performAction(s, a.sub);
        break;
      default:
        throw new Error(`Unknown LoD choice: ${pending.kind}`);
    }
  },

  // LoD.dragon.luminous_flame: 1 virtual VP per Light Dragon (level 6) more than the opponent.
  virtualVP: (s, player) => Math.max(0, countLevel(s, player, DRAGON) - countLevel(s, opponent(player), 6)),

  // The AI resolves these step-by-step decisions greedily instead of searching them.
  aiGreedyChoices: [A.bloodUpgrade, A.excess],

  // Starting lineups of the AI.
  aiBook: {
    // Expert: the lineups that did best in a self-play tournament (tools/setups.mjs).
    expertSetups: [
      [{ col: 1, level: 1 }, { col: 2, level: 3 }, { col: 3, level: 4 }, { col: 4, level: 1 }, { col: 5, level: 1 }],
      [{ col: 1, level: 1 }, { col: 2, level: 4 }, { col: 3, level: 4 }, { col: 4, level: 1 }],
      [{ col: 1, level: 1 }, { col: 2, level: 3 }, { col: 3, level: 5 }, { col: 4, level: 1 }],
    ],
  },

  actionPath(a) {
    switch (a.ability || a.kind) {
      case A.floating: return [a.from, a.to];
      case A.ghosttrail: return [a.from, a.to];
      case A.brotherhood: return [a.at, `Brotherhood (${a.line})`];
      case A.dragonBlood: return [a.at, `Dragon Blood (${a.line})`];
      case A.bloodTrade: return [a.at, `Blood Trade: exile ${a.exile}`];
      case A.bloodUpgrade: return a.finish ? ["Finish Blood Trade"] : [a.upgrade];
      case A.excess: return [a.remove];
      case A.innerFire: return ["Skip"]; // other options use the path of their action
      default: throw new Error(`No click path for ${a.ability || a.kind}`);
    }
  },

  pendingPrompt(p) {
    switch (p.kind) {
      case A.excess: return "More than 6 connected Souls: choose a Soul to return to the Reserve.";
      case A.bloodUpgrade: return "Blood Trade: upgrade a friendly creature for 1 TP, or finish (remaining TP lapse).";
      case A.innerFire: return "Inner Fire: one more Movement or Attack with the Fire Basilisk, or skip.";
      default: return "Make a choice.";
    }
  },
};
