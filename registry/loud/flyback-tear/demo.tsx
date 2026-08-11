"use client";

import { FlybackTear } from "./component";

// The caption is rasterized into the signal itself, so it rolls, tears and
// burns into the phosphor with the rest of the picture. Everything else is
// ordinary DOM type on tokens, sitting on the glass.
export default function FlybackTearDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <FlybackTear caption={"NO\nSIGNAL"}>
        {/* a token scrim, not a colour literal — the tube spans the full value
            range in both themes, so unbacked type would sit on near-white and
            near-black within the same line */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-6 pb-14 text-center sm:pb-20">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / flyback-tear
            </p>
            <p className="max-w-sm text-sm text-foreground sm:text-base">
              Vertical hold is losing its grip. Drag the beam across the face and
              watch the phosphor keep the stroke.
            </p>
          </div>
          <a
            href="#docs"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Read the docs
          </a>
        </div>
      </FlybackTear>
    </main>
  );
}
