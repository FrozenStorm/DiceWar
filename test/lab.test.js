import { test } from "node:test";
import assert from "node:assert/strict";
import { expandGames, playGame, replayActions } from "../lab/runner.js";
import { gamesCSV, summaryCSV, winMatrix, overall, wilson } from "../lab/stats.js";
import { makeZip, crc32 } from "../lab/zip.js";
import { reportHTML } from "../lab/report.js";
import { chooseAction } from "../ai/ai.js";
import { mulberry32 } from "../ai/rng.js";
import { position } from "./helpers.js";

const CFG = {
  pairs: [["RoX", "BoD"], ["LoD", "LoD"]],
  level1: "easy", level2: "easy",
  locations: ["", "river"],
  gamesPerCombo: 2,
  startingPlayer: "alternate",
  riverCol: "random",
  seed: 12345,
  maxTurns: 150,
};

test("expandGames builds every combination with alternating starting players", () => {
  const games = expandGames(CFG);
  assert.equal(games.length, 2 * 2 * 2);
  assert.deepEqual(games.map((g) => g.startingPlayer), [1, 2, 1, 2, 1, 2, 1, 2]);
  assert.equal(new Set(games.map((g) => g.seed)).size, games.length);
  for (const g of games) {
    if (g.location === "river") assert.ok(g.riverCol >= 0 && g.riverCol <= 6);
    else assert.equal(g.riverCol, null);
  }
  assert.deepEqual(expandGames(CFG), games, "same config gives the same games");
});

test("a lab game is reproducible from its seed and its replay", () => {
  const [g] = expandGames({ ...CFG, budget: 0.2 });
  const a = playGame(g);
  const b = playGame(g);
  assert.deepEqual(a.replay.lab.actions, b.replay.lab.actions);
  assert.equal(a.row.winner, b.row.winner);
  assert.equal(a.row.turns, b.row.turns);
  const s = replayActions(g, a.replay.lab.actions);
  assert.equal(s.phase, "over");
  assert.deepEqual(s.board, a.replay.snapshot.rulesGame.board);
  assert.ok([0, 1, 2].includes(a.row.winner));
  assert.ok(a.replay.snapshot.rulesGame.phase === "over");
});

test("different seeds give different games", () => {
  const games = expandGames({ ...CFG, budget: 0.2 }).slice(0, 2);
  const [a, b] = games.map((g) => playGame({ ...g, startingPlayer: 1 }).replay.lab.actions);
  assert.notDeepEqual(a, b);
});

test("the AI picks randomly among equally rated moves", () => {
  // Symmetric position: RoX New Paths to the left or to the right is equally good.
  const s = position(["...a...", ".......", ".......", ".......", ".......", ".......", "...3..."]);
  const picks = new Set();
  for (let i = 0; i < 30; i++) {
    const r = chooseAction(s, { level: "medium", random: mulberry32(i + 1), maxNodes: 20000 });
    picks.add(JSON.stringify(r.action));
    assert.ok(r.ties >= 2);
  }
  assert.ok(picks.size >= 2, `always the same move: ${[...picks]}`);
});

test("statistics and CSV", () => {
  const rows = [
    { id: 1, set1: "RoX", set2: "BoD", level1: "easy", level2: "easy", location: "none", startingPlayer: 1, winner: 1, startingPlayerWon: 1, reason: "victoryPoints", turns: 40, abilities1: { "RoX.xeladron.decay": 2 }, abilities2: {} },
    { id: 2, set1: "RoX", set2: "BoD", level1: "easy", level2: "easy", location: "none", startingPlayer: 2, winner: 2, startingPlayerWon: 1, reason: "endOfWar", turns: 60, abilities1: {}, abilities2: {} },
    { id: 3, set1: "RoX", set2: "BoD", level1: "easy", level2: "easy", location: "none", startingPlayer: 1, winner: 0, startingPlayerWon: "", reason: "turnLimit", turns: 150, abilities1: {}, abilities2: {} },
  ];
  const m = winMatrix(rows, ["RoX", "BoD"]);
  assert.equal(m.RoX.BoD.games, 3);
  assert.equal(m.RoX.BoD.rate, 0.5);
  assert.equal(m.BoD.RoX, null);
  const o = overall(rows);
  assert.equal(o.starterRate, 1);
  assert.equal(o.medianTurns, 60);
  const [lo, hi] = wilson(5, 10);
  assert.ok(lo < 0.5 && hi > 0.5);
  const csv = gamesCSV(rows);
  assert.match(csv.split("\r\n")[0], /^id,seed,set1/);
  assert.match(csv, /RoX\.xeladron\.decay:2/);
  assert.match(summaryCSV(rows), /RoX,BoD,easy,easy,none,3,1,1,1,50/);
  assert.match(reportHTML(rows, { seed: 1, level1: "easy", level2: "easy" }), /Win rate of player 1/);
});

test("ZIP archive has valid structure and CRCs", async () => {
  const files = [{ name: "a.txt", data: "hello ".repeat(100) }, { name: "replays/b.json", data: "{}" }];
  const zip = await makeZip(files);
  const dv = new DataView(zip.buffer);
  const end = zip.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50);
  assert.equal(dv.getUint16(end + 10, true), 2);
  let off = dv.getUint32(end + 16, true);
  const dec = new TextDecoder();
  for (const f of files) {
    assert.equal(dv.getUint32(off, true), 0x02014b50);
    const method = dv.getUint16(off + 10, true);
    const crc = dv.getUint32(off + 16, true);
    const csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true);
    const local = dv.getUint32(off + 42, true);
    assert.equal(dec.decode(zip.subarray(off + 46, off + 46 + nlen)), f.name);
    const lnlen = dv.getUint16(local + 26, true);
    let body = zip.subarray(local + 30 + lnlen, local + 30 + lnlen + csize);
    if (method === 8) {
      const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      body = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    assert.equal(dec.decode(body), f.data);
    assert.equal(crc32(body), crc);
    off += 46 + nlen;
  }
});
