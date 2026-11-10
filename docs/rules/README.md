# DiceWar Regeln als Text

Ziel: Alle Regeln, die bisher nur als Bilder der Regelkarten existieren, als Text erfassen und von Daniel validieren lassen. Diese Texte sind die Grundlage für die Regel-Engine (Zugprüfung) und den KI-Gegner.

## Aufbau

| Datei | Inhalt | Status |
|---|---|---|
| [grundregeln.md](grundregeln.md) | Brett, Zugablauf, Standardaktionen, Machthierarchie, Glossar | Entwurf, viele offene Fragen |
| [RoX.md](RoX.md) | Würfelset RoX (Xeladron) | Entwurf, zur Prüfung |
| BoD.md, DoA.md, KoS.md, LoD.md, RoM.md | übrige Würfelsets | noch nicht erfasst |

## Konventionen

Jede Fähigkeit bekommt eine feste ID der Form `SET.kreatur.faehigkeit` (z. B. `RoX.portal.wormhole`). Die Engine verwendet später dieselben IDs, damit Regeltext und Code eindeutig zusammengehören.

Fähigkeitstyp (abgeleitet aus der Farbe des Balkens auf der Karte):

| Farbe | Typ | Bedeutung |
|---|---|---|
| grün | `movement` | Variante der Standardaktion Bewegung |
| rot | `attack` | Variante der Standardaktion Angriff |
| violett | `spell` | Zauber, verbraucht die Standardaktion Zauber |
| blaugrau | `speciality` | Spezialität, passiv oder automatisch ausgelöst |

Markierungen im Text:

- **[Annahme]** meine Interpretation, bitte bestätigen oder korrigieren
- **[Frage]** offen, ohne Antwort nicht umsetzbar

Quelle: Bilder in `img/global/` und `img/<SET>/rules/`. Die Karten sind auf Englisch, die Fähigkeitsnamen bleiben deshalb englisch.
