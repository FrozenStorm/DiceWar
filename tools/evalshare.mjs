// Developer tool: share of the position evaluation in the search time, per set,
// on positions from a series played with tools/study.mjs.
//   node tools/evalshare.mjs <dir>
import fs from "node:fs"; import path from "node:path";
const R = new URL("../", import.meta.url).href;
const { createGame, applyAction } = await import(R + "engine/core.js");
const { chooseSearchAction } = await import(R + "ai/search.js");
const { evaluate } = await import(R + "ai/eval.js");
const dir = process.argv[2];
const SETS = ["RoX","BoD","LoD","RoM","KoS","DoA"];
const samples = Object.fromEntries(SETS.map(s => [s, []]));
for (const f of fs.readdirSync(path.join(dir, "games")).sort()) {
  const g = JSON.parse(fs.readFileSync(path.join(dir, "games", f)));
  const lab = g.replay.lab;
  let s = createGame({ set1: lab.game.set1, set2: lab.game.set2, startingPlayer: lab.game.startingPlayer, locations: lab.game.locations, maxTurns: lab.game.maxTurns });
  lab.actions.forEach((a, i) => { if (s.phase === "war" && !s.pending.length && i % 11 === 0) samples[s.players[s.current].set].push(s); s = applyAction(s, a); });
}
const cfg = { timeMs: 1e9, maxDepth: 40, quiescence: 4, noise: 0 };
for (const set of SETS) {
  const pick = samples[set].filter((_, i, a) => i % Math.floor(a.length / 8) === 0).slice(0, 8);
  let calls = 0, evalT = 0, total = 0, nodes = 0;
  for (const s of pick) {
    const fn = (x, p, W) => { calls++; const t = performance.now(); const v = evaluate(x, p, W); evalT += performance.now() - t; return v; };
    const t = performance.now();
    const r = chooseSearchAction(s, { ...cfg, evalFn: fn }, Math.random, 150000);
    total += performance.now() - t; nodes += r.nodes;
  }
  // timing overhead of performance.now pairs
  let o = performance.now(); for (let k = 0; k < 1e6; k++) performance.now(); const ov = (performance.now() - o) / 1e6;
  const evalNet = evalT - calls * ov;
  console.log(`${set}: nodes ${nodes}, evals ${calls} (${(calls/nodes).toFixed(1)}/node), total ${(total/1000).toFixed(1)}s, eval ${(evalNet/1000).toFixed(2)}s = ${(100*evalNet/total).toFixed(1)}%, µs/eval ${(1000*evalNet/calls).toFixed(2)}`);
}
