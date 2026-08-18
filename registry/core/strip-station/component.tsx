"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// StripStation — a turn-by-turn directions panel drawn as a straight-line
// diagram (a DOT "SLD"): the route is unbent into one vertical strip where
// vertical space between maneuvers is proportional to real ground distance,
// not to row count or elapsed time. A 200m hop and a 40km motorway leg get
// visibly different heights instead of identical row heights.
//
// Geometry contract: row pitch = max(44px, distanceM * scalePxPerM). When
// the true proportional pitch would fall under the 44px floor, the strip
// does NOT silently clamp — it flags the row with the standard equation-
// station break glyph (a zigzag) and the chainage ticks skip a number,
// so the compression is visible rather than a quiet lie about distance.
// ---------------------------------------------------------------------------

export type StripStationManeuver = {
  /** stable id */
  id: string;
  /** e.g. "Turn left onto Mill Rd" */
  instruction: string;
  /** optional secondary road label appended after the instruction */
  road?: string;
  /** length, in meters, of the leg that STARTS at this maneuver (0 for arrival) */
  distanceM: number;
  /** signed exit angle in degrees: 0 = straight ahead, negative = left, positive = right, ±180 = U-turn */
  turnAngleDeg: number;
  /** absolute compass bearing (0-360) of the leg that follows this maneuver */
  headingDeg: number;
};

