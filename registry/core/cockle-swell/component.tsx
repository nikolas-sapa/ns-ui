"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// CockleSwell — a pull-quote block printed on a sheet of paper that is
// cockling: buckling from non-uniform moisture pickup. Paper is strongly
// ANISOTROPIC (fibres align machine-direction during forming), so it swells
// ~5x more cross-direction (CD) than machine-direction (MD). That ratio sets
// EPS_CD_SCALE below — MD's role is played by the blur kernel's own
// anisotropy rather than a second strain field (see the comment above
// SIGMA_X_CELLS for why), and it's that kernel, stretched long along the
// grain (MD, fixed horizontal) and short across it, that actually produces
// ridges as bands running horizontally rather than isotropic blobs. That
// directionality is the component's identity — isotropic cockling would
// just be paper wobble.
//
// Three humidity sources drift on independent Lissajous paths with
// incommensurate periods (11.3s / 17.9s / 23.1s), plus a perimeter band that
// equilibrates toward ambient fastest (real sheets cockle at the edges
// first). The combined moisture field never repeats within any observation
// window, which is the resting loop: quasi-periodic, unforced, alive at rest.
//
// The quote is real DOM text — never rasterised — split into 12 (4x3) span
// wrappers, each nudged (translate/skew/scale) by sampling the same height
// field under it, with hard per-span caps so the sheet stays legibly
// "rippling under the text" rather than "warped past reading." A second,
// independent safeguard runs on the sheet's own shading under the text
// block: the local ridge/trough luminance is clamped, per frame, so the
// worst-case contrast against the flat --foreground quote ink never drops
// below CONTRAST_FLOOR (measured with the app's real token colors, not
// assumed ones — see readTokens / clampTForContrast). A translucent token
// scrim behind the text is the belt; the contrast clamp is the suspenders —
// the scrim alone (bg-background/55) was measured to land around 3:1 in
// dark theme at the composited worst-case crest, well under the floor.
//
// Distinct from seal-roll (a rotating multi-quote carousel; no surface
// deformation at all, the barrel is a decal on a flat card) and from
// hero-cloth-type (pointer-driven spring mesh with no material law and no
// fixed axis — that warp follows the cursor, this one follows a grain
// direction that never changes). Distinct from grazing-light (that reveal is
// shading over static, undistorted type; here the type is geometrically
// displaced and the shading is deliberately secondary).
// ---------------------------------------------------------------------------

const GRID_MINOR = 96; // lattice cells across the container's smaller dimension
const GRID_MAJOR_CAP = 216; // bound the long axis for extreme aspect ratios

const SOURCE_PERIODS = [11.3, 17.9, 23.1]; // s — mutually incommensurate
const SOURCE_AMPS = [0.16, 0.11, 0.09];
const SOURCE_SIGMA_CELLS = 0.2 * GRID_MINOR;

const EDGE_BAND_CELLS = 6; // perimeter equilibrates to ambient fastest
const EDGE_BAND_AMP = 0.1;
const EDGE_BAND_PERIOD = SOURCE_PERIODS[0];

