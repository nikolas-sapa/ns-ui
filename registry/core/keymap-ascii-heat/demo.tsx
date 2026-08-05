"use client";

import { KeymapAsciiHeat } from "./component";

export default function KeymapAsciiHeatDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / keymap-ascii-heat</p>
      <KeymapAsciiHeat />
      <p className="max-w-md text-center text-xs text-ns-muted">
        Type into the field — each keystroke inks its key, heat decays on a half-life, and the legend
        rescales to whichever key is currently hottest.
      </p>
    </div>
  );
}
