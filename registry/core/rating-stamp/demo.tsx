"use client";

import { useMemo, useState } from "react";
import { ChopPress } from "./component";

const PRIORITY_NAMES = ["Low", "", "", "", "Critical"];
const EFFORT_NAMES = ["Small", "", "Large"];
const CONFIDENCE_NAMES = ["Unsure", "", "", "", "Certain"];

export default function ChopPressDemo() {
  const [priority, setPriority] = useState(3);
  const [effort, setEffort] = useState(0);
  const [confidence, setConfidence] = useState(4);

  const priorityWord = useMemo(() => {
    if (priority === 0) return "not set";
    return PRIORITY_NAMES[priority - 1] || `level ${priority}`;
  }, [priority]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / rating-stamp — stamp a level, no stars
      </p>

      <div className="w-full max-w-lg rounded-md border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <p className="font-mono text-xs text-ns-muted">BUG-1142</p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">
            Sidebar collapses on window resize below 900px
          </h2>
          <p className="mt-1 text-xs text-ns-muted">
            Filed by A. Reyes &middot; 2 days ago
          </p>
        </div>

        <div className="flex flex-col gap-6 px-5 py-5">
          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-foreground">Priority</label>
            <ChopPress
              className="rating-stamp-autoplay"
              label="Priority"
              max={5}
              value={priority}
              onValueChange={setPriority}
              levelNames={PRIORITY_NAMES}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-foreground">Estimated effort</label>
            <ChopPress
              label="Estimated effort"
              max={3}
              value={effort}
              onValueChange={setEffort}
              levelNames={EFFORT_NAMES}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-foreground">Repro confidence</label>
            <ChopPress
              label="Repro confidence"
              max={5}
              value={confidence}
              onValueChange={setConfidence}
              levelNames={CONFIDENCE_NAMES}
              size="sm"
            />
          </div>

          <p aria-live="polite" className="font-mono text-xs text-ns-muted">
            priority / {priorityWord} &middot; effort /{" "}
            {effort === 0 ? "not set" : EFFORT_NAMES[effort - 1] || effort} &middot;
            confidence / {confidence}/5
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-ns-muted transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-sm bg-ns-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Save triage
          </button>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Click a seal to stamp that level, or focus the row and use arrow keys.
        Hovering (or tabbing to) a seal dashes the outline of whatever would
        change, before anything commits. Lowering the value drains the marks
        right to left.
      </p>
    </div>
  );
}
