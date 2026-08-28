"use client";

import { SleeperRenewalRelay } from "./component";

export default function SleeperRenewalRelayDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / sleeper-renewal-relay</p>
        <SleeperRenewalRelay />
        <SleeperRenewalRelay
          title="Reindexing shard 4/12"
          description="Continuous crawl — one row swaps every 1.3s, never a full-row blink."
        />
      </div>
    </main>
  );
}
