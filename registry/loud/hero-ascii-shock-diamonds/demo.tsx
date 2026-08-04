"use client";

import { ShockTrain } from "./component";

export default function ShockTrainDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* move the pointer right and the nozzle pressure ratio rises: L grows
          with sqrt(M^2 - 1), so the diamonds stretch apart. Left compresses
          them. Vertical position vectors the jet axis. */}
      <ShockTrain>
        <span className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / hero-ascii-shock-diamonds
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Five cells of standing shock.
        </h1>
        <p className="max-w-md text-sm text-muted sm:text-base">
          An underexpanded jet turns through a fan, overshoots, and is turned
          back by an oblique shock that leaves the lip at the Mach angle. It
          reflects off the free boundary and repeats every 1.30&nbsp;D&nbsp;
          &radic;(M&sup2;&minus;1) &mdash; the two families cross on the
          centreline and print the diamonds. Move the pointer across the frame
          to work the throttle: right raises the pressure ratio and pulls the
          train apart, left compresses it.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex w-fit items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Read the docs
        </a>
      </ShockTrain>
    </main>
  );
}
