"use client";

import { useEffect, useRef, useState } from "react";
import { GrainTally, type GrainTallySample } from "./component";

// mulberry32 — seeded, so every load of the demo grows the same heap
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WINDOW = 140;

function makeSample(rng: () => number, tick: number, id: number): GrainTallySample {
  // log-normal-ish latency around ~180ms; every ~30 ticks a burst of slow
  // responses drags the P90 fence visibly to the right
  const burst = tick % 30 < 5;
  const base = burst ? 340 : 160;
  const value = Math.min(478, base + (rng() + rng() + rng() - 1.2) * 90 + rng() * 40);
  return { id, value: Math.max(8, value) };
}

// pre-seed most of the window so the instrument reads as a distribution at
// rest — an empty frame filling one grain at a time is a cold start, not a
// resting state
const SEED = (() => {
  const rng = mulberry32(0x5eed);
  return Array.from({ length: 100 }, (_, i) => makeSample(rng, i, i));
})();

export default function GrainTallyDemo() {
  const [samples, setSamples] = useState<GrainTallySample[]>(SEED);
  const [paused, setPaused] = useState(false);
  const rngRef = useRef(mulberry32(0xacc7));
  const idRef = useRef(SEED.length);
  const tickRef = useRef(SEED.length);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      tickRef.current += 1;
      const sample = makeSample(rngRef.current, tickRef.current, idRef.current++);
      setSamples((prev) => {
        const next = [...prev, sample];
        return next.length > WINDOW ? next.slice(next.length - WINDOW) : next;
      });
    }, 240);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / histogram-live-grain
        </p>
        <div className="rounded-md border border-border bg-surface p-5">
          <GrainTally
            samples={samples}
            min={0}
            max={480}
            bins={28}
            unit="ms"
            label="checkout · response time"
            height={150}
          />
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              rolling window · {WINDOW} samples
            </span>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
              className="cursor-pointer rounded-sm border border-border px-3 py-1 font-mono text-[11px] text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {paused ? "resume feed" : "pause feed"}
            </button>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          every sample falls as a grain into its bin — the heap is the
          histogram, and the P50/P90 fences slide as it shifts
        </p>
      </div>
    </main>
  );
}
