"use client";

import { useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SpecieClip — a partial-refund control drawn as a struck coin: an SVG disc
// with a reeded edge (120 ticks, every 3deg) and the outstanding amount as
// its face. Refunding is CLIPPING: the user drags a chord across the disc
// and the sector on the far side of it is the refund.
//
// The one governing scalar is `refundFrac` (0-1). Geometry and money are
// bound by the real circular-segment area formula, not a linear ratio:
//   fracAtD(d)   = (acos(d) - d*sqrt(1-d^2)) / pi     for d in [-1, 1]
// where d is the chord's signed offset from the disc centre in radius
// units. This is exact and cheap (one acos), so live dragging reads the
// chord's pixel position and evaluates it directly, forward, every move.
// The INVERSE — "what chord position pays out exactly 25%, or exactly
// $30.00" — has no closed form (acos - d*sqrt(1-d^2) isn't solvable for d
// algebraically), so whenever refundFrac is the source of truth (keyboard
// step, typed amount, a snapped detent, a controlled-prop sync) the chord
// position is looked up from a 256-sample table of fracAtD(d) built once at
// module load and walked with linear interpolation. Forward = formula.
// Backward = table. Both directions always agree because they're the same
// curve; nothing here is a disguised linear slider.
//
// RENDER: the coin is drawn twice, once per side of the chord, each a full
// disc + full reeded edge + full face text, each clipped to its half by a
// <clipPath> rect driven by the same chord x. Together the two halves are
// pixel-identical to one undivided coin — the seam is the clip boundary,
// nothing is faked. On commit (button only, never on drag release) the far
// side's <g> is torn free with a single 280ms translate+fade tween along
// the chord's normal, eased ease-out-expo (1 - 2^(-10t), a real physical
// deceleration curve, not a CSS approximation) and driven imperatively via
// rAF writing the SVG `transform`/`opacity` attributes directly — CSS
// transitions on inline SVG groups are ambiguous about px-vs-user-space
// under viewBox scaling, so this keeps the shear numerically exact in the
// same coordinate system as the ticks it's carrying with it. The shear
// reads from that geometry alone — the departing <g>'s own translate+fade
// is the only signal that it's being torn free. When the tween lands, the
// coin re-strikes: the outstanding amount drops by the refund and the
// chord resets to the disc's edge (0% again), ready for the next partial
// refund. The live cut line inside the coin (the chord's visible
// position, doubling as the otherwise-invisible role=slider handle's
// value indicator) is drawn in --border, the same value the disc's own
// edge stroke uses — it reads as another physical seam of the coin, not
// an accent highlight. The clip boundary alone can't carry that job: the
// two halves are deliberately pixel-identical to one undivided coin at
// rest, so the boundary itself is invisible until commit tears the cut
// half free. --ns-accent appears only on the keyboard focus ring — the
// one genuinely interaction-tied, never rest-state, use of it.
// ---------------------------------------------------------------------------

const VB = 200; // svg viewBox is VB x VB
const CX = VB / 2;
const CY = VB / 2;
const FACE_R = 78; // metal disc radius
const OUTER_R = 92; // reeded-edge tick outer radius
const TICK_STEP_DEG = 3;
const TICK_ANGLES: number[] = Array.from(
  { length: 360 / TICK_STEP_DEG },
  (_, i) => i * TICK_STEP_DEG
);

const LUT_SIZE = 256;
const SHEAR_MS = 280;
const SHEAR_DX = 46; // svg user units the cut sector travels on commit
const SNAP_PX = 4; // real screen px radius for detent snapping

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function round2(v: number) {
  return Math.round(v * 100) / 100;
}

/** Area, as a fraction of the whole disc, that lies on the far side (x > d)
 * of a chord at signed offset d (in radius units, -1..1) from the centre of
 * a unit circle. Exact, closed-form, monotonically decreasing 1 -> 0. */
function fracAtD(d: number): number {
  const dc = clamp(d, -1, 1);
  return (Math.acos(dc) - dc * Math.sqrt(1 - dc * dc)) / Math.PI;
}

// Precomputed once: FRAC_TABLE[i] = fracAtD(d) for d sampled uniformly
// across [-1, 1]. fracAtD has no algebraic inverse, so recovering "the d
// that pays out this fraction" is done by walking this table, never by
// re-deriving it per call.
const FRAC_TABLE: number[] = Array.from({ length: LUT_SIZE }, (_, i) =>
  fracAtD(-1 + (2 * i) / (LUT_SIZE - 1))
);

/** Inverse of fracAtD: given a target refund fraction, find the chord
 * offset d that produces it — binary search into FRAC_TABLE (monotonic
 * descending) plus linear interpolation between the two bracketing
 * samples. */
function dForFrac(frac: number): number {
  const f = clamp(frac, 0, 1);
  let lo = 0;
  let hi = LUT_SIZE - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (FRAC_TABLE[mid] > f) lo = mid;
    else hi = mid;
  }
  const fLo = FRAC_TABLE[lo];
  const fHi = FRAC_TABLE[hi];
  const span = fLo - fHi;
  const u = span > 1e-9 ? (fLo - f) / span : 0;
  const dLo = -1 + (2 * lo) / (LUT_SIZE - 1);
  const dHi = -1 + (2 * hi) / (LUT_SIZE - 1);
  return dLo + (dHi - dLo) * u;
}

