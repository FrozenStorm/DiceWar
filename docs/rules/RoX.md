# Würfelset RoX (Xeladron)

Quelle: `img/RoX/rules/1.png` bis `6.png` und `marker.png`. Grundbegriffe stehen in [grundregeln.md](grundregeln.md).

## Übersicht

| Stufe | Kreatur | Fähigkeiten | Besiegt |
|---|---|---|---|
| 1 | Portal | Unmovable, Wormhole, Resistance | niemanden |
| 2 | Portal Bearer | Aerial Maneuver, Arrival, Balance | 1 |
| 3 | Portal Guardian | New Paths | 2, 1 und 6 |
| 4 | Emissary | Energy Circle, Dimensional Summoning | 3, 2, 1 |
| 5 | Enchantress of Gravity | Force of Attraction | 4, 3, 2, 1 |
| 6 | Xeladron | Decay, Impact, Forceful Alliance | 5, 4, 3, 2, 1 |

## 1 · Portal

### `RoX.portal.unmovable` (speciality)
Portale können keine Bewegungsaktionen ausführen.
- **[Annahme]** Gilt auch für Angriffe, da ein Portal ohnehin niemanden besiegen kann.

### `RoX.portal.wormhole` (speciality)
Solange du mindestens 1 Portal Bearer kontrollierst, darfst du eigene Kreaturen auf Felder mit deinen Portalen bewegen. Bewegt sich eine eigene Kreatur auf ein Portal, wird sie auf das Feld eines eigenen Portal Bearers gesetzt. Mit dieser Kreatur führst du eine zusätzliche Bewegung oder einen zusätzlichen Angriff aus. Danach kommt das Portal in die Reserve, und der Portal Bearer wird um 1 Stufe herabgestuft.

Ablauf laut Bild: Xeladron (6) zieht auf ein Portal. Er erscheint beim Portal Bearer (2) und zieht von dort auf eines der 4 angrenzenden Felder. Ergebnis: Xeladron steht auf dem neuen Feld, der Portal Bearer ist auf Stufe 1 herabgestuft, also selbst zu einem Portal geworden.

- **[Annahme]** Die Kreatur steht kurz auf demselben Feld wie der Portal Bearer und muss es mit der Zusatzaktion wieder verlassen.
- **[Frage RoX1]** Ist die Zusatzaktion Pflicht? Was passiert, wenn kein Feld neben dem Portal Bearer frei oder angreifbar ist?
- **[Frage RoX2]** Gibt es mehrere Portal Bearer, wählt dann der Spieler, zu welchem die Kreatur geht?

### `RoX.portal.resistance` (speciality)
Deine Portale sind immun gegen Angriffe, wenn du gleich viele oder weniger Portale als Portal Bearer im Spiel kontrollierst (Anzahl Portale ≤ Anzahl Portal Bearer).

## 2 · Portal Bearer

### `RoX.bearer.aerial_maneuver` (movement)
Der Portal Bearer kann über eine angrenzende Kreatur auf ein unbesetztes Feld ziehen (Sprung in gerader Linie, 2 Felder weit).
Hinweis der Karte: Der Portal Bearer darf nicht auf das Feld zurückziehen, von dem er gestartet ist.

- **[Annahme]** Die übersprungene Kreatur kann eigene oder gegnerische sein und wird nicht besiegt. Das Bild zeigt einen gegnerischen 4er, über den in 3 Richtungen gesprungen wird.
- **[Frage RoX3]** Bedeutet der Hinweis, dass man mehrere Sprünge hintereinander machen darf? Sonst wäre ein Zurückziehen ja gar nicht möglich. Im Bild startet der Bearer unten, springt über den 4er und hat die Ziele oben, links und rechts. Das sieht nach einem Sprung plus einem weiteren Schritt aus.

### `RoX.bearer.arrival` (speciality)
Erhalte 1 TP, wenn ein Portal Bearer ins Spiel gebracht wird.
- **[Frage RoX4]** Zählt auch ein Upgrade von Portal (1) auf Portal Bearer (2) oder ein Herabstufen (z. B. Wormhole) als „ins Spiel bringen“, oder nur das Setzen aus der Reserve (z. B. durch New Paths, Decay)?

### `RoX.bearer.balance` (speciality)
Wird dieser Portal Bearer besiegt, setze 1 Portal aus deiner Reserve auf ein beliebiges unbesetztes Feld oder werte ein eigenes Portal um 1 Stufe auf.

## 3 · Portal Guardian

