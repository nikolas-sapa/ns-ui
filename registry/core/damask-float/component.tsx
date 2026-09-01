"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// DamaskFloat — a feature grid woven from ONE cloth. Damask is figured cloth
// made from a single thread in a single colour: the pattern exists only
// because the ground and the figure are reciprocal satin structures (warp
// floats over the ground, weft floats over the figure), so the two regions
// share identical fibre and identical colour and differ only in WHICH
// direction the exposed thread runs. That azimuth difference changes the
// surface's specular anisotropy — nothing else — which is why this is
// natively monochrome and why hover can flip figure and ground with no fade
// and no translate: reversing S at a texel is reversing which structure is
// on top, not crossfading a colour.
//
// Per cell, a 2D canvas evaluates a Kajiya-Kay anisotropic term per texel
// against a FIXED light (elevation 34deg, azimuth 15deg) with a straight-on
// view, using a satin structure grid at pitch P = 0.018 * min(w,h): a 5-end
// satin (counter-step 2) gives every texel a binding-point mask that breaks
// the float and darkens it, which is what stops the two regions reading as
// flat greys. The raw anisotropic response only DRIVES the specular streak;
// the base tone of ground vs figure is pinned to fixed per-theme luminance
// stops (measured warp:weft ratio ~1.6-2.2:1) so contrast survives even
// where the streak formula is weak, per the light-theme floor rule.
//
// Alive at rest, unconditionally: (1) TAKE-UP — the cloth's border motif
// advances upward at TAKEUP = 0.021*min(w,h) px/s and wraps, so new cloth
// is always entering the frame; the pinned figure stays fixed in cell space
// so it never scrolls out. (2) LOOM SWAY — the light stays fixed but the
// cloth's own grain azimuth oscillates +-3.5deg on an 8.7s period plus a
// second, incommensurate +-1.2deg harmonic at 13.4s, so the specular streak
// (a cos^26 lobe) visibly travels across the surface and the state never
// repeats on a single beat. Neither mechanism converges; a still cloth is
// not a state this component has.
//
// Hover reverses S -> 1-S for texels the pointer's entry has reached, a
// front expanding at 0.9*min(w,h) px/s from the entry point — a real change
// in which structure is exposed, not an opacity cross-fade. Leaving the
// cell reverts instantly (a real damask has no "in-between" float either).
//
// Text sits on a plain-weave (tabby) patch that the front passes BEHIND —
// tabby has no floats and no anisotropy, so it is pinned to a fixed L in
// each theme regardless of S or the front, and it additionally sits under a
// standard token scrim (bg-background/70 backdrop-blur) per house rule, so
// the DOM heading/body are never depending on the canvas alone for contrast.
//
// Tokens: --background/--foreground read via getComputedStyle and re-read on
// a MutationObserver watching documentElement's class; every rendered pixel
// is a channel-wise blend of those two live RGB triples, never a literal
// colour. --ns-accent never appears in the streak — it is interaction chrome
// only (the focus ring), which is what the climactic-moment rule asks for.
// ---------------------------------------------------------------------------

// ---- shared numbers ---------------------------------------------------

const P_FACTOR = 0.018; // thread pitch as a fraction of the cell's smaller dimension
const TAKEUP_FACTOR = 0.021; // px/s, fraction of smaller dimension
const FRONT_SPEED_FACTOR = 0.9; // px/s, fraction of smaller dimension
const SATIN_PERIOD = 5; // 5-end satin
const SATIN_COUNTER_STEP = 2;
const SWAY_PERIOD_1_MS = 8700;
const SWAY_AMP_1_DEG = 3.5;
const SWAY_PERIOD_2_MS = 13400;
const SWAY_AMP_2_DEG = 1.2;
const STATIC_TIME_MS = 5400; // reduced-motion freeze frame, named in the spec
const LIGHT_ELEV_DEG = 34;
const LIGHT_AZ_DEG = 15;
const KD = 0.34;
const KS = 0.52;
const N_EXP = 26;
const DEG2RAD = Math.PI / 180;

