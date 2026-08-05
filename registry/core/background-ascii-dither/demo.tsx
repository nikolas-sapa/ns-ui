"use client";

import { useState } from "react";
import { AsciiDitherMedia } from "./component";

const MODES = ["ascii", "dither", "dot"] as const;
const SOURCES = ["field", "image"] as const;

// inline SVG data URI so the image source path (sampleImage/imageLum) is
// exercised without a network fetch — deterministic, no CORS, no external dep
const SAMPLE_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
      <rect width="320" height="320" fill="#000"/>
      <circle cx="160" cy="130" r="90" fill="#fff"/>
      <rect x="40" y="210" width="240" height="70" fill="#777"/>
    </svg>`
  );

export default function AsciiDitherMediaDemo() {
  const [mode, setMode] = useState<(typeof MODES)[number]>("ascii");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("field");
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <AsciiDitherMedia mode={mode} src={source === "image" ? SAMPLE_IMG : undefined} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex flex-col items-center gap-2">
        <div className="pointer-events-auto flex gap-1 rounded-md border border-border bg-surface/80 p-1 backdrop-blur-md">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-sm px-3 py-1.5 font-mono text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
                mode === m
                  ? "bg-foreground text-background"
                  : "text-ns-muted hover:text-foreground"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="pointer-events-auto flex gap-1 rounded-md border border-border bg-surface/80 p-1 backdrop-blur-md">
          {SOURCES.map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              aria-pressed={source === s}
              className={`rounded-sm px-3 py-1.5 font-mono text-xs transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
                source === s
                  ? "bg-foreground text-background"
                  : "text-ns-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
