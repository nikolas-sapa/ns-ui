"use client";

import { MetaballMerge, type MetaballItem } from "./component";

// a release-approval group: three engineers currently hold the approval, the
// on-call contractor does not. Module-scope so the array identity is stable.
const APPROVERS: MetaballItem[] = [
  { id: "mara", label: "Mara Chen" },
  { id: "jonas", label: "Jonas Weber" },
  { id: "aiko", label: "Aiko Tanaka" },
  { id: "ravi", label: "Ravi Patel", member: false },
];

export default function MetaballMergeDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-14">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / status-metaball-merge
      </p>

      <div className="w-full max-w-[480px] rounded-xl border border-border bg-surface px-6 pb-6 pt-3">
        <MetaballMerge items={APPROVERS} label="Release approvers" />
      </div>

      <p className="max-w-md text-center font-mono text-[10px] leading-relaxed text-muted">
        one contour per group — merged members share a necked outline, whoever
        leaves pinches off into a loop of their own
      </p>
    </div>
  );
}
