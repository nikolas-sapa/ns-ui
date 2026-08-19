"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// CreepSpan — an SLO error-budget meter drawn as a taut wire spanning the
// card, which sags by irreversible creep. One governing scalar per day, the
// burn multiple `b`, drives everything: each day's PLASTIC strain increments
// by max(0, b-1) * k and never decreases (a `Math.max` accumulator, not a
// spring) — that is the permanent record of budget already spent, and it is
// the only thing that ever moves the wire's baseline down. A small ELASTIC
// offset rides on top of just the most recent point (today's live reading),
// easing toward its target on an overdamped (no-overshoot) CSS transition —
// the sole animated part, and explicitly cosmetic: it never feeds the
// strain array, so it can visually wobble without the budget math lying.
//
// The wire itself is a sequence of per-day straight segments (SVG lines),
// solid across logged history and dashed across the forward extrapolation
// at the current burn rate. A segment thickens (stroke-width, never color)
// on any day that burned above 1x — so a spike from three weeks ago stays a
// visibly heavier, permanently sagged kink, not a color that faded back.
// The dashed extrapolation's intersection with the floor rail (budget = 0)
// IS the projected exhaustion date, read straight off the same geometry.
//
// Accessibility: the SVG is decorative (aria-hidden). The one real control
// is a role="slider" date scrubber overlaid on the chart — arrow keys step
// one day, Home/End jump to the window's rails (earliest logged day /
// projected exhaustion day, or today if nothing is projected), and pointer
// hover/drag over the chart does the same by position. Its aria-valuetext
// and the visible mono readout line below the chart are both built by one
// function reading the same `full.strain` / `full.burn` array that drew the
// wire, so the number and the picture cannot disagree. A separate sr-only
// aria-live=polite region announces only actual threshold crossings (burn
// crossing 1x, budget reaching 0) — never on every scrub tick, since AT
// already gets per-tick reads through the slider's own value text.
// ---------------------------------------------------------------------------

export interface DailyBurn {
  /** ISO date, yyyy-mm-dd. */
  date: string;
  /** Burn multiple for that day. 1 = exactly on budget, 2 = twice the sustainable rate. */
  burn: number;
}

export interface CreepSpanProps {
  /** What's being metered, e.g. "checkout-api 30d error budget". */
  label?: string;
  /** Oldest -> most recent (today). At least 2 entries. */
  history: DailyBurn[];
  /** Live instantaneous burn, overriding history's last logged value. Defaults to it. */
  currentBurn?: number;
  /** Budget window described in the caption. Default 30. */
  windowDays?: number;
  /** Plastic strain scale per (burn-1)*day. Default 0.05. */
  k?: number;
  /** Cap on the forward dashed extrapolation, in days. Default 90. */
  maxProjectionDays?: number;
  className?: string;
}

const THIN = 1.5;
const THICK = 3.25;
const ELASTIC_SCALE = 6; // px of cosmetic sag per unit of burn above 1x
const ELASTIC_CAP = 11;
const SETTLE_MS = 1100;
const SETTLE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo: overdamped, never overshoots

const WIDTH = 760;
const VIEW_H = 176;
const TOP_Y = 26;
const FLOOR_Y = 150;
const PAD_X = 18;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function addDays(iso: string, n: number): Date {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(d);
}

