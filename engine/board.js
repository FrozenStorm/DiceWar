// Board geometry for the 7x7 Warlands.
// Squares are numbered 0..48 (row * 7 + col). Row 0 is the top row (player 2's
// Supply Zone), row 6 the bottom row (player 1's Supply Zone).

export const SIZE = 7;
export const SQUARES = SIZE * SIZE;

export const sq = (r, c) => r * SIZE + c;
export const rowOf = (s) => Math.floor(s / SIZE);
export const colOf = (s) => s % SIZE;
export const onBoard = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

// Directions: 0 = north (up), 1 = east, 2 = south, 3 = west.
export const ORTHO = [[-1, 0], [0, 1], [1, 0], [0, -1]];
export const DIAG = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
export const SURROUND = [...ORTHO, ...DIAG];

function neighbours(s, deltas) {
  const r = rowOf(s), c = colOf(s);
  const out = [];
  for (const [dr, dc] of deltas) {
    if (onBoard(r + dr, c + dc)) out.push(sq(r + dr, c + dc));
  }
  return out;
}

export const adjacent = (s) => neighbours(s, ORTHO);
export const diagonal = (s) => neighbours(s, DIAG);
export const surrounding = (s) => neighbours(s, SURROUND);

/** Square one step from s in direction d (0..3), or -1 if off the board. */
export function step(s, d) {
  const r = rowOf(s) + ORTHO[d][0], c = colOf(s) + ORTHO[d][1];
  return onBoard(r, c) ? sq(r, c) : -1;
}

export const isAdjacent = (a, b) =>
  Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;
export const isDiagonal = (a, b) =>
  Math.abs(rowOf(a) - rowOf(b)) === 1 && Math.abs(colOf(a) - colOf(b)) === 1;

export const opponent = (p) => (p === 1 ? 2 : 1);

/** Back row of a player (their Supply Zone). */
export const supplyRow = (p) => (p === 1 ? SIZE - 1 : 0);

/** A player's own zone: the 3 rows on their side. */
export function inOwnZone(p, s) {
  const r = rowOf(s);
  return p === 1 ? r >= SIZE - 3 : r <= 2;
}

/** Field Bonus a player receives for defeating a creature on square s. */
export function fieldBonus(p, s) {
  const r = rowOf(s);
  if (p === 1) return r <= 2 ? 3 - r : 0;
  return r >= SIZE - 3 ? r - (SIZE - 4) : 0;
}

/** Default facing of a player's dice (towards the opponent). */
export const defaultDir = (p) => (p === 1 ? 0 : 2);

/** Human-readable square name, e.g. "c4" (columns a..g, rows 1..7 from player 1's side). */
export const squareName = (s) => "abcdefg"[colOf(s)] + (SIZE - rowOf(s));
