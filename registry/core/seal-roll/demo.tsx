"use client";

import { SealRoll } from "./component";

export default function SealRollDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-5 font-mono text-xs tracking-widest text-ns-muted">ns-ui / seal-roll</p>
        {/* the barrel rolls itself on a loop — watch a full cycle, or use
            Prev/Next/Pause below */}
        <SealRoll />
      </div>
    </main>
  );
}
