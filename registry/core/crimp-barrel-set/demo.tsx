"use client";

import { CrimpBarrelSet } from "./component";

// two independent "attach" controls, each running the same 4.6s
// close/hold/retract/idle demonstration cycle on its own clock, unforced —
// press either one to fire an immediate crimp on top of the ambient loop.
export default function CrimpBarrelSetDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-14 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / crimp-barrel-set
      </p>

      <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-6">
          <span className="text-xs text-ns-muted">Bank account</span>
          <CrimpBarrelSet label="Link account" doneLabel="Linked" />
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-6">
          <span className="text-xs text-ns-muted">Slack workspace</span>
          <CrimpBarrelSet label="Connect" doneLabel="Connected" />
        </div>
      </div>

      <p className="max-w-md text-center font-mono text-[10px] leading-relaxed text-ns-muted">
        open-barrel crimp cycle — dies close, seat, and retract on a 4.6s
        demonstration loop; a press fires one crimp immediately, then the
        loop resumes
      </p>
    </div>
  );
}
