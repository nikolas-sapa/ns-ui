"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BallastContext } from "./component";

const CAPACITY = 200_000;
const SYSTEM = 3_400;
// pause ambient growth here — a real agent would compact before running out
const AUTO_GROW_CEILING = 0.94;

type Ctx = { tools: number; history: number; turn: number };

// a mid-session baseline, not an empty specimen — the resting screenshot
// should already show the bar doing its job
const INITIAL: Ctx = { tools: 2_140, history: 96_800, turn: 1_260 };

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export default function BallastContextDemo() {
  const [ctx, setCtx] = useState<Ctx>(INITIAL);
  const [status, setStatus] = useState("session resumed · 51.8% of window in use");
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const tick = () => {
      const amt = rand(900, 2000);
      let bumped = false;
      setCtx((prev) => {
        const used = SYSTEM + prev.tools + prev.history + prev.turn;
        if (used / CAPACITY >= AUTO_GROW_CEILING) return prev;
        bumped = true;
        return { ...prev, turn: prev.turn + amt };
      });
      if (bumped) {
        setStatus(`assistant turn streaming · +${fmt(amt)} tok`);
        const id = window.setTimeout(() => {
          setCtx((prev) =>
            prev.turn >= amt
              ? { ...prev, turn: prev.turn - amt, history: prev.history + amt }
              : prev
          );
          setStatus(`turn folded into history · +${fmt(amt)} tok`);
        }, 900);
        timeoutsRef.current.push(id);
      }
    };
    const intervalId = window.setInterval(tick, 2200);
    return () => {
      window.clearInterval(intervalId);
      for (const id of timeoutsRef.current) window.clearTimeout(id);
      timeoutsRef.current = [];
    };
  }, []);

  const callTool = useCallback(() => {
    const amt = rand(250, 700);
    setCtx((prev) => ({ ...prev, tools: prev.tools + amt }));
    setStatus(`tool call returned · +${fmt(amt)} tok`);
  }, []);

  const compact = useCallback(() => {
    const before = ctx.history;
    const after = Math.round(before * 0.12);
    setCtx((prev) => ({ ...prev, history: after }));
    setStatus(`context compacted · history ${fmt(before)} → ${fmt(after)} tok`);
  }, [ctx.history]);

  // Jump straight to the near-capacity band. The ambient interval reaches it
  // on its own after a couple of minutes, but that is far past any screenshot
  // — this makes the warning state (pulsing ring, bold readout + triangle,
  // hazard hatch on the sliver of free space) reachable in one click, so the
  // gate can capture and prove it. Usage lands ~96%, above the auto-grow
  // ceiling, so it holds until COMPACT or RESET.
  const fillWindow = useCallback(() => {
    setCtx({ tools: 4_200, history: 179_600, turn: 4_800 });
    setStatus("near capacity · compact before the window fills");
  }, []);

  const reset = useCallback(() => {
    setCtx(INITIAL);
    setStatus("session reset · baseline restored");
  }, []);

  const used = SYSTEM + ctx.tools + ctx.history + ctx.turn;
  const pctUsed = Math.round((used / CAPACITY) * 100);

  const buttonClass =
    "cursor-pointer rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / ballast-context
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">
              AGENT SESSION
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted">
              claude-4.5 · {fmt(CAPACITY)} ctx
            </span>
          </header>

          <div className="px-5 py-5">
            <BallastContext
              capacity={CAPACITY}
              system={SYSTEM}
              tools={ctx.tools}
              history={ctx.history}
              turn={ctx.turn}
              ariaLabel="Context window budget for this session"
            />
          </div>

          <div className="border-t border-border px-5 py-2">
            <p className="truncate font-mono text-[11px] text-muted">
              <span className="text-foreground">event</span> · {status}
            </p>
          </div>

          <footer className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
            <button type="button" onClick={callTool} className={buttonClass}>
              CALL TOOL
            </button>
            <button
              type="button"
              onClick={compact}
              data-ballast-compact
              className={buttonClass}
            >
              COMPACT CONTEXT
            </button>
            <button
              type="button"
              onClick={fillWindow}
              data-ballast-fill
              className={buttonClass}
            >
              FILL WINDOW
            </button>
            <button type="button" onClick={reset} className={buttonClass}>
              RESET SESSION
            </button>
            <span className="ml-auto font-mono text-[11px] tabular-nums text-muted">
              {pctUsed}% of window
            </span>
          </footer>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          the bar is a picture of what the model can see right now — compact
          when history dominates and watch it resettle, not jump
        </p>
      </div>
    </main>
  );
}
