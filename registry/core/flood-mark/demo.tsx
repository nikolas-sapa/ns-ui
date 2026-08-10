"use client";

import { useState } from "react";
import { FloodMark } from "./component";

// 30 days of p99 request latency (ms) — a believable pager-noisy week 2 and
// a quieter tail, so dragging the mark across the p95 detent visibly swings
// "would have fired" between a handful and a couple dozen.
const LATENCY_MS = [
  210, 240, 195, 260, 305, 220, 190, 410, 520, 480, 390, 460, 610, 440, 250,
  230, 260, 275, 300, 245, 210, 195, 640, 590, 470, 260, 240, 220, 205, 260,
];

export default function FloodMarkDemo() {
  const [threshold, setThreshold] = useState(480);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / flood-mark
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Set the alert threshold against real history
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Drag the ─── line up and down through the last 30 days of p99
          latency. Every day above it flips from a muted dot to a solid ▴ —
          the line below always states exactly what that setting would have
          cost in alerts.
        </p>

        <div className="mt-5 rounded-md border border-border bg-background p-5">
          <FloodMark
            label="p99 latency"
            history={LATENCY_MS}
            value={threshold}
            onValueChange={setThreshold}
            min={0}
            max={700}
            step={5}
            unit="ms"
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          drag anywhere in the field · arrows step ±5ms · shift+arrow jumps
          p50 / p95 / p99
        </p>
      </div>
    </main>
  );
}
