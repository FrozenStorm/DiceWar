// Radial action menu ("pie menu") around a die on the board.
//
//   Ring.show({
//     square: { row, col },            // board field the ring belongs to
//     items: { top: [], right: [], bottom: [], left: [] },
//     dieImg: "img/RoX/3.png",          // shown in the middle (optional)
//     dieRotation: 0,                   // degrees, for the image in the middle
//     center: { label, onClick } | null, // tap on the middle (e.g. KoS "Turn")
//     flip: false,                      // turn the ring by 180 degrees (player 2 in a duel)
//     spellColor: "#00878c",
//     onCancel: () => {},               // tap outside the ring
//   });
//   item = { label, sub?, kind: "upgrade" | "move" | "spell" | "arrow" | "back", onClick, arrowDeg? }
//
// Each side of the ring holds the items listed for it; several items share the
// quarter. An empty side is drawn greyed out. Classic script (window.Ring).

(function () {
  const NS = "http://www.w3.org/2000/svg";
  const SIDES = { top: -90, right: 0, bottom: 90, left: 180 };
  const COLORS = { upgrade: "#56656f", move: "#56656f", arrow: "#56656f", back: "#8a7d6c" };
  let current = null;

  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };

  const pt = (cx, cy, rad, deg) => [cx + rad * Math.cos((deg * Math.PI) / 180), cy + rad * Math.sin((deg * Math.PI) / 180)];

  function sector(cx, cy, R, r, a0, a1, gap) {
    const go = (gap / R) * (180 / Math.PI);
    const gi = (gap / r) * (180 / Math.PI);
    const [x1, y1] = pt(cx, cy, R, a0 + go);
    const [x2, y2] = pt(cx, cy, R, a1 - go);
    const [x3, y3] = pt(cx, cy, r, a1 - gi);
    const [x4, y4] = pt(cx, cy, r, a0 + gi);
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`;
  }

  /** "Voodoo: move (3 TP)" -> { main: "Voodoo", sub: "move (3 TP)" } */
  function splitLabel(label, sub) {
    if (sub) return { main: label, sub };
    let m = label.match(/^([^:]+):\s*(.+)$/);
    if (m) return { main: m[1], sub: m[2] };
    m = label.match(/^(.+?)\s*\((.+)\)$/);
    if (m) return { main: m[1], sub: m[2] };
    return { main: label, sub: "" };
  }

  function wrap(text, maxChars) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      if (line && (line + " " + w).length > maxChars) { lines.push(line); line = w; }
      else line = line ? line + " " + w : w;
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Width of horizontal text that fits into a sector at its middle. */
  function labelWidth(midDeg, spanDeg, rMid, thickness) {
    const chord = 2 * rMid * Math.sin(((Math.min(spanDeg, 90) / 2) * Math.PI) / 180);
    const a = (midDeg * Math.PI) / 180;
    return Math.abs(Math.sin(a)) * chord * 0.9 + Math.abs(Math.cos(a)) * thickness * 0.92;
  }

  function drawLabel(g, x, y, item, width, size) {
    const { main, sub } = splitLabel(item.label, item.sub);
    const text = main.toUpperCase();
    let font = size;
    const fits = (f) => {
      const chars = Math.max(3, Math.floor(width / (f * 0.74)));
      const lines = wrap(text, chars);
      return { lines, ok: lines.length <= 3 && lines.every((l) => l.length <= chars) };
    };
    let res = fits(font);
    while (!res.ok && font > 8) { font -= 1; res = fits(font); }
    const lines = res.lines;
    const subFont = Math.max(9, Math.min(font, 12));
    const subLines = sub ? wrap(sub, Math.max(5, Math.floor(width / (subFont * 0.48)))) : [];
    const total = lines.length * font * 1.08 + subLines.length * subFont * 1.1;
    let yy = y - total / 2 + font * 0.85;
    const fill = item.kind === "disabled" ? "#5c5245" : "#f4eedf";
    for (const l of lines) {
      const t = el("text", { x, y: yy, "text-anchor": "middle", "font-family": "Cinzel, Georgia, serif", "font-weight": 700, "font-size": font, fill }, g);
      t.textContent = l;
      yy += font * 1.08;
    }
    for (const l of subLines) {
      const t = el("text", { x, y: yy + 1, "text-anchor": "middle", "font-family": "Crimson Text, Georgia, serif", "font-style": "italic", "font-size": subFont, fill: "#e2dccd" }, g);
      t.textContent = l;
      yy += subFont * 1.1;
    }
  }

  function drawArrow(g, x, y, deg, size) {
    const s = size;
    const a = el("path", {
      d: `M0 ${-s} L${s * 0.8} ${s * 0.1} L${s * 0.3} ${s * 0.1} L${s * 0.3} ${s * 0.8} L${-s * 0.3} ${s * 0.8} L${-s * 0.3} ${s * 0.1} L${-s * 0.8} ${s * 0.1} Z`,
      fill: "#f4eedf", stroke: "#1e1a16", "stroke-width": 1.5,
      transform: `translate(${x} ${y}) rotate(${deg})`,
    }, g);
    a.style.pointerEvents = "none";
  }

  function render() {
    const layer = document.getElementById("ring-layer");
    const svg = document.getElementById("ring-svg");
    const backdrop = document.getElementById("ring-backdrop");
    const area = document.getElementById("board-area");
    const board = document.getElementById("board");
    if (!current || !layer) return;
    const o = current;
    const cellNode = board.children[o.square.row * 7 + o.square.col];
    if (!cellNode) return;
    const ar = area.getBoundingClientRect();
    const cr = cellNode.getBoundingClientRect();
    const br = board.getBoundingClientRect();
    const cell = cr.width;

    layer.classList.add("open");
    Object.assign(backdrop.style, { left: `${br.left - ar.left}px`, top: `${br.top - ar.top}px`, width: `${br.width}px`, height: `${br.height}px` });

    const R = Math.min(cell * 2.05, ar.width / 2 - 4, ar.height / 2 - 4);
    const r = Math.max(R * 0.34, 24);
    const pad = 4;
    let cx = cr.left - ar.left + cell / 2;
    let cy = cr.top - ar.top + cell / 2;
    cx = Math.min(Math.max(cx, R + pad), ar.width - R - pad);
    cy = Math.min(Math.max(cy, R + pad), ar.height - R - pad);

    const size = 2 * (R + pad);
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    Object.assign(svg.style, { left: `${cx - size / 2}px`, top: `${cy - size / 2}px` });
    svg.innerHTML = "";
    const c = size / 2;
    const root = el("g", o.flip ? { transform: `rotate(180 ${c} ${c})` } : {}, svg);
    const fontSize = Math.max(10, Math.min(15, R * 0.12));

    for (const [side, mid] of Object.entries(SIDES)) {
      const list = (o.items[side] || []).filter(Boolean);
      const entries = list.length ? list : [{ label: "", kind: "disabled" }];
      const span = 90 / entries.length;
      entries.forEach((item, i) => {
        const a0 = mid - 45 + i * span;
        const a1 = a0 + span;
        const g = el("g", { class: "seg" + (item.kind === "disabled" ? " disabled" : "") }, root);
        const fill = item.kind === "disabled" ? "#cfc5ae"
          : item.kind === "spell" ? (o.spellColor || "#17918f")
          : COLORS[item.kind] || "#56656f";
        const p = el("path", { d: sector(c, c, R, r, a0, a1, 2.5), fill }, g);
        if (item.kind === "disabled") p.setAttribute("opacity", "0.75");
        const [lx, ly] = pt(c, c, (R + r) / 2, (a0 + a1) / 2);
        if (item.kind === "arrow") drawArrow(g, lx, ly, item.arrowDeg ?? (a0 + a1) / 2 + 90, Math.min(R * 0.16, 18));
        else if (item.label) drawLabel(g, lx, ly, item, labelWidth((a0 + a1) / 2, span, (R + r) / 2, R - r), entries.length > 1 ? fontSize - 1 : fontSize);
        if (item.kind !== "disabled" && item.onClick) {
          g.setAttribute("tabindex", "0");
          g.setAttribute("role", "button");
          g.setAttribute("aria-label", item.ariaLabel || [item.label, item.sub].filter(Boolean).join(" "));
          const fire = (e) => { e.stopPropagation(); item.onClick(); };
          g.addEventListener("click", fire);
          g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") fire(e); });
        }
      });
    }

    // Middle: the die itself (a tap there may turn it, KoS).
    const mid = el("g", { class: "seg" }, root);
    el("circle", { cx: c, cy: c, r: r - 3, fill: "#e8dfca", stroke: "#1e1a16", "stroke-width": 2 }, mid);
    if (o.dieImg) {
      const s = (r - 3) * 1.25;
      const img = el("image", { href: o.dieImg, x: c - s / 2, y: c - s / 2, width: s, height: s, preserveAspectRatio: "xMidYMid meet" }, mid);
      const rot = (o.dieRotation || 0) + (o.flip ? 180 : 0);
      if (rot) img.setAttribute("transform", `rotate(${rot} ${c} ${c})`);
      img.style.pointerEvents = "none";
    } else if (o.dieText) {
      const t = el("text", { x: c, y: c + r * 0.3, "text-anchor": "middle", "font-family": "Cinzel, Georgia, serif", "font-weight": 700, "font-size": r * 0.9, fill: "#2c241c" }, mid);
      t.textContent = o.dieText;
    }
    if (o.center) {
      // circular arrow badge: "tap the die to turn it"
      const br2 = r * 0.42;
      const bx = c + (r - 3) * 0.62, by = c - (r - 3) * 0.62;
      el("circle", { cx: bx, cy: by, r: br2, fill: "#56656f", stroke: "#1e1a16", "stroke-width": 1.5 }, mid);
      el("path", {
        d: `M${bx - br2 * 0.5} ${by + br2 * 0.15} A${br2 * 0.55} ${br2 * 0.55} 0 1 1 ${bx + br2 * 0.1} ${by + br2 * 0.55}`,
        fill: "none", stroke: "#f4eedf", "stroke-width": 2, "stroke-linecap": "round",
      }, mid);
      el("path", { d: `M${bx - br2 * 0.75} ${by - br2 * 0.1} L${bx - br2 * 0.5} ${by + br2 * 0.35} L${bx - br2 * 0.1} ${by + br2 * 0.05}`, fill: "none", stroke: "#f4eedf", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }, mid);
      mid.setAttribute("tabindex", "0");
      mid.setAttribute("role", "button");
      mid.setAttribute("aria-label", o.center.label || "Turn");
      const fire = (e) => { e.stopPropagation(); o.center.onClick(); };
      mid.addEventListener("click", fire);
      mid.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") fire(e); });
    } else {
      mid.style.pointerEvents = "none";
    }
  }

  function show(opts) {
    current = opts;
    render();
  }

  function hide() {
    current = null;
    const layer = document.getElementById("ring-layer");
    if (layer) layer.classList.remove("open");
    const svg = document.getElementById("ring-svg");
    if (svg) svg.innerHTML = "";
  }

  function init() {
    const layer = document.getElementById("ring-layer");
    if (!layer) return;
    layer.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest(".seg:not(.disabled)")) return;
      if (current && current.onCancel) current.onCancel();
    });
    window.addEventListener("resize", () => { if (current) render(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.Ring = { show, hide, refresh: () => { if (current) render(); }, get open() { return !!current; } };
})();
