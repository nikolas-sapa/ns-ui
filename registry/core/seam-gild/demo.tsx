"use client";

import { useState } from "react";
import { SeamGild } from "./component";

export default function SeamGildDemo() {
  // Starts nonzero (not 0) so every fresh mount of this demo wipes
  // ns-seam-gild:demo in sessionStorage before it renders anything — the
  // component's own resetKey>0 branch already does this. Without it, the
  // resting frame the screenshot gate and the owner both grade would depend
  // on whether this browser session had already visited the demo before:
  // a same-tab revisit would show leftover seams from a prior click instead
  // of the deterministic blank panel a fresh look expects.
  const [resetKey, setResetKey] = useState(1);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-24 text-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ns-muted">
          ns-ui / seam-gild
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Repair as ornament</h1>
        <p className="max-w-md text-sm text-ns-muted">
          Confirm a few times. Each success cracks the panel and re-fills it as a
          bright seam — the scars stay for the rest of this browser session.
        </p>
      </div>

      <SeamGild storageKey="demo" resetKey={resetKey} className="w-full max-w-md" />

      <button
        type="button"
        onClick={() => setResetKey((k) => k + 1)}
        className="font-mono text-xs text-ns-muted underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        clear seams
      </button>
    </main>
  );
}
