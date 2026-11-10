# Base rules

Sources: official rulebook "DiceWar – Light of Dragons" (4th edition, June 2022), the game board PDF, `img/global/zugablauf.png` (Overview Turn) and `img/global/glossar.png` (Glossary). Anything not covered by the rulebook was decided by the rules owner and is marked **Confirmed**.

**Principle:** Creature abilities always take precedence over the game rules ("The abilities of Creatures always precede the game rules").

## Components

- 2 sets of 15 identical creature dice. Each face shows a creature, its number is the creature's Power Level (1 to 6). Depending on where it is, a die is called a Reserve Die, a Creature Die (on the board) or a Die in Exile.
- 2 indicator dice per player for the Victory Points bar (VP) and the Trigger Points bar (TP). Both bars range from 0 to 10.
- Location cards and location tiles are optional ("recommended for advanced players").

## Game board

Each side of the board has 7 areas: Reserve, Warlands, Supply Zone, Exile, Field Bonus, VP bar and TP bar.

- **Warlands:** the playing field of 7 × 7 fields.
- **Zones:** your **own zone** is the 3 rows on your side, the **opponent zone** the 3 rows on the other side. The middle row belongs to neither zone.
- **Supply Zone:** the back row of each side.
- **Field Bonus:** in the opposing half the rows carry the bonuses +1, +2, +3. The opposing Supply Zone is +3, the row in front of it +2, the next one +1.
- The **Reserve** is to the right of your side of the board, the **Exile** to the left.

## Game flow

### Preparation phase
1. Each player chooses a tribe (a dice set).
2. All 15 creature dice go into the player's Reserve.
3. The indicator dice start at 0 (VP and TP).
4. Each player rolls a die, the higher number starts (reroll on a tie).
5. Location tiles, if used, are placed as shown on the location card before the setup.

### Setup phase
The starting player places any number of dice in their Supply Zone until the creatures there have a combined Power Level of exactly 10. Then the opponent sets up their starting lineup the same way.

Example: Player 1 places a 4 and a 6 (sum 10). Player 2 places a 2, a 3 and a 5 (sum 10).

- Confirmed: each field of the Supply Zone holds at most one die, so at most 7 dice. The sum must be exactly 10.
- For KoS the alignment is also chosen when placing.

### War phase
1. The starting player opens the game with 1 standard action.
2. After that, players alternate, performing 1 standard action per turn.
3. The first player to reach 10 VP (including virtual VP) wins.

Turn sequence according to the overview card:
1. **Check the TP bar.** Confirmed: all "at the beginning of your turn" effects are triggered here (e.g. RoX Energy Circle, RoX Craters).
2. Perform **exactly one standard action**.
3. **Check the VP bar.** With 10 VP the game is won.

### No valid action
Confirmed: a player who has no valid action at all at the start of their turn loses.

### End of War
If two creatures keep chasing each other with no end in sight (e.g. a chased creature keeps fleeing back and forth), a player may declare the **End of War**. If the chased player keeps fleeing for another 5 turns after the announcement, the player with more VP (including virtual VP) wins. If both have the same number of VP, the game ends in a draw.

Implementation (confirmed):
- The declaring player names the opponent as the chased player. After the announcement, the chased player's turns are counted.
- **Fleeing** means: during these 5 turns the chased player only performs Movement actions, all with one and the same die.
- If the chased player flees for all 5 turns, the game ends and VP decide (draw on a tie). If they do anything else in one of these turns (an attack, an upgrade, a spell, or a movement with a different die), the End of War is cancelled.
- In addition, as a safety net for the AI, there is a fixed turn limit per game. When it is reached, VP decide the same way.

## Standard actions

Exactly one per turn, only with your own creatures. Some creatures have specialities that extend or change a standard action.

