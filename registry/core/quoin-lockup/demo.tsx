"use client";

import { QuoinLockup } from "./component";

export default function QuoinLockupDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">ns-ui / quoin-lockup</p>
        <div className="aspect-[4/3] w-full rounded-md border border-border bg-background p-2">
          <QuoinLockup />
        </div>
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          pressure creeps down, tiles pie out of plane, the key re-locks the form quoin by quoin —
          the arrangement never changes, only how tightly it is locked up
        </p>
      </div>
    </main>
  );
}
