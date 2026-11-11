// Database backend on the Firebase Realtime Database (anonymous sign-in).
// The SDK is loaded from Google's CDN only when the online lobby is used.
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/11.10.0/";

export async function createBackend() {
  const [appMod, authMod, dbMod] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
    import(SDK + "firebase-database.js"),
  ]);
  const { ref, set, update, remove, get, onValue, onDisconnect, serverTimestamp } = dbMod;
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  const cred = await authMod.signInAnonymously(auth);
  const db = dbMod.getDatabase(app);

  let offset = 0;
  onValue(ref(db, ".info/serverTimeOffset"), (s) => { offset = s.val() || 0; });

  return {
    uid: cred.user.uid,
    TS: serverTimestamp(),
    now: () => Date.now() + offset,
    set: (path, val) => set(ref(db, path), val),
    update: (path, val) => update(ref(db, path), val),
    remove: (path) => remove(ref(db, path)),
    get: async (path) => (await get(ref(db, path))).val(),
    /** Calls cb(value) now and on every change; returns an unsubscribe function. */
    on: (path, cb, onError) => onValue(ref(db, path), (s) => cb(s.val()), (e) => onError && onError(e)),
    /** On disconnect, set `path` to `val` (null removes it). */
    onDisconnect: (path, val) => {
      const od = onDisconnect(ref(db, path));
      return val === null ? od.remove() : od.set(val);
    },
    cancelOnDisconnect: (path) => onDisconnect(ref(db, path)).cancel(),
    onConnected: (cb) => onValue(ref(db, ".info/connected"), (s) => cb(s.val() === true)),
  };
}