export interface StripStationProps {
  /** the route, depart-to-arrive, oldest first */
  steps: StripStationManeuver[];
  /** route progress in meters from the start; drives the marker + auto-follow scroll */
  positionM?: number;
  /** pixels per meter of ground distance before the 44px floor applies */
  scalePxPerM?: number;
  /** accessible label for the directions region */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const ROW_H = 44; // also the falsifiable minimum pitch, in px
const GLYPH = 28;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function formatDistance(m: number) {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
  return `${Math.round(Math.max(0, m))} m`;
}

// DOT-style chainage: whole hundreds "+" remainder, e.g. 150m -> "1+50"
function formatChainage(m: number) {
  const safe = Math.max(0, m);
  let whole = Math.floor(safe / 100);
  let rem = Math.round(safe % 100);
  if (rem === 100) {
    rem = 0;
    whole += 1;
  }
  return `${whole}+${String(rem).padStart(2, "0")}`;
}

// smallest step (in meters) on a 1-2-5 ladder whose pixel pitch lands in a
// legible band, so the tick density adapts to the chosen scale instead of
// being hardcoded.
function niceStepMeters(scale: number) {
  if (scale <= 0) return 100;
  const [lo, hi] = [24, 56];
  let mag = 1;
  for (let guard = 0; guard < 60; guard++) {
    for (const base of [1, 2, 5]) {
      const step = base * mag;
      const px = step * scale;
      if (px >= lo && px <= hi) return step;
    }
    const midPx = 2 * mag * scale;
    if (midPx < lo) mag *= 10;
    else mag /= 10;
  }
  return 100;
}

function ticksInRange(fromM: number, toM: number, step: number) {
  if (step <= 0) return [] as number[];
  const start = Math.ceil((fromM + 1e-6) / step) * step;
  const out: number[] = [];
  for (let m = start; m < toM - 1e-6; m += step) out.push(m);
  return out;
}

type Rows = {
  cumD: number[]; // meters at each maneuver, index-aligned to steps
  y: number[]; // px at top of each row, index-aligned to steps
  broke: boolean[]; // true when the segment INTO row i was floored
  totalY: number;
  totalD: number;
};

function buildRows(steps: StripStationManeuver[], scale: number): Rows {
  const n = steps.length;
  const cumD = new Array<number>(n).fill(0);
  const y = new Array<number>(n).fill(0);
  const broke = new Array<boolean>(n).fill(false);
  for (let i = 1; i < n; i++) {
    const legM = Math.max(0, steps[i - 1]?.distanceM ?? 0);
    cumD[i] = (cumD[i - 1] ?? 0) + legM;
    const natural = legM * scale;
    broke[i] = natural < ROW_H - 0.01;
    const pitch = Math.max(ROW_H, natural);
    y[i] = (y[i - 1] ?? 0) + pitch;
  }
  return {
    cumD,
    y,
    broke,
    totalY: y[n - 1] ?? 0,
    totalD: cumD[n - 1] ?? 0,
  };
}

function yForPosition(pm: number, rows: Rows) {
  const { cumD, y } = rows;
  const n = cumD.length;
  if (n === 0) return 0;
  if (pm <= (cumD[0] ?? 0)) return y[0] ?? 0;
  for (let i = 0; i < n - 1; i++) {
    const next = cumD[i + 1] ?? 0;
    if (pm < next) {
      const start = cumD[i] ?? 0;
      const span = next - start;
      const t = span > 0 ? (pm - start) / span : 0;
      return (y[i] ?? 0) + t * ((y[i + 1] ?? 0) - (y[i] ?? 0));
    }
  }
  return y[n - 1] ?? 0;
}

// index of the leg the driver is currently ON (0..n-2), clamped
function currentLegIndex(pm: number, cumD: number[]) {
  const n = cumD.length;
  if (n < 2) return 0;
  for (let i = 0; i < n - 1; i++) {
    if (pm < (cumD[i + 1] ?? 0)) return i;
  }
  return n - 2;
}

function TurnGlyph({
  angleDeg,
  kind,
}: {
  angleDeg: number;
  kind: "start" | "mid" | "end";
}) {
  const c = GLYPH / 2;
  const arm = c - 5;

  if (kind === "start") {
    return (
      <svg width={GLYPH} height={GLYPH} viewBox={`0 0 ${GLYPH} ${GLYPH}`}>
        <circle cx={c} cy={c} r={3} fill="currentColor" />
        <line
          x1={c}
          y1={c + 3}
          x2={c}
          y2={c + arm}
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "end") {
    return (
      <svg width={GLYPH} height={GLYPH} viewBox={`0 0 ${GLYPH} ${GLYPH}`}>
        <line
          x1={c}
          y1={c - arm}
          x2={c}
          y2={c}
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
        />
        <rect
          x={c - 3}
          y={c - 3}
          width={6}
          height={6}
          fill="currentColor"
          transform={`rotate(45 ${c} ${c})`}
        />
      </svg>
    );
  }

  // mid: one polyline, entry -> vertex -> exit-at-true-angle -> arrowhead.
  // exit angle is the ACTUAL turnAngleDeg, not a snapped category — a 15°
  // fork and an 80° hard left are literally different drawings.
  const rad = (angleDeg * Math.PI) / 180;
  const ex = c + Math.sin(rad) * arm;
  const ey = c + Math.cos(rad) * arm;
  const headLen = 4.2;
  const a1 = rad + Math.PI - 0.55;
  const a2 = rad + Math.PI + 0.55;
  const h1x = ex + Math.sin(a1) * headLen;
  const h1y = ey + Math.cos(a1) * headLen;
  const h2x = ex + Math.sin(a2) * headLen;
  const h2y = ey + Math.cos(a2) * headLen;
  const points = [
    `${c},${c - arm}`,
    `${c},${c}`,
    `${ex.toFixed(2)},${ey.toFixed(2)}`,
    `${h1x.toFixed(2)},${h1y.toFixed(2)}`,
    `${ex.toFixed(2)},${ey.toFixed(2)}`,
    `${h2x.toFixed(2)},${h2y.toFixed(2)}`,
  ].join(" ");

  return (
    <svg width={GLYPH} height={GLYPH} viewBox={`0 0 ${GLYPH} ${GLYPH}`}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BreakZigzag() {
  // the standard equation-station break symbol: renders in place of a
  // connector when true spacing fell below the 44px floor, so the
  // compression reads as a deliberate mark, not a silent clamp.
  return (
    <svg
      width={20}
      height={9}
      viewBox="0 0 20 9"
      className="text-ns-muted"
    >
      <polyline
        points="0,4.5 4,0.5 8,8.5 12,0.5 16,8.5 20,4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
      />
    </svg>
  );
}

export function StripStation({
  steps,
  positionM = 0,
  scalePxPerM = 0.09,
  label = "Turn-by-turn directions",
  className = "h-[560px] w-full",
}: StripStationProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const roseRef = useRef<SVGGElement>(null);
  const headingChipRef = useRef<HTMLSpanElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const rows = useMemo(() => buildRows(steps, scalePxPerM), [steps, scalePxPerM]);
  const minorStep = useMemo(() => niceStepMeters(scalePxPerM), [scalePxPerM]);
  const majorStep = minorStep * 5;

  const initialLeg = currentLegIndex(clamp(positionM, 0, rows.totalD), rows.cumD);
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(initialLeg + 1, Math.max(0, steps.length - 1))
  );
  const [focusedIndex, setFocusedIndex] = useState(currentIndex);
  const [live, setLive] = useState("");

  const reducedRef = useRef(false);
  const currentIndexRef = useRef(currentIndex);
  const targetYRef = useRef(0);
  const suspendUntilRef = useRef(0);
  const listFocusedRef = useRef(false);
  const lastSetScrollRef = useRef(0);
  const wakeRef = useRef<() => void>(() => {});

  // reduced-motion tracking
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // the persistent scroll-follow loop: chases targetYRef with an ease-out-
  // expo catch-up, never a hard lock — it yields the moment the user scrolls
  // by hand, and it sleeps once caught up rather than spinning forever.
  useEffect(() => {
    let raf = 0;
    let running = false;
    let last = 0;
    const EPS = 0.5;

    const loop = (now: number) => {
      const dt = last === 0 ? 1 / 60 : Math.min(0.1, (now - last) / 1000);
      last = now;
      const scroller = scrollerRef.current;
      if (!scroller) {
        running = false;
        return;
      }
      const H = scroller.clientHeight;
      const maxScroll = Math.max(0, scroller.scrollHeight - H);
      const target = clamp(targetYRef.current - H / 3, 0, maxScroll);
      const cur = scroller.scrollTop;
      const suspended = now < suspendUntilRef.current || listFocusedRef.current;

      if (!suspended) {
        const next = reducedRef.current
          ? target
          : cur + (target - cur) * (1 - Math.pow(2, -10 * dt));
        if (Math.abs(next - cur) > 0.05) {
          scroller.scrollTop = next;
          lastSetScrollRef.current = next;
        }
      }

      if (!suspended && Math.abs(target - scroller.scrollTop) > EPS) {
        raf = requestAnimationFrame(loop);
      } else {
        running = false;
      }
    };

    wakeRef.current = () => {
      if (!running) {
        running = true;
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    return () => cancelAnimationFrame(raf);
  }, []);

  // manual scroll pauses auto-follow for a beat rather than fighting it
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (Math.abs(el.scrollTop - lastSetScrollRef.current) > 3) {
        suspendUntilRef.current = performance.now() + 2500;
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // p (positionM) is the single scalar driving both the marker and the
  // scroll-follow target. The marker itself is never smoothed — it always
  // reads the honest position; only the viewport eases toward it.
  useEffect(() => {
    const pm = clamp(positionM, 0, rows.totalD);
    const y = yForPosition(pm, rows);
    if (markerRef.current) markerRef.current.style.transform = `translateY(${y}px)`;
    targetYRef.current = y;

    const legIdx = currentLegIndex(pm, rows.cumD);
    const heading = steps[legIdx]?.headingDeg ?? 0;
    if (roseRef.current) roseRef.current.style.transform = `rotate(${(-heading).toFixed(1)}deg)`;
    if (headingChipRef.current) {
      headingChipRef.current.textContent = `${Math.round(((heading % 360) + 360) % 360)}°`;
    }

    const upcoming = Math.min(legIdx + 1, Math.max(0, steps.length - 1));
    if (upcoming !== currentIndexRef.current) {
      currentIndexRef.current = upcoming;
      setCurrentIndex(upcoming);
      const step = steps[upcoming];
      if (step) {
        const remain = (rows.cumD[upcoming] ?? 0) - pm;
        setLive(
          `${step.instruction}${remain > 0.5 ? `, in ${formatDistance(remain)}` : ""}, step ${
            upcoming + 1
          } of ${steps.length}`
        );
      }
    }
    wakeRef.current();
  }, [positionM, rows, steps]);

  const focusRow = (i: number) => {
    setFocusedIndex(i);
    requestAnimationFrame(() => {
      btnRefs.current[i]?.focus();
      btnRefs.current[i]?.scrollIntoView({
        block: "nearest",
        behavior: reducedRef.current ? "auto" : "smooth",
      });
    });
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const n = steps.length;
    let next = focusedIndex;
    if (e.key === "ArrowDown") next = Math.min(n - 1, focusedIndex + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, focusedIndex - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    focusRow(next);
  };

  return (
    <div
      role="region"
      aria-label={label}
      className={`relative flex overflow-hidden rounded-md border border-border bg-background ${className}`}
    >
      {/* compass rose: pinned in its own non-scrolling gutter column (never
          overlaps row content) — aria-hidden, it pays back the bearing the
          strip sacrificed by keeping true heading always in view */}
      <div
        aria-hidden="true"
        className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-2"
      >
        <svg width={26} height={26} viewBox="0 0 26 26" className="text-foreground">
          <circle cx={13} cy={13} r={11} fill="none" stroke="currentColor" strokeOpacity={0.35} />
          <g
            ref={roseRef}
            style={{ transformOrigin: "13px 13px" }}
            className="transition-transform duration-500 ease-out motion-reduce:transition-none motion-reduce:duration-0"
          >
            <path d="M13 3L15.2 10.5L13 8.8L10.8 10.5Z" fill="currentColor" />
            <circle cx={13} cy={13} r={1.2} fill="currentColor" />
          </g>
        </svg>
        <span
          ref={headingChipRef}
          className="font-mono text-[8px] leading-none text-ns-muted"
        >
          0&deg;
        </span>
      </div>

      <div
        ref={scrollerRef}
        className="h-full min-w-0 flex-1 overflow-y-auto overscroll-contain pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="relative">
          <ol
            aria-label={label}
            onKeyDown={onListKeyDown}
            onFocusCapture={() => {
              listFocusedRef.current = true;
            }}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                listFocusedRef.current = false;
              }
            }}
            className="relative"
          >
            {steps.map((s, i) => {
              const passed = i <= currentLegIndex(clamp(positionM, 0, rows.totalD), rows.cumD);
              const isCurrent = i === currentIndex;
              const kind = i === 0 ? "start" : i === steps.length - 1 ? "end" : "mid";
              const tone = passed && !isCurrent ? "text-ns-muted" : "text-foreground";
              const ticks =
                i > 0 && !rows.broke[i]
                  ? ticksInRange(rows.cumD[i - 1] ?? 0, rows.cumD[i] ?? 0, minorStep).map((m) => ({
                      m,
                      offset: m - (rows.cumD[i - 1] ?? 0),
                      major: Math.abs(m % majorStep) < 1e-6,
                    }))
                  : [];

              return (
                <li key={s.id}>
                  {i > 0 && (rows.y[i] ?? 0) - (rows.y[i - 1] ?? 0) > 0.5 && (
                    <div
                      aria-hidden="true"
                      className="relative"
                      style={{ height: (rows.y[i] ?? 0) - (rows.y[i - 1] ?? 0) }}
                    >
                      {rows.broke[i] ? (
                        <div className="absolute left-1 top-0 -translate-y-1/2">
                          <BreakZigzag />
                        </div>
                      ) : (
                        ticks.map((t) => (
                          <div
                            key={t.m}
                            className="absolute left-0 flex items-center gap-1"
                            style={{ top: t.offset }}
                          >
                            <span
                              className={`h-px ${
                                t.major ? "w-3 bg-foreground/50" : "w-1.5 bg-border"
                              }`}
                            />
                            {t.major && (
                              <span className="font-mono text-[8px] leading-none text-ns-muted">
                                {formatChainage(t.m)}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div
                    className="flex items-center gap-2"
                    style={{ height: ROW_H }}
                  >
                    <div
                      aria-hidden="true"
                      className="w-10 shrink-0 text-right font-mono text-[9px] leading-none text-ns-muted"
                    >
                      {formatChainage(rows.cumD[i] ?? 0)}
                    </div>
                    <div aria-hidden="true" className={`shrink-0 ${tone}`}>
                      <TurnGlyph angleDeg={s.turnAngleDeg} kind={kind} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <button
                        ref={(el) => {
                          btnRefs.current[i] = el;
                        }}
                        type="button"
                        tabIndex={focusedIndex === i ? 0 : -1}
                        aria-current={isCurrent ? "step" : undefined}
                        aria-label={`${s.instruction}${
                          s.road ? `, ${s.road}` : ""
                        }${s.distanceM > 0 ? `, in ${formatDistance(s.distanceM)}` : ""}, step ${
                          i + 1
                        } of ${steps.length}`}
                        title={`${s.instruction}${s.road ? ` · ${s.road}` : ""}`}
                        onClick={() => focusRow(i)}
                        onFocus={() => setFocusedIndex(i)}
                        className="flex h-full w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 text-left outline-none transition-colors duration-150 hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <span className={`min-w-0 flex-1 truncate text-sm ${tone}`}>
                          {s.instruction}
                          {s.road ? (
                            <span className="text-ns-muted"> · {s.road}</span>
                          ) : null}
                        </span>
                        {s.distanceM > 0 && (
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-ns-muted">
                            {formatDistance(s.distanceM)}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* position marker: y is the honest, unsmoothed proportional
              position — only the viewport (above) eases toward it. Foreground,
              not accent — this is a persistent state readout, not an
              interaction affordance. */}
          <div
            ref={markerRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-[38px] top-0 -translate-y-1/2"
          >
            <span className="relative flex h-[10px] w-[10px] items-center justify-center">
              <span className="absolute inline-flex h-full w-full rounded-full border border-foreground/50 motion-safe:animate-ping" />
              <svg width={10} height={10} viewBox="0 0 10 10" className="relative text-foreground">
                <path d="M0 0L10 5L0 10Z" fill="currentColor" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {live}
      </div>
    </div>
  );
}
