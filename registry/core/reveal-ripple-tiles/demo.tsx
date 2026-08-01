"use client";

import { useState } from "react";
import { RippleUnfold } from "./component";

const TAGS = ["Brand system", "Print", "Motion"];

export default function RippleUnfoldDemo() {
  const [run, setRun] = useState(0);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / ripple-unfold
        </p>

        <article className="overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">
              SELECTED WORK — 04
            </span>
            <button
              type="button"
              onClick={() => setRun((r) => r + 1)}
              className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              REPLAY
            </button>
          </header>

          <RippleUnfold
            key={run}
            className="aspect-[16/10]"
            aria-label="Case study cover — Meridian identity system"
          />

          <footer className="flex flex-wrap items-start justify-between gap-4 border-t border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-mono text-sm tracking-wide text-foreground">
                MERIDIAN — IDENTITY SYSTEM
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
                Editorial identity and motion language for a satellite-imaging
                studio: one orbital mark, a strict mono grid, and print that
                behaves like instrumentation.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {TAGS.map((t) => (
                  <span
                    key={t}
                    className="rounded-sm border border-border px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-3">
              <span className="font-mono text-xs tabular-nums text-muted">
                2026
              </span>
              <a
                href="#"
                className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                VIEW CASE STUDY
              </a>
            </div>
          </footer>
        </article>

        <p className="mt-3 font-mono text-[11px] text-muted">
          unfolds on scroll-into-view — replay to watch the ripple again, then
          move the cursor across the image to stir the water
        </p>
      </div>
    </main>
  );
}
