# Würfelset DoA (Awakening)

Quelle: `img/DoA/rules/1.png` bis `6.png` und `marker.png`. Grundbegriffe stehen in [grundregeln.md](grundregeln.md).

## Übersicht

| Stufe | Kreatur | Fähigkeiten | Besiegt |
|---|---|---|---|
| 1 | Tidal Fisher | Godcatcher, Rest Breaker | je nach Anzahl Fisher (siehe unten) |
| 2 | Dream Bringer | Water Path, Depth Rapture, World Sleep | 1 |
| 3 | River Watch | Wave Ride | 2, 1 und 6 |
| 4 | Water Weaver | Water Pearls, Ghost Call, Thread of Fate | 3, 2, 1 |
| 5 | Ohtilia | From the Fog | 4, 3, 2, 1 |
| 6 | Awakening | Twilight Hour, New Beginning, Sint Flut | 5, 4, 3, 2, 1 |

## 1 · Tidal Fisher

### `DoA.fisher.godcatcher` (speciality)
Am Ende deines Zuges: Sind mehr als 3 eigene Tidal Fisher auf dem Brett, lege einen davon in die Reserve und werte, wenn möglich, eine eigene Kreatur in deiner Zone um 1 Stufe auf. Wiederhole das, bis höchstens 3 eigene Tidal Fisher auf dem Brett sind.

### `DoA.fisher.rest_breaker` (attack)
Während deines Angriffs ist die Stufe des Tidal Fishers gleich der Anzahl aller eigenen Tidal Fisher auf dem Brett.
Machthierarchie laut Karte:
- 1 Fisher: besiegt niemanden
- 2 Fisher: besiegt 1
- 3 Fisher: besiegt 1, 2 und 6
- 4 Fisher: besiegt 1, 2 und 3
- **[Annahme]** Die Stufe gilt nur beim Angreifen. Als Verteidiger bleibt der Fisher Stufe 1. Mehr als 4 Fisher sind nach Godcatcher am Ende des Zuges nicht möglich, während des Zuges aber schon (z. B. nach New Beginning). Dann gilt die normale Hierarchie der Summe.

## 2 · Dream Bringer

### `DoA.dreambringer.water_path` (movement)
Bewege dich in gerader Linie in eine beliebige Richtung (auch diagonal) bis zu 3 Felder.
- **[Annahme]** Nur über freie Felder, kein Angriff damit.

### `DoA.dreambringer.depth_rapture` (speciality)
Wird der Dream Bringer besiegt, erhältst du 2 TP.

### `DoA.dreambringer.world_sleep` (speciality)
Umgebende gegnerische Kreaturen (8 Nachbarfelder) können keine Zauber wirken.

## 3 · River Watch

### `DoA.riverwatch.wave_ride` (movement)
Bewege dich beliebig weit um eine umgebende eigene Kreatur herum, oder beliebig weit um mehrere umgebende eigene Kreaturen herum. Beende die Bewegung auf einem umgebenden Feld der eigenen Kreatur, aber nicht auf dem Startfeld.
- **[Annahme]** Der Weg führt über freie Felder, die jeweils eine eigene Kreatur umgeben (Ring der 8 Nachbarfelder). Bei mehreren eigenen Kreaturen darf der River Watch von einem Ring zum angrenzenden Ring wechseln.
- **[Frage DoA1]** Darf die Bewegung diagonale Schritte enthalten, oder nur orthogonale (die Beispielpfeile sind orthogonal)?

## 4 · Water Weaver

### `DoA.weaver.water_pearls` (speciality)
Erhalte zu Beginn jeder Runde 1 TP, sofern mindestens 1 eigener Water Weaver auf dem Brett ist. Verlässt dein letzter Water Weaver das Brett, verlierst du 1 TP.
- **[Frage DoA2]** „Zu Beginn jeder Runde“ (also einmal für beide Spieler zusammen) oder zu Beginn deines Zuges?

### `DoA.weaver.ghost_call` (spell)
Teile den Water Weaver in 1 River Watch und 1 Tidal Fisher.
Hinweis der Karte: Setze einen Reservewürfel angrenzend an den Water Weaver als River Watch oder Tidal Fisher. Setze einen Reservewürfel angrenzend an diese neue Kreatur als jeweils andere Kreatur. Lege den Water Weaver in die Reserve.
- Bild: River Watch rechts vom Weaver, Tidal Fisher unterhalb des River Watch (also diagonal zum Weaver).

