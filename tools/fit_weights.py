#!/usr/bin/env python3
"""Developer tool: learns the evaluation weights (ai/eval.js) from game results.

    node tools/features.mjs <series dirs> --out data.bin
    python3 tools/fit_weights.py data.bin [--base weights.json] [--l2 1.0] [--out weights.json] [--fixed reserve,...]

Model: P(player to move wins) = sigmoid(evaluation / T), evaluation = features . weights
in "VP x 100" units. T is fitted first with the base weights, then all weights
except "vp" (the unit) are fitted by gradient descent on the log loss.
--l2 pulls every weight towards its base value (in units of its effect on the
evaluation), so features the games say little about keep their hand-set value.
10 % of the games are held out to check that the fit generalises.
Needs numpy only.
"""
import json, sys, argparse
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("data")
ap.add_argument("--base", help="base weights (JSON name -> value); default: current WEIGHTS via node")
ap.add_argument("--l2", type=float, default=1.0)
ap.add_argument("--steps", type=int, default=3000)
ap.add_argument("--out", default="weights.json")
ap.add_argument("--signs", action="store_true", help="keep weights on the side the rules give them (see SIGNS)")
ap.add_argument("--fixed", default="", help="comma-separated features kept at their base value (besides vp)")
args = ap.parse_args()

meta = json.load(open(args.data + ".json"))
names, width = meta["features"], meta["width"]
raw = np.fromfile(args.data, dtype=np.float32).reshape(-1, width).astype(np.float64)
y, game, X = raw[:, 0], raw[:, 2].astype(int), raw[:, 3:]
if args.base:
    base = json.load(open(args.base))
else:
    import subprocess
    base = json.loads(subprocess.check_output(["node", "-e", "import('./ai/eval.js').then(m => console.log(JSON.stringify(m.WEIGHTS)))"]))
w0 = np.array([base.get(n, 0.0) for n in names], dtype=np.float64)

rng = np.random.default_rng(1)
held = rng.random(game.max() + 1) < 0.1
val = held[game]
Xt, yt, Xv, yv = X[~val], y[~val], X[val], y[val]

def loss(w, T, X, y):
    p = 1 / (1 + np.exp(-np.clip(X @ w / T, -30, 30)))
    p = np.clip(p, 1e-9, 1 - 1e-9)
    return -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))

# 1) temperature for the base weights
Ts = np.exp(np.linspace(np.log(20), np.log(5000), 200))
T = Ts[np.argmin([loss(w0, t, Xt, yt) for t in Ts])]

# Signs from the rules: these features can only help their owner (>= 0) or
# hurt (<= 0); a creature on the board is worth at least half its base value
# (it is never worse than a die in the Reserve). Learning from game results
# alone can give a feature the wrong sign when it merely comes along with
# winning or losing (e.g. a weaker side keeps its dice in the Reserve).
NONPOS = {"threatened"}
FREE_SIGN = {"lateVP", "center"}
lo = np.full(len(names), -np.inf); hi = np.full(len(names), np.inf)
if args.signs:
    for i, nme in enumerate(names):
        if ".L" in nme: lo[i] = w0[i] / 2
        elif nme in NONPOS: hi[i] = 0
        elif nme not in FREE_SIGN: lo[i] = 0

# 2) weights: Adam on log loss + l2 towards base (scaled by feature spread)
std = Xt.std(axis=0)
fixed = {"vp", *filter(None, args.fixed.split(","))}
free = (std > 1e-9) & ~np.isin(np.array(names), list(fixed))
scale = np.where(free, T / np.maximum(std, 1e-9), 1.0)  # weight change that moves the evaluation by T per std
w = w0.copy()
m = np.zeros_like(w); v = np.zeros_like(w)
lr, b1, b2 = 0.02, 0.9, 0.999
u = np.zeros_like(w)  # weights in scaled units: w = w0 + u * scale
n = len(yt)
for step in range(1, args.steps + 1):
    w = w0 + u * scale
    z = np.clip(Xt @ w / T, -30, 30)
    p = 1 / (1 + np.exp(-z))
    g = (Xt.T @ (p - yt)) / n / T * scale + args.l2 * 1e-3 * u
    g[~free] = 0
    m = b1 * m + (1 - b1) * g; v = b2 * v + (1 - b2) * g * g
    u -= lr * (m / (1 - b1 ** step)) / (np.sqrt(v / (1 - b2 ** step)) + 1e-8)
    u = np.clip(w0 + u * scale, lo, hi) - w0
    u = np.where(free, u / scale, 0)
w = w0 + u * scale

def acc(w, X, y):
    d = y != 0.5
    return np.mean(((X[d] @ w) > 0) == (y[d] == 1))

print(f"{len(y)} positions from {game.max() + 1} games ({held.sum()} games held out), T = {T:.0f}")
print(f"log loss train {loss(w0, T, Xt, yt):.4f} -> {loss(w, T, Xt, yt):.4f}, held out {loss(w0, T, Xv, yv):.4f} -> {loss(w, T, Xv, yv):.4f}")
print(f"winner predicted (held out) {acc(w0, Xv, yv):.1%} -> {acc(w, Xv, yv):.1%}")
print(f"{'feature':24} {'base':>8} {'learned':>8} {'spread':>8}")
for i, nme in enumerate(names):
    if std[i] > 1e-9:
        print(f"{nme:24} {w0[i]:8.1f} {w[i]:8.1f} {std[i]:8.2f}")
json.dump({nme: round(float(w[i]), 2) for i, nme in enumerate(names)}, open(args.out, "w"), indent=1)
print("->", args.out)
