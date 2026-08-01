"use client";

import { useEffect, useState } from "react";
import { SignalTerrain } from "./component";

// deterministic seed walk — identical on server and client (no hydration drift)
function seed() {
  const out: number[] = [];
  let v = 46;
  let s = 1337;
  for (let i = 0; i < 48; i++) {
    s = (s * 16807) % 2147483647;
    v = Math.min(100, Math.max(8, v + (s / 2147483647 - 0.5) * 16));
    out.push(v);
  }
  return out;
}

export default function SignalTerrainDemo() {
  const [series, setSeries] = useState<number[]>(seed);
  const [live, setLive] = useState(true);

  // demo feed: 800ms random walk pushed into the series prop
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      setSeries((prev) => {
        const lastV = prev[prev.length - 1] ?? 46;
        const next = Math.min(100, Math.max(8, lastV + (Math.random() - 0.5) * 16));
        return [...prev.slice(-63), next];
      });
    }, 800);
    return () => clearInterval(id);
  }, [live]);

  const latest = series[series.length - 1] ?? 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / chart-ridgeline-terrain
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">
              THROUGHPUT — LIVE
            </span>
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs tabular-nums text-foreground">
                {latest.toFixed(0)} rps
              </span>
              <button
                type="button"
                onClick={() => setLive((l) => !l)}
                className="min-w-[4.5rem] rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-white/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {live ? "PAUSE" : "RESUME"}
              </button>
            </div>
          </header>
          <SignalTerrain series={series} className="h-[380px]" />
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          move the cursor over the terrain, release for the rebound
        </p>
      </div>
    </main>
  );
}
