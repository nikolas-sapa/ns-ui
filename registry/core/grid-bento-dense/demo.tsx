"use client";

import { BentoGrid, type BentoCell } from "./component";

const CELLS: BentoCell[] = [
  {
    id: "uptime",
    meta: "reliability",
    title: "API Uptime",
    body: "99.982% rolling 30 days",
    size: "1x1",
  },
  {
    id: "latency",
    meta: "performance",
    title: "P95 Latency",
    body: "142ms — down 8ms week over week",
    size: "2x1",
  },
  {
    id: "incidents",
    meta: "status",
    title: "Open Incidents",
    body: "0 active, 2 resolved this week",
    size: "1x1",
  },
  {
    id: "oncall",
    meta: "team",
    title: "On Call",
    body: (
      <ul className="space-y-0.5">
        <li>Primary — Reyes</li>
        <li>Secondary — Okoye</li>
        <li>Escalation — Lindqvist</li>
      </ul>
    ),
    size: "1x2",
  },
  {
    id: "deploys",
    meta: "velocity",
    title: "Deploys",
    body: "14 this week across 6 services",
    size: "1x1",
  },
  {
    id: "spend",
    meta: "infra",
    title: "Monthly Spend",
    body: "$4,210 — 3% under budget",
    size: "1x1",
  },
  {
    id: "errors",
    meta: "quality",
    title: "Error Rate",
    body: "0.04% of requests",
    size: "1x1",
  },
];

export default function BentoGridDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">ns-ui / grid-bento-dense</p>
        <div className="rounded-md border border-border bg-background p-5">
          <BentoGrid cells={CELLS} cols={4} defaultFeaturedId="latency" />
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          click or Enter/Space any tile to feature it — the rest of the grid re-packs around it, and
          arrow keys move by screen position, not markup order
        </p>
      </div>
    </main>
  );
}
