# DiceWar
DiceWar is a dice strategy game for two players by Suncoregames GmbH. This is an implementation as a web game by Z-Craft.

## Original game
https://www.suncoregames.ch/

## Implementation
https://www.z-craft.ch/

## Rules engine and AI (in development)
- `docs/rules/` – all rules as text (base rules and one file per dice set)
- `engine/` – rules engine (plain ES modules, no build step): `core.js` for the base rules, `sets/<SET>.js` per dice set (RoX, BoD, LoD so far), `locations/` for location tiles
- `ai/ai.js` – AI opponent (minimax search with alpha-beta pruning, levels easy/medium/hard); runs in a Web Worker (`ui/ai-worker.js`)
- `ui/rules-mode.js` – connects the engine and the AI to the board in `index.html`
- `ui/animate.js` – animations of moves, level changes, defeats and spell costs (from the engine event log)
- `test/` – automated tests, run with `npm test` (Node.js 20 or newer, no dependencies)
