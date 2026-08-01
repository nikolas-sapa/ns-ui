"use client";

import { useState } from "react";
import { EventHorizonCommand, type CommandItem } from "./component";

const COMMANDS: CommandItem[] = [
  { id: "deploy-prod", label: "Deploy to production", category: "deploy" },
  { id: "deploy-preview", label: "Deploy preview branch", category: "deploy" },
  { id: "deploy-rollback", label: "Rollback deployment", category: "deploy" },
  { id: "deploy-logs", label: "View deploy logs", category: "deploy" },
  { id: "repo-branch", label: "Create branch", category: "repo" },
  { id: "repo-pr", label: "Open pull request", category: "repo" },
  { id: "repo-search", label: "Search repository", category: "repo" },
  { id: "repo-clone", label: "Clone repository", category: "repo" },
  { id: "ws-theme", label: "Toggle dark theme", category: "workspace" },
  { id: "ws-invite", label: "Invite teammate", category: "workspace" },
  { id: "ws-settings", label: "Open settings", category: "workspace" },
  { id: "ws-copy", label: "Copy project URL", category: "workspace" },
];

const NAV = ["Overview", "Deployments", "Analytics", "Domains", "Settings"];

const DEPLOYS = [
  { sha: "9f2c1ab", branch: "main", note: "fix: edge cache headers", when: "2m ago" },
  { sha: "e410d77", branch: "feat/orbit-ui", note: "feat: palette telemetry", when: "38m ago" },
  { sha: "b83aa02", branch: "main", note: "chore: bump next 15.4", when: "3h ago" },
  { sha: "51d90ce", branch: "fix/redirects", note: "fix: locale redirect loop", when: "7h ago" },
];

export default function EventHorizonCommandDemo() {
  const [lastRun, setLastRun] = useState<CommandItem | null>(null);

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs tracking-[0.25em] text-muted">
          ns-ui / command-palette-orbit
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          Event Horizon Command
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          A Cmd-K palette where results orbit the input — orbital radius is
          inverse match score, so ranking is the gravity sim. The query
          auto-types <span className="font-mono text-foreground">deploy</span>{" "}
          on a loop: strong matches spiral in tight, weak ones fling off the
          field. Arrow keys cycle, Enter consumes the winner into the horizon.
        </p>

        {/* dashboard backdrop with the palette open over it */}
        <div className="relative mt-10 h-[640px] overflow-hidden rounded-md border border-border bg-surface">
          <div className="flex h-full">
            {/* sidebar ghost */}
            <aside className="hidden w-48 shrink-0 border-r border-border p-4 sm:block">
              <div className="mb-6 flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border border-border bg-background" />
                <span className="text-sm font-medium text-foreground">acme / web</span>
              </div>
              <nav className="space-y-1">
                {NAV.map((n, i) => (
                  <div
                    key={n}
                    className={`rounded-sm px-2 py-1.5 text-sm ${
                      i === 1 ? "bg-background text-foreground" : "text-muted"
                    }`}
                  >
                    {n}
                  </div>
                ))}
              </nav>
            </aside>

            {/* main pane */}
            <section className="min-w-0 flex-1 p-6">
              <header className="flex items-center justify-between border-b border-border pb-4">
                <p className="font-mono text-xs text-muted">
                  production &middot; iad1 &middot; next 15.4
                </p>
                <span className="h-6 w-6 rounded-full border border-border bg-background" />
              </header>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  ["Requests", "2.4M"],
                  ["P99 latency", "182 ms"],
                  ["Error rate", "0.12%"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md border border-border bg-background p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                      {k}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{v}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2">
                {DEPLOYS.map((d) => (
                  <div
                    key={d.sha}
                    className="flex items-center gap-3 rounded-sm border border-border bg-background px-3 py-2 text-sm"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                    <span className="font-mono text-xs text-muted">{d.sha}</span>
                    <span className="truncate text-foreground">{d.note}</span>
                    <span className="ml-auto hidden font-mono text-xs text-muted md:inline">
                      {d.branch}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted">{d.when}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* the palette, open over the dimmed app */}
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]">
            <EventHorizonCommand
              commands={COMMANDS}
              autoTypeQuery="deploy"
              autoTypeLoopMs={6000}
              onSelect={(item) => setLastRun(item)}
              className="h-full"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="font-mono text-xs text-muted">
            last run:{" "}
            <span className="text-foreground">
              {lastRun ? lastRun.label : "none — press Enter or click a pill"}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setLastRun(null)}
            className="rounded-sm border border-border bg-surface px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            reset log
          </button>
        </div>
      </div>
    </main>
  );
}
