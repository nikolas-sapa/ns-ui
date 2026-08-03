"use client";

import { WaveformAsciiScrub } from "./component";

export default function WaveformAsciiScrubDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">ns-ui / waveform-ascii-scrub</p>
      <WaveformAsciiScrub duration={214} />
    </div>
  );
}
