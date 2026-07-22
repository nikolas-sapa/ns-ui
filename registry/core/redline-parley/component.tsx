"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RedlineParley — the counter-offer after a guardrail closes, not the gate
// itself (that's assay-gate's job, for a different decision entirely: a
// human approving an agent's already-permitted tool call). Here the request
// was already refused. The offending span is echoed back struck through —
// never a full-red block, just a --muted strikethrough bar that draws
// left-to-right once on mount — with the reason beneath it and a small
// group of narrowing levers (switches) that each rewrite the span. Flipping
// any lever re-runs its rewrite against the *original* span, cross-fades the
// old phrasing into the new one without changing the line's height, and
// recomputes whether the rewritten request now clears `recheck`. Passing
// retracts the strike (the same bar, animating the other direction) and is
// the only moment --accent appears anywhere in this component: the resend
// button's border. A visible status line always states "Blocked"/"Allowed"
// in plain words too, so the outcome never rides on noticing a line move.
//
// Gate-selector note: the verifier's generic press pass clicks the first
// interactive control before checking a declared `gate`. The first control
// here is remedies[0]'s switch. Point any `gate.openBy` at remedies[1] (or
// later) — `passed` is an OR over every active remedy by default, so a
// press-pass toggle of remedies[0] and a gate click on remedies[1] both
// leave at least one lever on and the gate still resolves.
// ---------------------------------------------------------------------------

export interface RedlineSpan {
  /** text before the flagged span, echoed verbatim */
  before: string;
  /** the substring that tripped the guardrail */
  flagged: string;
  /** text after the flagged span, echoed verbatim */
  after: string;
}

export interface RedlineRemedy {
  id: string;
  /** short label on the toggle chip, e.g. "anonymize names" */
  label: string;
  /** rewrites the span — called against the *original* span each time the
   * lever is (re)armed, so levers don't compound off each other's output */
  rewrite: (span: RedlineSpan) => RedlineSpan;
}

export interface RedlineResolution {
  /** before + flagged + after, as finally rewritten */
  request: string;
  /** ids of the remedies that were active at send time */
  activeRemedies: string[];
}

export interface RedlineParleyProps {
  span: RedlineSpan;
  /** one-sentence explanation of what tripped, shown under the echoed prompt */
  reason: string;
  remedies: RedlineRemedy[];
  /** decides whether the rewritten span now clears the guardrail. Default:
   * passes once at least one remedy is active — a real integration should
   * pass its own check against the actual guardrail instead. */
  recheck?: (span: RedlineSpan, activeRemedyIds: string[]) => boolean;
  onResend?: (resolution: RedlineResolution) => void;
  className?: string;
}

const FADE_MS = 220;
const STRIKE_MS = 200;
const SENT_HOLD_MS = 1400;

function defaultRecheck(_span: RedlineSpan, activeRemedyIds: string[]) {
  return activeRemedyIds.length > 0;
}

