// AI Lab: statistics over the result rows of many games, and CSV export.

/** Wilson score interval (95 %) for k successes out of n. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

const median = (xs) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/** Counts for a group of rows. */
function tally(rows) {
  const n = rows.length;
  const p1 = rows.filter((r) => r.winner === 1).length;
  const p2 = rows.filter((r) => r.winner === 2).length;
  const draws = n - p1 - p2;
  const decided = rows.filter((r) => r.startingPlayerWon !== "");
  const starter = decided.filter((r) => r.startingPlayerWon === 1).length;
  const turns = rows.map((r) => r.turns);
  const reasons = {};
  for (const r of rows) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  return {
    games: n, p1Wins: p1, p2Wins: p2, draws,
    starterWins: starter, starterDecided: decided.length,
    avgTurns: round(mean(turns)), medianTurns: median(turns),
    minTurns: n ? Math.min(...turns) : 0, maxTurns: n ? Math.max(...turns) : 0,
    reasons,
  };
}

/** Summary per combination (sets, levels, landscape). */
export function summarizeCombos(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = [r.set1, r.set2, r.level1, r.level2, r.location].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.values()].map((g) => {
    const r0 = g[0];
    const t = tally(g);
    const [lo, hi] = wilson(t.p1Wins + t.draws / 2, t.games);
    return {
      set1: r0.set1, set2: r0.set2, level1: r0.level1, level2: r0.level2, location: r0.location,
      ...t,
      p1WinRate: t.games ? (t.p1Wins + t.draws / 2) / t.games : 0,
      p1WinLow: lo, p1WinHigh: hi,
    };
  });
}

/** Matrix of win rates of player 1's set against player 2's set (all landscapes). */
export function winMatrix(rows, sets) {
  const m = {};
  for (const a of sets) {
    m[a] = {};
    for (const b of sets) {
      const g = rows.filter((r) => r.set1 === a && r.set2 === b);
      if (!g.length) { m[a][b] = null; continue; }
      const t = tally(g);
      const score = t.p1Wins + t.draws / 2;
      const [lo, hi] = wilson(score, t.games);
      m[a][b] = { games: t.games, rate: score / t.games, low: lo, high: hi };
    }
  }
  return m;
}

/** Overall results of every set, counting both seats, optionally per landscape. */
export function setResults(rows) {
  const out = new Map();
  const add = (set, location, score) => {
    for (const key of [`${set}|all`, `${set}|${location}`]) {
      if (!out.has(key)) out.set(key, { set, location: key.endsWith("|all") ? "all" : location, games: 0, score: 0 });
      const e = out.get(key);
      e.games++;
      e.score += score;
    }
  };
  for (const r of rows) {
    const s1 = r.winner === 1 ? 1 : r.winner === 0 ? 0.5 : 0;
    add(r.set1, r.location, s1);
    add(r.set2, r.location, 1 - s1);
  }
  return [...out.values()].map((e) => {
    const [lo, hi] = wilson(e.score, e.games);
    return { ...e, rate: e.score / e.games, low: lo, high: hi };
  }).sort((a, b) => (a.set + a.location).localeCompare(b.set + b.location));
}

/** Overall numbers of the whole run. */
export function overall(rows) {
  const t = tally(rows);
  const [lo, hi] = wilson(t.starterWins, t.starterDecided);
  return { ...t, starterRate: t.starterDecided ? t.starterWins / t.starterDecided : 0, starterLow: lo, starterHigh: hi };
}

/** How often each ability was used, per set (both seats). */
export function abilityUse(rows) {
  const out = {};
  for (const r of rows) {
    for (const p of [1, 2]) {
      const set = r[`set${p}`];
      const ab = r[`abilities${p}`] || {};
      out[set] = out[set] || { games: 0, uses: {} };
      out[set].games++;
      for (const [k, v] of Object.entries(ab)) out[set].uses[k] = (out[set].uses[k] || 0) + v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvCell(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") v = Object.entries(v).map(([k, n]) => `${k}:${n}`).join(" ");
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(objs, columns) {
  const cols = columns || Object.keys(objs[0] || {});
  const lines = [cols.join(",")];
  for (const o of objs) lines.push(cols.map((c) => csvCell(o[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

export const GAME_COLUMNS = [
  "id", "seed", "set1", "set2", "level1", "level2", "location", "riverCol", "startingPlayer",
  "winner", "winnerSet", "startingPlayerWon", "reason", "turns", "actions",
  "vp1", "vp2", "tp1", "tp2", "board1", "board2", "reserve1", "reserve2", "exile1", "exile2",
  "depth1", "depth2", "msPerMove1", "msPerMove2", "ms", "abilities1", "abilities2",
];

export function gamesCSV(rows) {
  return toCSV(rows, GAME_COLUMNS);
}

export function summaryCSV(rows) {
  const combos = summarizeCombos(rows).map((c) => ({
    ...c,
    p1WinRate: round(c.p1WinRate * 100), p1WinLow: round(c.p1WinLow * 100), p1WinHigh: round(c.p1WinHigh * 100),
    starterWinRate: c.starterDecided ? round((c.starterWins / c.starterDecided) * 100) : "",
    reasons: c.reasons,
  }));
  return toCSV(combos, [
    "set1", "set2", "level1", "level2", "location", "games", "p1Wins", "p2Wins", "draws",
    "p1WinRate", "p1WinLow", "p1WinHigh", "starterWins", "starterDecided", "starterWinRate",
    "avgTurns", "medianTurns", "minTurns", "maxTurns", "reasons",
  ]);
}
