"use client";

import { TendrilCast } from "./component";

export default function TendrilCastDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / tendril-cast</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          shoots circumnutate the empty pane, find the rule and the card, coil, and bud again
        </p>
      </header>

      <TendrilCast className="mx-auto flex min-h-[calc(100vh-3.75rem)] max-w-5xl flex-col items-center justify-center px-6 py-20">
        <div className="flex w-full max-w-xl flex-col items-center text-center">
          <p className="mb-5 font-mono text-[11px] tracking-widest text-ns-muted">
            LIVE CIRCUMNUTATION
          </p>
          <h1
            className="font-semibold text-foreground"
            style={{ fontSize: "clamp(2rem, 5.5vw, 3.25rem)", lineHeight: 1.08, letterSpacing: "-0.03em" }}
          >
            Every wrap earns its own grip
          </h1>
          {/* The headline rule: a support the tip has to physically reach —
              moving or resizing this row changes where the tendrils actually
              contact, not just where a pre-drawn curve pretends to. */}
          <div data-tendril-support className="mt-6 h-px w-24 bg-border" />
          <p className="mt-6 max-w-md text-sm leading-relaxed text-ns-muted">
            Two shoots sweep a slow, widening search out from the pane&rsquo;s bottom edge. The
            instant a tip crosses this rule or the card border below, growth switches from open
            nutation to a tightening spiral coil, right where it actually landed.
          </p>
        </div>

        <div
          data-tendril-support
          className="mt-14 flex w-full max-w-sm flex-col items-center gap-4 rounded-md border border-border bg-background px-8 py-8 text-center"
        >
          <p className="font-mono text-[11px] tracking-widest text-ns-muted">CTA CARD</p>
          <p className="text-sm text-foreground">
            The border this card sits inside is a real, measured rect &mdash; not a hint.
          </p>
          <a
            href="#start"
            className="mt-1 rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Get started
          </a>
          <a
            href="#learn"
            className="text-sm font-medium text-ns-muted underline decoration-border underline-offset-4 transition-colors duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Learn how it grows
          </a>
        </div>
      </TendrilCast>
    </main>
  );
}
