// Starting lineups of the AI (setup phase).

import { applyAction, setupLevelCombinations } from "../engine/core.js";
import { defaultDir } from "../engine/board.js";
import { getSet } from "../engine/sets/index.js";
import { evaluate } from "./eval.js";

const PREFERRED_LINEUPS = [[6, 4], [5, 3, 2], [6, 2, 2], [4, 3, 2, 1], [5, 4, 1], [3, 3, 2, 2]];

/** Choose a starting lineup (Power Level 10 in the Supply Zone). */
export function chooseSetup(s, opts = {}) {
  const action = chooseLineup(s, opts);
  if (s.locations.includes("camp")) {
    // The Camp: on a free field of the Supply Zone, preferably at the side.
    const random = opts.random || Math.random;
    const used = new Set(action.placements.map((p) => p.col));
    const free = [0, 6, 1, 5, 2, 4, 3].filter((c) => !used.has(c));
    action.camp = free[Math.min(free.length - 1, Math.floor(random() * 2))];
  }
  // After the camp: the alignments are rated on the complete, valid lineup.
  if (s.players[s.current].set === "KoS") chooseAlignments(s, action);
  return action;
}

/** KoS: every die of the lineup gets an alignment (kept when upgraded). The
 *  AI tries the 4 alignments die by die and keeps the best evaluated one
 *  (facing the opponent on ties). */
function chooseAlignments(s, action) {
  const me = s.current;
  const forward = defaultDir(me);
  const order = [forward, 1, 3, (forward + 2) % 4];
  action.placements = action.placements.map((p) => ({ ...p, dir: forward }));
  for (const p of action.placements) {
    let best = forward, bestV = -Infinity;
    for (const dir of order) {
      p.dir = dir;
      const v = evaluate(applyAction(s, action), me);
      if (v > bestV + 1e-9) { bestV = v; best = dir; }
    }
    p.dir = best;
  }
}

function chooseLineup(s, opts) {
  const random = opts.random || Math.random;
  const book = getSet(s.players[s.current].set).aiBook;
  if (book && book.setups && opts.level !== "easy") {
    return { type: "setup", placements: book.setups[Math.floor(random() * book.setups.length)] };
  }
  const pool = opts.level === "easy" ? setupLevelCombinations().filter((c) => c.length <= 5) : PREFERRED_LINEUPS;
  const levels = [...pool[Math.floor(random() * pool.length)]];
  // Strongest creatures in the centre, spread out.
  const order = [3, 2, 4, 1, 5, 0, 6];
  const start = Math.floor(random() * 2);
  const cols = order.slice(start, start + levels.length);
  if (cols.length < levels.length) cols.push(...order.filter((c) => !cols.includes(c)).slice(0, levels.length - cols.length));
  levels.sort((a, b) => b - a);
  return { type: "setup", placements: levels.map((level, i) => ({ col: cols[i], level })) };
}

