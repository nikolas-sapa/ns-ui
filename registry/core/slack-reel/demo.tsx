"use client";

import { useEffect, useRef, useState } from "react";
import { SlackReel } from "./component";

// Simulated fetch: uneven forward steps with a deliberate stall in the
// middle (the cord goes taut on its own during the stall, not the value
// pausing) then a hold at 100% before a fresh run starts.
export default function SlackReelDemo() {
  const [value, setValue] = useState(0);
  const [run, setRun] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    let t = 0;
    let v = 0;
    let stalledUntil = 0;
    let holdUntil = 0;
    setValue(0);

    const step = () => {
      const now = performance.now();
      if (!pausedRef.current) {
        if (v >= 100) {
          if (holdUntil === 0) {
            holdUntil = now + 2200;
          } else if (now >= holdUntil) {
            v = 0;
            holdUntil = 0;
            setValue(0);
          }
        } else if (stalledUntil > 0) {
          if (now >= stalledUntil) stalledUntil = 0;
        } else {
          // one deliberate stall roughly mid-run
          if (v > 35 && v < 55 && Math.random() < 0.35) {
            stalledUntil = now + 1400;
          } else {
            v = Math.min(100, v + 3 + Math.random() * 9);
            setValue(v);
          }
        }
      }
      t = window.setTimeout(step, 260 + Math.random() * 320);
    };
    t = window.setTimeout(step, 400);
    return () => window.clearTimeout(t);
  }, [run]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-14 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / slack-reel
      </p>

      <div className="flex w-full max-w-xl flex-col gap-10">
        <div className="rounded-xl border border-border bg-surface px-8 py-7">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            indeterminate — busy, no known duration
          </p>
          <SlackReel className="h-[18px] w-full" aria-label="Connecting" />
        </div>

        <div
          className="rounded-xl border border-border bg-surface px-8 py-7"
          onPointerEnter={() => {
            pausedRef.current = true;
          }}
          onPointerLeave={() => {
            pausedRef.current = false;
          }}
        >
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            determinate — sag follows throughput, taut on stall
          </p>
          <SlackReel
            className="h-[18px] w-full"
            value={value}
            aria-label="Simulated fetch progress"
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-8 py-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            inline footprint
          </p>
          <SlackReel className="h-[16px] w-10" aria-label="Loading" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          onClick={() => setRun((r) => r + 1)}
          className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          restart fetch
        </button>
        <p className="font-mono text-[10px] text-muted">
          hover the determinate card to pause
        </p>
      </div>
    </div>
  );
}
