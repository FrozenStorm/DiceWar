# Grundregeln

Quellen: offizielles Regelheft „DiceWar – Light of Dragons“ (4. Edition, Juni 2022, englisch), Spielbrett-PDF, `img/global/zugablauf.png` (Overview Turn) und `img/global/glossar.png` (Glossary). Was direkt aus dem Regelheft stammt, ist nicht markiert. **[Annahme]** und **[Frage]** markieren, was dort nicht geregelt ist.

**Grundsatz:** Die Fähigkeiten der Kreaturen haben immer Vorrang vor den Grundregeln (Regelheft: „The abilities of Creatures always precede the game rules“).

## Material

- 2 Sätze mit je 15 identischen Kreaturwürfeln. Jede Würfelseite zeigt eine Kreatur, die Zahl ist ihre Machtstufe (Power Level, 1 bis 6). Je nach Ort heisst ein Würfel Reservewürfel, Kreaturwürfel (auf dem Brett) oder Würfel im Exil.
- 2 Indikatorwürfel pro Spieler für die Siegpunkt-Leiste (VP) und die Triggerpunkt-Leiste (TP). Beide Leisten gehen von 0 bis 10.
- Ortskarten und Ortsplättchen sind optional („für fortgeschrittene Spieler empfohlen“).

## Spielbrett

Jede Brettseite hat 7 Bereiche: Reserve, Warlands, Versorgungszone, Exil, Feldbonus, VP-Leiste und TP-Leiste.

- **Warlands:** das Spielfeld mit 7 × 7 Feldern.
- **Zonen:** Die **eigene Zone** sind die 3 Reihen auf der eigenen Seite, die **gegnerische Zone** die 3 Reihen auf der anderen Seite. Die mittlere Reihe gehört zu keiner Zone.
- **Versorgungszone (Supply Zone):** die hinterste Reihe jeder Seite (auf dem Brett grau/Bergland).
- **Feldbonus:** In der gegnerischen Hälfte tragen die Reihen die Boni +1, +2, +3. Die gegnerische Versorgungszone ist +3, die Reihe davor +2, die nächste +1.
- **Reserve** liegt rechts neben der eigenen Brettseite, **Exil** links.

## Spielablauf

### Vorbereitung (Preparation Phase)
1. Jeder Spieler wählt einen Stamm (ein Würfelset).
2. Alle 15 Kreaturwürfel kommen in die eigene Reserve.
3. Die Indikatorwürfel stehen auf 0 (VP und TP).
4. Jeder Spieler würfelt, die höhere Zahl beginnt (bei Gleichstand neu würfeln).
5. Ortsplättchen werden, falls verwendet, laut Ortskarte vor der Aufstellung gelegt.

### Aufstellung (Setup Phase)
Der Startspieler setzt beliebig viele Würfel in seine Versorgungszone, bis die Kreaturen dort zusammen eine Machtstufe von genau 10 haben. Danach stellt der Gegner seine Startaufstellung auf dieselbe Weise auf.

Beispiel: Spieler 1 setzt eine 4 und eine 6 (Summe 10). Spieler 2 setzt eine 2, eine 3 und eine 5 (Summe 10).

- **[Annahme]** Jedes Feld der Versorgungszone hat höchstens einen Würfel, also höchstens 7 Würfel. Die Summe muss genau 10 sein.
- Für KoS wird beim Setzen auch die Ausrichtung gewählt.

### Kriegsphase (War Phase)
1. Der Startspieler eröffnet mit 1 Standardaktion.
2. Danach führen die Spieler abwechselnd je 1 Standardaktion pro Zug aus.
3. Wer zuerst 10 VP hat (inklusive virtueller VP), gewinnt.

Ablauf eines Zuges laut Übersichtskarte:
1. **TP-Leiste prüfen.** **[Annahme]** Hier werden alle Effekte „zu Beginn deines Zuges“ ausgelöst (z. B. RoX Energy Circle, RoX Krater).
2. **Genau eine Standardaktion** ausführen.
3. **VP-Leiste prüfen.** Bei 10 VP ist das Spiel gewonnen.

### Kriegsende bei Endlosschleife (End of War)
Jagen sich zwei Kreaturen ohne absehbares Ende (z. B. eine gejagte Kreatur flieht immer wieder hin und her), darf ein Spieler das **Kriegsende** ausrufen. Flieht der gejagte Spieler nach der Ansage weitere 5 Züge lang, gewinnt der Spieler mit mehr VP (inklusive virtueller VP). Bei Gleichstand endet das Spiel unentschieden.

- Für die Engine: Kriegsende als Aktion „ausrufen“, danach 5 Züge zählen. **[Annahme]** Gezählt werden die Züge des gejagten Spielers, und die Regel greift unabhängig davon, ob er wirklich flieht (das ist für ein Programm nicht entscheidbar). Für die KI nehme ich zusätzlich ein festes Zuglimit als Sicherheitsnetz.

## Standardaktionen

Pro Zug genau eine, nur mit eigenen Kreaturen. Einige Kreaturen haben Spezialitäten, die eine Standardaktion ergänzen oder verändern.

- **Movement (Bewegung):** Eine gewählte Kreatur auf ein angrenzendes unbesetztes Feld bewegen. Angrenzend heisst horizontal oder vertikal. Manche Kreaturen haben andere Bewegungsmuster (siehe Kreaturkarten).
- **Attack (Angriff):** Eine gewählte Kreatur auf ein angrenzendes Feld mit einer gegnerischen Kreatur bewegen. Angriffe sind nur auf Kreaturen mit niedrigerer Machtstufe möglich. Ausnahme: Stufe 3 besiegt zusätzlich Stufe 6.
- **Upgrade:** Die Machtstufe einer gewählten Kreatur um 1 erhöhen.
  - **[Annahme]** Stufe 6 ist das Maximum, eine 6 kann nicht aufgewertet werden.
