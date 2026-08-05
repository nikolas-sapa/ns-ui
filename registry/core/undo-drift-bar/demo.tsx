"use client";

import { UndertowDrift, type UndertowItem } from "./component";

const READING_LIST: UndertowItem[] = [
  { id: "caching", title: "The soft failure modes of caching" },
  { id: "consensus", title: "Notes on distributed consensus" },
  { id: "onboarding", title: "Why most onboarding flows leak" },
  { id: "undo-history", title: "A short history of the undo button" },
  { id: "clock-drift", title: "Debugging clock drift in production" },
];

export default function UndertowDriftDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-4 text-center font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / undo-drift-bar
        </p>
        <div className="rounded-md border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Reading list</h2>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-ns-muted">
              5 saved
            </span>
          </div>
          <UndertowDrift items={READING_LIST} graceMs={6000} />
          <p className="mt-3 font-mono text-[10px] text-ns-muted">
            delete one — the bar holds its position, drifting right over 6s; hover, focus,
            or press it to pull it back
          </p>
        </div>
      </div>
    </main>
  );
}
