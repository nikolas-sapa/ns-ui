"use client";

import { GridBentoAscii, type BentoCell } from "./component";

const CELLS: [BentoCell, BentoCell, BentoCell, BentoCell] = [
  { id: "a", title: "Realtime", description: "Sub-100ms sync across every client." },
  { id: "b", title: "Typed", description: "End-to-end types, zero codegen." },
  { id: "c", title: "Offline", description: "Local-first, reconciles on reconnect." },
  { id: "d", title: "Open", description: "MIT, self-hostable." },
];

export default function GridBentoAsciiDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / grid-bento-ascii
      </p>
      <GridBentoAscii cells={CELLS} />
      <p className="max-w-md text-center text-xs text-muted">
        Click a tile: it re-spans across every track, seam included, and the
        ┼ junction has nowhere left to be drawn. Click again to collapse.
      </p>
    </div>
  );
}
