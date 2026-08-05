"use client";

import { TruchetWeave } from "./component";

export default function TruchetWeaveDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <TruchetWeave />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        <p className="rounded-md border border-border bg-surface/80 px-4 py-2 font-mono text-xs text-ns-muted backdrop-blur-md">
          ns-ui / background-truchet-weave — tile orientation is the sign of the
          field; the pointer bends it and the seams re-route
        </p>
      </div>
    </div>
  );
}
