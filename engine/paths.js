// Maps every action to a "click path" for the user interface: a list of
// tokens, where a number is a board square to click and a string is a button.
// The UI narrows the legal actions down token by token, so every legal action
// must have a unique path and no complete path may be the prefix of another.

import { getSet } from "./sets/index.js";

const setOfId = (id) => getSet(id.split(".")[0]);

export const FACE_LABELS = ["Face ↑", "Face →", "Face ↓", "Face ←"];

export function actionPath(a) {
  const base = basePath(a);
  // Alignment chosen with the action (KoS) is the last click.
  return a.face !== undefined ? [...base, FACE_LABELS[a.face]] : base;
}

function basePath(a) {
  if (a.ability) return setOfId(a.ability).actionPath(a);
  switch (a.type) {
    case "declareEndOfWar": return ["Declare End of War"];
    case "upgrade": return [a.at, "Upgrade"];
    case "choice":
      if (a.sub) return actionPath(a.sub); // additional action of a die
      return setOfId(a.kind).actionPath(a);
    default: return [a.from, a.to]; // move, attack
  }
}

/** Short instruction for a pending decision. */
export function pendingPrompt(pending) {
  const set = setOfId(pending.kind);
  return set.pendingPrompt ? set.pendingPrompt(pending) : "Make a choice.";
}

/** Readable name of an ability ID, e.g. "RoX.bearer.balance" -> "Balance". */
export function abilityName(id) {
  return id.split(".").pop().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}
