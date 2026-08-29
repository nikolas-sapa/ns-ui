"use client";

import { InterlaceFieldComb } from "./component";

export default function InterlaceFieldCombDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <InterlaceFieldComb>
        {/* a token scrim, not a colour literal — the field spans a wide tonal
            range in both themes, so unbacked type would sit on it unevenly */}
        <div className="flex flex-col items-center gap-3 rounded-lg bg-background/70 px-7 py-5 backdrop-blur-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
            ns-ui / interlace-field-comb
          </p>
          <p className="max-w-sm text-sm text-foreground sm:text-base">
            Two fields, drawn a beat apart, keep drifting out of register and
            snapping back into one clean weave.
          </p>
        </div>
        <a
          href="#docs"
          className="pointer-events-auto mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </InterlaceFieldComb>
    </main>
  );
}
