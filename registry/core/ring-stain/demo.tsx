"use client";

import { useEffect, useState } from "react";
import { RingStain } from "./component";

// The resting frame should already read as "a coffee-ring loader mid-wait":
// the hero starts partway through a determinate ramp so the rim already
// carries a partial deposit before anything else happens.
const REST_VALUE = 46;

export default function RingStainDemo() {
  const [value, setValue] = useState<number | undefined>(REST_VALUE);

  // an uneven upload: bursts of progress, a hold at 100 so the checkmark
  // settle is visible, then back to the rest value for the next loop.
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
        v = Math.min(100, v + 4 + Math.random() * 9);
        setValue(v);
      }
      t = window.setTimeout(step, 380 + Math.random() * 420);
    };
    t = window.setTimeout(step, 1200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / ring-stain
      </p>

      <div
        data-ring-stain-hero
        className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border border-border bg-surface px-10 py-12"
      >
        <RingStain size={160} value={value} label="Uploading files" />
        <p className="text-sm text-foreground">Uploading files</p>
        <p className="font-mono text-[11px] text-ns-muted">
          rim arc filled = progress, on a real capillary drift
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <RingStain size={104} label="Syncing workspace" />
          <p className="font-mono text-[11px] text-ns-muted">no total yet — density over time</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <RingStain size={104} value={100} label="Export finished" />
          <p className="font-mono text-[11px] text-ns-muted">complete — residue becomes the check</p>
        </div>
      </div>
    </main>
  );
}
