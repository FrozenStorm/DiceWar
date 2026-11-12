// Developer tool: plays AI level A against AI level B on all CPU cores and
// prints win rates. Not part of the web app.
//
//   node tools/bench.mjs --a expert --b hard --ta 1000 --tb 500 --games 8
//
// Options:
//   --a, --b       AI levels (default: expert, hard)
//   --ta, --tb     time per move in ms (default: the level's own time)
//   --na, --nb     node budget per move instead of a time limit (reproducible)
//   --games        games per pairing (default 4; sides and starting player alternate)
//   --pairs        e.g. "RoX-RoX,LoD-KoS" (default: every set against itself);
//                  "all" = all 36 ordered pairings; A always plays the first set
//   --locs         landscapes, e.g. "none,ruins" (default: none)
//   --maxTurns     turn limit (default 200)
//   --seed         base seed (default 1)
//   --threads      worker threads (default: number of CPU cores)
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import os from "node:os";
import { createGame, applyAction, actor, totalVP } from "../engine/core.js";
import { chooseAction, chooseSetup } from "../ai/ai.js";
import { mulberry32, deriveSeed } from "../ai/rng.js";

const SETS = ["RoX", "BoD", "LoD", "RoM", "KoS", "DoA"];

function playGame(g) {
  const random = mulberry32(g.seed);
  let s = createGame({
    set1: g.aPlayer === 1 ? g.setA : g.setB,
    set2: g.aPlayer === 1 ? g.setB : g.setA,
    startingPlayer: g.startingPlayer,
    locations: g.location === "none" ? [] : g.location.split("+"),
    maxTurns: g.maxTurns,
  });
  const side = (p) => (p === g.aPlayer ? g.a : g.b);
  const stats = { a: { n: 0, depth: 0, nodes: 0, ms: 0 }, b: { n: 0, depth: 0, nodes: 0, ms: 0 } };
  while (s.phase !== "over") {
    const p = s.phase === "setup" ? s.current : actor(s);
    const cfg = side(p);
    const opts = { level: cfg.level, random };
    if (cfg.nodes) opts.maxNodes = cfg.nodes;
    else if (cfg.timeMs) opts.overrides = { timeMs: cfg.timeMs };
    let action;
    if (s.phase === "setup") action = chooseSetup(s, opts);
    else {
      const t = performance.now();
      const r = chooseAction(s, opts);
      action = r.action;
      if (r.nodes) {
        const st = stats[p === g.aPlayer ? "a" : "b"];
        st.n++; st.depth += r.depth; st.nodes += r.nodes; st.ms += performance.now() - t;
      }
    }
    s = applyAction(s, action);
  }
  const w = s.result.winner;
  return {
    pair: `${g.setA}-${g.setB}`, location: g.location,
    result: w === 0 ? "draw" : w === g.aPlayer ? "a" : "b",
    reason: s.result.reason, turns: s.turnNumber,
    vpA: totalVP(s, g.aPlayer), vpB: totalVP(s, 3 - g.aPlayer), stats,
  };
}

if (!isMainThread) {
  parentPort.on("message", (g) => {
    try { parentPort.postMessage(playGame(g)); } catch (e) { parentPort.postMessage({ error: String(e.stack || e), g }); }
  });
} else {
  const arg = (name, def) => {
    const i = process.argv.indexOf(`--${name}`);
    return i < 0 ? def : process.argv[i + 1];
  };
  const a = { level: arg("a", "expert"), timeMs: Number(arg("ta", 0)), nodes: Number(arg("na", 0)) };
  const b = { level: arg("b", "hard"), timeMs: Number(arg("tb", 0)), nodes: Number(arg("nb", 0)) };
  const gamesPer = Number(arg("games", 4));
  const pairsArg = arg("pairs", "mirror");
  const pairs = pairsArg === "mirror" ? SETS.map((x) => [x, x])
    : pairsArg === "all" ? SETS.flatMap((x) => SETS.map((y) => [x, y]))
    : pairsArg.split(",").map((p) => p.split("-"));
  const locs = arg("locs", "none").split(",");
  const maxTurns = Number(arg("maxTurns", 200));
  const seed = Number(arg("seed", 1));
  const threads = Number(arg("threads", os.cpus().length));

  const games = [];
  for (const [setA, setB] of pairs) for (const location of locs) for (let n = 0; n < gamesPer; n++) {
    games.push({
      setA, setB, location, a, b, maxTurns,
      aPlayer: (n % 2) + 1, startingPlayer: ((n >> 1) % 2) + 1,
      seed: deriveSeed(seed, games.length),
    });
  }
  const results = [];
  let next = 0, running = 0;
  const t0 = Date.now();
  await new Promise((resolve) => {
    const feed = (w) => {
      if (next >= games.length) { w.terminate(); if (--running === 0) resolve(); return; }
      w.postMessage(games[next++]);
    };
    for (let i = 0; i < Math.min(threads, games.length); i++) {
      const w = new Worker(new URL(import.meta.url));
      running++;
      w.on("message", (r) => {
        if (r.error) { console.error(r.error, r.g); process.exitCode = 1; } else results.push(r);
        feed(w);
      });
      feed(w);
    }
  });

  const line = (label, rs) => {
    const c = { a: 0, b: 0, draw: 0 };
    const reasons = {};
    const st = { a: { n: 0, depth: 0, nodes: 0, ms: 0 }, b: { n: 0, depth: 0, nodes: 0, ms: 0 } };
    let turns = 0;
    for (const r of rs) {
      c[r.result]++; turns += r.turns;
      reasons[r.reason] = (reasons[r.reason] || 0) + 1;
      for (const k of ["a", "b"]) for (const f in st[k]) st[k][f] += r.stats[k][f];
    }
    const score = (c.a + c.draw / 2) / rs.length;
    const f = (x) => `d${(x.depth / x.n).toFixed(1)} ${Math.round(x.nodes / x.ms)}kn/s`;
    console.log(`${label.padEnd(16)} A ${String(c.a).padStart(3)}  B ${String(c.b).padStart(3)}  = ${String(c.draw).padStart(2)}  score ${(100 * score).toFixed(0).padStart(3)}%  turns ${(turns / rs.length).toFixed(0).padStart(3)}  A[${f(st.a)}] B[${f(st.b)}]  ${JSON.stringify(reasons)}`);
  };
  console.log(`A = ${JSON.stringify(a)}  B = ${JSON.stringify(b)}  (${games.length} games, ${Math.round((Date.now() - t0) / 1000)} s)`);
  const keys = [...new Set(results.map((r) => `${r.pair} ${r.location}`))];
  for (const k of keys) line(k, results.filter((r) => `${r.pair} ${r.location}` === k));
  if (keys.length > 1) line("TOTAL", results);
}
