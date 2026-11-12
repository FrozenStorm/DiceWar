// AI Lab: plays AI-vs-AI games without any UI. Used by the lab worker in the
// browser and by the tests in Node. Everything is deterministic: the same game
// config (incl. seed) always gives the same game.

import { createGame, applyAction, actor, totalVP, DEFAULT_MAX_TURNS } from "../engine/core.js";
import { chooseAction, chooseSetup, NODE_BUDGETS } from "../ai/ai.js";
import { mulberry32, deriveSeed } from "../ai/rng.js";

export const LAB_SETS = ["RoX", "BoD", "LoD", "RoM", "KoS", "DoA"];
export const LAB_LOCATIONS = ["", "craters", "oracle", "ruins", "camp", "knoll", "river"];
export const LAB_LEVELS = ["easy", "medium", "hard"];

/** Safety net against endless loops inside a turn (the engine's turn limit ends normal games). */
const MAX_ACTIONS = 20_000;

/**
 * Expand a lab configuration into the list of single games.
 * @param {object} cfg
 * @param {Array<[string, string]>} cfg.pairs [set of player 1, set of player 2]
 * @param {string} cfg.level1 AI level of player 1
 * @param {string} cfg.level2 AI level of player 2
 * @param {string[]} cfg.locations landscapes ("" = none)
 * @param {number} cfg.gamesPerCombo games per pairing and landscape
 * @param {"alternate"|1|2} cfg.startingPlayer
 * @param {number|"random"} cfg.riverCol column of the River (0..6) or "random"
 * @param {number} cfg.seed base seed
 * @param {number} [cfg.maxTurns]
 * @param {number} [cfg.budget] factor on the node budgets of the levels (1 = normal)
 */
export function expandGames(cfg) {
  const games = [];
  for (const [set1, set2] of cfg.pairs) {
    for (const location of cfg.locations) {
      for (let n = 0; n < cfg.gamesPerCombo; n++) {
        const index = games.length;
        const seed = deriveSeed(cfg.seed, index);
        const startingPlayer = cfg.startingPlayer === "alternate" ? (index % 2) + 1 : Number(cfg.startingPlayer);
        const riverCol = cfg.riverCol === "random" ? mulberry32(deriveSeed(seed, 7))() * 7 | 0 : Number(cfg.riverCol);
        games.push({
          id: index + 1,
          seed,
          set1, set2,
          level1: cfg.level1, level2: cfg.level2,
          location,
          riverCol: location === "river" ? riverCol : null,
          startingPlayer,
          maxTurns: cfg.maxTurns || DEFAULT_MAX_TURNS,
          budget: cfg.budget || 1,
        });
      }
    }
  }
  return games;
}

/** Node budget of a level, scaled by the lab's budget factor. */
export const nodeBudget = (level, factor = 1) => Math.max(1000, Math.round(NODE_BUDGETS[level] * factor));

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * Play one game. Returns the result row (flat, for the statistics) and the
 * replay (final state plus the complete list of actions).
 */
export function playGame(game, { onProgress } = {}) {
  const random = mulberry32(game.seed);
  let s = createGame({
    set1: game.set1,
    set2: game.set2,
    startingPlayer: game.startingPlayer,
    locations: game.location ? [game.location] : [],
    maxTurns: game.maxTurns,
    riverCol: game.riverCol ?? 1,
  });
  const levels = { 1: game.level1, 2: game.level2 };
  const per = {
    1: { searches: 0, depth: 0, nodes: 0, ms: 0, abilities: {} },
    2: { searches: 0, depth: 0, nodes: 0, ms: 0, abilities: {} },
  };
  const actions = [];
  const t0 = now();

  while (s.phase !== "over") {
    if (actions.length >= MAX_ACTIONS) throw new Error(`game ${game.id}: more than ${MAX_ACTIONS} actions`);
    const p = s.phase === "setup" ? s.current : actor(s);
    const level = levels[p];
    let action;
    if (s.phase === "setup") {
      action = chooseSetup(s, { level, random });
    } else {
      const t = now();
      const r = chooseAction(s, { level, random, maxNodes: nodeBudget(level, game.budget) });
      action = r.action;
      if (r.nodes) {
        per[p].searches++;
        per[p].depth += r.depth;
        per[p].nodes += r.nodes;
        per[p].ms += now() - t;
      }
      const ability = action.ability || (action.sub && action.sub.ability);
      if (ability && action.type !== "choice") per[p].abilities[ability] = (per[p].abilities[ability] || 0) + 1;
    }
    actions.push(action);
    s = applyAction(s, action);
    if (onProgress && actions.length % 5 === 0) onProgress({ turn: s.turnNumber, actions: actions.length });
  }

  const winner = s.result.winner;
  const row = {
    id: game.id,
    seed: game.seed,
    set1: game.set1,
    set2: game.set2,
    level1: game.level1,
    level2: game.level2,
    location: game.location || "none",
    riverCol: game.riverCol ?? "",
    startingPlayer: game.startingPlayer,
    winner,
    winnerSet: winner === 1 ? game.set1 : winner === 2 ? game.set2 : "",
    startingPlayerWon: winner === 0 ? "" : winner === game.startingPlayer ? 1 : 0,
    reason: s.result.reason,
    turns: s.turnNumber,
    actions: actions.length,
    ms: Math.round(now() - t0),
  };
  for (const p of [1, 2]) {
    const pl = s.players[p];
    row[`vp${p}`] = totalVP(s, p);
    row[`tp${p}`] = pl.tp;
    row[`board${p}`] = s.board.filter((d) => d && d.owner === p).length;
    row[`reserve${p}`] = pl.reserve;
    row[`exile${p}`] = pl.exile;
    const st = per[p];
    row[`depth${p}`] = st.searches ? round1(st.depth / st.searches) : "";
    row[`msPerMove${p}`] = st.searches ? Math.round(st.ms / st.searches) : "";
    row[`abilities${p}`] = st.abilities;
  }
  s.events = [];
  const replay = {
    version: 1,
    snapshot: { rulesGame: s },
    lab: { game, result: row, actions },
  };
  return { row, replay };
}

const round1 = (x) => Math.round(x * 10) / 10;

/** Recompute a game from its replay (used to check that replays are exact). */
export function replayActions(game, actions) {
  let s = createGame({
    set1: game.set1,
    set2: game.set2,
    startingPlayer: game.startingPlayer,
    locations: game.location ? [game.location] : [],
    maxTurns: game.maxTurns,
    riverCol: game.riverCol ?? 1,
  });
  for (const a of actions) s = applyAction(s, a);
  return s;
}
