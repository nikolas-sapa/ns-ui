"use client";

import { useState } from "react";
import { AsciiMagnifyLens } from "./component";

export default function AsciiMagnifyLensDemo() {
  const [key, setKey] = useState(0);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / lens-ascii-magnify
      </p>

      <AsciiMagnifyLens
        key={key}
        text="MOVE THE LENS ACROSS THIS TYPE"
        className="max-w-2xl text-center text-2xl font-semibold tracking-[0.06em] sm:text-3xl"
      />

      <button
        onClick={() => setKey((k) => k + 1)}
        className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-ns-muted transition-colors duration-150 hover:border-ns-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        reset lens
      </button>
    </div>
  );
}
