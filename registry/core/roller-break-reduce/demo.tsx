"use client";

import { useState } from "react";
import { RollerBreakReduce } from "./component";

export default function RollerBreakReduceDemo() {
  const [activeStage, setActiveStage] = useState<number | undefined>(undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / roller-break-reduce
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Ingesting build-cache-v2.tar
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          A stream of chunks narrows in size at each of four break stages, the
          way a mill's corrugated roll pairs shear grain down through
          successive passes rather than crushing it in one.
        </p>
        <div className="mt-5 overflow-hidden rounded-md border border-border bg-surface">
          <RollerBreakReduce activeStage={activeStage} className="h-72 w-full" />
          <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-3">
            <span className="font-mono text-[11px] text-ns-muted">
              optional activeStage highlight, luminance only
            </span>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveStage((cur) => (cur === i ? undefined : i))}
                  aria-pressed={activeStage === i}
                  className="rounded-sm border border-border px-2 py-1 font-mono text-[11px] text-ns-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent aria-pressed:border-foreground/30 aria-pressed:text-foreground"
                >
                  B{i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
