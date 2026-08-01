"use client";

import { useEffect, useRef, useState } from "react";
import { WindSpool } from "./component";

const JOB_TOTAL = 12_400_000; // ~12 MB, a plausible download
const INDETERMINATE_MS = 5200; // headers still pending
const RAMP_MS = 4200; // Content-Length arrived, streaming in
const HOLD_MS = 1800; // sit on "complete" before the next run

type Phase = "indeterminate" | "determinate" | "done";

export default function WindSpoolDemo() {
  const [phase, setPhase] = useState<Phase>("indeterminate");
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [loaded, setLoaded] = useState(0);
  const runRef = useRef(0);

  // ambient state machine: waits for "headers", streams a body in, holds on
  // completion, then starts a fresh request — the whole handoff needs no
  // interaction to demonstrate
  useEffect(() => {
    const timers: number[] = [];
    const startRun = () => {
      const myRun = ++runRef.current;
      setPhase("indeterminate");
      setTotal(undefined);
      setLoaded(0);

      timers.push(
        window.setTimeout(() => {
          if (runRef.current !== myRun) return;
          setPhase("determinate");
          setTotal(JOB_TOTAL);
          const rampStart = performance.now();
          const raf = () => {
            if (runRef.current !== myRun) return;
            const p = Math.min(1, (performance.now() - rampStart) / RAMP_MS);
            setLoaded(Math.round(JOB_TOTAL * p));
            if (p < 1) requestAnimationFrame(raf);
            else {
              setPhase("done");
              timers.push(window.setTimeout(startRun, HOLD_MS));
            }
          };
          requestAnimationFrame(raf);
        }, INDETERMINATE_MS)
      );
    };
    startRun();
    return () => {
      runRef.current += 1; // invalidate any in-flight rAF/timeout callbacks
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  // demonstration-only control: skips straight to "headers just arrived" so
  // the in-place conversion is reachable in one click instead of waiting out
  // the ambient indeterminate stretch
  const revealTotal = () => {
    runRef.current += 1; // cancel the ambient timeline, this state now owns it
    setPhase("determinate");
    setTotal(JOB_TOTAL);
    setLoaded(Math.round(JOB_TOTAL * 0.4));
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background p-6">
      <p className="self-start font-mono text-xs tracking-widest text-muted">
        ns-ui / loader-thread-spool
      </p>

      <div className="flex flex-col items-center gap-6 rounded-md border border-border bg-background p-10">
        <WindSpool total={total} loaded={loaded} aria-label="Downloading update" />
        <p className="font-mono text-[11px] text-muted">
          {phase === "indeterminate"
            ? "waiting on response headers"
            : phase === "determinate"
              ? "Content-Length arrived — streaming"
              : "transfer complete"}
        </p>
      </div>

      <button
        type="button"
        data-wind-force
        onClick={revealTotal}
        className="cursor-pointer rounded-sm border border-border px-4 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        SIMULATE HEADERS ARRIVING
      </button>
    </main>
  );
}
