"use client";

import { useState } from "react";
import { BowWake, type BowWakeItem } from "./component";

const TASKS: BowWakeItem[] = [
  { id: "t1", label: "Draft launch brief", subtitle: "due tomorrow" },
  { id: "t2", label: "Review pricing copy", subtitle: "waiting on legal" },
  { id: "t3", label: "Ship onboarding fix", subtitle: "in progress" },
  { id: "t4", label: "Sync with design", subtitle: "unscheduled" },
  { id: "t5", label: "Triage backlog", subtitle: "12 items" },
  { id: "t6", label: "Prep release notes", subtitle: "draft" },
];

export default function BowWakeDemo() {
  const [last, setLast] = useState<string>("");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="absolute inset-0 [background-image:radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div className="relative w-full max-w-sm">
        <p className="mb-4 text-center font-mono text-xs text-muted">ns-ui / bow-wake</p>
        <div className="rounded-md border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Today</h2>
            <p className="mt-1 text-xs text-muted">
              Drag the grip to reorder. Neighbors shoulder aside as you pass.
            </p>
          </div>

          <BowWake items={TASKS} onReorder={(items) => setLast(items[0]?.label ?? "")} />

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <p className="truncate font-mono text-[10px] text-muted">
              {last ? `top: ${last}` : "drag a row, or grip + space + arrows"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
