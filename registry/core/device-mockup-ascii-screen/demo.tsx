"use client";

import { DeviceMockupAsciiScreen } from "./component";

export default function DeviceMockupAsciiScreenDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / device-mockup-ascii-screen
      </p>
      <DeviceMockupAsciiScreen />
      <p className="max-w-md text-center text-xs text-ns-muted">
        The screen is a live ASCII raster with a scanline sweep. Drag the
        handle (or use arrow keys) to tilt the frame — the raster resamples
        to match.
      </p>
    </div>
  );
}
