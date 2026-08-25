"use client";

import { GuillocheField } from "./component";

export default function GuillocheFieldDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* hover to tilt — the lathe ratio wobbles a little harder, like
          checking a banknote's security thread under angled light. the
          weave keeps drifting on its own with no input at all. */}
      <GuillocheField>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / background-engine-turn-guilloche
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Engraved, never repeating.
        </h1>
        <p className="max-w-sm text-sm text-ns-muted sm:text-base">
          Three rose-engine passes at close, unequal ratios, beating against
          each other the way two guilloché screens do on a printed note.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </GuillocheField>
    </main>
  );
}
