"use client";

import { TrayWeep } from "./component";

// A section-divider band between two ordinary content blocks — the product
// surface this replaces. Purely ambient, no synthetic input required.
export default function TrayWeepDemo() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="max-w-md text-center font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / tray-weep
        </p>
      </section>

      <div data-tray-weep-stage className="relative h-[420px] w-full overflow-hidden">
        <TrayWeep />
      </div>

      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <p className="max-w-md text-center text-sm text-ns-muted">
          A stack of trays froths continuously as vapor bubbles through submerged caps, liquid
          creeping toward the weir and spilling down a tray, while any cap running short on vapor
          weeps liquid back down through itself. Hover a band to dwell the vapor there.
        </p>
      </section>
    </div>
  );
}
