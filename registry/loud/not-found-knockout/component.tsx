"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Knockout404 — the 404 rendered as literal absence: every frame, a freshly
// refilled --surface plane is carved with destination-out so the numerals
// become holes revealing a deep grain void beneath (precomputed value-noise
// tile + 12 drifting motes), with an inner wall-light glow clipped to the
// holes so the cut reads as depth. A bright stencil bevel rims the cutout,
// rebuilt each frame from ~400 traced edge points whose spring-loaded
// normals bulge outward near the cursor (gaussian falloff, one small
// overshoot, forced-settle deadline). Because the frame starts from an
// explicit full clear and the carve always composites against a fresh fill,
// destination-out alpha can never accumulate or quantize — by construction.
// Canvas 2D, refs-only hot path, sleeps at cursor idle + settled springs.
// Copy and CTAs are DOM, offset-transformed from the container center.
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];

function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex.slice(0, 1) + hex.slice(0, 1), 16);
      const g = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
      const b = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
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

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function css(c: Vec3): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// deterministic prng — grain field + mote seeding stay stable across themes
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -- seamless 128px value-noise field, computed once per module ------------
const GRAIN = 128;
let noiseCache: Float32Array | null = null;
function noiseField(): Float32Array {
  if (noiseCache) return noiseCache;
  const f = new Float32Array(GRAIN * GRAIN);
  const rand = mulberry32(0x1a2b3c);
  const octave = (cells: number, weight: number) => {
    const lat = new Float32Array(cells * cells);
    for (let i = 0; i < lat.length; i++) lat[i] = rand();
    const sm = (t: number) => t * t * (3 - 2 * t);
    for (let y = 0; y < GRAIN; y++) {
      const gy = (y / GRAIN) * cells;
      const y0 = Math.floor(gy) % cells;
      const y1 = (y0 + 1) % cells;
      const ty = sm(gy - Math.floor(gy));
      for (let x = 0; x < GRAIN; x++) {
        const gx = (x / GRAIN) * cells;
        const x0 = Math.floor(gx) % cells;
        const x1 = (x0 + 1) % cells;
        const tx = sm(gx - Math.floor(gx));
        const a = lat[y0 * cells + x0] + (lat[y0 * cells + x1] - lat[y0 * cells + x0]) * tx;
        const b = lat[y1 * cells + x0] + (lat[y1 * cells + x1] - lat[y1 * cells + x0]) * tx;
        f[y * GRAIN + x] += weight * (a + (b - a) * ty);
      }
    }
  };
  octave(8, 0.5); // slow undulation
  octave(32, 0.3); // mid grain
  for (let i = 0; i < f.length; i++) f[i] += 0.2 * rand(); // fine speckle
  noiseCache = f;
  return f;
}

// -- Moore-neighbor contour tracing over a binary glyph mask ----------------
const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

function traceLoops(mask: Uint8Array, gw: number, gh: number): number[][] {
  const visited = new Uint8Array(gw * gh);
  const loops: number[][] = [];
  const at = (x: number, y: number) =>
    x >= 0 && x < gw && y >= 0 && y < gh && mask[y * gw + x] === 1;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const idx = y * gw + x;
      // a trace starts at an unvisited ink pixel with void to its left —
      // finds outer contours and inner counters (the 0's hole) alike
      if (mask[idx] !== 1 || visited[idx] || at(x - 1, y)) continue;
      const loop: number[] = [];
      let cx = x;
      let cy = y;
      let bdir = 4; // came from the west (the background we scanned across)
      const cap = gw * gh;
      for (let step = 0; step < cap; step++) {
        visited[cy * gw + cx] = 1;
        loop.push(cx, cy);
        let found = -1;
        for (let k = 1; k <= 8; k++) {
          const d = (bdir + k) % 8;
          if (at(cx + DX[d], cy + DY[d])) {
            found = d;
            break;
          }
        }
        if (found < 0) break; // isolated pixel
        cx += DX[found];
        cy += DY[found];
        bdir = (found + 6) % 8;
        if (cx === x && cy === y) break;
      }
      if (loop.length >= 16) loops.push(loop);
    }
  }
  return loops;
}

