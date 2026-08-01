"use client";

import { useState } from "react";
import { SlideToShatter } from "./component";

export default function SlideToShatterDemo() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-background px-6 py-24 text-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted">
          ns-ui / confirm-slide-shatter
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Destruction is the progress bar
        </h1>
        <p className="max-w-md text-sm text-muted">
          Pull the thumb and the pane fractures under your finger. Let go early
          and the glass heals. Reach the end and it shatters.
        </p>
      </div>

      <div className="flex flex-col items-center gap-8 rounded-md border border-border bg-surface/60 px-12 py-10">
        <p className="font-mono text-[11px] tracking-[0.25em] text-muted">
          SLIDE TO DELETE WORKSPACE
        </p>
        <SlideToShatter
          label="DELETE WORKSPACE"
          confirmedLabel="WORKSPACE DELETED"
          resetKey={resetKey}
        />
        <button
          type="button"
          onClick={() => setResetKey((k) => k + 1)}
          className="font-mono text-xs text-muted underline underline-offset-4 transition-colors hover:text-foreground"
        >
          reset pane
        </button>
      </div>
    </main>
  );
}
