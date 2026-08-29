"use client";

import { SpallFace } from "./component";

export default function SpallFaceDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <SpallFace />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        <p className="rounded-md border border-border bg-surface/80 px-4 py-2 font-mono text-xs text-ns-muted backdrop-blur-md">
          ns-ui / spall-face — the face conveys upward-fresh, flakes lift, tip,
          and fall away every 1.3-2s, exposing fresh rock beneath
        </p>
      </div>
    </div>
  );
}
