"use client";

import { LogViewerAsciiTail } from "./component";

export default function LogViewerAsciiTailDemo() {
  return (
    // h-screen, not min-h-screen: the pane below is `h-full`, and a parent with
    // only a min-height leaves that percentage indefinite — the log would grow
    // to its full 3600px of rows instead of scrolling inside a bounded pane.
    <div className="flex h-screen flex-col gap-4 overflow-hidden bg-background px-6 py-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          ns-ui / log-viewer-ascii-tail
        </p>
        <p className="font-mono text-[11px] text-muted">
          edge fleet · eu-central-1 · streaming
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <LogViewerAsciiTail aria-label="Edge fleet log, live tail" />
      </div>
    </div>
  );
}
