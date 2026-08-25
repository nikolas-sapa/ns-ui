"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// CurtainTravelerDraw — a full-bleed route curtain modeled on a real
// theatrical traveler/draw curtain: two overlapping drape panels riding a
// corded track, ~100% sewn-in fullness (~10 vertical pleats per panel at
// rest). Closed, the panels overlap at center and block the page; drawing
// open pulls both panels outward toward the wings on independent SVG groups
// (translateX only — no per-pixel field, so SVG is the cheap substrate
// here). Every pleat is shaded path geometry: a --foreground-tinted shadow
// gradient and a --background-tinted highlight gradient per fold, layered
// as partial opacity over the opaque --ns-muted fabric body, with a hard
// stop at the crease line so the fold actually reads as a fold. (--border
// is a separator token, ~1.1:1 against --background in light theme —
// unusable as fabric ink, so the fold's form is carried in value against
// --foreground/--background instead, never --border.)
//
// The idle sway is unconditional — even fully closed, every pleat's crease
// line breathes ±8% of its own cell width on a slow ~4s sine, independently
// phase-offset per fold, so the resting/no-autoplay state genuinely moves
// (individual fold lines shift; this is not a whole-panel opacity pulse).
// Drawing open runs a single rAF timeline that eases the group translateX
// with a brief overshoot-and-settle at the end (curtain momentum), bows the
// meeting edge with a pinned-top/sagging-bottom curve (rope/pulley slack)
// that peaks mid-draw, and sharpens the pleat compression bias toward the
// wing end as the panel gathers.
//
// Colors come only from --ns-muted (fabric body), --foreground (shadow
// side) and --background (highlight side, plus the backing "blocked page"
// rect), read once via getComputedStyle(document.documentElement) and
// re-read on a MutationObserver watching documentElement's class — no hex
// or rgb() literals anywhere in the draw code. --ns-accent never touches
// the fabric; it only tints the optional "skip curtain" trigger button.

export interface CurtainTravelerDrawProps {
  /** Called once the draw-open animation (or reduced-motion hard cut) completes. */
  onOpenComplete?: () => void;
  /** Freezes the idle sway and any in-flight draw at its current frame. */
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
const CENTER = VW / 2;
const OVERLAP = 150; // px each panel's inner edge extends past center at rest
const OUTSET = 220; // px each panel's outer edge extends past the viewBox at rest
const OPEN_TX = VW + OUTSET + 120; // translateX distance to clear the panel fully offscreen
const PLEATS = 10;
const DRAW_MS = 620;
const SAG_MAX = 30; // px, local bow at the meeting edge, peaks mid-draw
const BREATH_PERIOD_MS = 4000;
const BREATH_AMP = 0.08; // ±8% of a pleat's own gradient-space width
const TRACK_HALF_W = 150;
const TRACK_Y = 20;
const TRACK_H = 10;
const MARKER_Y = VH * 0.5; // dedicated gate-target marker, screen centre — the
// track rail above the fabric is never occluded by the panels, so it can't
// carry the open/closed signal; this rect sits where the panels actually
// overlap at rest and clear when drawn open.
const MARKER_W = 160;
const MARKER_H = 48;

const LEFT_X0 = -OUTSET;
const LEFT_X1 = CENTER + OVERLAP;
const RIGHT_X0 = CENTER - OVERLAP;
const RIGHT_X1 = VW + OUTSET;

function easeOutBack(t: number): number {
  // f(1) = 1 exactly — the overshoot lives entirely inside [0,1], so it
  // settles back to the resting open position without extending duration.
  const c1 = 0.42;
  const c3 = c1 + 1;
  const p = t - 1;
  return 1 + c3 * p * p * p + c1 * p * p;
}

/** Per-pleat proportional widths for one panel: narrower toward the wing end,
 *  wider toward the center-meeting edge; contrast sharpens as the panel draws
 *  open (fabric gathering tighter toward the wing under motion). */
function pleatWeights(side: "left" | "right", contrast: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < PLEATS; i++) {
    const frac = i / (PLEATS - 1); // 0 (leftmost) .. 1 (rightmost)
    const gatherLocal = side === "left" ? frac : 1 - frac; // 0 = at wing, 1 = at center
    out.push(Math.max(0.3, 1 - contrast * 0.55 + contrast * 1.1 * gatherLocal));
  }
  return out;
}

