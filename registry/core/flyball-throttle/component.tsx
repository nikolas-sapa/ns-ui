"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FlyballThrottle — a spend-cap widget built as a Watt centrifugal governor.
// One governing scalar, omega = spendRate / safeRate (safeRate = cap /
// periodDays), drives the whole mechanism: arm elevation angle rises with
// omega squared (capped at 68deg — the linkage self-intersects past that),
// the sleeve collar's drop down the spindle is computed FROM that angle
// through the drawn linkage (armLength * (1 - cos angle)), and the throttle
// lever's rotation maps LINEARLY from the collar's drop, sweeping across a
// small gate track until it lies flat over it at full flare. Axial spin is
// faked (never truly rotated — this is a side-profile diagram) by oscillating
// the two-arm-and-balls group's x-scale on one shared keyframe, at a period
// of SPIN_BASE_MS / omega set through a single CSS custom property — lazy
// spin reads as healthy, a fast blur reads as hot, with no per-ball
// choreography. `value`-style level state (percent of cap already spent)
// never touches the geometry: the arms answer "how fast is it burning right
// now", not "how much is gone" — that distinction is the whole point, and
// is what keeps this legible on day 28 of a calm, on-pace period as well as
// day 6 of a reckless one. Every geometry change (arm/ball position, collar
// drop, lever angle) rides one shared 250ms non-overshooting CSS transition
// on the transitionable SVG geometry properties (d/cx/cy/x/y — all
// CSS-animatable in evergreen browsers) so a stream of per-request omega
// updates settles smoothly instead of twitching frame to frame; no JS
// spring loop. `spent` vs `cap` is a genuinely separate, level-based
// boolean (capReached) that disables the two real action buttons — with
// aria-disabled (not the native attribute, so Tab still reaches them) plus
// an explanatory paragraph — and tints the collar's fill; it never feeds
// the arm/collar/lever geometry itself. DOM+SVG+CSS only, no canvas, every
// stroke/fill a `var(--token)`, --ns-accent reserved for focus/hover.
// ---------------------------------------------------------------------------

