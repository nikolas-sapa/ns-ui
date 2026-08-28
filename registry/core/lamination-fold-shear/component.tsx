"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// LaminationFoldShear — a multi-stage pipeline/onboarding stepper rendered as
// a croissant-dough cross-section (classic French "tourage"): a butter block
// enclosed in dough is passed through three letter-folds, and each fold
// TRIPLES the visible layer count (1 -> 3 -> 9 -> 27) while rolling the
// butter sheet progressively thinner. The mechanic being shown is literal
// band SUBDIVISION at a fold instant, not a falloff curve down a static
// stack (compare carbon-ply-fade — a fixed row count whose registered
// density decays 0.68x per row on every strike, no row ever splits) and not
// a continuous single-direction draw (compare float-ribbon-draw — one fixed
// thermal gradient that never restructures, only scrolls). Here the band
// COUNT itself is the only thing that changes shape.
//
// Butter is drawn as a stroke (a hairline), dough as the fill it sits in —
// never the reverse. That is what keeps 27 layers legible instead of
// reading as a barcode: the number that has to stay above ~3 CSS px is the
// PITCH between hairlines (stackHeight / layerCount), not a fill-strip
// height, so stack height is floored (>= 81px, or 32 * bandUnit) rather
// than left to fall out of bandUnit alone at small card sizes.
//
// One fold event = a 1400ms shear pass (a whole-stack skewX/compress/widen
// bump, peaking mid-pass and relaxing back to identity by its end) during
// which every existing hairline splits into three: the centre child stays
// at the parent's position while its stroke thins toward the next fold's
// width, and the two outer children grow outward from that same position
// to their final thirds-of-a-cell resting points, fading in as they travel
// — departure and arrival, never a crossfade between two static line
// counts. A 900ms rest follows each shear before the next fold begins.
// Two --border hairlines mark the outer thirds from fold 1 onward — a
// fixed count regardless of layer depth, so they read the fold-1 structure
// at every stage without ever multiplying into per-band noise at 27.
//
// Full loop: fold1 (2300ms) -> fold2 (2300ms) -> fold3 (2300ms) -> 1500ms
// hold at 27 layers -> an 800ms wipe that GEOMETRICALLY merges 27 back to 1
// (a vertical sweep line: everything left of it already re-rendered at 1
// layer, everything right of it still shows 27 — a real merge, not an
// opacity cascade, which would start reading like carbon-ply-fade's
// propagating strike) -> loop, unbounded, 9200ms total.
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];

// Same parse+lerp idiom used elsewhere in this registry (house convention,
// duplicated per component rather than shared).
function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0], 16);
      const g = parseInt(hex[1]! + hex[1], 16);
      const b = parseInt(hex[2]! + hex[2], 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function lerpColor(a: Vec3, b: Vec3, t: number): Vec3 {
  const c = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * c),
    Math.round(a[1] + (b[1] - a[1]) * c),
    Math.round(a[2] + (b[2] - a[2]) * c),
  ];
}

