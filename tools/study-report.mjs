// Developer tool: statistics over a series played with tools/study.mjs.
// Prints Markdown tables and writes <dir>/summary.json.
//
//   node tools/study-report.mjs <dir> [--bench 20]
//
// --bench: number of positions per set for the timing of one evaluation and
// one action (taken from the replays; 0 = no timing).
import fs from "node:fs";
import path from "node:path";
import { createGame, applyAction, legalActions } from "../engine/core.js";
import { evaluate } from "../ai/ai.js";

const SETS = ["RoX", "BoD", "LoD", "RoM", "KoS", "DoA"];
const PHASES = [["opening", 1, 20], ["middle", 21, 60], ["end", 61, Infinity]];
const phaseOf = (turn) => PHASES.find(([, a, b]) => turn >= a && turn <= b)[0];

const dir = process.argv[2];
const benchArg = process.argv.indexOf("--bench");
const benchN = benchArg < 0 ? 20 : Number(process.argv[benchArg + 1]);
const games = fs.readdirSync(path.join(dir, "games")).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(dir, "games", f), "utf8")));

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs) => { if (!xs.length) return NaN; const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : "-");
const f0 = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString("en") : "-");
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)} %` : "-");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
const out = [];
const summary = { games: games.length };

// --- Results -------------------------------------------------------------------
const reasons = {};
for (const g of games) reasons[g.result.reason] = (reasons[g.result.reason] || 0) + 1;
const decided = games.filter((g) => g.result.winner);
const starterWins = decided.filter((g) => g.result.winner === g.result.startingPlayer).length;
const turns = games.map((g) => g.result.turns);
out.push(`## Results (${games.length} games)`,
  `Ends: ${Object.entries(reasons).map(([k, n]) => `${k} ${n}`).join(", ")}. ` +
  `Starting player won ${starterWins} of ${decided.length} decided games (${pct(starterWins / decided.length)}). ` +
  `Turns: median ${median(turns)}, mean ${f1(mean(turns))}, min ${Math.min(...turns)}, max ${Math.max(...turns)}.`, "");
summary.reasons = reasons; summary.starterRate = starterWins / decided.length;

const perSet = {};
for (const set of SETS) perSet[set] = { games: 0, wins: 0, draws: 0, turns: [] };
for (const g of games) {
  for (const p of [1, 2]) {
    const set = g.result[`set${p}`];
    if (g.result.set1 === g.result.set2) continue; // mirrors say nothing about a set
    const t = perSet[set]; t.games++; t.turns.push(g.result.turns);
    if (g.result.winner === p) t.wins++; else if (!g.result.winner) t.draws++;
  }
}
out.push("### Score per set (against the other sets; a draw counts half)",
  table(["Set", "Games", "Wins", "Draws", "Score", "Median turns"],
    SETS.filter((s) => perSet[s].games).map((s) => { const t = perSet[s]; return [s, t.games, t.wins, t.draws, pct((t.wins + t.draws / 2) / t.games), median(t.turns)]; })), "");
summary.perSet = perSet;

out.push("### Every game", table(["Game", "Winner", "End", "Turns", "VP", "Minutes"],
  games.map((g) => { const r = g.result; return [`${r.set1}-${r.set2} (${r.set1 === r.set2 ? "P" + r.startingPlayer : r[`set${r.startingPlayer}`]} starts)`, r.winnerSet || "draw", r.reason, r.turns, `${r.vp1}:${r.vp2}`, f1(r.seconds / 60)]; })), "");

// --- Course of the games ------------------------------------------------------------
// Timeline rows: [turn, vp1, vp2, dice1, dice2, reserve1, reserve2]
const flow = PHASES.map(([name, a, b]) => {
  const rows = games.flatMap((g) => g.timeline.filter((t) => t[0] >= a && t[0] <= b));
  const lead = rows.map((t) => Math.abs(t[1] - t[2]));
  return [name, rows.length, f1(mean(rows.map((t) => t[1] + t[2]))), f1(mean(lead)), f1(mean(rows.map((t) => t[3] + t[4]))), f1(mean(rows.map((t) => t[5] + t[6])))];
});
out.push("## Course of the games (per turn, averaged over the games; phases by turn: opening 1-20, middle 21-60, end 61+)",
  table(["Phase", "Turns seen", "VP both players", "VP lead", "Creatures on board", "Reserve dice"], flow), "");
