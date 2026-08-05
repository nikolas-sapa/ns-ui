"use client";

import { useState } from "react";
import { CausticSelect, type CausticSelectOption } from "./component";

const REGIONS: CausticSelectOption[] = [
  { value: "iad1", label: "Washington, D.C.", hint: "iad1" },
  { value: "sfo1", label: "San Francisco", hint: "sfo1" },
  { value: "fra1", label: "Frankfurt", hint: "fra1" },
  { value: "hnd1", label: "Tokyo", hint: "hnd1" },
  { value: "syd1", label: "Sydney", hint: "syd1" },
  { value: "gru1", label: "São Paulo", hint: "gru1" },
  { value: "bom1", label: "Mumbai", hint: "bom1", disabled: true },
];

const FAILOVER: CausticSelectOption[] = [
  { value: "none", label: "No failover" },
  { value: "nearest", label: "Nearest healthy region" },
  { value: "pinned", label: "Pinned secondary", hint: "fra1" },
];

export default function CausticSelectDemo() {
  const [region, setRegion] = useState("fra1");
  const [failover, setFailover] = useState("nearest");

  const regionLabel =
    REGIONS.find((r) => r.value === region)?.hint ?? "unset";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / select-caustic
      </p>

      <div className="w-full max-w-md rounded-md border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-sm font-semibold text-foreground">
            Deployment settings
          </h2>
          <p className="mt-1 text-sm text-ns-muted">
            Where serverless functions execute. The select is frosted glass —
            open it and watch the caustics pool under the active row.
          </p>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">
          <div>
            <label
              htmlFor="demo-project"
              className="mb-1.5 block font-mono text-xs uppercase tracking-[0.14em] text-ns-muted"
            >
              Project
            </label>
            <input
              id="demo-project"
              type="text"
              defaultValue="atlas-api"
              spellCheck={false}
              className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>

          <CausticSelect
            label="Region"
            options={REGIONS}
            value={region}
            onValueChange={setRegion}
          />

          <CausticSelect
            label="Failover"
            options={FAILOVER}
            value={failover}
            onValueChange={setFailover}
            placeholder="Choose a strategy"
          />
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="font-mono text-xs text-ns-muted">
            functions → {regionLabel}
          </p>
          <button
            type="button"
            className="rounded-sm bg-ns-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Save changes
          </button>
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Open with Enter, Space, or the arrow keys. Arrow through the options and
        the light lens follows; type to jump by name; Esc closes and returns
        focus to the trigger.
      </p>
    </div>
  );
}
