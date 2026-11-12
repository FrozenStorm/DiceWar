// Small seeded random number generators, so AI games can be repeated exactly.

/** Mulberry32: fast 32-bit PRNG. Returns a function like Math.random. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an independent 32-bit seed from a base seed and further numbers. */
export function deriveSeed(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    let x = p >>> 0;
    for (let i = 0; i < 4; i++) {
      h ^= x & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
      x >>>= 8;
    }
  }
  return h >>> 0;
}
