"use client";

import { WakeGlyph } from "./component";

export default function WakeGlyphDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <WakeGlyph />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        <p className="rounded-md border border-border bg-surface/80 px-4 py-2 font-mono text-xs text-muted backdrop-blur-md">
          ns-ui / wake-glyph — move the pointer to drag a wake
        </p>
      </div>
    </div>
  );
}
