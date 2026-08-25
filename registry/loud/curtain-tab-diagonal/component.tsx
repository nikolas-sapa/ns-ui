"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// CurtainTabDiagonal — a full-bleed route curtain modeled on a real
// theatrical TAB (tableau/opera-drape) curtain, not a traveler. A traveler
// parts on a corded track, sideways. A tab curtain instead sews a line of
// rings on the diagonal from the panel's center-meeting bottom corner up to
// a fixed tie-off point roughly a third of the way up the panel on the wing
// side; hauling that line draws ONLY that corner up and out toward the
// tie-off, along a curved path, while the wing-side bottom corner and the
// entire top edge never move — the rest of the hem interpolates between the
// two, so the panel gathers into a genuine diagonal swag rather than a
// uniform squash. Once the swag is fully gathered against its tie-off, the
// whole panel retracts offscreen (a plain translateX, same clearance
// distance as a traveler) — lift-then-slide, not a pure slide, and a
// different choreography axis from curtain-traveler-draw's horizontal
// corded parting throughout.
//
// Geometry: each panel is built from PLEATS+1 boundary x-positions (the
// same cursor-accumulated widths a traveler uses). Boundary j owns a
// "reach" r_j — 0 at the wing edge (never moves), 1 at the center-meeting
// edge (travels the full arc to the tie-off) — and every pleat quad is a
// path whose top two vertices are pinned at y=0 and whose bottom two
// vertices are that boundary's lifted point. The lift itself is a
// quadratic Bezier from the boundary's rest position to a per-boundary
// target that is r_j of the way toward the tie-off, through a control point
// bowed toward the viewer — so the corner's path is a real arc, and because
// the Bezier parameter itself runs through an overshoot easing, the corner
// briefly overshoots its tie-off and settles, the hoist-rope-going-taut
// bounce. An opaque --ns-muted envelope path sits behind the pleat quads in
// each group so the gradients' partially-transparent bands composite over
// fabric, never over the page.
//
// Pleats are shaded path geometry exactly like the traveler build: a
// --foreground-tinted shadow gradient and a --background-tinted highlight
// gradient per fold, layered as partial opacity over the opaque --ns-muted
// fabric body, hard-stopped at the crease. (--border is a separator token,
// ~1.1:1 against --background in light theme — unusable as fabric ink; the
// fold's form lives in value against --foreground/--background instead.)
//
// The idle sway is unconditional — even fully closed, every pleat's crease
// line breathes ±8% of its own gradient-space width on a slow ~4s sine,
// independently phase-offset per fold (not a whole-panel opacity pulse).
//
// Colors come only from --ns-muted (fabric body), --foreground (shadow
// side) and --background (highlight side, plus the backing "blocked page"
// rect), read once via getComputedStyle(document.documentElement) and
// re-read on a MutationObserver watching documentElement's class — no hex
// or rgb() literals anywhere in the draw code. --ns-accent never touches
// the fabric; it only tints the optional "skip curtain" trigger button.

export interface CurtainTabDiagonalProps {
  /** Called once the haul-open animation (or reduced-motion hard cut) completes. */
  onOpenComplete?: () => void;
  /** Freezes the idle sway and any in-flight haul at its current frame. */
  paused?: boolean;
  className?: string;
}

type Tokens = {
  muted: string;
  foreground: string;
  background: string;
};

type Pt = { x: number; y: number };

