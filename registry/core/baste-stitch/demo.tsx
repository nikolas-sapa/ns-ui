"use client";

import { useEffect, useRef, useState } from "react";
import { BasteStitch, type BasteStatus } from "./component";

// Three rows, three lifecycle states, all visible at rest — the point of
// the component is that no single frame needs motion to be legible. The
// third row's Retry button drives a self-contained retry loop (pending ->
// committed -> failed again) so the card keeps demonstrating the ack/fail
// transitions rather than sitting on one static outcome forever.

export default function BasteStitchDemo() {
  const [renameStatus, setRenameStatus] = useState<BasteStatus>("failed");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      for (const t of timers.current) clearTimeout(t);
    };
  }, []);

  function retry() {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    setRenameStatus("pending");
    timers.current.push(
      setTimeout(() => setRenameStatus("committed"), 900),
      setTimeout(() => setRenameStatus("failed"), 2400)
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs tracking-[0.2em] text-muted uppercase">
        ns-ui / baste-stitch
      </p>

      <div className="w-full max-w-md overflow-hidden rounded-md border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="font-mono text-[11px] text-muted">sprint backlog</span>
          <span className="font-mono text-[11px] text-muted">3 items</span>
        </div>

        <div className="divide-y divide-border">
          <BasteStitch status="pending" itemLabel="item">
            <p className="truncate text-sm text-foreground">Add "Ship dark-mode audit"</p>
            <p className="truncate font-mono text-[11px] text-muted">just now</p>
          </BasteStitch>

          <BasteStitch status="committed" itemLabel="comment">
            <p className="truncate text-sm text-foreground">"Looks good, merging tonight."</p>
            <p className="truncate font-mono text-[11px] text-muted">2m ago</p>
          </BasteStitch>

          <BasteStitch status={renameStatus} onRetry={retry} itemLabel="rename">
            <p className="truncate text-sm text-foreground">Renamed to "Q3 roadmap review"</p>
            <p className="truncate font-mono text-[11px] text-muted">
              {renameStatus === "pending"
                ? "saving…"
                : renameStatus === "committed"
                  ? "saved"
                  : "couldn't save — connection dropped"}
            </p>
          </BasteStitch>
        </div>
      </div>

      <p className="max-w-md text-center font-mono text-[10px] text-muted">
        dashed = provisional, solid = acked, muted + dimmed = rolled back — press Retry
      </p>
    </div>
  );
}
