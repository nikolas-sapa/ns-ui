"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RemnantCut — a plan-change proration panel drawn as a draper cutting cloth.
// The current billing period is a horizontal bolt: a woven-hatch SVG strip,
// selvage rules at both ends, cut at today's date. ONE governing scalar,
// `cutFrac = elapsedDays / periodDays`, drives everything on the old strip —
// the shear x-position, the dimmed "offcut" (used) width, the bright
// "remnant" (unused) width, and `creditRaw = (1 - cutFrac) * oldPrice` — the
// same expression that sizes the remnant rect also prints as the credit,
// never a second computation. A strip's bar HEIGHT maps to its plan's daily
// rate, so rect area (width-in-days * height-in-rate) literally IS money;
// that identity is the same on every row, so it survives the reflow.
//
// Choosing a candidate plan re-measures that credit against the new plan's
// daily rate: creditedDays = creditedAmount / newDailyRate, and the remnant
// animates from its old-strip position/size to that new width and the new
// plan's own bar height, across one 600ms ease-out-expo progress value `t`.
// Both endpoints already satisfy width*height === creditedAmount * K (K =
// px-per-day * px-per-rate, one constant shared by both rows), so deriving
// width(t) by lerp and height(t) = creditedAmount*K / width(t) keeps the
// rectangle's area exactly constant on every intermediate frame too — area
// preservation isn't checked after the fact, it's structurally impossible
// for the rect to have any other area at any t.
//
// Whatever the raw credit loses to the provider's rounding unit (floored to
// the nearest cent by default) is never silently absorbed: it renders as its
// own thin labelled sliver — the kerf — sitting right at the cut, between
// the offcut and the remnant. offcut + kerf + remnant always reconstruct the
// full old strip exactly; credit + charge, rounded to the cent a bill shows,
// never quite sum back to the strip's full price, and the kerf sliver is
// where the missing fraction visibly lives instead of vanishing.
//
// The cut itself is a fixed hash-seeded (mulberry32) 2px polyline, same seed
// every render regardless of props — a perfectly straight line reads as a
// CSS border, a wavered one reads as a blade having actually passed through.
//
// A11Y: the cloth (both SVG strips) is aria-hidden — decoration only, never
// the source of truth. The real controls are native <input type=radio> per
// candidate plan (grouped in a <fieldset>/<legend>, so the group's
// accessible name and per-option checked-state announcements come free from
// the browser) and a real <button> whose visible text states the derived
// numbers outright ("$8.41 credit, 6.5 days applied, ..."). A single
// role=status/aria-live=polite paragraph carries the same sentence and is
// always on screen (not sr-only), so sighted and assistive-tech readers see
// the identical figures at the identical moment. Nothing on the cloth is
// interactive; Tab only ever reaches the radios and the button.
//
// Distinct from wizard-canal-lock on purpose: that component stages a
// multi-step commitment through sequential gates and conserves nothing
// numeric — advancing a lock chamber doesn't compute or carry a quantity.
// RemnantCut is a single-step proration readout where a strict conservation
// law (area = money, unused days = used days' complement) is the entire
// mechanism; there is no sequence of steps, no validation gate, and the
// "physical" motion exists only to make one arithmetic identity legible.
//
// Pure DOM + SVG + CSS, no canvas. Every stroke/fill token is one of
// --background/--foreground/--ns-muted/--border/--ns-accent; --ns-accent is
// used only for the keyboard focus ring. prefers-reduced-motion skips the
// rAF tween entirely and renders the remnant at its final reflowed position,
// size and figures instantly.
// ---------------------------------------------------------------------------

export interface RemnantCutPlan {
  /** stable identifier, used as the native radio's value */
  id: string;
  /** display name, e.g. "Team" */
  name: string;
  /** full-period price in dollars, e.g. a monthly price */
  price: number;
  /** length of one billing period for this plan, in days */
  periodDays: number;
}

export interface RemnantCutSummary {
  planId: string;
  creditRaw: number;
  creditedAmount: number;
  kerf: number;
  creditedDays: number;
  newPeriodStart: string;
}

