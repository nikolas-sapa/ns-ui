"use client";

import { LightTable } from "./component";

export default function LightTableDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / light-table</p>
      <LightTable title="header.bin" />
      <p className="max-w-md text-center text-xs text-ns-muted">
        Hover or focus a byte to bridge hex and ASCII across the seam. Shift+drag or Shift+Arrow selects a
        range — the footer decodes its length, uint16/uint32 and a UTF-8 guess.
      </p>
    </div>
  );
}
