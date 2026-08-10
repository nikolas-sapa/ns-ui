"use client";

import { useState } from "react";
import { SolventFront } from "./component";

export default function SolventFrontDemo() {
  const [runId, setRunId] = useState(0);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">ns-ui / solvent-front</p>

        <div className="rounded-md border border-border p-6">
          <SolventFront key={runId} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-ns-muted">hover or tab through a band to project its share</p>
          <button
            type="button"
            onClick={() => setRunId((n) => n + 1)}
            className="cursor-pointer whitespace-nowrap rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            RUN AGAIN
          </button>
        </div>
      </div>
    </main>
  );
}
