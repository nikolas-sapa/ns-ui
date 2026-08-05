"use client";

import { useState } from "react";
import { LigatureMelt } from "./component";

const PHRASES = ["SURFACE TENSION", "LIQUID TYPE", "MELTING POINT"];

export default function LigatureMeltDemo() {
  const [idx, setIdx] = useState(0);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / text-ligature-melt
      </p>
      <LigatureMelt
        text={PHRASES[idx] ?? "SURFACE TENSION"}
        className="text-[clamp(2.5rem,7vw,5rem)] font-semibold tracking-tight text-foreground"
      />
      <p className="font-mono text-xs text-ns-muted">
        sweep the cursor across the line — leave to snap the ligatures apart
      </p>
      <button
        onClick={() => setIdx((i) => (i + 1) % PHRASES.length)}
        className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-ns-muted transition-colors duration-150 hover:border-ns-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        next phrase
      </button>
    </div>
  );
}
