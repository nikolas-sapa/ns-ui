"use client";

import { useEffect, useRef, useState } from "react";
import { PawlTick, type PawlTickStatus } from "./component";

// A minimal document editor chrome, autosaving in the background. The
// script below drives the realistic case on its own — periodic autosaves
// with an occasional failure that has to be retried — the same way an
// editor narrates its own save state with no pointer or keyboard input in
// the loop at all.
const SCRIPT: { status: PawlTickStatus; ms: number }[] = [
  { status: "idle", ms: 1400 },
  { status: "saving", ms: 650 },
  { status: "saved", ms: 2600 },
  { status: "saving", ms: 650 },
  { status: "saved", ms: 2600 },
  { status: "saving", ms: 650 },
  { status: "error", ms: 2400 },
  { status: "saving", ms: 650 },
  { status: "saved", ms: 2600 },
  { status: "saving", ms: 650 },
  { status: "saved", ms: 3200 },
];

export default function PawlTickDemo() {
  const [step, setStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const current = SCRIPT[step % SCRIPT.length]!;

  useEffect(() => {
    timerRef.current = setTimeout(() => setStep((s) => s + 1), current.ms);
    return () => clearTimeout(timerRef.current);
  }, [step, current.ms]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / autosave-ratchet
      </p>

      <div className="w-full max-w-md rounded-[12px] border border-border bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-6 w-6 shrink-0 rounded-[6px] border border-border" aria-hidden="true" />
            <span className="truncate text-sm text-foreground">Q3 retro notes</span>
          </div>
          <PawlTick status={current.status} />
        </div>

        <div className="flex items-center gap-1 border-b border-border px-4 py-2">
          {["B", "I", "U"].map((glyph) => (
            <span
              key={glyph}
              aria-hidden="true"
              className="flex h-7 w-7 items-center justify-center rounded-[6px] border border-transparent text-xs text-ns-muted"
            >
              {glyph}
            </span>
          ))}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-[6px] text-xs text-ns-muted">
            ¶
          </span>
        </div>

        <div className="flex flex-col gap-2.5 px-5 py-6">
          <span className="h-3 w-3/4 rounded-full bg-border" aria-hidden="true" />
          <span className="h-3 w-full rounded-full bg-border" aria-hidden="true" />
          <span className="h-3 w-5/6 rounded-full bg-border" aria-hidden="true" />
          <span className="mt-2 h-3 w-2/3 rounded-full bg-border" aria-hidden="true" />
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Hover or focus the gear for the full status; a failed save kicks the
        wheel back half a tooth and holds until the next save lands.
      </p>
    </div>
  );
}
