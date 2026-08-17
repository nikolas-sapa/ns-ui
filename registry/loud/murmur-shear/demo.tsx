"use client";

import { MurmurShear } from "./component";

// Full-viewport field, self-driving on its own clock — no pointer or click
// input does anything here. Every ~12s (H=5/min) an invisible falcon crosses
// the flock; the escape turn it triggers propagates neighbour-to-neighbour
// faster than the flock itself drifts, so a dark band shears across the
// murmuration and fades a couple seconds later. Hero copy sits on a
// bg-background/70 scrim because a density knot can pass under any line of
// it and the ink spans the full luminance range.
export default function MurmurShearDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <MurmurShear passesPerMinute={5}>
        <div className="pointer-events-none flex h-full w-full flex-col items-center justify-end gap-4 px-6 pb-14 text-center sm:pb-20">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / murmur-shear
            </p>
            <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              Thousands, moving as one
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              A wave of information can outrun the flock that carries it.
            </p>
          </div>
        </div>
      </MurmurShear>
    </main>
  );
}
