// Animations for rules mode: replays the events of one engine action
// (engine/core.js emit()) on top of the already rendered new position.
//
//   move           the die slides along its path to the new field
//   remove         a ghost of the old die flies into the Reserve or Exile
//   place          the new die comes out of the Reserve
//   level          the die spins while its Power Level changes
//   reserveToExile a ghost die flies from the Reserve to the Exile (spell costs)
//   turn           the die turns to its new alignment (KoS), before or after it moves

const SPEEDS = { normal: 1, fast: 0.5, off: 0 };
const STORAGE_KEY = "dicewar-animation-speed";

export function getSpeed() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && v in SPEEDS) return v;
  } catch (e) { /* storage unavailable */ }
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduced ? "off" : "normal";
}

export function setSpeed(v) {
  try { localStorage.setItem(STORAGE_KEY, v); } catch (e) { /* storage unavailable */ }
}

const cellEl = (at) => document.querySelectorAll("#board .cell")[at];
const dieEl = (at) => { const c = cellEl(at); return c && c.querySelector(".die"); };
const boxEl = (player, dest) => document.getElementById(`p${player}-${dest}`);

function center(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

/** Before the new position is rendered: remember every die element and where it was. */
export function captureDice() {
  const out = new Map();
  document.querySelectorAll("#board .cell").forEach((cell, at) => {
    const die = cell.querySelector(".die");
    if (die) out.set(at, { node: die.cloneNode(true), rect: die.getBoundingClientRect() });
  });
  return out;
}

function ghostFrom(before, at, event) {
  const old = before.get(at);
  let node, rect;
  if (old) {
    node = old.node.cloneNode(true);
    rect = old.rect;
  } else {
    // Die that did not exist before this action (e.g. moved there and removed in the same turn).
    node = document.createElement("div");
    node.className = `die ${event.owner === 1 ? "p1" : "p2"}`;
    node.textContent = event.level;
    rect = cellEl(at).getBoundingClientRect();
  }
  Object.assign(node.style, {
    position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`,
    width: `${rect.width}px`, height: `${rect.height}px`, margin: "0",
    zIndex: 1000, pointerEvents: "none",
  });
  document.body.appendChild(node);
  return { node, rect };
}

function flyGhost(node, rect, target, ms) {
  const t = center(target);
  const dx = t.x - (rect.left + rect.width / 2);
  const dy = t.y - (rect.top + rect.height / 2);
  const base = node.style.transform || "";
  const anim = node.animate([
    { transform: `translate(0, 0) scale(1) ${base}`, opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(0.8) rotate(90deg) ${base}`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.35) rotate(180deg) ${base}`, opacity: 0.2 },
  ], { duration: ms, easing: "ease-in-out", fill: "forwards" });
  return anim.finished.catch(() => {}).then(() => node.remove());
}

function animateMove(ev, ms) {
  const path = ev.path;
  const to = path[path.length - 1];
  const die = dieEl(to);
  if (!die) return Promise.resolve();
  const end = center(cellEl(to));
  const base = die.style.transform || "";
  const frames = path.map((at, i) => {
    const c = center(cellEl(at));
    return { transform: `translate(${c.x - end.x}px, ${c.y - end.y}px) ${base}`, offset: i / (path.length - 1) };
  });
  // Lift the die a little while it travels.
  frames.forEach((f, i) => { if (i > 0 && i < frames.length - 1) f.transform += " scale(1.08)"; });
  die.style.zIndex = 5;
  const anim = die.animate(frames, { duration: ms * Math.max(1, path.length - 1), easing: "ease-in-out" });
  return anim.finished.catch(() => {}).then(() => { die.style.zIndex = ""; });
}

function animatePlace(ev, ms) {
  const die = dieEl(ev.at);
  const box = boxEl(ev.owner, "reserve");
  if (!die || !box) return Promise.resolve();
  const from = center(box), to = center(cellEl(ev.at));
  const base = die.style.transform || "";
  return die.animate([
    { transform: `translate(${from.x - to.x}px, ${from.y - to.y}px) scale(0.4) ${base}`, opacity: 0.3 },
    { transform: `translate(0, 0) scale(1) ${base}`, opacity: 1 },
  ], { duration: ms, easing: "ease-out" }).finished.catch(() => {});
}

function animateLevel(ev, ms) {
  const die = dieEl(ev.at);
  if (!die) return Promise.resolve();
  const base = die.style.transform || "";
  return die.animate([
    { transform: `rotateY(0deg) scale(1) ${base}` },
    { transform: `rotateY(180deg) scale(1.2) ${base}`, offset: 0.5 },
    { transform: `rotateY(360deg) scale(1) ${base}` },
  ], { duration: ms, easing: "ease-in-out" }).finished.catch(() => {});
}

function animateReserveToExile(ev, ms) {
  const from = boxEl(ev.player, "reserve"), to = boxEl(ev.player, "exile");
  if (!from || !to) return Promise.resolve();
  const r = from.getBoundingClientRect();
  const size = 28;
  const rect = { left: r.left + r.width / 2 - size / 2, top: r.top + r.height / 2 - size / 2, width: size, height: size };
  const node = document.createElement("div");
  node.className = `die ${ev.player === 1 ? "p1" : "p2"}`;
  Object.assign(node.style, {
    position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${size}px`, height: `${size}px`,
    zIndex: 1000, pointerEvents: "none",
    background: ev.player === 1 ? "var(--p1-color)" : "var(--p2-color)", borderRadius: "6px",
  });
  document.body.appendChild(node);
  return flyGhost(node, rect, to, ms);
}

