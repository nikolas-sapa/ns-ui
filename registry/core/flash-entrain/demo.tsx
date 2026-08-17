"use client";

import { FlashEntrain } from "./component";

export default function FlashEntrainDemo() {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="absolute inset-0">
        <FlashEntrain />
      </div>
      <div className="pointer-events-none relative flex min-h-screen flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">Waitlist open</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          We&apos;ll let you know
        </h1>
        <p className="max-w-[42ch] text-sm leading-relaxed text-ns-muted">
          Nothing to do here but wait. The field behind this text is doing its own thing — watch long enough
          and it goes from scattered twinkle to unison, then quietly falls apart again.
        </p>
      </div>
    </div>
  );
}
