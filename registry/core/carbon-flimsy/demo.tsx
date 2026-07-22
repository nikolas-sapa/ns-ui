"use client";

import { useState } from "react";
import { CarbonFlimsy } from "./component";

export default function CarbonFlimsyDemo() {
  const [status, setStatus] = useState("Waiting for a title…");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / carbon-flimsy
      </p>

      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold text-foreground">New project</h2>
        <p className="mt-1 text-sm text-muted">
          The slug underneath rides along with every keystroke in the title
          &mdash; a carbon copy that tears free the moment you edit it directly.
        </p>

        <div className="mt-5">
          <CarbonFlimsy
            label="Project title"
            derivedLabel="Slug"
            placeholder="e.g. Weekend Trip Planner"
            derivedPlaceholder="auto-generated-slug"
            onDerivedChange={(value, linked) =>
              setStatus(
                value
                  ? `${linked ? "Linked" : "Detached"} — ${value}`
                  : "Waiting for a title…"
              )
            }
          />
        </div>

        <p className="mt-4 font-mono text-xs text-muted">{status}</p>
      </div>

      <p className="max-w-sm text-center text-xs text-muted">
        Type a title and watch the slug stamp itself in below. Edit the slug
        directly to tear it free from the title &mdash; Relink restores the
        coupling with a full re-stamp sweep.
      </p>
    </div>
  );
}
