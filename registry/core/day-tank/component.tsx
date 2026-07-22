"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// DayTank — a session budget rendered as a ship's day tank: the small fuel
// tank an engine draws from between refills. It answers "can I afford this
// next call?" by rendering STOCK (remaining budget), never RATE — that's
// reed-vu's job (live tokens/sec). And unlike tide-gauge-password, the level
// here tracks money, not input strength.
//
// Geometry, bottom-up, for a fraction of `capacity`:
//   1. "safe" fill  — solid --foreground at low opacity. Height = whatever of
//      the remaining budget is NOT claimed by the in-flight estimate.
//   2. "ghost" band — sits directly above it. Height = `pending` (the live
//      estimate of the request being composed), at ~35% opacity, breathing
//      0.25↔0.45 on a 2.4s loop, capped by a DASHED --muted edge instead of
//      the plain solid meniscus.
//   3. the edge  — a 1px line, solid --foreground with 2px overshoot ends
//      when there's nothing pending, cross-fading to the ghost's plain
//      dashed --muted line the instant an estimate appears.
// safe + ghost always sum to exactly remaining/capacity — the ghost never
// invents budget, it only marks which SLICE of what's already there is
// about to be spent.
//
// `committing` is the one-shot trigger fired by the composer at send: the
// dashed edge cross-fades solid over SWEEP_MS while the ghost's height eases
// to 0 and the safe fill grows to absorb it — both on the SAME spring-eased
// transition, so the total silhouette never jumps mid-animation. Keep
// `pending` at its last live value while `committing` is true; the parent
// bumps `spent` (optimistically or for real) in that same window. A plain
// `spent` change with `committing` never having fired (a server correction
// arriving later) eases in over the ordinary 400ms ease-out-expo. A `spent`
// DECREASE (a refill) eases in slower — the tank filling back up.
//
// Not itself keyboard-interactive: it's a passive role=meter, paired with
// whatever composer is driving `pending`/`committing`. Pure DOM + CSS, no
// canvas, no SVG needed — every shape here is a plain absolutely-positioned
// div colored via a token custom property.
// ---------------------------------------------------------------------------

const FILL_MS = 400;
const REFILL_MS = 900;
const SPRING_MS = 550;
const SWEEP_MS = 300;
const EASE_OUT_EXPO = "cubic-bezier(0.16,1,0.3,1)";
const SPRING_EASE = "cubic-bezier(0.34,1.56,0.64,1)";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function fmtMoney(n: number, currency: string) {
  const safe = Number.isFinite(n) ? n : 0;
  const rounded = Math.round(safe * 100) / 100;
  return Number.isInteger(rounded) ? `${currency}${rounded}` : `${currency}${rounded.toFixed(2)}`;
}

