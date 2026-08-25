"use client";

// ---------------------------------------------------------------------------
// ShearerAdvance — a "loading more rows" strip for an infinite-scroll or
// virtualised list, built on real longwall coal-mining mechanics rather than
// an invented spinner shape.
//
// A shearer (the small drummed unit) traverses back and forth along a coal
// face, its two rotating drums cutting a slice on every pass. Cut material
// drops onto an armoured face conveyor (the dashed line beneath it), which
// carries it away in one constant direction, independent of the shearer's
// travel direction — exactly like a real AFC. Behind the shearer, hydraulic
// roof supports (the small prop-and-cap glyphs) release from the roof, nose
// forward, and re-set in sequence as the cut passes them, one after another
// in a travelling wave rather than all at once.
//
// The mapping onto the UI concept: the shearer's traverse across the face IS
// the fetch in flight; the conveyor carrying material away IS the response
// data moving into the list; the supports advancing behind it IS the list
// growing, one row taking its turn after another rather than the whole list
// updating at once. `loading` keeps the face working; `exhausted` parks the
// machine — a longwall panel that has been fully worked, not a machine that
// broke or a wheel that spins forever implying infinite content.
//
// House idiom: colors are read directly as `var(--token)` in SVG
// presentation attributes (the same convention loader-thread-spool uses) —
// SVG supports custom-property references natively, so no
// getComputedStyle/MutationObserver token pipeline is needed here the way a
// <canvas> component would require. One mount-time rAF loop writes transform
// attributes directly to a handful of refs every frame (never React state
// per frame); geometry that only changes on resize goes through normal
// React state instead. The loop pauses via IntersectionObserver (offscreen)
// and `visibilitychange` (hidden tab), matching every other ambient
// component in the registry.
// ---------------------------------------------------------------------------

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const N_SUPPORTS = 7;
const LEG_MS = 2400; // time for one traverse of the face, one direction
const CYCLE_MS = LEG_MS * 2; // full back-and-forth pass
const DRUM_REV_MS = 620; // one drum revolution
const CONVEYOR_CYCLE_MS = 900; // time for the AFC dash pattern to repeat
// half-width (in leg-fraction units) of the window around a support's cross
// point during which it's mid-advance. Wide enough that several supports
// (spacing 1/N_SUPPORTS ~= 0.143) overlap at any instant — the row reads as
// a phase-lagged wave with multiple supports at different stages, not one
// dot hopping down the line.
const BUMP_WINDOW = 0.22;
const DY_MAX = 4; // px a support's cap drops off the roof while advancing
const DX_MAX = 2.5; // px a support noses forward while advancing
const STATIC_TIME_MS = 1650; // reduced-motion freeze frame, mid-leg, staggered supports

