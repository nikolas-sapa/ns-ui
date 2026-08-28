"use client";

import { HelicorderLineWrap } from "./component";

export default function HelicorderLineWrapDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / helicorder-line-wrap
        </p>
        <div className="rounded-md border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-ns-muted">
              Station monitor
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-ns-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
              live
            </span>
          </div>
          <div className="h-72 w-full">
            <HelicorderLineWrap />
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          the pen steps down to a fresh line every time it runs off the right margin
        </p>
      </div>
    </main>
  );
}
