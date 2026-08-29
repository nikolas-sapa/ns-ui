"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// LugCageTally — an ambient loading glyph shaped as a row of five pin
// wheels spinning past a fixed read position, each engaged pin nudging a
// segmented tally bar forward one notch. Five wheels, mutually-prime full
// rotation periods (7s, 6s, 5s, 4s, 3.5s), each ringed with 8 pins in a
// fixed active/inactive pattern set once at mount. Every 45deg of rotation
// carries the next pin past the fixed 12-o'clock read mark; if that pin is
// active, its rim mark brightens in a 90ms luminance flash and the tally
// bar's next notch fills. Because the five periods share no small common
// factor their combined phase relationship doesn't repeat for well over a
// minute, so the wheels keep looking freshly decorrelated on any viewing.
// Pure SVG + direct-DOM rAF writes (refs only, no React state on the hot
// path); geometry is recomputed only on resize.
// ---------------------------------------------------------------------------

const WHEEL_COUNT = 5;
const PINS_PER_WHEEL = 8;
const PIN_STEP_DEG = 360 / PINS_PER_WHEEL;
// deg/s for each wheel — periods 7s, 6s, 5s, 4s, 3.5s, chosen to share no
// small common factor so the combined pattern reads as freshly decorrelated
const RATES_DEG_S = [51.42857142857143, 60, 72, 90, 102.85714285714286];
const FLASH_MS = 90;
const TALLY_LENGTH = 24;
const NOTCH_FILL_MS = 140;
const NOTCH_FADE_MS = 200;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** exactly half the pins active, shuffled per wheel — set once, never
 * touched again, so a wheel's pattern never gives itself away except
 * through the read-event flash. */
