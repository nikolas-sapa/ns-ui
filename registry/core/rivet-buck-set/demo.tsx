"use client";

import { RivetBuckSet } from "./component";

export default function RivetBuckSetDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / rivet-buck-set</p>
        <RivetBuckSet />
        <RivetBuckSet
          title="Standup summary"
          description="Ambient loop keeps forming and clamping on its own — press to drive one on demand."
          buttonLabel="Lock this card"
        />
      </div>
    </main>
  );
}
