# Dice set BoD (Bond of Demons)

Source: `img/BoD/rules/1.png` to `6.png` and `marker.png`. Base terms are defined in [base-rules.md](base-rules.md).

**Status: validated.** All open questions were answered by the rules owner.

Errata: the official errata cards for Hunter of Death (E233) and Swamp Hag (E234) were compared with the cards in the repo. The text is identical, so the repo cards already are the corrected version. Confirmed (BoD0).

## Overview

| Level | Creature | Abilities | Defeats |
|---|---|---|---|
| 1 | Gnome | Protective Aura | nobody |
| 2 | Possessed | Temptation | 1 |
| 3 | Hunter of Death | Hunter's Path, Dark Fusion | 2, 1 and 6 |
| 4 | Swamp Hag | Black Magic, Voodoo, Servitude | 3, 2, 1 |
| 5 | Gatherer | Mercy, Sacrifice | 4, 3, 2, 1 |
| 6 | Demon of Darkness | Allegiance, Bound | 5, 4, 3, 2, 1 |

## 1 · Gnome

### `BoD.gnome.protective_aura` (speciality)
Your adjacent creatures with Power Level 2 or higher cannot be attacked.
- Picture: the protected creatures (6 above, 2 to the right) carry the shield. The Gnome itself and an adjacent Gnome (level 1) are not protected.

## 2 · Possessed

### `BoD.possessed.temptation` (speciality)
If possible, adjacent opposing creatures with Power Level 3 or higher have to attack the Possessed in the following turn.
Card notes:
- If there are several opposing creatures on adjacent fields, the opponent can decide which one attacks.
- If the Possessed is protected by an adjacent Gnome, the opponent can't attack it and has to choose a different action.
- Engine: if at the start of the opponent's turn there is a valid attack by a level 3+ creature on an adjacent Possessed, only such attacks are allowed.
- Confirmed (BoD1): the obligation only applies if the Possessed can actually be attacked. If it is immune (e.g. protected by a Gnome), there is no obligation to attack it.

## 3 · Hunter of Death

### `BoD.hunter.hunters_path` (movement)
Move the Hunter up to 2 fields.
Card note: you can still only attack adjacent fields.
- Picture: straight or with a change of direction (around a corner), over free fields.

### `BoD.hunter.dark_fusion` (upgrade)
Yellow bar, i.e. a variant of the Upgrade standard action: move your Hunter of Death to the field of another friendly Hunter of Death. Put one of them into the Exile. Upgrade the other to a Demon of Darkness (6). If there is no other friendly Hunter of Death in the Warlands, you may take an additional action with this Demon of Darkness.
- Confirmed: Dark Fusion is possible as long as the Hunter can move onto the other Hunter's field, either adjacent or with Hunter's Path (up to 2 fields, e.g. 2 fields away in a straight line with a free field in between).

## 4 · Swamp Hag

### `BoD.hag.black_magic` (speciality)
Increase your TP by 1 at the beginning of your turn, provided that there is at least one of your Swamp Hags in the Warlands.
Card note: as soon as there is no own Swamp Hag or Possessed in the Warlands, the TP are lost.

### `BoD.hag.voodoo` (spell)
Put 1 Reserve Die into your Exile and choose one or both options for different Possessed:
- Use 3 TP to move one of your Possessed by 3 fields, also around corners.
- Use 2 TP to increase one of your Possessed by 2 Power Levels.
- Confirmed (BoD2): the 3-field move is a movement only, it cannot attack. All fields passed and the target field must be free.

### `BoD.hag.servitude` (spell)
Split the Swamp Hag into 2 Possessed.
Card note: place 2 Reserve Dice as Possessed horizontally or vertically adjacent to the Swamp Hag. Then put the Swamp Hag back to the Reserve.

## 5 · Gatherer

### `BoD.gatherer.mercy` (spell)
Place 1 Reserve Die as a Gnome on an adjacent free field.

### `BoD.gatherer.sacrifice` (movement, mixed bar)
Once per turn move the Gatherer to an adjacent field occupied by an own Gnome. Return the Gnome to the Reserve. You can use an additional action to raise a level, move or attack with the Gatherer.

## 6 · Demon of Darkness

### `BoD.demon.allegiance` (spell)
Split the Demon of Darkness into 1 Possessed and 1 Swamp Hag.
Card note: downgrade the Demon of Darkness to a Possessed. Place 1 Reserve Die as a Swamp Hag on a free field adjacent to the Possessed.

### `BoD.demon.bound` (speciality)
Receive 1 virtual VP for each pair of Demon of Darkness and Possessed, irrespective of their position.
Card example: 2 Demons and 3 Possessed in the Warlands give 2 pairs = 2 virtual VP. So `min(#Demons, #Possessed)`.

## Location: The Oracle (`BoD.marker.oracle`)

The Oracle is placed in the middle of the board (row 4, column 4).

Rules:
- If one of your creatures occupies the Oracle at the end of your turn, its Power Level rises or falls to 4.
- Get 1 additional TP each turn as long as you own the Oracle (one of your creatures stands on it).
Card note: creatures that occupy the Oracle cannot raise their Power Level.
- Confirmed (BoD3): the TP is credited at the beginning of your turn.
