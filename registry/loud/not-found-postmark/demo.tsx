"use client";

import { DeadLetter } from "./component";

export default function DeadLetterDemo() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
            ns://ui
          </span>
          <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
            ns-ui / not-found-postmark
          </span>
        </div>
        <a
          href="#docs"
          className="rounded-sm px-2 py-1 font-mono text-xs text-ns-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          docs
        </a>
      </header>

      <DeadLetter
        className="min-h-0 flex-1"
        path="/billing/invoices/2024-Q9/detail"
        hops={[
          { label: "Edge", detail: "edge-04" },
          { label: "Origin", detail: "origin-gw" },
          { label: "Router", detail: "svc-router" },
        ]}
        recentPages={[{ label: "Dashboard" }, { label: "Settings" }, { label: "Docs" }]}
      />

      <footer className="flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-ns-muted">ERR 404 / route unresolved</span>
        <span className="font-mono text-xs text-ns-muted">trace: dead letter / no such address</span>
      </footer>
    </main>
  );
}
