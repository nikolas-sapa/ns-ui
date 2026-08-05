"use client";

import { AsciiDitherMedia } from "../background-ascii-dither/component";
import { GlassButton } from "../button-glass/component";
import { GlassPanel } from "./component";

export default function GlassPanelDemo() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <AsciiDitherMedia mode="dot" cellSize={16} />
      </div>
      <GlassPanel className="w-80 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / surface-glass
        </p>
        <h2 className="mt-3 text-lg font-semibold tracking-tight">
          Frosted, grained, rimmed.
        </h2>
        <p className="mt-2 text-sm text-ns-muted">
          Blur, saturation, noise grain and a lit top rim — the full glass
          stack, over anything that moves.
        </p>
        <div className="mt-5">
          <GlassButton>Continue</GlassButton>
        </div>
      </GlassPanel>
    </div>
  );
}
