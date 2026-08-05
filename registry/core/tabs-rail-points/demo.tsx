"use client";

import { PointsThrow, type PointsThrowTab } from "./component";

// Hoisted so the measurement effect isn't handed a new array identity on
// every parent render.
const TABS: PointsThrowTab[] = [
  {
    id: "overview",
    label: "Overview",
    content:
      "The rail runs the full width of the row at rest. Click another tab and the points are thrown — the raised siding bends off the base line and travels to the new tab rather than a puck jumping between slots.",
  },
  {
    id: "usage",
    label: "Usage",
    content:
      "Arrow keys move selection with roving focus and automatic activation; Home and End jump to the row's ends. Selection is carried entirely by aria-selected — the rail is decoration.",
  },
  {
    id: "api",
    label: "API",
    content:
      "Pass tabs as { id, label, content }. Geometry is measured from the live DOM, so tabs of any width work, and a resize re-seats the rail without a tween.",
  },
  {
    id: "changelog",
    label: "Changelog",
    content:
      "v1 — continuous rail with a travelling siding, ease-out-expo vertex tween, directional panel slide-fade, reduced-motion instant reroute + crossfade.",
  },
];

export default function PointsThrowDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / tabs-rail-points — the indicator is one rail, thrown to a new siding
      </p>
      <div className="w-full max-w-xl rounded-md border border-border bg-surface p-6">
        <PointsThrow tabs={TABS} />
      </div>
    </div>
  );
}
