"use client";

import { CausticCoverflow } from "./component";

const ITEMS = [
  { title: "Meltwater channel, dawn", meta: "JAN 07 2026 · 01", seed: 11 },
  { title: "Condensation study", meta: "JAN 19 2026 · 02", seed: 27 },
  { title: "Caustic net, tank 4", meta: "FEB 02 2026 · 03", seed: 43 },
  { title: "Refraction drift", meta: "FEB 21 2026 · 04", seed: 58 },
  { title: "Surface tension map", meta: "MAR 05 2026 · 05", seed: 71 },
  { title: "Foam decay series", meta: "MAR 18 2026 · 06", seed: 86 },
  { title: "Light pool census", meta: "APR 02 2026 · 07", seed: 94 },
];

export default function CausticCoverflowDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-5xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / gallery-coverflow-caustic
        </p>
        <section className="rounded-md border border-border bg-surface px-6 py-10 sm:px-10 sm:py-12">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 font-mono text-[11px] tracking-widest text-ns-muted">
                GLASSHOUSE ARCHIVE
              </p>
              <h1
                className="font-semibold tracking-tight text-foreground"
                style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", lineHeight: 1.1 }}
              >
                Field notes
              </h1>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ns-muted">
                Seven observations from the winter tank series — light pools
                drift across each frosted pane while the archive is at rest.
              </p>
            </div>
            <span className="font-mono text-[11px] tracking-widest text-ns-muted">
              ARCHIVE / 07
            </span>
          </div>
          <CausticCoverflow
            items={ITEMS}
            initialIndex={3}
            aria-label="Field notes gallery"
          />
        </section>
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          drag to scrub, flick for momentum — velocity fringes the focused
          card&apos;s edges red/blue and settles at rest; wheel steps one card,
          arrow keys work when the stage is focused
        </p>
      </div>
    </main>
  );
}
