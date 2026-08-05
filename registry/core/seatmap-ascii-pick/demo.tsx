"use client";

import { SeatmapAsciiPick } from "./component";

export default function SeatmapAsciiPickDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / seatmap-ascii-pick</p>
      <SeatmapAsciiPick />
      <p className="max-w-md text-center text-xs text-ns-muted">
        Drag a marquee across the plan — taken seats and the aisle break the block, and the selection
        snaps to the longest unbroken run.
      </p>
    </div>
  );
}
