"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// CatenaryContactStagger — a live connection/sync-quality indicator built
// from overhead contact wire stagger (OLE engineering). Contact wire is
// never laid dead straight above the track: it's deliberately zigzagged
// side to side, span by span, so a pantograph's carbon collector strip wears
// evenly across its width instead of grooving one spot. The strip
// continuously tracks that lateral zigzag as spans pass beneath it; on the
// rare span where contact genuinely breaks, a brief arc punctuates an
// otherwise smooth ride.
//
// Geometry is exact, not sampled: the stagger is a true engineering zigzag —
// dead straight spans between alternating extremes at every support — so the
// wire is a polyline with vertices only at span boundaries, where it flips
// from +stagger to -stagger. A single continuous phase u(t) = elapsed /
// SPAN_MS drives both the wire's horizontal scroll AND the fixed-position
// contact marker's lateral value, sampled from the exact same triangle
// function, so the marker never drifts out of sync with the wire it's
// supposedly riding. One sweep leg (extreme to extreme) takes SPAN_MS; the
// marker's lateral position is therefore always continuous and always
// legible at a glance, at a speed (tens of px/s) nowhere near 60Hz paint.
//
// The dewirement arc is a separate, decoupled Poisson-ish process (mean
// interval independent of the sweep) so it reads as a genuine rare event,
// not a beat in the main rhythm: a brief luminance flash plus a small
// vertical wire "kick" that decays back to the smooth zigzag it interrupted.
// A `connectionQuality` prop (0-1, default 1) shortens the arc's mean
// interval as quality degrades — severity reads via event rate, never hue.
//
// Pure DOM/SVG, no canvas. Wire, strip band and marker are all
// var(--foreground) strokes/fills at full weight in both themes (the CSS var
// itself repaints on a theme swap, no JS token re-read needed since nothing
// here touches a canvas context). The arc flash uses an SVG drop-shadow
// filter seeded from var(--foreground) — glows light in dark mode, glows
// dark in light mode automatically, never introduces a colour of its own.
// ---------------------------------------------------------------------------

const SPAN_MS = 2000; // one sweep leg (extreme -> extreme) per REAL NUMBERS
const ARC_MS = 180; // dewirement arc duration
const ARC_KICK_PX = 3; // vertical wire "kick" during an arc
const DEFAULT_MIN_ARC_MS = 18000;
const DEFAULT_MAX_ARC_MS = 28000;
// degraded connections never arc faster than 4 sweep legs apart — any
// tighter and the arc joins the sweep's own rhythm instead of punctuating it.
const MIN_ARC_FLOOR_MS = SPAN_MS * 4;
const VISIBLE_SPANS = 4; // spans visible across the container at rest
const BAND_FRACTION = 0.68; // strip band height, as a fraction of min(w,h)
const AMPLITUDE_FRACTION = 0.2; // stagger half-throw, as a fraction of min(w,h) — stays inside the band with margin even mid-arc
const MARKER_R = 3.5; // px, contact marker radius at rest
const MARKER_R_ARC = 5.5; // px, contact marker radius during an arc
const WIRE_WIDTH = 1.4; // px, wire stroke at rest
const WIRE_WIDTH_ARC = 3; // px, wire stroke during an arc — weight carries the flash in both themes

/** Exact engineering zigzag: straight spans between alternating extremes.
 * Period 2 (one full extreme -> extreme -> extreme cycle), range -1..1,
 * piecewise-linear so vertices at every integer u ARE the true shape —
 * no sampling, no aliasing. */
