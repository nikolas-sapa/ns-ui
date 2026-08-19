"use client";

import { useEffect, useRef, useState } from "react";
import { ReturnAviso, type AvisoDeliveryState } from "./component";

// Three mentions at three real states, sitting side by side so the "sent and
// delivered read identical, only seen changes anything" claim is visible
// without waiting: two are static (sent, delivered), the third is driven by
// one idempotent button standing in for "the sync layer confirmed a read" —
// clicking it always marks the mention seen (never toggles it back off), so
// repeated presses (autoplay, or the verifier's own press pass) can never
// land the demo in the wrong state. It quietly reverts to "delivered" a few
// seconds later on its own, purely so the demo has something to show again
// on the next loop.
const REVERT_MS = 3000;

export default function ReturnAvisoDemo() {
  const [dana, setDana] = useState<{ deliveryState: AvisoDeliveryState; seenAt?: string }>({
    deliveryState: 1,
  });
  const revertTimer = useRef<number | undefined>(undefined);

  function markSeen() {
    window.clearTimeout(revertTimer.current);
    setDana({ deliveryState: 2, seenAt: "14:22" });
    revertTimer.current = window.setTimeout(() => {
      setDana({ deliveryState: 1 });
    }, REVERT_MS);
  }

  useEffect(() => () => window.clearTimeout(revertTimer.current), []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / return-aviso
        </p>
        <h1 className="text-lg font-semibold text-foreground">Incident thread</h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          A mention round-trips like registered post: the stub tears off the
          moment it sends and only comes back — filled, timestamped — once
          the person actually looks.
        </p>

        <div className="mt-5 space-y-3 rounded-md border border-border p-4">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-foreground">
            <span className="text-ns-muted">Checking the rollback plan with</span>
            <ReturnAviso name="priya" href="#priya" deliveryState={0} />
          </div>
          <p className="font-mono text-[10px] tracking-wide text-ns-muted">
            sent — dispatched, not yet delivered
          </p>

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-border pt-3 text-sm text-foreground">
            <span className="text-ns-muted">Looping in on the postmortem,</span>
            <ReturnAviso name="marcus" href="#marcus" deliveryState={1} />
          </div>
          <p className="font-mono text-[10px] tracking-wide text-ns-muted">
            delivered — sitting in their inbox, not yet seen
          </p>

          <div data-ns-aviso-focus className="border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-foreground">
              <span className="text-ns-muted">Assigning the follow-up to</span>
              <ReturnAviso
                name="dana"
                href="#dana"
                deliveryState={dana.deliveryState}
                seenAt={dana.seenAt}
                authoredByViewer
              />
            </div>
            <p className="mt-1 font-mono text-[10px] tracking-wide text-ns-muted">
              {dana.deliveryState >= 2 ? `seen — read at ${dana.seenAt}` : "delivered — not yet seen"}
            </p>

            <button
              type="button"
              data-ns-aviso-mark-seen
              onClick={markSeen}
              className="mt-3 w-full rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-200 hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              DANA OPENS THE THREAD
            </button>
          </div>
        </div>

        <p className="mt-4 font-mono text-[11px] text-ns-muted">
          sent and delivered render identical — the receipt only moves on seen
        </p>
      </div>
    </main>
  );
}
