"use client";

import { FeatureGridAsciiRule, type FeatureGridAsciiRuleItem } from "./component";

const ITEMS: FeatureGridAsciiRuleItem[] = [
  { id: "realtime", title: "Realtime sync", description: "Sub-100ms updates across every client.", relatedIds: ["offline", "typed"] },
  { id: "typed", title: "Typed API", description: "End-to-end types, zero codegen.", relatedIds: ["realtime", "open"] },
  { id: "offline", title: "Offline-first", description: "Local-first, reconciles on reconnect.", relatedIds: ["realtime"] },
  { id: "access", title: "Access control", description: "Row-level policies, per workspace.", relatedIds: ["audit"] },
  { id: "audit", title: "Audit log", description: "Every mutation, who and when.", relatedIds: ["access", "open"] },
  { id: "open", title: "Open source", description: "MIT, self-hostable.", relatedIds: ["typed", "audit"] },
];

export default function FeatureGridAsciiRuleDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / feature-grid-ascii-rule
      </p>
      <div className="w-full max-w-2xl">
        <FeatureGridAsciiRule items={ITEMS} cols={3} />
      </div>
      <p className="max-w-md text-center text-xs text-ns-muted">
        Hover or focus a feature: box-drawing connectors route through the
        gutter to every related feature, then retract on leave.
      </p>
    </div>
  );
}
