"use client";

import { useState } from "react";
import { PeriscopeSweep, type PeriscopeDestination } from "./component";

const WORKSPACES: PeriscopeDestination[] = [
  { id: "overview", label: "Overview", bearing: 0, hint: "home" },
  { id: "team", label: "Team", bearing: 40 },
  { id: "billing", label: "Billing", bearing: 80 },
  { id: "analytics", label: "Analytics", bearing: 120 },
  { id: "deployments", label: "Deployments", bearing: 165 },
  { id: "domains", label: "Domains", bearing: 210 },
  { id: "storage", label: "Storage", bearing: 250 },
  { id: "settings", label: "Settings", bearing: 300 },
];

const PANEL_COPY: Record<string, string> = {
  overview: "Project health at a glance — builds, traffic, and the last few deploys.",
  team: "Members, roles, and pending invites for acme/web.",
  billing: "Plan, usage this cycle, and payment method.",
  analytics: "Requests, P99 latency, and error rate over the last 24h.",
  deployments: "Deploy history, rollbacks, and build logs.",
  domains: "Custom domains, DNS records, and certificate status.",
  storage: "Blob and edge-config usage across environments.",
  settings: "Project defaults, env vars, and integrations.",
};

export default function PeriscopeSweepDemo() {
  const [current, setCurrent] = useState("overview");

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / periscope-sweep
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          Periscope Sweep
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Every workspace lives at a fixed bearing on an invisible ring — drag,
          scroll, or use the arrow keys to sweep past them. Only the item under
          the reticle resolves fully; neighbors compress toward the edges of
          the slit. Bearings persist, so{" "}
          <span className="font-mono text-foreground">analytics</span>{" "}stays
          at 120&deg; every time you come back.
        </p>

        <div className="mt-8">
          <PeriscopeSweep
            destinations={WORKSPACES}
            value={current}
            onValueChange={setCurrent}
            storageKey="acme-web-demo"
          />
        </div>

        <div className="mt-6 rounded-md border border-border bg-background p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            now viewing
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {WORKSPACES.find((w) => w.id === current)?.label}
          </h2>
          <p className="mt-1.5 text-sm text-muted">{PANEL_COPY[current]}</p>
        </div>
      </div>
    </main>
  );
}
