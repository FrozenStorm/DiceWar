// AI Lab: readable report (HTML) of a run. The same fragment is shown in the
// lab screen and saved as report.html in the ZIP.

import { winMatrix, setResults, summarizeCombos, overall, abilityUse } from "./stats.js";
import { abilityName } from "../engine/paths.js";

export const LOCATION_NAMES = {
  none: "None", craters: "The Craters", oracle: "The Oracle", ruins: "The Ruins",
  camp: "The Camp", knoll: "The Knoll", river: "The River",
};
export const REASON_NAMES = {
  victoryPoints: "Victory points", endOfWar: "End of War", turnLimit: "Turn limit",
  noValidAction: "No valid action", ruins: "The Ruins", knoll: "The Knoll",
};
const LEVEL_NAMES = { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert" };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pct = (x) => `${Math.round(x * 100)}%`;
const reasonName = (r) => REASON_NAMES[r] || r;

/** Background tint: player 1 colour above 50 %, player 2 colour below. */
function tint(rate) {
  const d = Math.min(1, Math.abs(rate - 0.5) * 2);
  const a = (0.12 + 0.55 * d).toFixed(2);
  return rate >= 0.5 ? `rgba(184,64,47,${a})` : `rgba(47,111,168,${a})`;
}

function reasonsText(reasons, games) {
  return Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `${esc(reasonName(r))} ${pct(n / games)}`)
    .join(", ");
}

/** HTML fragment of the report (no <html> wrapper). */
export function reportFragment(rows, cfg, { elapsedMs = 0 } = {}) {
  if (!rows.length) return `<p class="lab-empty">No finished games yet.</p>`;
  const sets = cfg.sets || [...new Set(rows.flatMap((r) => [r.set1, r.set2]))];
  const o = overall(rows);
  const out = [];

  out.push(`<section><h3>Overview</h3><table class="lab-kv">
    <tr><th>Games</th><td>${o.games}</td></tr>
    <tr><th>AI levels</th><td>Player 1 ${esc(LEVEL_NAMES[cfg.level1] || cfg.level1)}, Player 2 ${esc(LEVEL_NAMES[cfg.level2] || cfg.level2)}</td></tr>
    <tr><th>Wins</th><td>Player 1 ${o.p1Wins}, Player 2 ${o.p2Wins}, draws ${o.draws}</td></tr>
    <tr><th>Starting player wins</th><td>${o.starterDecided ? `${pct(o.starterRate)} (95% range ${pct(o.starterLow)} to ${pct(o.starterHigh)})` : "–"}</td></tr>
    <tr><th>Turns until the end</th><td>average ${o.avgTurns}, median ${o.medianTurns}, ${o.minTurns} to ${o.maxTurns}</td></tr>
    <tr><th>Games ended by</th><td>${reasonsText(o.reasons, o.games)}</td></tr>
    ${elapsedMs ? `<tr><th>Run time</th><td>${formatDuration(elapsedMs)}</td></tr>` : ""}
  </table></section>`);

  // Win matrix
  const m = winMatrix(rows, sets);
  const usedRows = sets.filter((a) => sets.some((b) => m[a][b]));
  const usedCols = sets.filter((b) => sets.some((a) => m[a][b]));
  out.push(`<section><h3>Win rate of player 1</h3>
    <p class="lab-note">Row: set of player 1. Column: set of player 2. Red: player 1 wins more often, blue: player 2. Draws count half. Small number: games played.</p>
    <div class="lab-scroll"><table class="lab-matrix"><tr><th>P1 \\ P2</th>${usedCols.map((b) => `<th>${esc(b)}</th>`).join("")}</tr>
    ${usedRows.map((a) => `<tr><th>${esc(a)}</th>${usedCols.map((b) => {
      const c = m[a][b];
      if (!c) return `<td class="lab-na"></td>`;
      return `<td style="background:${tint(c.rate)}" title="95% range ${pct(c.low)} to ${pct(c.high)}">${pct(c.rate)}<small>${c.games}</small></td>`;
    }).join("")}</tr>`).join("")}
    </table></div></section>`);

  // Sets overall
  const sr = setResults(rows);
  const locs = [...new Set(rows.map((r) => r.location))];
  out.push(`<section><h3>Results per set (both seats)</h3>
    <p class="lab-note">Share of points won by the set over all its games. Draws count half. Mirror matches count for both seats.</p>
    <div class="lab-scroll"><table class="lab-table"><tr><th>Set</th><th>All</th>${locs.length > 1 ? locs.map((l) => `<th>${esc(LOCATION_NAMES[l] || l)}</th>`).join("") : ""}</tr>
    ${[...new Set(sr.map((e) => e.set))].map((set) => {
      const all = sr.find((e) => e.set === set && e.location === "all");
      const cells = locs.length > 1 ? locs.map((l) => {
        const e = sr.find((x) => x.set === set && x.location === l);
        return e ? `<td>${pct(e.rate)} <small>(${e.games})</small></td>` : "<td></td>";
      }).join("") : "";
      return `<tr><th>${esc(set)}</th><td>${pct(all.rate)} <small>(${all.games}, ${pct(all.low)} to ${pct(all.high)})</small></td>${cells}</tr>`;
    }).join("")}
    </table></div></section>`);

  // Combinations
  const combos = summarizeCombos(rows);
  out.push(`<section><h3>Per combination</h3><div class="lab-scroll"><table class="lab-table">
    <tr><th>P1</th><th>P2</th><th>Landscape</th><th>Games</th><th>P1 / P2 / draw</th><th>P1 win rate</th><th>Starter wins</th><th>Turns avg (min to max)</th><th>Ended by</th></tr>
    ${combos.map((c) => `<tr><td>${esc(c.set1)}</td><td>${esc(c.set2)}</td><td>${esc(LOCATION_NAMES[c.location] || c.location)}</td>
      <td>${c.games}</td><td>${c.p1Wins} / ${c.p2Wins} / ${c.draws}</td>
      <td>${pct(c.p1WinRate)} <small>(${pct(c.p1WinLow)} to ${pct(c.p1WinHigh)})</small></td>
      <td>${c.starterDecided ? pct(c.starterWins / c.starterDecided) : "–"}</td>
      <td>${c.avgTurns} (${c.minTurns} to ${c.maxTurns})</td><td>${reasonsText(c.reasons, c.games)}</td></tr>`).join("")}
    </table></div></section>`);

  // Abilities
  const ab = abilityUse(rows);
  out.push(`<section><h3>Abilities used</h3><p class="lab-note">Uses per game of the set.</p><div class="lab-abilities">
    ${Object.entries(ab).sort().map(([set, e]) => {
      const list = Object.entries(e.uses).sort((a, b) => b[1] - a[1]);
      return `<div><h4>${esc(set)}</h4>${list.length ? `<table class="lab-table">${list.map(([k, n]) =>
        `<tr><td>${esc(abilityName(k))}</td><td>${(n / e.games).toFixed(1)}</td></tr>`).join("")}</table>` : `<p class="lab-note">none</p>`}</div>`;
    }).join("")}
  </div></section>`);

  return out.join("\n");
}