/** Rounds a raw dollar amount to a "nice" support-refund step, scaled to
 * the size of the charge — $120 rounds to $5s, $1200 rounds to $100s. */
function niceStep(chargeValue: number): number {
  if (chargeValue <= 20) return 1;
  if (chargeValue <= 100) return 5;
  if (chargeValue <= 500) return 10;
  if (chargeValue <= 2000) return 25;
  return 100;
}

/** Snaps a raw drag-derived fraction to the nearest of {25%, 50%, 100%, one
 * nice round dollar amount} if that candidate's chord position is within
 * SNAP_PX real pixels of the raw one — else returns the raw fraction
 * untouched. */
function snapFrac(
  rawD: number,
  rawFrac: number,
  chargeValue: number,
  pxPerUnit: number
): number {
  if (!(pxPerUnit > 0)) return rawFrac;
  const rawPx = rawD * FACE_R;
  const candidates: number[] = [0.25, 0.5, 1];
  if (chargeValue > 0) {
    const step = niceStep(chargeValue);
    const rounded = clamp(
      Math.round((chargeValue * rawFrac) / step) * step,
      0,
      chargeValue
    );
    candidates.push(rounded / chargeValue);
  }
  let best = rawFrac;
  let bestDist = Infinity;
  for (const c of candidates) {
    const px = dForFrac(c) * FACE_R;
    const dist = Math.abs(px - rawPx) * pxPerUnit;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return bestDist <= SNAP_PX ? best : rawFrac;
}

function fmt(amount: number, symbol: string) {
  return `${symbol}${amount.toFixed(2)}`;
}

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

interface DiscFaceProps {
  label: string;
}

/** The struck face: disc + reeded edge + amount. Rendered twice (once per
 * clip half) so the two halves are, together, one undivided coin. */
function DiscFace({ label }: DiscFaceProps) {
  return (
    <>
      <circle
        cx={CX}
        cy={CY}
        r={FACE_R}
        fill="var(--background)"
        stroke="var(--border)"
        strokeWidth={1.5}
      />
      {TICK_ANGLES.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return (
          <line
            key={deg}
            x1={CX + FACE_R * cos}
            y1={CY + FACE_R * sin}
            x2={CX + OUTER_R * cos}
            y2={CY + OUTER_R * sin}
            stroke="var(--ns-muted)"
            strokeWidth={1}
          />
        );
      })}
      <text
        x={CX}
        y={CY}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-mono"
        fill="var(--foreground)"
        fontSize={18}
        fontWeight={500}
      >
        {label}
      </text>
    </>
  );
}