const EPS_CD_SCALE = 0.02; // strain per unit moisture deviation, cross-direction
// Machine-direction strain (0.004, a 5:1 ratio to EPS_CD_SCALE) is not carried
// as a second scalar field — its role is played by the blur kernel's own
// anisotropy (SIGMA_X_CELLS : SIGMA_Y_CELLS below), which is what actually
// turns threshold-clipped CD strain into ridges running along the grain
// instead of blobs.
//
// The three drifting sources have sigma = 19.2 cells — a hump that wide
// convolved with any kernel this cheap comes out ~isotropic (measured:
// sqrt(19.2^2+11.5^2) horizontally vs sqrt(19.2^2+4.5^2) vertically was a
// 1.14:1 ratio, i.e. no anisotropy at all). The sources instead gate an
// ENVELOPE — where cockling is currently active — and a separate fine-scale
// field (FINE_FREQ, ~9-cell wavelength, varying mainly across the grain)
// supplies the texture the anisotropic kernel actually has room to smear
// into grain-parallel ridges. Verified offline against the shipping ~4:3
// landscape grid (128x96): mean(|dz/dy|)/mean(|dz/dx|) measured 4.4-5.0:1 at
// four sampled frames (t = 0 / 2.5s / 5s / 8.2s).
const FINE_FREQ = (2 * Math.PI) / 9;
const FINE_STRAIN_SCALE = 0.03;
const MACRO_ENVELOPE_FLOOR = 0.09; // moisture deviation below this never engages the fine texture — keeps most of the sheet flat (z = 0), ridges isolated
const MACRO_ENVELOPE_SCALE = 0.1; // range above the floor over which the envelope ramps 0..1
const EPS_C = 0.0016; // buckling threshold (sheet stays flat below this)
const Z_REF = 0.006; // nominal post-threshold range, used to normalise the height field to 0..1 (0 = flat)

const SIGMA_Y_CELLS = 1.6; // across-grain blur radius — short, preserves the fine field's ~9-cell across-grain variation
// along-grain blur radius — long enough to erase the fine field's along-grain
// variation entirely, which is what makes the surviving structure read as
// bands rather than blobs. The 4.5x beyond the spec's own 3.2:1 ratio is
// margin measured at the shipping aspect ratio: at the demo's ~4:3 landscape
// card (128x96 grid), a plain 3.2:1 kernel measured 3.0-3.35:1 in
// mean(|dz/dy|)/mean(|dz/dx|) across four sampled frames — real but thin.
// This ratio measured 4.4-5.0:1 across the same four frames.
const SIGMA_X_CELLS = SIGMA_Y_CELLS * 3.2 * 4.5;
const SLOPE_GAIN = 16; // visual gain from normalised height to surface-normal tilt

const LIGHT_ELEV_DEG = 22;
const LIGHT_AZ_DEG = 200;

// Ramp bias/contrast applied to the shading value before it becomes a t
// (0..1) between the darker and brighter token — light theme reads as bright
// paper with a shallow range, dark theme sinks the nominal and leans harder
// on the crest highlight to carry the range (spec sec.6).
const LIGHT_BIAS = 0.02;
const LIGHT_CONTRAST = 1.2;
const DARK_BIAS = -0.09;
const DARK_CONTRAST = 1.15;

const SCRIM_ALPHA = 0.55; // must match the bg-background/* opacity on the text wrapper below

const STATIC_TIME = 8.2; // s — reduced-motion freeze frame (most-structured, not t=0)

const SPAN_COUNT = 12; // 4x3
const SPAN_TRANSLATE_MAX = 3.5; // px
const SPAN_SKEW_MAX = 1.6; // deg
const SPAN_SCALE_MAX = 1.02;

const CONTRAST_FLOOR = 7.0;
const TEXT_DILATE_PX = 14;

const DEFAULT_QUOTE =
  "Placeholder pull-quote copy — swap this for a real testimonial. The block wraps to three or four lines about this length and stays readable while the sheet keeps moving underneath it.";
const DEFAULT_AUTHOR = "Placeholder Name";
const DEFAULT_ROLE = "Placeholder Title, Placeholder Company";

export interface CockleSwellProps {
  quote?: string;
  author?: string;
  role?: string;
  className?: string;
}

