"use client";

import { GanttAsciiCriticalPath } from "./component";

export default function GanttAsciiCriticalPathDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-3xl flex-col items-center gap-5">
        <p className="self-start font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          ns-ui / gantt-ascii-critical-path
        </p>
        <div className="flex w-full justify-center overflow-x-auto rounded-md border border-border bg-surface p-7">
          <GanttAsciiCriticalPath />
        </div>
        <p className="max-w-xl text-center text-xs leading-relaxed text-muted">
          The heavy accented bars are the critical path. Drag one, or nudge it with the arrow keys,
          to reschedule.
        </p>
      </div>
    </main>
  );
}
