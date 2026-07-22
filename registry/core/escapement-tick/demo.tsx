"use client";

import { useCallback, useEffect, useRef } from "react";
import { EscapementTick, type EscapementTickHandle } from "./component";

// a burst of arrivals — the point is watching the escapement meter these into
// tick-tick-tick admission instead of a dogpile. Order here is oldest first;
// the component prepends, so they settle newest-on-top like a real feed.
const BURST = [
  { title: "Deploy started", detail: "sha 8a41f0c → production" },
  { title: "Build completed", detail: "turbo build · 38s · cache hit 94%" },
  { title: "3 new commits pushed", detail: "feat/checkout-retry" },
  { title: "PR #482 opened", detail: "fix: race in webhook retry" },
  { title: "CI passed", detail: "118 specs · 0 failed" },
  { title: "Review requested", detail: "from Jonas Weber" },
  { title: "Preview ready", detail: "pr-482.preview.ns-ui.dev" },
  { title: "Deploy promoted", detail: "sha 8a41f0c · us-east" },
];

export default function EscapementTickDemo() {
  const tickRef = useRef<EscapementTickHandle>(null);
  const timeoutsRef = useRef<number[]>([]);

  // spaced tighter than the escapement's own settle time on purpose — a real
  // burst, so arrivals queue up behind the gate instead of each one finding
  // it open. Spacing these across separate setTimeout ticks (rather than one
  // synchronous loop) also means later arrivals prepend above rows that have
  // already been released, so their eventual release visibly pushes the
  // already-settled rows down — the connected chain, not just top-down fill.
  const runBurst = useCallback(() => {
    for (const id of timeoutsRef.current) clearTimeout(id);
    tickRef.current?.clear();
    timeoutsRef.current = BURST.map((item, i) =>
      window.setTimeout(() => tickRef.current?.arrive(item), i * 140)
    );
  }, []);

  useEffect(() => {
    runBurst();
    const timeouts = timeoutsRef;
    return () => {
      for (const id of timeouts.current) clearTimeout(id);
      timeouts.current = [];
    };
  }, [runBurst]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / escapement-tick
        </p>
        <EscapementTick ref={tickRef} aria-label="Deploy activity feed" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-muted">
            the fork releases one item at a time — never a dogpile
          </p>
          <button
            type="button"
            data-burst-trigger
            onClick={runBurst}
            className="shrink-0 cursor-pointer rounded-sm border border-border px-2.5 py-1 font-mono text-[10px] tracking-widest text-muted transition-colors duration-150 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            SIMULATE BURST
          </button>
        </div>
      </div>
    </main>
  );
}