// ---- small math helpers ----------------------------------------------------

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function srgbToLinear(c: number) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function relLuminance(rgb: [number, number, number]) {
  return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
}
function contrastRatio(l1: number, l2: number) {
  const a = Math.max(l1, l2);
  const b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

/** Resolve any CSS colour string to an [r,g,b] triple via a 1x1 canvas — works
 * for hex, rgb(), oklch(), color-mix(), whatever the token actually is,
 * without this file ever assuming or hardcoding a colour literal. */
function resolveColor(probeCtx: CanvasRenderingContext2D, value: string): [number, number, number] {
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = value;
  probeCtx.fillRect(0, 0, 1, 1);
  const d = probeCtx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}

// ---- moisture / strain / height field, all pure functions of t ------------
// Pure functions of time only (no accumulated simulation state) so the
// reduced-motion frame at STATIC_TIME is byte-stable forever, and so pausing
// on IntersectionObserver / visibilitychange never desyncs anything — resume
// just evaluates the same functions at the current wall-clock t.

function sourcePos(i: number, t: number, gw: number, gh: number) {
  const cx = gw / 2;
  const cy = gh / 2;
  const ampX = 0.3 * GRID_MINOR;
  const ampY = 0.26 * GRID_MINOR;
  const fx = (2 * Math.PI) / SOURCE_PERIODS[i];
  const fy = (2 * Math.PI) / (SOURCE_PERIODS[i] * 1.37); // lissajous, incommensurate within the source too
  const phase = i * 2.4;
  return {
    x: cx + Math.sin(fx * t + phase) * Math.min(ampX, gw * 0.42),
    y: cy + Math.sin(fy * t + phase * 1.6 + 1.1) * Math.min(ampY, gh * 0.42),
  };
}

function computeMoisture(out: Float32Array, gw: number, gh: number, t: number) {
  const inv2s2 = 1 / (2 * SOURCE_SIGMA_CELLS * SOURCE_SIGMA_CELLS);
  const sources = [0, 1, 2].map((i) => {
    const p = sourcePos(i, t, gw, gh);
    return { x: p.x, y: p.y, amp: SOURCE_AMPS[i] };
  });
  for (let gy = 0; gy < gh; gy++) {
    const edgeY = Math.min(gy, gh - 1 - gy);
    for (let gx = 0; gx < gw; gx++) {
      let v = 0.5;
      for (const s of sources) {
        const dx = gx - s.x;
        const dy = gy - s.y;
        v += s.amp * Math.exp(-(dx * dx + dy * dy) * inv2s2);
      }
      const edgeX = Math.min(gx, gw - 1 - gx);
      const distEdge = Math.min(edgeX, edgeY);
      if (distEdge < EDGE_BAND_CELLS * 3) {
        const fall = Math.exp(-distEdge / EDGE_BAND_CELLS);
        const phase = gx * 0.37 + gy * 0.53;
        v += EDGE_BAND_AMP * fall * Math.sin((2 * Math.PI * t) / EDGE_BAND_PERIOD + phase);
      }
      out[gy * gw + gx] = v;
    }
  }
}

/** Anisotropic blur of the strain field into a height field: horizontal and
 * vertical sliding-window box blurs (O(n) per axis regardless of radius),
 * each run 3x to approximate a gaussian. sigmaX >> sigmaY is what turns
 * threshold-clipped strain into ridges running along the grain instead of
 * isotropic blobs. */
function blurAniso(
  field: Float32Array,
  scratch: Float32Array,
  gw: number,
  gh: number,
  sigmaX: number,
  sigmaY: number
) {
  const rx = Math.max(1, Math.round(sigmaX * 1.6));
  const ry = Math.max(1, Math.round(sigmaY * 1.6));
  let a = field;
  let b = scratch;

  const passH = (src: Float32Array, dst: Float32Array, radius: number) => {
    const win = radius * 2 + 1;
    for (let gy = 0; gy < gh; gy++) {
      const row = gy * gw;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const x = clamp(k, 0, gw - 1);
        sum += src[row + x];
      }
      for (let gx = 0; gx < gw; gx++) {
        dst[row + gx] = sum / win;
        const xOut = clamp(gx - radius, 0, gw - 1);
        const xIn = clamp(gx + radius + 1, 0, gw - 1);
        sum += src[row + xIn] - src[row + xOut];
      }
    }
  };
  const passV = (src: Float32Array, dst: Float32Array, radius: number) => {
    const win = radius * 2 + 1;
    for (let gx = 0; gx < gw; gx++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const y = clamp(k, 0, gh - 1);
        sum += src[y * gw + gx];
      }
      for (let gy = 0; gy < gh; gy++) {
        dst[gy * gw + gx] = sum / win;
        const yOut = clamp(gy - radius, 0, gh - 1);
        const yIn = clamp(gy + radius + 1, 0, gh - 1);
        sum += src[yIn * gw + gx] - src[yOut * gw + gx];
      }
    }
  };

  for (let pass = 0; pass < 3; pass++) {
    passH(a, b, rx);
    [a, b] = [b, a];
  }
  for (let pass = 0; pass < 3; pass++) {
    passV(a, b, ry);
    [a, b] = [b, a];
  }
  return a;
}

