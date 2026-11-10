import { createGame } from "../engine/core.js";
import { sq, defaultDir } from "../engine/board.js";

/**
 * Build a game in the war phase with dice placed directly (no setup).
 * Board notation: rows top to bottom as strings of 7 chars:
 *   "." empty, "1".."6" player 1 die, "a".."f" player 2 die of level 1..6.
 */
export function position(rows, { set1 = "RoX", set2 = "RoX", current = 1, locations = [], players = {} } = {}) {
  const s = createGame({ set1, set2, startingPlayer: 1, locations });
  s.phase = "war";
  s.current = current;
  s.turnNumber = 1;
  rows.forEach((line, r) => {
    [...line.replace(/\s/g, "")].forEach((ch, c) => {
      if (ch === ".") return;
      const owner = /[1-6]/.test(ch) ? 1 : 2;
      const level = owner === 1 ? Number(ch) : ch.charCodeAt(0) - 96;
      s.players[owner].reserve--;
      s.board[sq(r, c)] = { id: s.nextDieId++, owner, level, dir: defaultDir(owner) };
    });
  });
  for (const p of [1, 2]) Object.assign(s.players[p], players[p] || {});
  return s;
}

export const at = (name) => {
  // "a1" = bottom-left from player 1's view, "g7" = top-right
  const c = name.charCodeAt(0) - 97;
  const r = 7 - Number(name.slice(1));
  return sq(r, c);
};

export const EMPTY = [".......", ".......", ".......", ".......", ".......", ".......", "......."];