function rgbStr(v: Vec3, alpha = 1): string {
  return alpha >= 1 ? `rgb(${v[0]},${v[1]},${v[2]})` : `rgba(${v[0]},${v[1]},${v[2]},${alpha})`;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// -- fold timeline, real numbers from the spec -------------------------------
const SHEAR_MS = 1400;
const REST_MS = 900;
const FOLD_MS = SHEAR_MS + REST_MS; // 2300
const HOLD_MS = 1500; // sustained at 27 layers
const WIPE_MS = 800; // geometric merge back to 1 layer
const CYCLE_MS = FOLD_MS * 3 + HOLD_MS + WIPE_MS; // 9200
const REDUCED_FREEZE_MS = 6400; // fold 3 rest, 27 layers settled, no shear-blur

const FOLD_N: [number, number][] = [
  [1, 3],
  [3, 9],
  [9, 27],
];
const MAX_LAYERS = 27; // hard cap — never render finer, per kill criteria
const STROKE_FLOOR = 0.6;
const STROKE_BASE = 4;

function widthForN(n: number): number {
  return Math.max(STROKE_FLOOR, STROKE_BASE / n);
}

interface BandLine {
  yFrac: number; // 0..1 within the stack
  width: number;
  alpha: number;
  parentThird: number; // which of the 3 top-level fold-1 groups this belongs to, 0..2
}

/** All hairlines mid-fold, at progress p in [0,1] (0 = prevN, 1 = nextN settled). */
function buildFoldLines(prevN: number, nextN: number, p: number): BandLine[] {
  const ep = easeInOutCubic(Math.min(1, Math.max(0, p)));
  const wBefore = widthForN(prevN);
  const wAfter = widthForN(nextN);
  const out: BandLine[] = [];
  for (let i = 0; i < prevN; i++) {
    const cellTop = i / prevN;
    const cellH = 1 / prevN;
    const parentY = cellTop + cellH * 0.5;
    const childYs = [cellTop + cellH * (1 / 6), parentY, cellTop + cellH * (5 / 6)];
    const parentThird = Math.min(2, Math.floor((i / prevN) * 3));
    for (let c = 0; c < 3; c++) {
      if (c === 1) {
        out.push({ yFrac: parentY, width: wBefore + (wAfter - wBefore) * ep, alpha: 1, parentThird });
      } else {
        const y = parentY + (childYs[c]! - parentY) * ep;
        out.push({ yFrac: y, width: wAfter * ep, alpha: ep, parentThird });
      }
    }
  }
  return out;
}

/** Settled hairlines at a fixed layer count N, no fold in progress. */
function evenLines(n: number): BandLine[] {
  const w = widthForN(n);
  const out: BandLine[] = [];
  for (let i = 0; i < n; i++) {
    const yFrac = (i + 0.5) / n;
    out.push({ yFrac, width: w, alpha: 1, parentThird: Math.min(2, Math.floor((i / n) * 3)) });
  }
  return out;
}

interface CycleState {
  lines: BandLine[];
  layerCount: number;
  shearBump: number; // 0..1, drives the whole-stack skew/compress/widen
  wipeFrac: number | null; // 0..1 during the wipe phase, else null
}

function cycleState(elapsed: number): CycleState {
  const t = ((elapsed % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;

  for (let f = 0; f < 3; f++) {
    const foldStart = f * FOLD_MS;
    const shearEnd = foldStart + SHEAR_MS;
    const restEnd = foldStart + FOLD_MS;
    const [prevN, nextN] = FOLD_N[f]!;
    if (t < shearEnd) {
      const p = (t - foldStart) / SHEAR_MS;
      return { lines: buildFoldLines(prevN, nextN, p), layerCount: nextN, shearBump: Math.sin(p * Math.PI), wipeFrac: null };
    }
    if (t < restEnd) {
      return { lines: evenLines(nextN), layerCount: nextN, shearBump: 0, wipeFrac: null };
    }
  }

  const holdStart = FOLD_MS * 3;
  const wipeStart = holdStart + HOLD_MS;
  if (t < wipeStart) {
    return { lines: evenLines(MAX_LAYERS), layerCount: MAX_LAYERS, shearBump: 0, wipeFrac: null };
  }
  const wp = (t - wipeStart) / WIPE_MS;
  return { lines: evenLines(MAX_LAYERS), layerCount: MAX_LAYERS, shearBump: 0, wipeFrac: Math.min(1, Math.max(0, wp)) };
}

interface Tokens {
  bg: Vec3;
  muted: Vec3;
  fg: Vec3;
  border: Vec3;
  borderAlpha: number;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const root = getComputedStyle(document.documentElement);
  const bg = parseColor(root.getPropertyValue("--background"));
  const muted = parseColor(root.getPropertyValue("--ns-muted"));
  const fg = parseColor(root.getPropertyValue("--foreground"));
  const border = parseColor(root.getPropertyValue("--border"));
  if (!bg || !muted || !fg || !border) return null; // stylesheet not applied yet — paint nothing
  const m = root.getPropertyValue("--border").match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/);
  const borderAlpha = m ? Number(m[1]) : 1;
  return { bg, muted, fg, border, borderAlpha };
}

export interface LaminationFoldShearProps {
  /** ordered pipeline stage labels, one per fold (3 max are shown). Omit for a purely ambient card. */
  steps?: string[];
  /** externally-controlled active step index, e.g. from a real deploy pipeline. Highlights that fold group in luminance only. */
  activeStep?: number;
  /** accessible label for the status region */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function LaminationFoldShear({
  steps,
  activeStep,
  label = "Build pipeline",
  className = "",
}: LaminationFoldShearProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const hoveredRef = useRef<number | null>(null);
  const activeRef = useRef<number | undefined>(activeStep);
  const repaintStaticRef = useRef<() => void>(() => {});
  activeRef.current = activeStep;
  hoveredRef.current = hoveredStep;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let w = 0;
    let h = 0;
    let sized = false;
    let visible = true;
    let start = 0;
    let raf = 0;
    let tokenWaitRaf = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };

    // geometry off the container's smaller dimension, per BRIEF.md
    const layout = () => {
      const minDim = Math.min(w, h);
      const bandUnit = minDim / 64;
      const stackW = w * 0.82;
      const available = h * 0.8;
      const stackH = Math.min(available, Math.max(81, bandUnit * 32));
      const left = (w - stackW) / 2;
      const top = (h - stackH) / 2;
      return { left, top, stackW, stackH };
    };

    const draw = (state: CycleState) => {
      if (!tokens || !sized) return;
      const t = tokens;
      const { left, top, stackW, stackH } = layout();
      ctx.clearRect(0, 0, w, h);

      const dough = lerpColor(t.bg, t.muted, 0.12);
      const butter = lerpColor(t.bg, t.muted, 0.62);
      const butterHi = lerpColor(butter, t.fg, 0.45); // hover/focus luminance lift, never accent

      const activeThird = hoveredRef.current ?? activeRef.current ?? null;

      const paintStack = (n: number, lines: BandLine[], clipX0: number, clipX1: number) => {
        if (clipX1 <= clipX0) return;
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipX0, top - 2, clipX1 - clipX0, stackH + 4);
        ctx.clip();

        // dough fill
        ctx.fillStyle = rgbStr(dough);
        ctx.fillRect(left, top, stackW, stackH);

        // butter hairlines — stroke, never fill
        for (const line of lines) {
          const y = top + line.yFrac * stackH;
          const isActive = activeThird !== null && activeThird === line.parentThird;
          ctx.globalAlpha = line.alpha;
          ctx.strokeStyle = rgbStr(isActive ? butterHi : butter);
          ctx.lineWidth = Math.max(STROKE_FLOOR, line.width);
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(left + stackW, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // two fold-1 third separators, fixed count regardless of n
        ctx.strokeStyle = rgbStr(t.border, t.borderAlpha);
        ctx.lineWidth = 1;
        for (const f of [1 / 3, 2 / 3]) {
          const y = top + f * stackH;
          ctx.beginPath();
          ctx.moveTo(left, y);
          ctx.lineTo(left + stackW, y);
          ctx.stroke();
        }

        // outer frame
        ctx.strokeStyle = rgbStr(t.border, t.borderAlpha);
        ctx.strokeRect(left + 0.5, top + 0.5, stackW - 1, stackH - 1);

        ctx.restore();
      };

      if (state.wipeFrac === null) {
        paintStack(state.layerCount, state.lines, left - 4, left + stackW + 4);
      } else {
        const wipeX = left + state.wipeFrac * stackW;
        // left of the sweep: already reset to 1 layer. right: still 27.
        paintStack(1, evenLines(1), left - 4, wipeX);
        paintStack(MAX_LAYERS, evenLines(MAX_LAYERS), wipeX, left + stackW + 4);
        // the sweep line itself
        ctx.strokeStyle = rgbStr(t.fg, 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wipeX, top - 2);
        ctx.lineTo(wipeX, top + stackH + 2);
        ctx.stroke();
      }
    };

    // whole-stack shear pass: skewX + vertical compress + horizontal widen,
    // peaking mid-pass, back to identity by the pass's end.
    const drawWithShear = (state: CycleState) => {
      if (!tokens || !sized) return;
      if (state.shearBump <= 0.001) {
        draw(state);
        return;
      }
      const { left, top, stackW, stackH } = layout();
      const cx = left + stackW / 2;
      const cy = top + stackH / 2;
      const bump = state.shearBump;
      const skew = 0.1 * bump;
      const scaleY = 1 - 0.05 * bump;
      const scaleX = 1 + 0.035 * bump;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.transform(scaleX, 0, skew, scaleY, 0, 0);
      ctx.translate(-cx, -cy);
      draw(state);
      ctx.restore();
    };

    let staticState: CycleState | null = null;

    const loop = (now: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      if (start === 0) start = now;
      const elapsed = now - start;
      drawWithShear(cycleState(elapsed));
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        staticState = cycleState(REDUCED_FREEZE_MS);
        draw(staticState);
        return; // no rAF loop, no timers, no observers driving motion
      }
      raf = requestAnimationFrame(loop);
    };

    repaintStaticRef.current = () => {
      if (reduced && staticState && sized && tokens) draw(staticState);
    };

    const boot = () => {
      if (disposed) return;
      tokens = readTokens();
      if (!tokens) {
        tokenWaitRaf = requestAnimationFrame(boot);
        return;
      }
      resize();
      kick();
    };

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resize();
      if (reduced && staticState) draw(staticState);
      kick();
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      const next = readTokens();
      if (!next) return;
      tokens = next;
      if (reduced && staticState) {
        draw(staticState);
      } else if (sized && !reduced) {
        // repaint the current frame immediately with the new tokens
        const elapsed = start ? performance.now() - start : 0;
        drawWithShear(cycleState(elapsed));
      }
      kick();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && tokens && !raf) {
        tokens = readTokens() ?? tokens; // pick up a theme flip that happened while hidden
        resize();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(wrap);

    boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // repaint on hover/activeStep change is handled inside the rAF loop via
  // the refs above; for the reduced-motion static path we also need a
  // repaint trigger, handled by re-running the effect below.
  useEffect(() => {
    // the running rAF loop reads hoveredRef/activeRef live every frame, so
    // this only needs to force a repaint on the reduced-motion static path
    // (no loop running there to pick the new value up on its own).
    repaintStaticRef.current();
  }, [hoveredStep, activeStep]);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full max-w-md overflow-hidden rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <p className="mb-3 font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
      <div className="relative w-full" style={{ aspectRatio: "16 / 10" }}>
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
      {steps && steps.length > 0 && (
        <ol className="mt-3 flex items-center justify-between gap-2" aria-label={label}>
          {steps.slice(0, 3).map((s, i) => (
            <li key={s} className="flex-1">
              <button
                type="button"
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep((cur) => (cur === i ? null : cur))}
                onFocus={() => setHoveredStep(i)}
                onBlur={() => setHoveredStep((cur) => (cur === i ? null : cur))}
                className="w-full rounded-sm border border-border px-2 py-1.5 text-left font-mono text-[11px] text-ns-muted transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
                aria-current={activeStep === i ? "step" : undefined}
              >
                {s}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