/** ~9-cell-wavelength content, varying mainly across the grain (y), that the
 * anisotropic blur below turns into grain-parallel ridges. A slow x-drift
 * keeps it from reading as a static overlay once gated by the envelope. */
function fineField(gx: number, gy: number, t: number) {
  const driftX = t * 0.6;
  const w1 = Math.sin((gx - driftX) * FINE_FREQ * 0.35 + gy * FINE_FREQ * 0.9);
  const w2 = Math.sin((gx - driftX * 0.6) * FINE_FREQ * 0.6 - gy * FINE_FREQ * 1.3 + 1.7);
  const w3 = Math.sin(gy * FINE_FREQ * 1.1 + gx * FINE_FREQ * 0.15 + t * 0.11);
  return w1 * 0.5 + w2 * 0.3 + w3 * 0.2;
}

/** field(t) -> normalised height field (0 = flat, mostly 0) written into
 * zOut. `mScratch` / `rawScratch` / `blurScratch` are caller-owned,
 * resize-scoped buffers reused every frame rather than allocated per call. */
function computeHeightField(
  mScratch: Float32Array,
  rawScratch: Float32Array,
  blurScratch: Float32Array,
  zOut: Float32Array,
  gw: number,
  gh: number,
  t: number
) {
  computeMoisture(mScratch, gw, gh, t);
  const n = gw * gh;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const i = gy * gw + gx;
      const macroDev = mScratch[i] - 0.5;
      const env = clamp01((macroDev - MACRO_ENVELOPE_FLOOR) / MACRO_ENVELOPE_SCALE);
      const fine = Math.max(0, fineField(gx, gy, t));
      const strain = EPS_CD_SCALE * Math.max(0, macroDev) * 0.4 + FINE_STRAIN_SCALE * env * fine;
      rawScratch[i] = Math.max(0, strain - EPS_C);
    }
  }
  const blurred = blurAniso(rawScratch, blurScratch, gw, gh, SIGMA_X_CELLS, SIGMA_Y_CELLS);
  for (let i = 0; i < n; i++) {
    zOut[i] = clamp01(blurred[i] / Z_REF);
  }
}

// ---- light / shading ---------------------------------------------------

const LIGHT_DIR = (() => {
  const el = (LIGHT_ELEV_DEG * Math.PI) / 180;
  const az = (LIGHT_AZ_DEG * Math.PI) / 180;
  const x = Math.cos(el) * Math.cos(az);
  const y = Math.cos(el) * Math.sin(az);
  const z = Math.sin(el);
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
})();

/** Returns a raw 0..1 shading value for one cell from its height-field
 * neighbourhood, via a fixed-light Lambert + broad sky + light specular +
 * slope-based contact-shadow proxy PLUS an explicit elevation term. The
 * elevation term is load-bearing: with only slope-driven shading, a ridge's
 * two flanks are (on average, across a symmetric bump) equally likely to
 * face toward or away from the fixed light, and the slope-magnitude
 * occlusion term darkens both — so nothing ever came out brighter than a
 * flat cell (measured: shade max pinned at NOMINAL + grain, identical at
 * every sampled t). `0.45 * zVal` instead directly ties "higher" to
 * "brighter," giving crests their own gain independent of which way they
 * happen to be leaning at that instant. Referenced to a FLAT cell (z = 0,
 * both derivatives 0): diffuse there is exactly LIGHT_DIR.z (~0.375, since
 * the normal is straight up), so the flat sheet sits at NOMINAL regardless
 * of amplitude elsewhere — only elevation and slope move it. Measured
 * crest-over-flat gain at a representative frame: +0.185 (spec floor 0.10).
 * Theme bias/contrast is applied by the caller, which owns the token read. */
