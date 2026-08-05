"use client";

import { useEffect, useState } from "react";
import { GyreMote, type GyreMoteState } from "./component";

// an assistant narrating its own run — the realistic inline case: a small
// sphere sitting left of a status line, no pointer or keyboard in the loop.
const RUN: { state: GyreMoteState; text: string; ms: number }[] = [
  { state: "thinking", text: "Reasoning about the request…", ms: 2600 },
  { state: "searching", text: "Searching the codebase…", ms: 2600 },
  { state: "thinking", text: "Drafting the change…", ms: 2400 },
  { state: "done", text: "Done — 3 files updated", ms: 3000 },
];

// fixed reference rows so every cadence is on screen in one still frame,
// regardless of where the cycling row above happens to land.
const ROWS: { state: GyreMoteState; text: string }[] = [
  { state: "thinking", text: "Thinking" },
  { state: "searching", text: "Searching" },
  { state: "done", text: "Done" },
  { state: "idle", text: "Idle" },
];

export default function GyreMoteDemo() {
  const [step, setStep] = useState(0);
  const active = RUN[step % RUN.length]!;

  useEffect(() => {
    const t = window.setTimeout(() => setStep((s) => s + 1), active.ms);
    return () => window.clearTimeout(t);
  }, [step, active.ms]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-12 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / status-sphere-dots
      </p>

      <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-stretch">
        {/* showpiece — big enough that the depth cue clearly reads as a sphere */}
        <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-border bg-surface px-10 py-10">
          <GyreMote state={active.state} size={168} />
          <GyreMote
            state={active.state}
            label={active.text}
            showLabel
            size={22}
          />
        </div>

        {/* assistant message row — the realistic inline usage */}
        <div className="flex w-[300px] flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-3">
            <GyreMote state={active.state} size={30} />
            <span className="min-w-0 truncate text-sm text-foreground">
              {active.text}
            </span>
          </div>
          <div className="h-px w-full bg-border" />
          <ul className="flex flex-col gap-3">
            {ROWS.map((row) => (
              <li key={row.state} className="flex items-center gap-3">
                <GyreMote state={row.state} size={26} />
                <span className="text-xs text-ns-muted">{row.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="max-w-md text-center font-mono text-[10px] leading-relaxed text-ns-muted">
        a depth-cued dot-sphere — motion is the signal: steady spin thinking, a
        sweeping band searching, a settling contraction on done
      </p>
    </div>
  );
}
