"use client";

import { ChromaTide } from "./component";

// Full-viewport background. Purely ambient — no rAF-only-on-hover gating —
// so the card demonstrates itself with no synthetic input.
export default function ChromaTideDemo() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <div data-chroma-tide-stage className="absolute inset-0">
        <ChromaTide />
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
        <div className="flex flex-col items-center gap-3 rounded-lg bg-background/30 px-8 py-6 backdrop-blur-md">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/80">
            ns-ui / chroma-tide
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white">A slow current of color</h1>
        </div>
      </div>
    </div>
  );
}
