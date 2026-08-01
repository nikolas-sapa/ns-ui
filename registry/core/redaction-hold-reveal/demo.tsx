"use client";

import { UnderInk } from "./component";

export default function UnderInkDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / redaction-hold-reveal
        </p>
        <div className="rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">
              INCIDENT-4211 · POSTMORTEM
            </span>
            <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
              redacted
            </span>
          </header>
          <div className="px-5 py-5 text-sm leading-[1.9] text-foreground">
            <p>
              At 03:12 UTC, <UnderInk label="name">Priya Raghavan</UnderInk> was
              paged after the payments queue backed up. The root cause was a
              credential rotated without notice on the{" "}
              <UnderInk label="system">vault-prod-eu2</UnderInk> cluster. A
              temporary key was issued to{" "}
              <UnderInk label="email">p.raghavan@helpmarq.com</UnderInk> and the
              backlog of <UnderInk label="amount">$1,284,900</UnderInk> in held
              transfers cleared by 04:07 UTC. Access for the deprecated service
              account <UnderInk label="account">svc-ledger-old</UnderInk> has
              been revoked.
            </p>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          hold a bar to peek — the ink flows back after release. click to keep
          it lifted.
        </p>
      </div>
    </main>
  );
}