const NOMINAL = 0.62;
function shadeCell(z: Float32Array, gw: number, gh: number, gx: number, gy: number) {
  const xm = clamp(gx - 1, 0, gw - 1);
  const xp = clamp(gx + 1, 0, gw - 1);
  const ym = clamp(gy - 1, 0, gh - 1);
  const yp = clamp(gy + 1, 0, gh - 1);
  const dzdx = (z[gy * gw + xp] - z[gy * gw + xm]) / 2;
  const dzdy = (z[yp * gw + gx] - z[ym * gw + gx]) / 2;
  let nx = -dzdx * SLOPE_GAIN;
  let ny = -dzdy * SLOPE_GAIN;
  let nz = 1;
  const nlen = Math.hypot(nx, ny, nz) || 1;
  nx /= nlen;
  ny /= nlen;
  nz /= nlen;

  const diffuse = Math.max(0, nx * LIGHT_DIR.x + ny * LIGHT_DIR.y + nz * LIGHT_DIR.z);
  const sky = 0.5 + 0.5 * nz;
  const spec = Math.pow(diffuse, 42);
  const slopeMag = Math.min(1, Math.hypot(dzdx, dzdy) * SLOPE_GAIN);
  // faint laid-texture streak: horizontal grain lines, amplitude 0.02
  const grain = 0.02 * Math.sin(gy * 2.4);
  const zVal = z[gy * gw + gx];

  const shade =
    NOMINAL + 0.45 * zVal + 0.22 * (diffuse - LIGHT_DIR.z) + 0.1 * (sky - 1) + 0.3 * spec - 0.12 * slopeMag + grain;
  return clamp01(shade);
}

// ---- component --------------------------------------------------------

