"use client";

import { useState } from "react";
import { CatenaryContactStagger } from "./component";

export default function CatenaryContactStaggerDemo() {
  const [degraded, setDegraded] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / catenary-contact-stagger
      </p>

      <div className="w-full max-w-sm rounded-xl border border-border bg-surface px-6 py-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
            sync status
          </span>
          <button
            type="button"
            onClick={() => setDegraded((d) => !d)}
            className="rounded-sm border border-border px-2 py-1 font-mono text-[10px] text-ns-muted transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ns-accent"
          >
            {degraded ? "degraded" : "nominal"}
          </button>
        </div>

        <div style={{ height: 72 }}>
          <CatenaryContactStagger
            connectionQuality={degraded ? 0.45 : 1}
            label={degraded ? "Connection sync status, degraded" : "Connection sync status, nominal"}
          />
        </div>
      </div>

      <p className="max-w-xs text-center font-mono text-[10px] text-ns-muted">
        the strip tracks the wire&apos;s stagger every span; a rare arc
        punctuates only the span where contact genuinely breaks
      </p>
    </div>
  );
}
