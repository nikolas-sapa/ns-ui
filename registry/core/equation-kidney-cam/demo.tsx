"use client";

import { EquationKidneyCam } from "./component";

// A product page: sections separated by a plain rule, except the rule's
// midpoint tick is quietly riding the real equation-of-time curve — never
// resetting, never triggered by scroll, just an ambient, non-uniform drift.
export default function EquationKidneyCamDemo() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / equation-kidney-cam
      </p>

      <section className="mt-6">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          Scheduling that accounts for drift
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ns-muted">
          Every job is queued against a mean clock, then corrected against
          the apparent one at dispatch time — the two rarely agree by more
          than a few minutes, but they never agree by zero.
        </p>
      </section>

      <EquationKidneyCam className="my-10" />

      <section>
        <h2 className="text-lg font-semibold text-foreground">
          Reads, not writes
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ns-muted">
          Correction values are looked up, never recomputed live — the same
          discipline a watch's cam follower keeps: read the edge, don&apos;t
          re-derive the curve.
        </p>
      </section>

      <EquationKidneyCam className="my-10" />

      <section>
        <h2 className="text-lg font-semibold text-foreground">Pricing</h2>
        <p className="mt-3 text-sm leading-relaxed text-ns-muted">
          Included at every tier. Drift correction never metered separately.
        </p>
      </section>
    </main>
  );
}
