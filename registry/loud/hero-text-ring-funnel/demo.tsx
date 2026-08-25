"use client";

import { TextRingFunnel } from "./component";

export default function TextRingFunnelDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* nothing to touch — seven rings of real words spin forever, each
          a little slower than the one in front of it */}
      <TextRingFunnel>
        <span className="text-xs font-medium uppercase tracking-[0.25em] text-ns-muted">
          ns-ui / hero-text-ring-funnel
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Set in depth.
        </h1>
        <p className="max-w-sm text-sm text-ns-muted sm:text-base">
          The type itself is the tunnel — every ring a line of real words,
          turning at its own speed.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </TextRingFunnel>
    </main>
  );
}
