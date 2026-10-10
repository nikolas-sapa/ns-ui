// Guards the one thing in ANIMATION_GATE_SCRIPT that has no upper bound of its
// own: the `tokens` Map. The gate replaces requestAnimationFrame so an
// off-screen embed can be paused, and it has to remember each pending id so a
// later cancelAnimationFrame can mark it cancelled. A demo's rAF loop re-arms
// every frame with a NEW id and only ever cancels the last one, so if the
// entry is not dropped when the frame RUNS, the Map grows ~60 entries/second
// for the life of the iframe and nothing ever collects it.
//
// The Map is closure-private, so this runs the script inside a vm context
// whose `Map` is a counting subclass — the only way to observe the size
// without adding a test-only export to shipped code.
import vm from "node:vm";
import assert from "node:assert/strict";
import { ANIMATION_GATE_SCRIPT } from "../app/preview/[name]/embed/animation-gate.ts";

const FRAMES = 500;

/** Runs the gate with a fake rAF that fires each callback immediately. */
function run() {
  const maps: Map<unknown, unknown>[] = [];
  class CountingMap<K, V> extends Map<K, V> {
    constructor() {
      super();
      maps.push(this as Map<unknown, unknown>);
    }
  }

  const pending: (() => void)[] = [];
  const sandbox: Record<string, unknown> = {
    Map: CountingMap,
    performance: { now: () => 0 },
    document: { visibilityState: "visible", addEventListener() {} },
    requestAnimationFrame: (cb: (ts: number) => void) => {
      pending.push(() => cb(0));
      return 0;
    },
    cancelAnimationFrame: () => {},
    addEventListener() {},
    postMessage() {},
    parent: { postMessage() {} },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  new vm.Script(ANIMATION_GATE_SCRIPT).runInContext(sandbox);

  // A self-re-arming loop, exactly like every animated demo runs.
  const raf = sandbox.requestAnimationFrame as (cb: (ts: number) => void) => number;
  let frames = 0;
  const loop = () => {
    if (++frames < FRAMES) raf(loop);
  };
  raf(loop);
  while (pending.length) pending.shift()!();

  const live = maps.reduce((n, m) => n + m.size, 0);
  return { frames, live };
}

const { frames, live } = run();
assert.equal(frames, FRAMES, `loop did not run: ${frames} frames`);
// Every frame has already fired, so nothing is in flight. Two entries of
// slack in case the gate ever legitimately holds one back.
assert.ok(
  live <= 2,
  `animation-gate leaks rAF tokens: ${live} entries left after ${FRAMES} completed frames (expected <= 2) — see the tokens.delete(id) in wrap().`,
);
console.log(`PASS animation-gate: ${live} live token(s) after ${FRAMES} frames`);
