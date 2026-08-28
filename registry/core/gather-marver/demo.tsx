"use client";

import { useEffect, useState } from "react";
import { GatherMarver } from "./component";

export default function GatherMarverDemo() {
  const [uploadProgress, setUploadProgress] = useState(0);

  // self-driving determinate run: ramps to a mid value and HOLDS for a
  // couple of seconds before continuing to 100 and holding again. The
  // holds are deliberate — they prove the component's own claim that the
  // roll travel and spin keep running off the real clock even while
  // `progress` itself is unchanging, so a held value never reads as idle.
  useEffect(() => {
    let raf = 0;
    const HOLD_A = 55;
    const HOLD_A_MS = 2200;
    const HOLD_B_MS = 2200;
    const RESET_GAP_MS = 500;
    let phase: "toA" | "holdA" | "toB" | "holdB" | "reset" = "toA";
    let phaseStart = performance.now();

    const tick = (now: number) => {
      const elapsed = now - phaseStart;
      if (phase === "toA") {
        const v = Math.min(HOLD_A, elapsed / 26);
        setUploadProgress(v);
        if (v >= HOLD_A) {
          phase = "holdA";
          phaseStart = now;
        }
      } else if (phase === "holdA") {
        setUploadProgress(HOLD_A);
        if (elapsed >= HOLD_A_MS) {
          phase = "toB";
          phaseStart = now;
        }
      } else if (phase === "toB") {
        const v = Math.min(100, HOLD_A + elapsed / 20);
        setUploadProgress(v);
        if (v >= 100) {
          phase = "holdB";
          phaseStart = now;
        }
      } else if (phase === "holdB") {
        setUploadProgress(100);
        if (elapsed >= HOLD_B_MS) {
          phase = "reset";
          phaseStart = now;
        }
      } else {
        setUploadProgress(0);
        if (elapsed >= RESET_GAP_MS) {
          phase = "toA";
          phaseStart = now;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      data-gather-marver-card
      className="flex min-h-screen flex-col items-center justify-center gap-14 px-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / gather-marver
      </p>

      <div className="flex w-full max-w-xl flex-col gap-10 rounded-xl border border-border bg-surface px-10 py-12">
        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ns-muted">
            indeterminate
          </span>
          <GatherMarver aria-label="Processing upload" className="h-40 w-full max-w-sm" />
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-ns-muted">
            determinate — mapped to upload progress
          </span>
          <GatherMarver
            progress={uploadProgress}
            aria-label="Upload progress"
            className="h-28 w-full max-w-xs"
          />
        </div>
      </div>
    </div>
  );
}
