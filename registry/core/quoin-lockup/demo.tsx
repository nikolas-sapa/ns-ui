"use client";

import { QuoinLockup } from "./component";

export default function QuoinLockupDemo() {
  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-background p-6">
      <p className="mb-3 shrink-0 font-mono text-xs tracking-widest text-ns-muted">ns-ui / quoin-lockup</p>
      {/* the frame takes whatever height is left, so the chase always composes
          inside the card rather than running past its bottom edge */}
      <div className="min-h-0 w-full flex-1 rounded-md border border-border bg-background p-2">
        <QuoinLockup />
      </div>
    </main>
  );
}
