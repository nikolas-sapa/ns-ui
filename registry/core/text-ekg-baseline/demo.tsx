"use client";

import { useRef } from "react";
import { CardioBaseline, type CardioBaselineHandle } from "./component";

export default function CardioBaselineDemo() {
  const ekgRef = useRef<CardioBaselineHandle>(null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / cardio-baseline
        </p>
        <div className="rounded-md border border-border bg-surface px-8 pb-8 pt-24">
          <CardioBaseline
            ref={ekgRef}
            bpm={50}
            className="font-mono text-4xl font-semibold tracking-tight text-foreground"
          >
            SYSTEMS NOMINAL
          </CardioBaseline>
          <div className="mt-14 flex items-center justify-between gap-4 border-t border-border pt-4">
            <span className="font-mono text-[11px] tracking-widest text-muted">
              50 BPM — SINUS RHYTHM
            </span>
            <button
              type="button"
              onClick={() => ekgRef.current?.beat()}
              className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              TRIGGER EVENT
            </button>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          each beat travels the baseline and throws the glyphs up the waveform
        </p>
      </div>
    </main>
  );
}