export function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const REPORT_CSS = `
  .lab-report section { margin: 0 0 18px; }
  .lab-report h3 { font-size: 15px; margin: 0 0 6px; letter-spacing: 0.04em; }
  .lab-report h4 { margin: 4px 0; font-size: 13px; }
  .lab-note { margin: 0 0 6px; font-size: 13px; color: #5c5245; }
  .lab-scroll { overflow-x: auto; }
  .lab-report table { border-collapse: collapse; font-size: 14px; }
  .lab-report th, .lab-report td { border: 1px solid rgba(30,26,22,0.25); padding: 3px 6px; text-align: left; vertical-align: top; }
  .lab-report th { font-weight: 600; background: rgba(30,26,22,0.06); }
  .lab-report small { color: #5c5245; font-size: 11px; }
  .lab-matrix td { text-align: center; min-width: 52px; }
  .lab-matrix td small { display: block; }
  .lab-kv th { width: 190px; }
  .lab-abilities { display: flex; flex-wrap: wrap; gap: 12px; }
  .lab-na { background: repeating-linear-gradient(45deg, transparent 0 4px, rgba(30,26,22,0.08) 4px 8px); }
`;

/** Standalone report.html for the ZIP. */
export function reportHTML(rows, cfg, opts = {}) {
  const when = new Date().toISOString().slice(0, 16).replace("T", " ");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DiceWar AI Lab report</title>
<style>
  body { margin: 0; padding: 16px; background: #e8dfca; color: #2c241c; font-family: Georgia, "Times New Roman", serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  ${REPORT_CSS}
</style></head>
<body><h1>DiceWar AI Lab report</h1><p class="lab-note">${esc(when)} UTC · seed ${esc(cfg.seed)} · ${rows.length} games</p>
<div class="lab-report">${reportFragment(rows, cfg, opts)}</div></body></html>
`;
}
