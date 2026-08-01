"use client";

import { useState } from "react";
import { LockFlight, type LockFlightStep } from "./component";

export default function LockFlightDemo() {
  const [email, setEmail] = useState("");
  const [size, setSize] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const emailValid = /\S+@\S+\.\S+/.test(email);

  const steps: LockFlightStep[] = [
    {
      id: "team",
      label: "Team",
      valid: true,
      content: (
        <p>
          You&rsquo;re creating a workspace for{" "}
          <span className="text-foreground">Acme Studio</span>. Continue when
          you&rsquo;re ready — this step has nothing left to fill in.
        </p>
      ),
    },
    {
      id: "contact",
      label: "Contact",
      valid: emailValid,
      progress: Math.min(0.3 + email.length * 0.06, 0.85),
      blockedMessage: "work email required",
      content: (
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
            Work email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
      ),
    },
    {
      id: "size",
      label: "Team size",
      valid: size !== null,
      blockedMessage: "pick a team size",
      content: (
        <div role="radiogroup" aria-label="Team size" className="flex gap-2">
          {["1–5", "6–20", "20+"].map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={size === opt}
              onClick={() => setSize(opt)}
              className={`rounded-sm border px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                size === opt
                  ? "border-accent text-foreground"
                  : "border-border text-muted hover:bg-foreground/[0.03]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "plan",
      label: "Plan",
      valid: plan !== null,
      blockedMessage: "choose a plan",
      content: (
        <div role="radiogroup" aria-label="Plan" className="flex gap-2">
          {["Starter", "Pro"].map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={plan === opt}
              onClick={() => setPlan(opt)}
              className={`rounded-sm border px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                plan === opt
                  ? "border-accent text-foreground"
                  : "border-border text-muted hover:bg-foreground/[0.03]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "review",
      label: "Review",
      valid: true,
      content: done ? (
        <p className="text-foreground">Workspace created. Welcome aboard.</p>
      ) : (
        <p>
          {email || "—"} · {size ?? "—"} · {plan ?? "—"}. Finish to create the
          workspace.
        </p>
      ),
    },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="max-w-md text-center font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / wizard-canal-lock — a stepper where each gate only opens once the
        water equalizes
      </p>

      <div className="w-full max-w-md">
        <LockFlight steps={steps} onComplete={() => setDone(true)} />
      </div>

      <p className="max-w-md text-center text-xs text-muted">
        Continue past &ldquo;Team&rdquo; and the next chamber fills right to
        the gate line. Try it again past &ldquo;Contact&rdquo; without an
        email — the level stalls short, and the gate stays shut until you
        fill it in. Arrow keys move focus across the chambers; a locked
        chamber still explains why it&rsquo;s locked to a screen reader.
      </p>
    </div>
  );
}
