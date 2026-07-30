"use client";

import { useEffect, useState } from "react";
import { BrailleSpin } from "./component";

export default function BrailleSpinDemo() {
  const [value, setValue] = useState(0);

  // self-driving determinate run: climbs to 100, holds, resets — no external
  // input needed, which is exactly why this ships with autoplay: none
  useEffect(() => {
    let v = 0;
    let holdUntil = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      if (v >= 100) {
        if (holdUntil === 0) holdUntil = now + 1400;
        else if (now >= holdUntil) {
          v = 0;
          holdUntil = 0;
          setValue(0);
        }
        return;
      }
      v = Math.min(100, v + 3 + Math.random() * 5);
      setValue(v);
    }, 140);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      data-braille-card
      className="flex min-h-screen flex-col items-center justify-center gap-14 px-6"
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / braille-spin
      </p>

      <div className="flex w-full max-w-xl flex-col gap-10 rounded-xl border border-border bg-surface px-10 py-12">
        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
            indeterminate
          </span>
          <BrailleSpin aria-label="Loading" className="text-3xl" />
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted">
            determinate — {Math.round(value)}%
          </span>
          <BrailleSpin progress={value} aria-label="Upload progress" className="text-3xl" />
        </div>
      </div>
    </div>
  );
}
