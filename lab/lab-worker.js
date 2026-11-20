// AI Lab: plays one game per message in a background thread.
import { playGame } from "./runner.js";

self.onmessage = (e) => {
  const { game } = e.data;
  try {
    const onProgress = (pr) => self.postMessage({ id: game.id, progress: pr });
    const { row, replay } = playGame(game, { onProgress });
    self.postMessage({ id: game.id, row, replay });
  } catch (err) {
    self.postMessage({ id: game.id, error: String(err && err.message ? err.message : err) });
  }
};