// When were the VP scored?
const vpPhase = PHASES.map(([name, a, b]) => {
  let gained = 0;
  for (const g of games) {
    const tl = g.timeline;
    for (let i = 1; i < tl.length; i++) if (tl[i][0] >= a && tl[i][0] <= b) gained += Math.max(0, tl[i][1] - tl[i - 1][1]) + Math.max(0, tl[i][2] - tl[i - 1][2]);
  }
  return [name, f1(gained / games.length)];
});
out.push(table(["Phase", "VP scored per game"], vpPhase), "");

// --- Searches -------------------------------------------------------------------
// Search rows: [turn, player, inside a turn, depth, positions, ms, kind]
const searchRows = games.flatMap((g) => g.searches.map((x) => ({ g, turn: x[0], set: g.result[`set${x[1]}`], inTurn: x[2], depth: x[3], nodes: x[4], ms: x[5], kind: x[6] })));
const stats = (rows) => [rows.length, f1(mean(rows.map((r) => r.depth))), f1(median(rows.map((r) => r.depth))), f0(mean(rows.map((r) => r.nodes))), f1(mean(rows.map((r) => r.ms)) / 1000), f1(1000 * rows.reduce((a, r) => a + r.ms, 0) / Math.max(1, rows.reduce((a, r) => a + r.nodes, 0)))];
const head = ["Searches", "Depth mean", "Depth median", "Positions per search", "Seconds per search", "µs per position"];
out.push("## Searches for the main action of a turn",
  "Depth = whole turns looked ahead (a decision inside a turn costs a quarter turn). Positions = nodes of the search tree, without the options that are only rated to sort them.", "",
  "### By phase", table(["Phase", ...head], PHASES.map(([name]) => [name, ...stats(searchRows.filter((r) => !r.inTurn && phaseOf(r.turn) === name))])), "",
  "### By set and phase (depth mean)",
  table(["Set", ...PHASES.map(([n]) => n), "all", "Positions per search", "µs per position"], SETS.map((set) => {
    const rows = searchRows.filter((r) => !r.inTurn && r.set === set);
    return [set, ...PHASES.map(([n]) => f1(mean(rows.filter((r) => phaseOf(r.turn) === n).map((r) => r.depth)))), f1(mean(rows.map((r) => r.depth))), stats(rows)[3], stats(rows)[5]];
  })), "");
const kinds = {};
for (const r of searchRows.filter((r) => r.inTurn)) (kinds[r.kind] ||= []).push(r);
out.push("## Searches for decisions inside a turn",
  table(["Decision", ...head], Object.entries(kinds).sort((a, b) => b[1].length - a[1].length).map(([k, rows]) => [k, ...stats(rows)])), "");
const mainKinds = {};
for (const r of searchRows.filter((r) => !r.inTurn)) (mainKinds[r.kind] ||= []).push(r);
out.push("## Main actions chosen", table(["Action", "Times", "Depth mean"], Object.entries(mainKinds).sort((a, b) => b[1].length - a[1].length).map(([k, rows]) => [k, rows.length, f1(mean(rows.map((r) => r.depth)))])), "");

// --- Timing of one position -------------------------------------------------------------
if (benchN > 0) {
  const samples = Object.fromEntries(SETS.map((s) => [s, []]));
  for (const g of games) {
    const lab = g.replay.lab;
    let s = createGame({ set1: lab.game.set1, set2: lab.game.set2, startingPlayer: lab.game.startingPlayer, locations: lab.game.locations, maxTurns: lab.game.maxTurns });
    lab.actions.forEach((a, i) => {
      if (s.phase === "war" && i % 7 === 0) samples[s.players[s.pending.length ? s.pending[0].player : s.current].set].push(s);
      s = applyAction(s, a);
    });
  }
  const rows = [];
  for (const set of SETS) {
    const pick = samples[set].filter((_, i, a) => i % Math.max(1, Math.floor(a.length / benchN)) === 0).slice(0, benchN);
    if (!pick.length) continue;
    let evalMs = 0, evals = 0, applyMs = 0, applies = 0, options = 0;
    for (const s of pick) {
      let t = performance.now();
      for (let k = 0; k < 200; k++) evaluate(s, 1);
      evalMs += performance.now() - t; evals += 200;
      t = performance.now();
      const acts = legalActions(s);
      for (const a of acts) applyAction(s, a);
      applyMs += performance.now() - t; applies += acts.length; options += acts.length;
    }
    rows.push([set, pick.length, f1(options / pick.length), f1(1000 * evalMs / evals), f1(1000 * applyMs / applies)]);
  }
  out.push("## Cost of one position (positions from these games, set to move)",
    table(["Set to move", "Positions", "Options per position", "µs per evaluation", "µs per action (generate + apply)"], rows), "");
}

console.log(out.join("\n"));
fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));
