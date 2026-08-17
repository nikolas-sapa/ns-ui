"use client";

import { ThallusSiege } from "./component";

// The mosaic grows on its own; everything here is ordinary DOM type on
// tokens, sitting over it behind a scrim so copy stays readable regardless
// of which cell happens to be under it at any given moment.
export default function ThallusSiegeDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <ThallusSiege>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex flex-col items-center gap-3 rounded-lg bg-background/75 px-7 py-5 backdrop-blur-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              ns-ui / thallus-siege
            </p>
            <h1 className="max-w-md text-xl font-medium text-foreground sm:text-2xl">
              We build the way lichen holds ground.
            </h1>
            <p className="max-w-sm text-sm text-ns-muted">
              A dozen colonies renegotiating the same patch of rock, slower
              than you can watch — come back in a minute and the border will
              have moved.
            </p>
          </div>
          <a
            href="#careers"
            className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            See open roles
          </a>
        </div>
      </ThallusSiege>
    </main>
  );
}
