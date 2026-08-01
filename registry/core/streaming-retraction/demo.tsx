"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RetractInk, type RetractInkOp } from "./component";

// A completed earlier answer: two corrections already settled into scar
// ticks. This is what a revised response looks like at rest — and it gives
// the verifier a scar button that exists from frame one.
const HISTORY: RetractInkOp[] = [
  { type: "append", text: "The batch job runs every " },
  { type: "append", text: "hour" },
  { type: "retract", chars: 4 },
  { type: "append", text: "15 minutes, and retries " },
  { type: "append", text: "forever" },
  { type: "retract", chars: 7 },
  { type: "append", text: "up to 5 times with exponential backoff." },
];

// The live stream: lands a wrong figure and a wrong word mid-sentence, takes
// them back, and continues — chunked so the strike fires mid-thought, not at
// a tidy boundary.
const SCRIPT: RetractInkOp[] = [
  { type: "append", text: "Looking" },
  { type: "append", text: " at the trace, the p99 spike comes from " },
  { type: "append", text: "the database" },
  { type: "retract", chars: 12 },
  { type: "append", text: "connection pool exhaustion — " },
  { type: "append", text: "all " },
  { type: "append", text: "40" },
  { type: "retract", chars: 2 },
  { type: "append", text: "32 connections were held by " },
  { type: "append", text: "slow queries" },
  { type: "retract", chars: 12 },
  { type: "append", text: "idle transactions. Raising the pool won't fix it; " },
  { type: "append", text: "add an idle-in-transaction timeout instead." },
];

export default function RetractInkDemo() {
  const [ops, setOps] = useState<RetractInkOp[]>([]);
  const [streaming, setStreaming] = useState(true);
  const indexRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const run = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    setOps([]);
    setStreaming(true);
    indexRef.current = 0;
    const step = () => {
      const i = indexRef.current;
      if (i >= SCRIPT.length) {
        setStreaming(false);
        timeoutRef.current = setTimeout(run, 3200);
        return;
      }
      const op = SCRIPT[i];
      setOps((prev) => [...prev, op]);
      indexRef.current += 1;
      // a retraction earns a readable pause: the strike sweep needs to be
      // seen before the replacement pushes in
      const wait = op.type === "retract" ? 1250 : 90 + Math.random() * 140;
      timeoutRef.current = setTimeout(step, wait);
    };
    timeoutRef.current = setTimeout(step, 400);
  }, []);

  useEffect(() => {
    run();
    return () => window.clearTimeout(timeoutRef.current);
  }, [run]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / retract-ink
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">ASSISTANT</span>
            <button
              type="button"
              onClick={run}
              className="cursor-pointer rounded-sm border border-border px-3 py-1 font-mono text-[11px] text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              replay
            </button>
          </header>
          <div className="flex flex-col gap-4 px-5 py-5 text-sm leading-relaxed text-foreground">
            <div className="rounded-md bg-background px-3 py-2">
              <RetractInk ops={HISTORY} streaming={false} />
            </div>
            <div className="rounded-md bg-background px-3 py-2">
              <RetractInk ops={ops} streaming={streaming} />
            </div>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          retracted text strikes through and evaporates — the notched tick it
          leaves behind reopens the revision
        </p>
      </div>
    </main>
  );
}
