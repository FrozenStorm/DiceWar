# Würfelset BoD (Bond of Demons)

Quelle: `img/BoD/rules/1.png` bis `6.png` und `marker.png`. Grundbegriffe stehen in [grundregeln.md](grundregeln.md).

Hinweis: Laut suncoregames.ch gibt es Errata für Todjäger (Hunter of Death) und Moorhexe (Swamp Hag). Ob die Karten im Repo bereits die korrigierte Fassung sind, ist unklar. **[Frage BoD0]**

## Übersicht

| Stufe | Kreatur | Fähigkeiten | Besiegt |
|---|---|---|---|
| 1 | Gnome | Protective Aura | niemanden |
| 2 | Possessed | Temptation | 1 |
| 3 | Hunter of Death | Hunter's Path, Dark Fusion | 2, 1 und 6 |
| 4 | Swamp Hag | Black Magic, Voodoo, Servitude | 3, 2, 1 |
| 5 | Gatherer | Mercy, Sacrifice | 4, 3, 2, 1 |
| 6 | Demon of Darkness | Allegiance, Bound | 5, 4, 3, 2, 1 |

## 1 · Gnome

### `BoD.gnome.protective_aura` (speciality)
Deine an den Gnome angrenzenden Kreaturen mit Stufe 2 oder höher können nicht angegriffen werden.
- Bild: Die geschützten Kreaturen (6 oben, 2 rechts) tragen den Schild. Der Gnome selbst und ein angrenzender Gnome (Stufe 1) sind nicht geschützt.

## 2 · Possessed

### `BoD.possessed.temptation` (speciality)
Wenn möglich, müssen angrenzende gegnerische Kreaturen mit Stufe 3 oder höher im folgenden Zug den Possessed angreifen.
Hinweise der Karte:
- Stehen mehrere gegnerische Kreaturen angrenzend, entscheidet der Gegner, mit welcher er angreift.
- Ist der Possessed durch einen angrenzenden Gnome geschützt, kann der Gegner ihn nicht angreifen und muss eine andere Aktion wählen.
- Für die Engine: Gibt es zu Beginn des gegnerischen Zuges einen gültigen Angriff einer Kreatur mit Stufe 3+ auf einen angrenzenden Possessed, sind nur solche Angriffe erlaubt.
- **[Frage BoD1]** Gilt der Zwang auch, wenn der Possessed immun ist (z. B. durch andere Effekte), oder wenn der Angreifer laut Hierarchie gar nicht besiegen kann? Ein Angreifer mit Stufe 3+ besiegt Stufe 2 immer, also eigentlich nur bei Schutz relevant.

## 3 · Hunter of Death

### `BoD.hunter.hunters_path` (movement)
Bewege den Hunter bis zu 2 Felder.
Hinweis der Karte: Angreifen kann er weiterhin nur auf angrenzende Felder.
- Bild: geradeaus oder mit Richtungswechsel (über Eck), jeweils über freie Felder.

### `BoD.hunter.dark_fusion` (upgrade)
Gelber Balken, also eine Variante der Standardaktion Upgrade: Bewege deinen Hunter of Death auf das Feld eines anderen eigenen Hunter of Death. Lege einen der beiden ins Exil. Werte den anderen zum Demon of Darkness (6) auf. Gibt es danach keinen weiteren eigenen Hunter of Death auf dem Brett, darfst du mit diesem Demon of Darkness eine zusätzliche Aktion ausführen.
- **[Annahme]** Der andere Hunter muss angrenzend sein (Bild).

## 4 · Swamp Hag

### `BoD.hag.black_magic` (speciality)
Erhöhe deine TP zu Beginn deines Zuges um 1, sofern mindestens eine deiner Swamp Hags auf dem Brett ist.
Hinweis der Karte: Sobald keine eigene Swamp Hag und kein eigener Possessed mehr auf dem Brett ist, verfallen die TP.

### `BoD.hag.voodoo` (spell)
Lege 1 Reservewürfel in dein Exil und wähle eine oder beide Optionen für verschiedene Possessed:
- 3 TP: Bewege einen deiner Possessed um 3 Felder, auch über Eck.
- 2 TP: Erhöhe einen deiner Possessed um 2 Stufen.
- **[Frage BoD2]** Darf die Bewegung um 3 Felder auch angreifen (letztes Feld besetzt)?

### `BoD.hag.servitude` (spell)
Teile die Swamp Hag in 2 Possessed.
Hinweis der Karte: Setze 2 Reservewürfel als Possessed horizontal oder vertikal angrenzend an die Swamp Hag. Lege danach die Swamp Hag in die Reserve.

## 5 · Gatherer

### `BoD.gatherer.mercy` (spell)
Setze 1 Reservewürfel als Gnome auf ein angrenzendes freies Feld.

### `BoD.gatherer.sacrifice` (movement, gemischter Balken)
Einmal pro Zug: Bewege den Gatherer auf ein angrenzendes Feld mit einem eigenen Gnome. Lege den Gnome in die Reserve. Du darfst eine zusätzliche Aktion nutzen: mit dem Gatherer eine Stufe aufsteigen, sich bewegen oder angreifen.

## 6 · Demon of Darkness

### `BoD.demon.allegiance` (spell)
Teile den Demon of Darkness in 1 Possessed und 1 Swamp Hag.
Hinweis der Karte: Stufe den Demon of Darkness zu einem Possessed herab. Setze 1 Reservewürfel als Swamp Hag auf ein freies Feld angrenzend an den Possessed.

### `BoD.demon.bound` (speciality)
Erhalte 1 virtuellen VP für jedes Paar aus Demon of Darkness und Possessed, unabhängig von ihrer Position.
Beispiel der Karte: 2 Demons und 3 Possessed auf dem Brett ergeben 2 Paare = 2 virtuelle VP. Also `min(#Demons, #Possessed)`.

## Ortsplättchen: Das Orakel (`BoD.marker.oracle`)

Das Orakel liegt in der Brettmitte (Zeile 4, Spalte 4).

Regeln:
- Steht am Ende deines Zuges eine deiner Kreaturen auf dem Orakel, wird ihre Stufe auf 4 gesetzt (aufgewertet oder herabgestuft).
- Du erhältst jeden Zug 1 zusätzlichen TP, solange du das Orakel besitzt (eine eigene Kreatur darauf steht).
Hinweis der Karte: Kreaturen auf dem Orakel können ihre Stufe nicht erhöhen.
- **[Frage BoD3]** Wird der TP zu Beginn des Zuges gutgeschrieben?
