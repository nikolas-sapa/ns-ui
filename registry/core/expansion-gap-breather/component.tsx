"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ExpansionGapBreather — a divider between two independently-sized layout
// regions, sourced from continuous-welded-rail (CWR) breather switches: the
// tapered-blade gap that lets a rail run grow and shrink with temperature
// without buckling in heat or pulling apart in cold. The rendered "rail
// temperature" is a 14s sine (decoupled from any real diurnal cycle, per the
// round-9 rule) that drives the gap's opening between 4px (hot, nearly
// closed) and 22px (cold, open) — the element the browser lays out around
// its siblings actually resizes with that value, so the divider visibly
// absorbs the width mismatch it sits inside, not just draws it.
//
// The teeth are two interlocking stroked combs, not a rectangular slot: a
// left comb whose tongues reach rightward into the gap and a right comb
// whose tongues reach leftward, each tongue living in every OTHER pitch
// slot down the height so the two combs' tongues occupy disjoint y-ranges —
// a tip can cross past the opposite baseline (that is the interlock) with
// no collision, exactly a breather switch's tapered blades sliding past
// each other. Both combs are drawn inside a small fixed SVG overlay
// centred on the layout-affecting spacer div, so the teeth can extend past
// the spacer's own width without the spacer itself claiming that space.
//
// Tooth pitch derives from the container's own height (the one spatial
// dimension a full-height divider has to work with), clamped so 5-18 teeth
// always read as distinct fingers rather than a blur or a single fat wedge.
// ---------------------------------------------------------------------------

const MIN_GAP = 4;
const MAX_GAP = 22;
const MID_GAP = (MIN_GAP + MAX_GAP) / 2; // 13 — reduced-motion freeze value
const AMP_GAP = (MAX_GAP - MIN_GAP) / 2; // 9
const PERIOD_MS = 14000;

const TOOTH_DEPTH = 18; // px each comb's points reach into the gap
const SVG_WIDTH = MAX_GAP + TOOTH_DEPTH * 2 + 8; // 66 — fixed overlay width
const CENTER_X = SVG_WIDTH / 2;

const MIN_PITCH = 14;
const MAX_PITCH = 24;
const MIN_TEETH = 5;
const MAX_TEETH = 18;

/** Comb outline (stroked, never filled): a straight baseline rail at `baseX`
 * running the full height, with a tapered tongue reaching `direction *
 * TOOTH_DEPTH` past that baseline in every OTHER pitch slot — `slotParity`
 * picks which half of the slots belong to this side. Because the left and
 * right combs are given opposite parities, their tongues occupy disjoint
 * y-ranges: a tongue tip can cross past the opposite comb's baseline (that
 * IS the interlock) without ever colliding with the opposite comb's own
 * geometry, since nothing of the other side exists at that y. */
function buildCombPath(
  baseX: number,
  direction: 1 | -1,
  height: number,
  slotParity: 0 | 1
): string {
  const pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, height / 8));
  const teeth = Math.max(MIN_TEETH, Math.min(MAX_TEETH, Math.round(height / pitch)));
  const step = height / teeth;
  const pts: string[] = [`${baseX.toFixed(1)},0`];
  for (let i = 0; i < teeth; i++) {
    const y0 = i * step;
    const y1 = (i + 1) * step;
    if (i % 2 === slotParity) {
      const tipX = (baseX + direction * TOOTH_DEPTH).toFixed(1);
      pts.push(`${tipX},${(y0 + step / 2).toFixed(1)}`);
    }
    pts.push(`${baseX.toFixed(1)},${y1.toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

export interface ExpansionGapBreatherProps {
  /** extra classes merged onto the spacer root */
  className?: string;
}

export function ExpansionGapBreather({ className = "" }: ExpansionGapBreatherProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const leftRef = useRef<SVGPathElement>(null);
  const rightRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!root || !svg || !left || !right) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let visible = true;
    let raf = 0;
    let height = 0;
    const originMs = performance.now(); // t0 == gap 4 (hot/closed), always

    const paint = (gap: number) => {
      // layout write rounded to whole px — the flex row this sits in would
      // otherwise reflow at 60fps and make sibling text shimmer on subpixel
      // width changes; the tongues themselves still slide on the float.
      root.style.width = `${Math.round(gap)}px`;
      const leftBase = CENTER_X - gap / 2;
      const rightBase = CENTER_X + gap / 2;
      left.setAttribute("d", buildCombPath(leftBase, 1, height, 0));
      right.setAttribute("d", buildCombPath(rightBase, -1, height, 1));
    };

    const loop = () => {
      raf = 0;
      if (disposed || !visible) return;
      // a pure function of elapsed real time since mount — pausing/resuming
      // (tab hidden, scrolled offscreen) never desyncs the phase, it just
      // stops and resumes drawing the same continuous curve.
      const t = ((performance.now() - originMs) % PERIOD_MS) / PERIOD_MS;
      const gap = MID_GAP - AMP_GAP * Math.cos(2 * Math.PI * t);
      paint(gap);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (reduced) {
        paint(MID_GAP); // mid-cycle: average width, teeth half-interlocked
        return;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? root.clientHeight;
      if (h > 0 && Math.abs(h - height) > 0.5) {
        height = h;
        if (reduced) paint(MID_GAP);
      }
    });
    ro.observe(root);
    height = root.clientHeight || 120;

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(root);

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      role="separator"
      aria-orientation="vertical"
      className={`relative h-full shrink-0 ${className}`}
      style={{ width: MID_GAP }}
    >
      <svg
        ref={svgRef}
        aria-hidden="true"
        focusable="false"
        width={SVG_WIDTH}
        height="100%"
        className="pointer-events-none absolute top-0 h-full"
        style={{ left: "50%", transform: `translateX(-${CENTER_X}px)`, overflow: "hidden" }}
      >
        <path
          ref={leftRef}
          d=""
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          ref={rightRef}
          d=""
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
