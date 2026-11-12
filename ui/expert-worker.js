// One search thread of the multi-core expert AI (see ai/expert-parallel.js).
import { createThreadHandler } from "../ai/expert-parallel.js";

const handle = createThreadHandler();
self.onmessage = (e) => self.postMessage(handle(e.data));
