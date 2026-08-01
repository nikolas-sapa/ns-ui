"use client";

import { QuoinLock } from "./component";

export default function QuoinLockDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-muted">ns-ui / hero-letterpress-lockup</p>
        <p className="hidden font-mono text-[11px] text-muted sm:block">
          reload to watch the line compose, then lock
        </p>
      </header>
      <QuoinLock
        eyebrow="COMPOSING ROOM"
        headline="SET IN TYPE, LOCKED FOR GOOD"
        subhead="Every glyph rides its own rail into place. Once the line is full, the quoin tightens and it doesn't move again."
        className="min-h-[calc(100vh-3.75rem)]"
      />
    </main>
  );
}