function useReducedMotion(): boolean {
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

export function CreepSpan({
  label = "SLO error budget",
  history,
  currentBurn,
  windowDays = 30,
  k = 0.05,
  maxProjectionDays = 90,
  className = "",
}: CreepSpanProps) {
  const uid = useId().replace(/:/g, "");
  const reducedMotion = useReducedMotion();

  const historyCount = history.length;
  const lastIdx = historyCount - 1;
  const liveBurn = currentBurn ?? history[lastIdx]?.burn ?? 1;

  // The one place strain is computed. Monotonic accumulator — a running
  // Math.max-style sum, never a decrement — so "spent" can only grow.
  const { strain, burns, dates } = useMemo(() => {
    const strainArr: number[] = [];
    const burnArr: number[] = [];
    const dateArr: Date[] = [];
    let acc = 0;
    for (let i = 0; i < historyCount; i++) {
      const b = i === lastIdx ? liveBurn : history[i].burn;
      acc += Math.max(0, b - 1) * k;
      strainArr.push(acc);
      burnArr.push(b);
      dateArr.push(new Date(`${history[i].date}T00:00:00`));
    }
    return { strain: strainArr, burns: burnArr, dates: dateArr };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, historyCount, lastIdx, liveBurn, k]);

  const lastStrain = strain[lastIdx] ?? 0;
  const remainingFrac = clamp(1 - lastStrain, 0, 1);
  const excessPerDay = Math.max(0, liveBurn - 1) * k;

  const projection = useMemo(() => {
    if (excessPerDay <= 0 || remainingFrac <= 0 || historyCount === 0) return null;
    const rawDays = remainingFrac / excessPerDay;
    if (rawDays > maxProjectionDays) return null;
    const days = Math.max(1, Math.ceil(rawDays));
    return { days, exhaustDate: addDays(history[lastIdx].date, days) };
  }, [excessPerDay, remainingFrac, maxProjectionDays, history, lastIdx, historyCount]);

  // Full domain = logged history + (if projected) the dashed extrapolation,
  // one shared array set. Everything the wire draws and everything the
  // scrubber reads comes out of this same object — that's the falsifiable
  // guarantee: the number and the picture cannot disagree.
  const full = useMemo(() => {
    const fStrain = [...strain];
    const fBurn = [...burns];
    const fDates = [...dates];
    if (projection) {
      for (let j = 1; j <= projection.days; j++) {
        fStrain.push(clamp(lastStrain + excessPerDay * j, 0, 1));
        fBurn.push(liveBurn);
        fDates.push(addDays(history[lastIdx].date, j));
      }
    }
    return { strain: fStrain, burn: fBurn, dates: fDates };
  }, [strain, burns, dates, projection, lastStrain, excessPerDay, liveBurn, history, lastIdx]);

  const totalCount = full.strain.length;

  const xFor = useCallback(
    (i: number) => PAD_X + (i / Math.max(1, totalCount - 1)) * (WIDTH - PAD_X * 2),
    [totalCount]
  );
  const yForStrain = useCallback((s: number) => TOP_Y + (FLOOR_Y - TOP_Y) * clamp(s, 0, 1), []);

  // Cosmetic elastic sag on today's point only. Eases toward its target on
  // an overdamped CSS transition; skipped entirely under reduced motion, per
  // the reduced-motion contract: the wire renders at its true position with
  // no settle.
  const elasticTarget = clamp(Math.max(0, liveBurn - 1) * ELASTIC_SCALE, 0, ELASTIC_CAP);
  const [elasticPx, setElasticPx] = useState(reducedMotion ? elasticTarget : 0);
  useEffect(() => {
    if (reducedMotion) {
      setElasticPx(elasticTarget);
      return;
    }
    const id = requestAnimationFrame(() => setElasticPx(elasticTarget));
    return () => cancelAnimationFrame(id);
  }, [elasticTarget, reducedMotion]);

  // Threshold-crossing announcements only — never a per-tick live region.
  const [announcement, setAnnouncement] = useState("");
  const burnAboveOneRef = useRef(liveBurn > 1);
  const exhaustedRef = useRef(remainingFrac <= 0);
  useEffect(() => {
    const nowAbove = liveBurn > 1;
    if (nowAbove !== burnAboveOneRef.current) {
      burnAboveOneRef.current = nowAbove;
      setAnnouncement(
        nowAbove
          ? `Burning above budget, ${liveBurn.toFixed(1)}x`
          : `Burn back at or under budget, ${liveBurn.toFixed(1)}x`
      );
    }
  }, [liveBurn]);
  useEffect(() => {
    const nowExhausted = remainingFrac <= 0;
    if (nowExhausted !== exhaustedRef.current) {
      exhaustedRef.current = nowExhausted;
      if (nowExhausted) setAnnouncement("Error budget exhausted");
    }
  }, [remainingFrac]);

  // Date scrubber — the one accessible control.
  const [selIndex, setSelIndex] = useState(lastIdx);
  useEffect(() => {
    setSelIndex((i) => clamp(i, 0, totalCount - 1));
  }, [totalCount]);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const composeReadout = useCallback(
    (i: number) => {
      const idx = clamp(i, 0, totalCount - 1);
      const d = full.dates[idx];
      const remaining = Math.round(clamp(1 - full.strain[idx], 0, 1) * 100);
      const b = full.burn[idx];
      const projectedTag = idx > lastIdx ? " (projected)" : "";
      const exhaustText = projection
        ? `exhaustion projected ${fmtDate(projection.exhaustDate)}`
        : "no exhaustion projected at current burn";
      return `${fmtDate(d)}${projectedTag} — ${remaining}% budget remaining, burning at ${b.toFixed(1)}x, ${exhaustText}`;
    },
    [full, totalCount, lastIdx, projection]
  );

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return selIndex;
      const frac = clamp((clientX - rect.left) / rect.width, 0, 1);
      return Math.round(frac * (totalCount - 1));
    },
    [selIndex, totalCount]
  );

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    setSelIndex(indexFromClientX(e.clientX));
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setSelIndex(indexFromClientX(e.clientX));
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    let next = selIndex;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = selIndex - 1;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = selIndex + 1;
        break;
      case "PageDown":
        next = selIndex - 7;
        break;
      case "PageUp":
        next = selIndex + 7;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = totalCount - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    setSelIndex(clamp(next, 0, totalCount - 1));
  };

  // ---- geometry: solid historical segments, one per day -----------------
  const historyY = dates.map((_, i) => yForStrain(strain[i]));
  const renderY = (i: number) => (i === lastIdx ? historyY[i] + elasticPx : historyY[i]);

  const segments: { x1: number; y1: number; x2: number; y2: number; thick: boolean; animate: boolean }[] = [];
  for (let i = 1; i < historyCount; i++) {
    const isLast = i === lastIdx;
    segments.push({
      x1: xFor(i - 1),
      y1: historyY[i - 1],
      x2: xFor(i),
      y2: renderY(i),
      thick: burns[i] > 1,
      animate: isLast,
    });
  }

  const dashSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = historyCount; i < totalCount; i++) {
    const prevY = i === historyCount ? historyY[lastIdx] + elasticPx : yForStrain(full.strain[i - 1]);
    dashSegments.push({
      x1: xFor(i - 1),
      y1: prevY,
      x2: xFor(i),
      y2: yForStrain(full.strain[i]),
    });
  }

  const exhaustX = projection ? xFor(totalCount - 1) : null;

  const remainingPct = Math.round(remainingFrac * 100);
  const headerExhaust = projection ? fmtDate(projection.exhaustDate) : "not projected";
  const readout = composeReadout(selIndex);

  const gradId = `ns-creep-thumb-${uid}`;

  return (
    <div className={`relative w-full ${className}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[11px] tracking-widest text-ns-muted">{label}</span>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs">
          <span className="text-foreground">
            REMAINING <b className="tabular-nums">{remainingPct}%</b>
          </span>
          <span className="text-foreground">
            BURN <b className="tabular-nums">{liveBurn.toFixed(1)}x</b>
          </span>
          <span className="text-foreground">
            EXHAUST <b className="tabular-nums">{headerExhaust}</b>
          </span>
        </div>
      </div>

      <div className="relative h-40 w-full rounded-[12px] border border-border">
        <span
          className="pointer-events-none absolute left-2 -translate-y-1/2 font-mono text-[10px] text-ns-muted"
          style={{ top: `${(TOP_Y / VIEW_H) * 100}%` }}
        >
          100%
        </span>
        <span
          className="pointer-events-none absolute left-2 -translate-y-1/2 font-mono text-[10px] text-ns-muted"
          style={{ top: `${(FLOOR_Y / VIEW_H) * 100}%` }}
        >
          0%
        </span>

        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={`0 0 ${WIDTH} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <line
            x1={PAD_X}
            y1={FLOOR_Y}
            x2={WIDTH - PAD_X}
            y2={FLOOR_Y}
            stroke="var(--border)"
            strokeWidth={1}
          />

          {segments.map((s, i) =>
            // Every segment but the last is a permanently settled record —
            // a plain, untransitioned <line>. Only the very last one has a
            // moving endpoint (the cosmetic elastic offset on today), and
            // SVG <line> geometry (x1/y1/x2/y2) is not CSS-transitionable
            // in any shipping browser — <path d="..."> IS (proven elsewhere
            // in this registry), so only that one segment is a <path>.
            s.animate && !reducedMotion ? (
              <path
                key={`seg-${i}`}
                d={`M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={s.thick ? THICK : THIN}
                strokeLinecap="round"
                style={{ transition: `d ${SETTLE_MS}ms ${SETTLE_EASE}` }}
              />
            ) : (
              <line
                key={`seg-${i}`}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke="var(--foreground)"
                strokeWidth={s.thick ? THICK : THIN}
                strokeLinecap="round"
              />
            )
          )}

          {dashSegments.map((s, i) =>
            i === 0 && !reducedMotion ? (
              <path
                key={`dash-${i}`}
                d={`M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`}
                fill="none"
                stroke="var(--ns-muted)"
                strokeWidth={excessPerDay > 0 ? THICK : THIN}
                strokeDasharray="5 4"
                style={{ transition: `d ${SETTLE_MS}ms ${SETTLE_EASE}` }}
              />
            ) : (
              <line
                key={`dash-${i}`}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke="var(--ns-muted)"
                strokeWidth={excessPerDay > 0 ? THICK : THIN}
                strokeDasharray="5 4"
              />
            )
          )}

          {exhaustX !== null ? (
            <circle cx={exhaustX} cy={FLOOR_Y} r={3} fill="var(--foreground)" />
          ) : null}
        </svg>

        {/* scrubber thumb — position only, never accent-colored: accent is
            reserved for the focus ring below. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-foreground/40"
          style={{ left: `${(selIndex / Math.max(1, totalCount - 1)) * 100}%` }}
        />

        <div
          ref={overlayRef}
          data-creep-scrubber=""
          role="slider"
          tabIndex={0}
          aria-label={`${label} date scrubber`}
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={totalCount - 1}
          aria-valuenow={selIndex}
          aria-valuetext={readout}
          className="absolute inset-0 cursor-crosshair touch-none select-none rounded-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
        />
      </div>

      <p className="mt-2 font-mono text-[11px] leading-relaxed text-ns-muted" id={`${gradId}-readout`}>
        {readout}
      </p>
      <p className="mt-1 font-mono text-[10px] text-ns-muted">
        {windowDays}-day budget window · thick segments burned above 1x · dashed = projection at current burn
      </p>

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
