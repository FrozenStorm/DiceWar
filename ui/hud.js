// Heads-up display around the board: player bars (score tracks like on the
// board), the hint strip, the docks (who sits where) and the radial menu for
// manual games. Classic script, uses the globals of the main script in
// index.html (state, onlineState, ...) only when its functions are called.

(function () {
  // Title colour of each set's rule cards
  const SET_COLORS = {
    RoX: "#00878c", BoD: "#52495a", LoD: "#bd4c45", RoM: "#7f9c2e",
    KoS: "#575b64", DoA: "#d06a22", numbers: "#56656f",
  };
  const SET_NAMES = {
    RoX: "Rise of Xeladron", BoD: "Bond of Demons", LoD: "Light of Dragons", RoM: "Roots of Mali",
    KoS: "Knights of Steel", DoA: "Dawn of Awakening", numbers: "Numbers",
  };

  const $ = (id) => document.getElementById(id);
  const rulesActive = () => !!(window.RulesMode && RulesMode.active);

  function setColor(p) {
    const set = state.players[p] && state.players[p].diceSet;
    return SET_COLORS[set] || SET_COLORS.numbers;
  }

  function playerName(p) {
    if (rulesActive() && RulesMode.playerName) return RulesMode.playerName(p);
    if (state.gameMode === "online" && typeof onlineState !== "undefined" && onlineState.localPlayer) {
      return p === onlineState.localPlayer ? "You" : (window.Online ? Online.opponentName() : "Opponent");
    }
    return `Player ${p}`;
  }

  /** The player whose turn (or decision) it is. */
  function actingPlayer() {
    if (rulesActive() && RulesMode.actingPlayer) return RulesMode.actingPlayer();
    return state.currentPlayer;
  }

  function localCanAct() {
    if (rulesActive()) return RulesMode.localCanAct();
    if (state.gameMode === "online") return state.currentPlayer === onlineState.localPlayer;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Player bars
  // ---------------------------------------------------------------------------

  function renderTrack(p, field, value, plus) {
    const track = $(`p${p}-${field}-track`);
    if (!track) return;
    let tiles = track.querySelectorAll("button");
    if (!tiles.length) {
      for (let n = 0; n <= 10; n++) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = n;
        b.setAttribute("aria-label", `${field === "victory" ? "Victory" : "Trigger"} points ${n}`);
        b.addEventListener("click", () => onTrackClick(p, field, n));
        track.appendChild(b);
      }
      tiles = track.querySelectorAll("button");
    }
    const target = Math.min(10, value + (plus || 0));
    tiles.forEach((b, n) => {
      b.classList.toggle("on", n === Math.min(10, value));
      b.classList.toggle("plus", !!plus && n === target && n !== value);
    });
  }

  /** Manual games: tap a tile of a score track to set the value. */
  function onTrackClick(p, field, n) {
    if (rulesActive() || !localCanAct()) return;
    if (state.players[p][field] === n) return;
    pushUndoState();
    state.players[p][field] = n;
    refreshPlayerPanels();
    if (state.gameMode === "online") sendGameState();
  }

  function refreshBars() {
    const acting = actingPlayer();
    for (const p of [1, 2]) {
      const pl = state.players[p];
      if (!pl) continue;
      renderTrack(p, "victory", pl.victory, pl.virtualVP || 0);
      renderTrack(p, "trigger", pl.trigger, 0);
      const name = $(`p${p}-name`);
      if (name) {
        name.innerHTML = "";
        const b = document.createElement("b");
        b.textContent = playerName(p);
        name.appendChild(b);
        name.appendChild(document.createTextNode(` · ${SET_NAMES[pl.diceSet] || ""}`));
      }
      const bar = $(`bar-${p}`);
      // Score markers in the colour of the player's dice set
      if (bar) bar.style.setProperty("--player", setColor(p));
      if (bar) bar.classList.toggle("active", p === acting && !(rulesActive() && RulesMode.game && RulesMode.game.phase === "over"));
    }
    layout();
  }

  // ---------------------------------------------------------------------------
  // Docks: opponent at the top, own bar and the controls at the bottom.
  // Duel on one device: the top dock faces player 2 and the controls move to
  // the side of the player who acts, while the board stays where it is.
  // ---------------------------------------------------------------------------

  function layout() {
    const app = $("app");
    if (!app) return;
    const top = $("dock-top"), bottom = $("dock-bottom");
    const bar1 = $("bar-1"), bar2 = $("bar-2");
    const hint = $("hint"), toolbar = $("toolbar");
    const duel = state.gameMode === "duel";
    const flipped = app.classList.contains("online-player2");
    app.classList.toggle("duel", duel);

    const topBar = flipped ? bar1 : bar2;
    const bottomBar = flipped ? bar2 : bar1;
    if (topBar.parentElement !== top) top.appendChild(topBar);
    if (bottomBar.parentElement !== bottom) bottom.appendChild(bottomBar);

    const controlsDock = duel && actingPlayer() === 2 ? top : bottom;
    if (hint.parentElement !== controlsDock) {
      // Duel: the controls change sides and the board slides along.
      const board = $("board");
      const before = board.getBoundingClientRect().top;
      controlsDock.appendChild(hint);
      controlsDock.appendChild(toolbar);
      slideBoard(board, before);
    }
    if (window.Ring && Ring.open) requestAnimationFrame(() => Ring.refresh());
  }

  function slideBoard(board, before) {
    const delta = before - board.getBoundingClientRect().top;
    if (!delta || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    board.style.transition = "none";
    board.style.translate = `0 ${delta}px`;
    board.getBoundingClientRect(); // apply the start position
    board.style.transition = "translate 0.35s ease";
    board.style.translate = "0 0";
    board.addEventListener("transitionend", () => {
      board.style.transition = "";
      board.style.translate = "";
      if (window.Ring && Ring.open) Ring.refresh();
    }, { once: true });
  }

  function isLandscape() {
    return window.matchMedia("(min-aspect-ratio: 5/4)").matches;
  }

  window.addEventListener("resize", () => { if (typeof state !== "undefined") layout(); });

  // ---------------------------------------------------------------------------
  // Hint strip
  // ---------------------------------------------------------------------------

  /** { title, text, msg, color, buttons: [{ label, onClick, secondary, disabled }] } */
  function renderHint(h) {
    const hint = $("hint");
    if (!hint) return;
    hint.style.setProperty("--set-color", h.color || SET_COLORS.numbers);
    $("hint-title").textContent = h.title || "";
    $("status-text").textContent = h.text || "";
    $("hint-msg").textContent = h.msg || "";
    const box = $("rules-panel");
    box.innerHTML = "";
    for (const btn of h.buttons || []) {
      const b = document.createElement("button");
      b.className = "btn" + (btn.secondary ? " secondary" : "");
      b.textContent = btn.label;
      b.disabled = !!btn.disabled;
      b.addEventListener("click", btn.onClick);
      box.appendChild(b);
    }
  }

  // ---------------------------------------------------------------------------
  // Manual games (no rules engine): hint strip and radial menu
  // ---------------------------------------------------------------------------

  function dieImage(cell) {
    const set = state.players[cell.owner] && state.players[cell.owner].diceSet;
    if (!set || set === "numbers") return null;
    const b = state.players[1].diceSet === state.players[2].diceSet && cell.owner === 2 ? "b" : "";
    return `img/${set}/${cell.value}${b}.png`;
  }

  function dieImageRotation(cell) {
    let rot = cell.rotation || 0;
    if ((state.gameMode === "duel" || state.gameMode === "online") && cell.owner === 2) rot += 180;
    return rot;
  }

  function renderManual() {
    if (rulesActive()) return;
    const p = state.currentPlayer;
    const sel = state.selected;
    const can = localCanAct();
    let text = "Tap a die for its actions. Tent = Reserve, tombstone = Exile.";
    if (!can) text = "Waiting for the opponent…";
    else if (sel && sel.type === "reserve") text = "Tap a free field to place a new die from the Reserve.";
    else if (sel && sel.type === "exile") text = "Tap a free field to bring a die back from the Exile.";
    else if (sel && sel.type === "board") text = "Tap a free field to move the die there, or another die.";
    else if (state.roundNumber === 1) text += " Tap a free field to change its landscape.";
    renderHint({
      title: `${playerName(p)}'s turn · Round ${state.roundNumber}`,
      text,
      color: setColor(p),
      buttons: can ? [{ label: "End Turn", onClick: () => endTurn() }] : [],
    });

    const cell = sel && sel.type === "board" ? state.board[sel.row][sel.col] : null;
    if (!cell || cell.owner == null || state.ringDismissed || !can) {
      if (window.Ring) Ring.hide();
      return;
    }
    const owner = cell.owner;
    Ring.show({
      square: { row: sel.row, col: sel.col },
      flip: state.gameMode === "duel" && owner === 2,
      dieImg: dieImage(cell),
      dieText: dieImage(cell) ? "" : String(cell.value),
      dieRotation: dieImageRotation(cell),
      spellColor: setColor(owner),
      items: {
        top: [
          { label: "Level −", kind: "upgrade", onClick: () => rotateSelectedDie(-1) },
          { label: "Level +", kind: "upgrade", onClick: () => rotateSelectedDie(1) },
        ],
        right: [{ label: "To Exile", kind: "spell", onClick: () => moveSelectedBoardDieToExile(owner) }],
        bottom: [{ label: "Turn 90°", kind: "upgrade", onClick: () => rotateSelectedDieVisual(90) }],
        left: [{ label: "To Reserve", kind: "spell", onClick: () => moveSelectedBoardDieToReserve(owner) }],
      },
      center: { label: "Move", onClick: () => { state.ringDismissed = true; renderManual(); } },
      onCancel: () => clearSelection(),
    });
  }

  window.GameUI = { SET_COLORS, SET_NAMES, setColor, playerName, refreshBars, layout, renderHint, renderManual, isLandscape };
})();
