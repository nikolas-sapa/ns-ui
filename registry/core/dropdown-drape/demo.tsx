"use client";

import { useState } from "react";
import { DrapeMenu } from "./component";

const STATS: [string, string, string][] = [
  ["Requests", "1.24M", "+3.1%"],
  ["p95 latency", "182 ms", "-9 ms"],
  ["Error rate", "0.12%", "±0.00"],
];

const DEPLOYS: [string, string, string, string][] = [
  ["dpl_9f3a2c", "main", "42s", "Ready"],
  ["dpl_71bd08", "main", "51s", "Ready"],
  ["dpl_c04e97", "fix/edge-cache", "1m 12s", "Ready"],
];

export default function DrapeMenuDemo() {
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-6 py-20 text-foreground">
      <div className="w-full max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-widest text-ns-muted">
          ns-ui / dropdown-drape
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          The dropdown is a piece of fabric
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ns-muted">
          Open the Workspace menu: the panel is a live verlet cloth pinned to
          the trigger. It falls under gravity and drapes like an awning, and the
          labels ride the weave until it settles. Sweep the cursor underneath to
          billow the fabric; closing yanks every vertex back up.
        </p>

        <div className="mt-10 rounded-md border border-border bg-surface">
          {/* app header — the drape hangs from the Workspace trigger */}
          <header className="flex items-center gap-5 border-b border-border px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-sm bg-foreground font-mono text-[11px] font-semibold text-background"
              >
                N
              </div>
              <span className="text-sm font-medium">northwind</span>
            </div>
            <DrapeMenu label="Workspace" onSelect={(id) => setLastAction(id)} />
            <nav aria-label="Primary" className="flex items-center gap-1 text-sm text-ns-muted">
              {["Overview", "Deploys", "Activity"].map((t) => (
                <button
                  key={t}
                  type="button"
                  className="rounded-sm px-2.5 py-1.5 transition-colors hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                >
                  {t}
                </button>
              ))}
            </nav>
            <div
              aria-hidden
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background font-mono text-[10px] text-ns-muted"
            >
              NS
            </div>
          </header>

          {/* page body the cloth drapes over */}
          <div className="px-5 pb-6 pt-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">Production overview</h2>
              <span className="font-mono text-xs text-ns-muted">last 24 h</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {STATS.map(([k, v, d]) => (
                <div key={k} className="rounded-sm border border-border bg-background p-3">
                  <p className="text-xs text-ns-muted">{k}</p>
                  <p className="mt-1.5 font-mono text-lg">{v}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ns-muted">{d}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-sm border border-border bg-background">
              {DEPLOYS.map(([id, branch, dur, status], i) => (
                <div
                  key={id}
                  className={`flex items-center gap-4 px-3 py-2.5 font-mono text-xs ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <span className="text-foreground">{id}</span>
                  <span className="text-ns-muted">{branch}</span>
                  <span className="ml-auto text-ns-muted">{dur}</span>
                  <span className="text-ns-muted">{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 font-mono text-xs text-ns-muted" aria-live="polite">
          {lastAction ? `menu → ${lastAction}` : "menu → awaiting selection"}
        </p>
      </div>
    </div>
  );
}
