"use client";

import { useState } from "react";
import { FrostbiteSwitch } from "./component";

const ROWS = [
  {
    id: "maintenance",
    label: "Maintenance freeze",
    desc: "Halt scheduled jobs while the cluster compacts.",
    initial: false,
  },
  {
    id: "cold-storage",
    label: "Cold storage",
    desc: "Archive inactive volumes to the glacier tier.",
    initial: true,
  },
  {
    id: "telemetry",
    label: "Telemetry",
    desc: "Stream node metrics to the control plane.",
    initial: false,
  },
] as const;

const defaults = () =>
  Object.fromEntries(ROWS.map((r) => [r.id, r.initial])) as Record<
    string,
    boolean
  >;

export default function FrostbiteSwitchDemo() {
  const [state, setState] = useState<Record<string, boolean>>(defaults);
  const active = ROWS.filter((r) => state[r.id]).length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / switch-frost — off freezes, on thaws
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">
            Cluster preferences
          </h2>
          <p className="mt-1 text-sm text-ns-muted">
            Cold-path controls for the storage tier. Switching off grows frost
            across the track; switching on melts it before the thumb slides.
          </p>
        </div>

        <ul className="divide-y divide-border">
          {ROWS.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-6 px-6 py-4 transition-colors hover:bg-foreground/[0.03]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {row.label}
                </p>
                <p className="mt-0.5 text-sm text-ns-muted">{row.desc}</p>
              </div>
              <FrostbiteSwitch
                checked={state[row.id] ?? false}
                onCheckedChange={(next) =>
                  setState((s) => ({ ...s, [row.id]: next }))
                }
                aria-label={row.label}
              />
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="font-mono text-xs text-ns-muted">
            {active} of {ROWS.length} active
          </p>
          <button
            type="button"
            onClick={() => setState(defaults())}
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            Restore defaults
          </button>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Click a switch or focus it and press Space. Regrowth is seeded, so each
        freeze traces a fresh dendrite pattern.
      </p>
    </div>
  );
}
