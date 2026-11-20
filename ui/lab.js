// AI Lab screen: choose set pairings, AI levels and landscapes, let the AI play
// many games against itself in background workers, see the statistics and
// download everything (statistics + one replay per game) as a ZIP.
//
// Uses from index.html: window.loadSaveData(json) to show a final position on the board.

import { expandGames, LAB_SETS, LAB_LOCATIONS } from "../lab/runner.js";
import { gamesCSV, summaryCSV } from "../lab/stats.js";
import { reportFragment, reportHTML, formatDuration, LOCATION_NAMES, REASON_NAMES, REPORT_CSS } from "../lab/report.js";
import { makeZip } from "../lab/zip.js";

const LEVELS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["expert", "Expert"]];
/** Rough seconds per game on one core at budget 1 (measured: easy < 1 s, medium 25-100 s, hard 3-5 min, expert about twice as long as hard). */
const SEC_PER_GAME = { easy: 1, medium: 45, hard: 240, expert: 480 };
const MAX_GAMES = 20000;
const COLS = "abcdefg";

const lab = {
  view: "config",       // config | run | result
  cfg: null,
  games: [],            // planned games
  results: new Map(),   // id -> { row, replay }
  queue: [],
  running: new Set(),
  progress: new Map(),  // id -> { turn, actions } of running games
  workers: [],
  paused: false,
  stopped: false,
  startedAt: 0,
  elapsedBefore: 0,
  lastRender: 0,
  wakeLock: null,
  errors: [],
};

// ---------------------------------------------------------------------------
// Persistence (IndexedDB): a run survives a reload of the page.
// ---------------------------------------------------------------------------

const DB_NAME = "dicewar-lab";
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in self)) return reject(new Error("no IndexedDB"));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("meta");
        req.result.createObjectStore("games");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((e) => { console.warn("AI Lab: results are not saved", e); return null; });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
  });
}

const saveMeta = () => tx("meta", "readwrite", (s) => s.put({
  cfg: lab.cfg, elapsed: elapsed(), total: lab.games.length,
}, "run")).catch(() => {});
const saveGame = (res) => tx("games", "readwrite", (s) => s.put(res, res.row.id)).catch(() => {});
const clearSaved = () => Promise.all([
  tx("meta", "readwrite", (s) => s.clear()), tx("games", "readwrite", (s) => s.clear()),
]).catch(() => {});

