"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// WickRun — a determinate progress bar that advances by capillary action
// instead of gliding. True progress sets a `target`; the visible fill chases
// it in discrete draws (quick pull, slowing soak, brief dwell, next pull),
// each draw closing ~60% of the remaining gap with ease-out-expo over 300ms
// then holding 150ms — an asymptotic approach that re-aims itself whenever
// the target moves mid-draw. A second element at --foreground, low opacity,
// rides 4-10px ahead of the true fill edge during each draw (its lead
// collapsing to ~0 through the dwell) as a faint wet-front preview of where
// the fill is about to reach. Widths/positions are written as CSS custom
// properties (`--wick-fill`, `--wick-front`) from one rAF loop that sleeps
// the instant the gap closes, and wakes again only when `value` moves.
// Indeterminate mode drops the fill and sends the front pill alone down the
// track in the same draw-dwell cadence, slowed down, looping. `aria-valuenow`
// tracks the TRUE `value` directly every render — never the eased display —
// so a screen reader is never behind the animation; milestone crossings
// (25/50/75/100) are announced through a separate polite live region, and a
// Geist Mono percentage sits beside the track so the reading never depends
// on the bar alone. Reduced motion strips the wet front and the draws
// collapse to a single 150ms linear width transition per update.
// ---------------------------------------------------------------------------

const DRAW_MS = 300;
const DWELL_MS = 150;
const DRAW_FRACTION = 0.6; // each draw closes 60% of the remaining gap
const SETTLE_EPS = 0.05; // percent — below this the run is "arrived"

const SLOW_DRAW_MS = 480;
const SLOW_DWELL_MS = 260;
const SLOW_SETTLE_EPS = 2; // looser: indeterminate resets before crawling the last %
const TRAVEL_START = -16; // % — front pill starts just off the left edge
const TRAVEL_END = 116; // % — and exits just off the right edge

const MILESTONES = [25, 50, 75, 100];

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
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

export interface WickRunProps {
  /** true progress, 0-100 (controlled). Ignored while `indeterminate` is set. */
  value?: number;
  /** unknown-duration mode: the wet front alone travels the track in slow draws, no fill */
  indeterminate?: boolean;
  /** visible + accessible label, e.g. "Uploading assets.zip" (default "Progress") */
  label?: string;
  /** announce 25/50/75/100% crossings via a polite live region (default true) */
  announceMilestones?: boolean;
  className?: string;
}

