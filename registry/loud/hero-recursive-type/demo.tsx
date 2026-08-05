"use client";

import { NestedSlug } from "./component";

export default function NestedSlugDemo() {
  return (
    <main className="relative flex min-h-screen flex-col bg-background">
      <header className="z-10 flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / hero-recursive-type
        </span>
      </header>
      {/* move the cursor over the wordmark — it's a lens onto the words that
          build it */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-10">
        <NestedSlug
          headline="LOUD"
          filler="NPM INSTALL NS-UI. COMPONENTS THAT MOVE. ZERO DEPENDENCIES. "
          className="w-full"
        />
      </div>
      <footer className="z-10 flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-ns-muted">
          hover to read the interior
        </span>
        <span className="font-mono text-xs text-ns-muted">
          recursive type / canvas
        </span>
      </footer>
    </main>
  );
}
