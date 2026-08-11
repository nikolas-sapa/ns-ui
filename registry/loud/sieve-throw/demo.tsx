"use client";

import { SieveThrow } from "./component";

// The resting state is the deck ITSELF: the overlay renders open with the whole
// charge spread across five screens and the shaker already running, so a still
// frame catches grain mid-hop rather than a page with a search button on it.
// Opened for display, so it deliberately does not seize focus on mount — the
// modal behaviour (autofocus, trap) engages once the user opens it.
export default function SieveThrowDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <SieveThrow defaultOpen fieldLabel="Query — sets the grain size">
        <div className="relative h-screen w-full overflow-hidden">
          <div aria-hidden="true" className="absolute inset-0 flex justify-between px-6 sm:px-12">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="h-full w-px bg-border" />
            ))}
          </div>
          <div className="relative flex h-full w-full flex-col justify-between px-6 py-5 sm:px-12 sm:py-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              Charge / 48 grains
            </p>
            <h1 className="max-w-3xl text-[clamp(2.5rem,10vw,6rem)] font-medium leading-[0.92] tracking-tight text-foreground">
              Sized on
              <br />
              the screen
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              Press Search, or Tab to it
            </p>
          </div>
        </div>
      </SieveThrow>
    </main>
  );
}
