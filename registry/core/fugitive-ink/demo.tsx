"use client";

import { FugitiveInk } from "./component";

// Decay window is sped up for the demo (9s instead of the real 60s default)
// so the fade is actually visible without waiting a minute. The component
// itself defaults to 60000ms — pass decayMs explicitly for a real key issuance flow.
export default function FugitiveInkDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / fugitive-ink — copy the key, or click away, to start the clock
      </p>
      <div data-ns-fi-focus>
        <FugitiveInk
          label="New API key"
          value="sk-live-51N7f2KcQ9mXG4dP3vB7hT2q0e8f4f2q"
          decayMs={9000}
        />
      </div>
    </div>
  );
}
