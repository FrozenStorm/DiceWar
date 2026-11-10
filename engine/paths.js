// Maps every action to a "click path" for the user interface: a list of
// tokens, where a number is a board square to click and a string is a button.
// The UI narrows the legal actions down token by token, so every legal action
// must have a unique path and no complete path may be the prefix of another.

import { getSet } from "./sets/index.js";

const setOfId = (id) => getSet(id.split(".")[0]);

export function actionPath(a) {
  switch (a.type) {
    case "declareEndOfWar": return ["Declare End of War"];
    case "upgrade": return [a.at, "Upgrade"];
    case "choice": return setOfId(a.kind).actionPath(a);
    default:
      if (a.ability) return setOfId(a.ability).actionPath(a);
      return [a.from, a.to]; // move, attack
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
