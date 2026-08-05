"use client";

import { TearTab } from "./component";

export default function TearTabDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / tag-input-tear
        </p>
        <TearTab
          label="Recipients"
          placeholder="Add a recipient…"
          defaultTags={["design", "engineering", "growth", "on-call", "p1"]}
        />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          Drag a chip down past the perforation to tear it off — release early
          and it springs back. Delete/Backspace on a focused chip removes it
          instantly; Ctrl+Z undoes.
        </p>
      </div>
    </main>
  );
}
