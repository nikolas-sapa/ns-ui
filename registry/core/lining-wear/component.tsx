"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// LiningWear — a dunning / payment-retry card that renders the subscription's
// grip on "active" as a clutch friction lining wearing down, not a yellow
// past-due badge. One governing scalar, `lining = attemptsRemaining /
// maxAttempts`, drives everything: pad height (base x lining) with
// laminations ruled every segment so remaining depth is countable at rest;
// each FAILED charge (attemptsUsed increasing) is one abrasion event — the
// pad+label group slips sideways under load by (1 - lining) x 12px (capped:
// a worn clutch grips worse, so later failures slip further) and settles
// back with a spring whose duration eases 300ms -> 700ms as lining drops
// (the same settle also carries the pad's one-segment drop, so the last
// failure's heavier, slower settle reads as the plate physically
// disengaging toward "paused" rather than a special-cased animation). One
// lamination abrades away per failure, leaving a permanent scored line at a
// fixed position that nothing later ever redraws over, and one debris tick
// drops into the row below. Wear is monotonic within a billing cycle: no
// code path here ever removes a scored line or a debris tick while `cycleId`
// is unchanged, because that would erase the datum a past-due customer and
// support both need ("this card has already failed three times"). Recovery
// is a distinct re-line, triggered only by a `cycleId` change: the old
// scored block is snapshotted into a small half-visible "last cycle" well
// and a fresh, unscored pad swaps in — never a health-bar refill.
//
// Status is text first, not carried by the graphic: a plain paragraph reads
// e.g. "Payment failed, attempt 2 of 4. Next retry Thu 21 Aug.", a second
// line spells out attempts remaining, the retry schedule is a real <ol>, and
// "Update payment method" is a real button. The wear graphic itself is
// aria-hidden and holds no interactive control. Each new failure announces
// exactly once through a role=alert/aria-live=assertive span — genuinely
// urgent, not routine chatter. prefers-reduced-motion drops the slip/settle
// transform outright; laminations still decrement and scored lines still
// accumulate on the very same render, so the state is never motion-gated.
//
// Direct-DOM refs carry the one hot-path transform (the grip's FLIP-style
// translate); every other visual (scored lines, laminations, debris,
// schedule, status text) is plain declarative React driven by props. Zero
// dependencies, DOM + CSS only, no canvas.
// ---------------------------------------------------------------------------

export interface LiningWearProps {
  /** Subscription / plan name shown in the card header. Default "Pro plan". */
  planName?: string;
  /**
   * Failed charge attempts so far THIS billing cycle. Monotonic within a
   * cycle — increment by 1 each time a charge attempt fails. Reset to 0
   * (together with a changed `cycleId`) once a charge succeeds and a new
   * cycle begins; that is the only sanctioned way this component's wear
   * ever goes down.
   */
  attemptsUsed: number;
  /** Total attempts allotted before the subscription pauses. Default 4. */
  maxAttempts?: number;
  /**
   * Calendar label for every retry slot, oldest first, length `maxAttempts`
   * (e.g. ["Mon 14 Aug", "Thu 17 Aug", "Sun 20 Aug", "Wed 23 Aug"]). Drives
   * both the status line's "next retry" text and the schedule list.
   */
  attemptDates: string[];
  /**
   * Change this (any new value) to start a fresh billing cycle: the current
   * scored pad retires into the "last cycle" well and a clean, unscored
   * pad swaps in. Pass `attemptsUsed={0}` alongside the new id.
   */
  cycleId?: string | number;
  /** Called when the visitor presses "Update payment method". */
  onUpdatePayment?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const FRAME_H = 64;
const SLIP_MAX_PX = 12;
const SETTLE_MIN_MS = 300;
const SETTLE_MAX_MS = 700;
const EASE_SETTLE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

function segmentH(maxAttempts: number) {
  return FRAME_H / Math.max(1, maxAttempts);
}

// Deterministic pseudo-random in [0,1) so debris drift never differs between
// server and client renders (a real Math.random() here would hydrate wrong).
function hash01(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function computeSettle(lining: number) {
  const clampedLining = Math.min(1, Math.max(0, lining));
  const slip = Math.round((1 - clampedLining) * SLIP_MAX_PX * 10) / 10;
  const ms = Math.round(SETTLE_MIN_MS + (1 - clampedLining) * (SETTLE_MAX_MS - SETTLE_MIN_MS));
  return { slip, ms };
}

function animateGripStep(
  el: HTMLDivElement | null,
  fromTopPx: number,
  toTopPx: number,
  slipPx: number,
  ms: number,
  reduced: boolean
) {
  if (!el) return;
  if (reduced) {
    el.style.transition = "none";
    el.style.transform = "translate(0px, 0px)";
    return;
  }
  // FLIP: land at the new resting position instantly (the React-controlled
  // `top` already moved there), then hold the OLD visual position plus the
  // sideways slip via transform, and only next frame ease both back to zero.
  el.style.transition = "none";
  el.style.transform = `translate(${slipPx}px, ${fromTopPx - toTopPx}px)`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = `transform ${ms}ms ${EASE_SETTLE}`;
      el.style.transform = "translate(0px, 0px)";
    });
  });
}