export interface SpecieClipProps {
  /** controlled outstanding charge amount available to refund */
  chargeAmount?: number;
  /** uncontrolled initial charge amount */
  defaultChargeAmount?: number;
  /** controlled refund fraction, 0-1 */
  refundFrac?: number;
  /** uncontrolled initial refund fraction */
  defaultRefundFrac?: number;
  /** currency symbol prefix */
  currencySymbol?: string;
  /** fires on every drag/keyboard/typed change to the fraction (no money moves) */
  onRefundFracChange?: (frac: number) => void;
  /** fires once the refund is committed via the button, after the shear settles */
  onRefund?: (refundedAmount: number, remainingAmount: number) => void;
  /** extra classes merged onto the root element */
  className?: string;
}

export function SpecieClip({
  chargeAmount,
  defaultChargeAmount = 120,
  refundFrac,
  defaultRefundFrac = 0.25,
  currencySymbol = "$",
  onRefundFracChange,
  onRefund,
  className = "",
}: SpecieClipProps) {
  const isChargeControlled = chargeAmount !== undefined;
  const [chargeInternal, setChargeInternal] = useState(() =>
    Math.max(0, defaultChargeAmount)
  );
  const chargeValue = isChargeControlled
    ? (chargeAmount as number)
    : chargeInternal;

  const isFracControlled = refundFrac !== undefined;
  const [fracInternal, setFracInternal] = useState(() =>
    clamp(defaultRefundFrac, 0, 1)
  );
  const fracValue = isFracControlled ? (refundFrac as number) : fracInternal;

  const [dragging, setDragging] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [ledgerMsg, setLedgerMsg] = useState("");

  const coinBoxRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const cutGroupRef = useRef<SVGGElement>(null);

  const keptClipId = useId();
  const cutClipId = useId();
  const inputId = useId();

  const commitFracChange = (next: number) => {
    const q = clamp(next, 0, 1);
    if (!isFracControlled) setFracInternal(q);
    onRefundFracChange?.(q);
  };

  const d = dForFrac(fracValue);
  const chordXpx = clamp(CX + d * FACE_R, CX - FACE_R, CX + FACE_R);
  const refundAmt = round2(chargeValue * fracValue);
  const remainingAmt = round2(Math.max(0, chargeValue - refundAmt));
  const pct = Math.round(fracValue * 100);
  const valueText = `refund ${fmt(refundAmt, currencySymbol)} of ${fmt(
    chargeValue,
    currencySymbol
  )}, ${pct}%`;

  const updateFromClientX = (clientX: number) => {
    const box = coinBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    if (rect.width <= 0) return;
    const xLocal = ((clientX - rect.left) / rect.width) * VB;
    const rawD = clamp((xLocal - CX) / FACE_R, -1, 1);
    const rawFrac = clamp(fracAtD(rawD), 0, 1);
    const pxPerUnit = rect.width / VB;
    const snapped = snapFrac(rawD, rawFrac, chargeValue, pxPerUnit);
    commitFracChange(snapped);
  };

  const onCoinPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (committing) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    handleRef.current?.focus({ preventScroll: true });
    setDragging(true);
    updateFromClientX(e.clientX);
  };
  const onCoinPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    updateFromClientX(e.clientX);
  };
  const endDrag = () => setDragging(false);

  const onHandleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (committing || chargeValue <= 0) return;
    const step = 1 / chargeValue;
    const bigStep = 10 / chargeValue;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = fracValue + (e.shiftKey ? bigStep : step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = fracValue - (e.shiftKey ? bigStep : step);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    commitFracChange(clamp(next, 0, 1));
  };

  const handleCommit = () => {
    if (committing || refundAmt <= 0 || chargeValue <= 0) return;
    setCommitting(true);
    const refunded = refundAmt;
    const remaining = remainingAmt;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finalize = () => {
      const g = cutGroupRef.current;
      g?.removeAttribute("transform");
      g?.removeAttribute("opacity");
      if (!isChargeControlled) setChargeInternal(remaining);
      if (!isFracControlled) setFracInternal(0);
      onRefundFracChange?.(0);
      onRefund?.(refunded, remaining);
      setLedgerMsg(
        `Refunded ${fmt(refunded, currencySymbol)}. ${fmt(
          remaining,
          currencySymbol
        )} remaining.`
      );
      setCommitting(false);
    };

    const g = cutGroupRef.current;
    if (reduced || !g) {
      g?.setAttribute("transform", `translate(${SHEAR_DX} 0)`);
      g?.setAttribute("opacity", "0");
      finalize();
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = clamp((now - start) / SHEAR_MS, 0, 1);
      const e = easeOutExpo(t);
      g.setAttribute("transform", `translate(${SHEAR_DX * e} 0)`);
      g.setAttribute("opacity", String(1 - e));
      if (t < 1) requestAnimationFrame(step);
      else finalize();
    };
    requestAnimationFrame(step);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (committing) return;
    const raw = Number.parseFloat(e.target.value);
    const amt = Number.isFinite(raw) ? clamp(raw, 0, chargeValue) : 0;
    commitFracChange(chargeValue > 0 ? amt / chargeValue : 0);
  };

  return (
    <div className={`w-full max-w-[280px] select-none ${className}`}>
      <div
        ref={coinBoxRef}
        data-cc-coin=""
        className="relative aspect-square w-full touch-none"
        onPointerDown={onCoinPointerDown}
        onPointerMove={onCoinPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <svg
          aria-hidden
          viewBox={`0 0 ${VB} ${VB}`}
          className="absolute inset-0 h-full w-full cursor-ew-resize"
        >
          <defs>
            <clipPath id={keptClipId}>
              <rect x={0} y={0} width={chordXpx} height={VB} />
            </clipPath>
            <clipPath id={cutClipId}>
              <rect
                x={chordXpx}
                y={0}
                width={Math.max(0, VB - chordXpx)}
                height={VB}
              />
            </clipPath>
          </defs>

          <g clipPath={`url(#${keptClipId})`}>
            <DiscFace label={fmt(chargeValue, currencySymbol)} />
          </g>
          <g ref={cutGroupRef} clipPath={`url(#${cutClipId})`}>
            <DiscFace label={fmt(chargeValue, currencySymbol)} />
          </g>

          {/* the live cut line — authoritative, always current. Drawn in
              --border (the same stroke the disc's own edge uses), not
              --ns-accent: it's the coin's physical seam, not a UI accent. */}
          <line
            x1={chordXpx}
            y1={CY - OUTER_R - 4}
            x2={chordXpx}
            y2={CY + OUTER_R + 4}
            stroke="var(--border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div
          ref={handleRef}
          role="slider"
          tabIndex={0}
          aria-label="Refund amount"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={chargeValue}
          aria-valuenow={refundAmt}
          aria-valuetext={valueText}
          onKeyDown={onHandleKeyDown}
          style={{ left: `${(chordXpx / VB) * 100}%` }}
          className="absolute top-0 h-full w-6 -translate-x-1/2 cursor-ew-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </div>

      <div className="mt-3 flex items-baseline justify-between font-mono">
        <span className="text-sm tabular-nums text-foreground">
          {`Refund ${fmt(refundAmt, currencySymbol)}`}
        </span>
        <span className="text-xs tabular-nums text-ns-muted">
          {`of ${fmt(chargeValue, currencySymbol)} · ${pct}%`}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label
          htmlFor={inputId}
          className="font-mono text-xs text-ns-muted"
        >
          Amount
        </label>
        <input
          id={inputId}
          type="number"
          inputMode="decimal"
          min={0}
          max={chargeValue}
          step={0.01}
          disabled={committing}
          value={refundAmt.toFixed(2)}
          onChange={onInputChange}
          className="w-24 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none"
        />
      </div>

      <button
        type="button"
        data-cc-commit=""
        disabled={committing || refundAmt <= 0}
        onClick={handleCommit}
        className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground transition-colors duration-150 hover:enabled:border-foreground/40 outline-none focus-visible:ring-2 focus-visible:ring-ns-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none"
      >
        {`Refund ${fmt(refundAmt, currencySymbol)}`}
      </button>

      <p
        role="status"
        aria-live="polite"
        className="mt-2 min-h-[1em] font-mono text-xs text-ns-muted"
      >
        {ledgerMsg}
      </p>
    </div>
  );
}
