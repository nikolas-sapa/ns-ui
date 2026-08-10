"use client";

import { useState } from "react";
import { HysteresisLatch } from "./component";

const ROWS = [
  {
    id: "two-factor",
    label: "Two-factor authentication",
    desc: "Require a second factor on every sign-in.",
    initial: true,
  },
  {
    id: "auto-backup",
    label: "Automatic backups",
    desc: "Snapshot the database nightly to cold storage.",
    initial: true,
  },
  {
    id: "prod-writes",
    label: "Production write-protection",
    desc: "Block writes from anything but the migration runner.",
    initial: false,
  },
] as const;

const defaults = () =>
  Object.fromEntries(ROWS.map((r) => [r.id, r.initial])) as Record<
    string,
    boolean
  >;

export default function HysteresisLatchDemo() {
  const [state, setState] = useState<Record<string, boolean>>(defaults);
  const guarded = ROWS.filter((r) => state[r.id]).length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / hysteresis-latch — cheap to arm, costly to disarm
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-background">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">
            Safety rails
          </h2>
          <p className="mt-1 text-sm text-ns-muted">
            Every guard here turns on with a click. Turning one off needs a
            drag past the far edge of the track, or Space then a confirming
            Enter.
          </p>
        </div>

        <ul className="divide-y divide-border">
          {ROWS.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-6 px-6 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {row.label}
                </p>
                <p className="mt-0.5 text-sm text-ns-muted">{row.desc}</p>
              </div>
              <HysteresisLatch
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
            {guarded} of {ROWS.length} guarded
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
        Click a switch to arm or turn it on. Drag the thumb past the far edge
        to actually turn one off — the faint loop under the track is the
        threshold you're tracing.
      </p>
    </div>
  );
}
