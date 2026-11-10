# DiceWar rules as text

Goal: capture every rule that so far only exists as images of the rule cards as text, and have it validated. These texts are the basis for the rules engine (move validation) and the AI opponent.

## Contents

| File | Content | Status |
|---|---|---|
| [base-rules.md](base-rules.md) | Board, setup, turn sequence, standard actions, victory points, power hierarchy, End of War, glossary | **Validated** |
| [RoX.md](RoX.md) | Dice set RoX (Rise of Xeladron), implemented first | **Validated** |
| [LoD.md](LoD.md) | Dice set LoD (Light of Dragons, base game), implemented third | **Validated** |
| [RoM.md](RoM.md) | Dice set RoM (Roots of Mali), implemented fourth | **Validated** |
| [BoD.md](BoD.md) | Dice set BoD (Bond of Demons), implemented second | **Validated** |
| [DoA.md](DoA.md) | Dice set DoA (Dawn of Awakening), implemented sixth | **Validated** |
| [KoS.md](KoS.md) | Dice set KoS (Knights of Steel), implemented fifth | **Validated** |

## Conventions

Every ability has a fixed ID of the form `SET.creature.ability` (e.g. `RoX.portal.wormhole`). The engine uses the same IDs so rule text and code clearly belong together.

Ability type (derived from the colour of the bar on the card):

| Colour | Type | Meaning |
|---|---|---|
| green | `movement` | variant of the Movement standard action |
| red | `attack` | variant of the Attack standard action |
| yellow | `upgrade` | variant of the Upgrade standard action |
| purple | `spell` | spell, uses the Spell standard action |
| blue-grey | `speciality` | passive or automatically triggered |

Markers in the text:

- **[Assumption]** interpretation that still needs confirmation
- **[Question]** open, cannot be implemented without an answer
- **Confirmed:** decision made by the rules owner where the cards were ambiguous

Sources: official rulebook "DiceWar – Light of Dragons" (4th edition, June 2022) for the base rules, images in `img/global/` and `img/<SET>/rules/` for the sets.
