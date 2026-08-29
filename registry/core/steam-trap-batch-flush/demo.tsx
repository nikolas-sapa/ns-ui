"use client";

import { SteamTrapBatchFlush } from "./component";

// three concurrent instances at different sizes — a random start phase per
// mount means they visibly disagree at t0, exactly as three independent
// buffers filling on their own schedule would.
const DOCS = [
  { title: "Q3 planning deck", size: 20 },
  { title: "Onboarding flow v2", size: 20 },
  { title: "Pricing page copy", size: 20 },
];

export default function SteamTrapBatchFlushDemo() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-12 bg-background px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / steam-trap-batch-flush
      </p>

      <div className="flex items-center gap-6 rounded-xl border border-border bg-surface px-8 py-8">
        <SteamTrapBatchFlush size={60} label="Buffering pending edits" />
        <div>
          <p className="text-sm text-foreground">Buffering pending edits</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ns-muted">
            fills, trips, blows down, refills — continuously
          </p>
        </div>
      </div>

      <ul className="flex w-full max-w-sm flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {DOCS.map((doc) => (
          <li key={doc.title} className="flex items-center gap-3 px-4 py-3">
            <SteamTrapBatchFlush size={doc.size} label={`Syncing ${doc.title}`} />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
              {doc.title}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <SteamTrapBatchFlush
          size={32}
          interactive
          label="Flush pending edits now"
          onFlush={() => {}}
        />
        <span className="font-mono text-[10px] text-ns-muted">
          press to force an early blowdown (trip threshold + blowdown speed unchanged)
        </span>
      </div>
    </main>
  );
}
