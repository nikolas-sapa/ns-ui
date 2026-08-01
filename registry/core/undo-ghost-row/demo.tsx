"use client";

import { AfterImageList, type AfterImageItem } from "./component";

const DOCS: AfterImageItem[] = [
  { id: "kickoff", title: "Kickoff notes", subtitle: "Edited 2 days ago" },
  { id: "budget", title: "Budget draft v3", subtitle: "Edited yesterday" },
  { id: "vendor", title: "Vendor contract — Meridian", subtitle: "Edited 6 hours ago" },
  { id: "brief", title: "Design brief", subtitle: "Edited 6 hours ago" },
  { id: "launch", title: "Launch checklist", subtitle: "Edited 20 minutes ago" },
];

export default function AfterImageDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-4 text-center font-mono text-xs tracking-widest text-muted">
          ns-ui / undo-ghost-row
        </p>
        <div className="rounded-md border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              Shared documents
            </h2>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted">
              5 files
            </span>
          </div>
          <AfterImageList items={DOCS} />
          <p className="mt-3 font-mono text-[10px] text-muted">
            delete one — the ghost holds its undo for 8s, hover or focus pauses it
          </p>
        </div>
      </div>
    </main>
  );
}
