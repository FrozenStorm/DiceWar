// Developer tool: plays a series of AI games on all CPU cores and records
// every search (turn, depth, positions, time) for a statistical study. Each
// finished game is written at once to <out>/games/<id>.json, so an
// interrupted series keeps what it has; games already there are skipped.
// tools/study-report.mjs evaluates the folder. Not part of the web app.
//
//   node tools/study.mjs --out study [--pairs mixed|all|RoX-KoS,...] [--locs ruins]
//     [--a expert] [--b expert] [--ms 10000] [--nodes 0] [--maxTurns 200] [--seed 1]
//     [--repeat 1] [--noise 0] [--locMix none,ruins,...]
//
// --pairs mixed: the 15 pairings of two different sets, all: the 21 pairings
// including mirrors. Every pairing is played twice: each set starts once.
// --repeat: play every pairing and starting player that many times.
// --noise: random rating added to every root move (variety for training games).
// --locMix: one landscape per game, picked by its seed from this list
// ("none" = no landscape); replaces --locs.
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { createGame, applyAction, actor, totalVP, diceOf } from "../engine/core.js";
import { chooseAction, chooseSetup } from "../ai/ai.js";
import { mulberry32, deriveSeed } from "../ai/rng.js";

const SETS = ["RoX", "BoD", "LoD", "RoM", "KoS", "DoA"];

function playGame(g) {
  const random = mulberry32(g.seed);
  let s = createGame({ set1: g.set1, set2: g.set2, startingPlayer: g.startingPlayer, locations: g.locations, maxTurns: g.maxTurns });
  const levels = { 1: g.level1, 2: g.level2 };
  const searches = [], timeline = [], actions = [];
  const started = Date.now();
  let lastTurn = -1;
  while (s.phase !== "over") {
    const p = s.phase === "setup" ? s.current : actor(s);
    let action;
    if (s.phase === "setup") action = chooseSetup(s, { level: levels[p], random });
    else {
      if (s.turnNumber !== lastTurn && !s.pending.length) {
        lastTurn = s.turnNumber;
        timeline.push([s.turnNumber, totalVP(s, 1), totalVP(s, 2), diceOf(s, 1).length, diceOf(s, 2).length, s.players[1].reserve, s.players[2].reserve]);
      }
      const t = performance.now();
      const r = chooseAction(s, { level: levels[p], random, maxNodes: g.nodes || 0, overrides: { ...(g.nodes ? {} : { timeMs: g.ms }), ...(g.noise ? { noise: g.noise } : {}) } });
      const ms = performance.now() - t;
      action = r.action;
      // [turn, player, inside a turn, depth, positions, ms, kind of decision]
      if (r.nodes) searches.push([s.turnNumber, p, s.pending.length ? 1 : 0, r.depth, r.nodes, Math.round(ms), s.pending.length ? s.pending[0].kind : action.ability || action.type]);
    }
    actions.push(action);
    s = applyAction(s, action);
  }
  const w = s.result.winner;
  const result = {
    id: g.id, set1: g.set1, set2: g.set2, level1: g.level1, level2: g.level2, locations: g.locations,
    startingPlayer: g.startingPlayer, seed: g.seed, ms: g.ms, nodes: g.nodes,
    winner: w, winnerSet: w === 1 ? g.set1 : w === 2 ? g.set2 : "", reason: s.result.reason,
    turns: s.turnNumber, vp1: totalVP(s, 1), vp2: totalVP(s, 2), seconds: Math.round((Date.now() - started) / 1000),
  };
  s.events = [];
  // The replay can be loaded in the game like an AI Lab replay.
  const replay = { version: 1, snapshot: { rulesGame: s }, lab: { game: { ...g, location: g.locations[0] || "" }, result, actions } };
  return { result, searches, timeline, replay };
}

if (!isMainThread) {
  parentPort.on("message", (g) => {
    try { parentPort.postMessage({ id: g.id, data: playGame(g) }); } catch (e) { parentPort.postMessage({ id: g.id, error: String(e.stack || e) }); }
  });
} else {
  const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? def : process.argv[i + 1]; };
  const out = arg("out", "study");
  const pairsArg = arg("pairs", "mixed");
  const pairs = pairsArg === "mixed" ? SETS.flatMap((x, i) => SETS.slice(i + 1).map((y) => [x, y]))
    : pairsArg === "all" ? SETS.flatMap((x, i) => SETS.slice(i).map((y) => [x, y]))
    : pairsArg.split(",").map((p) => p.split("-"));
  const base = {
    locations: arg("locs", "ruins").split(",").filter((l) => l && l !== "none"),
    level1: arg("a", "expert"), level2: arg("b", "expert"),
    ms: Number(arg("ms", 10000)), nodes: Number(arg("nodes", 0)), maxTurns: Number(arg("maxTurns", 200)),
    noise: Number(arg("noise", 0)),
  };
  const repeat = Number(arg("repeat", 1));
  const locMix = arg("locMix", "").split(",").filter(Boolean);
  const seed = Number(arg("seed", 1));
  const games = [];
  for (let r = 0; r < repeat; r++) {
    for (const [set1, set2] of pairs) {
      for (const startingPlayer of [1, 2]) {
        const id = `${String(games.length + 1).padStart(repeat > 1 ? 5 : 3, "0")}-${set1}-${set2}-p${startingPlayer}`;
        const gameSeed = deriveSeed(seed, games.length);
        const locations = locMix.length ? [locMix[gameSeed % locMix.length]].filter((l) => l !== "none") : base.locations;
        games.push({ ...base, id, set1, set2, startingPlayer, seed: gameSeed, locations });
      }
    }
  }
  const dir = path.join(out, "games");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(out, "config.json"), JSON.stringify({ ...base, pairs, seed, repeat, locMix, games: games.length }, null, 2));
  const todo = games.filter((g) => !fs.existsSync(path.join(dir, `${g.id}.json`)));
  console.log(`${games.length} games, ${todo.length} to play`);

  const threads = Math.min(Number(arg("threads", os.cpus().length)), todo.length);
  let next = 0, done = 0;
  const t0 = Date.now();
  await new Promise((resolve) => {
    if (!todo.length) return resolve();
    for (let i = 0; i < threads; i++) {
      const w = new Worker(new URL(import.meta.url));
      const feed = () => { if (next < todo.length) w.postMessage(todo[next++]); else w.terminate(); };
      w.on("message", (m) => {
        if (m.error) { console.error(m.id, m.error); process.exit(1); }
        fs.writeFileSync(path.join(dir, `${m.id}.json`), JSON.stringify(m.data));
        const r = m.data.result;
        console.log(`${++done}/${todo.length} ${m.id}: winner ${r.winner} ${r.winnerSet} (${r.reason}), ${r.turns} turns, ${r.seconds} s, total ${Math.round((Date.now() - t0) / 60000)} min`);
        if (done === todo.length) resolve();
        feed();
      });
      feed();
    }
  });
}
