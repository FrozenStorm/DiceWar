# DiceWar
DiceWar is a dice strategy game for two players by Suncoregames GmbH. This is an implementation as a web game by Z-Craft.

## Original game
https://www.suncoregames.ch/

## Implementation
https://www.z-craft.ch/

## Rules engine and AI (in development)
- `docs/rules/` – all rules as text (base rules and one file per dice set)
- `engine/` – rules engine (plain ES modules, no build step): `core.js` for the base rules, `sets/<SET>.js` per dice set (RoX, BoD, LoD, RoM, KoS so far), `locations/` for location tiles
- `ai/` – AI opponent; runs in a Web Worker (`ui/ai-worker.js`): `ai.js` (levels easy/medium/hard: minimax with alpha-beta pruning), `expert.js` (level expert: transposition table, move ordering, late move reductions, quiescence search), `eval.js` (position evaluation), `setup.js` (starting lineups)
- `tools/bench.mjs` – developer tool: plays one AI level against another on all CPU cores (`node tools/bench.mjs --a expert --b hard`)
- `ui/rules-mode.js` – connects the engine and the AI to the board in `index.html`
- `ui/animate.js` – animations of moves, level changes, defeats and spell costs (from the engine event log)
- `test/` – automated tests, run with `npm test` (Node.js 20 or newer, no dependencies)
