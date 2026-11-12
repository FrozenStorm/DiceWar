// Online lobby: everybody who enters lands in one lobby, can challenge another
// free player and, when the challenge is accepted, both play over the database.
//
// Database layout (rules in database.rules.json):
//   lobby/{uid}               { name, status: "free" | "challenging" | "in_game", gameId, at }
//   challenges/{to}/{from}    { fromName, set, location (landscape ids, comma-separated), riverCol, start, rules, status, gameId, at }
//   games/{id}/meta           { p1, p2, name1, name2, set1, set2, location, riverCol, rules,
//                               startingPlayer, created, result, left }
//   games/{id}/state          { seq, by, json }  (the full game snapshot as JSON text)
//   games/{id}/presence/{uid} { online, at }
//
// The challenger is Player 1 (bottom of the board), the challenged player is Player 2.
// Uses globals of the classic script in index.html: state, onlineState, DICE_SETS,
// buildGameSnapshot, handleRemoteGameState, setupOnlineGame, initOnlineGameState.

const CHALLENGE_TIMEOUT_MS = 60 * 1000;
const OPPONENT_GONE_MS = 3 * 60 * 1000;
const GAME_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const KEY_NAME = "dicewar.online.name";
const KEY_GAME = "dicewar.online.game";
const KEY_GAMES = "dicewar.online.games";

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const setLabel = (id) => (DICE_SETS.find((s) => s.id === id) || { label: id }).label;

const ON = {
  db: null,
  connecting: null,
  name: store.get(KEY_NAME) || "",
  status: "free",
  inLobby: false,
  lobby: {},
  incoming: {},
  outgoing: null,      // { to, unsub, timer }
  lobbyUnsubs: [],
  game: null,          // { id, meta, role, ready, lastSeq, unsubs, oppOnline, oppGoneSince, finished }
  tick: null,
};

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

async function connect() {
  if (ON.db) return ON.db;
  if (!ON.connecting) {
    const mock = new URLSearchParams(location.search).get("backend") === "mock";
    ON.connecting = (mock ? import("./backend-mock.js") : import("./backend-firebase.js"))
      .then((m) => m.createBackend())
      .then((db) => {
        ON.db = db;
        db.onConnected((up) => { if (up) registerPresence(); });
        return db;
      })
      .catch((e) => { ON.connecting = null; throw e; });
  }
  return ON.connecting;
}

/** (Re)announce ourselves after every (re)connect; the server removes us on disconnect. */
function registerPresence() {
  const db = ON.db;
  if (!db) return;
  if (ON.inLobby || ON.game) {
    db.onDisconnect(`lobby/${db.uid}`, null);
    db.set(`lobby/${db.uid}`, lobbyEntry());
  }
  if (ON.game && ON.game.ready) {
    const p = `games/${ON.game.id}/presence/${db.uid}`;
    db.onDisconnect(p, { online: false, at: db.TS });
    db.set(p, { online: true, at: db.TS });
  }
  if (ON.outgoing) db.onDisconnect(`challenges/${ON.outgoing.to}/${db.uid}`, null);
}

function lobbyEntry() {
  return { name: ON.name, status: ON.status, gameId: ON.game ? ON.game.id : null, at: ON.db.TS };
}

