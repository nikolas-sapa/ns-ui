"use client";

import { SolargraphHero } from "./component";

// abstract grayscale trust marks — believable logo row without real brands
const MARKS: { name: string; glyph: React.ReactNode }[] = [
  {
    name: "Meridian",
    glyph: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="2" />
      </svg>
    ),
  },
  {
    name: "Octant",
    glyph: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: "Parallel",
    glyph: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M3 12.5 8 3.5l5 9Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: "Hollow",
    glyph: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
        <rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="6" y="6" width="4" height="4" />
      </svg>
    ),
  },
];

export default function SolargraphHeroDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-4xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / hero-long-exposure
        </p>
        <SolargraphHero className="rounded-md border border-border bg-surface">
          <div className="flex flex-col items-center px-8 py-16 text-center sm:px-14 sm:py-24">
            <p className="mb-6 font-mono text-[11px] tracking-widest text-ns-muted">
              LONG-EXPOSURE INTERFACES
            </p>
            <h1
              className="max-w-2xl font-semibold text-foreground"
              style={{
                fontSize: "clamp(2.25rem, 5.5vw, 3.75rem)",
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
              }}
            >
              Infrastructure that develops over time
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ns-muted">
              Solargraph records every deploy, rollback, and incident as a
              single accumulating exposure — your system&apos;s history burned
              into one picture instead of scattered across dashboards.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#start"
                className="rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                Start exposure
              </a>
              <a
                href="#docs"
                className="rounded-sm border border-border px-5 py-2.5 text-sm font-medium text-ns-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                Read the docs
              </a>
            </div>
            <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 opacity-70">
              {MARKS.map((m) => (
                <span
                  key={m.name}
                  className="flex items-center gap-2 text-ns-muted"
                >
                  {m.glyph}
                  <span className="font-mono text-xs tracking-widest">
                    {m.name.toUpperCase()}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </SolargraphHero>
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          move the cursor across the card — streaks accumulate and fade on a 4s
          half-life, like a long-exposure photograph
        </p>
      </div>
    </main>
  );
}
