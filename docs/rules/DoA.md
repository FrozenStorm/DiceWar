# Dice set DoA (Awakening)

Source: `img/DoA/rules/1.png` to `6.png` and `marker.png`. Base terms are defined in [base-rules.md](base-rules.md).

## Overview

| Level | Creature | Abilities | Defeats |
|---|---|---|---|
| 1 | Tidal Fisher | Godcatcher, Rest Breaker | depends on the number of Fishers (see below) |
| 2 | Dream Bringer | Water Path, Depth Rapture, World Sleep | 1 |
| 3 | River Watch | Wave Ride | 2, 1 and 6 |
| 4 | Water Weaver | Water Pearls, Ghost Call, Thread of Fate | 3, 2, 1 |
| 5 | Ohtilia | From the Fog | 4, 3, 2, 1 |
| 6 | Awakening | Twilight Hour, New Beginning, Sint Flut | 5, 4, 3, 2, 1 |

## 1 · Tidal Fisher

### `DoA.fisher.godcatcher` (speciality)
At the end of your turn, if there are more than 3 of your own Tidal Fishers in the Warlands, put one of them into the Reserve and, if possible, upgrade a friendly creature in your zone by 1 Power Level. Repeat this until there are no more than 3 of your own Tidal Fishers in the Warlands.

### `DoA.fisher.rest_breaker` (attack)
During your attack, the Power Level of the Tidal Fisher is equal to the sum of all own Tidal Fishers in the Warlands.
Power hierarchy according to the card:
- 1 Fisher: defeats nobody
- 2 Fishers: defeats 1
- 3 Fishers: defeats 1, 2 and 6
- 4 Fishers: defeats 1, 2 and 3
- **[Assumption]** The level only applies when attacking. As a defender the Fisher stays level 1. More than 4 Fishers are impossible at the end of a turn because of Godcatcher, but possible during a turn (e.g. after New Beginning); then the normal hierarchy of the sum applies.

## 2 · Dream Bringer

### `DoA.dreambringer.water_path` (movement)
Move straight in any direction (including diagonally) up to 3 spaces.
- **[Assumption]** Only over free fields, no attack with this.

### `DoA.dreambringer.depth_rapture` (speciality)
If the Dream Bringer is defeated, you receive 2 TP.

### `DoA.dreambringer.world_sleep` (speciality)
Surrounding opposing creatures (8 neighbouring fields) cannot perform Spell actions.

## 3 · River Watch

### `DoA.riverwatch.wave_ride` (movement)
Move any distance around a surrounding friendly creature, or any distance around multiple surrounding friendly creatures. End the movement on a surrounding space of the friendly creature, but not on the original space.
- **[Assumption]** The path runs over free fields that surround a friendly creature (ring of 8 neighbouring fields). With several friendly creatures, the River Watch may switch from one ring to an adjacent ring.
- **[Question DoA1]** May the movement include diagonal steps, or only orthogonal ones (the example arrows are orthogonal)?

## 4 · Water Weaver

### `DoA.weaver.water_pearls` (speciality)
Gain 1 TP at the start of each round, provided there is at least 1 own Water Weaver in the Warlands. If your last Water Weaver leaves the Warlands, you lose 1 TP.
- **[Question DoA2]** "At the start of each round" (once for both players) or at the beginning of your turn?

### `DoA.weaver.ghost_call` (spell)
Split the Water Weaver into 1 River Watch and 1 Tidal Fisher.
Card note: place a Reserve Die adjacent to the Water Weaver into play as a River Watch or Tidal Fisher. Place a Reserve Die adjacent to this creature in reverse into play as a Tidal Fisher or River Watch. Return the Water Weaver to the Reserve.
- Picture: River Watch to the right of the Weaver, Tidal Fisher below the River Watch (i.e. diagonal to the Weaver).

### `DoA.weaver.thread_of_fate` (spell)
Put a Reserve Die into Exile and use 2 TP. Upgrade or downgrade a surrounding opposing creature by 1 Power Level, and in reverse, downgrade or upgrade a surrounding friendly creature by 1 Power Level.
- Picture: opposing 5 becomes 4, own Tidal Fisher 1 becomes Dream Bringer 2.

## 5 · Ohtilia

### `DoA.ohtilia.from_the_fog` (movement)
Swap Ohtilia with an adjacent creature. Then immediately make a standard move with Ohtilia if possible.
- Also works with opposing creatures (picture: opposing 6).
- **[Question DoA3]** Is the follow-up move mandatory ("if possible"), and may it be an attack? **[Assumption]** Mandatory, movement only.

## 6 · Awakening

### `DoA.awakening.twilight_hour` (speciality)
Gain 1 virtual VP per Awakening that is in an open line horizontally or vertically to a friendly Awakening in the Warlands (max. 1 virtual VP per Awakening).
Card note: there must be at least 1 free space between the Awakenings; "open" means nothing stands between them.

### `DoA.awakening.new_beginning` (spell)
Split the Awakening into 1 River Watch and 3 Tidal Fishers.
Card note: place 3 Reserve Dice as Tidal Fishers on any empty spaces in the game. Downgrade the Awakening to a River Watch.

### `DoA.awakening.sint_flut` (spell)
Put 1 Reserve Die into Exile and use 10 TP. Choose a horizontal or vertical direction. Move all opposing creatures 1 space in the chosen direction. If creatures are moved over the edge of the board this way, they are put into Exile. Gain 1 VP for each creature defeated this way (no Field Bonus).
Card note: if your own creatures block your opponent's creatures during the movement, they are not moved.
- **[Assumption]** Opposing creatures also block each other in a chain (processed from front to back in the push direction).

## Location: The River (`DoA.marker.river`)

Before the setup phase, the river tile is placed. It covers 3 fields of one column in the three middle rows (rows 3 to 5). The players agree on a column in the centre of the board. In the picture the flow points to the right (seen from player 1).

Rules:
- Creatures on free spaces in the three middle rows are moved one space in the direction of the flow at the end of each turn of the starting player.
- If creatures are moved over the edge of the board this way, they are put into Exile. The opponent receives VP according to the Power Level of the exiled creatures (no Field Bonus).
- Creatures on the river tile itself or on other location tiles are not moved by the flow.
- Creatures can be moved onto location tiles. If these are occupied, the creature on the location tile is pushed away and moved down from the tile in the direction of the flow.
- **[Question DoA4]** Which columns are allowed (dashed in the picture: columns 2 and 5 from the left, the tile lies in column 2)? And who sets the flow direction?
- **[Question DoA5]** "The opponent receives VP": the opponent of the creature's owner? I.e. whoever loses a creature gives the other player VP?
