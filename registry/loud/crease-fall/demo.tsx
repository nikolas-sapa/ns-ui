"use client";

import { CreaseFall } from "./component";

// Resting state is the CLOSED page, deliberately: the sheet is folded flat and
// pinned out of sight, and what the still frame has to earn its keep with is the
// index page underneath — a hairline column grid, a full-bleed wordmark, and the
// Menu control that releases the creases.
export default function CreaseFallDemo() {
  return (
    <main className="h-screen w-full overflow-hidden bg-background">
      <CreaseFall
        items={[
          { label: "Index", href: "#index", meta: "01 / start here" },
          { label: "Work", href: "#work", meta: "02 / 24 projects" },
          { label: "Studio", href: "#studio", meta: "03 / who we are" },
          { label: "Journal", href: "#journal", meta: "04 / 61 notes" },
          { label: "Contact", href: "#contact", meta: "05 / say hello" },
        ]}
        eyebrow="ns-ui / crease-fall"
        footer="Esc folds it back up"
      >
        <div className="relative h-screen w-full overflow-hidden">
          {/* Column rules. Structure, not decoration: the sheet folds down over them. */}
          <div aria-hidden="true" className="absolute inset-0 flex justify-between px-6 sm:px-12">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="h-full w-px bg-border" />
            ))}
          </div>
          <div className="relative flex h-full w-full flex-col justify-between px-6 py-5 sm:px-12 sm:py-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              Fold chain / five creases
            </p>
            <div className="max-w-3xl">
              <h1 className="text-[clamp(2.5rem,11vw,7rem)] font-medium leading-[0.92] tracking-tight text-foreground">
                A sheet
                <br />
                folded flat
              </h1>
              <p className="mt-6 max-w-md text-sm text-ns-muted">
                The navigation is a concertina pinned above the viewport. Open it and the creases
                release in order, each panel swinging down on its own weight with the type riding on
                it.
              </p>
            </div>
            <div className="flex items-end justify-between gap-6 font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
              <span>Press Menu, or Tab to it</span>
              <span className="hidden sm:block">01 &mdash; 05</span>
            </div>
          </div>
        </div>
      </CreaseFall>
    </main>
  );
}
