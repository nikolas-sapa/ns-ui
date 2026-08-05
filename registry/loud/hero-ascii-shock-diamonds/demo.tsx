"use client";

import { ShockTrain } from "./component";

export default function ShockTrainDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* move the pointer right and the nozzle pressure ratio rises: L grows
          with sqrt(M^2 - 1), so the diamonds stretch apart. Left compresses
          them. Vertical position vectors the jet axis. */}
      <ShockTrain>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / hero-ascii-shock-diamonds
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Three cells of standing shock.
        </h1>
        <p className="max-w-md text-sm text-ns-muted sm:text-base">
          Move the pointer across the frame to work the throttle: right raises
          the nozzle pressure ratio and pulls the diamonds apart, left
          compresses them.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </ShockTrain>
    </main>
  );
}
