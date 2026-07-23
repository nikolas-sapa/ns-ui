"use client";

import { DriftStamp } from "./component";

// Fixed offsets from "now" at render time — DriftStamp's own <time> element
// carries suppressHydrationWarning (the documented pattern for a live
// relative-time node whose datetime/text are expected to differ between the
// server-rendered instant and the client's), so recomputing "now" here on
// each render is safe and keeps the four rows genuinely fresh whenever this
// page loads rather than aging out of their buckets.
const NOW = Date.now();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const ROWS = [
  { id: "r1", who: "auth-service deploy", date: new Date(NOW - 8_000) },
  { id: "r2", who: "billing-api rollback", date: new Date(NOW - 4 * MIN) },
  { id: "r3", who: "search-index reindex", date: new Date(NOW - 2 * HOUR) },
  { id: "r4", who: "media-transcode upgrade", date: new Date(NOW - 420 * DAY) },
];

export default function DriftStampDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / drift-stamp — hover or focus a stamp for the exact moment
      </p>
      <div className="w-full max-w-sm overflow-hidden rounded-md border border-border bg-surface">
        {ROWS.map((row, i) => (
          <div
            key={row.id}
            data-drift-target={i === 0 ? "" : undefined}
            className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 text-sm last:border-b-0"
          >
            <span className="text-foreground">{row.who}</span>
            <DriftStamp date={row.date} />
          </div>
        ))}
      </div>
    </div>
  );
}
