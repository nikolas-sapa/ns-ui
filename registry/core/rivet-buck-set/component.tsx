"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// RivetBuckSet — a "pin this row" / "lock this card" fastener control built
// from hot/solid riveting practice (aircraft structures), not a decorative
// pin-icon rotate. A rivet gun drives a factory-headed rivet through two
// sheets; a bucking bar on the far side absorbs the hammer blows while the
// protruding shank flattens and mushrooms outward into a domed "shop head".
// On a HOT-driven rivet the shank also cools and shrinks slightly after it
// is struck, which keeps drawing the two sheets together for a beat after
// the shop head's shape has already stopped changing — that decoupling
// (shape finishes forming at 450ms, the JOINT keeps tightening for another
// 1800ms) is the one thing this component asks a viewer to actually follow;
// the five hammer strikes that precede it are a fast, discrete flurry (90ms
// apart, 40ms shock-and-settle each) rather than a smooth squash, because a
// bucking bar under repeated blows is not a continuous press.
//
// Geometry: an SVG mushroom-head silhouette is rebuilt from four control
// radii (base / lower-mid / upper-mid / apex) at fixed heights every frame,
// smoothed through a midpoint-quadratic path so the dome reads as forged
// metal rather than a polygon. Two plain <div> sheet panels sandwich the
// head's base; the lower panel's height is animated so its top edge is the
// only thing that moves, which reads directly as "the sheets drawing
// together" without touching the head geometry at all. Everything is scaled
// off the panel's own measured (square) size, so the REAL NUMBERS in the
// per-strike deltas and the clamp draw-together hold at the reference panel
// size and scale proportionally at other sizes.
//
// A full cycle is 4.25s, continuous, with zero input required:
//   0 -> 450ms    5 strikes, 90ms apart, decaying-increment widening
//   450 -> 2250ms post-forming shrink/clamp: sheets draw closer, head base
//                 radius tightens — head SHAPE is already finished by 450ms
//   2250 -> 3850ms hold at full clamp
//   3850 -> 4250ms fade back to a bare, unformed, proud shank, then loop
// Pressing (pointerdown, or Enter/Space on the button) resets the cycle
// clock to 0 so a full strike-and-clamp sequence runs on demand, exactly
// like the ambient loop, since the ambient loop never needed the input to
// begin with (autoplay.mode stays "none" for this reason).
//
// Colour is never touched by the mechanic: the head/shank/sheets are all
// drawn with `var(--foreground)` / `var(--border)` so a theme flip repaints
// for free through CSS, no JS colour math needed. The one exception is the
// per-strike rim flash ("shock catching the freshly-struck metal") — that
// needs a magnitude cap that differs between themes, so a single cheap
// getComputedStyle read of --background's luminance (re-read on a
// MutationObserver watching documentElement's class) decides whether the
// flash uses the larger dark-theme cap or the smaller light-theme cap.
// Nothing here ever reads --ns-accent; the head and its flash are luminance
// (stroke-opacity) only, never interaction chrome.
// ---------------------------------------------------------------------------

export interface RivetBuckSetProps {
  /** row / card heading */
  title?: string;
  /** row / card body copy */
  description?: string;
  /** accessible label for the rivet control button */
  buttonLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

// -- reference geometry, all in design px at REF panel size, scaled by the
// -- panel's own measured smaller dimension at runtime --
const REF = 112;
const STRIKE_DELTAS = [3.4, 2.1, 1.3, 0.8, 0.5]; // px widening per strike, ~0.62 decay
const STRIKE_INTERVAL_MS = 90;
const SHOCK_MS = 40;
const SHOCK_PEAK_MULT = 1.3; // 30% radial overshoot during a strike's shock window
const FORM_MS = STRIKE_DELTAS.length * STRIKE_INTERVAL_MS; // 450
const CLAMP_MS = 1800;
const HOLD_MS = 1600;
const RESET_MS = 400;
const PERIOD_MS = FORM_MS + CLAMP_MS + HOLD_MS + RESET_MS; // 4250
const CLAMP_GAP_DELTA = 2; // px the sheets draw together over CLAMP_MS
const CLAMP_BASE_R_DELTA = 1; // px the head's base radius tightens over CLAMP_MS
const SHANK_R = 5; // px, bare unformed shank radius
const GAP_INITIAL = 5; // px, starting sheet-edge gap
const SHEET_THICK = 17; // px, each sheet panel's rendered thickness
const HEAD_HEIGHT = 30; // px, vertical extent of the shop-head silhouette
// four control levels, base (0) to apex (1), and how much each widens per
// unit of strike growth — base widens most (mushroom flares at its root),
// apex least (the crown stays comparatively tight), which is what reads as
// a dome rather than a uniform balloon.
const LEVEL_FRAC = [0, 0.35, 0.7, 1];
const LEVEL_WEIGHT = [1, 0.85, 0.55, 0.15];
// reduced-motion freeze: mid-hold, well past both forming (450ms) and the
// full 1800ms shrink/clamp window (2250ms) — the only frame showing the
// completed joint with sheets fully drawn together.
const STATIC_T = FORM_MS + CLAMP_MS + 400;
const STATIC_PHASE = "clamped";

function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}
function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function shockMult(u: number): number {
  // rises quickly to the overshoot peak, then settles back to 1x
  if (u < 0.35) return 1 + (SHOCK_PEAK_MULT - 1) * easeOutCubic(u / 0.35);
  const t = (u - 0.35) / 0.65;
  return SHOCK_PEAK_MULT - (SHOCK_PEAK_MULT - 1) * easeInOutCubic(t);
}
function flashEnvelope(u: number): number {
  return (shockMult(u) - 1) / (SHOCK_PEAK_MULT - 1);
}

