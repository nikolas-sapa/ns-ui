"use client";

import { VellumScrape } from "./component";

export default function VellumScrapeDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / vellum-scrape — drag the rail back, the page shows its own history
      </p>

      <div
        data-vellum-card=""
        className="w-full max-w-lg rounded-[12px] border border-border bg-background p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Spec: checkout-v2</h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ns-muted">
            9 saves
          </span>
        </div>

        <VellumScrape defaultDepth={3} />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Scrub the rail and each overwritten passage reveals who wrote over it,
        exactly where it lived — no separate diff view.
      </p>
    </div>
  );
}
