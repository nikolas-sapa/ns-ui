"use client";

import { CarriageReturn, type CarriageTab } from "./component";

// Hoisted so the component's measurement effect isn't handed a new array
// identity on every parent render.
const TABS: CarriageTab[] = [
  {
    id: "overview",
    label: "Overview",
    content:
      "The carriage rides the rail. Click a tab to the right and it glides over on a spring, stretching with speed. Click back left and it returns the way a typewriter carriage does — faster, with a small ding on arrival.",
  },
  {
    id: "usage",
    label: "Usage",
    content:
      "Arrow keys move selection with roving focus; Home and End jump to the rail's ends. Selection is automatic — the carriage follows focus.",
  },
  {
    id: "api",
    label: "API",
    content:
      "Pass tabs as { id, label, content }. The indicator measures the live DOM, so labels of any width work, and a resize re-seats the carriage without animation.",
  },
  {
    id: "changelog",
    label: "Changelog",
    content:
      "v1 — spring rail travel, velocity stretch, return-direction kick, line-feed panel entry, reduced-motion fallback to instant placement.",
  },
];

export default function CarriageReturnDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / tabs-carriage — the indicator is a carriage on a rail
      </p>
      <div className="w-full max-w-xl rounded-md border border-border bg-surface p-6">
        <CarriageReturn tabs={TABS} />
      </div>
    </div>
  );
}
