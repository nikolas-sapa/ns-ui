"use client";

import { useEffect, useState } from "react";
import { SoundingRail, type SoundingRailStep } from "./component";

interface StepDef {
  id: string;
  label: string;
  time: string;
  detail?: string;
  evidence?: { label: string; value: string }[];
}

// The "restart run" control sits in the run header, above the rail, so it is
// the first interactive element on the page: a generic pass that pokes the
// first control it finds resets the run to frame 0 rather than silently
// toggling the fold state of the rail's first step out from under whatever
// looks at it next.
//
// Six real steps plus a trailing queued placeholder — kept short on purpose:
// every frame's tallest state (5 folded rows + 1 expanded row) stays well
// under the rail's max-h-[420px], so the list never scrolls and the gate's
// target step (read-task, always folded) never gets carried out of view by
// the component's own auto-scroll-to-current behavior.
const DEFS: Record<string, StepDef> = {
  "read-task": {
    id: "read-task",
    label: "Read task description",
    time: "0:00",
    detail: "Parsed the linked issue and the reported repro steps.",
    evidence: [{ label: "source", value: "issue #482" }],
  },
  "locate-files": {
    id: "locate-files",
    label: "Locate relevant files",
    time: "0:02",
    detail: "Searched the repo for the checkout flow and its test file.",
    evidence: [
      { label: "tool", value: "grep" },
      { label: "files", value: "3 matched" },
    ],
  },
  reproduce: {
    id: "reproduce",
    label: "Reproduce the failure",
    time: "0:05",
    detail: "Running the suite twice to confirm the test fails intermittently.",
    evidence: [{ label: "tool", value: "vitest" }],
  },
  "patch-fix": {
    id: "patch-fix",
    label: "Patch debounce wait",
    time: "0:11",
    detail: "Increased the settle delay before asserting.",
    evidence: [{ label: "file", value: "checkout.test.ts" }],
  },
  diagnose: {
    id: "diagnose",
    label: "Diagnose remaining flake",
    time: "0:16",
    detail:
      "The delay wasn't the cause — a stale closure over cart state was.",
    evidence: [{ label: "result", value: "still flaky" }],
  },
  "verify-fix": {
    id: "verify-fix",
    label: "Fix stale closure, re-run suite",
    time: "0:22",
    detail:
      "Moved cart state into a ref and ran the suite 10 times to confirm.",
    evidence: [{ label: "result", value: "43 passed x10" }],
  },
  changelog: {
    id: "changelog",
    label: "Write changelog entry",
    time: "",
  },
};

function s(id: keyof typeof DEFS, status: SoundingRailStep["status"]): SoundingRailStep {
  const d = DEFS[id]!;
  return {
    id: d.id,
    label: d.label,
    time: d.time || undefined,
    detail: d.detail,
    evidence: d.evidence,
    status,
  };
}

const FRAMES: SoundingRailStep[][] = [
  [s("read-task", "done"), s("locate-files", "done"), s("reproduce", "running")],
  [
    s("read-task", "done"),
    s("locate-files", "done"),
    s("reproduce", "done"),
    s("patch-fix", "running"),
  ],
  [
    s("read-task", "done"),
    s("locate-files", "done"),
    s("reproduce", "done"),
    s("patch-fix", "failed"),
    s("diagnose", "running"),
  ],
  [
    s("read-task", "done"),
    s("locate-files", "done"),
    s("reproduce", "done"),
    s("patch-fix", "failed"),
    s("diagnose", "done"),
    s("verify-fix", "running"),
  ],
  [
    s("read-task", "done"),
    s("locate-files", "done"),
    s("reproduce", "done"),
    s("patch-fix", "failed"),
    s("diagnose", "done"),
    s("verify-fix", "done"),
    s("changelog", "pending"),
  ],
];

export default function SoundingRailDemo() {
  const [frame, setFrame] = useState(0);
  // Pause is real state, not a ref read inside the timeout: reading a ref there
  // meant the tick fired, saw "paused", and returned *without rescheduling*, so
  // hovering the panel once froze the run permanently instead of pausing it.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const wait = frame === FRAMES.length - 1 ? 3200 : 2200;
    const t = window.setTimeout(() => {
      setFrame((f) => (f + 1) % FRAMES.length);
    }, wait);
    return () => window.clearTimeout(t);
  }, [frame, paused]);

  const steps = FRAMES[frame] ?? [];
  const finished = frame === FRAMES.length - 1;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / sounding-rail
      </p>

      <div className="w-full max-w-xl">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-medium text-foreground">
            Fix flaky checkout test
          </h2>
          <div className="flex shrink-0 items-center gap-3">
            <span className="font-mono text-[11px] text-muted">
              {finished ? "waiting" : "running"}
            </span>
            <button
              onClick={() => setFrame(0)}
              className="rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              restart run
            </button>
          </div>
        </div>

        <div
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
        >
          <SoundingRail steps={steps} label="Fix flaky checkout test — agent run" />
        </div>
      </div>

      <p className="font-mono text-[10px] text-muted">
        hover the panel to pause · click a folded step to expand it
      </p>
    </div>
  );
}
