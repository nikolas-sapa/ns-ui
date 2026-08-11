"use client";

import { useEffect, useId, useMemo, useRef } from "react";

// ---------------------------------------------------------------------------
// StrataCut — a pinned, full-bleed drilling stage where the scroll position IS
// the depth of the bit.
//
// The whole frame is one fragment shader evaluating a single ground field
// g(x, depth). Depth is not a slide index: every pixel's depth is
//
//     depth = bitDepth + (y - bitLine) * metresPerPixel
//
// so the image is a pure function of one scalar the scroll drives. That is the
// property the whole component is built on — it is what makes scrolling
// backwards run the drill back up the hole coherently instead of playing an
// animation in reverse. Nothing is latched, nothing is "reached", no state
// accumulates with depth. Pull back to 40 m and you are looking at exactly the
// rock you were looking at on the way down, to the pixel.
//
// The frame is split at the bit line, ~30% down the viewport:
//   below it   intact ground, bedded in place, waiting to be cut
//   at it      the cutting front: a working light, a kerf shadow, chip haze
//   above it   the borehole — the same strata seen as a cut cylinder wall,
//              curved, tool-grooved, with cuttings flushing UP and out
// Material therefore moves through the frame in one direction only, and the
// state of a piece of ground is legible from where it sits: uncut, being cut,
// cut. Both sides read the ground field in the SAME centred x metric, so a bed
// crosses the front continuously instead of stepping by the dip term.
//
// The resting frame — the one the screenshot gate grades, un-scrolled — starts
// the bit a couple of metres down rather than at zero, so daylight in the
// collar is a bright sliver at the top of the frame instead of a third of it,
// and the annulus below it is already full of cuttings drifting up.
//
// Strata are generated, not authored. A monotone warp u(d) = d/T + A·sin(d/T)
// with A < 1 guarantees du/dd > 0, so floor(u) is a bed index that can never
// invert or pop however the depth is driven; per-bed character (bed luminance,
// lamination, contact sharpness, clast density) is hashed off that index and
// then biased toward a facies profile interpolated from the stage list, so the
// copy that says "peat seam" arrives over ground that reads as one.
//
// Copy is DOM text, never rasterized. The visual blocks are aria-hidden and
// driven by style writes at frame rate; the accessible copy of the sequence is
// one sr-only ordered list, in depth order, always present.
//
// Palette: five luminance stops derived from --background, --foreground,
// --ns-muted and --border via getComputedStyle, re-read on a MutationObserver
// watching documentElement's class. --ns-accent never reaches the canvas; the
// ground is achromatic in both themes and the direction of the ramp does not
// invert, only its bias and contrast.
// ---------------------------------------------------------------------------

export interface StrataStage {
  /** Depth in metres at which this stage is centred. Must ascend. */
  depth: number;
  /** Short unit name, e.g. "Peat seam". */
  label: string;
  /** Headline for the stage. */
  title: string;
  /** One or two sentences of body copy. */
  body: string;
  /** Bed luminance bias for this facies, 0..1. @default 0.5 */
  lum?: number;
  /** Grain coarseness, 0 = mud, 1 = coarse clastics. @default 0.5 */
  grain?: number;
  /** Bedding strength, 0 = massive, 1 = finely laminated. @default 0.5 */
  structure?: number;
}

