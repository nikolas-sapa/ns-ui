"use client";

import { MagneticDock } from "./component";

const ITEMS = ["N", "S", "U", "I", "◆", "▲", "●", "✦", "■"];

export default function MagneticDockDemo() {
  return (
    <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div className="relative">
        <div className="relative rounded-md border border-black/10 bg-white/60 p-3 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
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
        {/* ambient contact shadow — grounds the dock like a real taskbar */}
        <div
          aria-hidden
          className="absolute inset-x-6 -bottom-3 h-3 rounded-full bg-black/15 blur-md dark:bg-black/40"
        />
      </div>
    </div>
  );
}