function triWave(u: number): number {
  const m = ((u % 2) + 2) % 2; // 0..2
  return m < 1 ? m * 2 - 1 : 3 - m * 2;
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

export interface CatenaryContactStaggerProps {
  /** 0-1, default 1 (perfect). Degraded connectivity shortens the arc's mean
   * interval — severity reads via event rate, never colour. */
  connectionQuality?: number;
  /** floor of the randomised arc interval range at connectionQuality = 1 */
  minArcIntervalMs?: number;
  /** ceiling of the randomised arc interval range at connectionQuality = 1 */
  maxArcIntervalMs?: number;
  /** accessible label for the root status region */
  label?: string;
  /** extra classes merged onto the root element */
  className?: string;
}

export function CatenaryContactStagger({
  connectionQuality = 1,
  minArcIntervalMs = DEFAULT_MIN_ARC_MS,
  maxArcIntervalMs = DEFAULT_MAX_ARC_MS,
  label = "Connection sync status",
  className = "",
}: CatenaryContactStaggerProps) {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wireRef = useRef<SVGPolylineElement>(null);
  const bandRef = useRef<SVGRectElement>(null);
  const markerRef = useRef<SVGCircleElement>(null);
  const [arcing, setArcing] = useState(false);
  const [announce, setAnnounce] = useState("Contact wire tracking nominal.");
  const quality = Math.max(0, Math.min(1, connectionQuality));

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const wire = wireRef.current;
    const band = bandRef.current;
    const marker = markerRef.current;
    if (!root || !svg || !wire || !band || !marker) return;

    let disposed = false;
    let visible = true;
    let w = 0;
    let h = 0;
    let sized = false;
    let spanWidth = 1;
    let amplitude = 1;
    let bandCenterY = 0;
    let bandHeight = 0;
    // origin of the phase clock — set once, on first successful measure, and
    // never reset afterward. A visibility pause/resume (tab hidden, card
    // scrolled off) must NOT jump the phase back to a t0 extreme: the wire
    // is a continuous physical process, so elapsed time keeps accumulating
    // against wall-clock time whether or not a frame was painted for it.
    let originTime = 0;
    let raf = 0;
    let arcStart: number | null = null;
    let arcTimer = 0;
    let arcEndTimer = 0;
    let arcPending = false;

    const arcInterval = () => {
      const min = Math.max(MIN_ARC_FLOOR_MS, minArcIntervalMs * quality || MIN_ARC_FLOOR_MS);
      const max = Math.max(min + 500, maxArcIntervalMs * quality || min + 500);
      return min + Math.random() * (max - min);
    };

    const cancelArcSchedule = () => {
      window.clearTimeout(arcTimer);
      arcTimer = 0;
      arcPending = false;
    };

    const scheduleArc = () => {
      if (disposed || reduced || arcPending) return;
      arcPending = true;
      arcTimer = window.setTimeout(() => {
        if (disposed) return;
        arcPending = false;
        arcStart = performance.now();
        setArcing(true);
        setAnnounce("Momentary contact loss.");
        arcEndTimer = window.setTimeout(() => {
          if (disposed) return;
          arcStart = null;
          setArcing(false);
          setAnnounce("Contact wire tracking nominal.");
          if (visible) scheduleArc();
        }, ARC_MS);
      }, arcInterval());
    };

    const measure = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      sized = true;
      const minDim = Math.min(w, h);
      spanWidth = w / VISIBLE_SPANS;
      amplitude = minDim * AMPLITUDE_FRACTION;
      bandHeight = minDim * BAND_FRACTION;
      bandCenterY = h / 2;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      band.setAttribute("x", "0");
      band.setAttribute("y", `${bandCenterY - bandHeight / 2}`);
      band.setAttribute("width", `${w}`);
      band.setAttribute("height", `${bandHeight}`);
    };

    // exact zigzag vertices: straight spans between alternating extremes,
    // vertex n sits at screenX = centerX + spanWidth * (n - u), y alternates
    // -amplitude / +amplitude by n's parity — the true engineering shape,
    // not a sampled approximation.
    const render = (u: number, kick: number) => {
      const centerX = w / 2;
      const half = VISIBLE_SPANS / 2;
      const nMin = Math.floor(u - half) - 2;
      const nMax = Math.ceil(u + half) + 2;
      const pts: string[] = [];
      for (let n = nMin; n <= nMax; n++) {
        const x = centerX + spanWidth * (n - u);
        const y = bandCenterY + amplitude * (n % 2 === 0 ? -1 : 1) + kick;
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      wire.setAttribute("points", pts.join(" "));
      const contactY = bandCenterY + amplitude * triWave(u) + kick;
      marker.setAttribute("cy", `${contactY.toFixed(2)}`);
      marker.setAttribute("cx", `${centerX.toFixed(2)}`);
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized) return;
      const elapsed = now - originTime;
      const u = elapsed / SPAN_MS;
      let kick = 0;
      if (arcStart != null) {
        const p = Math.min(1, (now - arcStart) / ARC_MS);
        kick = ARC_KICK_PX * Math.sin(Math.PI * p);
      }
      render(u, kick);
      raf = requestAnimationFrame(loop);
    };

    // measures the container and, once sized, (re)activates whatever isn't
    // already running — the rAF loop and the arc scheduler. Safe to call
    // repeatedly (from resize, from the font-ready settle, from IO resume):
    // it's idempotent whenever the loop/scheduler are already live.
    const activate = () => {
      measure();
      if (!sized) return; // will retry on the next resize/IO callback
      if (originTime === 0) originTime = performance.now();
      if (reduced) {
        // dead-centre, maximum contact margin — the "everything is fine"
        // frame, never a stagger extreme and never mid-arc.
        render(0.5, 0);
        return;
      }
      if (visible && !raf) raf = requestAnimationFrame(loop);
      if (visible) scheduleArc();
    };

    activate();

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        activate();
      }, 80);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) {
        activate();
      } else {
        cancelArcSchedule(); // don't keep announcing arcs nobody can see
      }
    });
    io.observe(root);

    document.fonts.ready.then(() => {
      if (!disposed) onResize();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      cancelArcSchedule();
      window.clearTimeout(arcEndTimer);
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, quality, minArcIntervalMs, maxArcIntervalMs]);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={label}
      className={`relative h-full w-full ${className}`}
    >
      <svg
        ref={svgRef}
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none block h-full w-full"
      >
        <defs>
          <filter id="ccs-arc-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor="var(--foreground)" floodOpacity="0.9" />
          </filter>
        </defs>

        {/* strip band — fixed reference, the zigzag must stay inside it */}
        <rect
          ref={bandRef}
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity={0.28}
          strokeWidth={1}
        />

        {/* contact wire — exact zigzag polyline, span-by-span alternation.
            An arc flash reads through WEIGHT (stroke bumps up), not colour —
            the glow filter is secondary polish, never the sole signal, so
            it still reads against a light card. */}
        <polyline
          ref={wireRef}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={arcing ? WIRE_WIDTH_ARC : WIRE_WIDTH}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{
            filter: arcing ? "url(#ccs-arc-glow)" : "none",
            opacity: arcing ? 1 : 0.85,
            transition: "opacity 60ms linear, stroke-width 40ms ease-out",
          }}
        />

        {/* contact marker — the one followable thing, riding the wire's
            lateral value at the pantograph's fixed position. Starts off the
            visible canvas until the first measured frame writes real
            coordinates, so there's never a stray dot at the SVG origin. */}
        <circle
          ref={markerRef}
          cx={-999}
          cy={-999}
          r={arcing ? MARKER_R_ARC : MARKER_R}
          fill="var(--foreground)"
          style={{
            filter: arcing ? "url(#ccs-arc-glow)" : "none",
            transition: "r 80ms ease-out",
          }}
        />
      </svg>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