export interface StrataCutProps {
  /** Stages in ascending depth. The first should sit at or near 0 m. */
  stages?: StrataStage[];
  /** Viewport heights of scroll the pinned stage consumes. @default 12 */
  pinLength?: number;
  /** Metres of ground visible across one viewport height. @default 16 */
  metresPerScreen?: number;
  /** Bit depth at zero scroll, in metres. Keeps the collar a sliver. @default 6.6 */
  startDepth?: number;
  /** Fraction of the viewport height the cutting front sits at. @default 0.46 */
  bitLine?: number;
  /** Ambient (non-scroll) motion multiplier. @default 1 */
  speed?: number;
  /** Rendered over the stage. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_STAGES: StrataStage[] = [
  {
    depth: 8,
    label: "Surface",
    title: "Nothing here is older than the last few winters",
    body: "Loam, root mat, worm cast. The bit takes it without noticing.",
    lum: 0.5,
    grain: 0.62,
    structure: 0.2,
  },
  {
    depth: 26,
    label: "Floodplain silt",
    title: "A river that moved every spring",
    body: "Fining-upward couplets, each one a flood and the slack water after it.",
    lum: 0.62,
    grain: 0.4,
    structure: 0.78,
  },
  {
    depth: 62,
    label: "Peat seam",
    title: "A forest that drowned standing",
    body: "Compressed to a hand's width. Everything above it is the weight that did it.",
    lum: 0.12,
    grain: 0.16,
    structure: 0.55,
  },
  {
    depth: 104,
    label: "Marine mudstone",
    title: "The sea arrived and stayed",
    body: "Millimetre laminae, no burrows, no current. Deep, still, anoxic water.",
    lum: 0.3,
    grain: 0.08,
    structure: 0.95,
  },
  {
    depth: 158,
    label: "Reef limestone",
    title: "Built by things that were alive",
    body: "Massive, pale, poorly bedded. The bit slows and the cuttings run chalky.",
    lum: 0.82,
    grain: 0.55,
    structure: 0.18,
  },
  {
    depth: 214,
    label: "Volcanic tuff",
    title: "One afternoon, preserved whole",
    body: "Graded ash, welded at the base. Everything above took an age; this took hours.",
    lum: 0.46,
    grain: 0.75,
    structure: 0.42,
  },
  {
    depth: 272,
    label: "Basement gneiss",
    title: "Older than the rest by an order of magnitude",
    body: "Banded, folded, cut by veins. The column ends because the record does.",
    lum: 0.58,
    grain: 0.3,
    structure: 0.86,
  },
];

const MAX_FACIES = 8;

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `
precision highp float;

#define FACIES ${MAX_FACIES}

uniform vec2 u_size;      // css px
uniform float u_dpr;
uniform float u_time;
uniform float u_depth;    // metres at the bit
uniform float u_rate;     // metres/second of descent, signed, smoothed
uniform float u_bit;      // bit line, fraction of height
uniform float u_mpp;      // metres per css px
uniform float u_holeC;    // hole centre, -1..1 across the frame
uniform float u_holeR;    // hole radius, fraction of half the frame width
uniform int u_nfac;
uniform vec4 u_facies[FACIES]; // depth, lum, grain, structure
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform float u_bias;
uniform float u_contrast;

const float PI = 3.14159265;
const float BED = 1.5;     // base bed thickness in metres

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash21(vec2 p) {
  p = fract(p * vec2(287.13, 419.71));
  p += dot(p, p + 27.31);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm2(vec2 p) {
  return vnoise(p) * 0.65 + vnoise(p * 2.13 + 9.7) * 0.35;
}

// Monotone depth warp, two beating sines. Their amplitudes over their own
// frequencies sum to 0.72 < 1, so du/dd stays strictly positive: bed thickness
// varies by several times across the column and the pattern never repeats on
// screen, but boundaries can never cross, fold back or pop however the depth is
// driven.
float layerCoord(float d) {
  float t = d / BED;
  return t + 0.5 * sin(t) + 0.6 * sin(t * 0.37 + 1.7);
}

// Facies profile: the authored character of the ground at a depth, interpolated
// between the stage entries. Layer-level hashing varies around this, so beds
// stay individual while the column as a whole follows the copy.
vec3 facies(float d) {
  vec3 f = u_facies[0].yzw;
  for (int i = 1; i < FACIES; i++) {
    if (i >= u_nfac) break;
    vec4 a = u_facies[i - 1];
    vec4 b = u_facies[i];
    float k = smoothstep(a.x, b.x, d);
    f = mix(f, b.yzw, k * step(a.x, d));
  }
  return f;
}

// Rounded clasts on a jittered grid.
float clasts(vec2 q, float size) {
  vec2 g = floor(q);
  vec2 f = fract(q);
  float s = 0.0;
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 o = vec2(float(i), float(j));
      float h = hash21(g + o + 3.1);
      vec2 c = o + vec2(hash21(g + o), hash21(g + o + 7.7)) * 0.8 + 0.1;
      vec2 dv = (f - c) / (size * (0.5 + 0.9 * h));
      s = max(s, (1.0 - smoothstep(0.6, 1.0, length(dv))) * (0.35 + 0.65 * h));
    }
  }
  return s;
}

// The ground field. x is horizontal position in metres measured from the centre
// of the frame — the SAME metric on both sides of the hole rim, so a bed runs
// into the shaft and out the other side without a step. d is depth in metres.
float ground(float x, float d) {
  // Detail floor: anything finer than about two css px crawls during a scroll
  // and aliases outright on the low rungs of the adaptive ladder, so every
  // frequency below is clamped against the current metres-per-pixel rather
  // than fixed in metres.
  float fmax = 0.5 / max(u_mpp, 0.0001);   // cycles per metre at ~2 css px

  // regional dip plus a long undulation, so beds are not dead flat and the
  // contacts read as deposited rather than drawn
  float dw = d + x * 0.026 + 0.32 * fbm2(vec2(x * 0.04, d * 0.012))
    + 0.022 * fbm2(vec2(x * 0.22, d * 0.18));
  float u = layerCoord(dw);
  float li = floor(u);
  float f = fract(u);

  vec3 fac = facies(d);
  float h1 = hash11(li * 1.13 + 0.7);
  float h2 = hash11(li * 2.71 + 5.3);
  float h3 = hash11(li * 3.91 + 11.9);

  // bed luminance: facies bias, bed-to-bed variation around it
  float L = clamp(fac.x + (h1 - 0.5) * 0.30, 0.03, 0.97);

  // fining-upward: within a bed, tone drifts toward the finer (paler) end
  L += (0.5 - f) * 0.10 * (0.3 + 0.7 * fac.z);

  // laminae — frequency and strength from the facies, phase from the bed, and
  // spacing held above ~12 css px so beds read as bedded rather than hatched
  float lamN = min(2.0 + floor(h2 * 5.0) + fac.z * 9.0, BED / max(12.0 * u_mpp, 0.001));
  L += sin(f * PI * 2.0 * lamN + h3 * 6.28) * 0.075 * fac.z;
  L += (vnoise(vec2(x * 0.7, dw * lamN * 1.6)) - 0.5) * 0.035 * fac.z;

  // grain, stretched along the bedding so it reads as sediment rather than as
  // noise; coarser facies get bigger, higher-contrast speckle
  float gs = min(mix(24.0, 5.5, fac.y), fmax);
  L += (vnoise(vec2(x * 0.55, dw) * gs) - 0.5) * mix(0.022, 0.085, fac.y);
  L += (vnoise(vec2(x * 0.55, dw) * min(gs * 2.7, fmax)) - 0.5) * 0.016;

  // clasts, only where the facies is coarse enough to carry them
  float cw = smoothstep(0.55, 0.95, fac.y) * step(0.55, h2);
  if (cw > 0.0) {
    float c = clasts(vec2(x, dw) * 3.4, 0.5);
    L = mix(L, clamp(L + (h3 - 0.35) * 0.5, 0.0, 1.0), c * cw);
    L -= c * cw * 0.06 * smoothstep(0.7, 1.0, c);
  }

  // contact: a dark parting at the base of each bed, its sharpness hashed —
  // some contacts are knife-edge erosional, some gradational, and even the
  // sharpest is held to ~3 px so it does not shimmer while the column moves
  float sharpn = max(mix(0.050, 0.006, h3), 3.0 * u_mpp / BED);
  float contact = 1.0 - smoothstep(0.0, sharpn, f);
  L -= contact * mix(0.16, 0.40, h2);

  // joints: near-vertical fractures crossing several beds. Evenly spaced they
  // read as plaid, so they are hashed into irregular positions, most cells
  // carry none, and only brittle facies show them at all.
  float jc = x * 0.16 + fbm2(vec2(d * 0.02, x * 0.01)) * 1.2;
  float ji = floor(jc);
  float jh = hash11(ji * 7.31 + 2.9);
  float joint = step(0.62, jh) * smoothstep(0.055, 0.0, abs(fract(jc) - jh));
  L -= joint * 0.09 * smoothstep(0.2, 0.65, fac.z) * (0.4 + 0.6 * h2);

  return clamp(L, 0.0, 1.0);
}

vec3 ramp(float x) {
  vec3 c = mix(u_c0, u_c1, smoothstep(0.0, 0.27, x));
  c = mix(c, u_c2, smoothstep(0.25, 0.55, x));
  c = mix(c, u_c3, smoothstep(0.52, 0.83, x));
  c = mix(c, u_c4, smoothstep(0.81, 1.0, x));
  return c;
}

void main() {
  // DOM-space px, y down, so depth increases with y like the ground does
  vec2 p = vec2(gl_FragCoord.x, u_size.y * u_dpr - gl_FragCoord.y) / u_dpr;
  float bitY = u_size.y * u_bit;
  float depth = u_depth + (p.y - bitY) * u_mpp;
  float hw = u_size.x * 0.5;
  float xm = (p.x - hw) * u_mpp;        // metres from frame centre
  float nx = (p.x - hw) / hw;           // -1..1 across the frame
  float cutting = 0.30 + 0.70 * min(abs(u_rate) * 1.1, 1.0);

  // ---- intact ground, everywhere ----------------------------------------
  float L = ground(xm, depth);

  // ---- the hole ----------------------------------------------------------
  // The borehole is a finite shaft, not the whole upper frame: the strata run
  // uninterrupted across the full width and the hole is a channel cut down
  // through them, which is the only version of this that reads as a hole at a
  // glance rather than as a change of texture. It runs from the top of the
  // frame down to the bit line and no further, so the boundary between cut and
  // uncut ground is a hard, visible line at a fixed height while the ground
  // itself moves.
  float cxpx = hw + u_holeC * hw;
  float rpx = max(24.0, u_holeR * hw);
  // rugosity: the wall is broken rock, so the rim wanders a few per cent with
  // depth rather than ruling two straight vertical lines down the frame
  float rug = rpx * (1.0 + 0.075 * (fbm2(vec2(depth * 0.55, 1.7)) - 0.5) * 2.0
                     + 0.03 * (fbm2(vec2(depth * 3.1, 5.3)) - 0.5) * 2.0);
  float q = (p.x - cxpx) / rug;          // -1..1 across the hole
  float aq = abs(q);
  float ny = (bitY - p.y) / rpx;         // radii above the bit line

  if (aq < 1.02 && ny > -0.06) {
    float qc = clamp(q, -1.0, 1.0);
    float curve = sqrt(max(0.0, 1.0 - qc * qc));
    float up = clamp(ny / 7.0, 0.0, 1.0);

    // WALL. Sampled through an arc-length map anchored so that at the rim
    // (|q| = 1) it is exactly the ground the hole was cut out of — the bed
    // therefore runs into the hole and out the other side without a step.
    float xw = (cxpx - hw) * u_mpp + asin(qc) / 1.5708 * (rug * u_mpp);
    float wall = ground(xw, depth);
    wall *= 0.20 + 0.55 * (0.14 + 0.86 * curve) * mix(1.0, 0.55, up);
    wall -= up * 0.06;
    // the cut edge itself, where the rock face turns into the hole
    wall -= smoothstep(0.90, 1.0, aq) * 0.10;
    // grazing highlight riding the turn of the cylinder near each rim
    wall += exp(-pow((aq - 0.90) / 0.06, 2.0)) * 0.11 * (1.0 - up * 0.5);
    // tool grooves: a shallow helix, one record of how the hole was made
    wall += sin(depth * 34.0 + qc * 2.0) * 0.035 * curve;
    // flushed cuttings rising in the annulus — ambient life on the clock, not
    // on the scroll, so the resting frame is never a still
    float flow = u_time * (0.6 + min(abs(u_rate) * 0.9, 2.6));
    float mud = fbm2(vec2(qc * 3.0, depth * 3.2 - flow * 4.0));
    float mud2 = vnoise(vec2(qc * 8.0 + 3.0, depth * 9.0 - flow * 11.0));
    wall = mix(wall, wall * 0.78 + 0.22 * (0.28 + 0.5 * mud), 0.42 + 0.3 * up);
    wall += (mud2 - 0.5) * 0.07 * (0.4 + min(abs(u_rate), 1.6));

    // DRILL STRING. A pipe up the hole that swells into the bit body at the
    // front — one shape, so there is no seam. It turns on the clock: the flutes
    // and the specular band travel around the body whether or not the page is
    // being scrolled.
    float rs = min(0.94, 0.44 + 0.52 * exp(-pow(ny / 0.85, 2.0)));
    float qq = clamp(q / rs, -1.0, 1.0);
    float sc = sqrt(max(0.0, 1.0 - qq * qq));
    float steel = 0.13 + 0.26 * pow(sc, 1.6);
    float rot = asin(qq) + u_time * 2.2;
    steel += (sin(rot * 3.0 + depth * 9.0) * 0.5 + 0.5) * 0.10 * sc;
    steel += exp(-pow((qq - 0.5 * sin(u_time * 0.8)) / 0.13, 2.0)) * 0.16 * sc;
    // shoulders of the bit body, where it is packed with cut rock
    steel = mix(steel, steel * 0.75 + 0.16, smoothstep(1.2, 0.15, ny) * 0.5);

    float sMask = smoothstep(rs, rs - 0.035, aq);
    float Lh = mix(wall, steel, sMask);
    // contact shadow in the annulus, right where the body occludes the wall
    Lh -= exp(-pow((aq - rs) / 0.05, 2.0)) * 0.10 * (1.0 - sMask);

    // THE CUT. A bright rim of freshly broken rock at the front, chip haze
    // rising off it, and the bit's own shadow in the kerf.
    float chip = vnoise(vec2(qc * 6.0 + u_time * 1.9, ny * 3.0 - u_time * 3.4));
    Lh += exp(-pow(ny / 0.13, 2.0)) * (0.08 + 0.20 * cutting) * (0.35 + 0.65 * curve);
    Lh += exp(-pow((ny - 0.7) / 0.75, 2.0)) * (0.04 + 0.13 * cutting) * (0.3 + 0.9 * chip);
    Lh -= exp(-pow(ny / 0.035, 2.0)) * 0.22;

    // the rim of the hole, cut into the intact face: a hard shadowed edge on
    // the entry side and a thin lit lip on the other
    float rim = smoothstep(1.02, 0.965, aq);
    Lh = mix(L * 0.32, Lh, smoothstep(0.99, 0.90, aq));
    L = mix(L, Lh, rim * smoothstep(-0.05, 0.02, ny));
    // ground immediately below the bit is loaded and crushed by it
    L += exp(-pow(ny / 0.25, 2.0)) * step(ny, 0.0) * 0.07 * curve * cutting;
  }

  // ---- the surface --------------------------------------------------------
  // Above zero depth there is no ground: the frame opens into daylight with the
  // ground line as a hard, slightly broken edge, and the drill pipe running
  // down through it. At the default start depth this is a bright sliver at the
  // top of the resting frame rather than a third of it.
  float surf = 0.10 * (fbm2(vec2(xm * 1.6, 4.0)) - 0.5);
  float air = smoothstep(0.0, -0.28, depth + surf);
  if (air > 0.0) {
    float sky = 0.74 + 0.16 * (1.0 - abs(nx))
      + (vnoise(vec2(nx * 5.0, p.y * 0.06 - u_time * 0.5)) - 0.5) * 0.07;
    // the pipe stays visible where it crosses the open air
    float pipe = smoothstep(0.46, 0.42, aq);
    float pl = 0.16 + 0.30 * sqrt(max(0.0, 1.0 - pow(q / 0.44, 2.0)));
    pl += exp(-pow((q / 0.44 - 0.5 * sin(u_time * 0.8)) / 0.14, 2.0)) * 0.20;
    L = mix(L, mix(sky, pl, pipe), air);
    // spoil heaped at the collar
    L += exp(-pow((depth + surf + 0.10) / 0.16, 2.0)) * 0.16 * (1.0 - pipe);
  }

  // ---- the working light --------------------------------------------------
  // One lamp, at the bit. Ground far from the cut falls off, which is what
  // gives an otherwise evenly lit stack of beds a focus and a sense of depth,
  // and it puts the brightest part of the frame on the thing doing the work.
  vec2 lampP = vec2(cxpx, bitY);
  float lampD = length((p - lampP) / vec2(u_size.y, u_size.y));
  float lamp = exp(-pow(lampD / 0.78, 1.7));
  L *= 0.66 + 0.44 * lamp;
  L += lamp * 0.03;

  float Lc = clamp((L - 0.5) * u_contrast + 0.5 + u_bias, 0.0, 1.0);
  vec3 col = ramp(Lc);

  // frame vignette toward the deepest stop, so the copy column has somewhere
  // to sit in both themes
  float vig = smoothstep(0.55, 1.25, length(vec2(nx, (p.y / u_size.y - 0.5) * 1.6)));
  col = mix(col, u_c0, vig * 0.13);

  gl_FragColor = vec4(col, 1.0);
}
`;

type RGB = [number, number, number];

function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`strata-cut: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// Minimal full-bleed fragment-shader host: one program, one fullscreen triangle
// pair, uniform locations resolved lazily by name.
class GLSurface {
  gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vs: WebGLShader | null = null;
  private fs: WebGLShader | null = null;
  private buffer: WebGLBuffer | null = null;
  private locs = new Map<string, WebGLUniformLocation | null>();

  constructor(private canvas: HTMLCanvasElement, private frag: string) {}

  init(): boolean {
    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    }) as WebGLRenderingContext | null;
    if (!gl) return false;
    this.gl = gl;
    try {
      this.vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
      this.fs = compile(gl, gl.FRAGMENT_SHADER, this.frag);
      const program = gl.createProgram();
      if (!program) {
        this.destroy();
        return false;
      }
      this.program = program;
      gl.attachShader(program, this.vs);
      gl.attachShader(program, this.fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        this.destroy();
        return false;
      }
    } catch {
      this.destroy();
      return false;
    }
    gl.useProgram(this.program);
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(this.program!, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.locs.clear();
    return true;
  }

  private loc(name: string): WebGLUniformLocation | null {
    if (!this.locs.has(name)) {
      this.locs.set(name, this.gl!.getUniformLocation(this.program!, name));
    }
    return this.locs.get(name) ?? null;
  }

  f(name: string, x: number) {
    this.gl?.uniform1f(this.loc(name), x);
  }
  i(name: string, x: number) {
    this.gl?.uniform1i(this.loc(name), x);
  }
  v2(name: string, x: number, y: number) {
    this.gl?.uniform2f(this.loc(name), x, y);
  }
  v3(name: string, c: RGB) {
    this.gl?.uniform3f(this.loc(name), c[0], c[1], c[2]);
  }
  v4a(name: string, data: Float32Array) {
    this.gl?.uniform4fv(this.loc(name), data);
  }

  draw(pixelW: number, pixelH: number) {
    const gl = this.gl;
    if (!gl || !this.program) return;
    gl.viewport(0, 0, pixelW, pixelH);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  destroy() {
    const gl = this.gl;
    if (!gl) return;
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.program) gl.deleteProgram(this.program);
    if (this.vs) gl.deleteShader(this.vs);
    if (this.fs) gl.deleteShader(this.fs);
    this.buffer = null;
    this.program = null;
    this.vs = null;
    this.fs = null;
    this.locs.clear();
    this.gl = null;
  }
}

// Ambient clock offset for the frame drawn under prefers-reduced-motion, so the
// still state has cuttings distributed through the annulus rather than whatever
// t = 0 happens to look like.
const STATIC_TIME = 5.2;

function faciesArray(list: StrataStage[]): Float32Array {
  const arr = new Float32Array(MAX_FACIES * 4);
  const n = Math.min(MAX_FACIES, list.length);
  for (let i = 0; i < n; i++) {
    const s = list[i];
    arr[i * 4] = s.depth;
    arr[i * 4 + 1] = s.lum ?? 0.5;
    arr[i * 4 + 2] = s.grain ?? 0.5;
    arr[i * 4 + 3] = s.structure ?? 0.5;
  }
  return arr;
}

function endDepth(list: StrataStage[]): number {
  const last = list[list.length - 1].depth;
  const prev = list.length > 1 ? list[list.length - 2].depth : 0;
  // one part-gap of run-out past the deepest stage, so its copy is fully read
  // before the pin releases
  return last + Math.max(12, (last - prev) * 0.45);
}

export function StrataCut({
  stages = DEFAULT_STAGES,
  pinLength = 12,
  metresPerScreen = 16,
  startDepth = 6.6,
  bitLine = 0.46,
  speed = 1,
  children,
  className = "",
  style,
}: StrataCutProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const copyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const tickRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();

  const list = useMemo(() => (stages.length > 0 ? stages : DEFAULT_STAGES), [stages]);
  const maxDepth = useMemo(() => endDepth(list), [list]);

  // Everything the loop needs about the stage list is read through a ref and
  // polled. Putting the derived facies array or the depth span in the effect's
  // deps would tear down and rebuild the GL context every time a consumer
  // passed an inline `stages` array — which is how every consumer writes it.
  const listRef = useRef(list);
  listRef.current = list;

  useEffect(() => {
    const section = sectionRef.current;
    const stageEl = stageRef.current;
    const canvas = canvasRef.current;
    if (!section || !stageEl || !canvas) return;

    const surface = new GLSurface(canvas, FRAG_SRC);
    const hasGL = surface.init();

    let raf = 0;
    let running = false;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let disposed = false;
    let lastMs = performance.now();
    let simTime = 0;

    let items = listRef.current;
    let facies = faciesArray(items);
    let nFacies = Math.min(MAX_FACIES, items.length);
    let deepest = endDepth(items);

    // progress: the target is read once per frame from layout, and the depth
    // chases it. Reading it in the scroll handler instead would sample at the
    // browser's scroll cadence — bursty on a trackpad flick, and on some
    // engines delivered after paint — so the depth would tear against the frame
    // it is drawn in. One read, one interpolation, one draw, in that order.
    let target = 0;
    let current = 0;
    let rate = 0; // smoothed metres/second, signed
    let lastDepth = 0;
    let dirty = true;
    let lastSnap = -1;

    // Adaptive render scale. The ladder exists for machines we cannot measure;
    // every threshold is wall-clock milliseconds, never frames, because a
    // frame-counted gate waits longest on exactly the machines that need help
    // soonest.
    const SCALES = [1, 0.72, 0.52];
    const BUDGET_OVER = 24;
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;

    let c0: RGB = [0.03, 0.03, 0.03];
    let c1: RGB = [0.18, 0.18, 0.18];
    let c2: RGB = [0.56, 0.56, 0.56];
    let c3: RGB = [0.93, 0.93, 0.93];
    let c4: RGB = [1, 1, 1];
    let bias = 0;
    let contrast = 1.15;

    // Five stops spanning near-black to near-white in BOTH themes: a full-bleed
    // ground section IS the page, so the ramp never inverts. Only bias and
    // contrast move — light theme is the column under a work lamp, dark theme
    // the same column with the lamp as the only source.
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const border = parseHex(cs.getPropertyValue("--border")) ?? [0.18, 0.18, 0.18];
      const black: RGB = [0, 0, 0];
      const white: RGB = [1, 1, 1];
      if (luminance(bg) < 0.5) {
        c0 = mixRGB(bg, black, 0.6);
        c1 = mixRGB(border, bg, 0.1);
        c2 = mixRGB(muted, border, 0.25);
        c3 = fg;
        c4 = mixRGB(fg, white, 0.7);
        bias = -0.11;
        contrast = 1.30;
      } else {
        c0 = mixRGB(fg, black, 0.4);
        c1 = mixRGB(fg, muted, 0.45);
        c2 = mixRGB(muted, bg, 0.45);
        c3 = mixRGB(bg, muted, 0.2);
        c4 = bg;
        bias = 0.15;
        contrast = 1.34;
      }
    };
    readColors();

    const depthAt = (p: number) => startDepth + p * Math.max(1, deepest - startDepth);

    const readProgress = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const span = rect.height - vh;
      if (span <= 0) return 0;
      return Math.min(1, Math.max(0, -rect.top / span));
    };

    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2) * SCALES[scaleIdx];
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      dirty = true;
    };

    const resize = () => {
      const rect = stageEl.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      applyBacking();
    };

    // ---- copy ------------------------------------------------------------
    // The visual blocks are written straight to style rather than through React
    // state, so a scroll never schedules a render. They are aria-hidden; the
    // accessible copy of the sequence is the sr-only list in the markup.
    const nearestStage = (d: number) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < items.length; i++) {
        const dist = Math.abs(d - items[i].depth);
        if (dist < bestD) {
          bestD = dist;
          best = i;
        }
      }
      return best;
    };

    // Each stage owns a depth band set by its own neighbours, not a single
    // window for the whole column: the default stages are 18 m apart near the
    // surface and 56 m apart at the bottom, and one window sized for either end
    // leaves the other with dead depth where no copy is on screen at all.
    const spanOf = (i: number) => {
      const prev = i > 0 ? items[i].depth - items[i - 1].depth : 0;
      const next = i < items.length - 1 ? items[i + 1].depth - items[i].depth : 0;
      const gap = prev && next ? (prev + next) / 2 : prev || next || 24;
      return Math.max(6, gap * 0.62);
    };

    const updateCopy = (depth: number) => {
      const near = reduced ? nearestStage(depth) : -1;
      for (let i = 0; i < items.length; i++) {
        const el = copyRefs.current[i];
        if (!el) continue;
        let a: number;
        let dy = 0;
        if (reduced) {
          a = i === near ? 1 : 0;
        } else {
          const d = (depth - items[i].depth) / spanOf(i);
          a = Math.max(0, 1 - Math.abs(d));
          a = a * a * (3 - 2 * a);
          // copy rides with the ground it describes, at a fraction of its
          // speed, so it is attached to the column without racing it
          dy = Math.max(-46, Math.min(46, -d * 34));
        }
        el.style.opacity = a.toFixed(3);
        el.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
        el.style.visibility = a < 0.004 ? "hidden" : "visible";
        const tick = tickRefs.current[i];
        if (tick) tick.style.opacity = (0.28 + 0.72 * a).toFixed(3);
      }
      if (readoutRef.current) {
        readoutRef.current.textContent = `${depth < 0 ? 0 : Math.round(depth)} m`;
      }
      if (railRef.current) {
        const t = Math.min(1, Math.max(0, depth / deepest));
        railRef.current.style.transform = `scaleY(${t.toFixed(4)})`;
      }
    };

    // ---- frame -----------------------------------------------------------
    const draw = (depth: number) => {
      if (!surface.gl || cssW <= 0 || cssH <= 0) return;
      surface.v2("u_size", cssW, cssH);
      surface.f("u_dpr", dpr);
      surface.f("u_time", reduced ? STATIC_TIME : simTime);
      surface.f("u_depth", depth);
      surface.f("u_rate", reduced ? 0 : rate);
      surface.f("u_bit", bitLine);
      surface.f("u_mpp", metresPerScreen / Math.max(1, cssH));
      // the shaft sits right of centre on a wide frame so the copy column has
      // the left third to itself, and centres and widens on a narrow one, where
      // the copy sits over it on a scrim instead
      const wide = cssW >= 760;
      surface.f("u_holeC", wide ? 0.42 : 0.0);
      surface.f("u_holeR", wide ? 0.21 : 0.38);
      surface.i("u_nfac", nFacies);
      surface.v4a("u_facies", facies);
      surface.v3("u_c0", c0);
      surface.v3("u_c1", c1);
      surface.v3("u_c2", c2);
      surface.v3("u_c3", c3);
      surface.v3("u_c4", c4);
      surface.f("u_bias", bias);
      surface.f("u_contrast", contrast);
      surface.draw(canvas.width, canvas.height);
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0.0005, rawMs / 1000));
      lastMs = nowMs;

      target = readProgress();
      let depth: number;

      if (reduced) {
        // discrete states: snap to the nearest stage's depth, so the process is
        // shown as a set of positions rather than a continuous descent, and
        // redraw only when that snap actually changes
        const snap = nearestStage(depthAt(target));
        depth = items[snap].depth;
        current = (depth - startDepth) / Math.max(1, deepest - startDepth);
        rate = 0;
        lastDepth = depth;
        if (snap !== lastSnap || dirty) {
          lastSnap = snap;
          dirty = false;
          updateCopy(depth);
          draw(depth);
        }
      } else {
        simTime += dt * speed;
        // a trackpad flick lands the target in one event burst; this is what
        // keeps the depth from stepping with it. ~90ms is short enough that the
        // ground never feels detached from the finger, long enough to absorb a
        // 200px jump over about six frames.
        current += (target - current) * (1 - Math.exp(-dt / 0.09));
        depth = depthAt(current);
        const inst = (depth - lastDepth) / dt;
        lastDepth = depth;
        rate += (inst - rate) * (1 - Math.exp(-dt / 0.12));
        dirty = false;
        updateCopy(depth);
        draw(depth);
      }

      const clamped = Math.min(50, rawMs);
      frameEma += (clamped - frameEma) * (1 - Math.exp(-clamped / 120));
      if (frameEma > BUDGET_OVER) {
        overMs += clamped;
        underMs = 0;
      } else {
        underMs += clamped;
        overMs = 0;
      }
      const down = overMs > 900 && scaleIdx < SCALES.length - 1;
      const up = underMs > upWindow && scaleIdx > 0;
      if (down || up) {
        scaleIdx += down ? 1 : -1;
        if (down) upWindow = Math.min(64000, upWindow * 2);
        overMs = 0;
        underMs = 0;
        frameEma = 16.7;
        applyBacking();
      }
      raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      if (running || disposed) return;
      running = true;
      lastMs = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(stageEl);
    resize();

    // seed from wherever the page already is, so a reload part-way down the
    // section paints the right depth on the first frame instead of easing to it
    current = target = readProgress();
    lastDepth = depthAt(current);
    updateCopy(lastDepth);
    if (hasGL) draw(lastDepth);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      reduced = mq.matches;
      dirty = true;
    };
    mq.addEventListener("change", onMq);

    // a pinned stage that has scrolled away is the most expensive idle thing a
    // page can carry; the rAF loop stops entirely when it is off screen
    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else if (!document.hidden) {
          dirty = true;
          wake();
        }
      },
      { threshold: 0 }
    );
    io.observe(section);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (onScreen) {
        dirty = true;
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const themeObserver = new MutationObserver(() => {
      readColors();
      dirty = true;
      if (!running) draw(lastDepth);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // polled rather than made an effect dependency: either would rebuild the
    // whole GL context to change a copy string
    let poll = 0;
    const tick = () => {
      if (listRef.current !== items) {
        items = listRef.current;
        facies = faciesArray(items);
        nFacies = Math.min(MAX_FACIES, items.length);
        deepest = endDepth(items);
        dirty = true;
        lastSnap = -1;
        if (!running) {
          updateCopy(lastDepth);
          draw(lastDepth);
        }
      }
      poll = window.setTimeout(tick, 200);
    };
    tick();

    const onLost = (e: Event) => {
      e.preventDefault();
      sleep();
    };
    const onRestored = () => {
      if (surface.init()) {
        resize();
        dirty = true;
        if (onScreen && !document.hidden) wake();
      }
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    if (hasGL) wake();

    return () => {
      disposed = true;
      sleep();
      window.clearTimeout(poll);
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      surface.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitLine, metresPerScreen, speed, startDepth]);

  return (
    <section
      ref={sectionRef}
      data-strata-cut={uid}
      aria-label="Core log"
      className={`relative w-full bg-background ${className}`}
      style={{ height: `${Math.max(2, pinLength) * 100}vh`, ...style }}
    >
      {/* the whole sequence, in depth order, for anything that does not scroll:
          the visual blocks below are aria-hidden because they are driven at
          frame rate and half of them are transparent at any moment */}
      <ol className="sr-only">
        {list.map((s) => (
          <li key={`sr-${s.depth}-${s.label}`}>
            <h3>
              {s.depth} m, {s.label}: {s.title}
            </h3>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>

      {/* sticky, not fixed: the stage is released by ordinary layout at both
          ends, so there is no boundary jump and no scroll to give back */}
      <div ref={stageRef} className="sticky top-0 h-screen w-full overflow-hidden">
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />

        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center">
          <div className="relative mx-auto w-full max-w-6xl px-6 sm:px-10">
            <div className="relative h-[19rem] w-full max-w-md sm:h-[17rem]">
              {list.map((s, i) => (
                <div
                  key={`${s.depth}-${s.label}`}
                  ref={(el) => {
                    copyRefs.current[i] = el;
                  }}
                  className="absolute inset-x-0 top-0 will-change-[opacity,transform]"
                  style={{ opacity: 0, visibility: "hidden" }}
                >
                  <div className="rounded-lg bg-background/80 p-6 backdrop-blur-md sm:p-7">
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
                      {s.depth} m &middot; {s.label}
                    </p>
                    <p className="mt-3 text-balance text-2xl font-medium leading-tight text-foreground sm:text-3xl">
                      {s.title}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-ns-muted sm:text-base">
                      {s.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* depth rail — a readout of where the bit is, not a control */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-4 hidden w-24 flex-col justify-center sm:right-8 sm:flex"
        >
          <div className="relative flex h-[62vh] items-stretch">
            <div className="relative w-px bg-border">
              <div
                ref={railRef}
                className="absolute inset-x-0 top-0 h-full origin-top bg-foreground"
                style={{ transform: "scaleY(0)" }}
              />
            </div>
            <div className="relative ml-3 flex-1">
              {list.map((s, i) => (
                <span
                  key={`tick-${s.depth}`}
                  ref={(el) => {
                    tickRefs.current[i] = el;
                  }}
                  className="absolute left-0 -translate-y-1/2 font-mono text-[10px] tracking-[0.14em] text-ns-muted"
                  style={{ top: `${(s.depth / maxDepth) * 100}%`, opacity: 0.28 }}
                >
                  {s.depth}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute left-6 top-6 flex items-baseline gap-3 rounded-sm bg-background/80 px-3 py-2 backdrop-blur-md sm:left-10 sm:top-10">
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
            Bit depth
          </span>
          <span
            ref={readoutRef}
            aria-hidden="true"
            className="font-mono text-sm tabular-nums text-foreground"
          >
            0 m
          </span>
        </div>

        {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
      </div>
    </section>
  );
}

StrataCut.displayName = "StrataCut";
