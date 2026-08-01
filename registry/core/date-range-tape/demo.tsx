"use client";

import { useState } from "react";
import { SpanTape, type SpanTapeRange } from "./component";

const NIGHTLY_RATE = 214;

function nights(range: SpanTapeRange | null) {
  if (!range) return 0;
  const ua = Date.UTC(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
  const ub = Date.UTC(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
  return Math.round((ub - ua) / 86400000);
}

export default function SpanTapeDemo() {
  const [range, setRange] = useState<SpanTapeRange | null>(null);
  const n = nights(range);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / date-range-tape
      </p>

      <div className="w-full max-w-sm rounded-md border border-border bg-background">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">Cabin on Lake Verity</h2>
          <p className="mt-1 text-sm text-muted">
            Pick your dates — the tape measures the stay as you drag, not after.
          </p>
        </div>

        <div className="flex flex-col items-center px-6 py-5">
          <SpanTape label="Stay dates" value={range} onValueChange={setRange} />
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="font-mono text-xs text-muted">
            {range
              ? `${n} night${n === 1 ? "" : "s"} · $${(n * NIGHTLY_RATE).toLocaleString()}`
              : "No dates selected"}
          </p>
          <button
            type="button"
            disabled={!range}
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reserve
          </button>
        </div>
      </div>

      <p className="max-w-sm text-center text-xs text-muted">
        Click a day to hook the tape, move toward another to extend it — the
        count prints on the free end. Click again (or Enter) to lock it,
        Escape to let it recoil back to zero.
      </p>
    </div>
  );
}
