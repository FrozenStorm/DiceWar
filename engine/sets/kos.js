// Dice set KoS (Knights of Steel). Rules: docs/rules/KoS.md
//
// KoS uses the alignment of a die (die.dir: 0 up, 1 right, 2 down, 3 left on
// the board). Loyal Shield, Silver Spear and Burning Stag choose their
// alignment with every Movement and Attack (action.face, see core
// performAction). Every KoS die gets an alignment when it is placed (setup,
// Supply, Reinforcements, Relentless), because it keeps it when upgraded.

import { adjacent, diagonal, surrounding, step, rowOf, colOf, sq, onBoard, SIZE, SQUARES, opponent, supplyRow, defaultDir } from "../board.js";
import {
  diceOf, countLevel, placeDie, removeDie, setLevel, gainTP, exileFromReserve,
  pushChoice, doMove, doAttack, relocate, defeat, canDefeatWith, canMove, canRaise,
  isProtected, standardActionsOf, standardMoves, performAction, mainActions, actionOrigin,
} from "../core.js";

const SWORD = 1, SHIELD = 2, SPEAR = 3, COMMANDER = 4, STAG = 5, KNIGHT = 6;
const ORIENTING = [SHIELD, SPEAR, STAG];
const FORMATION_POWER = 9;
const FACES = [0, 1, 2, 3];
/** One option per alignment for a die placed on `place`. */
const withFaces = (opt) => FACES.map((face) => ({ ...opt, face }));

const A = {
  agile: "KoS.sword.agile",
  support: "KoS.sword.support",
  relentless: "KoS.sword.relentless",
  rescue: "KoS.sword.relentless_rescue",
  strike: "KoS.shield.shield_strike",
  toSpears: "KoS.shield.to_the_spears",
  thrust: "KoS.spear.heart_thrust",
  leadership: "KoS.commander.leadership",
  supply: "KoS.commander.supply",
  back: "KoS.stag.crown_path_back",
  reinforcements: "KoS.knight.reinforcements",
};

const empty = (s, at) => !s.board[at];
const isOwn = (s, at, player, level) => {
  const d = s.board[at];
  return !!d && d.owner === player && (level === undefined || d.level === level);
};
const isKoS = (s, d) => !!d && s.players[d.owner].set === "KoS";

/** The 3 fields in front of a creature (front-left, front, front-right). */
function frontSurrounding(at, dir) {
  const [dr, dc] = [[-1, 0], [0, 1], [1, 0], [0, -1]][dir];
  const r = rowOf(at), c = colOf(at);
  const cells = dr ? [[r + dr, c - 1], [r + dr, c], [r + dr, c + 1]] : [[r - 1, c + dc], [r, c + dc], [r + 1, c + dc]];
  return cells.filter(([y, x]) => onBoard(y, x)).map(([y, x]) => sq(y, x));
}

/** Free fields along the edges of the board, except the opposing Supply Zone. */
function edgeFields(s, player) {
  const opp = supplyRow(opponent(player));
  const out = [];
  for (let at = 0; at < SQUARES; at++) {
    const r = rowOf(at), c = colOf(at);
    if (!empty(s, at) || r === opp) continue;
    if (r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1) out.push(at);
  }
  return out;
}

// --- First Sword -----------------------------------------------------------------

/** KoS.sword.agile: also the diagonal fields (orthogonal ones are standard moves). */
const agileMoves = (s, from) =>
  diagonal(from).filter((t) => empty(s, t)).map((to) => ({ type: "move", ability: A.agile, from, to }));

/** KoS.sword.support: +1 for a surrounding friendly creature or -1 for a
 *  surrounding opposing one; then the First Sword goes back to the Reserve. */
function supportActions(s, at) {
  const player = s.board[at].owner;
  const out = [];
  for (const t of surrounding(at)) {
    const d = s.board[t];
    if (!d) continue;
    if (d.owner === player) {
      if (d.level < 6 && canRaise(s, t)) out.push({ type: "spell", ability: A.support, at, target: t, delta: 1 });
    } else if (!isProtected(s, t, "spell")) {
      out.push({ type: "spell", ability: A.support, at, target: t, delta: -1 });
    }
  }
  return out;
}

const actedSwords = (s) => s.turn.flags.swordsActed || [];
function markActed(s, id) {
  if (!actedSwords(s).includes(id)) s.turn.flags.swordsActed = [...actedSwords(s), id];
}

