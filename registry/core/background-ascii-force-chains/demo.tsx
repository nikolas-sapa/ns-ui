"use client";

import { ForceChains } from "./component";

export default function ForceChainsDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <ForceChains />
      </div>
      {/*
        Sweep track for the card's synthetic pointer: the autoplay driver runs a
        pointer-path sweep across the vertical centre of its target box, and the
        stress cone needs depth beneath the indenter to fan out. This band puts
        the sweep across the upper third of the packing. pointer-events:none, so
        the driver's hit test skips it and the events land on the canvas.
      */}
      <div
        data-indent-track
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[36%]"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        <p className="rounded-md border border-border bg-surface/80 px-4 py-2 font-mono text-xs text-muted backdrop-blur-md">
          ns-ui / background-ascii-force-chains — only contacts above 1.9x the
          mean force are inked; move the pointer in and a stress cone opens
          beneath it
        </p>
      </div>
    </div>
  );
}
