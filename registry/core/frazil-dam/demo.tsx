"use client";

import { FrazilDam } from "./component";

export default function FrazilDamDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">ns-ui / frazil-dam</p>
        <FrazilDam />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          crystals drift and pile against the rack, calving downstream every 15-20s
        </p>
      </div>
    </main>
  );
}