const VW = 1600;
const VH = 900;
const CENTER = VW / 2;
const OVERLAP = 150; // px each panel's inner edge extends past center at rest
const OUTSET = 220; // px each panel's outer edge extends past the viewBox at rest
const OPEN_TX = VW + OUTSET + 120; // translateX distance to clear the panel fully offscreen
const PLEATS = 10;
const DRAW_MS = 760;
// Fraction of DRAW_MS spent gathering the corner to its tie-off in place,
// before the retract-offscreen slide begins.
const GATHER_FRAC = 0.55;
// The tie-off point sits roughly a third of the way up the panel: the
// bottom-inner corner rises by VH/3, ending at y = (2/3)*VH.
const ANCHOR_Y = VH * (2 / 3);
const ANCHOR_INSET = 40; // px in from the wing edge
const LEFT_ANCHOR_X = -OUTSET + ANCHOR_INSET;
const RIGHT_ANCHOR_X = VW + OUTSET - ANCHOR_INSET;
const BOW_MAX = 90; // px the arc's control point bows toward the viewer at full reach
const BREATH_PERIOD_MS = 4000;
const BREATH_AMP = 0.08; // ±8% of a pleat's own gradient-space width
const TRACK_HALF_W = 150;
const TRACK_Y = 20;
const TRACK_H = 10;
// The gate target: a marker centered on the stage, at mid-height, well
// below the rod. Both panels cover it at rest (their envelopes span the
// full VH height across the full combined width); once gathered and
// retracted fully offscreen, nothing paints over it. Unlike the rod
// (fixed at TRACK_Y, never covered by fabric that only hangs below it),
// this is genuinely occluded-then-exposed.
const MARKER_W = 160;
const MARKER_H = 48;
const MARKER_Y = VH * 0.5;

const LEFT_X0 = -OUTSET;
const LEFT_X1 = CENTER + OVERLAP;
const RIGHT_X0 = CENTER - OVERLAP;
const RIGHT_X1 = VW + OUTSET;

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutBack(t: number): number {
  // The hoist-rope overshoot as the tab line goes taut — f(1) = 1 exactly,
  // so it settles back to the resting gathered position.
  const c1 = 0.42;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** The bottom-inner (center-meeting) corner travels the full arc to the
 *  tie-off; the bottom-outer (wing) corner never moves; the rest of the hem
 *  interpolates by reach r, quadratic-Bezier'd through a viewer-bowed
 *  control point so the path is a real curve, not a straight diagonal. The
 *  Bezier parameter t runs through an overshoot easing, so a boundary with
 *  r > 0 briefly overshoots its target and settles — the taut-rope bounce. */
function liftBoundary(x0: number, r: number, anchorX: number, t: number): Pt {
  if (r <= 0) return { x: x0, y: VH };
  const endX = lerp(x0, anchorX, r);
  const endY = lerp(VH, ANCHOR_Y, r);
  const midX = (x0 + endX) / 2;
  const midY = (VH + endY) / 2 - BOW_MAX * r;
  const omt = 1 - t;
  return {
    x: omt * omt * x0 + 2 * omt * t * midX + t * t * endX,
    y: omt * omt * VH + 2 * omt * t * midY + t * t * endY,
  };
}

/** Per-pleat proportional widths for one panel: narrower toward the wing
 *  (tie-off) end, wider toward the center-meeting edge; contrast sharpens
 *  as the panel gathers (fabric bunching tighter toward the tie-off point
 *  under the haul). */
function pleatWeights(side: "left" | "right", gather: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < PLEATS; i++) {
    const frac = i / (PLEATS - 1); // 0 (leftmost) .. 1 (rightmost)
    const gatherLocal = side === "left" ? frac : 1 - frac; // 0 = at wing/tie-off, 1 = at center
    out.push(Math.max(0.3, 1 - gather * 0.55 + gather * 1.1 * gatherLocal));
  }
  return out;
}

/** PLEATS+1 boundary x-positions from x0 to x1, plus each boundary's reach
 *  r (0 at the wing edge, 1 at the center-meeting edge — reversed for the
 *  right panel, whose wing edge is x1). */
