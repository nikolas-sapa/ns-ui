"use client";

import { RollCrawl } from "./component";

const ITEMS = [
  "SIGNAL ACQUIRED",
  "GRID STABLE",
  "RELAY 04 ONLINE",
  "NO ANOMALIES",
  "STANDBY",
];

export default function RollCrawlDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / roll-crawl
      </p>
      <div data-ns-roll-focus className="w-full max-w-xl rounded-md border border-border bg-surface px-4 py-3">
        <RollCrawl items={ITEMS} className="text-sm" />
      </div>
      <p className="max-w-md text-center text-xs text-muted">
        Hover to freeze the tape on a cell boundary; each incoming character
        churns through a few glyphs before it settles.
      </p>
    </div>
  );
}
