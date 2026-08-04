"use client";

import { useEffect, useState } from "react";
import { SpiroTrace } from "./component";

// The resting frame must already read as "a progress trace on a spirograph":
// the hero starts part-inked at REST_VALUE, so the ghost route and the inked
// fraction are both on screen before anything moves.
const REST_VALUE = 62;

export default function SpiroTraceDemo() {
  const [value, setValue] = useState(REST_VALUE);

  // a slow index build: uneven arrivals, a hold at 100, then the next shard
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let holdUntil = 0;
    let v = REST_VALUE;
    let t = 0;
    const step = () => {
      const now = performance.now();
      if (v >= 100) {
        if (holdUntil === 0) holdUntil = now + 2600;
        else if (now >= holdUntil) {
          v = REST_VALUE;
          holdUntil = 0;
          setValue(REST_VALUE);
        }
      } else {
        v = Math.min(100, v + 6 + Math.random() * 11);
        setValue(v);
      }
      t = window.setTimeout(step, 420 + Math.random() * 460);
    };
    t = window.setTimeout(step, 1400);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / loader-spirograph-trace
      </p>

      <div
        data-spiro-hero
        className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-border bg-surface px-10 py-12"
      >
        <SpiroTrace size={200} value={value} label="Building search index" />
        <p className="text-sm text-foreground">Building search index</p>
        <p className="font-mono text-[11px] text-muted">
          inked arc length = progress, on the full rosette
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <SpiroTrace size={112} label="Reticulating shard index" />
          <p className="font-mono text-[11px] text-muted">no total yet — arc-length sweep</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <SpiroTrace size={112} value={100} label="Shaders compiled" />
          <p className="font-mono text-[11px] text-muted">complete — the whole curve inked</p>
        </div>
      </div>
    </main>
  );
}