/** KoS.sword.relentless: another First Sword that has not acted yet this turn
 *  may take an additional action. */
function relentlessOptions(s, pending) {
  const player = pending.player;
  const acted = actedSwords(s);
  const subs = [];
  for (const at of diceOf(s, player, SWORD)) {
    if (acted.includes(s.board[at].id)) continue;
    subs.push(...standardActionsOf(s, at), ...agileMoves(s, at), ...supportActions(s, at));
  }
  if (!subs.length) return [];
  return [...subs.map((sub) => ({ type: "choice", kind: A.relentless, sub })), { type: "choice", kind: A.relentless, skip: true }];
}

// --- Loyal Shield ------------------------------------------------------------------

/** KoS.shield.shield_strike: push a frontally adjacent opposing creature 1 field
 *  in a straight line and follow it (a Movement of the Shield). Over the edge or
 *  onto an own creature it is defeated (no Field Bonus). */
function strikeActions(s, from) {
  const shield = s.board[from];
  const out = [];
  for (let d = 0; d < 4; d++) { // turned before the action (pre) or already facing d
    const target = step(from, d);
    if (target < 0) continue;
    const t = s.board[target];
    if (!t || t.owner === shield.owner || !canMove(s, target) || isProtected(s, target, "speciality")) continue;
    // KoS.shield.resistance of an opposing Loyal Shield facing us.
    if (isKoS(s, t) && t.level === SHIELD && step(target, t.dir) === from) continue;
    const dest = step(target, d);
    if (dest >= 0 && s.board[dest] && s.board[dest].owner === t.owner) continue; // not onto its own creatures
    const strike = { type: "move", ability: A.strike, from, target, dir: d, to: target };
    // Facing another way: the Shield turns first and then may not turn afterwards.
    out.push(d === shield.dir ? strike : { ...strike, pre: d });
  }
  return out;
}

function applyStrike(s, a) {
  const player = s.board[a.from].owner;
  const dest = step(a.target, a.dir);
  if (dest < 0 || s.board[dest]) {
    defeat(s, a.target, player, { fieldBonus: false, cause: "shield_strike" });
  } else {
    relocate(s, [a.target, dest]);
  }
  doMove(s, a.from, a.target);
}

// --- Silver Spear --------------------------------------------------------------------

/** KoS.spear.heart_thrust: attack in a straight line over an adjacent own Loyal Shield. */
function thrustActions(s, from) {
  const spear = s.board[from];
  const out = [];
  for (let d = 0; d < 4; d++) {
    const over = step(from, d);
    if (over < 0 || !isOwn(s, over, spear.owner, SHIELD)) continue;
    const to = step(over, d);
    if (to >= 0 && canDefeatWith(s, spear, from, to)) out.push({ type: "attack", ability: A.thrust, from, over, to });
  }
  return out;
}

/** KoS.spear.phalanx: after anything moved, opposing creatures that ended up
 *  right in front of a Silver Spear (a moved Spear, or a creature that moved
 *  in front of one) lose 1 Power Level; level 1 goes to the Exile. */
function phalanx(s, player) {
  const victims = new Set();
  for (const ev of s.events) {
    if (ev.t !== "move") continue;
    const at = ev.path[ev.path.length - 1];
    const d = s.board[at];
    if (!d) continue;
    if (d.owner === player && d.level === SPEAR) {
      const f = step(at, d.dir);
      if (f >= 0 && s.board[f] && s.board[f].owner !== player) victims.add(f);
    } else if (d.owner !== player) {
      for (const spear of diceOf(s, player, SPEAR)) if (step(spear, s.board[spear].dir) === at) victims.add(at);
    }
  }
  for (const v of victims) {
    const d = s.board[v];
    if (!d || isProtected(s, v, "speciality")) continue;
    setLevel(s, v, d.level - 1, { byPlayer: player });
  }
}

// --- Commander -----------------------------------------------------------------------

/** Movements a creature can make (standard and special, no attacks). */
function movementsOf(s, at) {
  const d = s.board[at];
  const out = standardMoves(s, at).map((to) => ({ type: "move", from: at, to }));
  if (d.level === SWORD) out.push(...agileMoves(s, at));
  if (d.level === STAG) out.push(...backMoves(s, at));
  return out;
}

