# Dice set RoM (Roots of Mali)

Source: `img/RoM/rules/1.png` to `6.png` and `marker.png`. Base terms are defined in [base-rules.md](base-rules.md).

**Status: validated, implemented.** All open questions were answered by the rules owner.

## Overview

| Level | Creature | Abilities | Defeats |
|---|---|---|---|
| 1 | Golden Fruit | Fake Gold, Breeding | nobody |
| 2 | Sprout | Velocity, Golden Seed, Tenacity | 1 |
| 3 | Torch Bearer | Fire Demon | 2, 1 and 6 |
| 4 | Protectress of the Woods | Fellowship, Breath of Life, Symbiosis | 3, 2, 1 |
| 5 | Shadow Runner | Secret Pathway, Out of the Dark | 4, 3, 2, 1 |
| 6 | Mali | Children of the Woods, Deep Roots | 5, 4, 3, 2, 1 |

## 1 · Golden Fruit

### `RoM.fruit.fake_gold` (speciality)
The Golden Fruit cannot move and its Power Level cannot be increased. If you defeat a Golden Fruit you neither receive VP nor Field Bonus. A defeated Golden Fruit is returned to your Reserve.
- Exception: Breath of Life (Protectress) explicitly increases the level of a Golden Fruit. Confirmed: the Protectress card takes precedence; Fake Gold only forbids the Upgrade standard action.
- Confirmed (RoM1): a defeated Golden Fruit goes back to the Reserve of its owner.

### `RoM.fruit.breeding` (spell)
Split the Golden Fruit into 2 Golden Fruits.
Card note: place 2 Reserve Dice as Golden Fruits horizontally or vertically adjacent to this Golden Fruit. Then put this Golden Fruit back to the Reserve.
- Confirmed (RoM7): same as BoD Servitude: both Golden Fruits on opposite sides in a horizontal or vertical line.

## 2 · Sprout

### `RoM.sprout.velocity` (movement + attack)
Move or attack up to 2 spaces in the same direction.
- Confirmed: unlike the LoD Ghost, not through creatures; the intermediate field must be free.

### `RoM.sprout.golden_seed` (speciality)
If the Sprout moves just one space, you may place a Golden Fruit from your Reserve on the space it moved from.
- Confirmed (RoM2): only after a Movement, not after an attack.

### `RoM.sprout.tenacity` (speciality)
If an opposing creature attacks the Sprout, the opponent has to put 2 of their Reserve Dice into the Exile, if possible.
Card note: the attack may be performed even if the opponent has fewer than 2 or no dice in their Reserve.

## 3 · Torch Bearer

### `RoM.torch.fire_demon` (movement + attack)
Move or attack by leaping over one or more of your creatures of Power Level 1, 2 and 6 that are adjacent to each other. Put the leaped-over creatures back into your Reserve.
- Picture: the Torch Bearer leaps over a row of Golden Fruit (1), Sprout (2) and Mali (6). It lands diagonally above the Mali, to the right of a Golden Fruit. Leaped-over creatures are shown grey (removed), the Golden Fruit above the Mali stays black.
- Confirmed (RoM3): the Torch Bearer can follow the chain around corners, and all leaped-over creatures go back into the Reserve, including a Mali (6).
- Confirmed (RoM6): the Torch Bearer lands on a field orthogonally adjacent to the last leaped-over creature (free field = Movement, defeatable opposing creature = Attack).

## 4 · Protectress of the Woods

### `RoM.protectress.fellowship` (speciality)
Receive 1 TP at the beginning of your turn for each of your Protectresses of the Woods in the Warlands.
Card note: lose all TP as soon as you have no Protectress of the Woods in the Warlands.

### `RoM.protectress.breath_of_life` (spell)
Put 1 Reserve Die into your Exile. Use any available TP to increase the Power Level of one of your Golden Fruits.
Card example: 4 TP = +4 levels (Golden Fruit 1 becomes Shadow Runner 5).
- Confirmed: maximum level 6, so at most 5 TP.

### `RoM.protectress.symbiosis` (upgrade)
Yellow bar, i.e. a variant of the Upgrade standard action: move your Protectress of the Woods onto an adjacent Golden Fruit you own. Put the Golden Fruit back into your Reserve. Now increase the Power Level of the Protectress by 1 (she becomes a Shadow Runner).

## 5 · Shadow Runner

### `RoM.runner.secret_pathway` (movement + attack)
Move or attack once per turn out of the board, beyond the side line of the Warlands, and back in on the opposite side (Fig. 1). Subsequently you may perform another Movement or Attack (Fig. 2). Secret Pathway may be combined with Out of the Dark.
- Only left/right (side lines), not top/bottom.
- Confirmed: the follow-up action is a normal Movement or Attack (1 field orthogonally). Fig. 2 shows up, right and down as targets.

### `RoM.runner.out_of_the_dark` (movement + attack)
Move or attack by leaping over an adjacent Shadow Runner you own. May be combined with Secret Pathway.

## 6 · Mali

### `RoM.mali.children_of_the_woods` (spell)
Split a Mali into 3 Sprouts.
Card note: place 3 Reserve Dice as Sprouts anywhere in your zone. Then put the Mali back to the Reserve.
- The picture confirms: your zone is the 3 rows on your side (including the back row). This also applies when the Mali stands in the opponent zone.

### `RoM.mali.deep_roots` (speciality)
Receive 1 virtual VP for each of your Mali in the opponent's zone.

## Location: The Camp (`RoM.marker.camp`)

During the setup phase each player places their camp on any free space in their Supply Zone.

Rules:
- If you move a creature into your own camp, return this creature instantly to your Reserve.
- If you move a creature into your opponent's camp, put this creature instantly into your Exile. Your opponent has to put creature dice into their Exile equal to the Power Level of the creature you exiled.
- Confirmed (RoM4): the opponent takes these dice from their Reserve.
- Note: The Camp is the RoM location card only (the KoS card is The Knoll).
- Confirmed (RoM5): when this location is used, both players always have a camp, whatever dice sets they play.
- Engine: only *moving* into a camp (Movement, Attack or any ability that moves the creature) triggers it; placing a die there does not. If the opponent has fewer Reserve Dice, they exile as many as they have.
