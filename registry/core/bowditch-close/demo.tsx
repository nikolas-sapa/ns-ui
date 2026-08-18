"use client";

import { useState } from "react";
import { BowditchClose, type BowditchCloseResult, type BowditchPoint } from "./component";

// A six-leg plot traverse whose closing sight landed short of vertex 0 — the
// misclosure hairline is visible at rest, no interaction needed to see the
// mechanism this component exists for. Pressing Balance runs the compass
// rule live; the readout below reports what the tool measured, not a canned
// number.
const VERTICES: BowditchPoint[] = [
  { x: 90, y: 230 },
  { x: 60, y: 130 },
  { x: 150, y: 60 },
  { x: 300, y: 55 },
  { x: 380, y: 140 },
  { x: 330, y: 235 },
  { x: 102, y: 216 }, // closing vertex — short of vertex 0, the misclosure
];

export default function BowditchCloseDemo() {
  const [result, setResult] = useState<BowditchCloseResult | null>(null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / bowditch-close
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Close the loop like a real traverse
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Six corners were walked and the closing sight landed short of the
          start — that gap is the misclosure, drawn as an accent hairline,
          never auto-snapped shut. Balance runs the 1807 compass rule: the
          error is spread across every leg in proportion to how far it ran,
          so the long final leg absorbs most of the correction and vertex 0
          never moves.
        </p>

        <div className="mt-5">
          <BowditchClose
            label="Sample plot traverse"
            initialVertices={VERTICES}
            initialClosed
            onBalance={setResult}
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          {result
            ? `balanced — ${result.perimeterMeters.toFixed(0)} m perimeter, ${result.areaHectares.toFixed(2)} ha, closed at 1:${Math.round(result.ratio)}`
            : "arrow keys nudge a focused corner · Balance traverse closes the gap"}
        </p>
      </div>
    </main>
  );
}
