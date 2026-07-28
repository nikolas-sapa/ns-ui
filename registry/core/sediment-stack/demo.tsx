"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SedimentStack,
  type SedimentSeverity,
  type SedimentStackHandle,
} from "./component";

type DemoEvent = {
  severity: SedimentSeverity;
  title: string;
  message: string;
};

// opening sequence — mixed severities so the pile, jostle and mass sorting are
// visible immediately. Sequence toasts are persistent (duration 0) so the pile
// settles fast and stays put; pushed toasts keep the 6s auto-dismiss to show
// the mid-pile resettle.
const SEQUENCE: DemoEvent[] = [
  { severity: "info", title: "Build completed", message: "turbo build · 42s · cache hit 91%" },
  { severity: "info", title: "Static assets uploaded", message: "312 files · 8.4 MB → edge network" },
  { severity: "warning", title: "Cold start p99 elevated", message: "iad1 · 1.28s (budget 800ms)" },
  { severity: "error", title: "Function crashed", message: "/api/checkout · TypeError: cart is undefined" },
  { severity: "warning", title: "Env var missing in preview", message: "STRIPE_WEBHOOK_SECRET not set" },
  { severity: "error", title: "Deploy gate failed", message: "e2e · 3 of 118 specs red" },
];

const POOL: Record<SedimentSeverity, DemoEvent[]> = {
  info: [
    { severity: "info", title: "Deploy promoted to production", message: "sha 4f2a91c · us-east" },
    { severity: "info", title: "Edge cache warmed", message: "1,204 routes prefetched" },
    { severity: "info", title: "Preview ready", message: "pr-482 · preview build in 38s" },
  ],
  warning: [
    { severity: "warning", title: "Bundle budget exceeded", message: "app/layout.js · 312 kB (budget 250 kB)" },
    { severity: "warning", title: "Slow query flagged", message: "orders.list · 840ms p95" },
    { severity: "warning", title: "Retrying webhook", message: "stripe · attempt 3 of 5" },
  ],
  error: [
    { severity: "error", title: "Migration failed", message: "20260718_orders · duplicate column" },
    { severity: "error", title: "Worker out of memory", message: "render-worker exceeded 512 MB" },
    { severity: "error", title: "Function crashed", message: "/api/checkout · TypeError: cart is undefined" },
  ],
};

export default function SedimentStackDemo() {
  const stackRef = useRef<SedimentStackHandle>(null);
  const timeoutsRef = useRef<number[]>([]);
  const [count, setCount] = useState(0);
  const [feed, setFeed] = useState("awaiting events…");

  const emit = useCallback((event: DemoEvent, duration?: number) => {
    stackRef.current?.push(duration === undefined ? event : { ...event, duration });
    setCount((c) => c + 1);
    const ts = new Date().toLocaleTimeString([], { hour12: false });
    setFeed(`${ts} · ${event.severity} · ${event.title}`);
  }, []);

  const runSequence = useCallback(() => {
    for (const id of timeoutsRef.current) clearTimeout(id);
    timeoutsRef.current = SEQUENCE.map((event, i) =>
      window.setTimeout(() => emit(event, 0), i * 180)
    );
  }, [emit]);

  useEffect(() => {
    runSequence();
    const timeouts = timeoutsRef;
    return () => {
      for (const id of timeouts.current) clearTimeout(id);
      timeouts.current = [];
    };
  }, [runSequence]);

  const pushRandom = useCallback(
    (severity: SedimentSeverity) => {
      const pool = POOL[severity];
      emit(pool[Math.floor(Math.random() * pool.length)]);
    },
    [emit]
  );

  const replay = useCallback(() => {
    stackRef.current?.clear();
    runSequence();
  }, [runSequence]);

  const buttonClass =
    "cursor-pointer rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / sediment-stack
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">
              DEPLOY LOG — LIVE
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted">
              {count} events
            </span>
          </header>
          <div className="border-b border-border px-5 py-2">
            <p className="truncate font-mono text-[11px] text-muted">
              <span className="text-foreground">feed</span> · {feed}
            </p>
          </div>
          <SedimentStack
            ref={stackRef}
            aria-label="Deploy notifications"
            className="h-[420px] bg-background"
          />
          <footer className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
            <button type="button" onClick={() => pushRandom("info")} className={buttonClass}>
              PUSH INFO
            </button>
            <button type="button" onClick={() => pushRandom("warning")} className={buttonClass}>
              PUSH WARNING
            </button>
            <button
              type="button"
              data-sediment-push="error"
              onClick={() => pushRandom("error")}
              className={buttonClass}
            >
              PUSH ERROR
            </button>
            <button type="button" onClick={replay} className={`${buttonClass} ml-auto`}>
              REPLAY
            </button>
          </footer>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          errors thud in heavy and sink; hover pauses a toast&apos;s timer; swipe
          right or hit x to dismiss — the sediment above resettles
        </p>
      </div>
    </main>
  );
}
