# Dice set RoX (Rise of Xeladron)

Source: `img/RoX/rules/1.png` to `6.png` and `marker.png`. Base terms are defined in [base-rules.md](base-rules.md).

**Status: validated.** All points marked "Confirmed" were decided by the rules owner.

## Overview

| Level | Creature | Abilities | Defeats |
|---|---|---|---|
| 1 | Portal | Unmovable, Wormhole, Resistance | nobody |
| 2 | Portal Bearer | Aerial Maneuver, Arrival, Balance | 1 |
| 3 | Portal Guardian | New Paths | 2, 1 and 6 |
| 4 | Emissary | Energy Circle, Dimensional Summoning | 3, 2, 1 |
| 5 | Enchantress of Gravity | Force of Attraction | 4, 3, 2, 1 |
| 6 | Xeladron | Decay, Impact, Forceful Alliance | 5, 4, 3, 2, 1 |

## 1 · Portal

### `RoX.portal.unmovable` (speciality)
Portals can't use Movement actions.
- Confirmed: this also applies to attacks; a Portal cannot defeat anything anyway.

### `RoX.portal.wormhole` (speciality)
As long as you control at least 1 Portal Bearer, you can move friendly creatures to fields with your Portals. If a friendly creature moves to a Portal, put it on a field with a friendly Portal Bearer. Perform an additional Movement or Attack with this creature. Then put the Portal back to the Reserve and downgrade the Portal Bearer by 1 Power Level.

Sequence according to the picture: Xeladron (6) moves onto a Portal. It appears at the Portal Bearer (2) and moves from there to one of the 4 adjacent fields. Result: Xeladron stands on the new field, the Portal Bearer is downgraded to level 1 and has therefore become a Portal itself.

- Confirmed: the creature briefly shares the field with the Portal Bearer and must leave it with the additional action.
- Confirmed: the additional Movement or Attack is **mandatory**. If no valid additional action exists, the move onto the Portal is not allowed.
- Confirmed: with several Portal Bearers, the player freely chooses which one the creature goes to.
- **[Assumption RoX9]** The additional action is a standard Movement or Attack (1 field) from the Portal Bearer's field. Special movement abilities (e.g. Aerial Maneuver) and moving on into another Portal (chaining Wormholes) are not possible.

### `RoX.portal.resistance` (speciality)
Your Portals are immune against attacks if you control Portals in the same amount or less than friendly Portal Bearers in the game (number of Portals ≤ number of Portal Bearers).

## 2 · Portal Bearer

### `RoX.bearer.aerial_maneuver` (movement)
The Portal Bearer can move over an adjacent creature to an unoccupied field.
Card note: don't move the Portal Bearer back to the field she started from.

- Confirmed: the Portal Bearer jumps over an orthogonally adjacent creature and lands on any unoccupied field orthogonally adjacent to the jumped creature, except her starting field. In the picture she starts below the 4 and can land to the left of, to the right of or above the 4.
- Confirmed: only one jump per action.
- Confirmed: the jumped creature can be friendly or opposing and is not defeated.
- This is a movement only, no attack.

### `RoX.bearer.arrival` (speciality)
Gain 1 TP if a Portal Bearer is placed into the game.
- Confirmed: only placing a die as a new Portal Bearer counts (e.g. through New Paths, Decay, Dimensional Summoning). Upgrading or downgrading a die to level 2 does not count.
- **[Assumption RoX10]** Portal Bearers placed during the setup phase do not give TP.

### `RoX.bearer.balance` (speciality)
If this Portal Bearer is defeated, place 1 Portal from your Reserve Dice on any unoccupied field or upgrade a friendly Portal by 1 Power Level.

## 3 · Portal Guardian

### `RoX.guardian.new_paths` (spell)
Split a Portal Guardian into 1 Portal Bearer and 1 Portal.
Card note: place 1 Portal Bearer and 1 Portal from your Reserve Dice diagonal to each other and adjacent to the Portal Guardian. Then put the Portal Guardian back to the Reserve.

- The two dice are placed on two fields adjacent to the Guardian that are diagonal to each other (e.g. above and to the right).
- Confirmed: both target fields must be unoccupied.
- Confirmed: 2 dice are needed in the Reserve; the Guardian die itself is only returned afterwards.

## 4 · Emissary

### `RoX.emissary.energy_circle` (speciality)
Receive a maximum of 1 TP at the beginning of your turn if you control at least 1 Portal, 1 Portal Bearer and 1 Emissary. Lose 4 TP if the Emissary leaves the game and you don't control another one.
- Confirmed: TP drop to 0 at most, never negative.
- **[Assumption RoX11]** "Leaves the game" means the die leaves the board (defeated, exiled, returned to the Reserve). Upgrading or downgrading the last Emissary to another level does not cost 4 TP.

### `RoX.emissary.dimensional_summoning` (spell)
Put 1 Reserve Die into the Exile. Then use any number of TP and place a creature from your Reserve with a Power Level equal to the spent TP on the board. Place it adjacent to a friendly Portal Bearer.
- Confirmed: the target field must be unoccupied, and 1 to 6 TP are spent.
- Requires at least 2 dice in the Reserve (1 to exile, 1 to place).

## 5 · Enchantress of Gravity

### `RoX.enchantress.force_of_attraction` (speciality)
If the Enchantress of Gravity ends her Movement or Attack on a field diagonal to one or more opposing creatures, you can move one of them 1 field to a field adjacent to her.
- Confirmed: optional ("can"), and the target field must be unoccupied.

## 6 · Xeladron

### `RoX.xeladron.decay` (spell)
Split Xeladron into 1 Emissary and 1 Portal Bearer.
Card note: place 1 Emissary from your Reserve Dice diagonal to Xeladron and place 1 Portal Bearer from your Reserve Dice on an unoccupied field in your own zone. Then put Xeladron back to the Reserve.
- Own zone = the 3 rows on your side (see base rules).
- Both target fields must be unoccupied; 2 Reserve Dice are required.

### `RoX.xeladron.impact` (spell)
Use 6 TP. Put Xeladron and all surrounding creatures (8 neighbouring fields, friendly and opposing) into the Exile. Gain 1 VP for every opposing creature put into the Exile.
Card note: you don't gain Field Bonus Points.
- **[Assumption RoX12]** Opposing creatures exiled by Impact count as defeated (e.g. an opposing RoX Portal Bearer triggers Balance for its owner). Your own creatures exiled by Impact are not "defeated", so your own Portal Bearers do not trigger Balance.

### `RoX.xeladron.forceful_alliance` (speciality)
Gain 1 virtual VP for each pair of Xeladron and Portal in your possession that are adjacent to each other.
Card note: each creature only counts once per pair. Example: 2 Xeladrons and 2 Portals give 2 virtual VP.
- Confirmed: virtual VP are recalculated continuously (not permanently credited) and count towards the 10 VP win condition.
- Engine: maximum matching between your Xeladrons and adjacent Portals.

## Location: The Craters (`RoX.marker.craters`)

Before the setup phase, 2 crater tiles are placed. Positions (row/column from 1, seen from player 1, row 1 = top row with +3):
- Crater A: row 3, column 2
- Crater B: row 5, column 6

Rules:
- If at the beginning of your turn both craters are occupied by your creatures with Power Level 2 or higher, gain 1 VP.
- Creatures with Power Level 1 that occupy crater fields are put into the Reserve at the end of a player's turn.
- Confirmed: the craters apply to both players.
