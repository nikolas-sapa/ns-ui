"use client";

import { GalleryAsciiGradientOrientation } from "./component";

export default function GalleryAsciiGradientOrientationDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / gallery-ascii-gradient-orientation
      </p>
      <div className="w-full max-w-2xl">
        <GalleryAsciiGradientOrientation tileCount={9} columns={3} />
      </div>
      <p className="max-w-md text-center text-xs text-ns-muted">
        Every tile runs its own generative noise field and sketches only its
        strongest edges, keyed to the field&apos;s own gradient angle.
      </p>
    </div>
  );
}