async function loadSaved() {
  try {
    const meta = await tx("meta", "readonly", (s) => s.get("run"));
    if (!meta || !meta.cfg) return null;
    const games = await tx("games", "readonly", (s) => s.getAll());
    return { meta, games: games || [] };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function buildDOM() {
  if (el("lab-overlay")) return;
  const style = document.createElement("style");
  style.textContent = `
    #lab-overlay { justify-content: safe center; overflow-y: auto; z-index: 1050; }
    #lab-overlay .lab-card { max-width: 760px; }
    #lab-overlay .lobby-inner { gap: 12px; }
    #lab-config, #lab-run { display: flex; flex-direction: column; gap: 10px; }
    .lab-matrix-pick { border-collapse: collapse; margin: 0 auto; }
    .lab-matrix-pick th, .lab-matrix-pick td { padding: 0; text-align: center; border: 1px solid rgba(30,26,22,0.25); }
    .lab-matrix-pick th button { width: 100%; min-width: 46px; min-height: 36px; border: 0; background: rgba(30,26,22,0.06);
      font-family: var(--display); font-weight: 700; font-size: 12px; }
    .lab-matrix-pick td label { display: flex; align-items: center; justify-content: center; min-width: 46px; min-height: 40px; cursor: pointer; }
    .lab-matrix-pick td.mirror { background: rgba(30,26,22,0.05); }
    .lab-matrix-pick input { width: 20px; height: 20px; accent-color: var(--slate); cursor: pointer; }
    .lab-corner { font-family: var(--display); font-size: 10px; padding: 2px 4px !important; color: var(--ink-soft); }
    .lab-row { display: flex; flex-wrap: wrap; gap: 8px; }
    .lab-row > label { flex: 1 1 150px; }
    #lab-overlay label.lab-field { display: flex; flex-direction: column; gap: 3px;
      font-family: var(--display); font-weight: 600; font-size: 12px; letter-spacing: 0.03em; }
    #lab-overlay select, #lab-overlay input[type="number"] {
      width: 100%; min-height: 40px; padding: 4px 8px; border: 1px solid var(--edge); border-radius: 6px;
      background: #f3ecdc; color: var(--ink); font-family: var(--body); font-size: 16px; }
    .lab-checks { display: flex; flex-wrap: wrap; gap: 4px 14px; }
    .lab-checks label { display: flex; align-items: center; gap: 6px; min-height: 32px; font-size: 16px; cursor: pointer; }
    .lab-checks input { width: 18px; height: 18px; accent-color: var(--slate); }
    .lab-h { margin: 0; font-family: var(--display); font-size: 13px; letter-spacing: 0.04em; }
    .lab-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    .lab-buttons .big-btn { flex: 1 1 160px; }
    .lab-quick { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .lab-estimate { padding: 8px 10px; border-radius: 6px; background: var(--paper-2); font-size: 15px; }
    .lab-progress { height: 14px; border: 1px solid var(--edge); border-radius: 7px; background: #f3ecdc; overflow: hidden; }
    .lab-progress > div { height: 100%; width: 0; background: linear-gradient(#66757f, #4c5a64); transition: width 0.3s; }
    .lab-recent { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; font-size: 14px; }
    .lab-recent li { display: flex; align-items: center; gap: 8px; min-height: 34px; border-bottom: 1px solid rgba(30,26,22,0.15); }
    .lab-recent li span { flex: 1; min-width: 0; }
    .lab-error { color: var(--attack); font-size: 14px; }
    ${REPORT_CSS}
  `;
  document.head.appendChild(style);

  const ov = document.createElement("div");
  ov.id = "lab-overlay";
  ov.className = "overlay";
  ov.innerHTML = `
    <div class="paper lobby-card lab-card">
      <h1>AI Lab</h1>
      <div class="lobby-inner">
        <div id="lab-config"></div>
        <div id="lab-run" style="display:none"></div>
      </div>
    </div>`;
  document.body.appendChild(ov);
}

function levelOptions(sel) {
  return LEVELS.map(([v, n]) => `<option value="${v}"${v === sel ? " selected" : ""}>${n}</option>`).join("");
}

function defaultConfig() {
  return {
    pairs: LAB_SETS.map((s) => [s, s]),
    level1: "easy", level2: "easy",
    locations: [""],
    gamesPerCombo: 10,
    startingPlayer: "alternate",
    riverCol: "random",
    seed: randomSeed(),
    maxTurns: 400,
    budget: 1,
    workers: defaultWorkers(),
  };
}

const randomSeed = () => Math.floor(Math.random() * 1e9);
const defaultWorkers = () => Math.max(1, Math.min(16, (navigator.hardwareConcurrency || 2) - 1));

function renderConfig(cfg) {
  const pairKey = (a, b) => `${a}|${b}`;
  const chosen = new Set(cfg.pairs.map(([a, b]) => pairKey(a, b)));
  const cores = navigator.hardwareConcurrency || 2;
  const workerChoices = [...new Set([1, 2, 4, 6, 8, 12, 16, defaultWorkers()])].filter((n) => n <= Math.max(16, cores)).sort((a, b) => a - b);
  el("lab-config").innerHTML = `
    <p>The AI plays against itself. Choose the pairings, AI levels and landscapes. Results stay in this browser until you download them.</p>
    <h3 class="lab-h">Pairings (row: player 1, column: player 2)</h3>
    <div class="lab-scroll"><table class="lab-matrix-pick">
      <tr><th class="lab-corner">P1 \\ P2</th>${LAB_SETS.map((b) => `<th><button type="button" data-col="${b}" title="Toggle column">${b}</button></th>`).join("")}</tr>
      ${LAB_SETS.map((a) => `<tr><th><button type="button" data-row="${a}" title="Toggle row">${a}</button></th>${LAB_SETS.map((b) =>
        `<td class="${a === b ? "mirror" : ""}"><label><input type="checkbox" data-pair="${pairKey(a, b)}"${chosen.has(pairKey(a, b)) ? " checked" : ""} aria-label="${a} vs ${b}"></label></td>`).join("")}</tr>`).join("")}
    </table></div>
    <div class="lab-quick">
      <button type="button" class="small-btn" data-quick="all">All</button>
      <button type="button" class="small-btn" data-quick="none">None</button>
      <button type="button" class="small-btn" data-quick="mirror">Mirror matches</button>
      <button type="button" class="small-btn" data-quick="cross">Without mirror</button>
    </div>
    <div class="lab-row">
      <label class="lab-field">AI level player 1<select id="lab-level1">${levelOptions(cfg.level1)}</select></label>
      <label class="lab-field">AI level player 2<select id="lab-level2">${levelOptions(cfg.level2)}</select></label>
    </div>
    <h3 class="lab-h">Landscapes</h3>
    <p class="lab-note">Every game is played with one landscape (or none). Each chosen landscape gets its own games; several landscapes in one game are not used in the lab.</p>
    <div class="lab-checks">${LAB_LOCATIONS.map((l) =>
      `<label><input type="checkbox" data-loc="${l}"${cfg.locations.includes(l) ? " checked" : ""}> ${esc(LOCATION_NAMES[l || "none"])}</label>`).join("")}</div>
    <div class="lab-row">
      <label class="lab-field" id="lab-river-field">River column
        <select id="lab-river"><option value="random">Random per game</option>${[...COLS].map((c, i) =>
          `<option value="${i}"${String(cfg.riverCol) === String(i) ? " selected" : ""}>${c}</option>`).join("")}</select></label>
      <label class="lab-field">Games per pairing and landscape<input type="number" id="lab-count" min="1" max="1000" value="${cfg.gamesPerCombo}"></label>
      <label class="lab-field">Starting player
        <select id="lab-start">
          <option value="alternate"${cfg.startingPlayer === "alternate" ? " selected" : ""}>Alternating</option>
          <option value="1"${String(cfg.startingPlayer) === "1" ? " selected" : ""}>Always player 1</option>
          <option value="2"${String(cfg.startingPlayer) === "2" ? " selected" : ""}>Always player 2</option>
        </select></label>
    </div>
    <div class="lab-row">
      <label class="lab-field">Thinking budget
        <select id="lab-budget">${[[0.25, "25% (fast, weaker)"], [0.5, "50%"], [1, "100% (like the game)"], [2, "200% (slow, stronger)"]].map(([v, n]) =>
          `<option value="${v}"${Number(cfg.budget) === v ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <label class="lab-field">Parallel games
        <select id="lab-workers">${workerChoices.map((n) => `<option value="${n}"${n === cfg.workers ? " selected" : ""}>${n}${n === defaultWorkers() ? " (recommended)" : ""}</option>`).join("")}</select></label>
      <label class="lab-field">Turn limit<input type="number" id="lab-maxturns" min="20" max="2000" value="${cfg.maxTurns}"></label>
      <label class="lab-field">Seed<input type="number" id="lab-seed" min="0" value="${cfg.seed}"></label>
    </div>
    <div class="lab-estimate" id="lab-estimate"></div>
    <div class="lab-buttons">
      <button type="button" class="big-btn" id="lab-start-btn">Start</button>
      <button type="button" class="big-btn secondary" id="lab-back-btn">Back to Menu</button>
    </div>
    <div id="lab-saved"></div>
  `;

  const root = el("lab-config");
  const boxes = () => [...root.querySelectorAll("input[data-pair]")];
  root.querySelectorAll("button[data-row]").forEach((b) => b.addEventListener("click", () => {
    const row = boxes().filter((x) => x.dataset.pair.startsWith(b.dataset.row + "|"));
    const on = !row.every((x) => x.checked);
    row.forEach((x) => { x.checked = on; });
    updateEstimate();
  }));
  root.querySelectorAll("button[data-col]").forEach((b) => b.addEventListener("click", () => {
    const col = boxes().filter((x) => x.dataset.pair.endsWith("|" + b.dataset.col));
    const on = !col.every((x) => x.checked);
    col.forEach((x) => { x.checked = on; });
    updateEstimate();
  }));
  root.querySelectorAll("button[data-quick]").forEach((b) => b.addEventListener("click", () => {
    const q = b.dataset.quick;
    for (const x of boxes()) {
      const [p, o] = x.dataset.pair.split("|");
      x.checked = q === "all" || (q === "mirror" && p === o) || (q === "cross" && p !== o);
    }
    updateEstimate();
  }));
  root.addEventListener("change", updateEstimate);
  root.addEventListener("input", updateEstimate);
  el("lab-start-btn").addEventListener("click", () => startRun(readConfig()));
  el("lab-back-btn").addEventListener("click", close);
  updateEstimate();
  renderSavedRun();
}

function readConfig() {
  const root = el("lab-config");
  const pairs = [...root.querySelectorAll("input[data-pair]:checked")].map((x) => x.dataset.pair.split("|"));
  const locations = [...root.querySelectorAll("input[data-loc]:checked")].map((x) => x.dataset.loc);
  const riverVal = el("lab-river").value;
  const startVal = el("lab-start").value;
  return {
    pairs,
    level1: el("lab-level1").value,
    level2: el("lab-level2").value,
    locations,
    gamesPerCombo: clampInt(el("lab-count").value, 1, 1000, 10),
    startingPlayer: startVal === "alternate" ? "alternate" : Number(startVal),
    riverCol: riverVal === "random" ? "random" : Number(riverVal),
    seed: clampInt(el("lab-seed").value, 0, 2 ** 32 - 1, 1),
    maxTurns: clampInt(el("lab-maxturns").value, 20, 2000, 400),
    budget: Number(el("lab-budget").value) || 1,
    workers: clampInt(el("lab-workers").value, 1, 64, defaultWorkers()),
    sets: LAB_SETS,
  };
}

function clampInt(v, lo, hi, dflt) {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

function estimateMs(cfg, games) {
  const perGame = ((SEC_PER_GAME[cfg.level1] + SEC_PER_GAME[cfg.level2]) / 2) * cfg.budget * 1000;
  return (games * perGame) / Math.max(1, cfg.workers);
}

function updateEstimate() {
  const cfg = readConfig();
  el("lab-river-field").style.display = cfg.locations.includes("river") ? "" : "none";
  const n = cfg.pairs.length * cfg.locations.length * cfg.gamesPerCombo;
  const btn = el("lab-start-btn");
  let text;
  if (!cfg.pairs.length) text = "Choose at least one pairing.";
  else if (!cfg.locations.length) text = "Choose at least one landscape (or None).";
  else if (n > MAX_GAMES) text = `${n} games is too many for one run (at most ${MAX_GAMES}).`;
  else text = `<b>${n} games</b> (${cfg.pairs.length} pairings × ${cfg.locations.length} landscapes × ${cfg.gamesPerCombo}). Estimated time with ${cfg.workers} parallel games: about ${formatDuration(estimateMs(cfg, n))}. The estimate gets more precise once the first games are done.`;
  el("lab-estimate").innerHTML = text;
  btn.disabled = !cfg.pairs.length || !cfg.locations.length || n > MAX_GAMES;
}

async function renderSavedRun() {
  const box = el("lab-saved");
  if (!box || lab.view !== "config" || lab.games.length) return;
  const saved = await loadSaved();
  if (!saved || lab.view !== "config") { box.innerHTML = ""; return; }
  const done = saved.games.length;
  box.innerHTML = `<div class="lab-estimate">An earlier run is saved in this browser: ${done} of ${saved.meta.total} games played.
    <div class="lab-buttons" style="margin-top:8px">
      <button type="button" class="small-btn" id="lab-resume">${done < saved.meta.total ? "Continue" : "Show results"}</button>
      <button type="button" class="small-btn" id="lab-discard">Discard</button>
    </div></div>`;
  el("lab-resume").addEventListener("click", () => resumeRun(saved));
  el("lab-discard").addEventListener("click", async () => { await clearSaved(); box.innerHTML = ""; });
}

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

const elapsed = () => lab.elapsedBefore + (lab.startedAt ? performance.now() - lab.startedAt : 0);

async function startRun(cfg) {
  await clearSaved();
  lab.cfg = cfg;
  lab.games = expandGames(cfg);
  lab.results = new Map();
  lab.elapsedBefore = 0;
  lab.errors = [];
  await saveMeta();
  beginRun();
}

function resumeRun(saved) {
  lab.cfg = saved.meta.cfg;
  lab.games = expandGames(lab.cfg);
  lab.results = new Map(saved.games.map((g) => [g.row.id, g]));
  lab.elapsedBefore = saved.meta.elapsed || 0;
  lab.errors = [];
  beginRun();
}

function beginRun() {
  lab.view = "run";
  lab.paused = false;
  lab.stopped = false;
  lab.queue = lab.games.filter((g) => !lab.results.has(g.id));
  lab.running = new Set();
  lab.progress = new Map();
  lab.startedAt = performance.now();
  el("lab-config").style.display = "none";
  el("lab-run").style.display = "";
  renderRunShell();
  if (!lab.queue.length) return finishRun();
  requestWakeLock();
  const n = Math.min(lab.cfg.workers || defaultWorkers(), lab.queue.length);
  lab.workers = [];
  for (let i = 0; i < n; i++) lab.workers.push(makeWorker());
  lab.workers.forEach(dispatch);
  renderRun(true);
}

function makeWorker() {
  const w = new Worker(new URL("../lab/lab-worker.js", import.meta.url), { type: "module" });
  w.busy = null;
  w.onmessage = (e) => onResult(w, e.data);
  w.onerror = (e) => {
    e.preventDefault();
    workerFailed(w, e.message || "unknown error");
  };
  return w;
}

/** A worker crashed (e.g. out of memory): replace it and try the game once more. */
function workerFailed(w, message) {
  const game = w.busy;
  w.busy = null;
  w.terminate();
  if (game) {
    lab.running.delete(game.id);
    lab.progress.delete(game.id);
    game.tries = (game.tries || 0) + 1;
    if (game.tries < 2) lab.queue.unshift(game);
    lab.errors.push(`Game ${game.id}: ${message}${game.tries < 2 ? " (retrying)" : " (skipped)"}`);
  } else {
    lab.errors.push(`Worker error: ${message}`);
  }
  const i = lab.workers.indexOf(w);
  if (i >= 0 && !lab.stopped) {
    const fresh = makeWorker();
    lab.workers[i] = fresh;
    dispatch(fresh);
  }
  if (!lab.queue.length && !lab.running.size && lab.view === "run") finishRun();
  renderRun(true);
}

function dispatch(w) {
  if (lab.paused || lab.stopped || w.busy) return;
  const game = lab.queue.shift();
  if (!game) {
    if (!lab.running.size) finishRun();
    return;
  }
  w.busy = game;
  lab.running.add(game.id);
  w.postMessage({ game });
}

function onResult(w, data) {
  if (data.progress) {
    lab.progress.set(data.id, data.progress);
    renderRun();
    return;
  }
  const game = w.busy;
  w.busy = null;
  if (game) lab.running.delete(game.id);
  lab.progress.delete(data.id);
  if (data.error) {
    lab.errors.push(`Game ${data.id}: ${data.error}`);
  } else {
    const res = { row: data.row, replay: data.replay };
    lab.results.set(data.id, res);
    saveGame(res);
    if (lab.results.size % 10 === 0) saveMeta();
  }
  renderRun();
  if (lab.stopped) return;
  dispatch(w);
}

function terminateWorkers() {
  for (const w of lab.workers) w.terminate();
  lab.workers = [];
  for (const id of lab.running) {
    const g = lab.games.find((x) => x.id === id);
    if (g) lab.queue.unshift(g);
  }
  lab.running = new Set();
}

function pauseRun() {
  lab.paused = !lab.paused;
  if (lab.paused) {
    lab.elapsedBefore = elapsed();
    lab.startedAt = 0;
    saveMeta();
  } else {
    lab.startedAt = performance.now();
    lab.workers.forEach(dispatch);
  }
  renderRun(true);
}

function stopRun() {
  if (!confirm("Stop the run? The finished games are kept and can be downloaded.")) return;
  lab.stopped = true;
  terminateWorkers();
  finishRun();
}

function finishRun() {
  if (lab.view === "result") return;
  lab.elapsedBefore = elapsed();
  lab.startedAt = 0;
  terminateWorkers();
  releaseWakeLock();
  saveMeta();
  lab.view = "result";
  renderRunShell();
  renderRun(true);
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) lab.wakeLock = await navigator.wakeLock.request("screen");
  } catch { /* not allowed or not supported */ }
}

function releaseWakeLock() {
  if (lab.wakeLock) lab.wakeLock.release().catch(() => {});
  lab.wakeLock = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && lab.view === "run" && !lab.paused) requestWakeLock();
});

// ---------------------------------------------------------------------------
// Run and result view
// ---------------------------------------------------------------------------

function renderRunShell() {
  const running = lab.view === "run";
  el("lab-run").innerHTML = `
    <p id="lab-status"></p>
    <div class="lab-progress"><div id="lab-bar"></div></div>
    <div class="lab-buttons">
      ${running ? `<button type="button" class="big-btn" id="lab-pause">Pause</button>
      <button type="button" class="big-btn secondary" id="lab-stop">Stop</button>` : `
      <button type="button" class="big-btn" id="lab-zip">Download ZIP</button>
      <button type="button" class="big-btn secondary" id="lab-new">New Run</button>`}
      <button type="button" class="big-btn secondary" id="lab-back2">Back to Menu</button>
    </div>
    <div id="lab-errors" class="lab-error"></div>
    <h3 class="lab-h">Latest games</h3>
    <ul class="lab-recent" id="lab-recent"></ul>
    <div class="lab-report" id="lab-report"></div>`;
  if (running) {
    el("lab-pause").addEventListener("click", pauseRun);
    el("lab-stop").addEventListener("click", stopRun);
  } else {
    el("lab-zip").addEventListener("click", downloadZip);
    el("lab-new").addEventListener("click", () => {
      lab.view = "config";
      lab.games = [];
      el("lab-run").style.display = "none";
      el("lab-config").style.display = "";
      renderConfig({ ...lab.cfg, seed: randomSeed() });
    });
  }
  el("lab-back2").addEventListener("click", close);
  el("lab-recent").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-show]");
    if (b) showGame(Number(b.dataset.show));
  });
}

function renderRun(force = false) {
  const t = performance.now();
  if (!force && t - lab.lastRender < 1000) {
    clearTimeout(renderRun.timer);
    renderRun.timer = setTimeout(() => renderRun(true), 1000);
    return;
  }
  lab.lastRender = t;
  if (!el("lab-status")) return;
  const total = lab.games.length;
  const done = lab.results.size;
  const ms = elapsed();
  let status;
  if (lab.view === "run") {
    // Remaining time from the speed so far.
    let eta = "";
    if (done > 0 && ms > 0) {
      const rate = done / ms;
      eta = ` · about ${formatDuration((total - done) / rate)} left`;
    }
    status = `${lab.paused ? "Paused" : "Running"}: <b>${done} of ${total}</b> games · ${formatDuration(ms)}${eta}${lab.paused && lab.running.size ? ` · finishing ${lab.running.size} running games` : ""}`;
    const now = [...lab.running].sort((a, b) => a - b).map((id) => {
      const pr = lab.progress.get(id);
      return `#${id} ${pr ? `turn ${pr.turn}` : "starting"}`;
    });
    if (now.length) status += `<br><small>Playing now: ${now.join(", ")} (games end at turn ${lab.cfg.maxTurns} at the latest)</small>`;
    if (el("lab-pause")) el("lab-pause").textContent = lab.paused ? "Continue" : "Pause";
  } else {
    status = `Finished: <b>${done} of ${total}</b> games in ${formatDuration(ms)}.${done < total ? " The run was stopped early." : ""}`;
  }
  el("lab-status").innerHTML = status;
  el("lab-bar").style.width = `${total ? (100 * done) / total : 0}%`;
  el("lab-errors").innerHTML = lab.errors.slice(-5).map(esc).join("<br>");

  const rows = [...lab.results.values()].map((r) => r.row).sort((a, b) => a.id - b.id);
  const recent = [...rows].sort((a, b) => b.id - a.id).slice(0, 8);
  el("lab-recent").innerHTML = recent.length ? recent.map((r) => `<li><span>#${r.id} ${esc(r.set1)} vs ${esc(r.set2)}, ${esc(LOCATION_NAMES[r.location] || r.location)}: ${
    r.winner ? `player ${r.winner} (${esc(r.winnerSet)}) wins` : "draw"} after ${r.turns} turns (${esc(REASON_NAMES[r.reason] || r.reason)})</span>
    <button type="button" class="small-btn" data-show="${r.id}">Show</button></li>`).join("") : `<li><span>No game finished yet.</span></li>`;
  el("lab-report").innerHTML = reportFragment(rows, lab.cfg, { elapsedMs: lab.view === "result" ? ms : 0 });
}

