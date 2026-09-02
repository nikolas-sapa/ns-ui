"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// KissCut — a marquee whose content is what REMAINS after a subtraction. A
// laminate web (liner + face stock) runs right-to-left under a rotary die
// that kiss-cuts labels into the face stock only; downstream a stripping bar
// peels the waste matrix off the liner at a fixed 38 degree angle onto a
// growing rewind spool, leaving printed labels sitting on a continuous,
// unbroken liner. The label never moves — the waste around it does, forever.
//
// Everything left of the strip bar is bare, siliconised liner (matrix gone);
// everything right of it still carries an intact matrix (not yet peeled);
// between the strip bar and the die the labels are cut but the matrix has
// not lifted yet; right of the die the sheet is still whole — no score line
// has fired yet. One continuous liner band underlies the entire canvas
// width, unbroken, which is the physical tell that the die went through the
// face stock and NOT the liner.
//
// Two clocks: the web's x-scroll is a pure material-space offset, so the
// score lines, labels and marks travel with the material; the peel ribbon's
// Lambert shade, the bare-liner gloss sheen and the die/strip-bar/spool
// hardware tone are anchored in SCREEN space (they don't scroll) — a fixed
// lamp over moving material, which is also what keeps the already-peeled
// region from reading as a still frame sliding sideways under a crop test.
//
// Three unforced, always-running processes carry "alive at rest" past the
// fast per-label neck/release (2.5s spacing): a 9.3s tension-hunt sine that
// fires a deeper neck once per cycle, a rewind spool that visibly grows and
// slows over 40s then doffs, and a matrix break every 47s that halts and
// re-threads the line.
// ---------------------------------------------------------------------------

