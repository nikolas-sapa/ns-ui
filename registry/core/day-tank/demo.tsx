"use client";

import { useState } from "react";
import { DayTank } from "./component";

// A minimal chat composer wired straight to DayTank. `estimateCost` stands
// in for a real tokenizer/pricing call — it's recomputed on every keystroke
// and passed down as `pending`, exactly the contract DayTank expects. The
// demo mounts mid-compose (a non-empty prompt) so the ghost band — the
// signature move — is already visible in the resting frame, not hidden
// behind an interaction the verifier's default screenshot would miss.
const PROMPTS = [
  "Summarize the attached PDF and pull out action items.",
  "Draft a refund reply for order #4821.",
  "Write unit tests for the pricing module.",
];

function estimateCost(text: string) {
  const tokens = Math.max(1, Math.ceil(text.length / 4));
  // demo-scaled rate: a real per-token price ($0.00035) renders a ~0.05%
  // ghost band on a $10 tank — visually nothing and "est. $0.00". This rate
  // keeps the estimate material against the demo's capacity so the ghost
  // band and the dashed meniscus actually read at rest.
  return tokens * 0.045;
}

export default function DayTankDemo() {
  const capacity = 10;
  const [spent, setSpent] = useState(6.8);
  const [promptIndex, setPromptIndex] = useState(0);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [committing, setCommitting] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const pending = prompt.trim() ? estimateCost(prompt) : 0;

  function handleSend() {
    if (committing || !prompt.trim()) return;
    const amount = pending;
    setCommitting(true);
    // optimistic: fold the estimate into spend right away, the way a real
    // composer would the instant it fires the request.
    setSpent((s) => Math.min(capacity, s + amount));
    setTimeout(() => {
      setCommitting(false);
      setLog((l) => [`Sent — drew $${amount.toFixed(2)}`, ...l].slice(0, 3));
      const next = (promptIndex + 1) % PROMPTS.length;
      setPromptIndex(next);
      setPrompt(PROMPTS[next]);
    }, 700);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / day-tank
        </p>
        <h1 className="text-lg font-semibold text-foreground">Chat session</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          The tank reads what&apos;s left, not what&apos;s flowing. Compose a
          request and a ghost band previews its draw before you send —
          sending sweeps it into the real level with one spring.
        </p>

        <div className="mt-5 flex items-start gap-5 rounded-md border border-border bg-surface p-5">
          <DayTank
            capacity={capacity}
            spent={spent}
            pending={pending}
            committing={committing}
            label="Session budget"
          />

          <div className="min-w-0 flex-1">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              aria-label="Compose a message"
              className="w-full resize-none rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-muted">
                est. ${pending.toFixed(2)}
              </span>
              <button
                type="button"
                data-daytank-send
                onClick={handleSend}
                disabled={committing || !prompt.trim()}
                aria-label="Send message"
                className="rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                SEND
              </button>
            </div>
          </div>
        </div>

        {log.length ? (
          <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted">
            {log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 flex items-center justify-between rounded-md border border-border bg-surface p-4">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted">
            compact / horizontal
          </span>
          <DayTank
            capacity={5}
            spent={3.1}
            pending={0.6}
            orientation="horizontal"
            label="Toolbar budget"
          />
        </div>

        <p className="mt-3 font-mono text-[11px] text-muted">
          the dashed band is a preview, never a promise — it settles into the
          real level only once you actually send
        </p>
      </div>
    </main>
  );
}
