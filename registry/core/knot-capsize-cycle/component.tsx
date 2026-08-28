"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// KnotCapsizeCycle — an ambient status gauge that expresses load as knot
// topology instead of a fill bar or needle. A binding knot (drawn as a fixed
// set of parametric bezier strands: two standing ends, two crossing loops)
// is breathed through a real rigging load cycle — ramp, hold, release — and
// at peak load its asymmetric crossings visibly slide and roll into a
// capsized topology before the next release lets it re-dress. This is the
// granny-knot capsize specifically: tied with the same crossings as a
// reef/square knot but the wrong second half-hitch, it slips under load
// into a different, weaker arrangement while a true reef knot would lock.
//
// Every strand is a single cubic bezier with a fixed anchor at the knot's
// core (where it attaches to its neighbour) and a free end. Two named
// control-point sets — DRESSED and CAPSIZED — describe the same four
// strands in two different rope arrangements; a single scalar `load` drives
// a ramp/hold/release cycle, and a second scalar `capsizeT` (0 = dressed,
// 1 = capsized) drives a linear interpolation between the two control-point
// sets, so the transition is always a continuous slide, never a swap. Which
// loop currently reads as "on top" is shown the way rope diagrams show it —
// a short gap cut into the strand passing underneath — and that gap swaps
// sides in lockstep with capsizeT, so the loop that was on top visibly goes
// under as it rolls through the capsize.
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number };
type Cubic = { p0: Pt; p1: Pt; p2: Pt; p3: Pt };

interface KnotGeometry {
  standA: Cubic;
  standB: Cubic;
  loopA: Cubic;
  loopB: Cubic;
}

const CYCLE_MS = 8000;
const RAMP_MS = 4500;
const HOLD_MS = 1500;
const RELEASE_MS = 2000; // RAMP + HOLD + RELEASE === CYCLE_MS

const CAPSIZE_TRIGGER_LOAD = 0.92;
const REDRESS_TRIGGER_LOAD = 0.3;
const CAPSIZE_MS = 900;
const REDRESS_MS = 700;

const STAND_MODULATION = 0.06; // +/-6% standing-end reach with load

// Normalised knot space, roughly [-1, 1]; scaled by the container's smaller
// dimension at render time. Anchors (p0) are the structural attachment
// points shared between a standing end and its loop, so they never move
// between DRESSED and CAPSIZED — only the free geometry (p1, p2, p3) slides.
const DRESSED: KnotGeometry = {
  standA: { p0: { x: -1.35, y: 1.35 }, p1: { x: -0.9, y: 0.75 }, p2: { x: -0.55, y: 0.35 }, p3: { x: -0.28, y: 0.05 } },
  standB: { p0: { x: 1.35, y: -1.35 }, p1: { x: 0.9, y: -0.75 }, p2: { x: 0.55, y: -0.35 }, p3: { x: 0.28, y: -0.05 } },
  loopA: { p0: { x: -0.28, y: 0.05 }, p1: { x: -0.15, y: -0.55 }, p2: { x: 0.45, y: -0.55 }, p3: { x: 0.15, y: 0.1 } },
  loopB: { p0: { x: 0.28, y: -0.05 }, p1: { x: 0.15, y: 0.55 }, p2: { x: -0.45, y: 0.55 }, p3: { x: -0.15, y: -0.1 } },
};

