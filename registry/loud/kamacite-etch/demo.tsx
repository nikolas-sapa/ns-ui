"use client";

import { KamaciteEtch } from "./component";

export default function KamaciteEtchDemo() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0">
        <KamaciteEtch />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center">
        <p className="rounded-md border border-border bg-surface/80 px-4 py-2 font-mono text-xs text-ns-muted backdrop-blur-md">
          ns-ui / kamacite-etch — Widmanstätten lath structure at four
          octahedral angles, developing under a slow diagonal acid etch
        </p>
      </div>
    </div>
  );
}
