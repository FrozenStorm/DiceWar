# Dice set DoA (Dawn of Awakening)

Source: `img/DoA/rules/1.png` to `6.png` and `marker.png`. Base terms are defined in [base-rules.md](base-rules.md).

Status: validated by Daniel (all questions answered). Implemented in `engine/sets/doa.js` and `engine/locations/index.js` (river).

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
- **[Confirmed]** The level only applies when attacking. As a defender the Fisher stays level 1. More than 4 Fishers are impossible at the end of a turn because of Godcatcher, but possible during a turn (e.g. after New Beginning); then the normal hierarchy of the sum applies.

## 2 · Dream Bringer

### `DoA.dreambringer.water_path` (movement)
Move straight in any direction (including diagonally) up to 3 spaces.
- **[Confirmed]** Only over free fields, no attack with this.

### `DoA.dreambringer.depth_rapture` (speciality)
If the Dream Bringer is defeated, you receive 2 TP.

### `DoA.dreambringer.world_sleep` (speciality)
Surrounding opposing creatures (8 neighbouring fields) cannot perform Spell actions.

## 3 · River Watch

### `DoA.riverwatch.wave_ride` (movement)
Move any distance around a surrounding friendly creature, or any distance around multiple surrounding friendly creatures. End the movement on a surrounding space of the friendly creature, but not on the original space.
- **[Confirmed]** The path runs over free fields that surround a friendly creature (ring of 8 neighbouring fields). With several friendly creatures, the River Watch may switch from one ring to an adjacent ring.
- **[Answer DoA1]** Only orthogonal steps.

## 4 · Water Weaver

### `DoA.weaver.water_pearls` (speciality)
Gain 1 TP at the start of each round, provided there is at least 1 own Water Weaver in the Warlands. If your last Water Weaver leaves the Warlands, you lose 1 TP.
- **[Answer DoA2]** Only at the beginning of your own turn.

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
- **[Answer DoA3]** The follow-up move is mandatory if possible, and it is a Movement only (no attack). If no Movement is possible, Ohtilia only swaps.

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
- **[Answer]** Opposing creatures only block each other where one of them could not move because of an own creature (processed from front to back in the push direction): a creature behind a moving creature moves along, a creature behind a blocked creature is blocked as well.

## Location: The River (`DoA.marker.river`)

Before the setup phase, the river tile is placed. It covers 3 fields of one column in the three middle rows (rows 3 to 5). The players agree on a column; every column is allowed (DoA4). The flow always points to the right (seen from player 1).

Rules:
- Creatures on free spaces in the three middle rows are moved one space in the direction of the flow at the end of each turn of the starting player.
- If creatures are moved over the edge of the board this way, they are put into Exile. The opponent receives VP according to the Power Level of the exiled creatures (no Field Bonus).
- Creatures on the river tile itself or on other location tiles are not moved by the flow.
- Creatures can be moved onto location tiles. If these are occupied, the creature on the location tile is pushed away and moved down from the tile in the direction of the flow.
- **[Answer DoA4]** Every column is allowed; the flow always points to the right.
- **[Answer DoA5]** Yes: the opponent of the exiled creature's owner receives the VP.

## Engine notes

- Godcatcher is a decision at the end of your turn: choose the Fisher for the Reserve and the creature to upgrade (if any can be upgraded). It repeats while more than 3 Fishers are left.
- World Sleep removes spell actions of opposing creatures that stand on one of the 8 fields around a Dream Bringer.
- Wave Ride: the 1-field moves are the standard Movement; longer rides are listed as the ability.
- Thread of Fate: a creature downgraded below 1 goes into the Exile, also a friendly one (Daniel, 2026-11-11, provisional). A creature already at level 6 cannot be upgraded.
- From the Fog: opposing creatures that cannot be moved or are immune against specialities (e.g. Portals, LoD Protective Barrier) cannot be swapped.
- Sint Flut pushes the opposing creatures; pushing is not a Movement, so it also pushes creatures that cannot move and ignores immunities (Daniel, 2026-11-11). Only own creatures block (and the opposing creatures stuck behind them). Over the edge they are defeated (1 VP each, no Field Bonus).
- The River is chosen in the lobby together with its column. Creatures pushed over the edge are not defeated (Daniel, 2026-11-11): they go into the Exile without defeat effects (no Depth Rapture, no Fake Gold rule), and the opponent of their owner receives VP equal to their Power Level.
- Godcatcher may upgrade any friendly creature in your zone, also another Tidal Fisher (confirmed).
- Water Pearls: a level change of the last Water Weaver counts like leaving the Warlands (-1 TP, confirmed).
