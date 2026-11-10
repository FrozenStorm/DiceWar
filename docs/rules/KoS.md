# Würfelset KoS (King's Knight)

Quelle: `img/KoS/rules/1.png` bis `6.png`, `marker.png`, `rules_1.png`, `rules_2.png`. Grundbegriffe stehen in [grundregeln.md](grundregeln.md).

**Wichtig für die Engine:** KoS braucht pro Würfel eine **Ausrichtung** (Alignment: oben, rechts, unten, links). Der Spielzustand muss das für alle Sets speichern können. Im heutigen Code gibt es dafür schon das Feld `rotation`.

## Neue Begriffe (Karten „New Terms & Symbols“)

- **Formation:** Ein Cluster oder eine Kette aus angrenzenden eigenen Kreaturen (zusammenhängende Gruppe, orthogonal).
- **Frontal:** Felder in Pfeilrichtung der Kreatur.
  - *frontal angrenzend:* das 1 Feld direkt vor der Kreatur.
  - *frontal umgebend:* die 3 Felder vor der Kreatur (vorne links, vorne, vorne rechts).
- **Alignment (Ausrichtung):** durch ein Pfeilsymbol angezeigt. Es beeinflusst Standardaktionen und Spezialitäten. Das Symbol auf der Karte zeigt, wann ausgerichtet wird: vor der Aktion, vor oder nach der Aktion, oder nach der Aktion.
  - Bei einer Aktion zählt die aktuelle Ausrichtung.
  - Wird ein Reservewürfel als Kreatur aufs Brett gesetzt, wählt der Spieler die Ausrichtung bewusst.
  - Ändert sich die Stufe einer Kreatur, bleibt ihre Ausrichtung erhalten.
