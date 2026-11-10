// Registry of dice sets. Each set module describes one tribe and plugs its
// abilities into the engine through optional hooks:
//
//   canMove(s, at, die)                  -> false forbids Movement (default true)
//   canAttack(s, at, die)                -> false forbids Attack (default: canMove)
//   canUpgrade(s, at, die)               -> false forbids Upgrade
//   beats(s, from, att, def)             -> override the power hierarchy (undefined = default)
//   isImmuneToAttack(s, to, from)        -> defender immunity
//   extraActions(s, player)              -> additional actions (special moves, spells)
//   applyAbility(s, action)              -> resolve an action carrying `ability`
//   afterMoveOrAttack(s, at, die)        -> a die ended its Movement/Attack on `at`
//   onPlaced(s, at, die, cause)          -> a die was placed from the Reserve
//   onLeave(s, at, die, cause)           -> a die left the board
//   onLevelChange(s, at, die, oldLevel)  -> a die was upgraded or downgraded
//   onDefeated(s, at, die, byPlayer, cause)
//   onTurnStart(s, player) / onTurnEnd(s, player)
//   choiceOptions(s, pending)            -> legal answers to a queued decision
//   resolveChoice(s, pending, action)
//   virtualVP(s, player)
//   constrainOpponent(s, player, actions) -> restrict the opponent's main actions
//   immuneTo(s, at, kind)                -> immune against the opponent's "attack" | "spell" | "speciality"
//   stepTargets(s, from, die)            -> fields of a standard step (default: adjacent)
//   afterDefeatedBy(s, at, defeatedDie)  -> a die of this set was defeated by an attack (attacker on `at`)
//   afterAttack(s, at, die)              -> a die of this set defeated a creature by attacking
//   beforeTurnEnd(s, player)             -> may queue last decisions before the turn ends
//   defeatRules(s, at, die)             -> { noVP, dest } for a defeat of this set's creature
//   aiGreedyChoices                      -> decision kinds the AI resolves greedily
//
// Rule texts: docs/rules/<SET>.md. Ability IDs in the code match the docs.

import { RoX } from "./rox.js";
import { BoD } from "./bod.js";
import { LoD } from "./lod.js";
import { RoM } from "./rom.js";

const plain = {
  id: "plain",
  name: "Plain dice (no abilities)",
  creatures: { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6" },
};

const SETS = { plain, RoX, BoD, LoD, RoM };

const defaults = {
  choiceOptions: () => [],
  resolveChoice: () => { throw new Error("This set has no decisions."); },
  applyAbility: (s, a) => { throw new Error(`Unknown ability: ${a.ability}`); },
};

for (const id of Object.keys(SETS)) SETS[id] = { ...defaults, ...SETS[id] };

/** Dice sets with implemented rules. */
export const IMPLEMENTED_SETS = Object.keys(SETS);

export function getSet(id) {
  const set = SETS[id];
  if (!set) throw new Error(`Dice set "${id}" is not implemented in the rules engine yet.`);
  return set;
}