function buildPattern(rand: () => number): boolean[] {
  const arr = [true, true, true, true, false, false, false, false];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/** which pin index sits at the fixed 12-o'clock read mark after N pin-steps
 * of rotation, given pin 0 starts there at t=0 — the wheel visits pins in
 * descending index order as it turns, so this walks backward mod 8. */
function pinAtReadMark(stepCount: number): number {
  return (PINS_PER_WHEEL - (stepCount % PINS_PER_WHEEL)) % PINS_PER_WHEEL;
}

interface Layout {
  w: number;
  h: number;
  wheelR: number;
  wheelCx: number[];
  wheelCy: number;
  tallyX: number;
  tallyY: number;
  tallyW: number;
  tallyH: number;
  notchW: number;
  notchGap: number;
}

function computeLayout(w: number, h: number): Layout {
  const smaller = Math.max(1, Math.min(w, h));
  const d = smaller / 6.5; // wheel diameter
  const wheelR = d / 2;
  const tallyH = d * 0.3;
  const gapH = d * 0.55;
  const rowW = WHEEL_COUNT * d + (WHEEL_COUNT - 1) * gapH;
  const vGap = d * 0.4;
  const contentH = d + vGap + tallyH;
  const topY = Math.max(0, (h - contentH) / 2);
  const wheelCy = topY + wheelR;
  const startX = Math.max(0, (w - rowW) / 2) + wheelR;
  const wheelCx = Array.from({ length: WHEEL_COUNT }, (_, i) => startX + i * (d + gapH));
  const tallyX = Math.max(0, (w - rowW) / 2);
  const tallyY = topY + d + vGap;
  const notchGap = tallyH * 0.22;
  const notchW = (rowW - notchGap * (TALLY_LENGTH - 1)) / TALLY_LENGTH;
  return {
    w,
    h,
    wheelR,
    wheelCx,
    wheelCy,
    tallyX,
    tallyY,
    tallyW: rowW,
    tallyH,
    notchW: Math.max(1, notchW),
    notchGap,
  };
}

export interface LugCageTallyProps {
  /** text announced via the component's own aria-live region */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function LugCageTally({ label = "Loading", className = "" }: LugCageTallyProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wheelGroupRefs = useRef<(SVGGElement | null)[]>([]);
  const pinRefs = useRef<(SVGLineElement | null)[][]>(
    Array.from({ length: WHEEL_COUNT }, () => [])
  );
  const notchRefs = useRef<(SVGRectElement | null)[]>([]);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  const layout = useMemo(() => computeLayout(dims.w, dims.h), [dims.w, dims.h]);

  // container sizing — smaller dimension drives every other measurement
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentRect;
      setDims({ w: box.width, h: box.height });
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // patterns fixed once per mount, independent of layout/resize
  const patternsRef = useRef<boolean[][] | null>(null);
  if (!patternsRef.current) {
    const rand = mulberry32(Date.now() ^ 0x9e3779b9);
    patternsRef.current = Array.from({ length: WHEEL_COUNT }, () => buildPattern(rand));
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root || layout.w <= 0 || layout.h <= 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const patterns = patternsRef.current!;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let startTime = 0;
    const stepCounts = new Array(WHEEL_COUNT).fill(0);
    const flashTimers: (ReturnType<typeof setTimeout> | undefined)[][] = Array.from(
      { length: WHEEL_COUNT },
      () => []
    );
    let rollTimer: ReturnType<typeof setTimeout> | undefined;
    const tallyFilled: boolean[] = new Array(TALLY_LENGTH).fill(false);

    const setNotchStyle = (el: SVGRectElement | null, filled: boolean, withTransition: boolean) => {
      if (!el) return;
      el.style.transition = withTransition
        ? `fill-opacity ${NOTCH_FILL_MS}ms ease-out`
        : "none";
      el.style.fillOpacity = filled ? "0.8" : "0";
    };

    const advanceTally = () => {
      const filledCount = tallyFilled.filter(Boolean).length;
      if (filledCount < TALLY_LENGTH) {
        const idx = tallyFilled.findIndex((v) => !v);
        if (idx < 0) return;
        tallyFilled[idx] = true;
        setNotchStyle(notchRefs.current[idx] ?? null, true, true);
        return;
      }
      // rolling window: fade the leftmost notch, then re-index the strip
      // and fill the rightmost — no hard reset, the bar never empties
      const first = notchRefs.current[0];
      if (first) {
        first.style.transition = `fill-opacity ${NOTCH_FADE_MS}ms ease`;
        first.style.fillOpacity = "0";
      }
      if (rollTimer) clearTimeout(rollTimer);
      rollTimer = setTimeout(() => {
        if (disposed) return;
        for (let i = 0; i < TALLY_LENGTH - 1; i++) tallyFilled[i] = tallyFilled[i + 1] ?? true;
        tallyFilled[TALLY_LENGTH - 1] = false;
        for (let i = 0; i < TALLY_LENGTH - 1; i++) {
          setNotchStyle(notchRefs.current[i] ?? null, true, false);
        }
        tallyFilled[TALLY_LENGTH - 1] = true;
        setNotchStyle(notchRefs.current[TALLY_LENGTH - 1] ?? null, true, true);
      }, NOTCH_FADE_MS);
    };

    const flashPin = (wheelIdx: number, pinIdx: number) => {
      const el = pinRefs.current[wheelIdx]?.[pinIdx];
      if (!el) return;
      const pending = flashTimers[wheelIdx]?.[pinIdx];
      if (pending) clearTimeout(pending);
      el.style.transition = "none";
      el.style.opacity = "1";
      requestAnimationFrame(() => {
        if (disposed) return;
        el.style.transition = `opacity ${FLASH_MS}ms ease-out`;
        el.style.opacity = "0.85";
      });
      const arr = flashTimers[wheelIdx];
      if (arr) {
        arr[pinIdx] = setTimeout(() => {
          if (el) el.style.opacity = "0.85";
        }, FLASH_MS + 20);
      }
    };

    const applyFrame = (elapsedSec: number) => {
      for (let i = 0; i < WHEEL_COUNT; i++) {
        const rate = RATES_DEG_S[i] ?? 0;
        const angle = (rate * elapsedSec) % 360;
        const g = wheelGroupRefs.current[i];
        if (g) g.setAttribute("transform", `rotate(${angle.toFixed(2)} ${layout.wheelCx[i] ?? 0} ${layout.wheelCy})`);

        const cumSteps = Math.floor((rate * elapsedSec) / PIN_STEP_DEG);
        let prev = stepCounts[i] ?? 0;
        // guard against a huge dt (tab backgrounded) firing hundreds of
        // catch-up reads at once — only the most recent read is meaningful
        if (cumSteps - prev > PINS_PER_WHEEL) prev = cumSteps - PINS_PER_WHEEL;
        while (prev < cumSteps) {
          prev++;
          const pinIdx = pinAtReadMark(prev);
          if (patterns[i]?.[pinIdx]) {
            flashPin(i, pinIdx);
            advanceTally();
          }
        }
        stepCounts[i] = cumSteps;
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (startTime === 0) startTime = now;
      applyFrame((now - startTime) / 1000);
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      // STATIC_PHASE: five wheels frozen at distinct phases, at least two
      // pin marks caught mid-fade, tally sitting at ~60% — the frame that
      // best shows "mechanism mid-tally" rather than a clean idle state
      const freezeAngles = [22, 168, 301, 74, 249];
      for (let i = 0; i < WHEEL_COUNT; i++) {
        const g = wheelGroupRefs.current[i];
        if (g) g.setAttribute("transform", `rotate(${freezeAngles[i]} ${layout.wheelCx[i] ?? 0} ${layout.wheelCy})`);
      }
      const midFadeWheels = [1, 3];
      for (let i = 0; i < WHEEL_COUNT; i++) {
        for (let p = 0; p < PINS_PER_WHEEL; p++) {
          const el = pinRefs.current[i]?.[p];
          if (!el) continue;
          el.style.transition = "none";
          el.style.opacity = midFadeWheels.includes(i) && p === 0 ? "0.93" : "0.85";
        }
      }
      const filledUpTo = Math.round(TALLY_LENGTH * 0.6);
      for (let i = 0; i < TALLY_LENGTH; i++) {
        setNotchStyle(notchRefs.current[i] ?? null, i < filledUpTo, false);
      }
      return () => {
        disposed = true;
      };
    }

    raf = requestAnimationFrame(loop);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(root);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      io.disconnect();
      if (rollTimer) clearTimeout(rollTimer);
      for (const wheel of flashTimers) {
        for (const t of wheel) if (t) clearTimeout(t);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.w, layout.h]);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-live="polite"
      data-lug-cage-tally
      className={`relative flex h-full w-full items-center justify-center ${className}`}
    >
      <svg
        ref={svgRef}
        aria-hidden="true"
        focusable="false"
        className="h-full w-full"
        viewBox={`0 0 ${Math.max(1, layout.w)} ${Math.max(1, layout.h)}`}
      >
        {layout.wheelCx.map((cx, i) => (
          <g key={i}>
            {/* fixed 12-o'clock read mark — the highest-contrast reference
                point, does not rotate */}
            <line
              x1={cx}
              y1={layout.wheelCy - layout.wheelR - layout.wheelR * 0.32}
              x2={cx}
              y2={layout.wheelCy - layout.wheelR - layout.wheelR * 0.08}
              stroke="var(--foreground)"
              strokeWidth={Math.max(1, layout.wheelR * 0.09)}
              strokeLinecap="round"
            />
            <g
              ref={(el) => {
                wheelGroupRefs.current[i] = el;
              }}
            >
              <circle
                cx={cx}
                cy={layout.wheelCy}
                r={layout.wheelR}
                fill="none"
                stroke="var(--foreground)"
                strokeOpacity={0.55}
                strokeWidth={Math.max(1, layout.wheelR * 0.06)}
              />
              {Array.from({ length: PINS_PER_WHEEL }, (_, p) => {
                const angle = (p * PIN_STEP_DEG - 90) * (Math.PI / 180);
                const rOuter = layout.wheelR;
                const rInner = layout.wheelR * 0.78;
                const x1 = cx + Math.cos(angle) * rOuter;
                const y1 = layout.wheelCy + Math.sin(angle) * rOuter;
                const x2 = cx + Math.cos(angle) * rInner;
                const y2 = layout.wheelCy + Math.sin(angle) * rInner;
                return (
                  <line
                    key={p}
                    ref={(el) => {
                      const arr = pinRefs.current[i];
                      if (arr) arr[p] = el;
                    }}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="var(--foreground)"
                    strokeOpacity={0.85}
                    strokeWidth={Math.max(1, layout.wheelR * 0.1)}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          </g>
        ))}

        {Array.from({ length: TALLY_LENGTH }, (_, i) => {
          const x = layout.tallyX + i * (layout.notchW + layout.notchGap);
          return (
            <g key={i}>
              <rect
                x={x}
                y={layout.tallyY}
                width={layout.notchW}
                height={layout.tallyH}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1}
              />
              <rect
                ref={(el) => {
                  notchRefs.current[i] = el;
                }}
                x={x}
                y={layout.tallyY}
                width={layout.notchW}
                height={layout.tallyH}
                fill="var(--foreground)"
                fillOpacity={0}
              />
            </g>
          );
        })}
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