### `DoA.weaver.thread_of_fate` (spell)
Lege einen Reservewürfel ins Exil und gib 2 TP aus. Werte eine umgebende gegnerische Kreatur um 1 Stufe auf oder ab, und umgekehrt eine umgebende eigene Kreatur um 1 Stufe ab oder auf.
- Bild: gegnerische 5 wird zu 4, eigener Tidal Fisher 1 wird zum Dream Bringer 2.

## 5 · Ohtilia

### `DoA.ohtilia.from_the_fog` (movement)
Tausche Ohtilia mit einer angrenzenden Kreatur. Führe danach sofort, wenn möglich, eine Standardbewegung mit Ohtilia aus.
- Gilt auch für gegnerische Kreaturen (Bild: gegnerischer 6er).
- **[Frage DoA3]** Ist die Folgebewegung Pflicht („if possible“), und darf sie ein Angriff sein? **[Annahme]** Pflicht, nur Bewegung.

## 6 · Awakening

### `DoA.awakening.twilight_hour` (speciality)
Erhalte 1 virtuellen VP pro Awakening, das in offener Linie (horizontal oder vertikal) zu einem eigenen Awakening steht (max. 1 virtueller VP pro Awakening).
Hinweis der Karte: Zwischen den Awakenings muss mindestens 1 freies Feld liegen, und „offen“ heisst, es steht nichts dazwischen.

### `DoA.awakening.new_beginning` (spell)
Teile das Awakening in 1 River Watch und 3 Tidal Fisher.
Hinweis der Karte: Setze 3 Reservewürfel als Tidal Fisher auf beliebige freie Felder. Stufe das Awakening zum River Watch herab.

### `DoA.awakening.sint_flut` (spell)
Lege 1 Reservewürfel ins Exil und gib 10 TP aus. Wähle eine horizontale oder vertikale Richtung. Bewege alle gegnerischen Kreaturen 1 Feld in diese Richtung. Werden Kreaturen dabei über den Brettrand geschoben, kommen sie ins Exil. Erhalte 1 VP für jede so besiegte Kreatur (kein Feldbonus).
Hinweis der Karte: Blockieren eigene Kreaturen die gegnerischen bei der Bewegung, werden diese nicht bewegt.
- **[Annahme]** Gegnerische Kreaturen blockieren sich auch gegenseitig in einer Kette (werden in Schieberichtung von vorne nach hinten verarbeitet).

## Ortsplättchen: Der Fluss (`DoA.marker.river`)

Vor der Aufstellungsphase wird das Flussplättchen gelegt. Es belegt 3 Felder einer Spalte in den drei mittleren Reihen (Zeilen 3 bis 5). Die Spieler einigen sich auf eine Spalte in der Brettmitte. Die Fliessrichtung zeigt im Bild nach rechts (von Spieler 1 aus).

Regeln:
- Kreaturen auf freien Feldern der drei mittleren Reihen werden am Ende jedes Zuges des Startspielers 1 Feld in Fliessrichtung bewegt.
- Werden Kreaturen dabei über den Brettrand bewegt, kommen sie ins Exil. Der Gegner erhält VP in Höhe der Stufe der exilierten Kreatur (kein Feldbonus).
- Kreaturen auf dem Flussplättchen selbst oder auf anderen Ortsplättchen werden nicht bewegt.
- Kreaturen können auf Ortsplättchen geschoben werden. Ist das Plättchen besetzt, wird die Kreatur darauf weggestossen und in Fliessrichtung vom Plättchen heruntergeschoben.
- **[Frage DoA4]** Welche Spalten sind erlaubt (im Bild gestrichelt: Spalte 2 und Spalte 5 von links, das Plättchen liegt in Spalte 2)? Und wer legt die Fliessrichtung fest?
- **[Frage DoA5]** „Der Gegner erhält VP“: der Gegner des Besitzers der Kreatur? Also wer eine eigene Kreatur verliert, gibt dem anderen VP?
