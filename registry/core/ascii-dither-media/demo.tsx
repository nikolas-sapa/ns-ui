"use client";

import { useState } from "react";
import { AsciiDitherMedia } from "./component";

const MODES = ["ascii", "dither", "dot"] as const;

export default function AsciiDitherMediaDemo() {
  const [mode, setMode] = useState<(typeof MODES)[number]>("ascii");
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <AsciiDitherMedia mode={mode} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        <div className="pointer-events-auto flex gap-1 rounded-md border border-border bg-surface/80 p-1 backdrop-blur-md">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-sm px-3 py-1.5 font-mono text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                mode === m
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
