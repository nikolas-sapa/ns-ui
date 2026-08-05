"use client";

import { CinchBead } from "./component";

export default function CinchBeadDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / tag-input-cord
        </p>
        <CinchBead
          label="Issue labels"
          placeholder="Add a label…"
          defaultTags={["bug", "regression", "p1"]}
        />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          Enter or comma cinches a bead onto the cord — Backspace on an empty
          input unravels the last one
        </p>
      </div>
    </main>
  );
}
