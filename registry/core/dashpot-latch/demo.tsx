"use client";

import { useState } from "react";
import { DashpotLatch } from "./component";

export default function DashpotLatchDemo() {
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / dashpot-latch — pull slowly, a flick oozes back
      </p>

      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6">
        <p className="text-sm font-medium text-foreground">Delete account</p>
        <p className="mt-1 text-sm text-muted">
          Removes your data immediately. This cannot be undone.
        </p>
        <div className="mt-5">
          <DashpotLatch
            key={resetKey}
            label="Delete account"
            confirmedLabel="Account deleted"
            onConfirm={() => {
              setTimeout(() => setResetKey((k) => k + 1), 1600);
            }}
          />
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Drag the handle slowly and steadily — it glides at a capped speed.
        A quick flick only earns a sliver before it oozes back. Focus the
        handle and hold Enter for the same 1.5s gate with a visible countdown
        ring.
      </p>
    </div>
  );
}