function leadershipOptions(s, pending) {
  const { player } = pending;
  const tp = s.players[player].tp;
  const subs = [];
  for (const at of diceOf(s, player)) {
    const d = s.board[at];
    if (at === pending.data.caster || pending.data.moved.includes(d.id) || d.level > tp) continue;
    subs.push(...movementsOf(s, at));
  }
  if (!subs.length) return [];
  return [
    ...decorate(s, player, subs).map((sub) => ({ type: "choice", kind: A.leadership, sub })),
    { type: "choice", kind: A.leadership, finish: true },
  ];
}

let checkingThreat = false;
/** Could the opponent defeat the creature on `at` with their next action? */
function threatened(s, at) {
  if (checkingThreat) return false;
  checkingThreat = true;
  try {
    const opp = opponent(s.board[at].owner);
    const view = { ...s, current: opp, pending: [] };
    return mainActions(view).some((a) => a.type === "attack" && a.to === at);
  } finally {
    checkingThreat = false;
  }
}

function commanderActions(s, at) {
  const player = s.board[at].owner;
  const p = s.players[player];
  const out = [];
  // KoS.commander.leadership
  if (p.reserve >= 1 && p.tp >= 1 && diceOf(s, player).some((x) => x !== at && s.board[x].level <= p.tp && movementsOf(s, x).length)) {
    out.push({ type: "spell", ability: A.leadership, at });
  }
  // KoS.commander.supply: 4 First Swords on the edges, if the Commander is not threatened.
  if (p.reserve >= 4 && edgeFields(s, player).length >= 4 && !threatened(s, at)) {
    out.push({ type: "spell", ability: A.supply, at });
  }
  return out;
}

// --- Burning Stag ----------------------------------------------------------------------

/** KoS.stag.crown_path: 1 field backwards (Movement only). */
function backMoves(s, from) {
  const d = s.board[from];
  const to = step(from, (d.dir + 2) % 4);
  return to >= 0 && empty(s, to) ? [{ type: "move", ability: A.back, from, to }] : [];
}

// --- King's Knight ----------------------------------------------------------------------

/** KoS.knight.breakthrough: 1 virtual VP per Formation with Power Level 9+. */
function breakthrough(s, player) {
  if (!countLevel(s, player, KNIGHT)) return 0;
  const seen = new Set();
  let vp = 0;
  for (const start of diceOf(s, player)) {
    if (seen.has(start)) continue;
    let sum = 0;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const x = stack.pop();
      sum += s.board[x].level;
      for (const n of adjacent(x)) {
        if (!seen.has(n) && isOwn(s, n, player)) { seen.add(n); stack.push(n); }
      }
    }
    if (sum >= FORMATION_POWER) vp++;
  }
  return vp;
}

const REINF_ORDER = [SPEAR, SHIELD, SWORD];

function reinforcementOptions(s, pending) {
  const { at, stage } = pending.data;
  if (s.players[pending.player].reserve < 1) return [];
  const free = surrounding(at).filter((t) => empty(s, t));
  const level = REINF_ORDER[stage];
  const out = [];
  for (const place of free) {
    out.push(...withFaces({ type: "choice", kind: A.reinforcements, place }));
  }
  return out;
}

// --- Orientation ---------------------------------------------------------------------------

/** Alignment with every Movement and Attack (a.pre: turned before the action,
 *  a.face: alignment after it):
 *  - Loyal Shield (Mindfulness): before OR after the action, not both.
 *  - Silver Spear (Impatience, Daniel 2026-11-11): before and/or after.
 *  - Burning Stag (Cautiousness): after the action.
 *  Turning before a Movement or Attack that does not depend on the alignment
 *  gives the same result as turning afterwards; these variants are marked
 *  `redundant` so the AI skips them (the UI offers them when a die is clicked). */
function decorate(s, player, actions) {
  const out = [];
  for (const a of actions) {
    if ((a.type === "move" || a.type === "attack") && a.face === undefined) {
      const d = s.board[actionOrigin(a)];
      if (d && d.owner === player && ORIENTING.includes(d.level)) {
        if (d.level === SHIELD && a.pre !== undefined) { out.push(a); continue; } // Shield Strike after turning
        for (const face of FACES) out.push({ ...a, face });
        if (d.level === STAG) continue;
        for (const pre of FACES) {
          if (pre === d.dir) continue;
          if (d.level === SHIELD) out.push({ ...a, pre, redundant: true });
          else for (const face of FACES) out.push({ ...a, pre, face, redundant: true });
        }
        continue;
      }
    }
    out.push(a);
  }
  return out;
}