export interface KissCutProps {
  /** External pause control (real button, WCAG 2.2.2 stop for motion > 5s). */
  paused?: boolean;
  /** Called with the new paused state after the pause button is pressed. */
  onPausedChange?: (paused: boolean) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// -- real numbers, worked at W = 3*M, M = 340px (see spec) -------------------
const STATIC_TIME = 2.32; // reduced-motion freeze frame, deliberately non-t0
// Label geometry is sized so a card-scale (3:1) frame carries about six
// labels across, each big enough to read as a die-cut sticker with a mark on
// it. The earlier fractions produced 25x19px tiles — a strip of icons, not a
// label web, and at that size no cut line can be legible at all.
const LABEL_H_FRAC = 0.3; // label height as a fraction of M
const LABEL_W_FRAC = 0.4;
const GUTTER_FRAC = 0.075; // matrix between labels — has to be wide enough to see
const MARGIN_TB_FRAC = 0.085;
const CORNER_R_FRAC = 0.045;
const DIE_R_FRAC = 0.11;
const STRIP_BAR_X_FRAC = 0.62;
const STRIP_ANGLE_DEG = 38;
const NECK_RUN_FRAC = 0.03; // of W, the corner-neck's release run
const NECK_SMALL_M = 200; // below this M, necking amplitude rises
const SPOOL_R0_FRAC = 0.045;
const SPOOL_R1_FRAC = 0.11;
const SPOOL_GROW_S = 40;
const SPOOL_DOFF_S = 0.7;
const TENSION_PERIOD_S = 9.3;
const TENSION_EVENT_S = 0.62;
const TENSION_NECK = 0.09;
const BREAK_PERIOD_S = 47;
const BREAK_WHIP_S = 0.26;
const BREAK_DECEL_S = 0.9;
const BREAK_REFORM_S = 0.7; // starts once decel completes
const BREAK_RAMP_S = 1.1; // starts once reform starts (overlaps its tail)
const MARK_COUNT_NORMAL = 7;
const MARK_COUNT_SMALL = 5;
const DPR_CAP = 2;

interface Tokens {
  bg: RGB;
  fg: RGB;
  muted: RGB;
  border: RGB;
  lightAnchor: RGB; // whichever of bg/fg is the lighter token, this theme
  darkAnchor: RGB;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB | null {
  // Tokens are authored in both notations: this project's light --background is
  // "#fff" while every other stop is six digits. A six-digit-only parser
  // returned null for light theme, readTokens() bailed, and the component never
  // sized or painted its canvas at all — alive in dark, a dead 300x150 default
  // canvas in light.
  let clean = hex.trim().replace("#", "");
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
}

function luma(c: RGB): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function css(c: RGB, alpha = 1): string {
  return `rgba(${c.r.toFixed(0)}, ${c.g.toFixed(0)}, ${c.b.toFixed(0)}, ${alpha})`;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const bg = hexToRgb(cs.getPropertyValue("--background"));
  const fg = hexToRgb(cs.getPropertyValue("--foreground"));
  const muted = hexToRgb(cs.getPropertyValue("--ns-muted"));
  const border = hexToRgb(cs.getPropertyValue("--border"));
  if (!bg || !fg || !muted || !border) return null; // stylesheet not applied yet
  const lightAnchor = luma(bg) >= luma(fg) ? bg : fg;
  const darkAnchor = lightAnchor === bg ? fg : bg;
  return { bg, fg, muted, border, lightAnchor, darkAnchor };
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

// smooth 0..1..0 bump, centered at 0, half-width 1
function bump(x: number): number {
  const c = Math.max(0, 1 - Math.abs(x));
  return c * c * (3 - 2 * c);
}

function easeInQuad(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c;
}

function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

interface Palette {
  liner: RGB;
  bareLiner: RGB;
  faceStock: RGB;
  scoreGroove: RGB;
  scoreShoulder: RGB;
  ribbonLight: RGB;
  ribbonDark: RGB;
  underside: RGB;
  mark: RGB;
  hardware: RGB;
}

function buildPalette(tokens: Tokens, isDark: boolean): Palette {
  // Three tones have to be separable at a glance, because the whole mechanic
  // is a subtraction between them: liner (the layer the die never cuts),
  // face stock / matrix (the layer it does), and bare liner (where the
  // matrix has been carried away). At the old 0.12/0.20 spacing they were
  // within 0.08 of each other — physically tidy, visually one grey.
  const linerT = isDark ? 0.07 : 0.12;
  const faceT = isDark ? 0.58 : 0.3;
  const liner = mix(tokens.bg, tokens.fg, linerT);
  const faceStock = mix(tokens.bg, tokens.fg, faceT);
  // siliconised bare liner reads glossier: nudged toward this theme's light
  // anchor (not a literal white — whichever of bg/fg is actually lighter).
  const bareLiner = mix(liner, tokens.lightAnchor, 0.14);
  const scoreGroove = mix(faceStock, tokens.darkAnchor, 0.62);
  const scoreShoulder = mix(faceStock, tokens.lightAnchor, 0.32);
  const ribbonLight = mix(faceStock, tokens.lightAnchor, 0.42);
  const ribbonDark = mix(faceStock, tokens.darkAnchor, 0.42);
  const underside = mix(liner, faceStock, 0.5);
  return {
    liner,
    bareLiner,
    faceStock,
    scoreGroove,
    scoreShoulder,
    ribbonLight,
    ribbonDark,
    underside,
    mark: tokens.fg,
    hardware: tokens.muted,
  };
}

interface Layout {
  w: number;
  h: number;
  M: number;
  v: number; // px/s, right-to-left
  labelW: number;
  labelH: number;
  gutter: number;
  marginTB: number;
  unitPeriod: number;
  cornerR: number;
  dieR: number;
  dieX: number;
  stripBarX: number;
  webCenterY: number;
  webTop: number;
  webBottom: number;
  spoolCx: number;
  spoolCy: number;
  ribbonRunLen: number;
  neckFrac: number;
  markCount: number;
  phaseOffset: number;
}

function computeLayout(w: number, h: number): Layout {
  const M = Math.min(w, h);
  const v = 0.4 * w;
  const labelW = LABEL_W_FRAC * M;
  const labelH = LABEL_H_FRAC * M;
  const gutter = GUTTER_FRAC * M;
  const marginTB = MARGIN_TB_FRAC * M;
  const unitPeriod = labelW + gutter;
  const cornerR = CORNER_R_FRAC * M;
  const dieR = DIE_R_FRAC * M;
  const stripBarX = STRIP_BAR_X_FRAC * w;
  const dieX = Math.min(w - dieR - Math.max(8, 0.04 * w), Math.max(stripBarX + unitPeriod * 1.6, w - 0.15 * w));
  const webCenterY = h * 0.56;
  const webTop = webCenterY - (labelH / 2 + marginTB);
  const webBottom = webCenterY + (labelH / 2 + marginTB);
  // The rewind spool sits wherever the fixed 38-degree peel ribbon actually
  // ends up-and-right of the strip bar, clamped so its largest radius still
  // clears the right and top edges — derived FROM the strip angle rather
  // than placed independently and aimed at, which is what kept an earlier
  // build's ribbon shooting off the top of the canvas.
  const angRad = (STRIP_ANGLE_DEG * Math.PI) / 180;
  const dx = Math.cos(angRad);
  const dyUp = Math.sin(angRad); // canvas y decreases upward
  const spoolPad = SPOOL_R1_FRAC * M + 8;
  const maxRunX = (w - stripBarX - spoolPad) / dx;
  const maxRunY = (webTop - spoolPad) / dyUp;
  const runLen = Math.max(24, Math.min(maxRunX, maxRunY));
  const spoolCx = stripBarX + dx * runLen;
  const spoolCy = webTop - dyUp * runLen;
  const neckFrac = M < NECK_SMALL_M ? 0.1 : 0.06;
  const markCount = M < NECK_SMALL_M ? MARK_COUNT_SMALL : MARK_COUNT_NORMAL;
  // choose the material-space origin so a label's leading edge sits exactly
  // on the strip bar at t = STATIC_TIME — makes the named reduced-motion
  // frame (peel front at a corner, matrix necked to minimum) exact rather
  // than incidental, and it is re-derived here on every resize.
  const r = mod(stripBarX + v * STATIC_TIME, unitPeriod);
  const phaseOffset = -r;
  return {
    w,
    h,
    M,
    v,
    labelW,
    labelH,
    gutter,
    marginTB,
    unitPeriod,
    cornerR,
    dieR,
    dieX,
    stripBarX,
    webCenterY,
    webTop,
    webBottom,
    spoolCx,
    spoolCy,
    ribbonRunLen: runLen,
    neckFrac,
    markCount,
    phaseOffset,
  };
}

// Break-cycle speed multiplier and matrix-connection state as a function of
// local time since the last break started (t in [0, BREAK_PERIOD_S)).
interface BreakState {
  speedMul: number;
  matrixConnected: boolean; // false while whipping free / stopped
  reformFrac: number; // 0..1 ribbon regrowth once it re-threads
  whipT: number; // 0..1 progress through the free-whip beat, else -1
}

function breakState(tLocal: number): BreakState {
  const decelEnd = BREAK_DECEL_S;
  const reformEnd = decelEnd + BREAK_REFORM_S;
  const rampEnd = decelEnd + BREAK_RAMP_S;
  const cycleEnd = Math.max(reformEnd, rampEnd);
  if (tLocal < 0 || tLocal >= cycleEnd) {
    return { speedMul: 1, matrixConnected: true, reformFrac: 1, whipT: -1 };
  }
  const whipT = tLocal < BREAK_WHIP_S ? tLocal / BREAK_WHIP_S : -1;
  const speedMul = tLocal < decelEnd ? 1 - easeInQuad(tLocal / decelEnd) : tLocal < rampEnd ? easeOutCubic((tLocal - decelEnd) / BREAK_RAMP_S) : 1;
  const matrixConnected = tLocal >= decelEnd + 1e-6;
  const reformFrac = tLocal < decelEnd ? 0 : Math.min(1, (tLocal - decelEnd) / BREAK_REFORM_S);
  return { speedMul, matrixConnected, reformFrac, whipT };
}

// Deterministic tiny abstract mark drawn inside a label rect, purely from
// --foreground strokes — never a real logo, wordmark or brand shape.
function drawMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  boxW: number,
  boxH: number,
  seed: number,
  color: string,
) {
  // A printed label carries a lock-up, not a lone pictogram: a geometric
  // glyph plus two wordmark bars standing in for a name. Deterministic and
  // deliberately generic — never a real logo, wordmark or brand shape.
  const s = boxH;
  const glyphCx = cx - boxW / 2 + s * 0.5;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.2, s * 0.11);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.9;

