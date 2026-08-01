"use client";

import { useEffect, useRef, useState } from "react";
import { StemSift, type StemSiftRecord } from "./component";

// mulberry32 — seeded, so every load of the demo grows the same table
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

const WINDOW = 60;

function makeRecord(rng: () => number, tick: number, id: number): StemSiftRecord {
  // log-normal-ish latency around ~120ms; every ~18 ticks a short burst of
  // slow responses drags a cluster of leaves into the upper stems
  const burst = tick % 18 < 3;
  const base = burst ? 205 : 118;
  const value = Math.max(35, Math.min(258, base + (rng() + rng() + rng() - 1.4) * 42));
  return { id, value: Math.round(value), meta: `req-${4000 + id}` };
}

// pre-seed most of the window so the plot reads as a distribution at rest
const SEED = (() => {
  const rng = mulberry32(0x5eed);
  return Array.from({ length: 42 }, (_, i) => makeRecord(rng, i, i));
})();

export default function StemSiftDemo() {
  const [records, setRecords] = useState<StemSiftRecord[]>(SEED);
  const [paused, setPaused] = useState(false);
  const rngRef = useRef(mulberry32(0xacc7));
  const idRef = useRef(SEED.length);
  const tickRef = useRef(SEED.length);

  // the first arrival is held back ~4s so the resting frame (captured by the
  // screenshot gate ~1s after load) shows the settled pre-seeded table, never
  // a leaf frozen mid-flight between rows
  const firstDelayRef = useRef(4000);

  useEffect(() => {
    if (paused) return;
    let t: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      firstDelayRef.current = 0;
      t = setInterval(() => {
        tickRef.current += 1;
        const record = makeRecord(rngRef.current, tickRef.current, idRef.current++);
        setRecords((prev) => {
          const next = [...prev, record];
          return next.length > WINDOW ? next.slice(next.length - WINDOW) : next;
        });
      }, 650);
    }, firstDelayRef.current);
    return () => {
      clearTimeout(start);
      if (t) clearInterval(t);
    };
  }, [paused]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">ns-ui / stem-sift</p>
        <div className="rounded-md border border-border bg-surface p-5">
          <StemSift records={records} unit="ms" label="checkout · response time" />
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              rolling window &middot; {WINDOW} samples
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
          every arrival types its ones digit into the row for its tens &mdash; hover or focus any leaf
          for the record behind it
        </p>
      </div>
    </main>
  );
}
