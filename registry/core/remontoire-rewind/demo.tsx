"use client";

import { useEffect, useRef, useState } from "react";
import { RemontoireRewind } from "./component";

export default function RemontoireRewindDemo() {
  const [value, setValue] = useState(0);
  const pausedRef = useRef(false);

  // a real transfer for the controlled instance below: climbs to 100 then
  // holds briefly and restarts, unrelated to the remontoire's own rhythm.
  useEffect(() => {
    let t = 0;
    let v = 0;
    let holdUntil = 0;
    const step = () => {
      const now = performance.now();
      if (!pausedRef.current) {
        if (v >= 100) {
          if (holdUntil === 0) {
            holdUntil = now + 1800;
          } else if (now >= holdUntil) {
            v = 0;
            holdUntil = 0;
            setValue(0);
          }
        } else {
          v = Math.min(100, v + 3 + Math.random() * 6);
          setValue(v);
        }
      }
      t = window.setTimeout(step, 220 + Math.random() * 260);
    };
    t = window.setTimeout(step, 400);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / remontoire-rewind</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          spring winds tight, trips, dumps one constant kick, rewinds
        </p>
      </header>

      <div className="flex min-h-[calc(100vh-3.75rem)] flex-col items-center justify-center gap-10 px-6">
        <div
          className="flex w-full max-w-md flex-col gap-8 rounded-xl border border-border bg-surface px-8 py-10"
          onPointerEnter={() => {
            pausedRef.current = true;
          }}
          onPointerLeave={() => {
            pausedRef.current = false;
          }}
        >
          <RemontoireRewind label="Syncing workspace" />
          <RemontoireRewind label="Uploading backup.tar" value={value} />
        </div>
        <p className="font-mono text-[10px] text-ns-muted">hover the panel to pause the transfer below</p>
      </div>
    </main>
  );
}
