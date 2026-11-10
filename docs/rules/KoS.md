# Dice set KoS (Knights of Steel)

Source: `img/KoS/rules/1.png` to `6.png`, `marker.png`, `rules_1.png`, `rules_2.png`. Base terms are defined in [base-rules.md](base-rules.md).

**Important for the engine:** KoS needs an **alignment** per die (up, right, down, left). The game state must be able to store this for all sets. The current code already has a `rotation` field for this.

## New terms (cards "New Terms & Symbols")

- **Formation:** a cluster or chain of adjacent creatures you own (connected group, orthogonal).
- **Frontal:** fields in the direction of a creature's arrow.
  - *frontally adjacent:* the 1 field directly in front of the creature.
  - *frontally surrounding:* the 3 fields in front of the creature (front-left, front, front-right).
- **Alignment:** indicated by an arrow icon. It influences standard actions and specialities. The icon on the card shows when to orientate: before the action, before or after the action, or after the action.
  - When an action is performed, the creature's current alignment counts.
  - If a Reserve Die is placed as a creature in the Warlands, the player chooses its alignment consciously.
  - If a creature is increased or decreased to another Power Level, it keeps its alignment.
- **Orientate:** rotate the creature in any of the 4 directions.
- **[Question KoS1]** Creatures without an arrow icon (First Sword, Commander, King's Knight) still have an alignment, but it doesn't matter. Correct?

## Overview

| Level | Creature | Abilities | Defeats |
|---|---|---|---|
| 1 | First Sword | Agile, Support, Relentless | nobody |
| 2 | Loyal Shield | Mindfulness, Resistance, Shield Strike, To the Spears | 1 |
| 3 | Silver Spear | Impatience, Phalanx, Heart Thrust | 2, 1 and 6 |
| 4 | Commander | Moral Boost, Leadership, Supply | 3, 2, 1 |
| 5 | Burning Stag | Cautiousness, Crown Path | 4, 3, 2, 1 |
| 6 | King's Knight | Breakthrough, Reinforcements | 5, 4, 3, 2, 1 |

## 1 · First Sword

### `KoS.sword.agile` (movement)
Move the First Sword to any free surrounding space (including diagonally).

### `KoS.sword.support` (spell)
Increase the Power Level of a surrounding friendly creature by 1 or decrease the Power Level of a surrounding opposing creature by 1. Afterwards, put the First Sword back into the Reserve.
- **[Question KoS2]** What happens to an opposing level 1 creature that is decreased (Exile, as with Phalanx)?

### `KoS.sword.relentless` (speciality)
If a First Sword moves or casts a spell, get an additional action for a friendly First Sword that has not yet performed an action this turn.
If a First Sword would be put into Exile, it can instead be placed on any free space along the edges of the board (except the opposing Supply Zone).
- **[Assumption]** The additional action is any standard action of that other First Sword; the chain can continue.

## 2 · Loyal Shield (alignment: before or after the action)

### `KoS.shield.mindfulness` (speciality)
Orient the Loyal Shield before or after each Movement and Attack.

### `KoS.shield.resistance` (speciality)
The Loyal Shield cannot be attacked or moved by frontally adjacent creatures.

### `KoS.shield.shield_strike` (speciality)
If an opposing creature is frontally adjacent to the Loyal Shield, it can be moved 1 space in a straight line. Opposing creatures can thus be moved over the edge of the board or against other creatures you own. The opposing creature is defeated as a result. You do not receive Field Bonus for this action.
Card note: opposing creatures cannot be moved onto other enemy creatures.
- Picture: the Shield pushes an opposing 4 against a friendly First Sword. The 4 is defeated, the Shield advances.
- **[Question KoS3]** Is Shield Strike an action of its own (which standard action does it use?) or does it happen automatically? And is the creature only defeated when pushed against the edge or a friendly creature, or also when pushed onto a free field?

### `KoS.shield.to_the_spears` (speciality)
If there are more than 3 of your own Loyal Shields in the Warlands at the beginning of your turn, upgrade all but 3 Loyal Shields by 1 Power Level.
- **[Question KoS4]** Who chooses which 3 stay? **[Assumption]** The owner.

## 3 · Silver Spear (alignment: before the action)

### `KoS.spear.impatience` (speciality)
Orient the Silver Spear before every Movement and Attack.

### `KoS.spear.phalanx` (speciality)
If a Silver Spear is moved to the frontally adjacent space between her and an opposing creature, or vice versa, if an opposing creature is moved to the frontally adjacent space in front of a Silver Spear, decrease the opposing creature's Power Level by 1. Alignment must be taken into account.
Card note: opposing creatures of Power Level 1 are exiled.
- Picture: an opposing 4 moves in front of the Spear's tip and becomes a 3.

### `KoS.spear.heart_thrust` (attack)
Attack in a straight line over a friendly adjacent Loyal Shield.
- Picture: Spear (3), behind it Shield (2), behind that an opposing 6. The Spear defeats the 6.

## 4 · Commander

### `KoS.commander.moral_boost` (speciality)
At the beginning of each turn, receive 1 TP for each Commander you own in the Warlands. Lose 2 TP whenever a Commander leaves the Warlands or when his Power Level is changed.
- **[Question KoS5]** Does "each turn" mean only your own turn, or also the opponent's?

### `KoS.commander.leadership` (spell)
Put 1 Reserve Die into Exile. Use any number of TP to move friendly creatures with the same Power Level in total once.
Card example: put 1 Reserve Die into Exile, use 5 TP to move 1 Silver Spear (3) and 1 Loyal Shield (2).
Card note: Leadership cannot be used on the spellcasting Commander himself.
- **[Question KoS6]** Is each of these moves a normal standard move (1 field or the creature's special movement)? May they attack?

### `KoS.commander.supply` (spell)
Split the Commander into 4 First Swords, if he is not threatened.
Card note: place 4 Reserve Dice as First Swords on any free space on the edges of the board (except the opposing Supply Zone). Afterwards, put the Commander back into the Reserve.
- "Threatened": **[Assumption]** no opposing creature could attack and defeat the Commander in the next turn.

## 5 · Burning Stag (alignment: after the action)

### `KoS.stag.cautiousness` (speciality)
Orient the Burning Stag after every Movement and Attack.

### `KoS.stag.crown_path` (movement + attack)
Move or attack only on frontally surrounding spaces (front-left, front, front-right), or move the Burning Stag 1 space backwards. Alignment must be taken into account.
- Backwards is movement only, no attack (green arrow in the picture).

## 6 · King's Knight

### `KoS.knight.breakthrough` (speciality)
Get 1 virtual VP for each Formation with a total Power Level of 9 or more, if you control at least 1 King's Knight.
- Card examples: 1+2+4+1+1 = 9 gives 1 VP. 4+6+5+6 = 21 also gives only 1 VP (one formation).

### `KoS.knight.reinforcements` (spell)
Split the King's Knight into 1 Silver Spear, 1 Loyal Shield and 1 First Sword.
Card note: place 3 Reserve Dice as Silver Spear, Loyal Shield and First Sword on free spaces surrounding the King's Knight. Afterwards, put the King's Knight back into the Reserve.

## Location: The Camp (`KoS.marker.camp`)

Same as for RoM, see [RoM.md](RoM.md#location-the-camp-rommarkercamp).
