// Developer tool: runs an AI Lab series in Node (all CPU cores) and writes the
// same ZIP as the AI Lab in the browser (report, CSV files, one replay per
// game). Level A plays once as player 1 and once as player 2 against level B;
// the ZIP holds one folder per direction and a summary for level A.
//
//   node tools/labrun.mjs --a expert --b hard [--pairs all|mirror|RoX-KoS,...]
//     [--locs none,ruins] [--games 1] [--budget 0.25] [--seed 1] [--maxTurns 200]
//     [--out lab.zip]
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import os from "node:os";
import fs from "node:fs";
import { expandGames, playGame, LAB_SETS } from "../lab/runner.js";
import { gamesCSV, summaryCSV, wilson } from "../lab/stats.js";
import { reportHTML } from "../lab/report.js";
import { makeZip } from "../lab/zip.js";

if (!isMainThread) {
  parentPort.on("message", (game) => {
    try { parentPort.postMessage({ key: game.key, ...playGame(game) }); } catch (e) { parentPort.postMessage({ error: String(e.stack || e) }); }
  });
} else {
  const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? def : process.argv[i + 1]; };
  const A = arg("a", "expert"), B = arg("b", "hard");
  const pairsArg = arg("pairs", "all");
  const pairs = pairsArg === "all" ? LAB_SETS.flatMap((x) => LAB_SETS.map((y) => [x, y]))
    : pairsArg === "mirror" ? LAB_SETS.map((x) => [x, x])
    : pairsArg.split(",").map((p) => p.split("-"));
  const base = {
    pairs,
    locations: arg("locs", "none").split(",").map((l) => (l === "none" ? "" : l)),
    gamesPerCombo: Number(arg("games", 1)),
    startingPlayer: "alternate",
    riverCol: "random",
    seed: Number(arg("seed", 1)),
    maxTurns: Number(arg("maxTurns", 200)),
    budget: Number(arg("budget", 0.25)),
  };
  const out = arg("out", "lab.zip");
  const parts = [
    { dir: `${A}-as-player1`, cfg: { ...base, level1: A, level2: B }, aPlayer: 1 },
    { dir: `${A}-as-player2`, cfg: { ...base, level1: B, level2: A, seed: base.seed + 1000 }, aPlayer: 2 },
  ];
  const queue = [];
  for (const [i, part] of parts.entries()) {
    part.games = expandGames(part.cfg);
    part.results = [];
    for (const g of part.games) queue.push({ ...g, key: i });
  }
  // Mix the two directions so that an interrupted run stays balanced.
  queue.sort((x, y) => x.id - y.id || x.key - y.key);

  const t0 = Date.now();
  let next = 0, done = 0;
  await new Promise((resolve) => {
    const workers = Array.from({ length: Number(arg("threads", os.cpus().length)) }, () => new Worker(new URL(import.meta.url)));
    const feed = (w) => { if (next < queue.length) w.postMessage(queue[next++]); };
    for (const w of workers) {
      w.on("message", (r) => {
        if (r.error) { console.error(r.error); process.exit(1); }
        parts[r.key].results.push({ row: r.row, replay: r.replay });
        done++;
        const row = r.row;
        console.log(`${done}/${queue.length} ${parts[r.key].dir} #${row.id} ${row.set1}-${row.set2} ${row.location}: winner ${row.winner} (${row.reason}), ${row.turns} turns, ${Math.round((Date.now() - t0) / 1000)} s`);
        if (done === queue.length) { for (const x of workers) x.terminate(); resolve(); } else feed(w);
      });
      feed(w);
    }
  });

  // Summary for level A.
  const tally = () => ({ w: 0, d: 0, l: 0 });
  const total = tally(), bySet = {}, byLoc = {}, reasons = {};
  const add = (t, res) => { t[res]++; };
  const time = { [A]: [0, 0], [B]: [0, 0] };
  for (const part of parts) for (const { row } of part.results) {
    const res = row.winner === 0 ? "d" : row.winner === part.aPlayer ? "w" : "l";
    const set = part.aPlayer === 1 ? row.set1 : row.set2;
    add(total, res); add(bySet[set] ??= tally(), res); add(byLoc[row.location] ??= tally(), res);
    reasons[row.reason] = (reasons[row.reason] || 0) + 1;
    for (const p of [1, 2]) {
      const level = p === part.aPlayer ? A : B;
      if (row[`msPerMove${p}`] !== "") { time[level][0] += row[`msPerMove${p}`]; time[level][1]++; }
    }
  }
  const line = (name, t) => {
    const n = t.w + t.d + t.l, score = (t.w + t.d / 2) / n;
    const [lo, hi] = wilson(t.w + t.d / 2, n);
    return `${name.padEnd(10)} ${String(Math.round(score * 100)).padStart(3)} %   ${t.w} wins, ${t.d} draws, ${t.l} losses  (${n} games, 95 % range ${Math.round(lo * 100)}-${Math.round(hi * 100)} %)`;
  };
  const summary = [
    `DiceWar AI Lab series: ${A} against ${B}`,
    `Node budget factor ${base.budget}, at most ${base.maxTurns} turns, seed ${base.seed}. Every pairing is played with ${A} as player 1 and as player 2.`,
    `Average thinking time per move here: ${A} ${Math.round(time[A][0] / Math.max(1, time[A][1]))} ms, ${B} ${Math.round(time[B][0] / Math.max(1, time[B][1]))} ms.`,
    "",
    `Score of ${A} (a draw counts half):`,
    line("all games", total),
    "",
    `By dice set played by ${A}:`,
    ...Object.entries(bySet).map(([k, t]) => line(k, t)),
    "",
    "By landscape:",
    ...Object.entries(byLoc).map(([k, t]) => line(k, t)),
    "",
    "How the games ended:",
    ...Object.entries(reasons).map(([k, n]) => `${k}: ${n}`),
    "",
  ].join("\n");
  console.log(summary);

  const files = [{ name: "summary.txt", data: summary }];
  for (const part of parts) {
    const results = part.results.sort((x, y) => x.row.id - y.row.id);
    const rows = results.map((r) => r.row);
    files.push(
      { name: `${part.dir}/report.html`, data: reportHTML(rows, part.cfg, { elapsedMs: Date.now() - t0 }) },
      { name: `${part.dir}/summary.csv`, data: summaryCSV(rows) },
      { name: `${part.dir}/games.csv`, data: gamesCSV(rows) },
      { name: `${part.dir}/config.json`, data: JSON.stringify({ ...part.cfg, games: part.games.length, played: rows.length }, null, 2) },
      ...results.map(({ row: r, replay }) => ({
        name: `${part.dir}/replays/${String(r.id).padStart(5, "0")}-${r.set1}-vs-${r.set2}-${r.location}-${r.level1}-${r.level2}.json`,
        data: JSON.stringify(replay),
      })),
    );
  }
  fs.writeFileSync(out, await makeZip(files));
  console.log(`written ${out}`);
}
