"use client";

import { SheetAsciiRange } from "./component";

export default function SheetAsciiRangeDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / sheet-ascii-range</p>
      <SheetAsciiRange />
      <p className="max-w-md text-center text-xs text-ns-muted">
        Drag across cells, or focus one and Shift+Arrow to extend. The border draws itself in box-drawing
        glyphs and the status bar recomputes live.
      </p>
    </div>
  );
}
