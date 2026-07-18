"use client";

import { MagneticDock } from "./component";

const ITEMS = ["N", "S", "U", "I", "◆", "▲", "●"];

export default function MagneticDockDemo() {
  return (
    <div className="relative flex min-h-screen items-end justify-center overflow-hidden pb-16">
      <div
        aria-hidden
        className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div className="relative rounded-md border border-black/10 bg-white/60 p-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
        <MagneticDock>
          {ITEMS.map((glyph) => (
            <button
              key={glyph}
              aria-label={`item ${glyph}`}
              className="flex h-12 w-12 items-center justify-center rounded-sm border border-black/10 bg-surface font-mono text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:border-white/10"
            >
              {glyph}
            </button>
          ))}
        </MagneticDock>
      </div>
    </div>
  );
}
