"use client";

import { LugCageTally } from "./component";

export default function LugCageTallyDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-ns-muted">
        ns-ui / lug-cage-tally
      </p>

      <div
        data-lug-cage-tally-hero
        className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-border bg-surface px-8 py-10"
      >
        <LugCageTally className="h-28" label="Syncing workspace" />
        <p className="text-center text-sm text-foreground">Syncing workspace…</p>
      </div>

      <p className="max-w-sm text-center font-mono text-[10px] text-ns-muted">
        five wheels at mutually-prime speeds, each engaged pin nudging the tally bar forward
      </p>
    </main>
  );
}