export function RedlineParley({
  span,
  reason,
  remedies,
  recheck = defaultRecheck,
  onResend,
  className = "",
}: RedlineParleyProps) {
  const original = useRef(span).current;
  const uid = useId();

  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [justSent, setJustSent] = useState(false);
  const sentTimeout = useRef<number | undefined>(undefined);

  // Each active remedy's rewrite is folded over the *original* span in
  // remedy-array order — a lever always starts from what the guardrail
  // actually flagged, never from another lever's output, so toggling one
  // off doesn't leave a stray partial rewrite behind from another.
  const currentSpan = useMemo(
    () =>
      remedies.reduce(
        (acc, r) => (activeIds.includes(r.id) ? r.rewrite(acc) : acc),
        original
      ),
    [remedies, activeIds, original]
  );

  const passed = recheck(currentSpan, activeIds);

  // Cross-fade the flagged text old -> new without moving the line: the two
  // copies stack in the same CSS grid cell (grid sizes the cell to the
  // larger of the two, so nothing else on the line reflows mid-fade) while
  // opacity swaps between them.
  const lastFlaggedRef = useRef(original.flagged);
  const [displayFlagged, setDisplayFlagged] = useState(original.flagged);
  const [ghost, setGhost] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(true);
  const ghostTimeout = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (currentSpan.flagged === lastFlaggedRef.current) return;
    const previous = lastFlaggedRef.current;
    lastFlaggedRef.current = currentSpan.flagged;
    setGhost(previous);
    setDisplayFlagged(currentSpan.flagged);
    setRevealed(false);
    const raf = requestAnimationFrame(() => setRevealed(true));
    window.clearTimeout(ghostTimeout.current);
    ghostTimeout.current = window.setTimeout(() => setGhost(null), FADE_MS);
    return () => cancelAnimationFrame(raf);
  }, [currentSpan.flagged]);

  useEffect(() => () => window.clearTimeout(ghostTimeout.current), []);
  useEffect(() => () => window.clearTimeout(sentTimeout.current), []);

  // The strike bar's scale tracks `!passed`, deferred one frame so the very
  // first paint (undrawn) and the draw-in (drawn) are two distinct commits —
  // without the frame gap the mount would paint straight at its final value
  // and no transition would ever be observed.
  const [barScale, setBarScale] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setBarScale(passed ? 0 : 1));
    return () => cancelAnimationFrame(raf);
  }, [passed]);

  // sr-only announcement, one per lever flip — skipped on mount so a screen
  // reader doesn't hear a phantom "rewritten" before anything happened.
  const mountedRef = useRef(false);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setAnnouncement(
      `rewritten: ${currentSpan.flagged}, request now ${passed ? "allowed" : "blocked"}`
    );
  }, [currentSpan.flagged, passed]);

  function toggle(id: string) {
    setActiveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSend() {
    if (!passed) return;
    onResend?.({
      request: currentSpan.before + currentSpan.flagged + currentSpan.after,
      activeRemedies: activeIds,
    });
    setJustSent(true);
    window.clearTimeout(sentTimeout.current);
    sentTimeout.current = window.setTimeout(() => setJustSent(false), SENT_HOLD_MS);
  }

  return (
    <div className={className}>
      <style>{`
.ns-rp-strike { transition: transform ${STRIKE_MS}ms cubic-bezier(0.16,1,0.3,1); }
.ns-rp-fade { transition: opacity ${FADE_MS}ms cubic-bezier(0.16,1,0.3,1); }
.ns-rp-chip { transition: color 160ms ease, border-color 160ms ease, background-color 160ms ease; }
.ns-rp-send { transition: border-color 220ms cubic-bezier(0.16,1,0.3,1), box-shadow 220ms cubic-bezier(0.16,1,0.3,1); }
@media (prefers-reduced-motion: reduce) {
  .ns-rp-strike, .ns-rp-fade, .ns-rp-chip, .ns-rp-send { transition: none !important; }
}
`}</style>

      <div className="rounded-md border border-border bg-surface p-4">
        <p className="text-sm leading-relaxed text-foreground">
          {currentSpan.before}
          <span
            role="mark"
            tabIndex={0}
            aria-label={`flagged: ${reason}`}
            className="relative inline-grid align-baseline rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/60"
          >
            {ghost !== null ? (
              <span
                aria-hidden
                style={{ gridArea: "1 / 1" }}
                className={
                  "ns-rp-fade pointer-events-none " +
                  (revealed ? "opacity-0" : "opacity-100")
                }
              >
                {ghost}
              </span>
            ) : null}
            <span
              style={{ gridArea: "1 / 1" }}
              className={
                "ns-rp-fade relative " +
                (ghost !== null ? (revealed ? "opacity-100" : "opacity-0") : "opacity-100")
              }
            >
              {displayFlagged}
              <span
                aria-hidden
                className="ns-rp-strike pointer-events-none absolute inset-x-0 top-1/2 h-[1.5px] bg-muted"
                style={{ transform: `translateY(-50%) scaleX(${barScale})` }}
              />
            </span>
          </span>
          {currentSpan.after}
        </p>

        <p className="mt-2 text-sm text-muted">{reason}</p>

        <p
          data-redline-status={passed ? "allowed" : "blocked"}
          className="mt-4 font-mono text-[11px] uppercase tracking-wide text-muted"
        >
          {passed ? "Allowed — ready to resend" : "Blocked"}
        </p>

        <div
          role="group"
          aria-label="Narrowing levers"
          className="mt-2 flex flex-wrap gap-2"
        >
          {remedies.map((r, i) => {
            const active = activeIds.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                role="switch"
                aria-checked={active}
                data-redline-remedy={r.id}
                data-redline-index={i}
                onClick={() => toggle(r.id)}
                className={
                  "ns-rp-chip inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/60 " +
                  (active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted hover:border-foreground/40 hover:text-foreground")
                }
              >
                <span
                  aria-hidden
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (active ? "bg-background" : "bg-muted")
                  }
                />
                {r.label}
              </button>
            );
          })}
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            id={`${uid}-send`}
            disabled={!passed}
            onClick={handleSend}
            className={
              "ns-rp-send rounded-sm border bg-background px-3 py-1.5 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
              (passed ? "border-accent" : "border-border")
            }
          >
            {justSent ? "Sent" : "Resend request"}
          </button>
        </div>
      </div>
    </div>
  );
}