  ctx.save();
  ctx.translate(glyphCx, cy);
  const kind = seed % 5;
  ctx.beginPath();
  if (kind === 0) {
    // stacked chevrons
    for (let i = 0; i < 2; i++) {
      const o = i * s * 0.26;
      ctx.moveTo(-s * 0.3, s * 0.1 + o);
      ctx.lineTo(0, -s * 0.24 + o);
      ctx.lineTo(s * 0.3, s * 0.1 + o);
    }
    ctx.stroke();
  } else if (kind === 1) {
    // solid square with a knocked-out bar
    ctx.fillRect(-s * 0.32, -s * 0.32, s * 0.64, s * 0.64);
    ctx.clearRect(-s * 0.12, -s * 0.34, s * 0.18, s * 0.68);
  } else if (kind === 2) {
    // ring plus a solid counter
    ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 3) {
    // three ascending bars
    for (let i = 0; i < 3; i++) {
      const bx = -s * 0.26 + i * s * 0.26;
      const bh = s * (0.22 + i * 0.18);
      ctx.moveTo(bx, s * 0.32);
      ctx.lineTo(bx, s * 0.32 - bh);
    }
    ctx.stroke();
  } else {
    // triangle over a rule
    ctx.moveTo(-s * 0.3, s * 0.12);
    ctx.lineTo(0, -s * 0.32);
    ctx.lineTo(s * 0.3, s * 0.12);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, s * 0.32);
    ctx.lineTo(s * 0.3, s * 0.32);
    ctx.stroke();
  }
  ctx.restore();

