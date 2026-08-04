"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyInterlock, type InterlockGate } from "./component";

const INITIAL: InterlockGate[] = [
  {
    id: "pii_scan",
    label: "PII scan",
    state: "tripped",
    detail: "two customer email addresses found in the drafted reply",
  },
  {
    id: "tool_scope",
    label: "Tool scope",
    state: "released",
    detail: "call stayed inside the read-only billing endpoints",
  },
  {
    id: "grounding",
    label: "Grounding",
    state: "released",
    detail: "every claim maps to a retrieved invoice line",
  },
  {
    id: "injection",
    label: "Prompt injection probe",
    state: "released",
    detail: "no instruction-override attempt in the retrieved documents",
  },
  {
    id: "cost_cap",
    label: "Cost ceiling",
    state: "pending",
    detail: "token accounting for this run is still settling",
  },
];

export default function KeyInterlockDemo() {
  const [gates, setGates] = useState<InterlockGate[]>(INITIAL);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  // The interlock never mutates the gates it is handed — the owner does. Here
  // the owner releases the overridden gate, then re-arms it a few seconds
  // later so the demo can be exercised more than once. The audit trail the
  // interlock keeps does not clear, which is the point.
  // cost_cap settles a beat after the override, so the last key travels, the
  // bolt actually retracts and the hatch lifts off the output — the payoff
  // frame, not just the key travel.
  const handleOverride = useCallback((id: string) => {
    setGates((g) =>
      g.map((x) => (x.id === id ? { ...x, state: "released" } : x))
    );
    const settle = window.setTimeout(() => {
      setGates((g) =>
        g.map((x) => (x.id === "cost_cap" ? { ...x, state: "released" } : x))
      );
    }, 320);
    const rearm = window.setTimeout(() => {
      setGates((g) =>
        g.map((x) => {
          if (x.id === id) return { ...x, state: "tripped" };
          if (x.id === "cost_cap") return { ...x, state: "pending" };
          return x;
        })
      );
    }, 3000);
    timers.current.push(settle, rearm);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-muted">
          ns-ui / guardrail-interlock-keys — output guardrails
        </p>

        <section className="rounded-md border border-border bg-surface/40 p-6">
          <h2 className="text-sm font-medium text-foreground">
            support-agent · reply to invoice #4471
          </h2>
          <p className="mt-1 mb-6 max-w-lg text-sm leading-relaxed text-muted">
            Five policy gates each hold one key. The bolt only retracts when
            every key is seated, so a single tripped gate keeps the draft
            behind the lock.
          </p>

          <KeyInterlock
            gates={gates}
            operator="n.sapalidis"
            title="Output interlock"
            label="Output guardrail interlock"
            onOverride={handleOverride}
            output="Your March invoice was reissued on the 4th after the duplicate line for seat 12 was removed. The corrected total is €1,840.00, and the credit note for the original charge has already been applied to your account."
          />
        </section>
      </div>
    </main>
  );
}