export function WickRun({
  value = 0,
  indeterminate = false,
  label = "Progress",
  announceMilestones = true,
  className = "",
}: WickRunProps) {
  const uid = useId();
  const labelId = `${uid}-label`;
  const reduced = useReducedMotion();

  const trackRef = useRef<HTMLDivElement>(null);
  const retargetRef = useRef<((v: number) => void) | null>(null);
  const lastMilestoneRef = useRef(0);
  const [announce, setAnnounce] = useState("");

  const clampedValue = clamp(value, 0, 100);

  // Milestone announcements read the TRUE value directly, decoupled from the
  // rAF loop entirely, so assistive tech is never a beat behind the fill.
  useEffect(() => {
    if (indeterminate || !announceMilestones) return;
    if (clampedValue < lastMilestoneRef.current) lastMilestoneRef.current = 0;
    for (const m of MILESTONES) {
      if (clampedValue >= m && lastMilestoneRef.current < m) {
        lastMilestoneRef.current = m;
        setAnnounce(m === 100 ? "Complete" : `${m}% complete`);
      }
    }
  }, [clampedValue, indeterminate, announceMilestones]);

  // Engine: mounts once per indeterminate/reduced-motion combination, then
  // sleeps between updates. A separate effect below feeds it every `value`
  // change through `retargetRef` without re-running this setup.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    if (reduced) {
      // Reduced motion: no rAF, no wet front (never rendered, see JSX) — a
      // plain width write lands on the CSS `transition: width 150ms linear`
      // declared below, so every update glides once, linearly, and stops.
      // Indeterminate has nothing to animate under reduced motion, so it
      // paints one static partial bar rather than an uninformative 0-width
      // track — `aria-valuetext` still carries the real "in progress" state.
      if (indeterminate) {
        track.style.setProperty("--wick-fill", "35%");
        return;
      }
      const paint = (v: number) => {
        track.style.setProperty("--wick-fill", `${clamp(v, 0, 100)}%`);
      };
      paint(clampedValue);
      retargetRef.current = paint;
      return () => {
        retargetRef.current = null;
      };
    }

    let raf = 0;
    let trackW = track.clientWidth || 1;
    let phase: "draw" | "dwell" | "idle" = "idle";
    let phaseStart = 0;
    let display = indeterminate ? TRAVEL_START : 0;
    let target = indeterminate ? TRAVEL_END : clampedValue;
    let drawFrom = display;
    let drawTo = display;

    const drawMs = indeterminate ? SLOW_DRAW_MS : DRAW_MS;
    const dwellMs = indeterminate ? SLOW_DWELL_MS : DWELL_MS;
    const eps = indeterminate ? SLOW_SETTLE_EPS : SETTLE_EPS;
    const pxToPct = (px: number) => (px / trackW) * 100;

    const beginDraw = (now: number) => {
      const gap = target - display;
      drawFrom = display;
      drawTo = display + gap * DRAW_FRACTION;
      phase = "draw";
      phaseStart = now;
    };

    const paint = (fillPct: number, leadPct: number) => {
      const fill = clamp(fillPct, 0, 100);
      track.style.setProperty("--wick-fill", `${indeterminate ? 0 : fill}%`);
      const frontPos = indeterminate ? fillPct : fill + leadPct;
      track.style.setProperty("--wick-front", `${frontPos}%`);
    };

    const loop = (now: number) => {
      if (phase === "idle" && Math.abs(target - display) > eps) beginDraw(now);

      let leadPct = 0;
      if (phase === "draw") {
        const p = clamp((now - phaseStart) / drawMs, 0, 1);
        display = drawFrom + (drawTo - drawFrom) * easeOutExpo(p);
        if (!indeterminate) leadPct = pxToPct(10 - 6 * p); // quick pull -> slowing soak
        if (p >= 1) {
          display = drawTo;
          phase = "dwell";
          phaseStart = now;
        }
      } else if (phase === "dwell") {
        const p = clamp((now - phaseStart) / dwellMs, 0, 1);
        if (!indeterminate) leadPct = pxToPct(4 * (1 - p)); // front settles back onto the fill
        if (p >= 1) {
          const gap = target - display;
          if (Math.abs(gap) <= eps) {
            display = indeterminate ? TRAVEL_START : target;
            phase = "idle";
          } else {
            phase = "idle"; // re-aim next tick against the latest target
          }
        }
      }

      paint(display, leadPct);

      const settled = !indeterminate && phase === "idle" && Math.abs(target - display) <= eps;
      raf = settled ? 0 : requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    retargetRef.current = (v: number) => {
      if (indeterminate) return;
      target = clamp(v, 0, 100);
      wake();
    };

    wake();

    const ro = new ResizeObserver(() => {
      trackW = track.clientWidth || 1;
    });
    ro.observe(track);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      retargetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clampedValue read once at mount, then fed via retargetRef
  }, [indeterminate, reduced]);

  useEffect(() => {
    retargetRef.current?.(clampedValue);
  }, [clampedValue]);

  const valueText = indeterminate ? "In progress" : `${Math.round(clampedValue)}%`;

  return (
    <div className={className}>
      <style>{`
.ns-wick-fill{width:var(--wick-fill,0%)}
.ns-wick-front{left:var(--wick-front,0%)}
@media (prefers-reduced-motion: reduce){
  .ns-wick-fill{transition:width 150ms linear}
}
`}</style>

      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span id={labelId} className="font-mono text-xs text-ns-muted">
          {label}
        </span>
        {!indeterminate ? (
          <span className="font-mono text-xs tabular-nums text-foreground" aria-hidden>
            {Math.round(clampedValue)}%
          </span>
        ) : null}
      </div>

      <div
        ref={trackRef}
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(clampedValue)}
        aria-valuetext={valueText}
        className="relative h-1.5 overflow-hidden rounded-full border border-border"
      >
        <div className="ns-wick-fill absolute inset-y-0 left-0 rounded-full bg-foreground" />
        {!reduced ? (
          <div className="ns-wick-front absolute inset-y-0 w-3.5 -translate-x-1/2 rounded-full bg-foreground opacity-25" />
        ) : null}
      </div>

      {announceMilestones && !indeterminate ? (
        <span role="status" aria-live="polite" className="sr-only">
          {announce}
        </span>
      ) : null}
    </div>
  );
}
