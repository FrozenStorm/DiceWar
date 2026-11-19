// Developer tool: times a fixed-node search on saved war positions of one set
// (reproducible, for profiling move generation). Positions are collected from
// quick AI games the first time and saved to --file.
//   node tools/kosprof.mjs --file /tmp/kos.json [--positions 40] [--nodes 20000 | --ms 1000] [--set KoS] [--opp KoS] [--picks out.txt]
import fs from "node:fs";
import { createGame, applyAction, actor } from "../engine/core.js";
import { chooseAction, chooseSetup } from "../ai/ai.js";
import { mulberry32 } from "../ai/rng.js";
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i < 0 ? d : process.argv[i + 1]; };
const N = Number(arg("positions", 40)), NODES = Number(arg("nodes", 20000)), MS = Number(arg("ms", 0));
const SET = arg("set", "KoS"), OPP = arg("opp", "KoS"), FILE = arg("file", `/tmp/${SET}-${OPP}.json`);
let positions;
if (fs.existsSync(FILE)) positions = JSON.parse(fs.readFileSync(FILE, "utf8"));
else {
  positions = [];
  for (let g = 0; positions.length < N; g++) {
    const random = mulberry32(100 + g);
    let s = createGame({ set1: SET, set2: OPP, startingPlayer: (g % 2) + 1, maxTurns: 60 });
    let k = 0;
    while (s.phase !== "over" && positions.length < N) {
      let a;
      if (s.phase === "setup") a = chooseSetup(s, { level: "expert", random });
      else {
        if (s.players[actor(s)].set === SET && !s.pending.length && ++k % 3 === 0) positions.push(s);
        a = chooseAction(s, { level: "expert", random, maxNodes: 300 }).action;
      }
      s = applyAction(s, a);
    }
    console.error(`game ${g}: ${positions.length} positions`);
  }
  fs.writeFileSync(FILE, JSON.stringify(positions));
}
let nodes = 0, depth = 0;
const picks = [];
const t = performance.now();
for (const [i, s] of positions.entries()) {
  const r = chooseAction(s, MS ? { level: "expert", random: mulberry32(i), overrides: { timeMs: MS } }
    : { level: "expert", random: mulberry32(i), maxNodes: NODES });
  nodes += r.nodes; depth += r.depth; picks.push(JSON.stringify(r.action));
}
const ms = performance.now() - t;
console.log(`${positions.length} positions, ${nodes} nodes, ${ms.toFixed(0)} ms, ${(ms * 1000 / nodes).toFixed(1)} us/node, depth ${(depth / positions.length).toFixed(2)}`);
if (arg("picks")) fs.writeFileSync(arg("picks"), picks.join("\n"));