export interface DayTankProps {
  /** total session budget, e.g. 10 for a $10 session */
  capacity: number;
  /** confirmed amount drawn so far */
  spent: number;
  /**
   * live estimate of the request currently being composed — typically the
   * output of the consumer's own estimate(prompt, model, context) function,
   * recomputed and passed down on every keystroke. 0 or omitted hides the
   * ghost band entirely.
   */
  pending?: number;
  /**
   * true for the span between the user hitting send and the real result
   * landing. Fires the one-shot sweep-solid + spring-settle. Keep `pending`
   * at its last live value while this is true; clear it (and update
   * `spent`) once the real number lands.
   */
  committing?: boolean;
  /** currency symbol prefixed on every readout, default "$" */
  currency?: string;
  /** accessible name for the meter — the only rendered text is the numbers */
  label?: string;
  /** slim vertical column (default), or a horizontal strip for compact UIs */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

export function DayTank({
  capacity,
  spent,
  pending,
  committing,
  currency = "$",
  label = "Session budget",
  orientation = "vertical",
  className = "",
}: DayTankProps) {
  const reduced = useReducedMotion();
  const vertical = orientation !== "horizontal";
  const isCommitting = committing ?? false;

  const safeCapacity = capacity > 0 ? capacity : 1e-6;
  const remainingFrac = Math.max(0, Math.min(1, (safeCapacity - spent) / safeCapacity));
  const pend = Math.max(0, pending ?? 0);
  const pendingFrac = Math.max(0, Math.min(remainingFrac, pend / safeCapacity));

  const remainPct = remainingFrac * 100;
  const ghostPct = isCommitting ? 0 : pendingFrac * 100;
  const safePct = isCommitting ? remainPct : Math.max(0, remainPct - pendingFrac * 100);

  const remaining = safeCapacity - spent;
  const valueText =
    `${fmtMoney(spent, currency)} of ${fmtMoney(capacity, currency)} used` +
    (pend > 0 && !isCommitting ? `, next request estimated ${fmtMoney(pend, currency)}` : "");

  // previous-value tracking for the refill case — read during render (the
  // ref only updates in the effect below, so mid-render it still holds last
  // render's value), never via a state flag that would cost an extra frame.
  const prevSpentRef = useRef(spent);
  const isRefill = spent < prevSpentRef.current;
  useEffect(() => {
    prevSpentRef.current = spent;
  }, [spent]);

  // one-shot sweep+spring window, armed the instant `committing` flips true.
  // This is React's own "adjust state during render" escape hatch — it
  // re-renders before paint, so there is never a frame styled with the
  // wrong transition.
  const [prevCommitting, setPrevCommitting] = useState(isCommitting);
  const [sweeping, setSweeping] = useState(false);
  const [springing, setSpringing] = useState(false);
  if (isCommitting !== prevCommitting) {
    setPrevCommitting(isCommitting);
    if (isCommitting) {
      setSweeping(true);
      setSpringing(true);
    }
  }
  useEffect(() => {
    if (!sweeping) return;
    const t = setTimeout(() => setSweeping(false), SWEEP_MS);
    return () => clearTimeout(t);
  }, [sweeping]);
  useEffect(() => {
    if (!springing) return;
    const t = setTimeout(() => setSpringing(false), SPRING_MS);
    return () => clearTimeout(t);
  }, [springing]);

  const levelMs = reduced ? 0 : springing ? SPRING_MS : isRefill ? REFILL_MS : FILL_MS;
  const levelEase = springing ? SPRING_EASE : EASE_OUT_EXPO;
  const levelProp = vertical ? "height" : "width";
  const posProp = vertical ? "bottom" : "left";
  const fillTransition = `${levelProp} ${levelMs}ms ${levelEase}`;
  const ghostTransition = `${levelProp} ${levelMs}ms ${levelEase}, ${posProp} ${levelMs}ms ${levelEase}`;
  const edgeOpacityMs = reduced ? 0 : SWEEP_MS;
  const edgeTransitionProperty = `${posProp}, opacity`;
  const edgeTransitionDuration = `${levelMs}ms, ${edgeOpacityMs}ms`;
  const edgeTransitionTiming = `${levelEase}, ease`;

  const showDashed = pendingFrac > 0 && !isCommitting;
  const showGhostBreathe = showDashed && !reduced;

  // throttled, material-change-only announcement of the pending estimate.
  const lastAnnouncedPendingRef = useRef(0);
  const lastAnnounceAtRef = useRef(0);
  const [liveText, setLiveText] = useState("");
  useEffect(() => {
    const prev = lastAnnouncedPendingRef.current;
    const denom = prev > 0 ? prev : Math.max(pend, 0.0001);
    const materialChange = Math.abs(pend - prev) / denom > 0.1;
    const now = Date.now();
    const dueForAnnounce = now - lastAnnounceAtRef.current >= 3000;
    if (materialChange && dueForAnnounce && !isCommitting) {
      lastAnnouncedPendingRef.current = pend;
      lastAnnounceAtRef.current = now;
      setLiveText(
        pend > 0
          ? `Next request estimated ${fmtMoney(pend, currency)}.`
          : "Estimate cleared."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pend, isCommitting]);

  // a real spend change (a commit landing, a correction, a refill) is always
  // worth announcing in full — never throttled, these are discrete events.
  const prevSpentAnnounceRef = useRef(spent);
  useEffect(() => {
    if (spent !== prevSpentAnnounceRef.current) {
      prevSpentAnnounceRef.current = spent;
      setLiveText(valueText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spent]);

  const fillStyle: React.CSSProperties = vertical
    ? { left: 0, right: 0, bottom: 0, height: `${safePct}%`, transition: fillTransition }
    : { top: 0, bottom: 0, left: 0, width: `${safePct}%`, transition: fillTransition };

  const ghostStyle: React.CSSProperties = vertical
    ? {
        left: 0,
        right: 0,
        bottom: `${safePct}%`,
        height: `${ghostPct}%`,
        transition: ghostTransition,
        opacity: showGhostBreathe ? undefined : 0.35,
      }
    : {
        top: 0,
        bottom: 0,
        left: `${safePct}%`,
        width: `${ghostPct}%`,
        transition: ghostTransition,
        opacity: showGhostBreathe ? undefined : 0.35,
      };

  const edgeBase: React.CSSProperties = vertical
    ? { bottom: `${remainPct}%` }
    : { left: `${remainPct}%` };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <style>{`
@keyframes ns-daytank-breathe {
  0%, 100% { opacity: 0.25; }
  50% { opacity: 0.45; }
}
.ns-daytank-breathe { animation: ns-daytank-breathe 2400ms ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ns-daytank-breathe { animation: none; }
}
`}</style>

      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={spent}
        aria-valuetext={valueText}
        className={`relative shrink-0 rounded-sm border border-border ${
          vertical ? "h-40 w-9" : "h-9 w-40"
        }`}
      >
        {/* fill layer, inset and clipped so the rounded corners never get
            squared off by a rectangular fill div */}
        <div className="absolute inset-0 overflow-hidden rounded-sm">
          <div aria-hidden className="absolute bg-foreground/[0.14]" style={fillStyle} />
          {ghostPct > 0 ? (
            <div
              aria-hidden
              className={`absolute bg-foreground ${showGhostBreathe ? "ns-daytank-breathe" : ""}`}
              style={ghostStyle}
            />
          ) : null}
        </div>

        {/* the edge / meniscus — a sibling of the clipped layer above, so its
            2px overshoot ends are never cut off */}
        <div
          aria-hidden
          className="absolute bg-foreground"
          style={{
            ...edgeBase,
            ...(vertical
              ? { left: -2, right: -2, height: 1 }
              : { top: -2, bottom: -2, width: 1 }),
            opacity: showDashed ? 0 : 1,
            transitionProperty: edgeTransitionProperty,
            transitionDuration: edgeTransitionDuration,
            transitionTimingFunction: edgeTransitionTiming,
          }}
        />
        <div
          aria-hidden
          className="absolute"
          style={{
            ...edgeBase,
            ...(vertical
              ? { left: 0, right: 0, height: 1, borderTop: "1px dashed var(--muted)" }
              : { top: 0, bottom: 0, width: 1, borderLeft: "1px dashed var(--muted)" }),
            opacity: showDashed ? 1 : 0,
            transitionProperty: edgeTransitionProperty,
            transitionDuration: edgeTransitionDuration,
            transitionTimingFunction: edgeTransitionTiming,
          }}
        />
      </div>

      <div className="flex flex-col leading-tight">
        <span className="font-mono text-base font-semibold tabular-nums text-foreground">
          {fmtMoney(Math.max(0, remaining), currency)}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          / {fmtMoney(capacity, currency)}
        </span>
        {pend > 0 && !isCommitting ? (
          <span className="mt-1 font-mono text-[11px] tabular-nums text-muted">
            − {fmtMoney(pend, currency)} next
          </span>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {liveText}
      </p>
    </div>
  );
}