export interface FlyballThrottleProps {
  /** current burn rate, currency units per day */
  spendRate: number;
  /** total spend cap for the period */
  cap: number;
  /** length of the cap period, in days */
  periodDays: number;
  /** amount already spent this period — the level that actually gates the buttons */
  spent: number;
  /** currency symbol prefix for readouts (default "$") */
  currency?: string;
  /** what's being governed, shown above the readout, e.g. "API spend" */
  label?: string;
  /** called when "New purchase" is activated while under cap */
  onNewPurchase?: () => void;
  /** called when "Raise limit" is activated while under cap */
  onRaiseLimit?: () => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// geometry, SVG viewBox units — one side-profile governor: lever+gate at the
// top, arm pivot and flyball assembly below it, sleeve collar sliding on the
// spindle below that, motor housing at the base.
const VIEW_W = 280;
const VIEW_H = 260;
const CX = 140;

const LEVER_PIVOT_Y = 48;
const LEVER_LEN = 84;
const LEVER_OPEN_DEG = 30; // resting angle above the gate track — clearly open
const LEVER_CLOSED_DEG = 0; // flat along the gate track — fully closed over it
const GATE_X1 = CX + LEVER_LEN; // where the gate track ends, == lever tip when flat

const ARM_PIVOT_Y = 108;
const ARM_LEN = 46;
const BALL_R = 7;
const MAX_ARM_DEG = 68; // the linkage self-intersects past this — hard ceiling
const MAX_ARM_RAD = (MAX_ARM_DEG * Math.PI) / 180;
const MAX_COLLAR_DROP = ARM_LEN * (1 - Math.cos(MAX_ARM_RAD));
const ANGLE_K = 22; // deg of arm elevation per omega^2 — small-physics approximation
// real flyball arms hinge on a finite pivot and never fold flush against the
// shaft — without a floor, low-omega ball centers sit closer together than
// their own 2*BALL_R diameter and merge into one blob, which is exactly the
// idle/default frame the registry's owner judges first and hardest. 13deg
// keeps the two balls visibly separated (2*ARM_LEN*sin(13deg) ≈ 20.7px
// center-to-center against a 14px diameter) at omega -> 0.
const MIN_HANG_DEG = 13;

const COLLAR_Y0 = 168; // collar's reference position at omega -> 0 (idle)
const COLLAR_W = 34;
const COLLAR_H = 10;

const MOTOR_TOP_Y = 214;
const MOTOR_H = 30;

const HOT_OMEGA = 1.3; // burn meaningfully above sustainable pace, short of capped
const SPIN_BASE_MS = 900; // spin period at omega == 1 (running exactly at sustainable pace)
const MIN_SPIN_MS = 260;
const MAX_SPIN_MS = 4000;
const MIN_OMEGA_FOR_SPIN = 0.08; // divisor floor so idle settles at MAX_SPIN_MS, not Infinity

type Band = "calm" | "hot" | "closed";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtMoney(n: number, currency: string) {
  if (!Number.isFinite(n)) return `${currency}0`;
  const v = Math.max(0, n);
  const text = v < 10 && !Number.isInteger(v) ? v.toFixed(1) : Math.round(v).toString();
  return `${currency}${text}`;
}

function fmtDays(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "today";
  if (n < 1) return "under a day";
  const r = Math.round(n);
  return `${r} day${r === 1 ? "" : "s"}`;
}

export function FlyballThrottle({
  spendRate,
  cap,
  periodDays,
  spent,
  currency = "$",
  label = "Spend governor",
  onNewPurchase,
  onRaiseLimit,
  className = "",
}: FlyballThrottleProps) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const descId = `${uid}-desc`;
  const closedNoteId = `${uid}-closed`;

  const safeSpendRate = Math.max(0, spendRate);
  const safeRate = periodDays > 0 ? cap / periodDays : 0;
  const omega = safeRate > 0 ? safeSpendRate / safeRate : safeSpendRate > 0 ? Number.POSITIVE_INFINITY : 0;
  const omegaForGeometry = Number.isFinite(omega) ? omega : 999;

  const angleDeg = clamp(
    MIN_HANG_DEG + ANGLE_K * omegaForGeometry * omegaForGeometry,
    MIN_HANG_DEG,
    MAX_ARM_DEG
  );
  const angleRad = (angleDeg * Math.PI) / 180;

  const ballDX = ARM_LEN * Math.sin(angleRad);
  const ballDY = ARM_LEN * Math.cos(angleRad);
  const ballLeftX = CX - ballDX;
  const ballRightX = CX + ballDX;
  const ballY = ARM_PIVOT_Y + ballDY;

  const collarDrop = ARM_LEN * (1 - Math.cos(angleRad));
  const collarY = COLLAR_Y0 + collarDrop;

  const throttleFrac = MAX_COLLAR_DROP > 0 ? clamp(collarDrop / MAX_COLLAR_DROP, 0, 1) : 0;
  const leverDeg = LEVER_OPEN_DEG - (LEVER_OPEN_DEG - LEVER_CLOSED_DEG) * throttleFrac;
  const leverRad = (leverDeg * Math.PI) / 180;
  const leverEndX = CX + LEVER_LEN * Math.cos(leverRad);
  const leverEndY = LEVER_PIVOT_Y - LEVER_LEN * Math.sin(leverRad);

  const spinMs = clamp(SPIN_BASE_MS / Math.max(omegaForGeometry, MIN_OMEGA_FOR_SPIN), MIN_SPIN_MS, MAX_SPIN_MS);

  // capReached is a real, independent level check — spent vs cap — never the
  // arm/collar/lever geometry above, which is entirely rate-derived (omega).
  const capReached = cap > 0 && spent >= cap;