  // wordmark: two bars, second one shorter, at label-caption proportions
  const barX = glyphCx + s * 0.62;
  const barMax = cx + boxW / 2 - barX;
  if (barMax > s * 0.3) {
    const barH = Math.max(2, s * 0.17);
    ctx.globalAlpha = 0.82;
    ctx.fillRect(barX, cy - barH * 1.4, barMax * (0.5 + (seed % 3) * 0.14), barH);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(barX, cy + barH * 0.5, barMax * (0.32 + (seed % 2) * 0.16), barH);
  }
  ctx.restore();
}

export function KissCut({ paused: pausedProp, onPausedChange, className = "" }: KissCutProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [internalPaused, setInternalPaused] = useState(false);
  const paused = pausedProp ?? internalPaused;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const onMq = () => {
      reduced = mq.matches;
      if (reduced && sized && tokens) {
        drawStatic();
      } else if (!reduced) {
        kick();
      }
    };
    mq.addEventListener("change", onMq);

    let disposed = false;
    let tokens: Tokens | null = null;
    let isDark = false;
    let palette: Palette | null = null;
    let layout: Layout | null = null;
    let dpr = 1;
    let w = 0;
    let h = 0;
    let sized = false;
    let visible = true;
    let started = false;

    let raf = 0;
    let tokenWaitRaf = 0;
    let last = 0;

    // -- sim state, live loop only (unused in reduced-motion) --------------
    let scrollX = 0; // accumulated material-space travel, px
    let dieAngle = 0;
    let simT = 0;

    const readAll = () => {
      tokens = readTokens();
      if (!tokens) return false;
      isDark = document.documentElement.classList.contains("dark");
      palette = buildPalette(tokens, isDark);
      return true;
    };

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      w = rect.width;
      h = rect.height;
      layout = computeLayout(w, h);
      fitCanvas();
      sized = true;
    };

    // -- geometric helpers ---------------------------------------------------
    // screen-space left edge of material label index k, at material-scroll
    // position `scroll` (px). Web travels right-to-left as scroll grows.
    const labelScreenX = (L: Layout, k: number, scroll: number) => k * L.unitPeriod - scroll - L.phaseOffset;

    // corner-neck: 0..1 bump as a label's leading edge nears the strip bar.
    const cornerNeck = (L: Layout, scroll: number) => {
      const nearestK = Math.round((L.stripBarX + scroll + L.phaseOffset) / L.unitPeriod);
      const edgeX = labelScreenX(L, nearestK, scroll);
      const run = NECK_RUN_FRAC * L.w;
      return bump((edgeX - L.stripBarX) / run);
    };

    const tensionNeck = (t: number) => {
      const phase = mod(t, TENSION_PERIOD_S) / TENSION_PERIOD_S; // 0..1
      // sine peaks at phase 0.25; event window is TENSION_EVENT_S wide
      const distPhase = Math.abs(phase - 0.25);
      const halfWidthPhase = TENSION_EVENT_S / 2 / TENSION_PERIOD_S;
      return bump(distPhase / halfWidthPhase);
    };

    // grows 0.045*M -> 0.11*M over 40s, then doffs (eases back down) over a
    // final 700ms before a fresh core starts the next cycle.
    const spoolRadius = (L: Layout, t: number) => {
      const cycle = mod(t, SPOOL_GROW_S + SPOOL_DOFF_S);
      let frac: number;
      if (cycle < SPOOL_GROW_S) {
        frac = cycle / SPOOL_GROW_S;
      } else {
        const doffT = (cycle - SPOOL_GROW_S) / SPOOL_DOFF_S;
        frac = 1 - easeInQuad(doffT);
      }
      return (SPOOL_R0_FRAC + (SPOOL_R1_FRAC - SPOOL_R0_FRAC) * frac) * L.M;
    };

    // -- drawing --------------------------------------------------------------
    const drawFrame = (L: Layout, P: Palette, scroll: number, angle: number, t: number, breakLocalT: number) => {
      ctx.clearRect(0, 0, w, h);

      // continuous liner band — unbroken across the whole width. This is the
      // physical tell the spec calls out: the die never touched this layer.
      ctx.fillStyle = css(P.liner);
      ctx.fillRect(0, L.webTop, w, L.webBottom - L.webTop);

      // The subtraction, stated in one edge: right of the strip bar the face
      // stock is still a continuous sheet (labels are only SCORED into it,
      // which is what a kiss cut is); left of it the matrix has been carried
      // away and the labels stand alone on bare liner. Filling the two
      // regions as whole sheets — instead of tinting each gutter cell —
      // makes the boundary a single hard tonal step, which is the only way
      // the mechanic survives at card scale.
      const bandH = L.webBottom - L.webTop;
      ctx.fillStyle = css(P.faceStock);
      ctx.fillRect(L.stripBarX, L.webTop, w - L.stripBarX, bandH);
      ctx.fillStyle = css(P.bareLiner);
      ctx.fillRect(0, L.webTop, L.stripBarX, bandH);

      const bs = breakState(breakLocalT);

      // -- label / matrix cells --------------------------------------------
      const kMin = Math.floor((scroll + L.phaseOffset - L.labelW) / L.unitPeriod) - 1;
      const kMax = Math.ceil((scroll + L.phaseOffset + w) / L.unitPeriod) + 1;
      for (let k = kMin; k <= kMax; k++) {
        const leftX = labelScreenX(L, k, scroll);
        const labelLeft = leftX;
        const labelRight = leftX + L.labelW;
        if (labelRight < -4 || labelLeft > w + 4) continue;

        // label rect (face stock). Past the strip bar it is the only face
        // stock left on the liner; before it, it is indistinguishable from
        // the sheet it is still part of, and only the score line marks it.
        const ry = L.webCenterY - L.labelH / 2;
        ctx.fillStyle = css(P.faceStock);
        roundRect(ctx, labelLeft, ry, L.labelW, L.labelH, L.cornerR);
        ctx.fill();
        if (labelLeft + L.labelW < L.stripBarX) {
          // stripped labels lie proud of the liner: a contact shadow under
          // the lower edge plus a touch more light on the face. Without the
          // shadow they read as flat chips printed on a bar.
          ctx.fillStyle = css(P.scoreGroove, 0.35);
          roundRect(ctx, labelLeft, ry + Math.max(1.5, L.labelH * 0.05), L.labelW, L.labelH, L.cornerR);
          ctx.fill();
          ctx.fillStyle = css(P.faceStock);
          roundRect(ctx, labelLeft, ry, L.labelW, L.labelH, L.cornerR);
          ctx.fill();
          ctx.fillStyle = css(P.scoreShoulder, 0.22);
          roundRect(ctx, labelLeft, ry, L.labelW, L.labelH, L.cornerR);
          ctx.fill();
        }

        // kiss-cut score line — a groove + a lit shoulder, never a border
        // token, never a colour flash: geometry (a two-stroke offset pair)
        // is what reads as "cut", and it fades in as the die passes.
        const revealFrac = Math.min(1, Math.max(0, (L.dieX - labelLeft) / L.labelW));
        if (revealFrac > 0.02) {
          ctx.globalAlpha = revealFrac;
          ctx.lineWidth = 1;
          ctx.strokeStyle = css(P.scoreGroove, 0.9);
          roundRectPath(ctx, labelLeft + 0.5, ry + 0.5, L.labelW - 1, L.labelH - 1, L.cornerR);
          ctx.stroke();
          ctx.strokeStyle = css(P.scoreShoulder, 0.55);
          roundRectPath(ctx, labelLeft + 1.5, ry + 1.5, L.labelW - 3, L.labelH - 3, Math.max(0, L.cornerR - 1));
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // mark — printed on the face stock, independent of the cut state
        if (labelRight > 0 && labelLeft < w) {
          const markSeed = ((k % L.markCount) + L.markCount) % L.markCount;
          drawMark(ctx, labelLeft + L.labelW / 2, L.webCenterY, L.labelW * 0.76, L.labelH * 0.5, markSeed, css(P.mark, 0.85));
        }
      }

      // -- fixed-screen-space bare-liner gloss sheen, only over the region
      // left of the strip bar. Anchored in canvas coordinates (not material
      // coordinates), so it does not travel with the web — a still light
      // over moving material, which keeps the peeled region from reading as
      // a static frame sliding sideways. --------------------------------
      if (L.stripBarX > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, L.webTop, L.stripBarX, L.webBottom - L.webTop);
        ctx.clip();
        const sheen = ctx.createLinearGradient(0, L.webTop, L.stripBarX * 0.6, L.webBottom);
        sheen.addColorStop(0, css(P.bareLiner, 0));
        sheen.addColorStop(0.45, css(P.bareLiner, 0.22));
        sheen.addColorStop(0.55, css(P.bareLiner, 0.22));
        sheen.addColorStop(1, css(P.bareLiner, 0));
        ctx.fillStyle = sheen;
        ctx.fillRect(0, L.webTop, L.stripBarX, L.webBottom - L.webTop);
        ctx.restore();
      }

      // -- stripping bar (drawn hardware object) ---------------------------
      ctx.strokeStyle = css(P.hardware, 0.85);
      ctx.lineWidth = Math.max(2, L.M * 0.012);
      ctx.beginPath();
      ctx.moveTo(L.stripBarX, L.webTop - L.M * 0.02);
      ctx.lineTo(L.stripBarX, L.webBottom + L.M * 0.02);
      ctx.stroke();

      // -- peeling matrix ribbon: fixed strip angle, screen-anchored Lambert
      // shade, geometry-only necking (corner + tension), whip/reform states
      // during a matrix break. -------------------------------------------
      const corner = cornerNeck(L, scroll);
      const tension = tensionNeck(t);
      const neckAmt = Math.min(0.8, L.neckFrac * corner + TENSION_NECK * tension);
      const baseRibbonW = L.labelH + 2 * L.marginTB;

      const angRad = (STRIP_ANGLE_DEG * Math.PI) / 180;
      const dx = Math.cos(angRad);
      const dy = -Math.sin(angRad); // canvas y decreases upward

      if (bs.whipT >= 0) {
        // free end whipping — a short disconnected stub flicking further off
        // the fixed strip-angle line, snapping back toward it as it settles.
        const flick = 0.35 * Math.sin(bs.whipT * Math.PI);
        const len = baseRibbonW * 1.6 * (1 - bs.whipT * 0.3);
        const x0 = L.stripBarX;
        const y0 = L.webTop;
        const x1 = x0 + (dx - dy * flick) * len;
        const y1 = y0 + (dy + dx * flick) * len;
        ctx.strokeStyle = css(P.ribbonDark, 0.8);
        ctx.lineWidth = Math.max(1.5, baseRibbonW * 0.22);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      } else if (bs.matrixConnected) {
        const ribbonW = Math.max(2, (baseRibbonW * (1 - neckAmt) * bs.reformFrac) || 2);
        const runLen = L.ribbonRunLen;
        const x0 = L.stripBarX;
        const y0 = L.webTop;
        const x1 = x0 + dx * runLen;
        const y1 = y0 + dy * runLen;
        // perpendicular for ribbon width
        const px = -dy;
        const py = dx;
        const w2 = ribbonW / 2;
        ctx.beginPath();
        ctx.moveTo(x0 + px * w2, y0 + py * w2);
        ctx.lineTo(x1 + px * w2, y1 + py * w2);
        ctx.lineTo(x1 - px * w2, y1 - py * w2);
        ctx.lineTo(x0 - px * w2, y0 - py * w2);
        ctx.closePath();
        // Lambert shade, fixed in screen space: gradient anchored to the
        // stripBar/spool bounding box, azimuth-derived direction, not tied
        // to the ribbon's per-frame local frame.
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0, css(P.underside, 0.95));
        grad.addColorStop(0.15, css(P.ribbonDark, 0.95));
        grad.addColorStop(0.65, css(P.ribbonLight, 0.95));
        grad.addColorStop(1, css(P.ribbonLight, 0.8));
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // -- rewind spool (drawn hardware object) ----------------------------
      const r = spoolRadius(L, t);
      ctx.strokeStyle = css(P.hardware, 0.9);
      ctx.lineWidth = Math.max(1.5, L.M * 0.01);
      ctx.beginPath();
      ctx.arc(L.spoolCx, L.spoolCy, r, 0, Math.PI * 2);
      ctx.stroke();
      // wound-layer texture, angle-invariant (concentric rings) so it needs
      // no rotation state to look correct in the reduced-motion frame.
      ctx.globalAlpha = 0.5;
      for (let i = 1; i < 4; i++) {
        const rr = r * (i / 4);
        if (rr < 2) continue;
        ctx.beginPath();
        ctx.arc(L.spoolCx, L.spoolCy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // -- rotary die (drawn hardware object), 3 repeats per revolution ----
      ctx.strokeStyle = css(P.hardware, 0.95);
      ctx.lineWidth = Math.max(1.5, L.M * 0.012);
      ctx.beginPath();
      // the die is a roller riding ON the web, so it sits tangent to the top
      // edge — drawn through the labels it read as a circle printed on one
      const dieCy = L.webTop - L.dieR * 0.82;
      ctx.arc(L.dieX, dieCy, L.dieR, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const a = angle + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.moveTo(L.dieX + Math.cos(a) * L.dieR * 0.5, dieCy + Math.sin(a) * L.dieR * 0.5);
        ctx.lineTo(L.dieX + Math.cos(a) * L.dieR * 0.95, dieCy + Math.sin(a) * L.dieR * 0.95);
        ctx.stroke();
      }

      // -- band framing hairlines: the only legitimate use of --border ----
      ctx.strokeStyle = css(tokens!.border, 1);
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    };

    const draw = (t: number, breakLocalT: number) => {
      if (!tokens || !palette || !layout || !sized) return;
      drawFrame(layout, palette, scrollX, dieAngle, t, breakLocalT);
    };

    // -- deterministic reduced-motion frame: closed form at STATIC_TIME, no
    // break has fired by then (first break is at 47s) so speedMul === 1 and
    // every quantity is a pure function of the layout + STATIC_TIME. -------
    const drawStatic = () => {
      if (!tokens || !palette || !layout) return;
      const L = layout;
      const sScroll = L.v * STATIC_TIME;
      const sAngle = (L.v / L.dieR) * STATIC_TIME;
      drawFrame(L, palette, sScroll, sAngle, STATIC_TIME, -1);
    };

    const loop = (now: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // re-armed by the IntersectionObserver on re-entry
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens || !layout) return;
      const dt = Math.min(0.05, last === 0 ? 1 / 60 : (now - last) / 1000);
      last = now;

      // Pausing freezes the simulation clock (and thus the drawn frame) but
      // keeps polling rAF, so unpausing resumes instantly with no separate
      // "wake" plumbing required from the pause control.
      if (!pausedRef.current) {
        const breakLocalT = mod(simT, BREAK_PERIOD_S);
        const bs = breakState(breakLocalT);
        scrollX += layout.v * bs.speedMul * dt;
        dieAngle += (layout.v / layout.dieR) * bs.speedMul * dt;
        simT += dt;
      }

      draw(simT, mod(simT, BREAK_PERIOD_S));
    };

    const wake = () => {
      if (!raf && visible) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const kick = () => {
      if (!sized || !tokens) return;
      if (reduced) {
        drawStatic();
        return;
      }
      if (!started) {
        started = true;
        last = 0;
        raf = requestAnimationFrame(loop);
      } else {
        wake();
      }
    };

    const boot = () => {
      if (disposed) return;
      if (!readAll()) {
        tokenWaitRaf = requestAnimationFrame(boot);
        return;
      }
      resize();
      kick();
    };

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resize();
      if (reduced) drawStatic();
      else kick();
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      if (!readAll()) return;
      if (reduced) drawStatic();
      else if (sized) draw(simT, mod(simT, BREAK_PERIOD_S));
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && tokens && !raf) {
        readAll();
        resize();
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(wrap);

    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setPaused = (next: boolean) => {
    onPausedChange?.(next);
    if (pausedProp === undefined) setInternalPaused(next);
  };

  return (
    <div ref={wrapRef} className={`relative w-full overflow-hidden rounded-md border border-border bg-surface ${className}`} style={{ aspectRatio: "3 / 1" }}>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none block h-full w-full" />
      <div role="img" aria-label="A label web is kiss-cut by a rotary die; the waste matrix around the labels peels continuously off the liner at a fixed angle onto a rewind spool, leaving the printed marks behind on an unbroken liner." className="sr-only" />
      <button
        type="button"
        aria-pressed={paused}
        aria-label={paused ? "Resume the kiss-cut marquee" : "Pause the kiss-cut marquee"}
        onClick={() => setPaused(!paused)}
        className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-[6px] border border-border bg-background/70 text-foreground backdrop-blur-md transition-colors duration-150 hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        {paused ? (
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 0.5 L9 5 L1 9.5 Z" fill="currentColor" />
          </svg>
        ) : (
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="1" y="0.5" width="3" height="9" fill="currentColor" />
            <rect x="6" y="0.5" width="3" height="9" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}

// -- canvas roundRect helpers (fill + stroke share the same path builder) --
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  roundRectPath(ctx, x, y, w, h, r);
}
