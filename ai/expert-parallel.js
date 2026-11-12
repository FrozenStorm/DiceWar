// Multi-core search of the "expert" AI level.
//
// The actions of the position to decide (the root) are handed out to several
// background threads. Each thread searches one action at a time with the
// normal expert search and keeps its own table of positions. The first action
// (the best one of the previous depth) is searched exactly; the others only
// have to show whether they beat the best value known so far, which is passed
// on to every new job. Threads cannot share memory on a plain static web
// site, so this is all the threads tell each other.

import { WIN } from "./eval.js";
import { expertRoot, createRootSearcher } from "./expert.js";

/** While the first action of a depth is still being searched, the other
 *  threads assume it will not lose more than this much against the last depth. */
const PROVISIONAL_MARGIN = 60;

// --- Thread side -------------------------------------------------------------

/** Message handler for a search thread: returns the reply to post back. */
export function createThreadHandler() {
  const searcher = createRootSearcher();
  return (msg) => {
    try {
      if (msg.type === "start") { searcher.start(msg.state, msg.cfg, msg.actions); return { id: msg.id, ok: true }; }
      return { id: msg.id, ...searcher.run(msg.index, msg.depth, msg.alpha, msg.deadline) };
    } catch (e) {
      return { id: msg.id, error: String(e && e.message ? e.message : e) };
    }
  };
}

// --- Coordinator side --------------------------------------------------------

/**
 * Wrap threads into a pool.
 * @param {object[]} workers objects with postMessage
 * @param {(worker, handler: (data) => void) => void} listen registers the message handler of a worker
 */
export function createPool(workers, listen) {
  let nextId = 0;
  const waiting = new Map();
  for (const w of workers) {
    listen(w, (data) => {
      const job = waiting.get(data.id);
      if (!job) return;
      waiting.delete(data.id);
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data);
    });
  }
  const call = (i, msg) => new Promise((resolve, reject) => {
    const id = ++nextId;
    waiting.set(id, { resolve, reject });
    workers[i].postMessage({ ...msg, id });
  });
  return {
    size: workers.length,
    call,
    /** Give up on all open jobs (e.g. a thread crashed). */
    fail(err) { for (const job of waiting.values()) job.reject(err); waiting.clear(); },
  };
}

/**
 * Choose an action with several threads. Same result shape as chooseAction.
 * @param {object} s engine state (war phase)
 * @param {object} cfg level settings (timeMs, maxDepth, ...)
 * @param {() => number} random
 * @param {object} pool from createPool
 */
export async function chooseExpertActionParallel(s, cfg, random, pool) {
  const start = expertRoot(s, cfg, random);
  if (start.result) return start.result;
  const { actions, values, share } = start;
  const began = Date.now();
  const budget = cfg.timeMs * share;
  const deadline = began + budget;
  await Promise.all(Array.from({ length: pool.size }, (_, w) => pool.call(w, { type: "start", state: s, cfg, actions })));

  let order = actions.map((_, i) => i);
  let best = 0, bestV = values[0], reached = 0, nodes = 0;

  for (let depth = 1; depth <= cfg.maxDepth; depth++) {
    const first = order[0];
    const provisional = depth >= 2 && Math.abs(bestV) < WIN / 2 ? bestV - PROVISIONAL_MARGIN : -Infinity;
    const queue = [...order];
    let failedLow = []; // actions that did not beat the value they were checked against
    let alpha = -Infinity, iterationBest = -1, firstDone = false, timedOut = false, running = 0;

    await new Promise((resolve, reject) => {
      const dispatch = (w) => {
        if (timedOut || !queue.length) {
          if (running === 0) resolve();
          return;
        }
        const index = queue.shift();
        const against = index === first ? null : firstDone ? alpha : Math.max(alpha, provisional);
        running++;
        pool.call(w, { type: "run", index, depth, alpha: against === -Infinity ? null : against, deadline }).then((res) => {
          running--;
          nodes += res.nodes;
          if (res.timeout) timedOut = true;
          else {
            if (index === first) firstDone = true;
            if (against === null || against === -Infinity || res.v > against) {
              if (res.v > alpha) { alpha = res.v; iterationBest = index; }
            } else failedLow.push({ index, against });
          }
          if (!timedOut && !queue.length && running === 0) {
            // The best value ended up lower than some actions were checked
            // against: those are looked at again.
            const again = failedLow.filter((f) => f.against > alpha);
            if (again.length) {
              failedLow = failedLow.filter((f) => f.against <= alpha);
              queue.push(...again.map((f) => f.index));
              for (let i = 0; i < pool.size; i++) dispatch(i);
              return;
            }
          }
          dispatch(w);
        }, reject);
      };
      for (let w = 0; w < pool.size; w++) dispatch(w);
    });

    if (timedOut) {
      // An unfinished depth still counts once the previous best action has
      // been searched again and another one turned out better.
      if (firstDone && iterationBest >= 0) { best = iterationBest; bestV = alpha; }
      break;
    }
    best = iterationBest; bestV = alpha; reached = depth;
    order = [best, ...order.filter((i) => i !== best)];
    if (Math.abs(bestV) >= WIN / 2) break; // forced result found
    if (Date.now() - began > budget * 0.6) break; // the next depth would not finish
  }
  return { action: actions[best], score: bestV, depth: reached, nodes, ties: 1, threads: pool.size };
}
