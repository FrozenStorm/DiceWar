# Würfelset LoD (Light of Dragons, Grundspiel)

Quelle: `img/LoD/rules/1.png` bis `6.png` und `marker.png`. Grundbegriffe stehen in [grundregeln.md](grundregeln.md). „Warlands“ auf den Karten bedeutet das Spielbrett.

## Übersicht

| Stufe | Kreatur | Fähigkeiten | Besiegt |
|---|---|---|---|
| 1 | Soul | Floating, Protective Barrier | niemanden |
| 2 | Ghost | Ghosttrail, Lifepulling, Cursed | 1 |
| 3 | Dragon Warrior | Brotherhood | 2, 1 und 6 |
| 4 | Blood Mage | Blood Trade | 3, 2, 1 |
| 5 | Fire Basilisk | Serpent Trail, Inner Fire | 4, 3, 2, 1 |
| 6 | Light Dragon | Dragon Blood, Luminous Flame | 5, 4, 3, 2, 1 |

## 1 · Soul

### `LoD.soul.floating` (movement)
Bewege dich beliebig weit über angrenzende eigene Souls.
- **[Annahme]** Die Soul springt über eine zusammenhängende Kette eigener Souls (jeweils angrenzend) und landet auf einem freien Feld angrenzend an die letzte übersprungene Soul.
- **[Frage LoD1]** Gilt das als eine einzige Bewegungsaktion? Darf die Richtung innerhalb der Kette wechseln?

### `LoD.soul.protective_barrier` (speciality)
Stehen 3 bis 6 Souls angrenzend zueinander (zusammenhängende Gruppe), bilden sie eine Schutzbarriere. Schutzbarrieren sind immun gegen Angriffe, Zauber und Spezialitäten gegnerischer Kreaturen.
Hinweis der Karte: Sind mehr als 6 Souls angrenzend zueinander, werden die überzähligen am Ende deines Zuges in die Reserve gelegt.
- Zwei Souls bilden keine Barriere (Bild).
- **[Frage LoD2]** Wer wählt bei mehr als 6 Souls, welche zurück in die Reserve gehen? **[Annahme]** Der Besitzer, und die verbleibenden 6 müssen zusammenhängend bleiben.

## 2 · Ghost

### `LoD.ghost.ghosttrail` (movement + attack)
Bewege dich oder greife an, bis zu 2 Felder in dieselbe Richtung. Du kannst dabei auch durch Kreaturen hindurchziehen.
- Bild: links zieht der Ghost 2 Felder geradeaus auf ein freies Feld, rechts zieht er durch einen gegnerischen 4er hindurch auf das freie Feld dahinter.
- **[Annahme]** Ein Angriff ist auf das 1. oder 2. Feld in gerader Linie möglich, das Zielfeld muss eine besiegbare Kreatur enthalten.

### `LoD.ghost.lifepulling` (speciality)
Zieht ein Ghost durch eine andere Kreatur hindurch (eigene oder gegnerische), verliert diese Kreatur 1 Stufe. Zusätzlich erhältst du 1 TP.
Hinweis der Karte: Gegnerische Kreaturen der Stufe 1 kommen sofort ins Exil. Eigene Kreaturen der Stufe 1 kommen in die Reserve.

### `LoD.ghost.cursed` (speciality)
Wird ein Ghost von einer gegnerischen Kreatur besiegt, wird deren Stufe um 2 herabgesetzt.
- Der kleinste mögliche Angreifer hat Stufe 3, die Stufe fällt also nie unter 1.

## 3 · Dragon Warrior

### `LoD.warrior.brotherhood` (spell)
Teile einen Dragon Warrior in 3 Souls.
Hinweis der Karte: Setze 2 Reservewürfel als Souls horizontal oder vertikal angrenzend an den Dragon Warrior. Stufe danach den Dragon Warrior zu einer Soul herab.
- Laut Bild ergeben die drei Souls eine gerade Linie (senkrecht oder waagrecht), der Dragon Warrior in der Mitte.
- **[Annahme]** Beide Zielfelder müssen frei sein.

## 4 · Blood Mage

### `LoD.mage.blood_trade` (spell)
Lege bis zu X Reservewürfel ins Exil und erhalte X+1 TP. X ist die Anzahl deiner Blood Mages auf dem Brett. Gib danach beliebig viele TP aus, um eigene Kreaturen aufzuwerten (1 TP pro Stufe). Nicht genutzte TP verfallen am Ende des Zuges.
Hinweis der Karte: Für jedes genutzte Upgrade wird der Indikatorwürfel auf der TP-Leiste um 1 Feld nach unten bewegt.
Wichtig: Der Zauber kann nicht auf den Blood Mage angewendet werden, der ihn wirkt.
- **[Frage LoD5]** „Bis zu X“ und „X+1 TP“ widersprechen sich leicht. Bekommt man bei Y ins Exil gelegten Würfeln (0 ≤ Y ≤ X) genau Y+1 TP oder immer X+1?
- **[Frage LoD6]** Verfallen alle TP am Ende des Zuges oder nur die aus diesem Zauber? Das betrifft vorher gesammelte TP.

## 5 · Fire Basilisk

### `LoD.basilisk.serpent_trail` (movement + attack)
Bewegt sich und greift immer diagonal an (statt orthogonal).

### `LoD.basilisk.inner_fire` (speciality)
Immer wenn der Fire Basilisk eine Kreatur besiegt, darf er eine zusätzliche Bewegung oder einen zusätzlichen Angriff ausführen.
- **[Annahme]** Kann sich verketten (jeder weitere Sieg gibt wieder eine Zusatzaktion).

## 6 · Light Dragon

### `LoD.dragon.dragon_blood` (spell)
Teile einen Light Dragon in 2 Dragon Warriors.
Hinweis der Karte: Setze 2 Reservewürfel als Dragon Warriors horizontal oder vertikal angrenzend an den Light Dragon. Lege danach den Light Dragon in die Reserve.
- **[Annahme]** Die beiden Felder sind beliebig unter den 4 angrenzenden wählbar und müssen frei sein.

### `LoD.dragon.luminous_flame` (speciality)
Erhalte 1 virtuellen VP für jede Kreatur der Stufe 6, die du mehr hast als dein Gegner auf dem Brett.
Hinweis der Karte: Virtuelle VP zählen gleich wie im Kampf gewonnene VP, werden aber nicht auf der VP-Leiste angezeigt.
- Die Karte bestätigt, dass virtuelle VP für die Siegbedingung zählen und laufend neu berechnet werden.

## Ortsplättchen: Die Ruinen (`LoD.marker.ruins`)

Vor der Aufstellungsphase werden 3 Ruinenplättchen gelegt (Zeile/Spalte ab 1, von Spieler 1 aus, Zeile 1 = oberste Reihe mit +3):
- Zeile 2, Spalte 6
- Zeile 4, Spalte 4 (Brettmitte)
- Zeile 6, Spalte 2

Regeln:
- **Alternative Siegbedingung:** Besetzt ein Spieler alle Ruinen gleichzeitig mit eigenen Kreaturen, gewinnt er am Ende seines Zuges.
- Kreaturen der Stufe 1, die auf einer Ruine stehen, kommen sofort in die Reserve.
