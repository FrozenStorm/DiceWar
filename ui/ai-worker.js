// Runs the AI search in a background thread so the board stays responsive.
import { chooseAction, chooseSetup } from "../ai/ai.js";

self.onmessage = (e) => {
  const { id, state, level } = e.data;
  try {
    const action = state.phase === "setup" ? chooseSetup(state, { level }) : chooseAction(state, { level }).action;
    self.postMessage({ id, action });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};
