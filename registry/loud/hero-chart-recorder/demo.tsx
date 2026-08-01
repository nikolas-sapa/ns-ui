"use client";

import { useEffect, useRef, useState } from "react";
import { PenLag } from "./component";

// deterministic-enough live feed: a slow random wander with occasional sharp
// spikes, fed into the component's spring so the overshoot has something
// honest to react to. Ticks coarser than the pen's own animation rate —
// real telemetry reports in discrete beats, the mechanical smoothing between
// them is the component's job, not the demo's.
function useLiveValue(): [number, () => void] {
  const [value, setValue] = useState(210);
  const forceRef = useRef(false);
  useEffect(() => {
    let v = 210;
    const id = setInterval(() => {
      const forced = forceRef.current;
      forceRef.current = false;
      const spike = forced || Math.random() < 0.07;
      v = spike
        ? 270 + Math.random() * 190
        : Math.max(45, Math.min(430, v + (Math.random() - 0.5) * 46));
      setValue(v);
    }, 260);
    return () => clearInterval(id);
  }, []);
  return [value, () => (forceRef.current = true)];
}

export default function PenLagDemo() {
  const [value, triggerSpike] = useLiveValue();

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs tracking-widest text-muted">
            ns-ui / pen-lag
          </p>
          <button
            type="button"
            onClick={triggerSpike}
            className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/25 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            TRIGGER SPIKE
          </button>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          The pen is honestly mechanical
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
          It never teleports to the true value — it chases it through an
          underdamped spring, overshoots, quivers, and settles. Whatever the
          pen actually drew is what stays stamped on the paper, tremor
          included.
        </p>
        <div className="mt-6 rounded-md border border-border bg-background p-4">
          <PenLag
            value={value}
            label="Response time"
            unit="ms"
            min={0}
            max={520}
            className="h-72"
          />
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          focus the strip, then use ← / → to scrub the trace — hover does the
          same with a pointer
        </p>
      </div>
    </main>
  );
}
