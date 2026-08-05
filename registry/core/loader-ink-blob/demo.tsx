"use client";

import { useEffect, useState } from "react";
import { ThinkingGlyph, type ThinkingGlyphState } from "./component";

const CYCLE: ThinkingGlyphState[] = ["idle", "thinking", "listening", "speaking", "success", "error"];

// Self-driving: cycles through all six states on its own so the card and the
// live preview both demonstrate every motion signature without input.
export default function ThinkingGlyphDemo() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % CYCLE.length), 1800);
    return () => clearInterval(id);
  }, []);

  const state = CYCLE[i];

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-8 bg-background px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / loader-ink-blob
        </p>
        <p className="text-xs text-ns-muted">Cycles through all six assistant states.</p>
      </div>
      <div data-loader-ink-blob-stage className="flex items-center justify-center rounded-lg border border-border bg-surface p-10">
        <ThinkingGlyph state={state} size={64} />
      </div>
      <p className="font-mono text-xs text-ns-muted">{state}</p>
    </div>
  );
}
