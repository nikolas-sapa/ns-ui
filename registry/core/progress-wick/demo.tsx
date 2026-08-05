"use client";

import { useEffect, useRef, useState } from "react";
import { WickRun } from "./component";

export default function WickRunDemo() {
  const [value, setValue] = useState(0);
  const [run, setRun] = useState(0);
  const pausedRef = useRef(false);

  // simulated chunked upload: uneven bursts landing at uneven intervals, a
  // hold at 100, then a fresh run — exactly the bursty real-world cadence
  // progress-wick's draw-dwell rhythm is built to absorb without looking janky.
  useEffect(() => {
    let t = 0;
    let v = 0;
    let holdUntil = 0;
    setValue(0);
    const step = () => {
      const now = performance.now();
      if (!pausedRef.current) {
        if (v >= 100) {
          if (holdUntil === 0) {
            holdUntil = now + 2400;
          } else if (now >= holdUntil) {
            v = 0;
            holdUntil = 0;
            setValue(0);
          }
        } else {
          v = Math.min(100, v + 4 + Math.random() * 14);
          setValue(v);
        }
      }
      t = window.setTimeout(step, 260 + Math.random() * 520);
    };
    t = window.setTimeout(step, 500);
    return () => window.clearTimeout(t);
  }, [run]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / progress-wick
      </p>

      <div
        className="flex w-full max-w-md flex-col gap-8 rounded-xl border border-border bg-surface px-8 py-10"
        onPointerEnter={() => {
          pausedRef.current = true;
        }}
        onPointerLeave={() => {
          pausedRef.current = false;
        }}
      >
        <WickRun value={value} label="Uploading build.tar.gz" />
        <WickRun indeterminate label="Syncing catalog" />
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => setRun((r) => r + 1)}
          className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-ns-muted transition-colors duration-150 hover:border-ns-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          restart upload
        </button>
        <p className="font-mono text-[10px] text-ns-muted">hover the panel to pause</p>
      </div>
    </div>
  );
}
