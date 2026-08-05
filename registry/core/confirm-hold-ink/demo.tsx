"use client";

import { useState } from "react";
import { HoldToConfirm } from "./component";

export default function HoldToConfirmDemo() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / confirm-hold-ink — press and hold
      </p>
      <HoldToConfirm
        key={resetKey}
        confirmedLabel="Deleted"
        onConfirm={() => setTimeout(() => setResetKey((k) => k + 1), 1500)}
      >
        Hold to delete
      </HoldToConfirm>
    </div>
  );
}