function computeGrowth(levelWeight: number, t: number): number {
  let g = 0;
  for (let k = 0; k < STRIKE_DELTAS.length; k++) {
    const start = k * STRIKE_INTERVAL_MS;
    if (t < start) break;
    const local = t - start;
    const mult = local < SHOCK_MS ? shockMult(local / SHOCK_MS) : 1;
    g += levelWeight * STRIKE_DELTAS[k]! * mult;
  }
  return g;
}

function computeFlash(t: number): number {
  for (let k = 0; k < STRIKE_DELTAS.length; k++) {
    const local = t - k * STRIKE_INTERVAL_MS;
    if (local >= 0 && local < SHOCK_MS) return flashEnvelope(local / SHOCK_MS);
  }
  return 0;
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)} `;
  for (let i = 0; i < pts.length - 1; i++) {
    const cur = pts[i]!;
    const next = pts[i + 1]!;
    const mx = (cur.x + next.x) / 2;
    const my = (cur.y + next.y) / 2;
    if (i === 0) d += `L ${mx.toFixed(2)} ${my.toFixed(2)} `;
    else d += `Q ${cur.x.toFixed(2)} ${cur.y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)} `;
  }
  const last = pts[pts.length - 1]!;
  d += `L ${last.x.toFixed(2)} ${last.y.toFixed(2)} Z`;
  return d;
}

interface Frame {
  radii: number[]; // [base, lowerMid, upperMid, apex], px
  gap: number; // px
  flash: number; // 0..1
}

function computeFrame(rawT: number, scale: number): Frame {
  const growth = LEVEL_WEIGHT.map((w) => computeGrowth(w, Math.min(rawT, FORM_MS)) * scale);
  const sGapInit = GAP_INITIAL * scale;
  const sClampGap = CLAMP_GAP_DELTA * scale;
  const sClampBase = CLAMP_BASE_R_DELTA * scale;
  const sShank = SHANK_R * scale;

  let growthMult = 1;
  let gap = sGapInit;
  let baseExtra = 0;

  if (rawT < FORM_MS) {
    growthMult = 1;
    gap = sGapInit;
    baseExtra = 0;
  } else if (rawT < FORM_MS + CLAMP_MS) {
    const p = easeOutCubic((rawT - FORM_MS) / CLAMP_MS);
    gap = sGapInit - sClampGap * p;
    baseExtra = -sClampBase * p;
  } else if (rawT < FORM_MS + CLAMP_MS + HOLD_MS) {
    gap = sGapInit - sClampGap;
    baseExtra = -sClampBase;
  } else {
    const p = easeInOutCubic((rawT - (FORM_MS + CLAMP_MS + HOLD_MS)) / RESET_MS);
    growthMult = 1 - p;
    gap = sGapInit - sClampGap * (1 - p);
    baseExtra = -sClampBase * (1 - p);
  }

  const radii = LEVEL_WEIGHT.map((_, i) => sShank + (growth[i] ?? 0) * growthMult + (i === 0 ? baseExtra : 0));
  return { radii, gap, flash: computeFlash(rawT) };
}

type RGB = [number, number, number];
function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length < 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return Number.isNaN(r + g + b) ? null : [r, g, b];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function relLuminance([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function RivetBuckSet({
  title = "Q3 planning notes",
  description = "Press the fastener to pin this row — a hot-driven rivet forms and keeps clamping after the shape stops changing.",
  buttonLabel = "Pin this row",
  className = "",
  style,
}: RivetBuckSetProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLButtonElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const headPathRef = useRef<SVGPathElement>(null);
  const flashPathRef = useRef<SVGPathElement>(null);
  const upperSheetRef = useRef<HTMLDivElement>(null);
  const lowerSheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    const svg = svgRef.current;
    const headPath = headPathRef.current;
    const flashPath = flashPathRef.current;
    const upperSheet = upperSheetRef.current;
    const lowerSheet = lowerSheetRef.current;
    if (!panel || !svg || !headPath || !flashPath || !upperSheet || !lowerSheet) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    let isDark = true;
    const deriveTheme = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background")) ?? [10, 10, 10];
      isDark = relLuminance(bg) < 0.5;
    };
    deriveTheme();

    let w = REF * 3;
    let h = REF;
    let scale = 1;
    let visible = true;
    let raf = 0;
    let cycleStart = 0;

    const render = (rawT: number) => {
      const cx = w / 2;
      const headBaseY = h * 0.42;
      const headHeight = HEAD_HEIGHT * scale;
      const frame = computeFrame(rawT, scale);

      const rightPts = LEVEL_FRAC.map((lvl, i) => ({
        x: cx + (frame.radii[i] ?? 0),
        y: headBaseY - lvl * headHeight,
      }));
      const leftPts = LEVEL_FRAC.map((lvl, i) => ({
        x: cx - (frame.radii[i] ?? 0),
        y: headBaseY - lvl * headHeight,
      })).reverse();
      const d = smoothPath([...rightPts, ...leftPts]);
      headPath.setAttribute("d", d);
      flashPath.setAttribute("d", d);

      const peak = isDark ? 0.85 : 0.4;
      flashPath.style.strokeOpacity = String(frame.flash * peak);

      const sheetThick = SHEET_THICK * scale;
      upperSheet.style.top = `${headBaseY}px`;
      upperSheet.style.height = `${sheetThick}px`;
      const lowerTop = headBaseY + sheetThick + frame.gap;
      lowerSheet.style.top = `${lowerTop}px`;
      lowerSheet.style.height = `${Math.max(0, h - lowerTop)}px`;
    };

    const loop = (now: number) => {
      const rawT = (now - cycleStart) % PERIOD_MS;
      render(rawT);
      if (!reduced && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) raf = requestAnimationFrame(loop);
    };

    const trigger = () => {
      if (reduced) return;
      cycleStart = performance.now();
    };

    const resize = () => {
      const rect = panel.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      scale = Math.min(w, h) / REF;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(h));
      if (reduced) {
        render(STATIC_T);
      } else {
        render((performance.now() - cycleStart) % PERIOD_MS);
      }
    };

    resize();
    if (reduced) {
      render(STATIC_T);
    } else {
      cycleStart = performance.now();
      wake();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(panel);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(panel);

    const mo = new MutationObserver(() => {
      deriveTheme();
      render(reduced ? STATIC_T : (performance.now() - cycleStart) % PERIOD_MS);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        render(STATIC_T);
      } else {
        cycleStart = performance.now();
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      if (document.visibilityState === "visible") wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") trigger();
    };
    panel.addEventListener("pointerdown", trigger);
    panel.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      panel.removeEventListener("pointerdown", trigger);
      panel.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const sheetFill = "color-mix(in srgb, var(--foreground) 28%, var(--background))";
  const headFill = "color-mix(in srgb, var(--foreground) 65%, var(--background))";

  return (
    <div
      ref={rootRef}
      data-reduced-motion-freeze={STATIC_PHASE}
      className={`ns-rivet-buck-set flex w-full max-w-sm flex-col gap-3 rounded-[14px] border border-border bg-background p-4 ${className}`}
      style={style}
    >
      <div className="min-w-0">
        <h3 className="text-balance font-sans text-sm font-medium text-foreground">{title}</h3>
        <p className="mt-1 text-pretty font-mono text-xs leading-relaxed text-ns-muted">{description}</p>
      </div>
      <button
        ref={panelRef}
        type="button"
        aria-label={buttonLabel}
        className="relative h-40 w-full shrink-0 overflow-hidden rounded-md border border-border bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        <div ref={upperSheetRef} aria-hidden="true" className="absolute inset-x-0" style={{ background: sheetFill }} />
        <div ref={lowerSheetRef} aria-hidden="true" className="absolute inset-x-0 bottom-0" style={{ background: sheetFill }} />
        <svg ref={svgRef} aria-hidden="true" className="absolute inset-0 h-full w-full">
          <path ref={headPathRef} d="" fill={headFill} />
          <path ref={flashPathRef} d="" fill="none" stroke="var(--foreground)" strokeWidth={1.5} strokeOpacity={0} />
        </svg>
      </button>
    </div>
  );
}

RivetBuckSet.displayName = "RivetBuckSet";

export default RivetBuckSet;
