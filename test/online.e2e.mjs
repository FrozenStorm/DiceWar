// End-to-end test of the online lobby with two browsers (Playwright).
// The Firebase database is replaced by an in-process mock that follows the
// same access rules as database.rules.json (index.html?backend=mock).
//
// Run: npm run test:online
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

// ---------------------------------------------------------------------------
// Static server
// ---------------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
    if (p === ROOT + "/" || p === ROOT) { res.writeHead(302, { location: "/index.html" }); return res.end(); }
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/index.html?backend=mock`;

// ---------------------------------------------------------------------------
// Mock database with the access rules of database.rules.json
// ---------------------------------------------------------------------------
const db = { root: {} };
const split = (p) => p.split("/").filter(Boolean);
function getAt(obj, parts) {
  let o = obj;
  for (const k of parts) { if (o == null || typeof o !== "object") return null; o = o[k]; }
  return o === undefined ? null : o;
}
function setAt(obj, parts, val) {
  if (!parts.length) return val == null ? {} : val;
  const [k, ...rest] = parts;
  const copy = { ...(obj && typeof obj === "object" ? obj : {}) };
  const child = setAt(copy[k], rest, val);
  if (child == null || (typeof child === "object" && !Object.keys(child).length)) delete copy[k];
  else copy[k] = child;
  return copy;
}
const stamp = (v) => (v && typeof v === "object"
  ? (v[".sv"] === "timestamp" ? Date.now() : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stamp(x)])))
  : v);
const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));

function canRead(uid, parts) {
  const [top, a, b] = parts;
  if (top === "lobby") return true;
  if (top === "challenges") return a === uid || (b !== undefined && b === uid);
  if (top === "games" && a) {
    const meta = getAt(db.root, ["games", a, "meta"]);
    return !!meta && (meta.p1 === uid || meta.p2 === uid);
  }
  return false;
}
function canWrite(uid, parts, newRoot) {
  const [top, a, b] = parts;
  if (top === "lobby") {
    if (a !== uid) return false;
    const n = getAt(newRoot, ["lobby", a]);
    return n == null || (typeof n.name === "string" && n.name.length > 0 && n.name.length <= 20 && typeof n.status === "string");
  }
  if (top === "challenges") {
    if (!(a === uid || b === uid) || b === undefined) return false;
    const n = getAt(newRoot, ["challenges", a, b]);
    return n == null || (typeof n.fromName === "string" && typeof n.status === "string");
  }
  if (top === "games" && a) {
    const old = getAt(db.root, ["games", a]);
    const neu = getAt(newRoot, ["games", a]);
    const ok = old ? (old.meta && (old.meta.p1 === uid || old.meta.p2 === uid)) : !!(neu && neu.meta && neu.meta.p2 === uid);
    if (!ok) return false;
    const os = old && old.state, ns = neu && neu.state;
    if (ns && JSON.stringify(os) !== JSON.stringify(ns)) {
      if (ns.by !== uid || typeof ns.json !== "string") return false;
      if (os && ns.seq !== os.seq + 1) return false;
    }
    return true;
  }
  return false;
}

const sessions = new Map(); // sess -> { page, uid, listeners: Map(id -> {path, last}), onDisc: [] }
const pageSess = new Map(); // page -> sess

async function emitAll() {
  for (const [, s] of sessions) {
    for (const [id, l] of s.listeners) {
      const parts = split(l.path);
      if (!canRead(s.uid, parts)) continue;
      const val = clone(getAt(db.root, parts));
      const json = JSON.stringify(val);
      if (json === l.last) continue;
      l.last = json;
      s.page.evaluate(([i, v]) => window.__mockEmit && window.__mockEmit(i, v), [id, val]).catch((e) => { if (!/closed|destroyed/.test(e.message)) errors.push("emit: " + e.message); });
    }
  }
}

function write(uid, p, val) {
  const parts = split(p);
  const newRoot = setAt(db.root, parts, stamp(clone(val)));
  if (!canWrite(uid, parts, newRoot)) throw new Error(`PERMISSION_DENIED: ${uid} ${p}`);
  db.root = newRoot;
}

function disconnect(sess) {
  const s = sessions.get(sess);
  if (!s) return;
  sessions.delete(sess);
  for (const { path: p, val } of s.onDisc) {
    try { write(s.uid, p, val); } catch (e) { /* rules */ }
  }
  emitAll();
}

async function handle(page, msg) {
  const { op, uid, sess } = msg;
  if (op === "hello") {
    const prev = pageSess.get(page);
    if (prev && prev !== sess) disconnect(prev);
    pageSess.set(page, sess);
    sessions.set(sess, { page, uid, listeners: new Map(), onDisc: [] });
    return null;
  }
  const s = sessions.get(sess);
  if (!s) throw new Error("unknown session");
  switch (op) {
    case "set": write(uid, msg.path, msg.val); await emitAll(); return null;
    case "update":
      for (const [k, v] of Object.entries(msg.val)) write(uid, `${msg.path}/${k}`, v);
      await emitAll(); return null;
    case "get":
      if (!canRead(uid, split(msg.path))) throw new Error("PERMISSION_DENIED read " + msg.path);
      return clone(getAt(db.root, split(msg.path)));
    case "on": s.listeners.set(msg.id, { path: msg.path, last: undefined });
      if (canRead(uid, split(msg.path))) {
        const val = clone(getAt(db.root, split(msg.path)));
        s.listeners.get(msg.id).last = JSON.stringify(val);
        page.evaluate(([i, v]) => window.__mockEmit(i, v), [msg.id, val]).catch(() => {});
      }
      return null;
    case "off": s.listeners.delete(msg.id); return null;
    case "onDisconnect":
      s.onDisc = s.onDisc.filter((o) => o.path !== msg.path);
      s.onDisc.push({ path: msg.path, val: msg.val });
      return null;
    case "cancelOnDisconnect": s.onDisc = s.onDisc.filter((o) => o.path !== msg.path); return null;
    default: throw new Error("bad op " + op);
  }
}

// ---------------------------------------------------------------------------
// Browsers
// ---------------------------------------------------------------------------
const browser = await chromium.launch();
const errors = [];
async function player(label) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  await ctx.exposeBinding("__mockDb", ({ page }, msg) => handle(page, msg));
  await ctx.route(/cloudflareinsights|gstatic/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("dialog", (d) => d.accept());
  page.on("close", () => { const s = pageSess.get(page); if (s) disconnect(s); });
  await page.goto(BASE);
  return { ctx, page, label };
}

async function enterLobby(p, name) {
  await p.page.selectOption("#game-mode-select", "online");
  await p.page.click("#start-game-btn");
  await p.page.fill("#online-name", name);
  await p.page.click("#online-name-row button");
  await p.page.waitForSelector("#online-players-box", { state: "visible" });
}

const gameOf = (p) => p.page.evaluate(() => (window.RulesMode && RulesMode.active
  ? JSON.stringify({ board: RulesMode.game.board, turn: RulesMode.game.turnNumber, phase: RulesMode.game.phase, pending: RulesMode.game.pending })
  : JSON.stringify(state.board)));

async function waitSynced(a, b) {
  for (let i = 0; i < 100; i++) {
    if ((await gameOf(a)) === (await gameOf(b))) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.fail("boards did not sync");
}

/** The player whose turn it is makes one random legal move. */
async function randomMove(players) {
  for (const p of players) {
    const moved = await p.page.evaluate(async () => {
      if (!RulesMode.localCanAct()) return false;
      const g = RulesMode.game;
      if (g.phase === "setup") {
        const { chooseSetup } = await import("./ai/ai.js");
        RulesMode.perform(chooseSetup(g, { level: "medium" }));
      } else {
        const { legalActions } = await import("./engine/core.js");
        const acts = legalActions(g).filter((a) => a.type !== "declareEndOfWar");
        RulesMode.perform(acts[Math.floor(Math.random() * acts.length)]);
      }
      return true;
    });
    if (moved) return p;
  }
  return null;
}

let failed = false;
async function step(name, fn) {
  try { await fn(); console.log("ok -", name); } catch (e) { failed = true; console.log("not ok -", name, "\n ", e.message); throw e; }
}

const A = await player("Alice");
const B = await player("Bob");
try {
  await step("both enter the lobby and see each other", async () => {
    await enterLobby(A, "Alice");
    await enterLobby(B, "Bob");
    await A.page.waitForSelector("#online-players li[data-uid] >> text=Bob");
    await B.page.waitForSelector("#online-players li[data-uid] >> text=Alice");
  });

  await step("a declined challenge frees both players", async () => {
    await A.page.click("#online-players li >> text=Challenge");
    await A.page.click("#btn-send-challenge");
    await B.page.waitForSelector(".challenge-card");
    await B.page.click(".challenge-card [data-act=decline]");
    await A.page.waitForSelector("#online-lobby-msg >> text=declined");
    await B.page.waitForSelector(".challenge-card", { state: "detached" });
    await A.page.waitForSelector("#online-players li >> text=Challenge");
  });

  await step("challenge accepted: rules game starts for both", async () => {
    await A.page.click("#online-players li >> text=Challenge");
    await A.page.selectOption("#challenge-set", "RoX");
    await A.page.selectOption("#challenge-location", "craters");
    await A.page.selectOption("#challenge-start", "me");
    if (process.env.SHOTS) await A.page.screenshot({ path: process.env.SHOTS + "/dialog-A.png" });
    await A.page.click("#btn-send-challenge");
    await B.page.waitForSelector(".challenge-card >> text=Alice");
    if (process.env.SHOTS) {
      await A.page.screenshot({ path: process.env.SHOTS + "/lobby-A.png" });
      await B.page.screenshot({ path: process.env.SHOTS + "/lobby-B.png" });
    }
    await B.page.selectOption(".challenge-card .incoming-set", "BoD");
    await B.page.click(".challenge-card [data-act=accept]");
    await A.page.waitForSelector("#online-bar >> text=Bob");
    await B.page.waitForSelector("#online-bar >> text=Alice");
    await waitSynced(A, B);
    assert.equal(await B.page.evaluate(() => document.getElementById("app").classList.contains("online-player2")), true);
    assert.equal(await A.page.evaluate(() => onlineState.localPlayer), 1);
    assert.equal(await A.page.evaluate(() => RulesMode.localCanAct()), true, "Alice starts");
    assert.equal(await B.page.evaluate(() => RulesMode.localCanAct()), false);
    assert.equal(await B.page.evaluate(() => state.players[2].diceSet), "BoD");
    const lobby = getAt(db.root, ["lobby"]);
    assert.ok(Object.values(lobby).every((p) => p.status === "in_game"));
  });

  await step("40 random moves stay in sync", async () => {
    for (let i = 0; i < 40; i++) {
      const mover = await randomMove([A, B]);
      assert.ok(mover, "somebody can move");
      await waitSynced(A, B);
    }
  });

  await step("reload: Bob is back in the same game", async () => {
    const before = await gameOf(A);
    await B.page.reload();
    await B.page.waitForSelector("#online-bar >> text=Alice");
    await waitSynced(A, B);
    assert.equal(await gameOf(B), before);
    await randomMove([A, B]);
    await waitSynced(A, B);
  });

  await step("Bob disconnects: Alice sees the countdown", async () => {
    const url = B.page.url();
    await B.page.close();
    await A.page.waitForSelector("#online-bar >> text=disconnected");
    B.page = await B.ctx.newPage();
    B.page.on("dialog", (d) => d.accept());
    B.page.on("close", () => { const s = pageSess.get(B.page); if (s) disconnect(s); });
    await B.page.goto(url);
    await B.page.waitForSelector("#online-bar >> text=Alice");
    await A.page.waitForSelector("#online-bar >> text=online");
    await waitSynced(A, B);
  });

  await step("Alice resigns: Bob wins, both return to the lobby", async () => {
    await A.page.click("#btn-resign");
    await B.page.waitForSelector("#online-result-title >> text=You win!");
    await A.page.waitForSelector("#online-result-title >> text=Bob wins");
    await A.page.click("#btn-result-lobby");
    await B.page.click("#btn-result-lobby");
    await A.page.waitForSelector("#online-players li >> text=Bob");
    await B.page.waitForSelector("#online-players li >> text=Alice");
    for (let i = 0; i < 40 && getAt(db.root, ["games"]); i++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(getAt(db.root, ["games"]), null, "finished game deleted");
  });

  await step("manual game (Numbers, no rules) syncs a placed die", async () => {
    await B.page.click("#online-players li >> text=Challenge");
    await B.page.selectOption("#challenge-set", "numbers");
    await B.page.selectOption("#challenge-start", "me");
    await B.page.click("#btn-send-challenge");
    await A.page.waitForSelector(".challenge-card >> text=Bob");
    await A.page.selectOption(".challenge-card .incoming-set", "numbers");
    await A.page.click(".challenge-card [data-act=accept]");
    await B.page.waitForSelector("#online-bar >> text=Alice");
    await waitSynced(A, B);
    assert.equal(await A.page.evaluate(() => RulesMode.active), false);
    // Bob (Player 1, starts) puts a die from his reserve onto the board.
    await B.page.click("#p1-reserve");
    await B.page.click(".cell >> nth=45");
    await waitSynced(A, B);
    assert.equal(await A.page.evaluate(() => state.board.flat().filter((c) => c.owner === 1).length), 1);
  });

  await step("lobby leave removes the player", async () => {
    await A.page.click("#btn-resign");
    await A.page.click("#btn-result-lobby");
    await A.page.click("#btn-online-leave");
    await B.page.click("#btn-result-lobby");
    await B.page.waitForSelector("#online-players li.empty");
  });

  assert.deepEqual(errors, [], "no page errors");
} catch (e) {
  failed = true;
  if (!/not ok/.test(String(e))) console.error(e);
  await A.page.screenshot({ path: "/tmp/online-A.png" }).catch(() => {});
  await B.page.screenshot({ path: "/tmp/online-B.png" }).catch(() => {});
  if (errors.length) console.error(errors);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