- **Orientate (Ausrichten):** Die Kreatur in eine beliebige der 4 Richtungen drehen.
- **[Frage KoS1]** Kreaturen ohne Pfeilsymbol (First Sword, Commander, King's Knight) haben trotzdem eine Ausrichtung, die aber keine Rolle spielt. Richtig?

## Übersicht

| Stufe | Kreatur | Fähigkeiten | Besiegt |
|---|---|---|---|
| 1 | First Sword | Agile, Support, Relentless | niemanden |
| 2 | Loyal Shield | Mindfulness, Resistance, Shield Strike, To the Spears | 1 |
| 3 | Silver Spear | Impatience, Phalanx, Heart Thrust | 2, 1 und 6 |
| 4 | Commander | Moral Boost, Leadership, Supply | 3, 2, 1 |
| 5 | Burning Stag | Cautiousness, Crown Path | 4, 3, 2, 1 |
| 6 | King's Knight | Breakthrough, Reinforcements | 5, 4, 3, 2, 1 |

## 1 · First Sword

### `KoS.sword.agile` (movement)
Bewege den First Sword auf ein beliebiges freies umgebendes Feld (auch diagonal).

### `KoS.sword.support` (spell)
Erhöhe die Stufe einer umgebenden eigenen Kreatur um 1 oder verringere die Stufe einer umgebenden gegnerischen Kreatur um 1. Lege danach den First Sword in die Reserve.
- **[Frage KoS2]** Was passiert mit einer gegnerischen Kreatur der Stufe 1, die verringert wird (Exil wie bei Phalanx)?

### `KoS.sword.relentless` (speciality)
Bewegt sich ein First Sword oder wirkt er einen Zauber, erhältst du eine zusätzliche Aktion für einen eigenen First Sword, der in diesem Zug noch keine Aktion ausgeführt hat.
Kommt ein First Sword ins Exil, darf er stattdessen auf ein beliebiges freies Feld am Brettrand gesetzt werden (ausser in der gegnerischen Versorgungszone).
- **[Annahme]** Die Zusatzaktion ist eine beliebige Standardaktion dieses anderen First Swords, die Kette kann sich fortsetzen.

## 2 · Loyal Shield (Ausrichtung: vor oder nach der Aktion)

### `KoS.shield.mindfulness` (speciality)
Richte den Loyal Shield vor oder nach jeder Bewegung und jedem Angriff aus.

### `KoS.shield.resistance` (speciality)
Der Loyal Shield kann von frontal angrenzenden Kreaturen weder angegriffen noch bewegt werden.

### `KoS.shield.shield_strike` (speciality)
Steht eine gegnerische Kreatur frontal angrenzend vor dem Loyal Shield, kann sie 1 Feld in gerader Linie weggeschoben werden. Gegnerische Kreaturen können so über den Brettrand oder gegen andere eigene Kreaturen geschoben werden. Die gegnerische Kreatur ist dadurch besiegt. Dafür gibt es keinen Feldbonus.
Hinweis der Karte: Gegnerische Kreaturen können nicht auf andere gegnerische Kreaturen geschoben werden.
- Bild: Der Shield schiebt einen gegnerischen 4er gegen einen eigenen First Sword. Der 4er ist besiegt, der Shield rückt nach.
- **[Frage KoS3]** Ist Shield Strike eine eigene Aktion (welche Standardaktion verbraucht sie?) oder passiert sie automatisch? Und wird die Kreatur nur besiegt, wenn sie gegen den Rand oder eine eigene Kreatur geschoben wird, oder auch beim Schieben auf ein freies Feld?

### `KoS.shield.to_the_spears` (speciality)
Sind zu Beginn deines Zuges mehr als 3 eigene Loyal Shields auf dem Brett, werte alle bis auf 3 um 1 Stufe auf.
- **[Frage KoS4]** Wer wählt, welche 3 bleiben? **[Annahme]** der Besitzer.

## 3 · Silver Spear (Ausrichtung: vor der Aktion)

### `KoS.spear.impatience` (speciality)
Richte den Silver Spear vor jeder Bewegung und jedem Angriff aus.

### `KoS.spear.phalanx` (speciality)
Zieht ein Silver Spear auf das frontal angrenzende Feld zwischen sich und einer gegnerischen Kreatur, oder zieht umgekehrt eine gegnerische Kreatur auf das frontal angrenzende Feld vor einem Silver Spear, verringert sich die Stufe der gegnerischen Kreatur um 1. Die Ausrichtung muss berücksichtigt werden.
Hinweis der Karte: Gegnerische Kreaturen der Stufe 1 werden ins Exil gelegt.
- Bild: Gegnerischer 4er zieht vor die Spitze des Speers und wird zum 3er.

### `KoS.spear.heart_thrust` (attack)
Greife in gerader Linie über einen angrenzenden eigenen Loyal Shield hinweg an.
- Bild: Speer (3), dahinter Shield (2), dahinter gegnerischer 6er. Der Speer besiegt den 6er.

## 4 · Commander

### `KoS.commander.moral_boost` (speciality)
Erhalte zu Beginn jedes Zuges 1 TP für jeden Commander, den du auf dem Brett hast. Verliere 2 TP, wenn ein Commander das Brett verlässt oder seine Stufe verändert wird.
- **[Frage KoS5]** „Jeder Zug“ heisst nur dein eigener Zug, oder auch der des Gegners?

### `KoS.commander.leadership` (spell)
Lege 1 Reservewürfel ins Exil. Gib beliebig viele TP aus, um eigene Kreaturen zu bewegen, deren Stufen zusammen den ausgegebenen TP entsprechen. Jede einmal.
Beispiel der Karte: 1 Reservewürfel ins Exil, 5 TP ausgeben, um 1 Silver Spear (3) und 1 Loyal Shield (2) zu bewegen.
Hinweis der Karte: Leadership kann nicht auf den wirkenden Commander selbst angewendet werden.
- **[Frage KoS6]** Ist jede dieser Bewegungen eine normale Standardbewegung (1 Feld bzw. Spezialbewegung der Kreatur)? Darf dabei angegriffen werden?

### `KoS.commander.supply` (spell)
Teile den Commander in 4 First Swords, sofern er nicht bedroht ist.
Hinweis der Karte: Setze 4 Reservewürfel als First Swords auf beliebige freie Felder am Brettrand (ausser in der gegnerischen Versorgungszone). Lege danach den Commander in die Reserve.
- „Bedroht“: **[Annahme]** keine gegnerische Kreatur könnte den Commander im nächsten Zug angreifen und besiegen.

## 5 · Burning Stag (Ausrichtung: nach der Aktion)

### `KoS.stag.cautiousness` (speciality)
Richte den Burning Stag nach jeder Bewegung und jedem Angriff aus.

### `KoS.stag.crown_path` (movement + attack)
Bewege dich oder greife an, nur auf die frontal umgebenden Felder (vorne links, vorne, vorne rechts), oder bewege den Burning Stag 1 Feld rückwärts. Die Ausrichtung muss berücksichtigt werden.
- Rückwärts ist nur Bewegung, kein Angriff (grüner Pfeil im Bild).

## 6 · King's Knight

### `KoS.knight.breakthrough` (speciality)
Erhalte 1 virtuellen VP für jede Formation mit einer Gesamtstufe von 9 oder mehr, sofern du mindestens 1 King's Knight kontrollierst.
- Beispiele der Karte: 1+2+4+1+1 = 9 ergibt 1 VP. 4+6+5+6 = 21 ergibt ebenfalls nur 1 VP (eine Formation).

### `KoS.knight.reinforcements` (spell)
Teile den King's Knight in 1 Silver Spear, 1 Loyal Shield und 1 First Sword.
Hinweis der Karte: Setze 3 Reservewürfel als Silver Spear, Loyal Shield und First Sword auf freie Felder, die den King's Knight umgeben. Lege danach den King's Knight in die Reserve.

## Ortsplättchen: Das Lager (`KoS.marker.camp`)

Gleich wie bei RoM, siehe [RoM.md](RoM.md#ortsplättchen-das-lager-rommarkercamp).
