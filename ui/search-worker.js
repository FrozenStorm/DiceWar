// One search thread of the multi-core AI search (see ai/parallel.js).
import { createThreadHandler } from "../ai/parallel.js";

const handle = createThreadHandler();
self.onmessage = (e) => self.postMessage(handle(e.data));