function layoutBoundaries(side: "left" | "right", x0: number, x1: number, gather: number) {
  const weights = pleatWeights(side, gather);
  const sum = weights.reduce((a, b) => a + b, 0);
  const panelW = x1 - x0;
  const xs: number[] = [x0];
  let cursor = x0;
  for (const w of weights) {
    cursor += (w / sum) * panelW;
    xs.push(cursor);
  }
  return xs.map((x, j) => ({ x, r: side === "left" ? j / PLEATS : 1 - j / PLEATS }));
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

export function CurtainTabDiagonal({ onOpenComplete, paused = false, className = "" }: CurtainTabDiagonalProps) {
  const uid = useId().replace(/[:]/g, "");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const leftGroupRef = useRef<SVGGElement | null>(null);
  const rightGroupRef = useRef<SVGGElement | null>(null);
  const leftPathRefs = useRef<(SVGPathElement | null)[]>([]);
  const rightPathRefs = useRef<(SVGPathElement | null)[]>([]);
  const leftEnvelopeRef = useRef<SVGPathElement | null>(null);
  const rightEnvelopeRef = useRef<SVGPathElement | null>(null);
  const leftStopRefs = useRef<StopRefs[]>(Array.from({ length: PLEATS }, emptyStopRefs));
  const rightStopRefs = useRef<StopRefs[]>(Array.from({ length: PLEATS }, emptyStopRefs));
  const trackRef = useRef<SVGRectElement | null>(null);
  const markerRef = useRef<SVGRectElement | null>(null);
  const bgRectRef = useRef<SVGRectElement | null>(null);

  // No hardcoded fallback palette: a hex default here would be the light-
  // theme value baked in, so a dark-theme visitor could see one wrong-
  // polarity frame before the real read lands. Null until derive() runs,
  // and derive() runs in a layout effect (before the browser's first
  // paint), not a passive effect, so that frame never actually happens.
  const tokensRef = useRef<Tokens | null>(null);

  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);

  const drawStartRef = useRef<number | null>(null);
  const mountTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const rafRef = useRef<number | undefined>(undefined);
  const pausedRef = useRef(paused);
  const openRef = useRef(false);
  const openingRef = useRef(false);

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
    // theme) — unusable as fabric ink. The fold's form is modelled in VALUE
    // against the --ns-muted body instead: shadow shades toward
    // --foreground, highlight toward --background, both layered as partial
    // opacity over the opaque muted base so it reads in both polarities.
    if (trackRef.current) trackRef.current.setAttribute("fill", t.muted);
    if (markerRef.current) markerRef.current.setAttribute("fill", t.muted);
    if (bgRectRef.current) bgRectRef.current.setAttribute("fill", t.background);
    if (leftEnvelopeRef.current) leftEnvelopeRef.current.setAttribute("fill", t.muted);
    if (rightEnvelopeRef.current) rightEnvelopeRef.current.setAttribute("fill", t.muted);
    for (const refs of [...leftStopRefs.current, ...rightStopRefs.current]) {
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
  // (or the SVG's black initial fill) before the token read lands — no
  // hardcoded fallback palette needed at all.
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

  const paintPath = (el: SVGPathElement | null, xa: number, xb: number, pa: Pt, pb: Pt) => {
    if (!el) return;
    el.setAttribute("d", `M ${xa} 0 L ${xb} 0 L ${pb.x} ${pb.y} L ${pa.x} ${pa.y} Z`);
  };

  const paintEnvelope = (el: SVGPathElement | null, bx0: number, bx1: number, pts: Pt[]) => {
    if (!el) return;
    const rev = [...pts].reverse().map((p) => `L ${p.x} ${p.y}`).join(" ");
    el.setAttribute("d", `M ${bx0} 0 L ${bx1} 0 ${rev} Z`);
  };

  // --- draw one frame (refs-only, no React state on the hot path) -------
  const draw = (elapsedMs: number) => {
    const breathPhaseBase = (elapsedMs / BREATH_PERIOD_MS) * Math.PI * 2;

    let gatherRaw = 0; // 0 = closed, 1 = corner fully hauled to the tie-off point
    let slideT = 0; // 0 = in place, 1 = swag fully retracted offscreen
    if (drawStartRef.current !== null) {
      const frac = clamp01((elapsedMs - drawStartRef.current) / DRAW_MS);
      gatherRaw = clamp01(frac / GATHER_FRAC);
      const slideRaw = clamp01((frac - GATHER_FRAC) / (1 - GATHER_FRAC));
      slideT = easeInOutCubic(slideRaw);
      if (frac >= 1 && !openRef.current) {
        openRef.current = true;
        openingRef.current = false;
        setOpen(true);
        setOpening(false);
        onOpenComplete?.();
      }
    }
    // Overshoot lives in the Bezier parameter itself: a boundary with
    // reach > 0 briefly travels past its tie-off target and settles.
    const bezierT = easeOutBack(gatherRaw);

    const leftBoundaries = layoutBoundaries("left", LEFT_X0, LEFT_X1, gatherRaw);
    const rightBoundaries = layoutBoundaries("right", RIGHT_X0, RIGHT_X1, gatherRaw);

    const paintPanel = (
      side: "left" | "right",
      boundaries: { x: number; r: number }[],
      anchorX: number,
      pathRefs: (SVGPathElement | null)[],
      envelopeRef: SVGPathElement | null,
      stopRefs: StopRefs[],
      groupEl: SVGGElement | null,
      tx: number,
    ) => {
      if (groupEl) groupEl.setAttribute("transform", `translate(${tx} 0)`);
      const lifted = boundaries.map((b) => liftBoundary(b.x, b.r, anchorX, bezierT));
      paintEnvelope(envelopeRef, boundaries[0].x, boundaries[PLEATS].x, lifted);
      for (let i = 0; i < PLEATS; i++) {
        paintPath(pathRefs[i], boundaries[i].x, boundaries[i + 1].x, lifted[i], lifted[i + 1]);
        const phase = breathPhaseBase + i * 0.37 + (side === "right" ? 1.7 : 0);
        const crease = 0.5 + BREATH_AMP * Math.sin(phase);
        const refs = stopRefs[i];
        refs?.hiIn?.setAttribute("offset", String(crease - 0.2));
        refs?.hiPeak?.setAttribute("offset", String(crease - 0.02));
        refs?.shPeak?.setAttribute("offset", String(crease + 0.02));
        refs?.shOut?.setAttribute("offset", String(crease + 0.2));
      }
    };

    paintPanel("left", leftBoundaries, LEFT_ANCHOR_X, leftPathRefs.current, leftEnvelopeRef.current, leftStopRefs.current, leftGroupRef.current, -OPEN_TX * slideT);
    paintPanel("right", rightBoundaries, RIGHT_ANCHOR_X, rightPathRefs.current, rightEnvelopeRef.current, rightStopRefs.current, rightGroupRef.current, OPEN_TX * slideT);
  };

  // --- reduced motion: one static peak-amplitude frame, no rAF ----------
  useEffect(() => {
    if (!mounted || !reduced) return;
    mountTimeRef.current = 0;
    // Freeze at a quarter-period so the breathing sine sits at its peak
    // (+8%), not the flat t=0 zero-crossing — pleats read as real fabric.
    // Only paints the closed frame; handleTrigger paints the open frame
    // directly on click (hard cut, no tween, no re-run of this effect).
    draw(BREATH_PERIOD_MS / 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, reduced]);

  // --- normal continuous rAF loop: unconditional idle sway + haul --------
  useEffect(() => {
    if (!mounted || reduced) return;
    mountTimeRef.current = performance.now();
    lastTsRef.current = mountTimeRef.current;
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
    if (openRef.current || openingRef.current) return;
    if (reduced) {
      // Hard cut, no tween: jump straight to the fully-gathered, fully-
      // retracted geometry (bezierT = 1 exactly — no overshoot on a cut).
      const leftBoundaries = layoutBoundaries("left", LEFT_X0, LEFT_X1, 1);
      const rightBoundaries = layoutBoundaries("right", RIGHT_X0, RIGHT_X1, 1);
      if (leftGroupRef.current) leftGroupRef.current.setAttribute("transform", `translate(${-OPEN_TX} 0)`);
      if (rightGroupRef.current) rightGroupRef.current.setAttribute("transform", `translate(${OPEN_TX} 0)`);
      const liftedLeft = leftBoundaries.map((b) => liftBoundary(b.x, b.r, LEFT_ANCHOR_X, 1));
      const liftedRight = rightBoundaries.map((b) => liftBoundary(b.x, b.r, RIGHT_ANCHOR_X, 1));
      paintEnvelope(leftEnvelopeRef.current, leftBoundaries[0].x, leftBoundaries[PLEATS].x, liftedLeft);
      paintEnvelope(rightEnvelopeRef.current, rightBoundaries[0].x, rightBoundaries[PLEATS].x, liftedRight);
      for (let i = 0; i < PLEATS; i++) {
        paintPath(leftPathRefs.current[i], leftBoundaries[i].x, leftBoundaries[i + 1].x, liftedLeft[i], liftedLeft[i + 1]);
        paintPath(rightPathRefs.current[i], rightBoundaries[i].x, rightBoundaries[i + 1].x, liftedRight[i], liftedRight[i + 1]);
      }
      openRef.current = true;
      setOpen(true);
      onOpenComplete?.();
      return;
    }
    openingRef.current = true;
    setOpening(true);
    drawStartRef.current = elapsedRef.current;
  };

  const gid = (side: string, i: number) => `${uid}-pleat-${side}-${i}`;

  const renderGradients = (side: "left" | "right") =>
    Array.from({ length: PLEATS }, (_, i) => (
      <linearGradient key={gid(side, i)} id={gid(side, i)} x1="0" y1="0" x2="1" y2="0">
        <stop
          offset="0"
          ref={(el) => {
            (side === "left" ? leftStopRefs : rightStopRefs).current[i].base0 = el;
          }}
        />
        <stop
          offset="0.3"
          stopOpacity="0"
          ref={(el) => {
            (side === "left" ? leftStopRefs : rightStopRefs).current[i].hiIn = el;
          }}
        />
        <stop
          offset="0.48"
          stopOpacity="0.55"
          ref={(el) => {
            (side === "left" ? leftStopRefs : rightStopRefs).current[i].hiPeak = el;
          }}
        />
        <stop
          offset="0.52"
          stopOpacity="0.5"
          ref={(el) => {
            (side === "left" ? leftStopRefs : rightStopRefs).current[i].shPeak = el;
          }}
        />
        <stop
          offset="0.7"
          stopOpacity="0"
          ref={(el) => {
            (side === "left" ? leftStopRefs : rightStopRefs).current[i].shOut = el;
          }}
        />
        <stop
          offset="1"
          ref={(el) => {
            (side === "left" ? leftStopRefs : rightStopRefs).current[i].base1 = el;
          }}
        />
      </linearGradient>
    ));

  const renderPleatPaths = (side: "left" | "right") =>
    Array.from({ length: PLEATS }, (_, i) => (
      <path
        key={i}
        ref={(el) => {
          (side === "left" ? leftPathRefs : rightPathRefs).current[i] = el;
        }}
        fill={`url(#${gid(side, i)})`}
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
        <defs>
          {renderGradients("left")}
          {renderGradients("right")}
        </defs>
        <rect ref={bgRectRef} x={0} y={0} width={VW} height={VH} />
        <rect ref={trackRef} x={CENTER - TRACK_HALF_W} y={TRACK_Y} width={TRACK_HALF_W * 2} height={TRACK_H} rx={2} />
        <rect
          data-curtain-open
          ref={markerRef}
          x={CENTER - MARKER_W / 2}
          y={MARKER_Y - MARKER_H / 2}
          width={MARKER_W}
          height={MARKER_H}
          rx={2}
        />
        <g ref={leftGroupRef}>
          <path ref={leftEnvelopeRef} />
          {renderPleatPaths("left")}
        </g>
        <g ref={rightGroupRef}>
          <path ref={rightEnvelopeRef} />
          {renderPleatPaths("right")}
        </g>
      </svg>
      {showButton ? (
        <button
          type="button"
          data-curtain-trigger
          onClick={handleTrigger}
          disabled={opening}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 inline-flex items-center rounded-sm bg-ns-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent disabled:opacity-60 disabled:pointer-events-none"
        >
          Skip curtain
        </button>
      ) : null}
    </div>
  );
}
