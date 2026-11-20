// Developer tool: training data for the evaluation weights. Replays the games
// of a series played with tools/study.mjs and writes, for every turn start in
// the war phase, the feature vector (ai/eval.js) and the result of the game
// (1 win, 0.5 draw, 0 loss) from the view of each player: once for the player
// to move and once for the other one (so the tempo feature can be learned).
// tools/fit_weights.py learns the weights from it.
//
//   node tools/features.mjs <series dir> [<series dir> ...] --out data.bin
//
// Output: <out> (Float32, rows of [label, turn, gameIndex, ...features]) and
// <out>.json (feature names, row count, games).
import fs from "node:fs";
import path from "node:path";
import { createGame, applyAction } from "../engine/core.js";
import { FEATURES, featureVector } from "../ai/eval.js";

const args = process.argv.slice(2);
const outArg = args.indexOf("--out");
const out = outArg < 0 ? "features.bin" : args[outArg + 1];
const dirs = args.filter((a, i) => !a.startsWith("--") && i !== outArg + 1);
const width = 3 + FEATURES.length;
const fd = fs.openSync(out, "w");
const games = [];
let rows = 0;
const f = new Float64Array(FEATURES.length);
for (const dir of dirs) {
  for (const file of fs.readdirSync(path.join(dir, "games")).filter((x) => x.endsWith(".json")).sort()) {
    const g = JSON.parse(fs.readFileSync(path.join(dir, "games", file), "utf8"));
    const lab = g.replay.lab, result = g.result;
    const gameIndex = games.length;
    games.push({ dir: path.basename(dir), id: result.id, set1: result.set1, set2: result.set2, locations: lab.game.locations, winner: result.winner, reason: result.reason, turns: result.turns });
    let s = createGame({ set1: lab.game.set1, set2: lab.game.set2, startingPlayer: lab.game.startingPlayer, locations: lab.game.locations, maxTurns: lab.game.maxTurns });
    const buf = [];
    let lastTurn = -1;
    for (const a of lab.actions) {
      if (s.phase === "war" && !s.pending.length && s.turnNumber !== lastTurn) {
        lastTurn = s.turnNumber;
        for (const p of [1, 2]) {
          featureVector(s, p, f);
          const label = !result.winner ? 0.5 : result.winner === p ? 1 : 0;
          buf.push(label, s.turnNumber, gameIndex, ...f);
        }
      }
      s = applyAction(s, a);
    }
    fs.writeSync(fd, Buffer.from(Float32Array.from(buf).buffer));
    rows += buf.length / width;
  }
}
fs.closeSync(fd);
fs.writeFileSync(`${out}.json`, JSON.stringify({ features: FEATURES, rows, width, games }, null, 1));
console.log(`${games.length} games, ${rows} positions, ${FEATURES.length} features -> ${out}`);
