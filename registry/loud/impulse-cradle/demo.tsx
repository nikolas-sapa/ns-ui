"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImpulseCradle, type ImpulseCradleHandle, type ImpulseSeverity } from "./component";

type DemoEvent = { severity: ImpulseSeverity; title: string; message: string };

// six arrivals against a 3-visible cap — the 4th push is the first eviction,
// so by the time anyone looks, the history disclosure already has entries.
const SEQUENCE: DemoEvent[] = [
  { severity: "info", title: "Build queued", message: "commit 9a41c2 · main" },
  { severity: "info", title: "Tests passing", message: "312/312 · 18s" },
  { severity: "error", title: "Deploy rejected", message: "budget exceeded · 312kB" },
  { severity: "info", title: "Retry scheduled", message: "in 30s · attempt 2" },
  { severity: "error", title: "Webhook timeout", message: "stripe · 4200ms" },
  { severity: "info", title: "Deploy promoted", message: "sha 9a41c2 → production" },
];

const POOL: Record<ImpulseSeverity, DemoEvent[]> = {
  info: [
    { severity: "info", title: "Cache warmed", message: "1,204 routes prefetched" },
    { severity: "info", title: "Preview ready", message: "pr-118 · built in 22s" },
    { severity: "info", title: "Edge synced", message: "3 regions · 40ms" },
  ],
  error: [
    { severity: "error", title: "Function crashed", message: "/api/cart · undefined read" },
    { severity: "error", title: "Migration failed", message: "orders_v2 · dup column" },
    { severity: "error", title: "Rate limit hit", message: "429 · retry-after 12s" },
  ],
};

export default function ImpulseCradleDemo() {
  const stackRef = useRef<ImpulseCradleHandle>(null);
  const timeoutsRef = useRef<number[]>([]);
  const [count, setCount] = useState(0);

  const emit = useCallback((event: DemoEvent) => {
    stackRef.current?.push(event);
    setCount((c) => c + 1);
  }, []);

  const runSequence = useCallback(() => {
    for (const id of timeoutsRef.current) clearTimeout(id);
    timeoutsRef.current = SEQUENCE.map((event, i) =>
      window.setTimeout(() => emit(event), i * 550)
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

  const pushRandom = useCallback((severity: ImpulseSeverity) => {
    const pool = POOL[severity];
    emit(pool[Math.floor(Math.random() * pool.length)]);
  }, [emit]);

  const replay = useCallback(() => {
    stackRef.current?.clear();
    setCount(0);
    runSequence();
  }, [runSequence]);

  const buttonClass =
    "cursor-pointer rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / impulse-cradle
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-ic-push
            onClick={() => pushRandom("info")}
            className={buttonClass}
          >
            PUSH INFO
          </button>
          <button type="button" onClick={() => pushRandom("error")} className={buttonClass}>
            PUSH ERROR
          </button>
          <button type="button" onClick={replay} className={`${buttonClass} ml-auto`}>
            REPLAY
          </button>
        </div>
        <ImpulseCradle ref={stackRef} maxVisible={3} aria-label="Deploy notifications" />
        <p className="mt-3 font-mono text-[11px] text-muted">
          {count} pushed · a new toast strikes the stack, the shunt travels
          down 35ms per row, and past 3 the oldest gets ejected — F6 jumps
          focus here, Escape dismisses, hover/focus pause the clock
        </p>
      </div>
    </main>
  );
}
