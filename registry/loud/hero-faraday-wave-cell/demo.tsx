"use client";

import { HeroFaradayWaveCell } from "./component";

export default function HeroFaradayWaveCellDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <HeroFaradayWaveCell>
        <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
            ns-ui / hero-faraday-wave-cell
          </p>
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Above threshold, the surface tessellates
          </h1>
          <p className="max-w-md text-sm text-ns-muted sm:text-base">
            A vibrated fluid layer, oscillating at half its driving frequency, standing in cells
            that never stop reorganizing.
          </p>
          <a
            href="#docs"
            className="pointer-events-auto mt-2 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </HeroFaradayWaveCell>
    </main>
  );
}
