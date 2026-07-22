"use client";

import { useState } from "react";
import { BreakerSnap } from "./component";

export default function BreakerSnapDemo() {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / breaker-snap — travel mechanics, not a flick
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">Platform access</h2>
          <p className="mt-1 text-sm text-muted">
            Drag the lever past the midpoint to commit — release early and it springs back.
            Space or Enter flips it instantly.
          </p>
        </div>

        <div className="px-6 py-6">
          <BreakerSnap label="API access" checked={checked} onCheckedChange={setChecked}>
            <div className="flex flex-col gap-1">
              <label htmlFor="bs-key" className="text-xs font-medium text-foreground">
                Live API key
              </label>
              <input
                id="bs-key"
                type="text"
                readOnly
                value="sk_live_••••••••4f2a"
                className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bs-hook" className="text-xs font-medium text-foreground">
                Webhook URL
              </label>
              <input
                id="bs-hook"
                type="text"
                placeholder="https://"
                className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="bs-env" className="text-xs font-medium text-foreground">
                Environment
              </label>
              <select
                id="bs-env"
                defaultValue="production"
                className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
              </select>
            </div>

            <label htmlFor="bs-analytics" className="flex items-center gap-2 text-xs text-foreground">
              <input id="bs-analytics" type="checkbox" defaultChecked className="h-3.5 w-3.5" />
              Send usage analytics
            </label>
          </BreakerSnap>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="font-mono text-xs text-muted">{checked ? "energized" : "de-energized"}</p>
          <button
            type="button"
            onClick={() => setChecked(false)}
            className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Reset
          </button>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Turning it off cuts the fieldset instantly, no fade. Turning it on sparks once at the
        contact.
      </p>
    </div>
  );
}
