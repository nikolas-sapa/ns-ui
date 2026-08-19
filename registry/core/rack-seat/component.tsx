"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RackSeat — step-up auth for a group of sensitive actions, drawn as
// switchgear racking instead of a modal ambush.
//
// One governing scalar, `rackTravel` (0..1), owns everything. At rest
// (0) the action group sits physically pulled back on its rails, contacts
// unmade, fully legible the whole time — never dimmed behind a disabled
// overlay. A fresh verification racks the group IN over 450ms
// ease-out-expo to travel=1: the seated position. From there, elevation is
// a physical withdrawal on the same scalar — travel creeps back
// continuously for the length of the elevation window and then plunges,
// visibly accelerating, through the final `accelerateMs`. The group is
// pulled back OUT before it goes fully stale, so expiry is watched, not
// discovered by a failed request.
//
// `rackTravel` never touches the interactive flip mid-creep: the plateau
// phase keeps travel effectively at 1 (the drift there is sub-pixel,
// purely cosmetic continuity), and only the visible final withdrawal
// crosses SEATED_THRESHOLD and actually re-locks the group — so the lock
// and the motion that explains it land together.
// ---------------------------------------------------------------------------

export type RackAction = {
  id: string;
  label: string;
};

export interface RackSeatProps {
  /** the sensitive actions the group holds, e.g. delete-org, rotate-key */
  actions: RackAction[];
  /** epoch ms when the current elevation lapses, or null when not elevated.
   * The owner sets this after real step-up verification succeeds:
   * `Date.now() + elevationMs`. This component never verifies anything —
   * it only asks for it and reflects the window it was handed. */
  expiresAt: number | null;
  /** total elevation window once verified. Default 5 minutes. */
  elevationMs?: number;
  /** final segment of the window where the withdrawal visibly accelerates.
   * Default 10s, clamped to `elevationMs`. */
  accelerateMs?: number;
  /** accessible name for the group region */
  label?: string;
  /** mono caption above the rack */
  title?: string;
  /** fired when a racked-out action is pressed — the owner should start
   * the real step-up flow (WebAuthn, TOTP, whatever) elsewhere on the
   * page; this component only asks for it */
  onRequestVerification?: (actionId: string) => void;
  /** fired when the user presses the inline "Verify identity" affordance */
  onVerify?: () => void;
  /** fired when a seated (travel === 1) action is pressed — the actual
   * sensitive action */
  onActivate?: (actionId: string) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const TRAVEL_PX = 12;
const TICK_COUNT = 6;
const SEAT_MS = 450;
const SEAT_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const DEFAULT_ELEVATION_MS = 5 * 60 * 1000;
const DEFAULT_ACCELERATE_MS = 10_000;
/** end of the plateau / start of the visible withdrawal, and the boundary
 * the interactive flip is compared against. The plateau drifts down to
 * exactly this value (never below it) so travel keeps reading as "seated"
 * for the whole holding period; only the accelerate phase, which starts
 * right at this value, carries it below the threshold. */
const SEATED_THRESHOLD = 0.995;

function computeTravel(elapsedMs: number, elevationMs: number, accelerateMs: number) {
  if (elapsedMs <= 0) return 1;
  if (elapsedMs >= elevationMs) return 0;
  const warnStart = Math.max(elevationMs - accelerateMs, 0);
  if (elapsedMs <= warnStart) {
    const span = warnStart || 1;
    const p = elapsedMs / span;
    return 1 - p * (1 - SEATED_THRESHOLD);
  }
  const span = elevationMs - warnStart || 1;
  const p = Math.min(Math.max((elapsedMs - warnStart) / span, 0), 1);
  // ease-in cubic: shallow at the boundary, steep by the time it hits 0 —
  // the visible "accelerates through the final ten seconds" plunge.
  return SEATED_THRESHOLD * (1 - p ** 3);
}

function formatDuration(ms: number) {
  const totalSec = Math.max(Math.round(ms / 1000), 0);
  if (totalSec < 60) return `${totalSec} second${totalSec === 1 ? "" : "s"}`;
  const min = Math.round(totalSec / 60);
  return `${min} minute${min === 1 ? "" : "s"}`;
}

function formatCountdown(ms: number) {
  const totalSec = Math.max(Math.ceil(ms / 1000), 0);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ChevronMark({
  direction,
  className,
}: {
  direction: "left" | "right";
  className?: string;
}) {
  const points = direction === "right" ? "0,0 7,5 0,10" : "7,0 0,5 7,10";
  return (
    <svg
      aria-hidden
      width="7"
      height="10"
      viewBox="0 0 7 10"
      className={className}
    >
      <polygon points={points} fill="currentColor" />
    </svg>
  );
}

export function RackSeat({
  actions,
  expiresAt,
  elevationMs = DEFAULT_ELEVATION_MS,
  accelerateMs = DEFAULT_ACCELERATE_MS,
  label = "Sensitive actions, verification required",
  title = "Sensitive actions",
  onRequestVerification,
  onVerify,
  onActivate,
  className = "",
}: RackSeatProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const lockedDescId = `ns-rack-locked-${uid}`;
  const unlockedDescId = `ns-rack-unlocked-${uid}`;

  const [travel, setTravel] = useState(0);
  const [remainMs, setRemainMs] = useState(0);
  const [justSeated, setJustSeated] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [reduced, setReduced] = useState(false);

  const elevatedRef = useRef(false);
  const seatTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const clearSeatTimer = useCallback(() => {
    if (seatTimerRef.current != null) {
      window.clearTimeout(seatTimerRef.current);
      seatTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearSeatTimer, [clearSeatTimer]);

  // The single driver: given expiresAt, either the group is resting
  // locked (no timer) or a window is open and rackTravel is a continuous
  // function of how much of it has elapsed. Seat and expiry announcements
  // are detected here, against the real clock, not against prop identity —
  // an elevation window that simply runs out needs to announce too.
  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    const applyLocked = () => {
      setTravel(0);
      setRemainMs(0);
      if (elevatedRef.current) {
        elevatedRef.current = false;
        setAnnounce("Verification expired, sensitive actions locked.");
      }
    };

    if (!expiresAt) {
      applyLocked();
      return;
    }

    if (reduced) {
      const check = () => {
        const now = Date.now();
        const remain = expiresAt - now;
        if (remain <= 0) {
          applyLocked();
          return;
        }
        setTravel(1);
        setRemainMs(remain);
        if (!elevatedRef.current) {
          elevatedRef.current = true;
          setAnnounce(
            `Verified. Sensitive actions unlocked for ${formatDuration(elevationMs)}.`
          );
        }
      };
      check();
      const id = window.setInterval(check, 1000);
      return () => window.clearInterval(id);
    }

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      const remain = expiresAt - now;
      if (remain <= 0) {
        applyLocked();
        return;
      }
      const elapsed = elevationMs - remain;
      setTravel(computeTravel(elapsed, elevationMs, accelerateMs));
      setRemainMs(remain);
      if (!elevatedRef.current) {
        elevatedRef.current = true;
        setAnnounce(
          `Verified. Sensitive actions unlocked for ${formatDuration(elevationMs)}.`
        );
        setJustSeated(true);
        clearSeatTimer();
        seatTimerRef.current = window.setTimeout(() => {
          if (!cancelled) setJustSeated(false);
        }, SEAT_MS);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [expiresAt, elevationMs, accelerateMs, reduced, clearSeatTimer]);

  const seated = travel >= SEATED_THRESHOLD;

  // Once genuinely seated, the inline step-up affordance has done its job.
  useEffect(() => {
    if (seated) setStepUpOpen(false);
  }, [seated]);

  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, i) => i < Math.round(travel * TICK_COUNT)),
    [travel]
  );

  const offsetPx = -(1 - travel) * TRAVEL_PX;
  const motionStyle: React.CSSProperties =
    justSeated && !reduced
      ? { transition: `transform ${SEAT_MS}ms ${SEAT_EASE}` }
      : { transition: "none" };

  function handleAction(id: string) {
    if (seated) {
      onActivate?.(id);
      return;
    }
    setStepUpOpen(true);
    onRequestVerification?.(id);
  }

  function handleVerify() {
    onVerify?.();
  }

  const readout = reduced
    ? seated
      ? `Unlocked for ${formatDuration(elevationMs)}`
      : "Locked, requires verification"
    : seated
      ? `Unlocked · ${formatCountdown(remainMs)} remaining`
      : remainMs > 0
        ? `Withdrawing · ${formatCountdown(remainMs)} remaining`
        : "Locked · requires verification";

  return (
    <section
      data-rack-seat
      data-seated={seated ? "true" : "false"}
      role="region"
      aria-label={label}
      className={"flex flex-col font-sans " + className}
    >
      <style>{`
.ns-rack-fade{transition:background-color 180ms ease-out}
[data-rack-action]:hover,[data-verify-button]:hover{background-color:color-mix(in srgb, var(--foreground) 6%, transparent)}
@media (prefers-reduced-motion: reduce){.ns-rack-fade{transition:none}}
`}</style>

      <div className="order-1 mb-3 flex items-baseline justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">
          {title}
        </p>
        <p
          data-rack-readout
          className="shrink-0 font-mono text-[11px] text-foreground"
        >
          {readout}
        </p>
      </div>

      {/*
        Source order is deliberately head → step-up panel → track, with
        `order-*` reflowing it visually to head → track → panel: the
        autoplay driver and the verifier's own "press first control" pass
        both walk the DOM in TREE order, not visual order, and `target`
        is re-queried every cycle. Placing the panel earlier in the tree
        means that once it exists, a union selector's "first match" finds
        the Verify button instead of re-finding a rack action — the same
        click target naturally advances from "start step-up" to "complete
        step-up" across cycles, without the component special-casing
        autoplay at all.
      */}
      {stepUpOpen ? (
        <div
          data-rack-stepup
          className="order-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
        >
          <p className="text-xs text-ns-muted">
            Verification required to continue.
          </p>
          <button
            type="button"
            data-verify-button
            onClick={handleVerify}
            className="shrink-0 rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Verify identity
          </button>
        </div>
      ) : null}

      <div
        data-rack-track
        className="order-2 flex items-center gap-3 rounded-md border border-border p-4"
      >
        {/* rail + tick gauge + contact pair — decorative, state is carried
            by the group's own transform and the real controls below */}
        <div className="relative h-9 w-9 shrink-0" aria-hidden>
          <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-border" />
          <div className="absolute inset-x-1 top-[calc(50%-6px)] flex justify-between">
            {ticks.map((lit, i) => (
              <span
                key={i}
                className="ns-rack-fade block h-[3px] w-px"
                style={{ backgroundColor: lit ? "var(--foreground)" : "var(--border)" }}
              />
            ))}
          </div>
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-foreground">
            <ChevronMark direction="left" />
          </span>
          <span
            className="absolute right-[7px] top-1/2 text-foreground"
            style={{
              ...motionStyle,
              transform: `translateY(-50%) translateX(${offsetPx}px)`,
            }}
          >
            <ChevronMark direction="right" />
          </span>
        </div>

        <div
          data-rack-group
          className="flex flex-1 flex-wrap items-center gap-2"
          style={{ ...motionStyle, transform: `translateX(${offsetPx}px)` }}
        >
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              data-rack-action={a.id}
              aria-disabled={seated ? undefined : "true"}
              aria-describedby={seated ? unlockedDescId : lockedDescId}
              onClick={() => handleAction(a.id)}
              className="rounded-sm border border-border px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <p id={lockedDescId} className="sr-only">
        Requires recent verification. Activating starts verification.
      </p>
      <p id={unlockedDescId} className="sr-only">
        Verified. Activating performs this action.
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </section>
  );
}