### `RoX.guardian.new_paths` (spell)
Teile einen Portal Guardian in 1 Portal Bearer und 1 Portal.
Hinweis der Karte: Setze 1 Portal Bearer und 1 Portal aus deiner Reserve diagonal zueinander und angrenzend an den Portal Guardian. Lege danach den Portal Guardian in die Reserve.

- Die beiden Würfel stehen also auf zwei angrenzenden Feldern des Guardians, die über Eck liegen (z. B. oben und rechts).
- **[Frage RoX5]** Müssen die beiden Zielfelder unbesetzt sein? **[Annahme]** Ja.
- **[Frage RoX6]** Braucht man dafür 2 Würfel in der Reserve, oder darf der Guardian-Würfel selbst wiederverwendet werden?

## 4 · Emissary

### `RoX.emissary.energy_circle` (speciality)
Erhalte zu Beginn deines Zuges höchstens 1 TP, wenn du mindestens 1 Portal, 1 Portal Bearer und 1 Emissary kontrollierst. Verliere 4 TP, wenn der Emissary das Spiel verlässt und du keinen weiteren kontrollierst.
- **[Frage RoX7]** Können TP negativ werden, oder fällt man auf 0?

### `RoX.emissary.dimensional_summoning` (spell)
Lege 1 Reservewürfel ins Exil. Gib dann beliebig viele TP aus und setze eine Kreatur aus deiner Reserve mit der Stufe gleich den ausgegebenen TP aufs Brett. Sie kommt auf ein Feld angrenzend an einen eigenen Portal Bearer.
- **[Annahme]** Das Zielfeld muss unbesetzt sein, und es werden 1 bis 6 TP ausgegeben.

## 5 · Enchantress of Gravity

### `RoX.enchantress.force_of_attraction` (speciality)
Beendet die Enchantress ihre Bewegung oder ihren Angriff auf einem Feld diagonal zu einer oder mehreren gegnerischen Kreaturen, darfst du eine davon 1 Feld weit auf ein Feld angrenzend an die Enchantress ziehen.
- **[Annahme]** Optional („can“), und das Zielfeld muss unbesetzt sein.

## 6 · Xeladron

### `RoX.xeladron.decay` (spell)
Teile Xeladron in 1 Emissary und 1 Portal Bearer.
Hinweis der Karte: Setze 1 Emissary aus deiner Reserve diagonal zu Xeladron und 1 Portal Bearer aus deiner Reserve auf ein unbesetztes Feld in deiner eigenen Zone. Lege danach Xeladron in die Reserve.
- Hängt von **[Frage G1]** (eigene Zone) ab.

### `RoX.xeladron.impact` (spell)
Gib 6 TP aus. Lege Xeladron und alle umgebenden Kreaturen (8 Nachbarfelder, eigene und gegnerische) ins Exil. Erhalte 1 VP für jede gegnerische Kreatur, die ins Exil kommt.
Hinweis der Karte: Dafür gibt es keine Feldbonuspunkte.

### `RoX.xeladron.forceful_alliance` (speciality)
Erhalte 1 virtuellen VP für jedes Paar aus Xeladron und Portal in deinem Besitz, die angrenzend zueinander stehen.
Hinweis der Karte: Jede Kreatur zählt nur in einem Paar. Beispiel: 2 Xeladron und 2 Portale ergeben 2 virtuelle VP.
- **[Annahme]** Virtuelle VP werden laufend neu berechnet (nicht dauerhaft gutgeschrieben) und zählen für die Siegbedingung von 10 VP.
- Für die Engine: maximale Paarung (Matching) zwischen eigenen Xeladrons und angrenzenden eigenen Portalen.

## Ortsplättchen: Die Krater (`RoX.marker.craters`)

Vor der Aufstellungsphase werden 2 Kraterplättchen gelegt. Laut Abbildung (Zeile/Spalte ab 1, von Spieler 1 aus, Zeile 1 = oberste Reihe mit +3):
- Krater A: Zeile 3 (Bonus +1 für Spieler 1), Spalte 2
- Krater B: Zeile 5 (Bonus +1 für Spieler 2), Spalte 6

Regeln:
- Sind zu Beginn deines Zuges beide Krater von deinen Kreaturen mit Stufe 2 oder höher besetzt, erhältst du 1 VP.
- Kreaturen mit Stufe 1, die auf einem Krater stehen, kommen am Ende des Zuges eines Spielers in die Reserve.

- **[Frage RoX8]** Gelten die Krater nur, wenn ein Spieler RoX spielt, und auch für den Gegner? **[Annahme]** Sie gelten für beide Spieler.
