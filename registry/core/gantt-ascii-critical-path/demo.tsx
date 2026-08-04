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
          The heavy accented bars are the zero-float chain the ship date actually rides on. Every
          other bar trails one dot per day of slack. Drag a bar, or focus one and press
          Arrow&nbsp;Left / Arrow&nbsp;Right — the forward and backward pass reruns and criticality
          moves to whichever chain went tight.
        </p>
      </div>
    </main>
  );
}