const LIGHT_VEC = (() => {
  const elev = LIGHT_ELEV_DEG * DEG2RAD;
  const az = LIGHT_AZ_DEG * DEG2RAD;
  return { x: Math.cos(elev) * Math.cos(az), y: Math.cos(elev) * Math.sin(az) };
})();

// Target luminances (0 = darkest, 1 = lightest), per theme, from the spec's
// measured stops. Ground (warp-face) reads brighter than figure (weft-face)
// in both themes; only the bias/contrast move between themes, never the
// direction — see readTargetL below.
const GROUND_BODY_L = { light: 0.58, dark: 0.46 };
const FIGURE_BODY_L = { light: 0.29, dark: 0.2 };
const BINDING_RATIO = { light: 0.08 / 0.29, dark: 0.05 / 0.2 }; // binding point darkens the float by this fraction
const GROUND_STREAK_L = { light: 0.84, dark: 0.78 };
const STREAK_PEAK_L = { light: 0.96, dark: 0.98 };
const TABBY_L = { light: 0.68, dark: 0.24 };

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function smoothstep(x: number, e0: number, e1: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Deterministic integer hash -> [0,1), used for the satin twist jitter so
 * the reduced-motion frame is byte-stable — never Math.random(). */
function hash2(ix: number, iy: number): number {
  let h = (ix | 0) * 374761393 + (iy | 0) * 668265263;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function swayAngleDeg(elapsedMs: number): number {
  const a = Math.sin((2 * Math.PI * elapsedMs) / SWAY_PERIOD_1_MS) * SWAY_AMP_1_DEG;
  const b = Math.sin((2 * Math.PI * elapsedMs) / SWAY_PERIOD_2_MS) * SWAY_AMP_2_DEG;
  return a + b;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ---- token read (zero colour literals: always live RGB from --background/--foreground) ----

let probeCanvas: HTMLCanvasElement | null = null;
let probeCtx: CanvasRenderingContext2D | null = null;

function colorToRGB(cssColor: string): [number, number, number] {
  if (!probeCanvas) {
    probeCanvas = document.createElement("canvas");
    probeCanvas.width = 1;
    probeCanvas.height = 1;
    probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (!probeCtx || !cssColor) return [0, 0, 0];
  probeCtx.fillStyle = "#000";
  probeCtx.fillStyle = cssColor;
  probeCtx.fillRect(0, 0, 1, 1);
  const d = probeCtx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

interface TokenRGB {
  bg: [number, number, number];
  fg: [number, number, number];
  bgY: number; // simple channel-average proxy for luminance, 0..1
  fgY: number;
  isDark: boolean;
}

function readTokens(): TokenRGB {
  const cs = getComputedStyle(document.documentElement);
  const bg = colorToRGB(cs.getPropertyValue("--background").trim());
  const fg = colorToRGB(cs.getPropertyValue("--foreground").trim());
  const bgY = (bg[0] + bg[1] + bg[2]) / 765;
  const fgY = (fg[0] + fg[1] + fg[2]) / 765;
  return { bg, fg, bgY, fgY, isDark: bgY < 0.5 };
}

/** target L (0=darkest,1=lightest) -> alpha of --foreground composited over
 * --background, solved from the LIVE token luminances so a re-skin (theme
 * swap, or any token change caught by the MutationObserver) is honoured
 * automatically rather than baked in. */
function alphaForTargetL(targetL: number, tok: TokenRGB): number {
  const span = tok.fgY - tok.bgY;
  if (Math.abs(span) < 1e-4) return 0;
  return clamp01((targetL - tok.bgY) / span);
}

function blendChannel(bg: number, fg: number, alpha: number): number {
  return bg + (fg - bg) * alpha;
}

// ---- shared clock / token context (one rAF loop, N cells) --------------

interface TickPayload {
  elapsedMs: number;
  tokens: TokenRGB;
  qualityScale: number; // 1 = full buffer res, shrinks under sustained slow frames
}

type TickFn = (payload: TickPayload) => void;

interface GridApi {
  subscribe(fn: TickFn): () => void;
  reportFrameCost(ms: number): void;
}

const GridContext = createContext<GridApi | null>(null);

const QUALITY_STEPS = [1, 0.75, 0.55];
const FRAME_BUDGET_MS = 8;
const SLOW_SUSTAIN_MS = 900;

export interface DamaskFloatGridProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
}

export function DamaskFloatGrid({ children, className = "", ...rest }: DamaskFloatGridProps) {
  const subsRef = useRef<Set<TickFn>>(new Set());
  const apiRef = useRef<GridApi>({
    subscribe(fn) {
      subsRef.current.add(fn);
      return () => {
        subsRef.current.delete(fn);
      };
    },
    reportFrameCost() {
      /* replaced in the effect below */
    },
  });

  useEffect(() => {
    if (prefersReducedMotion() || typeof window === "undefined") return;

    let tokens = readTokens();
    const themeObserver = new MutationObserver(() => {
      tokens = readTokens();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let qualityScale = 1;
    let overBudgetSinceMs = -1;
    let stepIndex = 0;
    apiRef.current.reportFrameCost = (ms: number) => {
      const now = performance.now();
      if (ms > FRAME_BUDGET_MS) {
        if (overBudgetSinceMs < 0) overBudgetSinceMs = now;
        if (now - overBudgetSinceMs > SLOW_SUSTAIN_MS && stepIndex < QUALITY_STEPS.length - 1) {
          stepIndex += 1;
          qualityScale = QUALITY_STEPS[stepIndex];
          overBudgetSinceMs = -1;
        }
      } else {
        overBudgetSinceMs = -1;
      }
    };

    const origin = performance.now();
    let raf = 0;
    const loop = () => {
      const elapsedMs = performance.now() - origin;
      const payload: TickPayload = { elapsedMs, tokens, qualityScale };
      subsRef.current.forEach((fn) => fn(payload));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
    };
  }, []);

  return (
    <GridContext.Provider value={apiRef.current}>
      <div {...rest} className={className}>
        {children}
      </div>
    </GridContext.Provider>
  );
}

// ---- card ----------------------------------------------------------------

export interface DamaskFloatCardProps {
  /** Card heading, drawn as real DOM text over a fixed plain-weave patch. */
  heading: string;
  /** Supporting copy, same patch. */
  body: string;
  /** SVG path `d` (0 0 24 24 viewBox) rasterised into the cloth as the
   * pinned figure — this is the "icon", woven rather than printed. */
  iconPath?: string;
  href?: string;
  className?: string;
}

const DEFAULT_ICON_PATH =
  "M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2L12 3z";

interface PatchRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function DamaskFloatCard({ heading, body, iconPath, href, className = "" }: DamaskFloatCardProps) {
  const reactId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const patchElRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const bufCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bufCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const iconMaskRef = useRef<Uint8Array | null>(null);
  const sizeRef = useRef({ cssW: 0, cssH: 0, dpr: 1, bufW: 0, bufH: 0, minDim: 1 });
  const patchRef = useRef<PatchRect>({ x: 0, y: 0, w: 0, h: 0 });
  const frontRef = useRef<{ ox: number; oy: number; startMs: number } | null>(null);
  const visibleRef = useRef(true);
  const qualityRef = useRef(1);
  const grid = useContext(GridContext);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ctx = canvas.getContext("2d");
    ctxRef.current = ctx;
    const bufCanvas = document.createElement("canvas");
    bufCanvasRef.current = bufCanvas;
    bufCtxRef.current = bufCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !bufCtxRef.current) return;

    const rebuildIconMask = () => {
      const { bufW, bufH, minDim } = sizeRef.current;
      if (bufW <= 0 || bufH <= 0) return;
      const iconCanvas = document.createElement("canvas");
      iconCanvas.width = bufW;
      iconCanvas.height = bufH;
      const ictx = iconCanvas.getContext("2d");
      if (!ictx) return;
      const box = minDim * 0.4 * (bufW / sizeRef.current.cssW || 1);
      const scale = box / 24;
      ictx.save();
      ictx.translate(bufW / 2 - box / 2, bufH * 0.16);
      ictx.scale(scale, scale);
      ictx.fillStyle = "#000";
      ictx.fill(new Path2D(iconPath ?? DEFAULT_ICON_PATH));
      ictx.restore();
      const data = ictx.getImageData(0, 0, bufW, bufH).data;
      const mask = new Uint8Array(bufW * bufH);
      for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 96 ? 1 : 0;
      iconMaskRef.current = mask;
    };

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const cssW = Math.max(1, rect.width);
      const cssH = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const minDim = Math.min(cssW, cssH);
      const q = qualityRef.current;
      // half device resolution per the spec, further shrunk by the adaptive
      // quality scale, and hard-capped so a large card never over-spends.
      const bufW = Math.min(320, Math.round(cssW * dpr * 0.5 * q));
      const bufH = Math.min(320, Math.round(cssH * dpr * 0.5 * q));
      sizeRef.current = { cssW, cssH, dpr, bufW, bufH, minDim };

      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      bufCanvas.width = bufW;
      bufCanvas.height = bufH;

      if (patchElRef.current) {
        const pr = patchElRef.current.getBoundingClientRect();
        patchRef.current = { x: pr.left - rect.left, y: pr.top - rect.top, w: pr.width, h: pr.height };
      }
      rebuildIconMask();
      // NO PAINT BEFORE THE FIRST TOKEN READ: draw() below pulls tokens from
      // the tick payload / an explicit read, never from a hardcoded default.
      if (staticTokensRef.current) draw(staticElapsedRef.current, staticTokensRef.current);
    };

    const staticTokensRef: { current: TokenRGB | null } = { current: null };
    const staticElapsedRef = { current: STATIC_TIME_MS };

    const draw = (elapsedMs: number, tokens: TokenRGB) => {
      const bctx = bufCtxRef.current;
      const { bufW, bufH, cssW, minDim } = sizeRef.current;
      if (!bctx || bufW <= 0 || bufH <= 0) return;

      // Buffer pixels per CSS pixel — folds in DPR, the half-resolution rule
      // and the adaptive quality scale all at once, so every length below
      // (thread pitch, take-up, front radius) only has to be defined once,
      // in CSS px, and converted through this single factor.
      const bufPerCss = bufW / cssW;
      const cssPerBuf = cssW / bufW;
      const P = Math.max(1.2, P_FACTOR * minDim * bufPerCss);

      const takeupBuf = TAKEUP_FACTOR * minDim * bufPerCss * (elapsedMs / 1000);
      const repeatBuf = P * 8;
      const swayDeg = swayAngleDeg(elapsedMs);

      const front = frontRef.current;
      const frontRadiusCss = front ? FRONT_SPEED_FACTOR * minDim * ((elapsedMs - front.startMs) / 1000) : -1;

      const img = bctx.createImageData(bufW, bufH);
      const d = img.data;
      const iconMask = iconMaskRef.current;
      const patch = patchRef.current;

      const groundL = tokens.isDark ? GROUND_BODY_L.dark : GROUND_BODY_L.light;
      const figureL = tokens.isDark ? FIGURE_BODY_L.dark : FIGURE_BODY_L.light;
      const bindRatio = tokens.isDark ? BINDING_RATIO.dark : BINDING_RATIO.light;
      const streakUnderL = tokens.isDark ? GROUND_STREAK_L.dark : GROUND_STREAK_L.light;
      const streakPeakL = tokens.isDark ? STREAK_PEAK_L.dark : STREAK_PEAK_L.light;
      const tabbyL = tokens.isDark ? TABBY_L.dark : TABBY_L.light;

      for (let by = 0; by < bufH; by++) {
        const yCloth = by + takeupBuf;
        const iyBind = Math.floor(((yCloth % repeatBuf) + repeatBuf) % repeatBuf / P);
        const xCssBase = 0;
        const yCss = by * cssPerBuf;
        const inPatchY = yCss >= patch.y - 4 && yCss <= patch.y + patch.h + 4;
        for (let bx = 0; bx < bufW; bx++) {
          const idx = (by * bufW + bx) * 4;
          const xCss = xCssBase + bx * cssPerBuf;

          if (inPatchY && xCss >= patch.x - 4 && xCss <= patch.x + patch.w + 4) {
            const alpha = alphaForTargetL(tabbyL, tokens);
            d[idx] = blendChannel(tokens.bg[0], tokens.fg[0], alpha);
            d[idx + 1] = blendChannel(tokens.bg[1], tokens.fg[1], alpha);
            d[idx + 2] = blendChannel(tokens.bg[2], tokens.fg[2], alpha);
            d[idx + 3] = 255;
            continue;
          }

          const ix = Math.floor(bx / P);
          const maskIdx = by * bufW + bx;
          const pinned = iconMask ? iconMask[maskIdx] === 1 : 0;
          const diamondU = ((bx % repeatBuf) + repeatBuf) % repeatBuf - repeatBuf / 2;
          const diamondV = ((yCloth % repeatBuf) + repeatBuf) % repeatBuf - repeatBuf / 2;
          const motif = Math.abs(diamondU) + Math.abs(diamondV) < repeatBuf * 0.28 ? 1 : 0;
          let S = pinned || motif ? 1 : 0;

          if (front && frontRadiusCss >= 0) {
            const dx = xCss - front.ox;
            const dy = yCss - front.oy;
            if (dx * dx + dy * dy < frontRadiusCss * frontRadiusCss) S = 1 - S;
          }

          const bindingKey = ((ix + SATIN_COUNTER_STEP * iyBind) % SATIN_PERIOD + SATIN_PERIOD) % SATIN_PERIOD === 0;

          const baseAzimuthDeg = S ? 0 : 90; // ground assigned the azimuth further from the light -> brighter lobe, matching the measured warp>weft ratio
          const jitterDeg = (hash2(ix, iyBind) - 0.5) * 8;
          const phi = (baseAzimuthDeg + jitterDeg + swayDeg) * DEG2RAD;
          const Tx = Math.cos(phi);
          const Ty = Math.sin(phi);
          const sinLT = Math.max(0, LIGHT_VEC.x * Tx + LIGHT_VEC.y * Ty);
          const cosLT = Math.sqrt(Math.max(0, 1 - sinLT * sinLT));
          const F = KD * sinLT + KS * Math.pow(cosLT, N_EXP);

          let baseL = S ? figureL : groundL;
          if (bindingKey) baseL *= bindRatio;

          const streakFactor = smoothstep(F, 0.35, 0.86);
          const crownFactor = smoothstep(F, 0.7, 0.86);
          let targetL = lerp(baseL, streakUnderL, streakFactor);
          targetL = lerp(targetL, streakPeakL, crownFactor);

          const alpha = alphaForTargetL(targetL, tokens);
          d[idx] = blendChannel(tokens.bg[0], tokens.fg[0], alpha);
          d[idx + 1] = blendChannel(tokens.bg[1], tokens.fg[1], alpha);
          d[idx + 2] = blendChannel(tokens.bg[2], tokens.fg[2], alpha);
          d[idx + 3] = 255;
        }
      }

      bctx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bufCanvas, 0, 0, bufW, bufH, 0, 0, canvas.width, canvas.height);
    };

    const ro = new ResizeObserver(() => measure());
    ro.observe(host);

    let io: IntersectionObserver | null = null;
    let onVisChange: (() => void) | null = null;

    if (prefersReducedMotion()) {
      const tokens = readTokens();
      staticTokensRef.current = tokens;
      measure();
      draw(STATIC_TIME_MS, tokens);
      const themeObserver = new MutationObserver(() => {
        const t = readTokens();
        staticTokensRef.current = t;
        draw(STATIC_TIME_MS, t);
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => {
        ro.disconnect();
        themeObserver.disconnect();
      };
    }

    // First token read happens here, before the first measure()/draw() —
    // measure() only paints once staticTokensRef (used as the "last known
    // tokens" cache for resize-triggered repaints) is populated.
    const initialTokens = readTokens();
    staticTokensRef.current = initialTokens;
    staticElapsedRef.current = 0;
    measure();

    io = new IntersectionObserver((entries) => {
      visibleRef.current = entries[0]?.isIntersecting ?? true;
    }, { threshold: 0 });
    io.observe(host);
    onVisChange = () => {
      visibleRef.current = visibleRef.current && document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisChange);

    const tick = ({ elapsedMs, tokens, qualityScale }: TickPayload) => {
      staticTokensRef.current = tokens;
      staticElapsedRef.current = elapsedMs;
      if (!visibleRef.current || document.visibilityState !== "visible") return;
      if (qualityScale !== qualityRef.current) {
        qualityRef.current = qualityScale;
        measure();
      }
      const t0 = performance.now();
      draw(elapsedMs, tokens);
      grid?.reportFrameCost(performance.now() - t0);
    };

    let unsubscribe: (() => void) | null = null;
    let raf = 0;
    if (grid) {
      unsubscribe = grid.subscribe(tick);
    } else {
      // Standalone fallback: own rAF loop and own token watcher, mirroring
      // GrazingLight's convention so a card works without a wrapping grid.
      let tokens = initialTokens;
      const themeObserver = new MutationObserver(() => {
        tokens = readTokens();
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      const origin = performance.now();
      const loop = () => {
        tick({ elapsedMs: performance.now() - origin, tokens, qualityScale: qualityRef.current });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      unsubscribe = () => {
        cancelAnimationFrame(raf);
        themeObserver.disconnect();
      };
    }

    return () => {
      ro.disconnect();
      io?.disconnect();
      if (onVisChange) document.removeEventListener("visibilitychange", onVisChange);
      unsubscribe?.();
    };
  }, [grid, iconPath]);

  const onPointerEnter = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = hostRef.current?.getBoundingClientRect();
    if (!rect) return;
    frontRef.current = {
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      startMs: performance.now(),
    };
  };
  const onPointerLeave = () => {
    frontRef.current = null;
  };

  const patchId = `ns-df-patch-${reactId.replace(/:/g, "")}`;

  return (
    <div
      ref={hostRef}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className={`ns-df-card relative flex min-h-[220px] flex-col overflow-hidden rounded-lg border border-border ${className}`}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      {href ? (
        // Stretched-link pattern: the whole card is the hit target and the
        // accessible name, but the host stays a plain div so the pointer
        // events driving the front reversal are never entangled with anchor
        // semantics or a second focus ring.
        <a
          href={href}
          className="absolute inset-0 z-20 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ns-accent"
          aria-labelledby={patchId}
        />
      ) : null}
      <div
        ref={patchElRef}
        id={patchId}
        className="relative z-10 mt-auto flex flex-col gap-1.5 rounded-md bg-background/70 p-4 backdrop-blur-sm"
      >
        <h3 className="text-base font-semibold tracking-tight text-foreground">{heading}</h3>
        <p className="text-sm leading-relaxed text-ns-muted">{body}</p>
      </div>
    </div>
  );
}

export default DamaskFloatCard;
