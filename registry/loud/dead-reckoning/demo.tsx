"use client";

import { DeadReckoning } from "./component";

export default function DeadReckoningDemo() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
            ns://ui
          </span>
          <span className="font-mono text-xs tracking-[0.25em] text-muted">
            ns-ui / dead-reckoning
          </span>
        </div>
        <a
          href="#docs"
          className="rounded-sm px-2 py-1 font-mono text-xs text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          docs
        </a>
      </header>

      <DeadReckoning
        className="min-h-0 flex-1"
        trail={[
          { label: "Home", tick: "-9m" },
          { label: "Dashboard", tick: "-5m" },
          { label: "Reports", tick: "-1m" },
        ]}
        attemptedPath="/reports/quarterly-9/detail"
        exits={[
          { label: "Back to Dashboard", href: "#" },
          { label: "Search", href: "#" },
          { label: "Home", href: "#" },
        ]}
      />

      <footer className="flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-muted">ERR 404 / route unresolved</span>
        <span className="font-mono text-xs text-muted">trace: dead reckoning / fix doubtful</span>
      </footer>
    </main>
  );
}
