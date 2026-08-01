"use client";

import { DecalPeel } from "./component";

// The component drives itself in demo mode: an internal script (using the
// same progress/release code paths as real drag/keyboard input) peels partway
// and re-sticks with the slappy spring, then peels past the tear threshold so
// the decal tears free, flutters, and re-adheres — looping. It pauses itself
// whenever a real pointer or keyboard interaction takes over.
export default function DecalPeelDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / decal-peel
      </p>

      <DecalPeel demo />

      <p className="max-w-md text-center text-xs text-muted">
        Drag a corner to peel, or hold Space — release past 70% and the decal
        tears free, flutters, and re-adheres where it lands.
      </p>
    </div>
  );
}
