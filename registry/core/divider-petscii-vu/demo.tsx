"use client";

import { DividerPetsciiVu } from "./component";

export default function DividerPetsciiVuDemo() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-10 bg-background px-8 py-10">
      <div className="w-full max-w-3xl">
        <h2 className="mb-3 font-mono text-sm text-foreground">Section one</h2>
        <p className="mb-8 max-w-prose font-mono text-xs text-ns-muted">
          A hairline reverse-video meter sits between sections instead of a
          plain rule — same idea as <code>&lt;hr /&gt;</code>, driven by a
          real amplitude envelope.
        </p>
        <DividerPetsciiVu />
      </div>
      <div className="w-full max-w-3xl">
        <h2 className="mt-8 font-mono text-sm text-foreground">Section two</h2>
      </div>
    </div>
  );
}
