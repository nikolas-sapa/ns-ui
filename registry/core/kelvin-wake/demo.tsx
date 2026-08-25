"use client";

import { KelvinWake } from "./component";

export default function KelvinWakeDemo() {
  return (
    <div className="min-h-screen bg-background">
      <KelvinWake />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Kelvin Wake Nav
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ns-muted">
          The active-item indicator is a point source drifting along the
          rail. Click any link and it eases there, trailing a wake whose
          V-shaped envelope holds a constant 19.47&deg; half-angle no matter
          how fast the source is moving — Kelvin&rsquo;s 1887 result for a
          point disturbance on deep water.
        </p>
      </main>
    </div>
  );
}