function setMyStatus(status) {
  ON.status = status;
  if (ON.db && (ON.inLobby || ON.game)) ON.db.set(`lobby/${ON.db.uid}`, lobbyEntry()).catch((e) => console.warn(e));
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

async function openLobby() {
  $("lobby-overlay").style.display = "none";
  $("online-lobby-overlay").style.display = "flex";
  $("online-name").value = ON.name;
  if (!ON.name) {
    showLobbyMessage("Choose a name to enter the lobby.");
    renderLobby();
    $("online-name").focus();
    return;
  }
  await enterLobby();
}

async function enterLobby() {
  showLobbyMessage("Connecting…");
  let db;
  try {
    db = await connect();
  } catch (e) {
    console.error(e);
    showLobbyMessage("Could not connect to the lobby. Check your internet connection and try again.");
    return;
  }
  if (ON.game) {
    // Still in a running game (e.g. the menu was opened): go back to it.
    closeLobbyOverlay();
    return;
  }
  ON.inLobby = true;
  ON.status = "free";
  showLobbyMessage("");
  db.onDisconnect(`lobby/${db.uid}`, null);
  await db.set(`lobby/${db.uid}`, lobbyEntry());
  ON.lobbyUnsubs.push(db.on("lobby", (val) => { ON.lobby = val || {}; renderLobby(); }));
  ON.lobbyUnsubs.push(db.on(`challenges/${db.uid}`, (val) => { ON.incoming = val || {}; renderLobby(); }));
  if (!ON.tick) ON.tick = setInterval(onTick, 1000);
  cleanupOldGames();
  renderLobby();
}

/** Leave the lobby (back to the start menu). */
function leaveLobby() {
  cancelChallenge();
  stopLobbyListeners();
  ON.inLobby = false;
  if (ON.db) {
    ON.db.remove(`lobby/${ON.db.uid}`);
    ON.db.cancelOnDisconnect(`lobby/${ON.db.uid}`);
  }
  closeLobbyOverlay();
  $("lobby-overlay").style.display = "flex";
}

function stopLobbyListeners() {
  ON.lobbyUnsubs.forEach((u) => u());
  ON.lobbyUnsubs = [];
  ON.incoming = {};
}

function closeLobbyOverlay() {
  $("online-lobby-overlay").style.display = "none";
  $("challenge-dialog").style.display = "none";
}

function showLobbyMessage(text) {
  $("online-lobby-msg").textContent = text;
  $("online-lobby-msg").style.display = text ? "block" : "none";
}

/** Names shown in the lobby; equal names get a short tag to tell them apart. */
function displayName(uid, name) {
  const same = Object.values(ON.lobby).filter((p) => p && p.name === name).length;
  return same > 1 ? `${name} #${uid.slice(-3)}` : name;
}

function renderLobby() {
  const db = ON.db;
  const list = $("online-players");
  const incomingBox = $("online-incoming");
  const named = !!ON.name && ON.inLobby;
  $("online-players-box").style.display = named ? "" : "none";
  $("online-name-row").querySelector("button").textContent = ON.inLobby ? "Rename" : "Enter";
  if (!db || !named) { setHtml(list, ""); setHtml(incomingBox, ""); return; }

  // Incoming challenges.
  const now = db.now();
  const incoming = Object.entries(ON.incoming).filter(([, c]) =>
    c && c.status === "pending" && (typeof c.at !== "number" || now - c.at < CHALLENGE_TIMEOUT_MS));
  setHtml(incomingBox, incoming.map(([from, c]) => `
    <div class="challenge-card" data-from="${esc(from)}">
      <div><b>${esc(displayName(from, c.fromName))}</b> challenges you!</div>
      <div class="challenge-details">${esc(challengeSummary(c))}</div>
      <label>Your dice set <select class="incoming-set">${setOptions(store.get("dicewar.online.set") || "RoX")}</select></label>
      <div class="challenge-buttons">
        <button class="big-btn" data-act="accept">Accept</button>
        <button class="big-btn secondary" data-act="decline">Decline</button>
      </div>
    </div>`).join(""));

  // Other players.
  const others = Object.entries(ON.lobby).filter(([uid, p]) => uid !== db.uid && p && p.name);
  others.sort((a, b) => (a[1].status === "free" ? 0 : 1) - (b[1].status === "free" ? 0 : 1) || a[1].name.localeCompare(b[1].name));
  if (!others.length) {
    setHtml(list, `<li class="empty">Nobody else is here yet. Keep this page open, or invite a friend to dicewar.</li>`);
  } else {
    const waiting = ON.outgoing && ON.outgoing.to;
    setHtml(list, others.map(([uid, p]) => {
      const st = p.status === "free" ? "free" : p.status === "in_game" ? "in game" : "busy";
      let action = "";
      if (waiting === uid) action = `<button class="small-btn" data-act="cancel">Cancel</button>`;
      else if (p.status === "free" && !waiting) action = `<button class="small-btn" data-act="challenge">Challenge</button>`;
      return `<li data-uid="${esc(uid)}"><span class="dot ${p.status === "free" ? "free" : "busy"}"></span>
        <span class="pname">${esc(displayName(uid, p.name))}</span><span class="pstatus">${waiting === uid ? "waiting…" : st}</span>${action}</li>`;
    }).join(""));
  }
}

/** Replace the content only when it changed, so an open dropdown is not closed
 *  by the periodic refresh; chosen dice sets of challenge cards are kept. */
function setHtml(el, html) {
  if (el.dataset.html === html) return;
  const chosen = {};
  el.querySelectorAll(".challenge-card").forEach((c) => { chosen[c.dataset.from] = c.querySelector(".incoming-set").value; });
  el.dataset.html = html;
  el.innerHTML = html;
  el.querySelectorAll(".challenge-card").forEach((c) => {
    if (chosen[c.dataset.from]) c.querySelector(".incoming-set").value = chosen[c.dataset.from];
  });
}

function setOptions(selected) {
  return DICE_SETS.map((s) => `<option value="${s.id}"${s.id === selected ? " selected" : ""}>${esc(s.label)}</option>`).join("");
}

/** Landscapes are stored as a comma-separated list of ids, e.g. "oracle,ruins". */
const landscapes = (v) => window.Landscapes.parse(v);

function challengeSummary(c) {
  const start = c.start === "me" ? `${c.fromName} starts` : c.start === "opponent" ? "you start" : "random start player";
  const river = landscapes(c.location).includes("river") ? ` (river in column ${"abcdefg"[c.riverCol] || "b"})` : "";
  return `${setLabel(c.set)} · Landscapes: ${window.Landscapes.label(c.location)}${river} · ${start} · rules ${c.rules ? "on" : "off"}`;
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------

function openChallengeDialog(to) {
  const p = ON.lobby[to];
  if (!p) return;
  const dlg = $("challenge-dialog");
  dlg.dataset.to = to;
  $("challenge-title").textContent = `Challenge ${displayName(to, p.name)}`;
  $("challenge-set").innerHTML = setOptions(store.get("dicewar.online.set") || "RoX");
  const loc = $("challenge-location");
  if (!loc.children.length) window.Landscapes.render(loc);
  window.Landscapes.select(loc, landscapes(store.get("dicewar.online.landscapes")));
  $("challenge-river-col").value = "1";
  updateChallengeDialog();
  dlg.style.display = "flex";
}

function updateChallengeDialog() {
  const river = window.Landscapes.selected($("challenge-location")).includes("river");
  $("challenge-river-label").style.display = river ? "flex" : "none";
}

async function sendChallenge() {
  const db = ON.db;
  const to = $("challenge-dialog").dataset.to;
  if (!db || !to || ON.outgoing) return;
  const set = $("challenge-set").value;
  store.set("dicewar.online.set", set);
  const location = window.Landscapes.stringify(window.Landscapes.selected($("challenge-location")));
  store.set("dicewar.online.landscapes", location);
  const c = {
    fromName: ON.name,
    set,
    location,
    riverCol: Number($("challenge-river-col").value),
    start: $("challenge-start").value,
    rules: $("challenge-rules").checked && set !== "numbers",
    status: "pending",
    at: db.TS,
  };
  $("challenge-dialog").style.display = "none";
  const path = `challenges/${to}/${db.uid}`;
  ON.outgoing = { to, unsub: null, timer: null };
  db.onDisconnect(path, null);
  await db.set(path, c);
  setMyStatus("challenging");
  ON.outgoing.timer = setTimeout(() => {
    showLobbyMessage("No answer – the challenge has expired.");
    cancelChallenge();
  }, CHALLENGE_TIMEOUT_MS);
  let seen = false;
  ON.outgoing.unsub = db.on(path, (val) => {
    if (!ON.outgoing || ON.outgoing.to !== to) return;
    if (val) seen = true;
    if (!val) {
      if (seen) { showLobbyMessage("The challenge was withdrawn."); cancelChallenge(); }
    } else if (val.status === "declined") {
      showLobbyMessage(`${ON.lobby[to] ? ON.lobby[to].name : "The player"} declined your challenge.`);
      cancelChallenge();
    } else if (val.status === "accepted" && val.gameId) {
      const gameId = val.gameId;
      cancelChallenge({ keepStatus: true });
      startAsChallenger(gameId);
    }
  });
  renderLobby();
}

function cancelChallenge({ keepStatus = false } = {}) {
  const o = ON.outgoing;
  if (!o) return;
  ON.outgoing = null;
  clearTimeout(o.timer);
  if (o.unsub) o.unsub();
  if (ON.db) {
    const path = `challenges/${o.to}/${ON.db.uid}`;
    ON.db.remove(path);
    ON.db.cancelOnDisconnect(path);
  }
  if (!keepStatus && ON.inLobby) setMyStatus("free");
  renderLobby();
}

async function declineChallenge(from) {
  await ON.db.update(`challenges/${ON.db.uid}/${from}`, { status: "declined" });
}

async function acceptChallenge(from, mySet) {
  const db = ON.db;
  const c = ON.incoming[from];
  if (!c || c.status !== "pending" || ON.game) return;
  cancelChallenge({ keepStatus: true });
  store.set("dicewar.online.set", mySet);
  const rulesOk = c.rules && window.RulesMode && RulesMode.isAvailable(c.set, mySet);
  const startingPlayer = c.start === "me" ? 1 : c.start === "opponent" ? 2 : (Math.random() < 0.5 ? 1 : 2);
  const id = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const meta = {
    p1: from, p2: db.uid,
    name1: c.fromName, name2: ON.name,
    set1: c.set, set2: mySet,
    location: c.location || "", riverCol: c.riverCol == null ? 1 : c.riverCol,
    rules: !!rulesOk,
    startingPlayer,
    created: db.TS,
  };
  // Build the starting position here and publish it with the game.
  beginGame(id, meta, 2);
  initOnlineGameState(meta);
  ON.game.lastSeq = 1;
  await db.set(`games/${id}`, {
    meta,
    state: { seq: 1, by: db.uid, json: JSON.stringify(buildGameSnapshot()) },
  });
  ON.game.ready = true;
  attachGameListeners();
  await db.update(`challenges/${db.uid}/${from}`, { status: "accepted", gameId: id });
}

async function startAsChallenger(gameId) {
  const meta = await ON.db.get(`games/${gameId}/meta`);
  if (!meta) { showLobbyMessage("The game could not be started."); setMyStatus("free"); return; }
  beginGame(gameId, meta, 1);
  ON.game.ready = true;
  attachGameListeners();
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

/** Set up the local board for an online game. */
function beginGame(id, meta, role) {
  stopLobbyListeners();
  ON.inLobby = false;
  closeLobbyOverlay();
  ON.game = { id, meta, role, ready: false, lastSeq: 0, unsubs: [], oppOnline: true, oppGoneSince: null, finished: false };
  store.set(KEY_GAME, id);
  rememberGame(id);
  setupOnlineGame(meta, role);
  showOnlineBar();
  setMyStatus("in_game");
  registerPresence();
  if (!ON.tick) ON.tick = setInterval(onTick, 1000);
}

function attachGameListeners() {
  const db = ON.db;
  const g = ON.game;
  const opp = g.role === 1 ? g.meta.p2 : g.meta.p1;
  registerPresence();
  g.unsubs.push(db.on(`games/${g.id}/state`, (val) => {
    if (!val || ON.game !== g) return;
    if (val.by === db.uid && val.seq <= g.lastSeq) return; // our own write
    const first = g.lastSeq === 0;
    g.lastSeq = Math.max(g.lastSeq, val.seq);
    try {
      const data = JSON.parse(val.json);
      handleRemoteGameState(data, { resetHistory: first });
    } catch (e) { console.error("Bad game state", e); }
    checkEngineResult();
  }, () => leaveGame("The game is no longer available.")));
  g.unsubs.push(db.on(`games/${g.id}/presence/${opp}`, (val) => {
    if (ON.game !== g) return;
    const online = !val || val.online !== false; // no entry yet = still loading the game
    if (online) g.oppGoneSince = null;
    else if (!g.oppGoneSince) g.oppGoneSince = Date.now();
    g.oppOnline = online;
    renderOnlineBar();
  }));
  g.unsubs.push(db.on(`games/${g.id}/meta/result`, (val) => {
    if (ON.game !== g) return;
    if (val) showResult(val);
  }));
}

/** Called by sendGameState() in index.html after every local action. */
function pushState(snapshot) {
  const g = ON.game;
  if (!g || !g.ready || g.finished || !ON.db) return;
  g.lastSeq += 1;
  const seq = g.lastSeq;
  ON.db.set(`games/${g.id}/state`, { seq, by: ON.db.uid, json: JSON.stringify(snapshot) })
    .catch(async (e) => {
      // Out of step with the database: take over its state.
      console.warn("State write refused, resyncing", e);
      const cur = await ON.db.get(`games/${g.id}/state`);
      if (cur && ON.game === g) {
        g.lastSeq = cur.seq;
        handleRemoteGameState(JSON.parse(cur.json), {});
      }
    });
  checkEngineResult();
}

/** In rules mode the engine decides the end of the game. */
function checkEngineResult() {
  const g = ON.game;
  if (!g || g.finished || !window.RulesMode || !RulesMode.active || !RulesMode.game) return;
  const rg = RulesMode.game;
  if (rg.phase !== "over" || !rg.result) return;
  ON.db.set(`games/${g.id}/meta/result`, { winner: rg.result.winner || 0, reason: "game", at: ON.db.TS });
}

function resign() {
  const g = ON.game;
  if (!g || g.finished) return;
  if (!confirm("Resign this game? Your opponent wins.")) return;
  ON.db.set(`games/${g.id}/meta/result`, { winner: g.role === 1 ? 2 : 1, reason: "resign", at: ON.db.TS });
}

function claimWin() {
  const g = ON.game;
  if (!g || g.finished || g.oppOnline) return;
  ON.db.set(`games/${g.id}/meta/result`, { winner: g.role, reason: "left", at: ON.db.TS });
}

function showResult(result) {
  const g = ON.game;
  if (!g) return;
  g.finished = true;
  store.del(KEY_GAME);
  const opp = g.role === 1 ? g.meta.name2 : g.meta.name1;
  let title;
  if (!result.winner) title = "Draw";
  else if (result.winner === g.role) title = "You win!";
  else title = `${opp} wins`;
  const why = {
    resign: result.winner === g.role ? `${opp} resigned.` : "You resigned.",
    left: result.winner === g.role ? `${opp} left the game.` : "You were away for too long.",
    game: window.RulesMode && RulesMode.active ? RulesMode.statusText() : "",
  }[result.reason] || "";
  $("online-result-title").textContent = title;
  $("online-result-text").textContent = why;
  // Let the last move's animation play before covering the board.
  setTimeout(() => { if (ON.game === g) $("online-result-overlay").style.display = "flex"; }, result.reason === "game" ? 1500 : 0);
  renderOnlineBar();
}

/** Leave the finished (or vanished) game and go back to the lobby. */
async function backToLobby() {
  await leaveGame();
  openLobby();
}

async function leaveGame(message) {
  const g = ON.game;
  if (!g) return;
  ON.game = null;
  g.unsubs.forEach((u) => u());
  store.del(KEY_GAME);
  $("online-result-overlay").style.display = "none";
  hideOnlineBar();
  if (ON.db) {
    const db = ON.db;
    db.cancelOnDisconnect(`games/${g.id}/presence/${db.uid}`);
    try {
      // The last player to leave deletes the game.
      const left = (await db.get(`games/${g.id}/meta/left`)) || {};
      const opp = g.role === 1 ? g.meta.p2 : g.meta.p1;
      if (left[opp]) await db.remove(`games/${g.id}`);
      else await db.set(`games/${g.id}/meta/left/${db.uid}`, true);
    } catch (e) { /* already gone */ }
    db.remove(`lobby/${db.uid}`);
  }
  ON.status = "free";
  if (window.RulesMode) RulesMode.stop();
  state.gameMode = "duel";
  onlineState.localPlayer = null;
  if (message) alert(message);
}

/** Leave a running game for another mode: counts as resigning. */
function leaveForOtherMode() {
  const g = ON.game;
  if (!g) return true;
  if (!g.finished) {
    if (!confirm("Leave the online game? This counts as resigning.")) return false;
    ON.db.set(`games/${g.id}/meta/result`, { winner: g.role === 1 ? 2 : 1, reason: "resign", at: ON.db.TS });
  }
  leaveGame();
  return true;
}

/** After a reload: go straight back into the running game. */
async function resume() {
  const id = store.get(KEY_GAME);
  if (!id || !ON.name) return;
  $("lobby-overlay").style.display = "none";
  setStatusText("Reconnecting to your online game…");
  let db, meta;
  try {
    db = await connect();
    meta = await db.get(`games/${id}/meta`);
  } catch (e) {
    console.warn("Resume failed", e);
  }
  if (!meta || meta.result || !db || (meta.p1 !== db.uid && meta.p2 !== db.uid)) {
    store.del(KEY_GAME);
    setStatusText("");
    if (!ON.game) $("lobby-overlay").style.display = "flex";
    return;
  }
  beginGame(id, meta, meta.p1 === db.uid ? 1 : 2);
  ON.game.ready = true;
  attachGameListeners();
}

function setStatusText(t) {
  const el = $("status-text");
  if (el) el.textContent = t;
}

function rememberGame(id) {
  let list = [];
  try { list = JSON.parse(store.get(KEY_GAMES) || "[]"); } catch (e) { list = []; }
  if (!list.some((g) => g.id === id)) list.push({ id, at: Date.now() });
  store.set(KEY_GAMES, JSON.stringify(list));
}

/** Delete our own games that are older than a day (the free plan has no server jobs). */
async function cleanupOldGames() {
  let list = [];
  try { list = JSON.parse(store.get(KEY_GAMES) || "[]"); } catch (e) { list = []; }
  const keep = [];
  for (const g of list) {
    if (Date.now() - g.at > GAME_MAX_AGE_MS) {
      try { await ON.db.remove(`games/${g.id}`); } catch (e) { /* gone or not ours */ }
    } else keep.push(g);
  }
  store.set(KEY_GAMES, JSON.stringify(keep));
}

// ---------------------------------------------------------------------------
// In-game bar
// ---------------------------------------------------------------------------

function showOnlineBar() {
  $("online-bar").style.display = "flex";
  const g = ON.game;
  $("p1-name").innerHTML = `<b>${esc(g.meta.name1)}${g.role === 1 ? " (you)" : ""}</b>`;
  $("p2-name").innerHTML = `<b>${esc(g.meta.name2)}${g.role === 2 ? " (you)" : ""}</b>`;
  renderOnlineBar();
}

function hideOnlineBar() {
  $("online-bar").style.display = "none";
  $("p1-name").innerHTML = "<b>Player 1</b>";
  $("p2-name").innerHTML = "<b>Player 2</b>";
}

function renderOnlineBar() {
  const g = ON.game;
  if (!g) return;
  const opp = g.role === 1 ? g.meta.name2 : g.meta.name1;
  let status;
  let showClaim = false;
  if (g.finished) status = "Game over";
  else if (g.oppOnline) status = "online";
  else {
    const left = Math.max(0, OPPONENT_GONE_MS - (Date.now() - g.oppGoneSince));
    if (left > 0) {
      const s = Math.ceil(left / 1000);
      status = `disconnected · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    } else {
      status = "disconnected";
      showClaim = true;
    }
  }
  $("online-bar-text").innerHTML = `vs <b>${esc(opp)}</b> <span class="dot ${g.oppOnline && !g.finished ? "free" : "busy"}"></span> ${esc(status)}`;
  $("btn-claim-win").style.display = showClaim ? "" : "none";
  $("btn-resign").style.display = g.finished ? "none" : "";
  $("btn-online-back").style.display = g.finished ? "" : "none";
}

function onTick() {
  if (ON.game && !ON.game.oppOnline) renderOnlineBar();
  if (ON.inLobby) renderLobby();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

$("online-name-row").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("online-name").value.trim().slice(0, 20);
  if (!name) return;
  ON.name = name;
  store.set(KEY_NAME, name);
  if (ON.inLobby) ON.db.update(`lobby/${ON.db.uid}`, { name });
  else await enterLobby();
});
$("btn-online-leave").addEventListener("click", leaveLobby);
$("online-players").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  const li = e.target.closest("li[data-uid]");
  if (!btn || !li) return;
  if (btn.dataset.act === "challenge") openChallengeDialog(li.dataset.uid);
  if (btn.dataset.act === "cancel") cancelChallenge();
});
$("online-incoming").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  const card = e.target.closest(".challenge-card");
  if (!btn || !card) return;
  if (btn.dataset.act === "accept") acceptChallenge(card.dataset.from, card.querySelector(".incoming-set").value);
  if (btn.dataset.act === "decline") declineChallenge(card.dataset.from);
});
["challenge-set", "challenge-location", "challenge-rules"].forEach((id) => $(id).addEventListener("change", updateChallengeDialog));
$("btn-send-challenge").addEventListener("click", sendChallenge);
$("btn-cancel-challenge-dialog").addEventListener("click", () => { $("challenge-dialog").style.display = "none"; });
$("btn-resign").addEventListener("click", resign);
$("btn-claim-win").addEventListener("click", claimWin);
$("btn-online-back").addEventListener("click", backToLobby);
$("btn-result-lobby").addEventListener("click", backToLobby);
$("btn-result-close").addEventListener("click", () => { $("online-result-overlay").style.display = "none"; });

window.Online = {
  openLobby,
  pushState,
  inGame: () => !!(ON.game && !ON.game.finished),
  leaveForOtherMode,
  opponentName: () => (ON.game ? (ON.game.role === 1 ? ON.game.meta.name2 : ON.game.meta.name1) : "Opponent"),
};

resume();