/** Element that carries the alignment rotation (the image of a die, or the die). */
const rotEl = (die) => die.querySelector("img") || die;

function animateTurn(el, fromDeg, toDeg, ms) {
  el.style.transform = `rotate(${toDeg}deg)`;
  return el.animate([
    { transform: `rotate(${fromDeg}deg)` },
    { transform: `rotate(${toDeg}deg)` },
  ], { duration: ms, easing: "ease-in-out" }).finished.catch(() => {});
}

/** Square where the die on `at` stands after the remaining events. */
function finalSquare(events, from, at) {
  let cur = at;
  for (let j = from; j < events.length; j++) {
    const ev = events[j];
    if (ev.t === "move" && ev.path[0] === cur) cur = ev.path[ev.path.length - 1];
  }
  return cur;
}

/**
 * Play the events of one action. `before` comes from captureDice() taken
 * before the new position was rendered. Resolves when everything is done.
 */
export async function play(events, before, { slow = false, alignDeg = null } = {}) {
  const factor = SPEEDS[getSpeed()] * (slow ? 1.3 : 1);
  if (!factor || !events || !events.length) return;
  const ms = (base) => Math.round(base * factor);
  // Hide dice that are still to arrive, so the final position does not give away the result.
  const hidden = [];
  for (const ev of events) {
    if (ev.t === "place") {
      const d = dieEl(ev.at);
      if (d) { d.style.visibility = "hidden"; hidden.push(d); }
    }
  }
  // Turning dice (KoS) show their old alignment until they turn: before the
  // move for a turn before the action, at the end for a turn afterwards.
  const turning = new Map(); // event index -> { el, deg }
  const restore = new Map(); // element -> rendered transform
  if (alignDeg) {
    const shown = new Map(); // element -> currently shown rotation (degrees)
    events.forEach((ev, i) => {
      if (ev.t !== "turn") return;
      const die = dieEl(finalSquare(events, i + 1, ev.at));
      if (!die) return;
      const el = rotEl(die);
      if (!restore.has(el)) restore.set(el, el.style.transform);
      if (!shown.has(el)) {
        shown.set(el, alignDeg(ev.owner, ev.from));
        el.style.transform = `rotate(${shown.get(el)}deg)`;
      }
      const fromDeg = shown.get(el);
      let delta = ((alignDeg(ev.owner, ev.to) - fromDeg) % 360 + 360) % 360;
      if (delta > 180) delta -= 360; // the short way round
      shown.set(el, fromDeg + delta);
      turning.set(i, { el, fromDeg, toDeg: fromDeg + delta });
    });
  }
  // Dice that leave the board stay visible where they stood until it is their turn to go.
  const ghosts = new Map();
  for (const ev of events) {
    if (ev.t === "remove" && before.has(ev.at) && !ghosts.has(ev.at)) ghosts.set(ev.at, ghostFrom(before, ev.at, ev));
  }
  try {
    for (const [i, ev] of events.entries()) {
      switch (ev.t) {
        case "turn": {
          const tr = turning.get(i);
          if (tr) await animateTurn(tr.el, tr.fromDeg, tr.toDeg, ms(300));
          break;
        }
        case "move": await animateMove(ev, ms(260)); break;
        case "remove": {
          const box = boxEl(ev.owner, ev.dest);
          let g = ghosts.get(ev.at);
          if (g) ghosts.delete(ev.at);
          else g = ghostFrom(new Map(), ev.at, ev);
          if (!box) { g.node.remove(); break; }
          await flyGhost(g.node, g.rect, box, ms(450));
          break;
        }
        case "place": {
          const d = dieEl(ev.at);
          if (d) d.style.visibility = "";
          await animatePlace(ev, ms(380));
          break;
        }
        case "level": await animateLevel(ev, ms(420)); break;
        case "reserveToExile": await animateReserveToExile(ev, ms(400)); break;
        default: break;
      }
    }
  } finally {
    for (const d of hidden) d.style.visibility = "";
    for (const g of ghosts.values()) g.node.remove();
    for (const [el, tf] of restore) el.style.transform = tf;
  }
}