export interface RemnantCutProps {
  /** the plan currently being paid for */
  currentPlan: RemnantCutPlan;
  /** candidate plans offered as the radio choices */
  plans: RemnantCutPlan[];
  /** days elapsed in the current billing period as of today */
  elapsedDays: number;
  /** ISO date string for "today" — only used to print the new period's start date. @default now */
  today?: string;
  /** the provider's credit-rounding unit in dollars, e.g. 0.01 for whole cents. @default 0.01 */
  roundingUnit?: number;
  /** controlled selected candidate-plan id */
  value?: string;
  /** initial selected candidate-plan id when uncontrolled */
  defaultValue?: string;
  /** called with the newly selected candidate-plan id */
  onValueChange?: (id: string) => void;
  /** called with the derived confirmation figures when Confirm is pressed */
  onConfirm?: (summary: RemnantCutSummary) => void;
  /** fieldset legend text. @default "Change to" */
  label?: string;
  /** shared name for the native radios. @default a generated id */
  name?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// -- geometry ----------------------------------------------------------------

const PAD = 14;
const BAR_MAX = 46;
const OLD_BASELINE = 56;
const NEW_BASELINE = 172;
const VH = 192;
const CUT_SEED = 733; // fixed — never derived from props, so the waver never re-randomizes on data change

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fmtMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtKerf(n: number) {
  // the kerf is deliberately the sub-cent remainder — shown at 4dp so the
  // "odd cents" a 2dp bill can't represent still have a printed home.
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(4)}`;
}

function fmtDays(n: number) {
  return `${n.toFixed(1)} days`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** mulberry32 — small, fast, deterministic given a seed */
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a fixed, constant-across-renders jittered polyline for the cut blade */
function cutWaver(topY: number, bottomY: number, cx: number) {
  const rng = mulberry32(CUT_SEED);
  const steps = 7;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const y = topY + ((bottomY - topY) * i) / steps;
    const jitter = (rng() - 0.5) * 2; // +-1px
    pts.push(`${(cx + jitter).toFixed(2)},${y.toFixed(2)}`);
  }
  return pts.join(" ");
}

function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function RemnantCut({
  currentPlan,
  plans,
  elapsedDays,
  today,
  roundingUnit = 0.01,
  value,
  defaultValue,
  onValueChange,
  onConfirm,
  label = "Change to",
  name,
  className = "",
}: RemnantCutProps) {
  const uid = useId();
  const reduced = useReducedMotion();
  const groupName = name ?? uid;
  const hatchId = `${uid}-hatch`;

  const [uncontrolled, setUncontrolled] = useState<string | undefined>(defaultValue);
  const selectedId = value !== undefined ? value : uncontrolled;
  const setSelectedId = (id: string) => {
    if (value === undefined) setUncontrolled(id);
    onValueChange?.(id);
  };

  const todayIso = today ?? new Date().toISOString();
  const selectedPlan = plans.find((p) => p.id === selectedId) ?? null;

  // -- geometry scales, derived from every plan in play so any prop set stays legible --
  const { pxPerDay, pxPerRate } = useMemo(() => {
    const maxDays = Math.max(currentPlan.periodDays, ...plans.map((p) => p.periodDays), 1);
    const maxRate = Math.max(
      currentPlan.price / currentPlan.periodDays,
      ...plans.map((p) => p.price / Math.max(1, p.periodDays)),
      1e-6
    );
    return {
      pxPerDay: clamp(400 / maxDays, 4, 22),
      pxPerRate: clamp(BAR_MAX / maxRate, 0.5, 400),
    };
  }, [currentPlan, plans]);

  const K = pxPerDay * pxPerRate; // px^2 per dollar — the one constant that makes area = money everywhere
  const amountToWidth = (amount: number, dailyRate: number) =>
    dailyRate > 0 ? (amount / dailyRate) * pxPerDay : 0;
  const rateToHeight = (rate: number) => rate * pxPerRate;

  const maxDays = Math.max(currentPlan.periodDays, ...plans.map((p) => p.periodDays), 1);
  const VW = PAD * 2 + maxDays * pxPerDay;

  // -- old strip: the single governing scalar and everything it drives --
  const oldDailyRate = currentPlan.price / currentPlan.periodDays;
  const oldBarH = rateToHeight(oldDailyRate);
  const oldStripW = currentPlan.periodDays * pxPerDay;
  const cutFrac = clamp(elapsedDays / currentPlan.periodDays, 0, 1);
  const cutX = PAD + cutFrac * oldStripW;
  const offcutW = cutX - PAD;
  const remnantW0 = oldStripW - offcutW; // pre-move remnant width, at oldBarH height
  const creditRaw = (1 - cutFrac) * currentPlan.price; // prints from the SAME cutFrac that sized remnantW0 above
  const unit = Math.max(0.0001, roundingUnit);
  const creditedAmount = Math.floor(creditRaw / unit + 1e-9) * unit;
  const kerf = Math.max(0, creditRaw - creditedAmount);
  const kerfWRaw = amountToWidth(kerf, oldDailyRate);
  const kerfW = kerf > 0 ? Math.max(kerfWRaw, 1.5) : 0;
  const remnantVisibleW = Math.max(0, remnantW0 - kerfWRaw);
  const remainingDays = (1 - cutFrac) * currentPlan.periodDays;

  const start: Rect = {
    x: cutX + kerfWRaw,
    y: OLD_BASELINE - oldBarH,
    w: remnantVisibleW,
    h: oldBarH,
  };

  // -- new strip target, once a candidate plan is selected --
  const newDailyRate = selectedPlan ? selectedPlan.price / Math.max(1, selectedPlan.periodDays) : 0;
  const newBarH = selectedPlan ? rateToHeight(newDailyRate) : 0;
  const newStripW = selectedPlan ? selectedPlan.periodDays * pxPerDay : 0;
  const creditedDays = newDailyRate > 0 ? creditedAmount / newDailyRate : 0;
  const remnantWEnd = selectedPlan ? amountToWidth(creditedAmount, newDailyRate) : 0;
  const end: Rect = { x: PAD, y: NEW_BASELINE - newBarH, w: remnantWEnd, h: newBarH };
  const newPeriodStart = todayIso;
  const newPeriodStartLabel = fmtDate(newPeriodStart);

  // -- one 600ms ease-out-expo progress value; width lerps, height is DERIVED
  // (creditedAmount*K / width) so area is exactly conserved at every frame,
  // not just at the two ends. --
  const [anim, setAnim] = useState<Rect | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(start);
  startRef.current = start;

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (!selectedPlan) {
      setAnim(null);
      return;
    }
    const from = startRef.current;
    const to = end;
    const creditPx = creditedAmount * K;
    if (reduced || creditPx <= 0) {
      setAnim(to);
      return;
    }
    const duration = 600;
    const t0 = performance.now();
    const tick = (now: number) => {
      const raw = clamp((now - t0) / duration, 0, 1);
      const eased = easeOutExpo(raw);
      const w = from.w + (to.w - from.w) * eased;
      const h = w > 0 ? creditPx / w : to.h;
      const baseline = OLD_BASELINE + (NEW_BASELINE - OLD_BASELINE) * eased;
      const x = from.x + (to.x - from.x) * eased;
      const y = baseline - h;
      setAnim({ x, y, w, h });
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, reduced, creditedAmount, K]);

  const cutWaverPoints = useMemo(
    () => cutWaver(OLD_BASELINE - BAR_MAX - 4, OLD_BASELINE + 6, cutX),
    [cutX]
  );

  function ticks(x0: number, days: number, baseline: number) {
    const step = pxPerDay >= 9 ? 1 : 5;
    const marks: { x: number }[] = [];
    for (let d = 0; d <= days; d += step) {
      marks.push({ x: x0 + d * pxPerDay });
    }
    return marks.map((m, i) => (
      <line
        key={i}
        x1={m.x}
        x2={m.x}
        y1={baseline + 2}
        y2={baseline + 6}
        className="stroke-current text-border"
        strokeWidth={1}
      />
    ));
  }

  function selvage(xEdge: number, baseline: number, barH: number) {
    const top = baseline - barH - 6;
    const bottom = baseline + 8;
    return [0, 3, 6].map((dx) => (
      <line
        key={dx}
        x1={xEdge + dx}
        x2={xEdge + dx}
        y1={top}
        y2={bottom}
        className="stroke-current text-border"
        strokeWidth={dx === 0 ? 1.5 : 1}
        opacity={dx === 0 ? 0.9 : 0.5}
      />
    ));
  }

  const summaryText = selectedPlan
    ? `${fmtMoney(creditRaw)} raw credit for ${fmtDays(remainingDays)} unused, rounded to ${fmtMoney(
        creditedAmount
      )} (${fmtKerf(kerf)} lost to rounding). Re-measured against ${selectedPlan.name}'s ${fmtMoney(
        newDailyRate
      )}/day rate: ${fmtDays(creditedDays)} applied. New period starts ${newPeriodStartLabel}.`
    : `${fmtMoney(creditRaw)} raw credit for ${fmtDays(remainingDays)} unused, rounded to ${fmtMoney(
        creditedAmount
      )} (${fmtKerf(kerf)} lost to rounding). Choose a plan below to apply it.`;

  const confirmText = selectedPlan
    ? `Confirm: ${fmtMoney(creditedAmount)} credit, ${fmtDays(creditedDays)} applied, ${fmtKerf(
        kerf
      )} rounding, new period starts ${newPeriodStartLabel}`
    : "Select a plan to continue";

  function handleConfirm() {
    if (!selectedPlan) return;
    onConfirm?.({
      planId: selectedPlan.id,
      creditRaw,
      creditedAmount,
      kerf,
      creditedDays,
      newPeriodStart,
    });
  }

  // fall back to the pre-tween start rect on the very first paint after a
  // selection (before the first rAF frame lands), so the piece is never
  // absent for a frame — it's always somewhere, just not yet where it's going.
  const displayRect = anim ?? (selectedPlan ? start : null);
  const showStaticRemnant = !selectedPlan;

  return (
    <div className={`w-full ${className}`}>
      <style>{`
        .ns-remnant-input {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .ns-remnant-input:focus-visible + .ns-remnant-visual {
          outline: 2px solid var(--ns-accent);
          outline-offset: 2px;
        }
        .ns-remnant-row {
          transition: background-color 150ms ease;
        }
        .ns-remnant-row:hover {
          background-color: color-mix(in oklab, var(--foreground) 4%, transparent);
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-remnant-row {
            transition: none;
          }
        }
      `}</style>

      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-ns-muted">Current plan</p>
          <p className="text-sm font-semibold text-foreground">
            {currentPlan.name} &middot; {fmtMoney(currentPlan.price)}/period
          </p>
        </div>
        <p className="font-mono text-[11px] text-ns-muted">
          {elapsedDays} of {currentPlan.periodDays} days used
        </p>
      </div>

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="mt-3 w-full"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <pattern id={hatchId} width={6} height={6} patternUnits="userSpaceOnUse">
            <line x1={0} y1={0} x2={6} y2={6} className="stroke-current text-border" strokeWidth={0.6} opacity={0.5} />
            <line x1={6} y1={0} x2={0} y2={6} className="stroke-current text-border" strokeWidth={0.6} opacity={0.5} />
          </pattern>
        </defs>

        {/* OLD STRIP */}
        <g>
          {selvage(PAD, OLD_BASELINE, oldBarH)}
          {selvage(PAD + oldStripW, OLD_BASELINE, oldBarH)}
          <rect
            x={PAD}
            y={OLD_BASELINE - oldBarH}
            width={oldStripW}
            height={oldBarH}
            fill={`url(#${hatchId})`}
          />
          <rect
            x={PAD}
            y={OLD_BASELINE - oldBarH}
            width={offcutW}
            height={oldBarH}
            className="fill-current text-ns-muted"
            opacity={0.22}
          />
          {kerfW > 0 && (
            <rect
              x={cutX}
              y={OLD_BASELINE - oldBarH}
              width={kerfW}
              height={oldBarH}
              className="fill-current text-foreground"
              opacity={0.35}
            />
          )}
          {showStaticRemnant && remnantVisibleW > 0 && (
            <rect
              x={cutX + kerfWRaw}
              y={OLD_BASELINE - oldBarH}
              width={remnantVisibleW}
              height={oldBarH}
              className="fill-current text-foreground"
              opacity={0.6}
            />
          )}
          <polyline
            points={cutWaverPoints}
            className="stroke-current text-foreground"
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
          />
          {ticks(PAD, currentPlan.periodDays, OLD_BASELINE)}
          {kerfW > 0 && (
            <text
              x={cutX + kerfW / 2}
              y={OLD_BASELINE - oldBarH - 8}
              textAnchor="middle"
              className="fill-current text-ns-muted"
              fontSize={7}
              fontFamily="var(--font-mono, monospace)"
            >
              kerf
            </text>
          )}
        </g>

        {/* NEW STRIP */}
        <g>
          {selectedPlan ? (
            <>
              {selvage(PAD, NEW_BASELINE, newBarH)}
              {selvage(PAD + newStripW, NEW_BASELINE, newBarH)}
              <rect
                x={PAD}
                y={NEW_BASELINE - newBarH}
                width={newStripW}
                height={newBarH}
                fill={`url(#${hatchId})`}
              />
              <rect
                x={PAD}
                y={NEW_BASELINE - newBarH}
                width={newStripW}
                height={newBarH}
                fill="none"
                className="stroke-current text-border"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              {displayRect && (
                <rect
                  data-remnant-piece
                  x={displayRect.x}
                  y={Math.min(displayRect.y, NEW_BASELINE)}
                  width={displayRect.w}
                  height={displayRect.h}
                  className="fill-current text-foreground"
                  opacity={0.68}
                />
              )}
              {ticks(PAD, selectedPlan.periodDays, NEW_BASELINE)}
            </>
          ) : (
            <rect
              x={PAD}
              y={NEW_BASELINE - 22}
              width={180}
              height={22}
              fill="none"
              className="stroke-current text-border"
              strokeWidth={1}
              strokeDasharray="4 3"
              rx={3}
            />
          )}
        </g>
      </svg>

      <fieldset className="mt-4 border-0 p-0">
        <legend className="font-mono text-[11px] uppercase tracking-wide text-ns-muted">{label}</legend>
        <div className="mt-2 flex flex-col gap-1.5">
          {plans.map((p) => {
            const rate = p.price / Math.max(1, p.periodDays);
            const checked = selectedId === p.id;
            return (
              <label
                key={p.id}
                className="ns-remnant-row relative flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5"
              >
                <input
                  type="radio"
                  className="ns-remnant-input"
                  name={groupName}
                  value={p.id}
                  checked={checked}
                  onChange={() => setSelectedId(p.id)}
                />
                <span
                  aria-hidden="true"
                  className="ns-remnant-visual flex h-4 w-4 flex-none items-center justify-center rounded-full border border-border"
                >
                  {checked && <span className="h-2 w-2 rounded-full bg-foreground" />}
                </span>
                <span className="flex flex-1 items-baseline justify-between gap-3 text-sm">
                  <span className={checked ? "font-medium text-foreground" : "text-ns-muted"}>{p.name}</span>
                  <span className="font-mono text-[11px] text-ns-muted">
                    {fmtMoney(p.price)}/period &middot; {fmtMoney(rate)}/day
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <p
        data-remnant-figures
        role="status"
        aria-live="polite"
        className="mt-3 font-mono text-[11px] leading-relaxed text-ns-muted"
      >
        {summaryText}
      </p>

      <button
        type="button"
        data-remnant-confirm
        disabled={!selectedPlan}
        onClick={handleConfirm}
        className="mt-3 w-full rounded-md border border-border px-3 py-2 text-left font-mono text-[11px] text-foreground transition-colors duration-150 enabled:hover:border-foreground/30 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        {confirmText}
      </button>
    </div>
  );
}
