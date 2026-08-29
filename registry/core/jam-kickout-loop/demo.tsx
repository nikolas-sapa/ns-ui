"use client";

import { JamKickoutLoop } from "./component";

export default function JamKickoutLoopDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / jam-kickout-loop</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          most items ride straight through; every 6th kicks onto the loop for another pass
        </p>
      </header>
      <div className="flex min-h-[calc(100vh-3.75rem)] items-center justify-center p-6">
        <JamKickoutLoop className="h-64 w-full max-w-2xl rounded-sm border border-border" />
      </div>
    </main>
  );
}
