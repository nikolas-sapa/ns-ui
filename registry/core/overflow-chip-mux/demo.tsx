"use client";

import { OverflowChipMux } from "./component";

export default function OverflowChipMuxDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / overflow-chip-mux
        </p>
        <OverflowChipMux ariaLabel="Enemy tags" />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          only 8 slots render at once — the rest round-robin in, NES
          sprite-multiplexing style
        </p>
      </div>
    </main>
  );
}
