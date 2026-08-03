"use client";

import { useEffect, useState } from "react";
import { StatTileAsciiArrive } from "./component";

// Ticks each tile to a new value on a loop, held back well past the gate's
// ~1s idle screenshot so the resting frame always shows fully condensed
// digits, never mid-condensation ink.
export default function StatTileAsciiArriveDemo() {
  const [mrr, setMrr] = useState(48200);
  const [latency, setLatency] = useState(112);
  const [uptime, setUptime] = useState(99.95);

  useEffect(() => {
    const start = setTimeout(() => {
      const id = setInterval(() => {
        setMrr((v) => (v === 48200 ? 52900 : 48200));
        setLatency((v) => (v === 112 ? 87 : 112));
        setUptime((v) => (v === 99.95 ? 99.99 : 99.95));
      }, 3200);
      return () => clearInterval(id);
    }, 4000);
    return () => clearTimeout(start);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-surface p-5">
          <StatTileAsciiArrive value={mrr} label="mrr · usd" />
        </div>
        <div className="rounded-md border border-border bg-surface p-5">
          <StatTileAsciiArrive value={latency} label="p95 latency" suffix="ms" />
        </div>
        <div className="rounded-md border border-border bg-surface p-5">
          <StatTileAsciiArrive value={uptime} label="uptime" suffix="%" />
        </div>
      </div>
    </main>
  );
}
