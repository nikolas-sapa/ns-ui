"use client";

import { MudflowLeveeBuild } from "./component";

export default function MudflowLeveeBuildDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / mudflow-levee-build</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          the flow builds its own banks, narrows itself, and breaches sideways
        </p>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-16">
        <MudflowLeveeBuild className="h-40 border border-border" />
      </div>
    </main>
  );
}
