"use client";

import { CoreSampleScroll } from "./component";

export default function CoreSampleScrollDemo() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* intro block above the pinned stage */}
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-24 text-center">
        <p className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / core-sample-scroll
        </p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
          Take a core sample of the stack
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted">
          Scroll to drive the drill. Five strata, one platform — from the pixels
          at the surface down to the bedrock it all stands on. The vein marks
          the seam everything depends on.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a
            href="#core"
            className="rounded-sm bg-foreground px-4 py-2 font-mono text-xs text-background transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            start drilling
          </a>
          <a
            href="#field-notes"
            className="rounded-sm border border-border bg-surface px-4 py-2 font-mono text-xs text-muted transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            read the survey
          </a>
        </div>
        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          bore hole NS-01 · 128.00 m planned depth · 5 strata logged
        </p>
      </section>

      {/* the pinned scroll story */}
      <div id="core">
        <CoreSampleScroll />
      </div>

      {/* grounding section after the track so the story lands somewhere */}
      <section id="field-notes" className="mx-auto max-w-3xl px-6 py-24">
        <p className="font-mono text-xs tracking-[0.25em] text-muted">
          field notes
        </p>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">
          Every layer, logged
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          The cross-section above is generated once per resize into an offscreen
          atlas — value-noise grain, quantized to three grays, one accent vein.
          Use the band labels on the left edge to jump straight to a stratum.
        </p>
        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
          {[
            ["strata", "5 bands"],
            ["grain", "3px cells"],
            ["vein", "1 seam"],
            ["depth", "128 m"],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface p-4">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                {k}
              </dt>
              <dd className="mt-1 font-mono text-sm text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
