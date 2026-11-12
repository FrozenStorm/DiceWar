// Developer tool: finds good starting lineups for a dice set by self-play.
// Every candidate lineup plays expert-vs-expert games against all dice sets
// (which use their normal lineups); the best candidates go on to the next
// round with more games. Not part of the web app.
//
//   node tools/setups.mjs --set RoX [--nodes 6000] [--rounds 6,12,24] [--keep 8,4]
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import os from "node:os";
import { createGame, applyAction, actor, setupLevelCombinations } from "../engine/core.js";
import { chooseAction, chooseSetup } from "../ai/ai.js";
import { centredPlacements } from "../ai/setup.js";
import { getSet } from "../engine/sets/index.js";
import { mulberry32, deriveSeed } from "../ai/rng.js";

const SETS = ["RoX", "BoD", "LoD", "RoM", "KoS", "DoA"];

function playGame(g) {
  const random = mulberry32(g.seed);
  let s = createGame({
    set1: g.aPlayer === 1 ? g.set : g.opp, set2: g.aPlayer === 1 ? g.opp : g.set,
    startingPlayer: g.startingPlayer, maxTurns: 160,
  });
  while (s.phase !== "over") {
    const p = s.phase === "setup" ? s.current : actor(s);
    let action;
    if (s.phase === "setup") action = chooseSetup(s, { level: "expert", random, placements: p === g.aPlayer ? g.placements : undefined });
    else action = chooseAction(s, { level: "expert", random, maxNodes: g.nodes }).action;
    s = applyAction(s, action);
  }
  const w = s.result.winner;
  return { id: g.id, score: w === 0 ? 0.5 : w === g.aPlayer ? 1 : 0 };
}

if (!isMainThread) {
  parentPort.on("message", (g) => {
    try { parentPort.postMessage(playGame(g)); } catch (e) { parentPort.postMessage({ error: String(e.stack || e) }); }
  });
} else {
  const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? def : process.argv[i + 1]; };
  const set = arg("set", "RoX");
  const nodes = Number(arg("nodes", 6000));
  const rounds = arg("rounds", "6,12,24").split(",").map(Number);
  const keep = arg("keep", "8,4").split(",").map(Number);
  const threads = Number(arg("threads", os.cpus().length));

  const key = (pl) => [...pl].sort((a, b) => a.col - b.col).map((p) => `${p.col}:${p.level}`).join(" ");
  const seen = new Set();
  let cands = [];
  const add = (placements) => { const k = key(placements); if (!seen.has(k)) { seen.add(k); cands.push({ id: cands.length, placements, k, score: 0, games: 0 }); } };
  const book = getSet(set).aiBook;
  for (const pl of (book && book.setups) || []) add(pl);
  for (const levels of setupLevelCombinations()) add(centredPlacements(levels));

  const workers = Array.from({ length: threads }, () => new Worker(new URL(import.meta.url)));
  const run = (games) => new Promise((resolve) => {
    let next = 0, done = 0;
    const feed = (w) => { if (next < games.length) w.postMessage(games[next++]); };
    for (const w of workers) {
      w.removeAllListeners("message");
      w.on("message", (r) => {
        if (r.error) { console.error(r.error); process.exit(1); }
        const c = cands.find((x) => x.id === r.id); c.score += r.score; c.games++;
        if (++done === games.length) resolve(); else feed(w);
      });
      feed(w);
    }
  });

  let seedN = 0;
  for (let r = 0; r < rounds.length; r++) {
    const games = [];
    for (const c of cands) for (let n = 0; n < rounds[r]; n++) {
      games.push({ id: c.id, placements: c.placements, set, opp: SETS[n % SETS.length], nodes,
        aPlayer: ((n / SETS.length | 0) % 2) + 1, startingPlayer: ((n / (2 * SETS.length) | 0) + n) % 2 + 1,
        seed: deriveSeed(77, r, n) }); // the same seeds for every candidate
    }
    const t0 = Date.now();
    await run(games);
    cands.sort((a, b) => b.score / b.games - a.score / a.games);
    console.log(`${set} round ${r + 1}: ${games.length} games, ${Math.round((Date.now() - t0) / 1000)} s`);
    for (const c of cands.slice(0, 10)) console.log(`  ${(100 * c.score / c.games).toFixed(0).padStart(3)}% of ${c.games}  ${c.k}`);
    if (r < keep.length) cands = cands.slice(0, keep[r]);
  }
  console.log(`RESULT ${set} ${JSON.stringify(cands.slice(0, 3).map((c) => c.placements))}`);
  for (const w of workers) w.terminate();
}
