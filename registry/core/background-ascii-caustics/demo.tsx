"use client";

import { CausticVeil } from "./component";

export default function CausticVeilDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <CausticVeil />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        <p className="rounded-md border border-border bg-surface/80 px-4 py-2 font-mono text-xs text-muted backdrop-blur-md">
          ns-ui / background-ascii-caustics — the pointer is a lens, the web
          focuses toward it
        </p>
      </div>
    </div>
  );
}
