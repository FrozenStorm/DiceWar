// Developer tool: multi-core expert against another level, games one after
// the other (the search itself uses the cores).
//   node tools/mcbench.mjs [--threads 4] [--t 1000] [--b expert] [--tb 1000] [--games 12] [--pairs RoX-RoX,...]
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { createGame, applyAction, actor } from "../engine/core.js";
import { chooseAction, chooseSetup, LEVELS } from "../ai/ai.js";
import { createPool, createThreadHandler, chooseExpertActionParallel } from "../ai/expert-parallel.js";
import { mulberry32, deriveSeed } from "../ai/rng.js";

if (!isMainThread) {
  const handle = createThreadHandler();
  parentPort.on("message", (m) => parentPort.postMessage(handle(m)));
} else {
  const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? def : process.argv[i + 1]; };
  const threads = Number(arg("threads", 4)), t = Number(arg("t", 1000)), tb = Number(arg("tb", t));
  const B = arg("b", "expert"), games = Number(arg("games", 12));
  const pairs = arg("pairs", "RoX-RoX,BoD-BoD,LoD-LoD,RoM-RoM,KoS-KoS,DoA-DoA").split(",").map((p) => p.split("-"));
  const workers = Array.from({ length: threads }, () => new Worker(new URL(import.meta.url)));
  const pool = createPool(workers, (w, h) => w.on("message", h));
  const cfg = { ...LEVELS.expert, timeMs: t };
  let w = 0, d = 0, l = 0, depthA = 0, nA = 0, depthB = 0, nB = 0;
  for (let g = 0; g < games; g++) {
    const [setA, setB] = pairs[(g / 2 | 0) % pairs.length];
    const aPlayer = (g % 2) + 1;
    const random = mulberry32(deriveSeed(5, g / 2 | 0));
    let s = createGame({ set1: aPlayer === 1 ? setA : setB, set2: aPlayer === 1 ? setB : setA, startingPlayer: ((g / 2 | 0) % 2) + 1, maxTurns: 160 });
    while (s.phase !== "over") {
      const p = s.phase === "setup" ? s.current : actor(s);
      let action;
      if (s.phase === "setup") action = chooseSetup(s, { level: "expert", random });
      else if (p === aPlayer) { const r = await chooseExpertActionParallel(s, cfg, random, pool); action = r.action; if (r.nodes) { depthA += r.depth; nA++; } }
      else { const r = chooseAction(s, { level: B, random, overrides: { timeMs: tb } }); action = r.action; if (r.nodes) { depthB += r.depth; nB++; } }
      s = applyAction(s, action);
    }
    const win = s.result.winner;
    if (win === 0) d++; else if (win === aPlayer) w++; else l++;
    console.log(`${g + 1}/${games} ${setA}-${setB} multi-core as player ${aPlayer}: winner ${win} (${s.result.reason}, ${s.turnNumber} turns)  total ${w}-${d}-${l}  depth ${(depthA / nA).toFixed(2)} vs ${(depthB / nB).toFixed(2)}`);
  }
  console.log(`RESULT multi-core x${threads} @${t}ms vs ${B} @${tb}ms: ${w} wins, ${d} draws, ${l} losses (${Math.round((w + d / 2) / games * 100)} %)`);
  for (const x of workers) x.terminate();
}
