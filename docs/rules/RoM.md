# Würfelset RoM (Mali)

Quelle: `img/RoM/rules/1.png` bis `6.png` und `marker.png`. Grundbegriffe stehen in [grundregeln.md](grundregeln.md).

## Übersicht

| Stufe | Kreatur | Fähigkeiten | Besiegt |
|---|---|---|---|
| 1 | Golden Fruit | Fake Gold, Breeding | niemanden |
| 2 | Sprout | Velocity, Golden Seed, Tenacity | 1 |
| 3 | Torch Bearer | Fire Demon | 2, 1 und 6 |
| 4 | Protectress of the Woods | Fellowship, Breath of Life, Symbiosis | 3, 2, 1 |
| 5 | Shadow Runner | Secret Pathway, Out of the Dark | 4, 3, 2, 1 |
| 6 | Mali | Children of the Woods, Deep Roots | 5, 4, 3, 2, 1 |

## 1 · Golden Fruit

### `RoM.fruit.fake_gold` (speciality)
Die Golden Fruit kann sich nicht bewegen, und ihre Stufe kann nicht erhöht werden. Wer eine Golden Fruit besiegt, erhält weder VP noch Feldbonus. Eine besiegte Golden Fruit kommt in die Reserve ihres Besitzers.
- Ausnahme: Breath of Life (Protectress) erhöht ausdrücklich die Stufe einer Golden Fruit. **[Annahme]** Die Karte der Protectress hat Vorrang, Fake Gold verbietet nur die Standardaktion Upgrade.
- **[Frage RoM1]** „returned to your Reserve“: Reserve des Besitzers der Frucht oder des Angreifers? **[Annahme]** des Besitzers.

### `RoM.fruit.breeding` (spell)
Teile die Golden Fruit in 2 Golden Fruits.
Hinweis der Karte: Setze 2 Reservewürfel als Golden Fruits horizontal oder vertikal angrenzend an diese Golden Fruit. Lege danach diese Golden Fruit in die Reserve.

## 2 · Sprout

### `RoM.sprout.velocity` (movement + attack)
Bewege dich oder greife an, bis zu 2 Felder in dieselbe Richtung.
- **[Annahme]** Anders als der LoD-Ghost nicht durch Kreaturen hindurch, das Zwischenfeld muss frei sein.

### `RoM.sprout.golden_seed` (speciality)
Bewegt sich der Sprout nur 1 Feld, darfst du eine Golden Fruit aus deiner Reserve auf das Feld setzen, von dem er gestartet ist.
- **[Frage RoM2]** Gilt das auch nach einem Angriff über 1 Feld oder nur nach einer Bewegung?

### `RoM.sprout.tenacity` (speciality)
Greift eine gegnerische Kreatur den Sprout an, muss der Gegner 2 seiner Reservewürfel ins Exil legen, sofern möglich.
Hinweis der Karte: Der Angriff ist auch erlaubt, wenn der Gegner weniger als 2 oder keine Würfel in der Reserve hat.

## 3 · Torch Bearer

### `RoM.torch.fire_demon` (movement + attack)
Bewege dich oder greife an, indem du über eine oder mehrere eigene Kreaturen der Stufen 1, 2 und 6 springst, die aneinander angrenzen. Lege die übersprungenen Kreaturen zurück in deine Reserve.
- Bild: Der Torch Bearer überspringt eine Reihe aus Golden Fruit (1), Sprout (2) und Mali (6) und landet dahinter. Hier wird anschliessend noch die Richtung gewechselt: Er landet diagonal oberhalb des Mali auf dem Feld rechts neben einer Golden Fruit. Im Bild bleiben übersprungene Kreaturen grau stehen, die Golden Fruit über dem Mali ist schwarz.
- **[Frage RoM3]** Das Bild ist für mich nicht eindeutig. Springt der Torch Bearer nur in gerader Linie über die Kette, oder kann er der Kette (auch um Ecken) folgen? Werden alle übersprungenen Kreaturen in die Reserve gelegt, auch die Mali (6)?

## 4 · Protectress of the Woods

### `RoM.protectress.fellowship` (speciality)
Erhalte zu Beginn deines Zuges 1 TP für jede deiner Protectresses auf dem Brett.
Hinweis der Karte: Verliere alle TP, sobald du keine Protectress mehr auf dem Brett hast.

### `RoM.protectress.breath_of_life` (spell)
Lege 1 Reservewürfel in dein Exil. Nutze beliebig viele verfügbare TP, um die Stufe einer deiner Golden Fruits zu erhöhen.
Beispiel der Karte: 4 TP = +4 Stufen (Golden Fruit 1 wird zum Shadow Runner 5).
- **[Annahme]** Maximal Stufe 6, also höchstens 5 TP.

### `RoM.protectress.symbiosis` (upgrade)
Gelber Balken, also eine Variante der Standardaktion Upgrade: Bewege deine Protectress auf eine angrenzende eigene Golden Fruit. Lege die Golden Fruit in die Reserve. Erhöhe danach die Stufe der Protectress um 1 (sie wird zum Shadow Runner).

## 5 · Shadow Runner

### `RoM.runner.secret_pathway` (movement + attack)
Einmal pro Zug: Bewege dich oder greife an, indem du über den Seitenrand des Bretts hinaus ziehst und auf der gegenüberliegenden Seite wieder hereinkommst (Fig. 1). Danach darfst du eine weitere Bewegung oder einen weiteren Angriff ausführen (Fig. 2). Secret Pathway kann mit Out of the Dark kombiniert werden.
- Nur links/rechts (Seitenlinie), nicht oben/unten.
- **[Annahme]** Die Zusatzaktion ist eine normale Bewegung oder ein normaler Angriff (1 Feld orthogonal). Fig. 2 zeigt oben, rechts und unten als Ziele.

### `RoM.runner.out_of_the_dark` (movement + attack)
Bewege dich oder greife an, indem du über einen angrenzenden eigenen Shadow Runner springst. Kann mit Secret Pathway kombiniert werden.

## 6 · Mali

### `RoM.mali.children_of_the_woods` (spell)
Teile einen Mali in 3 Sprouts.
Hinweis der Karte: Setze 3 Reservewürfel als Sprouts irgendwo in deiner Zone. Lege danach den Mali in die Reserve.
- Das Bild bestätigt: Die eigene Zone sind die 3 Reihen auf deiner Seite (inklusive der grauen hintersten Reihe). Das gilt auch, wenn der Mali in der gegnerischen Zone steht.

### `RoM.mali.deep_roots` (speciality)
Erhalte 1 virtuellen VP für jeden deiner Mali in der Zone des Gegners.

## Ortsplättchen: Das Lager (`RoM.marker.camp`)

In der Aufstellungsphase setzt jeder Spieler sein Lager auf ein beliebiges freies Feld seiner Versorgungszone (Supply Zone, die graue hinterste Reihe).

Regeln:
- Ziehst du eine Kreatur in dein eigenes Lager, kommt sie sofort in deine Reserve.
- Ziehst du eine Kreatur in das Lager des Gegners, kommt sie sofort in dein Exil. Der Gegner muss so viele Kreaturwürfel in sein Exil legen, wie die Stufe der Kreatur beträgt.
- **[Frage RoM4]** Woher nimmt der Gegner diese Würfel: aus der Reserve, vom Brett oder nach Wahl?
- **[Frage RoM5]** Gibt es das Lager pro Spieler nur, wenn RoM gespielt wird, oder auch für den Gegner?
