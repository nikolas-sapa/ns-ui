"use client";

import { IntentCoil } from "./component";

// Three of the jobs this mechanism is for, in one short paragraph: a link
// preview, a profile card, and a definition popover — none of them should
// fire just because the cursor happened to cross the trigger on its way
// somewhere else.

export default function IntentCoilDemo() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-md border border-border bg-background p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-ns-muted">
          Release notes / v4.2
        </p>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Streaming parsers land in the edge runtime
        </h2>
        <p className="text-sm leading-relaxed text-foreground">
          The new{" "}
          <IntentCoil
            href="https://docs.example.com/edge/streaming-parser"
            preview={
              // span, not p: this preview is rendered inside a trigger that
              // itself sits inline inside the paragraph below — a <p> here
              // would nest inside that outer <p> and force the browser to
              // auto-close it. "block" keeps the same layout without it.
              <>
                <span className="block font-medium text-foreground">Streaming parser</span>
                <span className="mt-1 block text-ns-muted">
                  Tokenizes incrementally as bytes arrive instead of buffering the full payload —
                  flat memory profile from 1KB to 50MB.
                </span>
              </>
            }
          >
            streaming parser
          </IntentCoil>{" "}
          replaces the buffered baseline in every edge region this release, a change proposed by{" "}
          <IntentCoil
            href="https://example.com/people/alex-rivera"
            preview={
              <>
                <span className="block font-medium text-foreground">Alex Rivera</span>
                <span className="mt-1 block text-ns-muted">Staff engineer, edge runtime. Joined 2022.</span>
              </>
            }
          >
            Alex Rivera
          </IntentCoil>{" "}
          after last quarter&rsquo;s{" "}
          <IntentCoil
            href="https://example.com/glossary/request-coalescing"
            previewLabel="Definition: request coalescing"
            preview={
              <>
                <span className="block font-medium text-foreground">Request coalescing</span>
                <span className="mt-1 block text-ns-muted">
                  Concurrent misses for the same key collapse into a single origin request; the
                  remaining waiters are served from the result once it lands.
                </span>
              </>
            }
          >
            request coalescing
          </IntentCoil>{" "}
          postmortem made the case for both changes landing together.
        </p>
      </div>
    </div>
  );
}