// resample traced loops to ~total arc-length-even points with outward
// normals; returns (bx,by,nx,ny,d,v) stride-6 floats + loop index ranges
function buildEdgePoints(
  mask: Uint8Array,
  gw: number,
  gh: number,
  scale: number,
  total: number
): { pts: Float32Array; ranges: number[] } {
  const raw = traceLoops(mask, gw, gh);
  const loops: { xs: Float32Array; ys: Float32Array; len: number; cum: Float32Array }[] = [];
  let totalLen = 0;
  for (const flat of raw) {
    const n = flat.length / 2;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = (flat[i * 2] + 0.5) * scale;
      ys[i] = (flat[i * 2 + 1] + 0.5) * scale;
    }
    const cum = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      cum[i + 1] = cum[i] + Math.hypot(xs[j] - xs[i], ys[j] - ys[i]);
    }
    const len = cum[n];
    if (len < 48) continue; // drop specks
    loops.push({ xs, ys, len, cum });
    totalLen += len;
  }
  if (!totalLen) return { pts: new Float32Array(0), ranges: [] };

  const out: number[] = [];
  const ranges: number[] = [];
  for (const loop of loops) {
    const n = Math.max(12, Math.round((loop.len / totalLen) * total));
    const step = loop.len / n;
    const m = loop.xs.length;
    const rx = new Float32Array(n);
    const ry = new Float32Array(n);
    let j = 0;
    for (let k = 0; k < n; k++) {
      const t = k * step;
      while (j < m - 1 && loop.cum[j + 1] < t) j++;
      const segLen = loop.cum[j + 1] - loop.cum[j];
      const u = segLen > 1e-6 ? (t - loop.cum[j]) / segLen : 0;
      const a = j;
      const b = (j + 1) % m;
      rx[k] = loop.xs[a] + (loop.xs[b] - loop.xs[a]) * u;
      ry[k] = loop.ys[a] + (loop.ys[b] - loop.ys[a]) * u;
    }
    // two closed-loop smoothing passes kill raster stairsteps
    for (let pass = 0; pass < 2; pass++) {
      const px = Float32Array.from(rx);
      const py = Float32Array.from(ry);
      for (let i = 0; i < n; i++) {
        const p = (i - 1 + n) % n;
        const q = (i + 1) % n;
        rx[i] = (px[p] + 2 * px[i] + px[q]) / 4;
        ry[i] = (py[p] + 2 * py[i] + py[q]) / 4;
      }
    }
    const base = out.length / 6;
    ranges.push(base, base + n);
    for (let i = 0; i < n; i++) {
      const p = (i - 1 + n) % n;
      const q = (i + 1) % n;
      const tx = rx[q] - rx[p];
      const ty = ry[q] - ry[p];
      const L = Math.hypot(tx, ty);
      let nx = L > 1e-6 ? ty / L : 1;
      let ny = L > 1e-6 ? -tx / L : 0;
      // orient outward — away from glyph ink, so displacement widens the hole
      const sx = Math.round((rx[i] + nx * 3) / scale - 0.5);
      const sy = Math.round((ry[i] + ny * 3) / scale - 0.5);
      if (sx >= 0 && sx < gw && sy >= 0 && sy < gh && mask[sy * gw + sx] === 1) {
        nx = -nx;
        ny = -ny;
      }
      out.push(rx[i], ry[i], nx, ny, 0, 0);
    }
  }
  return { pts: Float32Array.from(out), ranges };
}

// -- tuning -----------------------------------------------------------------
const EDGE_POINTS = 400;
const SIGMA = 120; // px — gaussian falloff of cursor influence
const INFLUENCE_R2 = (SIGMA * 3) * (SIGMA * 3);
const MAX_PUSH = 6; // px — outward displacement ceiling
const SPRING_K = 520; // s⁻² — settle < 400ms
const SPRING_C = 32.8; // ζ ≈ 0.72 → one ~3% overshoot
const SLEEP_MS = 500; // cursor idle before the loop may sleep
const INPUT_CUTOFF_MS = 600; // forced-settle deadline: influence dies here
const HARD_ZERO_MS = 1400; // absolute deadline — springs snapped to rest
const INTRO_MS = 2200; // ambient mote drift on mount before first sleep
const MOTES = 12;
const MOTE_SPEED = 4; // px/s
const MOTE_ALPHA = 0.3;
const GRAIN_ALPHA = 0.2;
const EPS_D = 0.05; // px
const EPS_V = 1; // px/s
const DT_MAX = 0.05;