function layoutPleats(side: "left" | "right", x0: number, x1: number, contrast: number) {
  const weights = pleatWeights(side, contrast);
  const sum = weights.reduce((a, b) => a + b, 0);
  const panelW = x1 - x0;
  const positions: { x: number; w: number }[] = [];
  let cursor = x0;
  for (const w of weights) {
    const width = (w / sum) * panelW;
    positions.push({ x: cursor, w: width });
    cursor += width;
  }
  return positions;
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

export function CurtainTravelerDraw({ onOpenComplete, paused = false, className = "" }: CurtainTravelerDrawProps) {
  const uid = useId().replace(/[:]/g, "");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const leftGroupRef = useRef<SVGGElement | null>(null);
  const rightGroupRef = useRef<SVGGElement | null>(null);
  const leftRectRefs = useRef<(SVGRectElement | null)[]>([]);
  const rightRectRefs = useRef<(SVGRectElement | null)[]>([]);
  const leftStopRefs = useRef<StopRefs[]>(Array.from({ length: PLEATS }, emptyStopRefs));
  const rightStopRefs = useRef<StopRefs[]>(Array.from({ length: PLEATS }, emptyStopRefs));
  const leftSagRef = useRef<SVGPathElement | null>(null);
  const rightSagRef = useRef<SVGPathElement | null>(null);
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
    if (leftSagRef.current) leftSagRef.current.setAttribute("stroke", t.foreground);
    if (rightSagRef.current) rightSagRef.current.setAttribute("stroke", t.foreground);
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

  // --- draw one frame (refs-only, no React state on the hot path) -------
  const draw = (elapsedMs: number) => {
    const breathPhaseBase = (elapsedMs / BREATH_PERIOD_MS) * Math.PI * 2;

    let progress = 0; // 0 = closed, 1 = fully open (may briefly exceed 1: overshoot)
    let sag = 0;
    if (drawStartRef.current !== null) {
      const frac = Math.min(1, (elapsedMs - drawStartRef.current) / DRAW_MS);
      progress = easeOutBack(frac);
      sag = SAG_MAX * 4 * frac * (1 - frac);
      if (frac >= 1 && !openRef.current) {
        openRef.current = true;
        openingRef.current = false;
        setOpen(true);
        setOpening(false);
        onOpenComplete?.();
      }
    }
    const contrast = Math.max(0, Math.min(1, progress));

    const leftLayout = layoutPleats("left", LEFT_X0, LEFT_X1, contrast);
    const rightLayout = layoutPleats("right", RIGHT_X0, RIGHT_X1, contrast);

    const paintPanel = (
      side: "left" | "right",
      layout: { x: number; w: number }[],
      rectRefs: (SVGRectElement | null)[],
      stopRefs: StopRefs[],
      groupEl: SVGGElement | null,
      tx: number,
      sagRef: SVGPathElement | null,
      sagDx: number,
      innerX: number,
    ) => {
      if (groupEl) groupEl.setAttribute("transform", `translate(${tx} 0)`);
      for (let i = 0; i < PLEATS; i++) {
        const rect = rectRefs[i];
        const cell = layout[i];
        if (rect && cell) {
          rect.setAttribute("x", String(cell.x));
          rect.setAttribute("width", String(Math.max(0.5, cell.w)));
        }
        const phase = breathPhaseBase + i * 0.37 + (side === "right" ? 1.7 : 0);
        const crease = 0.5 + BREATH_AMP * Math.sin(phase);
        const refs = stopRefs[i];
        refs?.hiIn?.setAttribute("offset", String(crease - 0.2));
        refs?.hiPeak?.setAttribute("offset", String(crease - 0.02));
        refs?.shPeak?.setAttribute("offset", String(crease + 0.02));
        refs?.shOut?.setAttribute("offset", String(crease + 0.2));
      }
      if (sagRef) {
        const dx = sagDx * sag;
        sagRef.setAttribute(
          "d",
          `M ${innerX} 0 C ${innerX} ${VH * 0.3} ${innerX + dx} ${VH * 0.7} ${innerX + dx} ${VH}`,
        );
      }
    };

    paintPanel("left", leftLayout, leftRectRefs.current, leftStopRefs.current, leftGroupRef.current, -OPEN_TX * progress, leftSagRef.current, 1, LEFT_X1);
    paintPanel("right", rightLayout, rightRectRefs.current, rightStopRefs.current, rightGroupRef.current, OPEN_TX * progress, rightSagRef.current, -1, RIGHT_X0);
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

  // --- normal continuous rAF loop: unconditional idle sway + draw --------
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
      // Hard cut, no tween: jump straight to the open geometry.
      const contrast = 1;
      const leftLayout = layoutPleats("left", LEFT_X0, LEFT_X1, contrast);
      const rightLayout = layoutPleats("right", RIGHT_X0, RIGHT_X1, contrast);
      if (leftGroupRef.current) leftGroupRef.current.setAttribute("transform", `translate(${-OPEN_TX} 0)`);
      if (rightGroupRef.current) rightGroupRef.current.setAttribute("transform", `translate(${OPEN_TX} 0)`);
      leftLayout.forEach((cell, i) => {
        const rect = leftRectRefs.current[i];
        if (rect) {
          rect.setAttribute("x", String(cell.x));
          rect.setAttribute("width", String(Math.max(0.5, cell.w)));
        }
      });
      rightLayout.forEach((cell, i) => {
        const rect = rightRectRefs.current[i];
        if (rect) {
          rect.setAttribute("x", String(cell.x));
          rect.setAttribute("width", String(Math.max(0.5, cell.w)));
        }
      });
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

  const renderPleats = (side: "left" | "right", x0: number, x1: number) => {
    const layout = layoutPleats(side, x0, x1, 0);
    return layout.map((cell, i) => (
      <rect
        key={i}
        ref={(el) => {
          (side === "left" ? leftRectRefs : rightRectRefs).current[i] = el;
        }}
        x={cell.x}
        y={0}
        width={cell.w}
        height={VH}
        fill={`url(#${gid(side, i)})`}
      />
    ));
  };

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
          {renderPleats("left", LEFT_X0, LEFT_X1)}
          <path ref={leftSagRef} fill="none" strokeWidth={14} strokeLinecap="round" opacity={0.35} />
        </g>
        <g ref={rightGroupRef}>
          {renderPleats("right", RIGHT_X0, RIGHT_X1)}
          <path ref={rightSagRef} fill="none" strokeWidth={14} strokeLinecap="round" opacity={0.35} />
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