- **Movement:** move a chosen creature to an adjacent unoccupied field. Adjacent means horizontal or vertical. Some creatures have different movement patterns (see the creature cards).
- **Attack:** move a chosen creature to an adjacent field occupied by an opposing creature. Attacks are only possible on creatures with a lower Power Level. Exception: Power Level 3 additionally defeats Power Level 6.
- **Upgrade:** increase the Power Level of a chosen creature by 1. Confirmed: 6 is the maximum, a 6 cannot be upgraded.
- **Spell:** cast the spell of a chosen creature. Spells that require Reserve Dice can only be cast if there are enough dice in the Reserve. Some spells use the TP bar. Some creatures have no spell.

There is **no** standard action to place dice from the Reserve on the board. New dice only enter the game through abilities (e.g. splitting).

## Defeating and victory points

- Defeated creatures go into the **Exile** (of their owner).
- The attacking player receives VP equal to the **Power Level** of the defeated creature.
- **Field Bonus:** if a creature is defeated in the opposing half, additional VP are awarded according to the Field Bonus. Example: a creature with Power Level 3 is defeated in the opposing Supply Zone, giving 3 + 3 = 6 VP.
- The relevant field is the one the defeated creature stood on (the target field of the attack), seen from the attacker.
- Abilities can deviate, e.g. RoX Impact (1 VP per creature, no Field Bonus) or RoM Fake Gold (no VP).
- Confirmed: VP above 10 are not needed because the game ends at 10.

## Trigger points

Trigger Points are only gained through abilities. The TP bar goes up to 10.
- Confirmed: more than 10 TP is not possible, and TP never drop below 0.

## Power hierarchy

A creature with a higher Power Level defeats all creatures with a lower Power Level. Exception: creatures with Power Level 3 additionally defeat creatures with Power Level 6.

- Equal levels cannot defeat each other.
- Level 6 still defeats level 3. On the cards the 3 is shown as a red "threatening" creature because it can also defeat the 6.
- Creature cards can have their own hierarchy, e.g. RoX Portal (1) defeats nobody, DoA Tidal Fisher depends on the number of Fishers.

## Abilities

- **Specialities** (blue-grey) are passive, not a standard action, and can affect both players.
- Coloured bars show which standard action an ability changes: green Movement, red Attack, yellow Upgrade, purple Spell.

## Cross-set rules derived from the creature cards

- **Downgrading** is possible (e.g. LoD Brotherhood, DoA New Beginning). If an opposing creature is downgraded below Power Level 1, it goes into the Exile; your own goes back to the Reserve (LoD Lifepulling, KoS Phalanx).
- **Splitting** is a common spell pattern: Reserve Dice are placed with a given Power Level on given fields, the original creature goes to the Reserve or is downgraded. The engine gets a shared building block for this.
- **Virtual VP** count like normal VP for the win condition, but they are recalculated from the board continuously and not shown on the VP bar.
- **Additional actions** after certain actions (e.g. Inner Fire, Wormhole, Sacrifice) allow several steps in one turn. The engine therefore models a turn as a sequence of sub-steps.
- **Alignment** per die is needed for KoS (see [KoS.md](KoS.md)).

## Glossary

- **Adjacent:** the horizontal and vertical neighbouring fields (4).
- **Diagonal:** the diagonal neighbouring fields (4).
- **Surrounding:** all horizontal, vertical and diagonal neighbouring fields (8).
- **Opposing creatures:** all creatures under your opponent's command in the Warlands.
- **Your own creatures:** all creatures under your command in the Warlands.
- **Friendly creatures:** all your own creatures except the chosen one. Important e.g. for "adjacent friendly creature".
- **Virtual victory points:** count the same way as VP gained in combat, but are not shown on the VP bar.
- **Warlands:** the game board.
- Symbols: crown = VP, claw = TP, black skull with number = opposing creature of that level, red skull = threatening opposing creature (can in turn defeat this creature).
- Immunities: red shield = immune against opposing attacks, purple book = immune against opposing spells, blue arrow = immune against opposing specialities.
