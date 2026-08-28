"use client";

import { PlasmaFilamentWander } from "./component";

export default function PlasmaFilamentWanderDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* hold the pointer near the ring — up to 40% of filaments bias their
          NEXT natural reroute toward it; the rest keep wandering on their own
          cadence, so nothing snaps and nothing reads as a spotlight */}
      <PlasmaFilamentWander>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / plasma-filament-wander
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Every path reroutes on its own clock.
        </h1>
        <p className="max-w-md text-sm text-ns-muted sm:text-base">
          Eleven filaments reach for the ring, retract, and regrow toward a new
          point — each on its own staggered cadence, nudged but never dragged
          by the cursor.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </PlasmaFilamentWander>
    </main>
  );
}
