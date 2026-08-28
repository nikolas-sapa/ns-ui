"use client";

import { MailbagHookExchange } from "./component";

export default function MailbagHookExchangeDemo() {
  return (
    <main className="min-h-screen bg-background">
      {/* no interaction — the crane arm sways on its own between passes,
          a signal lamp blinks on a separate clock, and a train sweeps
          through every 7s to swap the hooked bag. */}
      <MailbagHookExchange>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / mailbag-hook-exchange
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Never stops to hand it off.
        </h1>
        <p className="max-w-sm text-sm text-ns-muted sm:text-base">
          A trackside crane holds the outgoing bag; a passing train's arm
          snags it and kicks a replacement onto the net without slowing
          down.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </MailbagHookExchange>
    </main>
  );
}
