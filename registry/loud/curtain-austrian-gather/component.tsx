"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// CurtainAustrianGather — a full-bleed route curtain modeled on a real
// Austrian (brail) drape: unlike a traveler (parts horizontally,
// curtain-traveler-draw) or a tab curtain (peels diagonally,
// curtain-tab-diagonal), an Austrian drape rides on PARALLEL VERTICAL LIFT
// LINES and hoists bottom-up. Because the fabric carries ~100% sewn-in
// fullness, it does not slide flat as the lines rise — it gathers into a
// row of scalloped SWAGS along the hem, one swag per lift-line span, each
// swag's belly deepening and its silhouette compressing upward as the
// drape hoists. That festooned bottom edge, not a straight parting line,
// is the whole point of the mechanic.
//
// Substrate: SVG. Each swag is one closed path — a straight top edge
// pinned to the header track, two vertical sides riding its bounding lift
// lines, and a cubic-bezier belly for the scallop — filled with a per-swag
// horizontal gradient so the gather reads as shaded fabric, not a flat
// festoon shape. (--border is a separator token, ~1.1:1 against
// --background in light theme — unusable as fabric ink. Fold/scallop form
// is carried in VALUE against --ns-muted's fabric body instead: a
// --foreground-tinted shadow gradient and a --background-tinted highlight
// gradient per swag, layered as partial opacity, never --border.)
//
// The resting (closed) state already breathes: every swag's belly depth
// rides its own slow sine, independently phase-offset from its neighbours,
// so individual scallops deepen and relax at rest — not a whole-panel
// opacity or scale pulse. The gradient crease inside each swag breathes on
// its own offset phase too, the same "rewrite the gradient stops every
// frame" idiom curtain-traveler-draw uses for its pleats. Lifting runs a
// single rAF timeline that eases every lift-line's hem height upward
// together, with a small end-of-travel settle (rope give snapping the
// drape into its batten) and a swag belly that grows dramatically deeper
// as the shrinking panel bunches fabric toward the header.
//
// Colors come only from --ns-muted (fabric body), --foreground (shadow
// side, rope lines) and --background (highlight side, plus the backing
// "revealed page" rect), read once via getComputedStyle(document
// .documentElement) and re-read on a MutationObserver watching
// documentElement's class — no hex or rgb() literals anywhere in the draw
// code. --ns-accent never touches the fabric; it only tints the optional
// "skip curtain" trigger button.

export interface CurtainAustrianGatherProps {
  /** Called once the lift animation (or reduced-motion hard cut) completes. */
  onLiftComplete?: () => void;
  /** Freezes the idle breathing and any in-flight lift at its current frame. */
  paused?: boolean;
  className?: string;
}

type Tokens = {
  muted: string;
  foreground: string;
  background: string;
};

const VW = 1600;
const VH = 900;
const TRACK_Y = 20;
const TRACK_H = 10;

const SWAGS = 7;
const LIFT_LINES = SWAGS + 1;

const REST_HEM_Y = VH - 60; // 840 — drape hangs low, nearly full-bleed at rest
const LIFT_HEM_Y = 170; // hoisted hem, bunched tight beneath the header

const REST_SWAG_DEPTH = 48; // px belly droop below the hem line, at rest — visible festoon, not a flat hem
const LIFT_SWAG_DEPTH = 110; // px belly droop, fully hoisted — dramatic gather

const LIFT_MS = 600; // verify.ts's gate waits 700ms after the click — finish comfortably inside that
const SETTLE_OVERSHOOT = 0.06; // fraction of travel the rope gives past rest, then snaps back

const BREATH_PERIOD_MS = 4300;
const BREATH_AMP_FRAC = 0.4; // fraction of current belly depth, min-floored below

// A dedicated marker, not the full backing rect: its centre is a point we
// control (well clear of every lift line and comfortably inside the region
// the swags vacate once hoisted), rather than the worst-case centre of a
// full-viewBox rect that the fabric happens to cover last.
const MARKER_W = 160;
const MARKER_H = 48;
const MARKER_Y = VH * 0.55; // below LIFT_HEM_Y + LIFT_SWAG_DEPTH + breath headroom, above REST_HEM_Y

function easeRise(t: number): number {
  // f(1) = 1 exactly — a small overshoot (rope give at full hoist, then a
  // snap into the batten) lives entirely inside [0,1], so it settles back
  // to the exact hoisted height without extending duration.
  const c1 = SETTLE_OVERSHOOT * 2.6;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}

function lineX(i: number): number {
  return (i / SWAGS) * VW;
}

