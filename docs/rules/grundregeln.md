# Grundregeln

Quellen: `img/global/zugablauf.png` (Overview Turn), `img/global/glossar.png` (Glossary) und der bestehende Code in `index.html`. Das offizielle Regelheft (Light of Dragons) war für mich nicht abrufbar. Alles, was nicht auf den Karten steht, ist deshalb als Annahme oder Frage markiert.

## Material und Brett

- Brett mit 7 × 7 Feldern.
- Jeder Spieler hat 15 Würfel desselben Sets. Jede Würfelseite ist eine Kreatur, die Augenzahl (1 bis 6) ist ihre Machtstufe (Power Level).
- Bereiche pro Spieler: **Reserve** (zu Beginn 15 Würfel), **Exil** (zu Beginn 0), **Triggerpunkte** (TP, zu Beginn 0), **Siegpunkte** (VP, zu Beginn 0).
- Feldbonus-Reihen: Von Spieler 1 aus gesehen tragen die drei obersten Reihen die Boni +3, +2, +1 (oberste Reihe +3). Für Spieler 2 gilt das gespiegelt für die drei untersten Reihen. Die mittlere Reihe hat keinen Bonus.
  - **[Annahme]** Der Bonus gilt für Kreaturen, die in der gegnerischen Hälfte einen Gegner besiegen (siehe Siegpunkte).
- Ortsplättchen (z. B. RoX-Krater) werden vor der Aufstellungsphase gelegt. Im Code sind das die Feldtypen, die in Runde 1 gesetzt werden.

**[Frage G1]** Was ist die „eigene Zone“ (own Zone, z. B. bei Xeladron/Decay)? Die drei Reihen auf der eigenen Seite oder nur die hinterste Reihe?

## Aufstellungsphase (Setup Phase)

**[Frage G2]** Wie läuft die Aufstellung ab? Wie viele Würfel stellt jeder Spieler auf, mit welcher Stufe, auf welche Felder, und wer beginnt?

## Zugablauf (Overview Turn)

1. **TP-Leiste prüfen.** **[Annahme]** Hier werden alle Effekte „zu Beginn deines Zuges“ ausgelöst (z. B. RoX Energy Circle, RoX Krater).
2. **Genau eine Standardaktion ausführen:**
   - **Movement (Bewegung):** Eine eigene Kreatur 1 Feld auf ein angrenzendes (orthogonales) unbesetztes Feld bewegen.
   - **Attack (Angriff):** Eine eigene Kreatur auf ein angrenzendes Feld mit einer gegnerischen Kreatur bewegen. Dabei gilt die Machthierarchie.
   - **Upgrade:** Die Machtstufe einer eigenen Kreatur um 1 erhöhen.
   - **Spell (Zauber):** Einen Zauber einer eigenen Kreatur wirken.
3. **Siegpunkt-Leiste prüfen.** Wer 10 VP hat, gewinnt.

**[Frage G3]** Gibt es eine Aktion „Würfel aus der Reserve aufs Brett setzen“? Im heutigen Code kann man jederzeit einen Würfel mit Stufe 1 aus der Reserve setzen. Ist das eine eigene Standardaktion, und wo darf er hin (nur eigene Grundreihe)?

**[Frage G4]** Kann ein Upgrade über 6 hinausgehen oder ist 6 das Maximum? Und darf man auf einen Zug verzichten (passen), wenn keine Aktion möglich ist?

## Angriff und Besiegen

- Die angreifende Kreatur zieht auf das Feld der verteidigenden Kreatur. Die verteidigende Kreatur ist besiegt.
- **[Frage G5]** Wohin kommt eine besiegte Kreatur: in die Reserve oder ins Exil des Besitzers? Wann kommt etwas ins Exil (nur über Fähigkeiten wie Impact)?
- **[Frage G6]** Wie viele VP gibt ein Sieg? **[Annahme]** 1 VP plus Feldbonus des Feldes, auf dem der Gegner besiegt wurde (Impact erwähnt „Field Bonus Points“, die man normalerweise bekommt).

## Machthierarchie (Power Hierarchy)

Kette laut Karte: 6 → 5 → 4 → 3 → 2 → 1.
**Ausnahme:** Kreaturen mit Stufe 3 besiegen zusätzlich Kreaturen mit Stufe 6.

- **[Annahme]** Eine Kreatur besiegt alle Kreaturen mit niedrigerer Stufe (die Kreaturkarten bestätigen das: z. B. 5 besiegt 4, 3, 2, 1). Gleiche Stufe kann nicht angreifen.
- **[Annahme]** Stufe 6 kann Stufe 3 weiterhin besiegen. Die Xeladron-Karte zeigt die 3 als rot „bedrohenden“ Gegner, also eine Kreatur, die umgekehrt auch die 6 besiegt.
- Kreaturkarten können eigene Hierarchien haben. Beispiel RoX-Portal (1) besiegt niemanden.

## Glossar

- **Adjacent (angrenzend):** die 4 orthogonalen Nachbarfelder.
- **Diagonal:** die 4 diagonalen Nachbarfelder.
- **Surrounding (umgebend):** alle 8 Nachbarfelder.
- Symbole: Krone = Siegpunkte (VP), Kralle = Triggerpunkte (TP), schwarzer Totenkopf mit Zahl = gegnerische Kreatur dieser Stufe, roter Totenkopf = bedrohende gegnerische Kreatur (kann diese Kreatur besiegen).
- Immunitäten: roter Schild = immun gegen gegnerische Angriffe, violettes Buch = immun gegen gegnerische Zauber, blauer Pfeil = immun gegen gegnerische Spezialitäten.

**[Frage G7]** Wie bekommt man Triggerpunkte allgemein? Gibt es neben Fähigkeiten (z. B. RoX Arrival) eine Grundregel? Gibt es ein Maximum?

**[Frage G8]** Gibt es weitere Siegbedingungen, z. B. wenn ein Spieler keine Kreaturen mehr hat oder nicht ziehen kann?