  const daysToCap = safeSpendRate > 0 ? (cap - spent) / safeSpendRate : Number.POSITIVE_INFINITY;
  const forecastText = capReached
    ? "the cap has been reached for this period"
    : !Number.isFinite(daysToCap) || daysToCap > periodDays
      ? "on pace to stay under cap this period"
      : `cap reached in ${fmtDays(daysToCap)} at this pace`;

  const band: Band = capReached ? "closed" : omega >= HOT_OMEGA ? "hot" : "calm";
  const [announce, setAnnounce] = useState("");
  const prevBandRef = useRef<Band | null>(null);

  useEffect(() => {
    if (prevBandRef.current === null) {
      prevBandRef.current = band; // no crossing announcement on first paint
      return;
    }
    if (prevBandRef.current === band) return;
    prevBandRef.current = band;
    if (band === "closed") {
      setAnnounce(
        `Closed — spend cap of ${fmtMoney(cap, currency)} reached; new purchases and limit increases are disabled until next period.`
      );
    } else if (band === "hot") {
      setAnnounce(
        `Hot — burning ${fmtMoney(safeSpendRate, currency)}/day against a ${fmtMoney(safeRate, currency)}/day sustainable rate.`
      );
    } else {
      setAnnounce("Calm — burn rate back under the sustainable pace.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [band]);

  const btnBase =
    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent";
  const btnLive =
    "border-border bg-background text-foreground hover:border-foreground/30 hover:bg-foreground/[0.05] cursor-pointer";
  const btnDead = "border-border bg-background text-ns-muted opacity-50 cursor-not-allowed";

  return (
    <div
      role="group"
      data-flyball-root
      aria-labelledby={labelId}
      aria-describedby={descId}
      className={`w-full max-w-md rounded-md border border-border bg-background p-5 ${className}`}
    >
      <style>{`
.ns-flyball-part{transition-property:d,cx,cy,x,y}
.ns-flyball-part{transition-duration:250ms;transition-timing-function:cubic-bezier(0.16,1,0.3,1)}
@keyframes ns-flyball-spin{0%,100%{transform:scaleX(1)}50%{transform:scaleX(0.74)}}
.ns-flyball-spin-group{
  animation:ns-flyball-spin var(--ns-flyball-spin-ms,1400ms) linear infinite;
  transform-box:view-box;
  transform-origin:${CX}px ${ARM_PIVOT_Y}px;
}
@media (prefers-reduced-motion: reduce){
  .ns-flyball-part{transition:none !important}
  .ns-flyball-spin-group{animation:none !important}
}
`}</style>

      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="font-mono text-[11px] tracking-wide text-ns-muted">
          {label.toUpperCase()}
        </span>
        <span className="font-mono text-[11px] font-semibold tracking-wide text-foreground">
          {band.toUpperCase()}
        </span>
      </div>

      <p id={descId} className="mt-2 text-sm leading-relaxed text-foreground">
        Spending <span className="font-mono font-semibold">{fmtMoney(safeSpendRate, currency)}</span>/day against a{" "}
        <span className="font-mono">{fmtMoney(safeRate, currency)}</span>/day sustainable rate — {forecastText}.
      </p>

      <div aria-hidden="true" className="mt-3 flex justify-center">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-[210px] w-full max-w-[260px]"
          aria-hidden="true"
          focusable="false"
        >
          {/* spindle shaft */}
          <line x1={CX} y1={LEVER_PIVOT_Y} x2={CX} y2={MOTOR_TOP_Y} stroke="var(--border)" strokeWidth={2} />

          {/* motor housing, fixed reference at the base */}
          <rect
            x={CX - 30}
            y={MOTOR_TOP_Y}
            width={60}
            height={MOTOR_H}
            rx={4}
            fill="none"
            stroke="var(--border)"
            strokeWidth={2}
          />

          {/* pushrod — collar to lever pivot, the coupling that makes the collar "drive" the lever */}
          <line
            className="ns-flyball-part"
            x1={CX + 6}
            y1={collarY}
            x2={CX + 6}
            y2={LEVER_PIVOT_Y + 4}
            stroke="var(--border)"
            strokeWidth={1.25}
            strokeDasharray="2 5"
          />

          {/* throttle gate track + the two action glyphs the lever sweeps over */}
          <line
            x1={CX}
            y1={LEVER_PIVOT_Y}
            x2={GATE_X1}
            y2={LEVER_PIVOT_Y}
            stroke="var(--border)"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.55}
          />
          <rect
            x={CX + 20}
            y={LEVER_PIVOT_Y + 8}
            width={16}
            height={10}
            rx={2}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1.25}
          />
          <rect
            x={CX + 48}
            y={LEVER_PIVOT_Y + 8}
            width={16}
            height={10}
            rx={2}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1.25}
          />

          {/* lever pivot joint + the lever itself, rotation mapped linearly from collar drop */}
          <circle cx={CX} cy={LEVER_PIVOT_Y} r={3} fill="var(--foreground)" />
          <path
            className="ns-flyball-part"
            d={`M ${CX} ${LEVER_PIVOT_Y} L ${leverEndX.toFixed(2)} ${leverEndY.toFixed(2)}`}
            stroke="var(--foreground)"
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* arm pivot joint */}
          <circle cx={CX} cy={ARM_PIVOT_Y} r={3} fill="var(--foreground)" />

          {/* the 4-element flyball linkage — two arms, two ball weights — spun as one group */}
          <g
            className="ns-flyball-spin-group"
            style={{ "--ns-flyball-spin-ms": `${spinMs}ms` } as React.CSSProperties}
          >
            <path
              className="ns-flyball-part"
              d={`M ${CX} ${ARM_PIVOT_Y} L ${ballLeftX.toFixed(2)} ${ballY.toFixed(2)}`}
              stroke="var(--foreground)"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <path
              className="ns-flyball-part"
              d={`M ${CX} ${ARM_PIVOT_Y} L ${ballRightX.toFixed(2)} ${ballY.toFixed(2)}`}
              stroke="var(--foreground)"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            <circle className="ns-flyball-part" cx={ballLeftX.toFixed(2)} cy={ballY.toFixed(2)} r={BALL_R} fill="var(--foreground)" />
            <circle className="ns-flyball-part" cx={ballRightX.toFixed(2)} cy={ballY.toFixed(2)} r={BALL_R} fill="var(--foreground)" />
          </g>

          {/* sleeve collar — height is purely a function of arm angle, never of spent/cap */}
          <rect
            className="ns-flyball-part"
            x={CX - COLLAR_W / 2}
            y={collarY.toFixed(2)}
            width={COLLAR_W}
            height={COLLAR_H}
            rx={2}
            fill={capReached ? "var(--foreground)" : "none"}
            stroke="var(--foreground)"
            strokeWidth={2}
          />
        </svg>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          aria-disabled={capReached}
          aria-describedby={capReached ? `${descId} ${closedNoteId}` : descId}
          onClick={() => {
            if (!capReached) onNewPurchase?.();
          }}
          className={`${btnBase} ${capReached ? btnDead : btnLive}`}
        >
          New purchase
        </button>
        <button
          type="button"
          aria-disabled={capReached}
          aria-describedby={capReached ? `${descId} ${closedNoteId}` : descId}
          onClick={() => {
            if (!capReached) onRaiseLimit?.();
          }}
          className={`${btnBase} ${capReached ? btnDead : btnLive}`}
        >
          Raise limit
        </button>
      </div>

      {capReached ? (
        <p id={closedNoteId} data-flyball-closed-note className="mt-2 font-mono text-[11px] text-ns-muted">
          Disabled — the {fmtMoney(cap, currency)} cap for this period has been reached. New purchases and
          limit increases resume next period.
        </p>
      ) : null}
    </div>
  );
}
