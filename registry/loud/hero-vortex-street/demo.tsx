"use client";

import { VortexStreet } from "./component";

// Full-viewport field. The component is self-driving: with no pointer
// activity its internal Lissajous driver keeps wandering the canvas and
// shedding the vortex street on its own, so the demo animates without any
// input. Labels are pointer-events-none so they never block the canvas's
// pointer/click handling.
export default function VortexStreetDemo() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <div className="absolute inset-0">
        <VortexStreet />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-8 flex flex-col items-center gap-2 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / hero-vortex-street
        </p>
        <p className="text-xs text-ns-muted">
          Move the cursor to shed vortices; click to stir the field for 3s.
        </p>
      </div>
    </div>
  );
}
