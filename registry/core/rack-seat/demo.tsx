"use client";

import { useCallback, useRef, useState } from "react";
import { RackSeat, type RackAction } from "./component";

const ACTIONS: RackAction[] = [
  { id: "delete-org", label: "Delete organization" },
  { id: "rotate-key", label: "Rotate signing key" },
];

// Compressed timings so the mechanism — creep, then the visible ten-second
// (here: proportionally shorter) withdrawal — plays out inside a demo card
// instead of a real 5-minute window. The component doesn't know or care;
// it only ever reads elevationMs/accelerateMs and the expiresAt it's given.
const ELEVATION_MS = 9000;
const ACCELERATE_MS = 3500;

export default function RackSeatDemo() {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [lastActivated, setLastActivated] = useState<string | null>(null);
  const lastActivatedTimer = useRef<number | null>(null);

  // The real MFA flow belongs to the app, not this component — RackSeat
  // only asks for it via onVerify. Here that flow is mocked as an instant
  // success so the card is fully demonstrable on its own.
  const handleVerify = useCallback(() => {
    setExpiresAt(Date.now() + ELEVATION_MS);
  }, []);

  const handleActivate = useCallback((id: string) => {
    const action = ACTIONS.find((a) => a.id === id);
    setLastActivated(action?.label ?? id);
    if (lastActivatedTimer.current) window.clearTimeout(lastActivatedTimer.current);
    lastActivatedTimer.current = window.setTimeout(() => setLastActivated(null), 2200);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg">
        <p className="mb-8 font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / rack-seat — step-up auth
        </p>

        <section className="rounded-md border border-border p-6">
          <h2 className="text-sm font-medium text-foreground">
            acme-corp · organization settings
          </h2>
          <p className="mt-1 mb-6 max-w-sm text-sm leading-relaxed text-ns-muted">
            Sensitive actions stay visible and legible at all times — they
            just physically disconnect until a fresh verification racks the
            group back in for a few minutes.
          </p>

          <RackSeat
            actions={ACTIONS}
            expiresAt={expiresAt}
            elevationMs={ELEVATION_MS}
            accelerateMs={ACCELERATE_MS}
            onVerify={handleVerify}
            onActivate={handleActivate}
            onRequestVerification={() => {
              /* a real app would surface its own step-up flow here too */
            }}
          />

          <p
            className="mt-4 h-4 font-mono text-[11px] text-ns-muted"
            aria-hidden
          >
            {lastActivated ? `started: ${lastActivated}` : ""}
          </p>
        </section>
      </div>
    </main>
  );
}
