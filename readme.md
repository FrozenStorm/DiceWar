# DiceWar
DiceWar is a dice strategy game for two players by Suncoregames GmbH. This is an implementation as a web game by Z-Craft.

## Original game
https://www.suncoregames.ch/

## Implementation
https://www.z-craft.ch/

## Rules engine and AI (in development)
- `docs/rules/` – all rules as text (base rules and one file per dice set)
- `engine/` – rules engine (plain ES modules, no build step): `core.js` for the base rules, `sets/<SET>.js` per dice set, `locations/` for location tiles
- `test/` – automated tests, run with `npm test` (Node.js 20 or newer, no dependencies)
