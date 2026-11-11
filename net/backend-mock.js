// Test backend (index.html?backend=mock): the database lives in the Playwright
// test process, which provides window.__mockDb (see test/online.e2e.mjs).
export async function createBackend() {
  let uid = null;
  try { uid = localStorage.getItem("dicewar.mock.uid"); } catch (e) { /* ignore */ }
  if (!uid) {
    uid = "u" + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem("dicewar.mock.uid", uid); } catch (e) { /* ignore */ }
  }
  const sess = Math.random().toString(36).slice(2); // one per page load
  const listeners = new Map();
  let next = 0;
  window.__mockEmit = (id, val) => { const cb = listeners.get(id); if (cb) cb(val); };
  const call = (msg) => window.__mockDb({ ...msg, uid, sess });
  await call({ op: "hello", uid });
  return {
    uid,
    TS: { ".sv": "timestamp" },
    now: () => Date.now(),
    set: (path, val) => call({ op: "set", path, val, uid }),
    update: (path, val) => call({ op: "update", path, val, uid }),
    remove: (path) => call({ op: "set", path, val: null, uid }),
    get: (path) => call({ op: "get", path, uid }),
    on: (path, cb) => {
      const id = ++next;
      listeners.set(id, cb);
      call({ op: "on", path, id, uid });
      return () => { listeners.delete(id); call({ op: "off", id }); };
    },
    onDisconnect: (path, val) => call({ op: "onDisconnect", path, val }),
    cancelOnDisconnect: (path) => call({ op: "cancelOnDisconnect", path }),
    onConnected: (cb) => { setTimeout(() => cb(true), 0); return () => {}; },
  };
}