function statusText(attemptsUsed: number, maxAttempts: number, attemptDates: string[]) {
  if (attemptsUsed <= 0) {
    return `Payment active. ${maxAttempts} of ${maxAttempts} retry attempts available.`;
  }
  if (attemptsUsed < maxAttempts) {
    const next = attemptDates[attemptsUsed] ?? "soon";
    return `Payment failed, attempt ${attemptsUsed} of ${maxAttempts}. Next retry ${next}.`;
  }
  return `Payment failed ${maxAttempts} times this cycle. Subscription paused — update your payment method to resume.`;
}

interface LastCycle {
  attemptsUsed: number;
  maxAttempts: number;
}

export function LiningWear({
  planName = "Pro plan",
  attemptsUsed,
  maxAttempts = 4,
  attemptDates,
  cycleId,
  onUpdatePayment,
  className = "",
}: LiningWearProps) {
  const gripRef = useRef<HTMLDivElement | null>(null);
  const topPxRef = useRef(0);
  const reducedRef = useRef(false);
  const prevAttemptsRef = useRef(0);
  const prevCycleRef = useRef<string | number | undefined>(cycleId);
  const firstRunRef = useRef(true);

  const [liveMsg, setLiveMsg] = useState("");
  const [lastCycle, setLastCycle] = useState<LastCycle | null>(null);
  const [wellEntering, setWellEntering] = useState(false);

  const introId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const clamped = Math.max(0, Math.min(attemptsUsed, maxAttempts));

  useEffect(() => {
    const prevAttempts = prevAttemptsRef.current;
    const prevCycle = prevCycleRef.current;
    prevAttemptsRef.current = clamped;
    prevCycleRef.current = cycleId;

    if (firstRunRef.current) {
      firstRunRef.current = false;
      topPxRef.current = clamped * segmentH(maxAttempts);
      return;
    }

    const cycleChanged = prevCycle !== cycleId;
    if (cycleChanged) {
      // Re-line: retire the worn block into the "last cycle" well instead of
      // erasing it, then swap in a fresh unscored pad with no animation of
      // its own — the well entrance is what carries the transition.
      setLastCycle({ attemptsUsed: prevAttempts, maxAttempts });
      topPxRef.current = clamped * segmentH(maxAttempts);
      if (gripRef.current) {
        gripRef.current.style.transition = "none";
        gripRef.current.style.transform = "translate(0px, 0px)";
      }
      setWellEntering(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setWellEntering(false)));
      return;
    }

    if (clamped > prevAttempts) {
      const lining = (maxAttempts - clamped) / maxAttempts;
      const { slip, ms } = computeSettle(lining);
      const newTop = clamped * segmentH(maxAttempts);
      animateGripStep(gripRef.current, topPxRef.current, newTop, slip, ms, reducedRef.current);
      topPxRef.current = newTop;
      setLiveMsg(statusText(clamped, maxAttempts, attemptDates));
    } else if (clamped !== prevAttempts) {
      // Defensive: attemptsUsed dropped without a cycleId change. That
      // shouldn't happen per contract, but resync silently rather than
      // pretend a lamination came back.
      topPxRef.current = clamped * segmentH(maxAttempts);
      if (gripRef.current) {
        gripRef.current.style.transition = "none";
        gripRef.current.style.transform = "translate(0px, 0px)";
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, cycleId, maxAttempts]);

  const remaining = maxAttempts - clamped;
  const disengaged = clamped >= maxAttempts;
  const segH = segmentH(maxAttempts);
  const gripTop = clamped * segH;
  const gripH = FRAME_H - gripTop;

  return (
    <div
      className={`w-full max-w-sm rounded-[12px] border border-border bg-background p-5 ${className}`}
    >
      <style>{CSS}</style>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{planName}</p>
          <p id={introId} className="mt-1 text-xs text-ns-muted">
            {statusText(clamped, maxAttempts, attemptDates)}
          </p>
        </div>

        {/* Wear mechanism — purely decorative, aria-hidden. Every fact it
            encodes is also written as plain text elsewhere on the card. */}
        <div className="flex shrink-0 flex-col items-center gap-1" aria-hidden="true">
          <div
            className="relative w-[92px] overflow-hidden rounded-[6px] border border-border bg-background"
            style={{ height: FRAME_H }}
          >
            {/* Permanent scored lines — one per past failure, fixed position,
                never moved or removed while this cycle lives. */}
            {Array.from({ length: clamped }, (_, i) => (
              <div
                key={`scar-${i}`}
                className="absolute left-0 right-0 bg-foreground"
                style={{ top: (i + 1) * segH - 1, height: 1.5 }}
              />
            ))}

            {/* The grip: remaining lining + laminations + the "active"/
                "paused" label, all sliding and settling together as one
                unit — the slip lives on this ref's transform only. */}
            <div
              ref={gripRef}
              className="ns-lw-grip absolute left-0 right-0"
              style={{ top: gripTop, height: gripH }}
            >
              <div className="h-full w-full border-t-2 border-t-foreground bg-border/25">
                {Array.from({ length: Math.max(0, remaining - 1) }, (_, i) => (
                  <div
                    key={`lam-${i}`}
                    className="absolute left-0 right-0 h-px bg-border"
                    style={{ top: (i + 1) * segH }}
                  />
                ))}
              </div>
              <span className="absolute left-1.5 top-0.5 font-mono text-[8px] uppercase tracking-wider text-foreground">
                {disengaged ? "Paused" : "Active"}
              </span>
            </div>
          </div>

          {/* Debris ticks — one per failed attempt this cycle, drifting. */}
          <div className="flex h-2.5 items-end gap-[3px]">
            {Array.from({ length: clamped }, (_, i) => {
              const j = hash01(i + 1);
              return (
                <span
                  key={`debris-${i}`}
                  className="block w-[2px] bg-ns-muted"
                  style={{
                    height: 3 + j * 3,
                    transform: `translateY(${j * 2}px) rotate(${(j - 0.5) * 24}deg)`,
                  }}
                />
              );
            })}
          </div>

          {/* Last cycle well — half-visible retired block from the cycle
              before this one, swapped in only on a cycleId change. */}
          {lastCycle && (
            <div
              className={`ns-lw-well flex items-center gap-1 opacity-40 ${wellEntering ? "ns-lw-well-enter" : ""}`}
            >
              <span className="font-mono text-[8px] uppercase tracking-wide text-ns-muted">
                last cycle
              </span>
              <div className="flex gap-[1.5px]">
                {Array.from({ length: lastCycle.maxAttempts }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1 ${i < lastCycle.attemptsUsed ? "bg-foreground" : "border border-border"}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-foreground">
        {remaining} of {maxAttempts} retry attempts remaining.
      </p>

      <ol className="mt-3 divide-y divide-border border-t border-border">
        {attemptDates.slice(0, maxAttempts).map((date, i) => {
          const state = i < clamped ? "Failed" : i === clamped && !disengaged ? "Scheduled" : "Pending";
          return (
            <li key={i} className="flex items-center justify-between gap-3 py-1.5 text-xs">
              <span className="text-foreground">Attempt {i + 1}</span>
              <span className="font-mono text-ns-muted">{date}</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-foreground">
                {state}
              </span>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={onUpdatePayment}
        aria-describedby={introId}
        className="mt-4 w-full rounded-[6px] border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-border/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        Update payment method
      </button>

      {/* Fires once per new failure. Genuinely urgent, so assertive — not
          the routine-status polite region other indicators in this
          registry use. */}
      <span role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {liveMsg}
      </span>
    </div>
  );
}

const CSS = `
.ns-lw-well{transition:opacity 260ms ease-out, transform 260ms ease-out;}
.ns-lw-well-enter{opacity:0 !important;transform:translateX(-6px);}
@media (prefers-reduced-motion: reduce){
  .ns-lw-grip{transition:none !important;transform:translate(0px,0px) !important;}
  .ns-lw-well,.ns-lw-well-enter{transition:none !important;transform:none !important;opacity:0.4 !important;}
}
`;