// CAPSIZED: loopA has slipped off its mirror position and rolled to nest
// alongside loopB instead of crossing opposite it — the granny-knot slip.
// loopB shifts slightly too, as the strand receiving the new crossing.
const CAPSIZED: KnotGeometry = {
  standA: DRESSED.standA,
  standB: DRESSED.standB,
  loopA: { p0: { x: -0.28, y: 0.05 }, p1: { x: -0.55, y: -0.15 }, p2: { x: -0.45, y: 0.55 }, p3: { x: 0.15, y: 0.35 } },
  loopB: { p0: { x: 0.28, y: -0.05 }, p1: { x: 0.55, y: 0.15 }, p2: { x: 0.2, y: 0.6 }, p3: { x: -0.2, y: 0.25 } },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPt(a: Pt, b: Pt, t: number): Pt {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function lerpCubic(a: Cubic, b: Cubic, t: number): Cubic {
  return { p0: lerpPt(a.p0, b.p0, t), p1: lerpPt(a.p1, b.p1, t), p2: lerpPt(a.p2, b.p2, t), p3: lerpPt(a.p3, b.p3, t) };
}

function easeInOutSine(t: number): number {
  return 0.5 * (1 - Math.cos(Math.PI * t));
}

/** De Casteljau split of a cubic bezier at parameter t: returns the two
 * sub-curves [0,t] and [t,1], each reparametrised to [0,1]. */
function splitCubic(c: Cubic, t: number): { left: Cubic; right: Cubic } {
  const p01 = lerpPt(c.p0, c.p1, t);
  const p12 = lerpPt(c.p1, c.p2, t);
  const p23 = lerpPt(c.p2, c.p3, t);
  const p012 = lerpPt(p01, p12, t);
  const p123 = lerpPt(p12, p23, t);
  const p0123 = lerpPt(p012, p123, t);
  return {
    left: { p0: c.p0, p1: p01, p2: p012, p3: p0123 },
    right: { p0: p0123, p1: p123, p2: p23, p3: c.p3 },
  };
}

/** Sub-curve of `c` covering original parameter range [ta, tb] (0 <= ta < tb <= 1). */
function subCubic(c: Cubic, ta: number, tb: number): Cubic {
  const afterTa = splitCubic(c, ta).right;
  const localTb = (tb - ta) / (1 - ta);
  return splitCubic(afterTa, localTb).left;
}

function cubicToD(c: Cubic, ox: number, oy: number, s: number): string {
  const x = (n: number) => (ox + n * s).toFixed(2);
  const y = (n: number) => (oy + n * s).toFixed(2);
  return `M${x(c.p0.x)} ${y(c.p0.y)}C${x(c.p1.x)} ${y(c.p1.y)},${x(c.p2.x)} ${y(c.p2.y)},${x(c.p3.x)} ${y(c.p3.y)}`;
}

/** Renders a loop strand as one continuous path, or as two segments with a
 * gap cut around t=0.5 when `underAmount` (0..1) is > 0 — the rope-diagram
 * convention for "this strand passes underneath here". Gap half-width
 * grows from 0 to 0.09 in curve-parameter units as underAmount goes 0..1. */
function loopStrandPaths(c: Cubic, underAmount: number, ox: number, oy: number, s: number): string[] {
  if (underAmount <= 0.001) return [cubicToD(c, ox, oy, s)];
  const half = 0.09 * underAmount;
  const segments: string[] = [];
  if (0.5 - half > 0.02) segments.push(cubicToD(subCubic(c, 0, 0.5 - half), ox, oy, s));
  if (0.5 + half < 0.98) segments.push(cubicToD(subCubic(c, 0.5 + half, 1), ox, oy, s));
  return segments;
}

/** Standing-end reach modulates +/-6% with load: pulled taut (longer,
 * straighter) as load rises, slack (shorter reach) as it falls. Only the
 * free end (p0) moves; the anchor stays fixed at the knot core. */
function tightenStand(c: Cubic, load: number): Cubic {
  const scale = 1 + STAND_MODULATION * (load - 0.5) * 2;
  const dx = c.p0.x - c.p3.x;
  const dy = c.p0.y - c.p3.y;
  return { ...c, p0: { x: c.p3.x + dx * scale, y: c.p3.y + dy * scale } };
}

// CAPSIZE_MIDWAY: the reduced-motion freeze frame. capsizeT frozen at 0.5 —
// mid-slide, neither dressed nor capsized, the single most structurally
// informative frame — with load held at the capsize trigger point so the
// standing ends read taut, matching the moment this frame is drawn from.
const REDUCED_MOTION_CAPSIZE_T = 0.5;
const REDUCED_MOTION_LOAD = CAPSIZE_TRIGGER_LOAD;

export interface KnotCapsizeCycleProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function KnotCapsizeCycle({ className = "" }: KnotCapsizeCycleProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const standARef = useRef<SVGPathElement>(null);
  const standBRef = useRef<SVGPathElement>(null);
  const loopAGroupRef = useRef<SVGGElement>(null);
  const loopBGroupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let visible = true;
    let w = 0;
    let h = 0;
    let sized = false;
    let raf = 0;

    // capsize state machine: capsizeT 0 = dressed, 1 = capsized.
    let capsizeT = 0;
    let capsizePhase: "idle" | "capsizing" | "capsized" | "redressing" = "idle";
    let capsizeStart = 0;
    let lastCycleIndex = -1;
    let capsizeTriggeredThisCycle = false;
    let redressTriggeredThisCycle = false;

    const render = (load: number, t: number) => {
      const s = Math.min(w, h) * 0.39;
      const ox = w / 2;
      const oy = h / 2;

      const standA = tightenStand(lerpCubic(DRESSED.standA, CAPSIZED.standA, t), load);
      const standB = tightenStand(lerpCubic(DRESSED.standB, CAPSIZED.standB, t), load);
      const loopA = lerpCubic(DRESSED.loopA, CAPSIZED.loopA, t);
      const loopB = lerpCubic(DRESSED.loopB, CAPSIZED.loopB, t);

      // At t=0 (dressed) loopA is under, loopB is over; at t=1 (capsized)
      // that flips. The gap amount tracks the interpolation continuously so
      // the "which one's on top" cue slides in step with the geometry.
      const loopAUnder = 1 - t;
      const loopBUnder = t;

      standARef.current?.setAttribute("d", cubicToD(standA, ox, oy, s));
      standBRef.current?.setAttribute("d", cubicToD(standB, ox, oy, s));

      const paintGroup = (group: SVGGElement | null, c: Cubic, underAmount: number) => {
        if (!group) return;
        const segs = loopStrandPaths(c, underAmount, ox, oy, s);
        while (group.children.length > segs.length) group.removeChild(group.lastChild as ChildNode);
        segs.forEach((d, i) => {
          let path = group.children[i] as SVGPathElement | undefined;
          if (!path) {
            path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", "currentColor");
            path.setAttribute("stroke-width", "2.5");
            path.setAttribute("stroke-linecap", "round");
            group.appendChild(path);
          }
          path.setAttribute("d", d);
        });
      };

      // draw order: whichever loop is currently "over" is appended last so
      // it visually sits on top of the other at the crossing.
      if (loopAUnder >= loopBUnder) {
        paintGroup(loopAGroupRef.current, loopA, loopAUnder);
        paintGroup(loopBGroupRef.current, loopB, loopBUnder);
        svg.querySelector("#knot-loops")?.append(...[loopAGroupRef.current, loopBGroupRef.current].filter(Boolean) as SVGGElement[]);
      } else {
        paintGroup(loopAGroupRef.current, loopA, loopAUnder);
        paintGroup(loopBGroupRef.current, loopB, loopBUnder);
        svg.querySelector("#knot-loops")?.append(...[loopBGroupRef.current, loopAGroupRef.current].filter(Boolean) as SVGGElement[]);
      }
    };

    const loadAt = (cyclePos: number): number => {
      if (cyclePos < RAMP_MS) return easeInOutSine(cyclePos / RAMP_MS);
      if (cyclePos < RAMP_MS + HOLD_MS) return 1;
      const releaseT = (cyclePos - RAMP_MS - HOLD_MS) / RELEASE_MS;
      return 1 - easeInOutSine(Math.min(1, releaseT));
    };

    const step = (now: number, elapsed: number) => {
      const cyclePos = elapsed % CYCLE_MS;
      const cycleIndex = Math.floor(elapsed / CYCLE_MS);
      if (cycleIndex !== lastCycleIndex) {
        lastCycleIndex = cycleIndex;
        capsizeTriggeredThisCycle = false;
        redressTriggeredThisCycle = false;
      }

      const load = loadAt(cyclePos);
      const inRamp = cyclePos < RAMP_MS;
      const inRelease = cyclePos >= RAMP_MS + HOLD_MS;

      if (inRamp && !capsizeTriggeredThisCycle && load >= CAPSIZE_TRIGGER_LOAD) {
        capsizeTriggeredThisCycle = true;
        capsizePhase = "capsizing";
        capsizeStart = now;
      }
      if (inRelease && capsizeTriggeredThisCycle && !redressTriggeredThisCycle && load <= REDRESS_TRIGGER_LOAD) {
        redressTriggeredThisCycle = true;
        capsizePhase = "redressing";
        capsizeStart = now;
      }

      if (capsizePhase === "capsizing") {
        const p = Math.min(1, (now - capsizeStart) / CAPSIZE_MS);
        capsizeT = easeInOutSine(p);
        if (p >= 1) capsizePhase = "capsized";
      } else if (capsizePhase === "redressing") {
        const p = Math.min(1, (now - capsizeStart) / REDRESS_MS);
        capsizeT = 1 - easeInOutSine(p);
        if (p >= 1) capsizePhase = "idle";
      }

      render(load, capsizeT);
    };

    let startTime = 0;
    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized) return;
      if (startTime === 0) startTime = now;
      step(now, now - startTime);
      raf = requestAnimationFrame(loop);
    };

    const measure = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      sized = w >= 2 && h >= 2;
    };

    const start = () => {
      measure();
      if (!sized) return;
      if (reduced) {
        render(REDUCED_MOTION_LOAD, REDUCED_MOTION_CAPSIZE_T);
        return;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };

    // no paint before the first size + token-carrying layout is settled
    start();

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        measure();
        if (sized && !raf && !reduced) {
          raf = requestAnimationFrame(loop);
        } else if (sized && reduced) {
          render(REDUCED_MOTION_LOAD, REDUCED_MOTION_CAPSIZE_T);
        }
      }, 100);
    });
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && sized && !raf && !reduced) {
        startTime = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative aspect-square w-full ${className}`}>
      <svg
        ref={svgRef}
        aria-hidden="true"
        focusable="false"
        className="h-full w-full"
        style={{ color: "var(--foreground)" }}
      >
        <g id="knot-loops">
          <g ref={loopAGroupRef} />
          <g ref={loopBGroupRef} />
        </g>
        <path ref={standARef} d="" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
        <path ref={standBRef} d="" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
    </div>
  );
}