export function Knockout404({
  glyph = "404",
  message = "This page drifted into the void.",
  primaryLabel = "Take me home",
  primaryHref = "/",
  secondaryLabel = "Contact support",
  secondaryHref = "#support",
  className = "",
}: {
  /** the carved numerals */
  glyph?: string;
  /** muted line floating in the punched negative space */
  message?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const content = contentRef.current;
    if (!root || !canvas || !content) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // offscreen layers: carved plane (dpr-sized), glyph mask (dpr-sized),
    // half-res sampler for edge tracing, 128px grain tile
    const plane = document.createElement("canvas");
    const glyphCv = document.createElement("canvas");
    const sampler = document.createElement("canvas");
    const grainCv = document.createElement("canvas");
    const glowCv = document.createElement("canvas");
    const pctx = plane.getContext("2d");
    const gctx = glyphCv.getContext("2d");
    const sctx = sampler.getContext("2d", { willReadFrequently: true });
    const grctx = grainCv.getContext("2d");
    const glctx = glowCv.getContext("2d");
    if (!pctx || !gctx || !sctx || !grctx || !glctx) return;

    const fontFamily = getComputedStyle(root).fontFamily || "sans-serif";

    // -- token inks: read at mount, re-derived live on theme flips ----------
    let surfaceCss = "#171717";
    let borderCss = "#2e2e2e";
    let mutedCss = "#8f8f8f";
    let voidCss = "#050505";
    let rimShadowCss = "#1c1c1c";
    let rimCatchCss = "#b5b5b5";
    let edgeCss = "#9a9a9a";
    let glowCss = "#b0b0b0";
    let mutedRgb: Vec3 = [143, 143, 143];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background")) ?? [10, 10, 10];
      const fg = parseColor(cs.getPropertyValue("--foreground")) ?? [237, 237, 237];
      const surface = parseColor(cs.getPropertyValue("--surface")) ?? [23, 23, 23];
      const border = parseColor(cs.getPropertyValue("--border")) ?? [46, 46, 46];
      mutedRgb = parseColor(cs.getPropertyValue("--muted")) ?? [143, 143, 143];
      const lum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
      // the void must read CLEARLY dimmer than the surface in BOTH themes:
      // dark crushes --background toward black; light pulls it a solid step
      // toward --foreground — the interior/surface gap is the legibility floor
      voidCss = css(lum < 0.5 ? mix(bg, [0, 0, 0], 0.6) : mix(bg, fg, 0.16));
      surfaceCss = css(surface);
      borderCss = css(border);
      mutedCss = css(mutedRgb);
      // stencil bevel, engraved in both themes: the tone mixed toward the
      // darker token is the top-left inner shadow, the lighter one the
      // bottom-right catch-light — a hole, never an emboss
      const towardFg = mix(border, fg, 0.8);
      const towardBg = mix(border, bg, 0.55);
      rimShadowCss = css(lum < 0.5 ? towardBg : towardFg);
      rimCatchCss = css(lum < 0.5 ? towardFg : towardBg);
      // crisp definition stroke + inner wall-light, both toward --foreground:
      // brighter than the surface in dark, darker than the surface in light
      edgeCss = css(mix(border, fg, 0.55));
      glowCss = css(mix(mutedRgb, fg, 0.45));
    };
    derive();

    // grain tile: recolor the cached noise field in --muted per theme
    let grainPattern: CanvasPattern | null = null;
    const buildGrain = () => {
      const f = noiseField();
      grainCv.width = GRAIN;
      grainCv.height = GRAIN;
      const img = grctx.createImageData(GRAIN, GRAIN);
      const d = img.data;
      for (let i = 0; i < f.length; i++) {
        const v = Math.min(1, Math.max(0, f[i]));
        d[i * 4] = mutedRgb[0];
        d[i * 4 + 1] = mutedRgb[1];
        d[i * 4 + 2] = mutedRgb[2];
        d[i * 4 + 3] = Math.round(255 * GRAIN_ALPHA * (0.3 + 0.7 * v));
      }
      grctx.putImageData(img, 0, 0);
      grainPattern = ctx.createPattern(grainCv, "repeat");
    };
    buildGrain();

    // -- sizing: explicit style.width/height — inset does not size a canvas -
    let w = 0;
    let h = 0;
    let dpr = 1;
    let fs = 0; // glyph font size in css px
    let glyphW = 0;
    let sized = false;
    let ready = false; // fonts loaded + assets built

    const buildGlyph = () => {
      fs = Math.min(0.38 * w, 0.62 * h);
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gctx.clearRect(0, 0, w, h);
      gctx.font = `600 ${fs}px ${fontFamily}`;
      gctx.textAlign = "center";
      gctx.textBaseline = "middle";
      gctx.fillStyle = "#fff"; // alpha mask — only coverage matters
      gctx.fillText(glyph, w / 2, h * 0.46);
      glyphW = gctx.measureText(glyph).width;
    };

    // -- edge points: glyph outline sampled once per resize -----------------
    let pts: Float32Array = new Float32Array(0);
    let ranges: number[] = [];
    const buildEdges = () => {
      const scale = 2; // half-res mask is plenty after smoothing
      const gw = Math.max(1, Math.ceil(w / scale));
      const gh = Math.max(1, Math.ceil(h / scale));
      sampler.width = gw;
      sampler.height = gh;
      sctx.font = `600 ${fs / scale}px ${fontFamily}`;
      sctx.textAlign = "center";
      sctx.textBaseline = "middle";
      sctx.fillStyle = "#fff";
      sctx.fillText(glyph, w / 2 / scale, (h * 0.46) / scale);
      const data = sctx.getImageData(0, 0, gw, gh).data;
      const mask = new Uint8Array(gw * gh);
      for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 127 ? 1 : 0;
      const res = buildEdgePoints(mask, gw, gh, scale, EDGE_POINTS);
      pts = res.pts;
      ranges = res.ranges;
    };

    // -- inner wall-light: soft glow hugging the cut edge, clipped to the
    // holes via destination-in against the glyph mask — static per
    // resize/theme, so draw() just blits it. This is what makes the digit
    // interiors read as carved depth instead of vanishing into the void.
    const buildGlow = () => {
      if (!ranges.length) return;
      glowCv.width = canvas.width;
      glowCv.height = canvas.height;
      glctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      glctx.clearRect(0, 0, w, h);
      glctx.strokeStyle = glowCss;
      glctx.lineJoin = "round";
      glctx.beginPath();
      for (let r = 0; r < ranges.length; r += 2) {
        const s = ranges[r];
        const e = ranges[r + 1];
        for (let i = s; i < e; i++) {
          const o = i * 6;
          if (i === s) glctx.moveTo(pts[o], pts[o + 1]);
          else glctx.lineTo(pts[o], pts[o + 1]);
        }
        glctx.closePath();
      }
      const blur = Math.max(14, fs * 0.07);
      glctx.shadowColor = glowCss;
      glctx.lineWidth = 3;
      glctx.shadowBlur = blur;
      glctx.globalAlpha = 0.85;
      glctx.stroke();
      glctx.shadowBlur = blur * 2.4;
      glctx.globalAlpha = 0.5;
      glctx.stroke();
      glctx.shadowBlur = 0;
      glctx.globalAlpha = 1;
      glctx.globalCompositeOperation = "destination-in";
      glctx.setTransform(1, 0, 0, 1, 0, 0);
      glctx.drawImage(glyphCv, 0, 0);
      glctx.globalCompositeOperation = "source-over";
    };

    // -- motes: 12 slow sparks wrapped inside the glyph's bounding box ------
    const moteX = new Float32Array(MOTES);
    const moteY = new Float32Array(MOTES);
    const moteVX = new Float32Array(MOTES);
    const moteVY = new Float32Array(MOTES);
    const moteS = new Float32Array(MOTES);
    let bx0 = 0;
    let bx1 = 0;
    let by0 = 0;
    let by1 = 0;
    const initMotes = () => {
      const pad = 32;
      bx0 = Math.max(0, w / 2 - glyphW / 2 - pad);
      bx1 = Math.min(w, w / 2 + glyphW / 2 + pad);
      by0 = Math.max(0, h * 0.46 - fs * 0.38 - pad);
      by1 = Math.min(h, h * 0.46 + fs * 0.38 + pad);
      const rand = mulberry32(0x404);
      for (let i = 0; i < MOTES; i++) {
        moteX[i] = bx0 + rand() * (bx1 - bx0);
        moteY[i] = by0 + rand() * (by1 - by0);
        const a = rand() * Math.PI * 2;
        moteVX[i] = Math.cos(a) * MOTE_SPEED;
        moteVY[i] = Math.sin(a) * MOTE_SPEED;
        moteS[i] = i % 3 === 0 ? 2 : 1;
      }
    };

    const placeContent = () => {
      // copy/CTAs hang below the numerals: OFFSET transform from container
      // center — never absolute canvas coords
      content.style.transform = `translate(-50%, ${Math.round(fs * 0.38 + 28)}px)`;
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false; // zero-size guard — loop no-ops until real
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${w}px`; // replaced element: size explicitly
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      plane.width = canvas.width;
      plane.height = canvas.height;
      glyphCv.width = canvas.width;
      glyphCv.height = canvas.height;
      sized = true;
      if (ready) {
        buildGlyph();
        buildEdges();
        buildGlow();
        initMotes();
        placeContent();
      }
    };
    resize();

    const strokeRim = (
      ox: number,
      oy: number,
      color: string,
      alpha: number,
      width = 1
    ) => {
      if (!ranges.length) return;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let r = 0; r < ranges.length; r += 2) {
        const s = ranges[r];
        const e = ranges[r + 1];
        for (let i = s; i < e; i++) {
          const o = i * 6;
          const x = pts[o] + pts[o + 2] * pts[o + 4];
          const y = pts[o + 1] + pts[o + 3] * pts[o + 4];
          if (i === s) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      if (!sized || !ready) return;
      // explicit full clear — nothing survives from the previous frame
      ctx.clearRect(0, 0, w, h);
      // (a) void backdrop: dim base, tiled grain, drifting motes
      ctx.fillStyle = voidCss;
      ctx.fillRect(0, 0, w, h);
      if (grainPattern) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // device px → crisp grain
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
      ctx.globalAlpha = MOTE_ALPHA;
      ctx.fillStyle = mutedCss;
      for (let i = 0; i < MOTES; i++) {
        const s = moteS[i];
        ctx.fillRect(moteX[i] - s / 2, moteY[i] - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      // (b)+(c) surface plane refilled fresh, then carved: destination-out
      // only ever composites against this frame's fill — no accumulation
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pctx.clearRect(0, 0, w, h);
      pctx.fillStyle = surfaceCss;
      pctx.fillRect(0, 0, w, h);
      pctx.globalCompositeOperation = "destination-out";
      pctx.drawImage(glyphCv, 0, 0, w, h);
      pctx.globalCompositeOperation = "source-over";
      ctx.drawImage(plane, 0, 0, w, h);
      // (c2) inner wall-light blit — the holes catch light along their edges
      if (glowCv.width > 0) ctx.drawImage(glowCv, 0, 0, w, h);
      // (d) stencil bevel rim, restroked from the displaced point list —
      // bright catch + 1.5px definition stroke keep the digits unmistakable
      strokeRim(-0.75, -0.75, rimShadowCss, 0.95);
      strokeRim(0.75, 0.75, rimCatchCss, 1);
      strokeRim(0, 0, edgeCss, 1, 1.5);
    };

    // -- hot-path state: locals only, never React state ---------------------
    let raf = 0;
    let last = 0;
    let visible = true;
    let px = 0;
    let py = 0;
    let pointerActive = false;
    let lastMove = -1e9;
    let disposed = false;
    const mountedAt = performance.now();

    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden || !sized || !ready) {
        last = 0;
        return; // observers/visibilitychange wake us
      }
      const dt = last === 0 ? 1 / 60 : Math.min(DT_MAX, (now - last) / 1000);
      last = now;
      const idle = now - lastMove;

      // edge springs — cursor influence dies at the forced-settle deadline,
      // and a hard deadline snaps everything to rest so sleep is guaranteed
      let settled = true;
      const n = pts.length / 6;
      if (idle > HARD_ZERO_MS) {
        for (let i = 0; i < n; i++) {
          pts[i * 6 + 4] = 0;
          pts[i * 6 + 5] = 0;
        }
      } else {
        const influence = pointerActive && idle < INPUT_CUTOFF_MS;
        for (let i = 0; i < n; i++) {
          const o = i * 6;
          let target = 0;
          if (influence) {
            const dx = px - pts[o];
            const dy = py - pts[o + 1];
            const d2 = dx * dx + dy * dy;
            if (d2 < INFLUENCE_R2) {
              target = MAX_PUSH * Math.exp(-d2 / (2 * SIGMA * SIGMA));
            }
          }
          let d = pts[o + 4];
          let v = pts[o + 5];
          const a = SPRING_K * (target - d) - SPRING_C * v;
          v += a * dt;
          d += v * dt;
          pts[o + 4] = d;
          pts[o + 5] = v;
          if (Math.abs(d - target) > EPS_D || Math.abs(v) > EPS_V || target > EPS_D) {
            settled = false;
          }
        }
      }

      // motes: 4px/s ambient drift on wrapped paths inside the glyph bbox
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw > 1 && bh > 1) {
        for (let i = 0; i < MOTES; i++) {
          let x = moteX[i] + moteVX[i] * dt;
          let y = moteY[i] + moteVY[i] * dt;
          if (x < bx0) x += bw;
          else if (x > bx1) x -= bw;
          if (y < by0) y += bh;
          else if (y > by1) y -= bh;
          moteX[i] = x;
          moteY[i] = y;
        }
      }

      draw();

      // sleep: cursor idle past threshold, springs under epsilon, intro done
      if (idle > SLEEP_MS && settled && now - mountedAt > INTRO_MS) {
        last = 0;
        return; // motes freeze with the loop — redraw resumes on wake
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (reduced || raf || disposed) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      px = e.clientX - rect.left;
      py = e.clientY - rect.top;
      pointerActive = true;
      lastMove = performance.now();
      wake();
    };
    const onLeave = () => {
      pointerActive = false;
      wake(); // springs animate home, then the loop sleeps
    };

    // -- observers ----------------------------------------------------------
    const ro = new ResizeObserver(() => {
      resize();
      draw();
      wake();
    });
    ro.observe(root);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(root);
    // live theme re-derive: regenerate inks, grain tile AND glyph canvas
    const mo = new MutationObserver(() => {
      derive();
      buildGrain();
      if (sized && ready) {
        buildGlyph();
        buildGlow();
      }
      draw();
      wake();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    if (!reduced) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerdown", onMove);
      root.addEventListener("pointerleave", onLeave);
    }

    // rasterize only once Geist is loaded — a fallback-font carve is wrong.
    // reduced motion: this single draw IS the static carved frame.
    document.fonts.ready.then(() => {
      if (disposed) return;
      ready = true;
      if (sized) {
        buildGlyph();
        buildEdges();
        buildGlow();
        initMotes();
        placeContent();
      }
      draw();
      wake();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [glyph]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate min-h-[480px] w-full overflow-hidden bg-background font-sans ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0"
      />
      <h1 className="sr-only">{glyph} — page not found</h1>
      {/* copy + CTAs float in the punched negative space — DOM, offset from center */}
      <div
        ref={contentRef}
        className="absolute left-1/2 top-[46%] flex w-full max-w-md flex-col items-center gap-6 px-6 text-center"
        style={{ transform: "translate(-50%, calc(13vw + 28px))" }}
      >
        <p className="font-mono text-sm text-muted">{message}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a
            href={primaryHref}
            className="inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {primaryLabel}
          </a>
          <a
            href={secondaryHref}
            className="inline-flex items-center justify-center rounded-sm border border-border px-4 py-2 text-sm text-muted transition-colors duration-150 hover:border-foreground/40 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {secondaryLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
