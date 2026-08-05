"use client";

import { DomainWalls } from "./component";

export default function DomainWallsDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <DomainWalls />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        <p className="rounded-md border border-border bg-surface/80 px-4 py-2 font-mono text-xs text-ns-muted backdrop-blur-md">
          ns-ui / background-ascii-domain-walls — Ising lattice at 0.92 Tc, only
          the boundaries are inked; the pointer is a magnetic field
        </p>
      </div>
    </div>
  );
}
