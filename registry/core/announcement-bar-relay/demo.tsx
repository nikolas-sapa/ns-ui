"use client";

import { useState } from "react";
import { AnnouncementBarRelay, type AnnouncementItem } from "./component";

const NOTICES: AnnouncementItem[] = [
  {
    id: "pricing-2026",
    message: "Team plan pricing changes on 1 September.",
    action: { label: "Read the notice", href: "#pricing" },
  },
  {
    id: "maintenance-window",
    message:
      "Scheduled maintenance runs Saturday 02:00–02:30 UTC. Deploys are paused for the window and queued builds resume automatically once it closes.",
    action: { label: "Status page", href: "#status" },
  },
  {
    id: "api-v3-default",
    message: "The v3 API is now the default for new projects. v2 keys keep working until March.",
    action: { label: "Migration guide", href: "#migration" },
    tone: "accent",
  },
];

export default function AnnouncementBarRelayDemo() {
  // The autoplay card presses dismiss on a loop; once the queue empties the bar
  // collapses, so the demo remounts it with a fresh key. `resetOnMount` then
  // clears this demo's own namespaced keys — the host site's storage is never
  // touched, and the card can never end up permanently empty.
  const [run, setRun] = useState(0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8 text-foreground">
      <div className="w-full max-w-[880px] overflow-hidden rounded-lg border border-border bg-background">
        <AnnouncementBarRelay
          key={run}
          items={NOTICES}
          storageKeyPrefix="ns-demo-announcement-relay:"
          resetOnMount
          onExhausted={() => setRun((n) => n + 1)}
        />

        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">northbridge / console</span>
          <nav className="flex items-center gap-5 text-sm text-ns-muted">
            <span className="text-foreground">Overview</span>
            <span>Deployments</span>
            <span>Usage</span>
          </nav>
        </header>

        <div className="px-6 py-8">
          <h1 className="text-xl font-medium tracking-tight">Overview</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-ns-muted">
            Everything here sits under the announcement bar, so the page moves with the message instead of snapping under it
            when one notice hands off to the next.
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-border bg-border">
            {[
              { label: "Requests, 24h", value: "1,482,309" },
              { label: "p95 latency", value: "142 ms" },
              { label: "Error rate", value: "0.04%" },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface px-4 py-4">
                <dt className="font-mono text-[11px] uppercase tracking-wider text-ns-muted">{stat.label}</dt>
                <dd className="mt-1.5 text-lg tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