- **Spell (Zauber):** Den Zauber einer gewählten Kreatur wirken. Zauber, die Reservewürfel brauchen, gehen nur, wenn genug Würfel in der Reserve sind. Manche Zauber verwenden die TP-Leiste. Manche Kreaturen haben keinen Zauber.

Es gibt **keine** Standardaktion, um Würfel aus der Reserve aufs Brett zu setzen. Neue Würfel kommen nur durch Fähigkeiten (z. B. Teilen) ins Spiel.

**[Frage G1]** Was passiert, wenn ein Spieler keine einzige gültige Aktion hat (z. B. keine Kreaturen mehr auf dem Brett)? **[Annahme]** Er verliert. Upgrade ist fast immer möglich, solange er eine Kreatur unter Stufe 6 hat.

## Besiegen und Siegpunkte

- Besiegte Kreaturen kommen ins **Exil** (ihres Besitzers).
- Der angreifende Spieler erhält VP in Höhe der **Machtstufe** der besiegten Kreatur.
- **Feldbonus:** Wird eine Kreatur in der gegnerischen Hälfte besiegt, gibt es zusätzlich VP gemäss Feldbonus. Beispiel: Eine Kreatur der Stufe 3 wird in der gegnerischen Versorgungszone besiegt, ergibt 3 + 3 = 6 VP.
- Massgebend ist das Feld, auf dem die besiegte Kreatur stand (= Zielfeld des Angriffs), aus Sicht des Angreifers.
- Fähigkeiten können davon abweichen, z. B. RoX Impact (1 VP pro Kreatur, kein Feldbonus) oder RoM Fake Gold (keine VP).
- **[Annahme]** VP über 10 werden nicht benötigt, da das Spiel bei 10 endet.

## Triggerpunkte

Triggerpunkte gibt es nur über Fähigkeiten. Die TP-Leiste geht bis 10.
- **[Annahme]** Mehr als 10 TP sind nicht möglich, und TP fallen nie unter 0.

## Machthierarchie (Power Hierarchy)

Eine Kreatur mit höherer Machtstufe besiegt alle Kreaturen mit niedrigerer Machtstufe. Ausnahme: Kreaturen der Stufe 3 besiegen zusätzlich Kreaturen der Stufe 6.

- Gleiche Stufe kann sich nicht besiegen.
- Stufe 6 besiegt Stufe 3 weiterhin. Auf den Karten ist die 3 rot als „bedrohende“ Kreatur markiert, weil sie umgekehrt auch die 6 besiegt.
- Kreaturkarten können eigene Hierarchien haben, z. B. RoX-Portal (1) besiegt niemanden, DoA Tidal Fisher je nach Anzahl.

## Fähigkeiten

- **Spezialitäten** (blaugrau) sind passiv, keine Standardaktion, und können beide Spieler betreffen.
- Farbige Balken zeigen, welche Standardaktion eine Fähigkeit verändert: grün Bewegung, rot Angriff, gelb Upgrade, violett Zauber.

## Übergreifende Regeln aus den Kreaturkarten

- **Herabstufen** ist möglich (z. B. LoD Brotherhood, DoA New Beginning). Fällt eine gegnerische Kreatur durch Herabstufen unter Stufe 1, kommt sie ins Exil, eine eigene in die Reserve (LoD Lifepulling, KoS Phalanx).
- **Teilen (Split)** ist ein häufiges Zaubermuster: Reservewürfel werden mit bestimmter Stufe auf bestimmte Felder gesetzt, die ursprüngliche Kreatur geht in die Reserve oder wird herabgestuft. Die Engine bekommt dafür einen gemeinsamen Baustein.
- **Virtuelle VP** zählen wie normale VP für die Siegbedingung, werden aber laufend aus der Brettsituation neu berechnet und nicht auf der Leiste angezeigt.
- **Zusatzaktionen** nach bestimmten Aktionen (z. B. Inner Fire, Wormhole, Sacrifice) erlauben mehrere Schritte in einem Zug. Die Engine bildet einen Zug deshalb als Folge von Teilschritten ab.
- **Ausrichtung** pro Würfel wird für KoS benötigt (siehe [KoS.md](KoS.md)).

## Glossar

- **Adjacent (angrenzend):** die horizontalen und vertikalen Nachbarfelder (4).
- **Diagonal:** die diagonalen Nachbarfelder (4).
- **Surrounding (umgebend):** alle horizontalen, vertikalen und diagonalen Nachbarfelder (8).
- **Gegnerische Kreaturen:** alle Kreaturen unter dem Kommando des Gegners auf dem Brett.
- **Eigene Kreaturen:** alle Kreaturen unter deinem Kommando auf dem Brett.
- **Freundliche Kreaturen (friendly):** alle eigenen Kreaturen ausser der gerade gewählten. Wichtig z. B. für „angrenzende freundliche Kreatur“.
- **Virtuelle Siegpunkte:** zählen wie im Kampf gewonnene VP, werden aber nicht auf der VP-Leiste angezeigt.
- Symbole: Krone = VP, Kralle = TP, schwarzer Totenkopf mit Zahl = gegnerische Kreatur dieser Stufe, roter Totenkopf = bedrohende gegnerische Kreatur (kann diese Kreatur ihrerseits besiegen).
- Immunitäten: roter Schild = immun gegen gegnerische Angriffe, violettes Buch = immun gegen gegnerische Zauber, blauer Pfeil = immun gegen gegnerische Spezialitäten.