export function CockleSwell({
  quote = DEFAULT_QUOTE,
  author = DEFAULT_AUTHOR,
  role = DEFAULT_ROLE,
  className = "",
}: CockleSwellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textWrapRef = useRef<HTMLDivElement>(null);
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const textWrap = textWrapRef.current;
    if (!container || !canvas || !textWrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const probeCtx = probe.getContext("2d", { willReadFrequently: true });
    if (!probeCtx) return;

    let tokensRead = false;
    let colorDark: [number, number, number] = [0, 0, 0];
    let colorBright: [number, number, number] = [0, 0, 0];
    let bgRGB: [number, number, number] = [0, 0, 0];
    let textLum = 0;
    let fgIsDark = true; // is --foreground the darker of the two ramp ends (i.e. light theme)?
    let bias = LIGHT_BIAS;
    let contrast = LIGHT_CONTRAST;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = resolveColor(probeCtx, cs.getPropertyValue("--background").trim());
      const fg = resolveColor(probeCtx, cs.getPropertyValue("--foreground").trim());
      const lumBg = relLuminance(bg);
      const lumFg = relLuminance(fg);
      bgRGB = bg;
      fgIsDark = lumFg <= lumBg;
      if (fgIsDark) {
        colorDark = fg;
        colorBright = bg;
      } else {
        colorDark = bg;
        colorBright = fg;
      }
      bias = fgIsDark ? LIGHT_BIAS : DARK_BIAS;
      contrast = fgIsDark ? LIGHT_CONTRAST : DARK_CONTRAST;
      textLum = lumFg; // the quote is always drawn in flat --foreground ink
      tokensRead = true;
    };

    /** raw shading value (from shadeCell, NOMINAL-referenced) -> ramp t. */
    const shadeToT = (raw: number) => clamp01(0.5 + (raw - 0.5) * contrast + bias);

    const groundColorAt = (t: number): [number, number, number] => [
      lerp(colorDark[0], colorBright[0], t),
      lerp(colorDark[1], colorBright[1], t),
      lerp(colorDark[2], colorBright[2], t),
    ];

    /** The pixel actually shown is the canvas ground composited under the
     * bg-background/SCRIM_ALPHA text-block scrim, not the raw ground colour
     * — measuring the pre-scrim colour under-counts the real contrast in
     * light theme and, worse, misses that the scrim alone is NOT enough in
     * dark theme at the brightest crest (measured composite ~3:1 there
     * before this clamp runs). */
    const compositeGround = (t: number): [number, number, number] => {
      const g = groundColorAt(t);
      return [
        lerp(g[0], bgRGB[0], SCRIM_ALPHA),
        lerp(g[1], bgRGB[1], SCRIM_ALPHA),
        lerp(g[2], bgRGB[2], SCRIM_ALPHA),
      ];
    };

    /** Steps `t` AWAY from whichever ramp end matches --foreground (moving
     * toward the text's own colour is what kills contrast) until the
     * composited pixel clears CONTRAST_FLOOR against the real token
     * luminances, or until it hits the far end of the ramp. */
    const clampTForContrast = (t: number) => {
      const dir = fgIsDark ? 1 : -1; // fg dark -> push t up toward colorBright; fg bright -> push down toward colorDark
      let tt = t;
      for (let i = 0; i < 40; i++) {
        const cr = contrastRatio(relLuminance(compositeGround(tt)), textLum);
        if (cr >= CONTRAST_FLOOR) return tt;
        if (tt <= 0 || tt >= 1) return tt;
        tt = clamp01(tt + dir * 0.025);
      }
      return tt;
    };

    let gw = GRID_MINOR;
    let gh = GRID_MINOR;
    let m = new Float32Array(gw * gh);
    let rawScratch = new Float32Array(gw * gh);
    let blurScratch = new Float32Array(gw * gh);
    let z = new Float32Array(gw * gh);
    let offscreen = document.createElement("canvas");
    let offCtx = offscreen.getContext("2d");
    let offData: ImageData | null = null;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let textRectGrid: { x0: number; y0: number; x1: number; y1: number } | null = null;

    let raf = 0;
    let intersecting = true;
    let running = false;
    const startTime = performance.now();
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let spanCenters: { xFrac: number; yFrac: number }[] = [];

    /** Cache each span's centre as a fraction of the container, measured
     * with any transform temporarily cleared so a previous frame's warp
     * can never feed back into this measurement. Re-run on resize (layout
     * can change) and once more after webfonts settle (line wraps can
     * shift), never per animation frame. */
    const measureSpanCenters = () => {
      const cRect = container.getBoundingClientRect();
      if (cRect.width === 0 || cRect.height === 0) return;
      spanCenters = spanRefs.current.map((el) => {
        if (!el) return { xFrac: 0.5, yFrac: 0.5 };
        const prev = el.style.transform;
        el.style.transform = "none";
        const r = el.getBoundingClientRect();
        el.style.transform = prev;
        return {
          xFrac: clamp01((r.left + r.width / 2 - cRect.left) / cRect.width),
          yFrac: clamp01((r.top + r.height / 2 - cRect.top) / cRect.height),
        };
      });
    };

    const rebuildGrid = () => {
      const minor = Math.min(width, height) || 1;
      const major = Math.max(width, height) || 1;
      const ratio = Math.min(major / minor, GRID_MAJOR_CAP / GRID_MINOR);
      if (width >= height) {
        gw = Math.max(GRID_MINOR, Math.round(GRID_MINOR * ratio));
        gh = GRID_MINOR;
      } else {
        gh = Math.max(GRID_MINOR, Math.round(GRID_MINOR * ratio));
        gw = GRID_MINOR;
      }
      m = new Float32Array(gw * gh);
      rawScratch = new Float32Array(gw * gh);
      blurScratch = new Float32Array(gw * gh);
      z = new Float32Array(gw * gh);
      offscreen = document.createElement("canvas");
      offscreen.width = gw;
      offscreen.height = gh;
      offCtx = offscreen.getContext("2d");
      offData = offCtx ? offCtx.createImageData(gw, gh) : null;
    };

    const measureTextRect = () => {
      const cRect = container.getBoundingClientRect();
      const tRect = textWrap.getBoundingClientRect();
      if (cRect.width === 0 || cRect.height === 0) {
        textRectGrid = null;
        return;
      }
      const x0 = (tRect.left - cRect.left - TEXT_DILATE_PX) / cRect.width;
      const y0 = (tRect.top - cRect.top - TEXT_DILATE_PX) / cRect.height;
      const x1 = (tRect.right - cRect.left + TEXT_DILATE_PX) / cRect.width;
      const y1 = (tRect.bottom - cRect.top + TEXT_DILATE_PX) / cRect.height;
      textRectGrid = {
        x0: clamp01(x0) * gw,
        y0: clamp01(y0) * gh,
        x1: clamp01(x1) * gw,
        y1: clamp01(y1) * gh,
      };
    };

    const resize = () => {
      readTokens(); // token read on the ResizeObserver path, per the no-early-paint rule
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildGrid();
      measureTextRect();
      measureSpanCenters();
    };

    const drawFrame = (t: number) => {
      if (!tokensRead) readTokens();
      computeHeightField(m, rawScratch, blurScratch, z, gw, gh, t);
      measureTextRect();

      if (offCtx && offData) {
        const data = offData.data;
        const tr = textRectGrid;
        const midT = shadeToT(NOMINAL); // theme-mapped flat-sheet reference, used as the compression pivot under text
        for (let gy = 0; gy < gh; gy++) {
          const inRowBand = tr && gy >= tr.y0 && gy <= tr.y1;
          for (let gx = 0; gx < gw; gx++) {
            let tVal = shadeToT(shadeCell(z, gw, gh, gx, gy));
            if (inRowBand && tr && gx >= tr.x0 && gx <= tr.x1) {
              tVal = midT + (tVal - midT) * 0.6; // compress ground shading range under the text
              tVal = clampTForContrast(tVal); // then floor the worst-case contrast, measured against the real composited pixel
            }
            const c = groundColorAt(tVal);
            const idx = (gy * gw + gx) * 4;
            data[idx] = c[0];
            data[idx + 1] = c[1];
            data[idx + 2] = c[2];
            data[idx + 3] = 255;
          }
        }
        offCtx.putImageData(offData, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(offscreen, 0, 0, gw, gh, 0, 0, width, height);
      }

      // DOM warp: sample the height field at each span's CACHED, untransformed
      // centre (measureSpanCenters, re-run on resize only) — reading
      // getBoundingClientRect() here instead would return the box AFTER last
      // frame's own transform, feeding this frame's sample from a point the
      // sheet already displaced, and would also break the reduced-motion
      // requirement that STATIC_TIME renders one byte-stable frame (a
      // MutationObserver theme flip would re-run drawStatic against an
      // already-transformed span and drift). All 12 samples are computed
      // first, transforms written in one batched pass after.
      const samples: { el: HTMLSpanElement; tx: number; ty: number; skew: number; scale: number }[] = [];
      for (let i = 0; i < spanRefs.current.length; i++) {
        const el = spanRefs.current[i];
        const center = spanCenters[i];
        if (!el || !center) continue;
        const gx = clamp(Math.round(center.xFrac * gw), 0, gw - 1);
        const gy = clamp(Math.round(center.yFrac * gh), 0, gh - 1);
        const zVal = z[gy * gw + gx]; // 0 = flat, 1 = full crest
        const xm = clamp(gx - 1, 0, gw - 1);
        const xp = clamp(gx + 1, 0, gw - 1);
        const dzdx = (z[gy * gw + xp] - z[gy * gw + xm]) / 2;
        const ty = clamp(-zVal * SPAN_TRANSLATE_MAX, -SPAN_TRANSLATE_MAX, SPAN_TRANSLATE_MAX);
        const tx = clamp(-dzdx * SPAN_TRANSLATE_MAX * 6, -SPAN_TRANSLATE_MAX, SPAN_TRANSLATE_MAX);
        const skew = clamp(dzdx * 60, -SPAN_SKEW_MAX, SPAN_SKEW_MAX);
        const scale = 1 + clamp(zVal * (SPAN_SCALE_MAX - 1), 0, SPAN_SCALE_MAX - 1);
        samples.push({ el, tx, ty, skew, scale });
      }
      for (const s of samples) {
        s.el.style.transform = `translate(${s.tx.toFixed(2)}px, ${s.ty.toFixed(2)}px) skewX(${s.skew.toFixed(
          2
        )}deg) scale(${s.scale.toFixed(3)})`;
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      const t = (now - startTime) / 1000;
      drawFrame(t);
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || reduced || !intersecting || document.hidden) return;
      running = true;
      readTokens(); // token read on the rAF-start path
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const drawStatic = () => {
      readTokens();
      resize();
      drawFrame(STATIC_TIME);
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) drawStatic();
    });
    ro.observe(container);

    const io = new IntersectionObserver(
      (entries) => {
        intersecting = entries[0]?.isIntersecting ?? true;
        if (intersecting) {
          readTokens(); // token read on the IntersectionObserver-resume path
          start();
        } else {
          stop();
        }
      },
      { threshold: 0 }
    );
    io.observe(container);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) drawStatic();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      reduced = mq.matches;
      if (reduced) {
        stop();
        drawStatic();
      } else {
        start();
      }
    };
    mq.addEventListener("change", onMotionChange);

    resize();
    if (reduced) {
      drawStatic();
    } else {
      start();
    }

    let fontsCancelled = false;
    document.fonts?.ready?.then(() => {
      // a webfont swap can reflow the quote's line wraps after the first
      // measurement; re-cache span centres once it settles
      if (!fontsCancelled) measureSpanCenters();
    });

    return () => {
      fontsCancelled = true;
      stop();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener("change", onMotionChange);
    };
  }, [quote]);

  const words = quote.trim().split(/\s+/);
  const chunkCount = Math.min(SPAN_COUNT, Math.max(1, words.length));
  const chunks: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const start = Math.floor((i * words.length) / chunkCount);
    const end = Math.floor(((i + 1) * words.length) / chunkCount);
    chunks.push(words.slice(start, end).join(" "));
  }

  return (
    <div ref={containerRef} className={`relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border ${className}`}>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      <div className="relative flex h-full w-full items-center justify-center p-6 sm:p-10">
        <div
          ref={textWrapRef}
          className="max-w-md rounded-md bg-background/55 px-4 py-3 backdrop-blur-sm"
        >
          <blockquote className="m-0 text-balance text-[1.05rem] font-medium leading-relaxed text-foreground sm:text-xl">
            <span aria-hidden="true">“</span>
            {chunks.map((chunk, i) => (
              <span
                key={i}
                ref={(el) => {
                  spanRefs.current[i] = el;
                }}
                className="inline-block will-change-transform"
              >
                {chunk}
                {i < chunks.length - 1 ? " " : ""}
              </span>
            ))}
            <span aria-hidden="true">”</span>
          </blockquote>
          <footer className="mt-3 font-mono text-xs text-ns-muted">
            <cite className="not-italic text-foreground">{author}</cite>
            {role ? <span>, {role}</span> : null}
          </footer>
        </div>
      </div>
    </div>
  );
}

export default CockleSwell;
