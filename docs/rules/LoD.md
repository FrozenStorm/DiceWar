# Dice set LoD (Light of Dragons, base game)

Source: `img/LoD/rules/1.png` to `6.png` and `marker.png`. Base terms are defined in [base-rules.md](base-rules.md).

## Overview

| Level | Creature | Abilities | Defeats |
|---|---|---|---|
| 1 | Soul | Floating, Protective Barrier | nobody |
| 2 | Ghost | Ghosttrail, Lifepulling, Cursed | 1 |
| 3 | Dragon Warrior | Brotherhood | 2, 1 and 6 |
| 4 | Blood Mage | Blood Trade | 3, 2, 1 |
| 5 | Fire Basilisk | Serpent Trail, Inner Fire | 4, 3, 2, 1 |
| 6 | Light Dragon | Dragon Blood, Luminous Flame | 5, 4, 3, 2, 1 |

## 1 · Soul

### `LoD.soul.floating` (movement)
Move as much as you want over adjacent friendly Souls.
- **[Assumption]** The Soul jumps over a connected chain of friendly Souls (each adjacent to the next) and lands on a free field adjacent to the last Soul jumped.
- **[Question LoD1]** Does this count as a single Movement action? May the direction change within the chain?

### `LoD.soul.protective_barrier` (speciality)
If there are 3 to 6 Souls adjacent to each other (a connected group), a Protective Barrier is formed. Protective Barriers are immune to attacks, spells and specialities of your opponent's creatures.
Card note: if there are more than 6 Souls adjacent to each other, return any remaining Souls to the Reserve at the end of your turn.
- Two Souls do not form a barrier (picture).
- **[Question LoD2]** With more than 6 Souls, who chooses which ones go back to the Reserve? **[Assumption]** The owner, and the remaining 6 must stay connected.

## 2 · Ghost

### `LoD.ghost.ghosttrail` (movement + attack)
Move or attack up to 2 spaces in the same direction. You can move through creatures too.
- Picture: on the left the Ghost moves 2 fields straight to a free field, on the right it moves through an opposing 4 to the free field behind it.
- **[Assumption]** An attack is possible on the 1st or 2nd field in a straight line; the target field must contain a creature the Ghost can defeat.

### `LoD.ghost.lifepulling` (speciality)
If a Ghost moves through another creature, be it your own or your opponent's, this creature loses 1 Power Level. Additionally, you receive 1 TP.
Card note: opposing creatures of Power Level 1 are immediately sent into the Exile. Your own creatures return to the Reserve.

### `LoD.ghost.cursed` (speciality)
If a Ghost is defeated by an opposing creature, this creature's Power Level is downgraded by 2.
- The weakest possible attacker has level 3, so the level never drops below 1.

## 3 · Dragon Warrior

### `LoD.warrior.brotherhood` (spell)
Split a Dragon Warrior into 3 Souls.
Card note: place 2 Reserve Dice as Souls horizontally or vertically adjacent to the Dragon Warrior. Then downgrade the Dragon Warrior to a Soul.
- According to the picture the three Souls form a straight line (vertical or horizontal) with the Dragon Warrior in the middle.
- **[Assumption]** Both target fields must be free.

## 4 · Blood Mage

### `LoD.mage.blood_trade` (spell)
Put up to X Reserve Dice into the Exile to get X+1 TP. X is the number of your Blood Mages in the Warlands. Then use any number of TP to upgrade friendly creatures (1 TP per level). Unused TP lapse at the end of the turn.
Card note: for every used upgrade, the indicator die on the TP bar has to be moved down by 1 field.
Important: the spell can't be used on the Blood Mage casting it.
- **[Question LoD5]** "Up to X" and "X+1 TP" slightly contradict each other. If Y dice are exiled (0 ≤ Y ≤ X), do you get exactly Y+1 TP or always X+1?
- **[Question LoD6]** Do all TP lapse at the end of the turn or only the ones from this spell? This affects TP collected earlier.

## 5 · Fire Basilisk

### `LoD.basilisk.serpent_trail` (movement + attack)
Move or attack always diagonally (instead of orthogonally).

### `LoD.basilisk.inner_fire` (speciality)
Whenever the Fire Basilisk defeats a creature, it can perform one additional Movement or Attack.
- **[Assumption]** Can chain (each further win gives another additional action).

## 6 · Light Dragon

### `LoD.dragon.dragon_blood` (spell)
Split a Light Dragon into 2 Dragon Warriors.
Card note: place 2 Reserve Dice as Dragon Warriors horizontally or vertically adjacent to the Light Dragon. Then put the Light Dragon back to the Reserve.
- **[Assumption]** The two fields can be any two of the 4 adjacent fields and must be free.

### `LoD.dragon.luminous_flame` (speciality)
Gain 1 virtual VP for each creature of Power Level 6 that you have more than your opponent in the Warlands.
Card note: virtual VP are counted the same way as VP gained in combat, but are not displayed on the VP bar.

## Location: The Ruins (`LoD.marker.ruins`)

Before the setup phase, 3 ruin tiles are placed (row/column from 1, seen from player 1, row 1 = top row with +3):
- row 2, column 6
- row 4, column 4 (centre of the board)
- row 6, column 2

Rules:
- **Alternative victory condition:** if a player occupies all ruins at the same time with their own creatures, they win the game at the end of their turn.
- Creatures with Power Level 1 that occupy ruins are put immediately into the Reserve.
