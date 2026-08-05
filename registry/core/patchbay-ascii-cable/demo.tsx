"use client";

import { AsciiPatchbay } from "./component";

export default function AsciiPatchbayDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / patchbay-ascii-cable
      </p>

      <div className="inline-block rounded-[12px] border border-border bg-background p-6">
        <AsciiPatchbay />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Drag from one jack to another to patch them — a pulse travels the
        cable once connected. Drag a patched jack away to unplug it.
      </p>
    </div>
  );
}