// --- Set definition -------------------------------------------------------------------------

export const KoS = {
  id: "KoS",
  name: "Knights of Steel",
  creatures: {
    1: "First Sword", 2: "Loyal Shield", 3: "Silver Spear",
    4: "Commander", 5: "Burning Stag", 6: "King's Knight",
  },

  // KoS.stag.crown_path: Movement and Attack only to the 3 frontal fields.
  stepTargets: (s, from, die) => (die.level === STAG ? frontSurrounding(from, die.dir) : null),

  // KoS.shield.resistance: no attacks from the frontally adjacent field.
  isImmuneToAttack(s, to, from) {
    const d = s.board[to];
    return d.level === SHIELD && step(to, d.dir) === from;
  },

  decorateActions: decorate,

  extraActions(s, player) {
    const out = [];
    for (const at of diceOf(s, player)) {
      switch (s.board[at].level) {
        case SWORD: out.push(...agileMoves(s, at), ...supportActions(s, at)); break;
        case SHIELD: out.push(...strikeActions(s, at)); break;
        case SPEAR: out.push(...thrustActions(s, at)); break;
        case COMMANDER: out.push(...commanderActions(s, at)); break;
        case STAG: out.push(...backMoves(s, at)); break;
        case KNIGHT:
          if (s.players[player].reserve >= 3 && surrounding(at).filter((t) => empty(s, t)).length >= 3) {
            out.push({ type: "spell", ability: A.reinforcements, at });
          }
          break;
      }
    }
    return out;
  },

  applyAbility(s, a) {
    const player = s.current;
    switch (a.ability) {
      case A.agile:
      case A.back:
        doMove(s, a.from, a.to);
        break;
      case A.support: {
        const sword = s.board[a.at];
        markActed(s, sword.id);
        setLevel(s, a.target, s.board[a.target].level + a.delta, { byPlayer: player });
        removeDie(s, a.at, "reserve", "support");
        pushChoice(s, player, A.relentless);
        break;
      }
      case A.strike:
        applyStrike(s, a);
        break;
      case A.thrust:
        doAttack(s, a.from, a.to, [a.from, a.over, a.to]);
        break;
      case A.leadership:
        exileFromReserve(s, player, 1);
        pushChoice(s, player, A.leadership, { caster: a.at, moved: [] });
        break;
      case A.supply:
        pushChoice(s, player, A.supply, { at: a.at, left: 4 });
        break;
      case A.reinforcements:
        pushChoice(s, player, A.reinforcements, { at: a.at, stage: 0 });
        break;
      default:
        throw new Error(`Unknown KoS ability: ${a.ability}`);
    }
  },

  // KoS.sword.relentless (first part): a First Sword moved.
  afterMoveOrAttack(s, at, die) {
    const last = s.turn.lastStep;
    if (die.level !== SWORD || !last || last.attack || last.to !== at) return;
    markActed(s, die.id);
    pushChoice(s, die.owner, A.relentless);
  },

  onLeave(s, at, die, cause, dest) {
    // KoS.commander.moral_boost: lose 2 TP when a Commander leaves the board.
    if (die.level === COMMANDER) gainTP(s, die.owner, -2);
    // KoS.sword.relentless (second part): instead of the Exile, back on an edge field.
    if (die.level === SWORD && dest === "exile") pushChoice(s, die.owner, A.rescue);
  },

  onLevelChange(s, at, die, oldLevel) {
    if (oldLevel === COMMANDER) gainTP(s, die.owner, -2);
  },

  onTurnStart(s, player) {
    // KoS.commander.moral_boost: 1 TP per own Commander at the beginning of your turn.
    gainTP(s, player, countLevel(s, player, COMMANDER));
    // KoS.shield.to_the_spears: more than 3 Loyal Shields -> upgrade all but 3.
    const extra = countLevel(s, player, SHIELD) - 3;
    if (extra > 0) pushChoice(s, player, A.toSpears, { left: extra });
  },

  afterAction: phalanx,

  choiceOptions(s, pending) {
    const player = pending.player;
    switch (pending.kind) {
      case A.relentless: return relentlessOptions(s, pending);
      case A.rescue:
        if (s.players[player].exile < 1) return [];
        return [...edgeFields(s, player).flatMap((place) => withFaces({ type: "choice", kind: A.rescue, place })), { type: "choice", kind: A.rescue, skip: true }];
      case A.toSpears:
        return diceOf(s, player, SHIELD).map((upgrade) => ({ type: "choice", kind: A.toSpears, upgrade }));
      case A.leadership: return leadershipOptions(s, pending);
      case A.supply:
        if (s.players[player].reserve < 1) return [];
        return edgeFields(s, player).flatMap((place) => withFaces({ type: "choice", kind: A.supply, place }));
      case A.reinforcements: return reinforcementOptions(s, pending);
      default: return [];
    }
  },

  resolveChoice(s, pending, a) {
    const player = pending.player;
    switch (pending.kind) {
      case A.relentless:
        if (a.skip) break;
        markActed(s, s.board[actionOrigin(a.sub)].id);
        performAction(s, a.sub);
        break;
      case A.rescue:
        if (!a.skip) placeDie(s, a.place, player, SWORD, { source: "exile", cause: "relentless", dir: a.face ?? defaultDir(player) });
        break;
      case A.toSpears:
        setLevel(s, a.upgrade, s.board[a.upgrade].level + 1);
        if (pending.data.left > 1) pushChoice(s, player, A.toSpears, { left: pending.data.left - 1 });
        break;
      case A.leadership: {
        if (a.finish) break;
        const d = s.board[actionOrigin(a.sub)];
        gainTP(s, player, -d.level);
        performAction(s, a.sub);
        pushChoice(s, player, A.leadership, { ...pending.data, moved: [...pending.data.moved, d.id] });
        break;
      }
      case A.supply: {
        placeDie(s, a.place, player, SWORD, { dir: a.face ?? defaultDir(player) });
        const left = pending.data.left - 1;
        if (left > 0) pushChoice(s, player, A.supply, { ...pending.data, left });
        else removeDie(s, pending.data.at, "reserve", "split");
        break;
      }
      case A.reinforcements: {
        const level = REINF_ORDER[pending.data.stage];
        placeDie(s, a.place, player, level, { dir: a.face ?? defaultDir(player) });
        if (pending.data.stage < 2) pushChoice(s, player, A.reinforcements, { ...pending.data, stage: pending.data.stage + 1 });
        else removeDie(s, pending.data.at, "reserve", "split");
        break;
      }
      default:
        throw new Error(`Unknown KoS choice: ${pending.kind}`);
    }
  },

  virtualVP: breakthrough,

  aiGreedyChoices: [A.relentless, A.rescue, A.toSpears, A.leadership, A.supply, A.reinforcements],

  actionPath(a) {
    switch (a.ability || a.kind) {
      case A.agile: return [a.from, a.to];
      case A.back: return [a.from, a.to];
      case A.support: return [a.at, "Support", a.target];
      case A.strike: return [a.from, "Shield Strike", a.target];
      case A.thrust: return [a.from, a.to];
      case A.leadership: return a.finish ? ["Finish Leadership"] : a.at !== undefined ? [a.at, "Leadership"] : ["Skip"];
      case A.supply: return a.place !== undefined ? [a.place] : [a.at, "Supply"];
      case A.reinforcements: return a.place !== undefined ? [a.place] : [a.at, "Reinforcements"];
      case A.relentless: return ["Skip"]; // other options use the path of their action
      case A.rescue: return a.skip ? ["Skip"] : [a.place];
      case A.toSpears: return [a.upgrade];
      default: throw new Error(`No click path for ${a.ability || a.kind}`);
    }
  },

  pendingPrompt(p) {
    switch (p.kind) {
      case A.relentless: return "Relentless: an additional action for another First Sword that has not acted yet, or skip.";
      case A.rescue: return "Relentless: place the First Sword on a free edge field instead of the Exile, or skip.";
      case A.toSpears: return `To the Spears: choose a Loyal Shield to upgrade (${p.data.left} left; 3 stay).`;
      case A.leadership: return "Leadership: move a friendly creature (costs TP = its Power Level), or finish.";
      case A.supply: return `Supply: place a First Sword on a free edge field (${p.data.left} left).`;
      case A.reinforcements: return `Reinforcements: place the ${["Silver Spear", "Loyal Shield", "First Sword"][p.data.stage]} on a free surrounding field.`;
      default: return "Make a choice.";
    }
  },
};