/** Show the final position of a game on the board (same as loading its replay file). */
function showGame(id) {
  const res = lab.results.get(id);
  if (!res || !window.loadSaveData) return;
  el("lab-overlay").style.display = "none";
  const lobby = el("lobby-overlay");
  if (lobby) lobby.style.display = "none";
  window.loadSaveData(res.replay, { quiet: true });
}

function replayName(r) {
  const n = String(r.id).padStart(5, "0");
  return `replays/${n}-${r.set1}-vs-${r.set2}-${r.location}-${r.level1}-${r.level2}.json`;
}

async function downloadZip() {
  const btn = el("lab-zip");
  btn.disabled = true;
  btn.textContent = "Packing…";
  try {
    const results = [...lab.results.values()].sort((a, b) => a.row.id - b.row.id);
    const rows = results.map((r) => r.row);
    const cfg = { ...lab.cfg };
    const files = [
      { name: "report.html", data: reportHTML(rows, cfg, { elapsedMs: elapsed() }) },
      { name: "summary.csv", data: summaryCSV(rows) },
      { name: "games.csv", data: gamesCSV(rows) },
      { name: "config.json", data: JSON.stringify({ ...cfg, games: lab.games.length, played: rows.length }, null, 2) },
      ...results.map((r) => ({ name: replayName(r.row), data: JSON.stringify(r.replay) })),
    ];
    const zip = await makeZip(files);
    const blob = new Blob([zip], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    a.href = url;
    a.download = `dicewar-lab-${ts}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) {
    console.error(e);
    alert("Creating the ZIP failed: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Download ZIP";
  }
}

// ---------------------------------------------------------------------------
// Open / close
// ---------------------------------------------------------------------------

function open() {
  buildDOM();
  el("lab-overlay").style.display = "flex";
  if (lab.view === "config") {
    el("lab-run").style.display = "none";
    el("lab-config").style.display = "";
    renderConfig(lab.cfg || defaultConfig());
  } else {
    el("lab-config").style.display = "none";
    el("lab-run").style.display = "";
    renderRun(true);
  }
}

function close() {
  if (el("lab-overlay")) el("lab-overlay").style.display = "none";
}

window.Lab = { open, close, isRunning: () => lab.view === "run" };