function triangleWave(t: number, period: number): number {
  const x = (t % period) / period;
  return x < 0.5 ? x * 2 : 2 - x * 2;
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

interface Frame {
  u: number; // 0-1 shearer position along the face
  drumDeg: number;
  conveyorOffset: number;
  supports: { dx: number; dy: number }[]; // length N_SUPPORTS
}

// A support's advance is staged, not a single blended nod: lower (cap drops
// off the roofline) -> step (noses forward at full drop) -> reset (cap
// re-seats). `n` is the support's own progress through its pulse window,
// 0 at entry, 1 at exit — directly derived from elapsed leg time, so the
// three stages always play in that order as the shearer's pass reaches it.
function supportOffset(n: number, stepSign: number): { dx: number; dy: number } {
  if (n <= 0 || n >= 1) return { dx: 0, dy: 0 };
  if (n < 1 / 3) {
    return { dx: 0, dy: DY_MAX * smoothstep(n / (1 / 3)) };
  }
  if (n < 2 / 3) {
    return { dx: DX_MAX * stepSign * smoothstep((n - 1 / 3) / (1 / 3)), dy: DY_MAX };
  }
  const local = (n - 2 / 3) / (1 / 3);
  return {
    dx: DX_MAX * stepSign * (1 - smoothstep(local)),
    dy: DY_MAX * (1 - smoothstep(local)),
  };
}

function computeFrame(tMs: number): Frame {
  const inRightLeg = tMs % CYCLE_MS < LEG_MS;
  const u = triangleWave(tMs, CYCLE_MS);
  const legProgress = inRightLeg ? u : 1 - u;
  const stepSign = inRightLeg ? 1 : -1;

  const supports = Array.from({ length: N_SUPPORTS }, (_, i) => {
    const p = (i + 0.5) / N_SUPPORTS;
    const crossFrac = inRightLeg ? p : 1 - p;
    const d = legProgress - crossFrac;
    if (Math.abs(d) > BUMP_WINDOW) return { dx: 0, dy: 0 };
    const n = (d + BUMP_WINDOW) / (2 * BUMP_WINDOW); // 0 entering the window -> 1 leaving it
    return supportOffset(n, stepSign);
  });

  return {
    u,
    drumDeg: ((tMs / DRUM_REV_MS) * 360) % 360,
    conveyorOffset: ((tMs / CONVEYOR_CYCLE_MS) * -16) % 8,
    supports,
  };
}

// shared geometry so the rAF paint step and the static JSX layout never
// disagree about where the shearer body/drums sit
function getGeometry(w: number, h: number) {
  const margin = Math.max(12, h * 0.35);
  const faceLeft = margin;
  const faceWidth = Math.max(0, w - margin * 2);
  const bodyW = Math.min(26, faceWidth * 0.2);
  return { margin, faceLeft, faceWidth, bodyW };
}

// parked geometry for the terminal "no more rows" state: shearer at the end
// of the worked-out panel, drums stopped, every support fully re-set, AFC
// still (nothing left to carry)
const PARKED_FRAME: Frame = {
  u: 1,
  drumDeg: 0,
  conveyorOffset: 0,
  supports: Array.from({ length: N_SUPPORTS }, () => ({ dx: 0, dy: 0 })),
};

export interface ShearerAdvanceProps {
  /** true while more rows are being fetched; the face keeps working while true. Default true. */
  loading?: boolean;
  /** true once the list has no more rows; parks the machine and stops the conveyor. Default false. */
  exhausted?: boolean;
  /** accessible label override; defaults to a message describing loading/exhausted state. */
  "aria-label"?: string;
  /** strip height in px. Default 40; drum/cap geometry scales down with it (not visually verified below ~28px in this build). */
  height?: number;
  className?: string;
}

export function ShearerAdvance({
  loading = true,
  exhausted = false,
  "aria-label": ariaLabel,
  height = 40,
  className = "",
}: ShearerAdvanceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const shearerRef = useRef<SVGGElement>(null);
  const drumARef = useRef<SVGGElement>(null);
  const drumBRef = useRef<SVGGElement>(null);
  const conveyorRef = useRef<SVGLineElement>(null);
  const supportOuterRefs = useRef<(SVGGElement | null)[]>([]);
  const supportPropRefs = useRef<(SVGLineElement | null)[]>([]);
  const supportCapRefs = useRef<(SVGLineElement | null)[]>([]);

  // width from ResizeObserver, geometry-affecting so it goes through state
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const active = loading && !exhausted && !reducedMotion;
  const roofY = Math.max(4, height * 0.12);
  const conveyorY = height - 6;

  const paint = (frame: Frame, w: number) => {
    const { faceLeft, faceWidth, bodyW } = getGeometry(w, height);
    const cx = faceLeft + frame.u * faceWidth;

    if (shearerRef.current) {
      shearerRef.current.style.transform = `translateX(${(cx - bodyW / 2).toFixed(2)}px)`;
    }
    if (drumARef.current) drumARef.current.style.transform = `rotate(${frame.drumDeg}deg)`;
    if (drumBRef.current) drumBRef.current.style.transform = `rotate(${(-frame.drumDeg).toFixed(2)}deg)`;
    if (conveyorRef.current) conveyorRef.current.style.strokeDashoffset = `${frame.conveyorOffset}`;

    for (let i = 0; i < N_SUPPORTS; i++) {
      const outer = supportOuterRefs.current[i];
      const prop = supportPropRefs.current[i];
      const cap = supportCapRefs.current[i];
      const s = frame.supports[i];
      // dy shortens the prop from the top and carries the cap with it, so
      // the cap detaches from the roof and re-seats flush on it rather than
      // floating free of its own prop; dx (the "step") moves prop+cap
      // together via the outer group.
      const y = roofY + s.dy;
      if (outer) outer.style.transform = `translateX(${s.dx.toFixed(2)}px)`;
      if (prop) prop.setAttribute("y1", y.toFixed(2));
      if (cap) {
        cap.setAttribute("y1", y.toFixed(2));
        cap.setAttribute("y2", y.toFixed(2));
      }
    }
  };

  // static states: exhausted (parked), reduced motion, or simply not
  // currently loading — every non-live state gets a deliberately-chosen
  // full paint, never a leftover mid-motion frame from before the loop
  // stopped.
  useEffect(() => {
    if (width <= 0 || active) return;
    paint(exhausted ? PARKED_FRAME : computeFrame(STATIC_TIME_MS), width);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, exhausted, width, height]);

  // live rAF loop: only while actually loading, not exhausted, motion allowed
  useEffect(() => {
    if (!active || width <= 0) return;
    const root = rootRef.current;
    if (!root) return;

    let raf = 0;
    let running = true;
    const start = performance.now();

    const tick = (now: number) => {
      if (!running) return;
      paint(computeFrame(now - start), width);
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        if (visible && !document.hidden) {
          if (!raf) raf = requestAnimationFrame(tick);
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVisibility = () => {
      if (document.hidden && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!document.hidden && !raf) {
        raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, width, height]);

  const statusText =
    ariaLabel ??
    (exhausted ? "No more rows to load" : "Loading more rows");

  const capW = 8;
  const propBottom = height - 6;

  return (
    <div
      ref={rootRef}
      role="status"
      aria-busy={loading && !exhausted}
      aria-label={statusText}
      className={`w-full select-none ${className}`}
      style={{ height }}
    >
      <span className="sr-only">{statusText}</span>
      {width > 0 && (
        <svg
          data-shearer-advance-svg
          width={width}
          height={height}
          aria-hidden
          className="block overflow-visible"
        >
          {/* roofline — structural boundary, not machinery */}
          <line
            x1={4}
            y1={roofY}
            x2={width - 4}
            y2={roofY}
            stroke="var(--border)"
            strokeWidth={1}
          />

          {/* armoured face conveyor: carries cut material away, one constant
              direction, independent of the shearer's travel direction */}
          <line
            ref={conveyorRef}
            x1={4}
            y1={conveyorY}
            x2={width - 4}
            y2={conveyorY}
            stroke="var(--foreground)"
            strokeWidth={1.5}
            strokeDasharray="2 6"
            strokeLinecap="round"
          />

          {/* hydraulic roof supports, evenly spaced along the face */}
          {Array.from({ length: N_SUPPORTS }, (_, i) => {
            const { faceLeft, faceWidth } = getGeometry(width, height);
            const p = (i + 0.5) / N_SUPPORTS;
            const sx = faceLeft + p * faceWidth;
            return (
              <g
                key={i}
                ref={(el) => {
                  supportOuterRefs.current[i] = el;
                }}
              >
                {/* prop: shortens from the top (y1 rises/falls in the paint
                    loop) so retracting from the roof reads as the prop
                    itself compressing, not a piece floating loose */}
                <line
                  ref={(el) => {
                    supportPropRefs.current[i] = el;
                  }}
                  x1={sx}
                  y1={roofY}
                  x2={sx}
                  y2={propBottom}
                  stroke="var(--ns-muted)"
                  strokeWidth={1.25}
                />
                {/* cap: always flush with the prop's current top (same y as
                    the prop's y1, written together in the paint loop) */}
                <line
                  ref={(el) => {
                    supportCapRefs.current[i] = el;
                  }}
                  x1={sx - capW / 2}
                  y1={roofY}
                  x2={sx + capW / 2}
                  y2={roofY}
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          {/* the shearer: body + two rotating cutting drums. Drum position is
              baked into their own geometry (cx, transform-origin) rather than
              a `transform="translate(...)"` attribute, because setting
              `style.transform` for the rAF-driven spin would otherwise wipe
              out an attribute-based translate outright — SVG lets a CSS
              transform fully replace the presentation-attribute one. */}
          <g ref={shearerRef}>
            {(() => {
              const { bodyW } = getGeometry(width, height);
              const drumBX = bodyW - 3;
              return (
                <>
                  <rect
                    x={0}
                    y={height / 2 - 5}
                    width={bodyW}
                    height={10}
                    rx={2}
                    fill="var(--background)"
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                  />
                  <g ref={drumARef} style={{ transformOrigin: "3px center" }}>
                    <circle cx={3} cy={height / 2} r={5} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.5} />
                    <line x1={3} y1={height / 2} x2={7.5} y2={height / 2} stroke="var(--foreground)" strokeWidth={1.25} />
                  </g>
                  <g ref={drumBRef} style={{ transformOrigin: `${drumBX}px center` }}>
                    <circle cx={drumBX} cy={height / 2} r={5} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.5} />
                    <line x1={drumBX} y1={height / 2} x2={drumBX + 4.5} y2={height / 2} stroke="var(--foreground)" strokeWidth={1.25} />
                  </g>
                </>
              );
            })()}
          </g>

          {/* end-of-panel stop, only meaningful (and only drawn) once the
              face has actually been worked out */}
          {exhausted && (
            <line
              x1={width - 4}
              y1={roofY}
              x2={width - 4}
              y2={conveyorY}
              stroke="var(--ns-muted)"
              strokeWidth={2}
            />
          )}
        </svg>
      )}
    </div>
  );
}