type StopRefs = {
  base0: SVGStopElement | null;
  hiIn: SVGStopElement | null;
  hiPeak: SVGStopElement | null;
  shPeak: SVGStopElement | null;
  shOut: SVGStopElement | null;
  base1: SVGStopElement | null;
};

function emptyStopRefs(): StopRefs {
  return { base0: null, hiIn: null, hiPeak: null, shPeak: null, shOut: null, base1: null };
}

export function CurtainAustrianGather({ onLiftComplete, paused = false, className = "" }: CurtainAustrianGatherProps) {
  const uid = useId().replace(/[:]/g, "");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const swagBaseRefs = useRef<(SVGPathElement | null)[]>(Array.from({ length: SWAGS }, () => null));
  const swagPathRefs = useRef<(SVGPathElement | null)[]>(Array.from({ length: SWAGS }, () => null));
  const stopRefs = useRef<StopRefs[]>(Array.from({ length: SWAGS }, emptyStopRefs));
  const ropeRefs = useRef<(SVGLineElement | null)[]>(Array.from({ length: LIFT_LINES }, () => null));
  const trackRef = useRef<SVGRectElement | null>(null);
  const bgRectRef = useRef<SVGRectElement | null>(null);
  const markerRef = useRef<SVGRectElement | null>(null);

  // No hardcoded fallback palette: a hex default here would be the light-
  // theme value baked in, so a dark-theme visitor could see one wrong-
  // polarity frame before the real read lands. Null until derive() runs,
  // and derive() runs in a layout effect (before the browser's first
  // paint), not a passive effect, so that frame never actually happens.
  const tokensRef = useRef<Tokens | null>(null);

  const [open, setOpen] = useState(false);
  const [lifting, setLifting] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);

  const liftStartRef = useRef<number | null>(null);
  const elapsedRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const rafRef = useRef<number | undefined>(undefined);
  const pausedRef = useRef(paused);
  const openRef = useRef(false);
  const liftingRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // --- token read + re-read on theme flip ------------------------------
  const applyStaticColors = () => {
    const t = tokensRef.current;
    if (!t) return;
    // --border is a separator token (~1.1:1 against --background in light
    // theme) — unusable as fabric ink. The scallop's form is modelled in
    // VALUE against the --ns-muted body instead: shadow shades toward
    // --foreground, highlight toward --background, both layered as
    // partial opacity over the opaque muted base so it reads in both
    // polarities. Ropes are thin --foreground strokes.
    if (trackRef.current) trackRef.current.setAttribute("fill", t.muted);
    if (bgRectRef.current) bgRectRef.current.setAttribute("fill", t.background);
    if (markerRef.current) markerRef.current.setAttribute("fill", t.muted);
    for (const base of swagBaseRefs.current) base?.setAttribute("fill", t.muted);
    for (const rope of ropeRefs.current) rope?.setAttribute("stroke", t.foreground);
    for (const refs of stopRefs.current) {
      refs.base0?.setAttribute("stop-color", t.muted);
      refs.base1?.setAttribute("stop-color", t.muted);
      refs.hiIn?.setAttribute("stop-color", t.background);
      refs.hiPeak?.setAttribute("stop-color", t.background);
      refs.shPeak?.setAttribute("stop-color", t.foreground);
      refs.shOut?.setAttribute("stop-color", t.foreground);
    }
  };

  // useLayoutEffect, not useEffect: runs before the browser's first paint,
  // so the fabric never has a frame to render in the wrong theme's colors
  // before the token read lands — no hardcoded fallback palette needed.
  useLayoutEffect(() => {
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      const read = (name: string) => cs.getPropertyValue(name).trim();
      tokensRef.current = {
        muted: read("--ns-muted"),
        foreground: read("--foreground"),
        background: read("--background"),
      };
      applyStaticColors();
    };
    derive();
    const mo = new MutationObserver(derive);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, [mounted]);

  /** Belly path for swag i between lift lines i and i+1, at hem heights
   *  (yL, yR) and additional droop depth `depth` beyond their average. */
  const swagPath = (i: number, yL: number, yR: number, depth: number): string => {
    const x0 = lineX(i);
    const x1 = lineX(i + 1);
    const midY = (yL + yR) / 2 + depth;
    const c1x = x0 + (x1 - x0) / 3;
    const c2x = x0 + ((x1 - x0) * 2) / 3;
    return (
      `M ${x0} ${TRACK_Y} L ${x1} ${TRACK_Y} L ${x1} ${yR} ` +
      `C ${c2x} ${midY} ${c1x} ${midY} ${x0} ${yL} Z`
    );
  };

  // --- draw one frame (refs-only, no React state on the hot path) -------
  const draw = (elapsedMs: number) => {
    const breathPhaseBase = (elapsedMs / BREATH_PERIOD_MS) * Math.PI * 2;

    let progress = 0; // 0 = closed/lowered, 1 = fully hoisted (may briefly exceed 1: rope give)
    if (liftStartRef.current !== null) {
      // Clamped on both ends: the reduced-motion hard cut seeds
      // liftStartRef in the past (peakElapsed - LIFT_MS) so this same
      // draw() call lands exactly at frac=1, but if reduced motion later
      // toggles off mid-open, elapsedMs restarts near 0 — an unclamped
      // low end would read as negative frac and drop the curtain back
      // closed with the trigger button already unmounted.
      const frac = Math.max(0, Math.min(1, (elapsedMs - liftStartRef.current) / LIFT_MS));
      progress = openRef.current ? 1 : easeRise(frac);
      if (frac >= 1 && !openRef.current) {
        openRef.current = true;
        liftingRef.current = false;
        setOpen(true);
        setLifting(false);
        onLiftComplete?.();
      }
    }
    const clamped = Math.max(0, Math.min(1, progress));

    const hemYs: number[] = [];
    for (let i = 0; i < LIFT_LINES; i++) {
      // Slight per-line stagger so the hoist reads as several ropes
      // gathering together rather than one perfectly rigid batten.
      const stagger = ((i % 3) - 1) * 0.035;
      const local = Math.max(0, Math.min(1, progress + stagger * clamped));
      hemYs.push(REST_HEM_Y + (LIFT_HEM_Y - REST_HEM_Y) * local);
      const rope = ropeRefs.current[i];
      if (rope) {
        rope.setAttribute("x1", String(lineX(i)));
        rope.setAttribute("x2", String(lineX(i)));
        rope.setAttribute("y1", String(TRACK_Y));
        rope.setAttribute("y2", String(hemYs[i]));
      }
    }

    const depthBase = REST_SWAG_DEPTH + (LIFT_SWAG_DEPTH - REST_SWAG_DEPTH) * clamped;
    const breathAmpPx = Math.max(8, depthBase * BREATH_AMP_FRAC);

    for (let i = 0; i < SWAGS; i++) {
      const depthPhase = breathPhaseBase + i * 0.53;
      const depth = depthBase + breathAmpPx * Math.sin(depthPhase);
      const d = swagPath(i, hemYs[i], hemYs[i + 1], depth);
      // Opaque base first, gradient overlay second: the gradient dips to
      // near-zero opacity at its crease by design (that's what lets the
      // highlight/shadow band read as a real fold, not a flat wash), which
      // would otherwise leak whatever sits behind the fabric — the track,
      // ropes, and the gate's open-state marker — straight through at
      // every crease, at every height, not just at the hem.
      const base = swagBaseRefs.current[i];
      if (base) base.setAttribute("d", d);
      const path = swagPathRefs.current[i];
      if (path) path.setAttribute("d", d);

      // Same "rewrite the gradient stops every frame" idiom as
      // curtain-traveler-draw's pleats, on its own phase offset per swag
      // so the shaded crease shifts independently of the belly droop.
      const creasePhase = depthPhase + 1.1;
      const crease = 0.5 + 0.08 * Math.sin(creasePhase);
      const refs = stopRefs.current[i];
      refs?.hiIn?.setAttribute("offset", String(crease - 0.22));
      refs?.hiPeak?.setAttribute("offset", String(crease - 0.03));
      refs?.shPeak?.setAttribute("offset", String(crease + 0.03));
      refs?.shOut?.setAttribute("offset", String(crease + 0.22));
    }
  };

  // --- reduced motion: one static peak-amplitude frame, no rAF ----------
  useEffect(() => {
    if (!mounted || !reduced) return;
    // Freeze at a quarter-period so the breathing sine sits at its peak,
    // not the flat t=0 zero-crossing — swags read as gathered fabric with
    // real belly depth, not flat panels.
    draw(BREATH_PERIOD_MS / 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, reduced]);

  // --- normal continuous rAF loop: unconditional idle breathing + lift --
  useEffect(() => {
    if (!mounted || reduced) return;
    lastTsRef.current = performance.now();
    elapsedRef.current = 0;

    const loop = (ts: number) => {
      if (!pausedRef.current) {
        elapsedRef.current += ts - lastTsRef.current;
        draw(elapsedRef.current);
      }
      lastTsRef.current = ts;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, reduced]);

  const handleTrigger = () => {
    if (openRef.current || liftingRef.current) return;
    if (reduced) {
      // Hard cut, no tween: jump straight to the hoisted geometry at the
      // same quarter-period breathing PEAK the resting frozen frame uses,
      // by reusing draw() itself (same stagger, same per-swag belly and
      // crease phases) rather than duplicating a flattened, uniform-depth
      // version that would lose the scallop read entirely.
      const peakElapsed = BREATH_PERIOD_MS / 4;
      liftStartRef.current = peakElapsed - LIFT_MS;
      draw(peakElapsed);
      return;
    }
    liftingRef.current = true;
    setLifting(true);
    liftStartRef.current = elapsedRef.current;
  };

  const gid = (i: number) => `${uid}-swag-${i}`;

  const renderGradients = () =>
    Array.from({ length: SWAGS }, (_, i) => (
      <linearGradient key={gid(i)} id={gid(i)} x1={lineX(i)} y1="0" x2={lineX(i + 1)} y2="0" gradientUnits="userSpaceOnUse">
        <stop
          offset="0"
          ref={(el) => {
            stopRefs.current[i].base0 = el;
          }}
        />
        <stop
          offset="0.28"
          stopOpacity="0"
          ref={(el) => {
            stopRefs.current[i].hiIn = el;
          }}
        />
        <stop
          offset="0.47"
          stopOpacity="0.5"
          ref={(el) => {
            stopRefs.current[i].hiPeak = el;
          }}
        />
        <stop
          offset="0.53"
          stopOpacity="0.45"
          ref={(el) => {
            stopRefs.current[i].shPeak = el;
          }}
        />
        <stop
          offset="0.72"
          stopOpacity="0"
          ref={(el) => {
            stopRefs.current[i].shOut = el;
          }}
        />
        <stop
          offset="1"
          ref={(el) => {
            stopRefs.current[i].base1 = el;
          }}
        />
      </linearGradient>
    ));

  const renderSwags = () =>
    Array.from({ length: SWAGS }, (_, i) => (
      <g key={i}>
        <path
          ref={(el) => {
            swagBaseRefs.current[i] = el;
          }}
          d={swagPath(i, REST_HEM_Y, REST_HEM_Y, REST_SWAG_DEPTH)}
        />
        <path
          ref={(el) => {
            swagPathRefs.current[i] = el;
          }}
          d={swagPath(i, REST_HEM_Y, REST_HEM_Y, REST_SWAG_DEPTH)}
          fill={`url(#${gid(i)})`}
        />
      </g>
    ));

  const renderRopes = () =>
    Array.from({ length: LIFT_LINES }, (_, i) => (
      <line
        key={i}
        ref={(el) => {
          ropeRefs.current[i] = el;
        }}
        x1={lineX(i)}
        y1={TRACK_Y}
        x2={lineX(i)}
        y2={REST_HEM_Y}
        strokeWidth={2}
        opacity={0.4}
      />
    ));

  const showButton = !open;

  return (
    <div
      ref={rootRef}
      className={`absolute inset-0 overflow-hidden ${className}`}
      role={open ? undefined : "status"}
      aria-live={open ? undefined : "polite"}
      aria-hidden={open ? "true" : undefined}
    >
      {!open ? <span className="sr-only">Loading</span> : null}
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" className="block h-full w-full" aria-hidden="true" focusable="false">
        <defs>{renderGradients()}</defs>
        <rect ref={bgRectRef} x={0} y={0} width={VW} height={VH} />
        {/* Dedicated open-state marker, covered by the fabric at rest and
            exposed once every lift line has risen clear of it — its centre
            is a point we control, not the worst-case centre of the full
            backing rect. */}
        <rect
          data-curtain-open
          ref={markerRef}
          x={VW / 2 - MARKER_W / 2}
          y={MARKER_Y - MARKER_H / 2}
          width={MARKER_W}
          height={MARKER_H}
          rx={4}
        />
        <rect ref={trackRef} x={0} y={TRACK_Y - TRACK_H / 2} width={VW} height={TRACK_H} />
        {renderRopes()}
        {renderSwags()}
      </svg>
      {showButton ? (
        <button
          type="button"
          data-curtain-trigger
          onClick={handleTrigger}
          disabled={lifting}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 inline-flex items-center rounded-sm bg-ns-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:opacity-60 disabled:pointer-events-none"
        >
          Skip curtain
        </button>
      ) : null}
    </div>
  );
}
