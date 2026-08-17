"use client";

import { PolypBud } from "./component";

export default function PolypBudDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / polyp-bud</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          buds only where its own shadow-tested light exposure clears 0.55
        </p>
      </header>
      <PolypBud edge="left" className="min-h-[calc(100vh-3.75rem)] bg-background">
        {/* Copy is inset well clear of the seeding edge so there is an
            actual lit band for the colony to accrete into — flush against
            the edge it grows from would shade every seed's exposure to zero
            before a single ray clears. */}
        <div className="ml-[18%] flex min-h-[calc(100vh-3.75rem)] max-w-lg flex-col justify-center gap-5 px-10 py-16 sm:ml-[26%] sm:px-16">
          <p className="font-mono text-[11px] tracking-widest text-ns-muted">REEF SURVEY / SECTOR 4</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            Growth is a record of light, not a plan.
          </h1>
          <p className="text-base leading-relaxed text-ns-muted">
            Every bud along the margin fired its own shadow rays before committing. What survived is
            what stayed lit — nothing here was drawn by hand.
          </p>
          <div>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="inline-flex rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              Read the survey
            </a>
          </div>
        </div>
      </PolypBud>
    </main>
  );
}
