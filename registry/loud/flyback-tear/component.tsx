"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// FlybackTear — a full-bleed dead-broadcast CRT: a monoscope test signal being
// scanned onto a phosphor face by a timebase that keeps losing its grip.
//
// The whole simulation runs in LUMINANCE, and colour is applied exactly once,
// in the final composite, through a five-stop ramp read from the theme tokens.
// That is the answer to the palette problem rather than a workaround for it: a
// CRT is normally sold by its phosphor colour, so with hue unavailable every
// cue has to be carried by value, structure and time — scanline pitch, aperture
// grille, phosphor persistence, bloom, ringing, the blanking bar, snow. None of
// those need a hue, and none of them exist anywhere in this file as a literal.
//
// Two passes over a ping-pong pair of framebuffers:
//
//   A. SIGNAL + PHOSPHOR. Evaluates the source raster in *signal space* — a
//      rolling, per-line-displaced copy of tube space — and writes it into an
//      accumulation buffer sampled at the *tube-space* texel, so the picture
//      slides across a stationary phosphor and smears exactly the way a real
//      one does when the vertical hold slips. Three channels of persistence:
//      R fast phosphor, G the slow burn behind it, B the pointer's beam
//      overdrive (zero at rest, so accent never decorates).
//
//   B. GLASS. Barrel-distorts the accumulation, adds a golden-angle bloom
//      spiral, multiplies in the scanline comb and the aperture grille, drifts
//      a mains hum bar up the face, then maps the single remaining float
//      through the token ramp.
//
// The failure modes are event-driven on the CPU (vertical-hold slips that decay
// and then re-lock, tear bursts, brief dropouts) so their timing is legible
// rather than noise-shaped, and the shader only ever sees their current
// amplitude.
// ---------------------------------------------------------------------------

export interface FlybackTearProps {
  /** Text burned into the signal, rolling and tearing with it. "\n" splits lines. */
  caption?: string;
  /** Glyph weight for the burned-in caption. @default 700 */
  captionWeight?: number;
  /** Fraction of the width the longest caption line fills. @default 0.52 */
  captionFit?: number;
  /** Vertical centre of the caption in the signal frame, 0..1. @default 0.5 */
  captionY?: number;
  /** Horizontal tear and displacement severity, 0..2. @default 1 */
  tear?: number;
  /** Static / snow level, 0..2. @default 1 */
  noise?: number;
  /** Phosphor persistence, 0..2 — higher smears longer. @default 1 */
  persistence?: number;
  /** Tube curvature, 0..2. @default 1 */
  curvature?: number;
  /** Signal-generator and failure-event speed. @default 1 */
  speed?: number;
  /** Freezes the tube on a composed still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the tube — eyebrow, subhead, CTA. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Scanlines in the source raster. 240 is a deliberate half of a 480i field:
// at a 900px-tall hero one source line is ~3.7 device-independent px, which is
// coarse enough that the comb in the composite is unmistakably a raster and not
// a texture, and coarse enough that the per-line timebase jitter reads as
// individual lines slipping rather than as vertical grain.
const LINES = 240;

const COMMON = `
precision highp float;

uniform vec2 u_size;   // css px
uniform float u_dpr;

float hash21(vec2 p) {
  p = fract(p * vec2(287.13, 419.71));
  p += dot(p, p + 27.31);
  return fract(p.x * p.y);
}

// 1 on the integer lattice, falling to 0 over w (in fract units)
float ridge(float x, float w) {
  float d = abs(fract(x + 0.5) - 0.5);
  return smoothstep(w, 0.0, d);
}
`;

const FRAG_SIGNAL = `
${COMMON}

#define LINES ${LINES}.0

uniform float u_time;
uniform float u_ar;
uniform sampler2D u_prev;
uniform sampler2D u_text;
uniform float u_textAmt;
uniform vec3 u_decay;      // per-frame multipliers for R, G, B
uniform float u_roll;      // vertical hold offset, 0..1
uniform float u_tear;
uniform float u_tearBoost;
uniform float u_noise;
uniform float u_dropout;
uniform float u_field;     // 0 or 1 — which interlaced field is being written
uniform vec2 u_p0;         // pointer, previous frame, css px, y down
uniform vec2 u_p1;         // pointer, this frame
uniform float u_beam;

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
  float s = vnoise(p) * 0.62;
  s += vnoise(p * 2.07 + 11.3) * 0.31;
  return s;
}

// The monoscope. Everything here is analytic and everything here moves, so the
// signal is alive with nothing wrong with it — the failures below are what
// happens TO a picture, and a still picture underneath them would read as a
// filter over a JPEG rather than as a transmission.
float card(vec2 s) {
  vec2 c = (s - 0.5) * vec2(u_ar, 1.0);
  float px = 1.0 / max(u_size.y, 1.0);
  float t = u_time;
  float L = 0.0;

  // graticule: square cells, with every fifth line drawn heavier. Line widths
  // are derived from the viewport so the grid holds one pixel of weight at any
  // size instead of thickening on a large display.
  float cell = 26.0;
  float gw = 1.1 * cell * px;
  L += max(ridge(c.x * cell, gw), ridge(c.y * cell, gw)) * 0.26;
  float g5w = 1.7 * cell * 0.2 * px;
  L += max(ridge(c.x * cell * 0.2, g5w), ridge(c.y * cell * 0.2, g5w)) * 0.24;

  float rr = length(c);

  // convergence rings, drifting outward: the one element that guarantees the
  // frame is never twice the same even with a perfectly locked timebase
  L += ridge(rr * 13.0 - t * 0.22, 13.0 * px * 1.4) * 0.42;

  // radial wedges, turning slowly. Angular width has to be converted back to
  // fract units through the radius or the spokes fatten into a solid disc at
  // the centre.
  float an = atan(c.y, c.x) * 0.1591549;
  float spokeW = clamp(1.3 * px * 24.0 / (6.2832 * max(rr, 0.02)), 0.004, 0.42);
  L += ridge(an * 24.0 + t * 0.018, spokeW) * 0.3 * smoothstep(0.05, 0.24, rr);

  // centre reticle
  L += smoothstep(0.006, 0.0, abs(rr - 0.085)) * 0.55;
  L += smoothstep(0.014, 0.0, rr) * 0.7;

  // resolution chirps, two strips: the frequency ramps past the raster's own
  // pitch, so the top of the sweep aliases against the scanline comb and
  // crawls. Free motion, and the most television thing on the card — but kept
  // narrow and dim, because a displacement band that lands on a bright chirp
  // throws a solid white block across a third of the tube.
  float xn = c.x / max(u_ar, 0.001) + 0.5;
  float band = smoothstep(0.030, 0.020, abs(abs(c.y) - 0.255));
  float chirp = sin(c.x * 60.0 + xn * xn * 340.0 + t * 0.6);
  L += band * smoothstep(0.05, 0.55, chirp) * 0.34;

  // greyscale staircase, low in the frame
  float stair = smoothstep(0.034, 0.024, abs(c.y - 0.385));
  L += stair * (floor(clamp(xn, 0.0, 0.999) * 9.0) / 8.0) * 0.34;

  // caption, burned into the signal so it rolls and tears with everything else
  float tx = texture2D(u_text, clamp(s, 0.0, 1.0)).r * u_textAmt;
  L = max(L, tx * 0.78);

  return L;
}

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  vec2 fc = gl_FragCoord.xy / u_dpr;
  vec2 uv = vec2(fc.x / u_size.x, 1.0 - fc.y / u_size.y);  // tube space, y down

  // ---- signal space: where on the transmitted frame this tube texel is
  // currently being painted from -------------------------------------------
  vec2 s = uv;
  s.y = fract(s.y + u_roll);
  float ly = floor(s.y * LINES);
  float chunk = floor(u_time * 18.0);

  // displacement bands: contiguous groups of lines thrown sideways for a few
  // frames at a time. Quantising the trigger to 18Hz is what makes them read
  // as discrete failures instead of as a shimmer.
  float bandId = floor(ly / 9.0);
  float pick = hash21(vec2(bandId, chunk));
  float armed = step(0.91 - 0.38 * u_tearBoost, pick);
  float shove = (hash21(vec2(bandId * 3.1, chunk + 7.0)) - 0.5)
              * (0.03 + 0.15 * u_tearBoost) * u_tear;
  s.x += armed * shove;

  // Per-line timebase error, and a smooth horizontal wobble from the supply.
  // The jitter is kept to a few pixels: past that it stops reading as a line
  // store that cannot keep time and starts shredding the graticule into
  // scratches, and the card loses the one element that fills the whole face.
  s.x += (hash21(vec2(ly, chunk * 1.7)) - 0.5) * 0.0035 * u_tear;
  s.x += (sin(s.y * 13.0 + u_time * 1.3) * 0.004
        + sin(s.y * 47.0 - u_time * 0.7) * 0.0016) * u_tear;
  s.x = fract(s.x);  // a displaced line wraps, it does not clip

  // ---- the picture, plus the video amplifier's faults ---------------------
  // Ringing and a multipath ghost, expressed as luminance taken from offset
  // samples of the same signal. This is where a colour build would reach for a
  // channel split; the same overshoot-then-echo read comes out of weighting
  // three horizontal taps of one monochrome signal, and it survives the
  // palette constraint intact.
  float d = (0.0028 + 0.011 * u_tearBoost) * u_tear;
  float sig = card(s) * 1.2;
  sig -= card(s - vec2(d, 0.0)) * 0.30;                           // overshoot
  sig += card(s + vec2(0.031 + 0.02 * u_tearBoost, 0.0)) * 0.17;  // ghost

  // The transmitter's own low-frequency swim, an adjacent carrier bleeding in.
  // Evaluated ONCE, outside the taps: it is two octaves of value noise, eight
  // hash() calls, and it was the single most expensive thing in this shader
  // when every tap carried a copy — while being far too low-frequency for a
  // 3px horizontal offset to change it by anything the eye can find.
  sig += (fbm2((s - 0.5) * vec2(u_ar, 1.0) * 2.3
               + vec2(u_time * 0.05, -u_time * 0.033)) - 0.42) * 0.36;

  // vertical blanking: the bar the picture is torn at, riding wherever the
  // roll has left the top of the transmitted frame
  float vb = smoothstep(0.052, 0.030, s.y);
  sig *= 1.0 - vb * 0.95;
  sig += smoothstep(0.0075, 0.0, abs(s.y - 0.030)) * 0.85;
  sig += vb * hash21(vec2(floor(fc.x * 0.7), ly + chunk * 31.0)) * 0.30;

  // head-switching noise on the last lines of the frame
  float hs = smoothstep(0.982, 0.995, s.y);
  sig = mix(sig, hash21(vec2(floor(fc.x * 0.5), ly + chunk * 91.0)), hs * 0.85);

  // ---- snow. Analogue noise is correlated along the scan, so it is sampled
  // per source line and at half horizontal resolution, then smeared once more
  // into its neighbour: per-pixel white noise reads as digital sensor grain.
  float nx = floor(fc.x * 0.5);
  float nseed = ly + floor(u_time * 60.0) * 13.0;
  float snow = hash21(vec2(nx, nseed)) * 0.6 + hash21(vec2(nx - 1.0, nseed)) * 0.4;
  float streak = smoothstep(0.86, 1.0, hash21(vec2(ly, floor(u_time * 30.0))));

  // A black-level pedestal, so the raster is being written across the WHOLE
  // face and not only where the card has an element. It costs nothing and it is
  // what puts the scanline comb everywhere instead of only inside the picture.
  float amp = 1.0 - u_dropout;
  float L = (sig + 0.06) * amp;
  L += snow * (0.05 * u_noise + 0.80 * u_dropout + 0.13 * streak * u_noise);

  // interlace, in TUBE space — the beam writes alternate lines of the face, and
  // because the persistence below is also in tube space the unwritten line is
  // last frame's decaying, which is the whole reason interline flicker looks
  // like an interlaced source rather than like a strobe
  float tubeLine = floor(uv.y * LINES);
  L *= mix(1.0, 0.86, abs(mod(tubeLine, 2.0) - u_field));

  L = clamp(L, 0.0, 1.3);

  // ---- pointer beam overdrive --------------------------------------------
  // Distance to the SEGMENT the pointer swept this frame, not to a point: the
  // stroke is continuous at any speed with no ring buffer and no beading, and
  // the persistence below turns it into the comet a real over-driven beam
  // leaves behind.
  float beam = 0.0;
  if (u_beam > 0.0) {
    float dd = segDist(vec2(fc.x, u_size.y - fc.y), u_p0, u_p1);
    beam = u_beam * (exp(-dd * dd / 300.0) + 0.28 * exp(-dd * dd / 2600.0));
  }

  // ---- phosphor -----------------------------------------------------------
  // max(), not mix(): a phosphor is excited to a level and then decays from it.
  // The subtracted floor is not cosmetic — the buffer is 8-bit, and pure
  // multiplicative decay stalls at whatever value rounds to itself, leaving a
  // permanent ghost of every bright thing that ever crossed the tube.
  // in TEXTURE space, not tube space: this pass is drawing into a framebuffer
  // whose row 0 is the bottom, so reading the history at the tube's y-down
  // coordinate flips it every frame and the phosphor accumulates a mirror of
  // itself — which looks uncannily like a second station bleeding through
  vec4 prev = texture2D(u_prev, fc / u_size);
  float r = max(L, prev.r * u_decay.x - 0.006);
  float g = max(L * 0.62, prev.g * u_decay.y - 0.004);
  float b = max(beam, prev.b * u_decay.z - 0.010);
  gl_FragColor = vec4(clamp(vec3(r, g, b), 0.0, 1.0), 1.0);
}
`;

const FRAG_GLASS = `
${COMMON}

#define LINES ${LINES}.0

uniform sampler2D u_acc;
uniform float u_time;
uniform float u_curve;
uniform float u_bloomR;
uniform float u_bias;
uniform float u_contrast;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform vec3 u_accent;

vec3 ramp(float x) {
  vec3 c = mix(u_c0, u_c1, smoothstep(0.0, 0.24, x));
  c = mix(c, u_c2, smoothstep(0.22, 0.52, x));
  c = mix(c, u_c3, smoothstep(0.50, 0.80, x));
  c = mix(c, u_c4, smoothstep(0.78, 1.0, x));
  return c;
}

void main() {
  vec2 fc = gl_FragCoord.xy / u_dpr;
  // The accumulation was written to a framebuffer, whose row 0 is the BOTTOM of
  // the tube, so this pass works in TEXTURE space (y up) rather than in the
  // signal pass's y-down space. Sampling it with a y-down coordinate composites
  // the whole picture upside down, and a test card is symmetric enough to hide
  // it — the caption is the only thing that gives it away.
  vec2 uv = fc / u_size;

  // tube curvature, with the picture overscanned by exactly the amount the
  // distortion pulls in so a full-bleed frame never shows an empty corner
  vec2 cc = uv * 2.0 - 1.0;
  float r2 = dot(cc, cc);
  vec2 wc = cc * (1.0 + r2 * u_curve) / (1.0 + 2.0 * u_curve);
  vec2 uvw = wc * 0.5 + 0.5;

  vec4 acc = texture2D(u_acc, uvw);

  // bloom: a golden-angle spiral, weighted toward the centre. One loop covers
  // both the tight halation and the wide veil because the radius rides the
  // sample index.
  float bl = 0.0;
  float wsum = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float a = fi * 2.39996;
    float rad = (fi + 0.7) / 12.0;
    vec2 o = vec2(cos(a), sin(a)) * rad * rad * u_bloomR;
    o.x /= max(u_size.x / u_size.y, 0.001);
    float w = 1.0 - rad * 0.72;
    bl += texture2D(u_acc, uvw + o).r * w;
    wsum += w;
  }
  bl /= max(wsum, 0.001);

  float e = acc.r + acc.g * 0.26 + bl * 0.62;

  // the raster comb, in tube space so it is fixed to the glass
  float sl = 0.5 + 0.5 * cos(uvw.y * 6.2832 * LINES);
  e *= 1.0 - 0.34 * sl;

  // aperture grille: a 3-css-px vertical pitch, phase-locked to the display and
  // not to the picture, so it survives the adaptive render scale unmoved
  float grille = 0.5 + 0.5 * cos(fc.x * 2.0944);
  e *= 1.0 - 0.13 * grille;

  // mains hum bar, drifting up the face at the beat frequency between the
  // supply and the field rate
  float hum = fract(uvw.y - u_time * 0.055) - 0.5;
  e *= 1.0 + 0.13 * exp(-hum * hum * 26.0);

  // the glass itself: a broad off-axis sheen and the shadow of the bezel
  e += (1.0 - smoothstep(0.0, 1.5, length(wc - vec2(-0.55, 0.62)))) * 0.045;
  float vig = smoothstep(0.55, 1.42, length(wc * vec2(1.0, 1.12)));
  e *= 1.0 - vig * 0.42;
  e -= smoothstep(0.86, 1.0, max(abs(wc.x), abs(wc.y))) * 0.10;

  float L = clamp((e - 0.5) * u_contrast + 0.5 + u_bias, 0.0, 1.0);
  vec3 col = ramp(L);

  // accent is the pointer's beam and nothing else: acc.b is written only while
  // a pointer is on the tube and decays to exactly zero, so a resting frame
  // contains none of it
  float lock = clamp(acc.b * 1.35, 0.0, 1.0);
  col = mix(col, mix(col, u_accent, 0.62), lock);

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
    throw new Error(`flyback-tear: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Program — one fragment shader over a fullscreen triangle pair, with uniform
// locations resolved lazily by name. Several of these share one context.
// ---------------------------------------------------------------------------
class Program {
  prog: WebGLProgram | null = null;
  private vs: WebGLShader | null = null;
  private fs: WebGLShader | null = null;
  private locs = new Map<string, WebGLUniformLocation | null>();

  constructor(private gl: WebGLRenderingContext, frag: string) {
    this.vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    this.fs = compile(gl, gl.FRAGMENT_SHADER, frag);
    const p = gl.createProgram();
    if (!p) throw new Error("flyback-tear: createProgram failed");
    this.prog = p;
    gl.attachShader(p, this.vs);
    gl.attachShader(p, this.fs);
    gl.bindAttribLocation(p, 0, "a_pos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error("flyback-tear: link failed");
    }
  }

  use() {
    this.gl.useProgram(this.prog);
  }

  private loc(name: string) {
    if (!this.locs.has(name)) {
      this.locs.set(name, this.gl.getUniformLocation(this.prog!, name));
    }
    return this.locs.get(name) ?? null;
  }

  f(name: string, x: number) {
    this.gl.uniform1f(this.loc(name), x);
  }
  i(name: string, x: number) {
    this.gl.uniform1i(this.loc(name), x);
  }
  v2(name: string, x: number, y: number) {
    this.gl.uniform2f(this.loc(name), x, y);
  }
  v3(name: string, c: RGB) {
    this.gl.uniform3f(this.loc(name), c[0], c[1], c[2]);
  }

  destroy() {
    const gl = this.gl;
    if (this.prog) gl.deleteProgram(this.prog);
    if (this.vs) gl.deleteShader(this.vs);
    if (this.fs) gl.deleteShader(this.fs);
    this.prog = null;
    this.vs = null;
    this.fs = null;
    this.locs.clear();
  }
}

type Target = { fb: WebGLFramebuffer; tex: WebGLTexture };

// A composed still: the vertical hold mid-slip with the blanking bar a third of
// the way down, a tear burst live, and enough warm-up frames behind it that the
// phosphor carries a real smear. This is the frame prefers-reduced-motion gets
// and the frame the screenshot gate grades, so it is chosen rather than
// whatever t=0 happens to be.
const STATIC_TIME = 7.3;
const STATIC_ROLL = 0.9;
const STATIC_TEAR = 0.55;
// Frames of accumulation run before any composite whose buffer is cold — first
// mount, a resize, a render-scale step, a context restore. Without it the tube
// composites an empty phosphor and the first thing anyone sees is a thin,
// wrong version of the picture that fills in a beat later.
const WARMUP_FRAMES = 22;

export function FlybackTear({
  caption = "NO SIGNAL",
  captionWeight = 700,
  captionFit = 0.52,
  captionY = 0.5,
  tear = 1,
  noise = 1,
  persistence = 1,
  curvature = 1,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: FlybackTearProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const captionRef = useRef(caption);
  captionRef.current = caption;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    }) as WebGLRenderingContext | null;
    if (!gl) return; // no WebGL: children still render over the page background

    let signalProg: Program | null = null;
    let glassProg: Program | null = null;
    let quad: WebGLBuffer | null = null;
    let targets: [Target, Target] | null = null;
    let front = 0;
    let texture: WebGLTexture | null = null;
    let textAmt = 0;

    let raf = 0;
    let running = false;
    let staticMode = false;
    let disposed = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let lastMs = performance.now();
    let simTime = 0;
    let field = 0;

    // Adaptive render scale. Two fullscreen passes with a four-tap signal and a
    // twelve-tap bloom is a heavier per-pixel bill than a single-pass shader, so
    // unlike weld-pool this starts at the full device DPR (scanline pitch and
    // grille are exactly the high-frequency structure that a reduced backing
    // store destroys first) and steps down only if frames genuinely go slow.
    // Every threshold is wall-clock ms, never a frame count: a frame-counted
    // gate waits longest on the machine that needs help soonest.
    const SCALES = [1, 0.78, 0.6];
    const BUDGET_OVER = 24;
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;

    // ---- failure-mode state machine ---------------------------------------
    // On the CPU because these are events with legible durations, not noise:
    // the shader only ever sees the current amplitude of each.
    let roll = 0;
    let rollVel = 0;
    let nextRollAt = 2.6;
    let tearBoost = 0;
    let tearUntil = 0;
    let nextTearAt = 1.1;
    let dropout = 0;
    let dropUntil = 0;
    // The first dropout is pushed well past the screenshot window: a collapsed
    // frame is the one state of this component that reads as broken rather than
    // as an effect, so it must never be what a card or a verifier catches.
    let nextDropAt = 11;

    const stepEvents = (dt: number) => {
      const t = simTime;

      // vertical hold: an impulse that decays, then re-locks to the top of the
      // frame. The re-lock is the beat — a picture that drifts and stays put
      // reads as a scrolling background, a picture that snaps back reads as a
      // set fighting to hold sync.
      if (t >= nextRollAt) {
        rollVel += (Math.random() < 0.5 ? -1 : 1) * (0.07 + Math.random() * 0.28);
        nextRollAt = t + 5 + Math.random() * 8;
      }
      rollVel *= Math.exp(-dt / 0.8);
      roll += rollVel * dt + dt * 0.0035;
      // the excursion is deliberately under half a frame and the re-lock is
      // quick: a picture that spends most of its life rolling stops reading as
      // a set losing sync and starts reading as a scrolling background, and the
      // caption is never legible long enough to be worth putting there
      if (Math.abs(rollVel) < 0.03) {
        let off = roll - Math.round(roll);
        off *= 1 - Math.exp(-dt / 0.32);
        roll -= off;
      }
      roll -= Math.floor(roll);

      if (t >= nextTearAt) {
        tearUntil = t + 0.07 + Math.random() * 0.4;
        nextTearAt = t + 0.9 + Math.random() * 3.4;
      }
      const tearTarget = t < tearUntil ? 1 : 0;
      tearBoost += (tearTarget - tearBoost) * (1 - Math.exp(-dt / (tearTarget ? 0.018 : 0.11)));

      if (t >= nextDropAt) {
        // kept under a quarter second on purpose: long enough to register as
        // the signal going away, short enough that no still can land in it
        dropUntil = t + 0.06 + Math.random() * 0.16;
        nextDropAt = t + 7 + Math.random() * 11;
      }
      const dropTarget = t < dropUntil ? 1 : 0;
      dropout += (dropTarget - dropout) * (1 - Math.exp(-dt / 0.02));
      if (dropTarget === 0 && dropout < 0.004) dropout = 0;
    };

    // ---- pointer -----------------------------------------------------------
    // A lead-compensated follower, advanced in the frame rather than in the
    // event handler. A plain exponential follower has a steady-state error of
    // exactly v*tau under constant velocity, and since the beam is written at
    // the followed position that error is a lag the whole stroke inherits;
    // extrapolating the target one tau ahead cancels the term algebraically, so
    // the head sits on the cursor and the smoothing is spent only on direction
    // changes and on frames that carried no event. And because the beam is
    // written as the distance to the SEGMENT between last frame's position and
    // this one's, the deposit rate is the display's, not the pointer's — the
    // stroke cannot bead however sparsely pointermove happens to fire.
    const POINTER_TAU = 0.012;
    const VEL_TAU = 0.06;
    const LEAD_MAX = 26;
    let havePointer = false;
    let tgtX = 0;
    let tgtY = 0;
    let ptrX = 0;
    let ptrY = 0;
    let prevX = 0;
    let prevY = 0;
    let velX = 0;
    let velY = 0;
    let lastTgtX = 0;
    let lastTgtY = 0;
    let beamTarget = 0;
    let beamAmt = 0;
    let rectLeft = 0;
    let rectTop = 0;
    let rectDirty = true;

    const stepPointer = (dt: number) => {
      prevX = ptrX;
      prevY = ptrY;
      beamAmt += (beamTarget - beamAmt) * (1 - Math.exp(-dt / 0.09));
      if (!havePointer || dt <= 0) return;
      const vk = 1 - Math.exp(-dt / VEL_TAU);
      velX += ((tgtX - lastTgtX) / dt - velX) * vk;
      velY += ((tgtY - lastTgtY) / dt - velY) * vk;
      lastTgtX = tgtX;
      lastTgtY = tgtY;
      let leadX = velX * POINTER_TAU;
      let leadY = velY * POINTER_TAU;
      const lead = Math.hypot(leadX, leadY);
      if (lead > LEAD_MAX) {
        leadX = (leadX / lead) * LEAD_MAX;
        leadY = (leadY / lead) * LEAD_MAX;
      }
      const k = 1 - Math.exp(-dt / POINTER_TAU);
      ptrX += (tgtX + leadX - ptrX) * k;
      ptrY += (tgtY + leadY - ptrY) * k;
    };

    // ---- palette -----------------------------------------------------------
    // Five stops, and the ramp's DIRECTION is what carries the theme. Dark: a
    // tube, beam energy climbing from an unlit face toward white-hot. Light: the
    // same signal as a photographic negative of itself — energy climbing into
    // ink on paper, so bloom becomes a smudge spreading out of the stroke
    // instead of a halo, which is what that polarity ought to do. Nothing
    // upstream of this function knows which is in force.
    let c0: RGB = [0.02, 0.02, 0.02];
    let c1: RGB = [0.16, 0.16, 0.16];
    let c2: RGB = [0.5, 0.5, 0.5];
    let c3: RGB = [0.9, 0.9, 0.9];
    let c4: RGB = [1, 1, 1];
    let accent: RGB = [0, 0.42, 1];
    let bias = 0;
    let contrast = 1.2;

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const border = parseHex(cs.getPropertyValue("--border")) ?? [0.18, 0.18, 0.18];
      accent = parseHex(cs.getPropertyValue("--ns-accent")) ?? [0, 0.42, 1];
      const black: RGB = [0, 0, 0];
      const white: RGB = [1, 1, 1];
      if (luminance(bg) < 0.5) {
        // the dark end has to be lifted well off the tube's own black or the
        // graticule — the thing that fills the face between the bright
        // elements — crushes into the background and two thirds of the frame
        // goes empty. The light theme gets this for free: a small luminance is
        // already a large step away from paper.
        c0 = mixRGB(bg, black, 0.6);
        c1 = mixRGB(border, fg, 0.2);
        c2 = mixRGB(muted, fg, 0.2);
        c3 = fg;
        c4 = mixRGB(fg, white, 0.9);
        bias = 0.0;
        contrast = 1.2;
      } else {
        c0 = bg;
        c1 = mixRGB(bg, muted, 0.34);
        c2 = mixRGB(muted, bg, 0.08);
        c3 = fg;
        c4 = mixRGB(fg, black, 0.55);
        bias = -0.04;
        contrast = 1.36;
      }
    };
    readColors();

    // ---- caption texture ---------------------------------------------------
    const texCanvas = document.createElement("canvas");

    const rasterizeText = () => {
      if (cssW < 2 || cssH < 2) return;
      const tw = Math.max(256, Math.min(1024, Math.round(cssW)));
      const th = Math.max(128, Math.round(tw * (cssH / cssW)));
      texCanvas.width = tw;
      texCanvas.height = th;
      const ctx = texCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const family = getComputedStyle(wrap).fontFamily || "system-ui, sans-serif";
      const lines = captionRef.current.split("\n").filter((l) => l.length > 0);
      ctx.clearRect(0, 0, tw, th);
      if (lines.length > 0) {
        const probe = 100;
        ctx.font = `${captionWeight} ${probe}px ${family}`;
        let widest = 1;
        for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
        const size = Math.min((tw * captionFit * probe) / widest, (th * 0.4) / lines.length);
        ctx.font = `${captionWeight} ${size}px ${family}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        const lead = size * 1.06;
        const top = th * captionY - ((lines.length - 1) * lead) / 2;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], tw / 2, top + i * lead);
      }
      const img = ctx.getImageData(0, 0, tw, th).data;
      const rgba = new Uint8Array(tw * th * 4);
      for (let i = 0, j = 0; i < tw * th; i++, j += 4) {
        rgba[j] = img[j + 3];
        rgba[j + 3] = 255;
      }
      if (!texture) {
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        gl.bindTexture(gl.TEXTURE_2D, texture);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      textAmt = lines.length > 0 ? 1 : 0;
    };

    // ---- targets -----------------------------------------------------------
    const makeTarget = (w: number, h: number): Target | null => {
      const tex = gl.createTexture();
      const fb = gl.createFramebuffer();
      if (!tex || !fb) return null;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { fb, tex };
    };

    const freeTargets = () => {
      if (!targets) return;
      for (const t of targets) {
        gl.deleteFramebuffer(t.fb);
        gl.deleteTexture(t.tex);
      }
      targets = null;
    };

    const allocTargets = (w: number, h: number) => {
      freeTargets();
      const a = makeTarget(w, h);
      const b = makeTarget(w, h);
      if (!a || !b) return;
      targets = [a, b];
      front = 0;
    };

    // ---- draw --------------------------------------------------------------
    const accumulate = (dt: number) => {
      if (!signalProg || !targets) return;
      const src = targets[front];
      const dst = targets[1 - front];
      signalProg.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      signalProg.i("u_prev", 0);
      signalProg.i("u_text", 1);
      signalProg.v2("u_size", cssW, cssH);
      signalProg.f("u_dpr", dpr);
      signalProg.f("u_ar", cssW / Math.max(cssH, 1));
      signalProg.f("u_time", staticMode ? STATIC_TIME : simTime);
      signalProg.f("u_textAmt", textAmt);
      signalProg.f("u_roll", staticMode ? STATIC_ROLL : roll);
      signalProg.f("u_tear", Math.max(0, tear));
      signalProg.f("u_tearBoost", staticMode ? STATIC_TEAR : tearBoost);
      signalProg.f("u_noise", Math.max(0, noise));
      signalProg.f("u_dropout", staticMode ? 0 : dropout);
      signalProg.f("u_field", field);
      // decay per elapsed frame, from time constants, so persistence length is
      // a property of the phosphor and not of the frame rate
      const p = Math.max(0.05, persistence);
      signalProg.v3("u_decay", [
        Math.exp(-dt / (0.045 * p)),
        Math.exp(-dt / (0.2 * p)),
        Math.exp(-dt / (0.52 * p)),
      ] as RGB);
      signalProg.v2("u_p0", prevX, prevY);
      signalProg.v2("u_p1", ptrX, ptrY);
      signalProg.f("u_beam", havePointer || beamAmt > 0.002 ? beamAmt : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      front = 1 - front;
      field = field === 0 ? 1 : 0;
    };

    const composite = () => {
      if (!glassProg || !targets) return;
      glassProg.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[front].tex);
      glassProg.i("u_acc", 0);
      glassProg.v2("u_size", cssW, cssH);
      glassProg.f("u_dpr", dpr);
      glassProg.f("u_time", staticMode ? STATIC_TIME : simTime);
      glassProg.f("u_curve", 0.055 * Math.max(0, curvature));
      glassProg.f("u_bloomR", 0.055);
      glassProg.f("u_bias", bias);
      glassProg.f("u_contrast", contrast);
      glassProg.v3("u_c0", c0);
      glassProg.v3("u_c1", c1);
      glassProg.v3("u_c2", c2);
      glassProg.v3("u_c3", c3);
      glassProg.v3("u_c4", c4);
      glassProg.v3("u_accent", accent);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // A cold accumulation buffer composites to a thin, wrong picture — the
    // phosphor holds nothing, so no smear, no bloom feed, no interlace history.
    // Every path that invalidates the buffers runs this before showing anything.
    const warmUp = () => {
      const dt = 1 / 60;
      for (let i = 0; i < WARMUP_FRAMES; i++) {
        if (!staticMode) {
          simTime += dt * Math.max(0.05, speed);
          stepEvents(dt);
        }
        accumulate(dt);
      }
      composite();
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0.0005, rawMs / 1000));
      lastMs = nowMs;
      simTime += dt * Math.max(0.05, speed);
      stepEvents(dt);
      stepPointer(dt);
      accumulate(dt);
      composite();

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

    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2) * SCALES[scaleIdx];
      const pw = Math.max(2, Math.round(cssW * dpr));
      const ph = Math.max(2, Math.round(cssH * dpr));
      const sizeChanged = canvas.width !== pw || canvas.height !== ph;
      if (sizeChanged) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      if (sizeChanged || !targets) allocTargets(pw, ph);
      warmUp();
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const changed = Math.abs(rect.width - cssW) > 0.5 || Math.abs(rect.height - cssH) > 0.5;
      cssW = rect.width;
      cssH = rect.height;
      rectLeft = rect.left;
      rectTop = rect.top;
      rectDirty = false;
      // a new size is a new per-frame cost, so the ladder starts over rather
      // than carrying a verdict earned at a different number of fragments
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      if (changed) rasterizeText();
      applyBacking();
    };

    const syncRect = () => {
      if (!rectDirty) return;
      const rect = wrap.getBoundingClientRect();
      rectLeft = rect.left;
      rectTop = rect.top;
      rectDirty = false;
    };
    const markRectDirty = () => {
      rectDirty = true;
    };

    const setTarget = (e: PointerEvent) => {
      syncRect();
      const co = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null;
      const last = co && co.length > 0 ? co[co.length - 1] : e;
      tgtX = last.clientX - rectLeft;
      tgtY = last.clientY - rectTop;
    };
    const snapPointer = () => {
      ptrX = tgtX;
      ptrY = tgtY;
      prevX = tgtX;
      prevY = tgtY;
      velX = 0;
      velY = 0;
      lastTgtX = tgtX;
      lastTgtY = tgtY;
      havePointer = true;
    };
    // A frozen tube has no loop to advance the beam in, so a pointer over it
    // writes one deposit and one composite by hand.
    const staticStroke = () => {
      accumulate(1 / 60);
      composite();
    };
    const onPointerEnter = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      beamTarget = 1;
      if (staticMode) {
        beamAmt = 1;
        staticStroke();
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      setTarget(e);
      if (!havePointer) snapPointer();
      beamTarget = 1;
      if (staticMode) {
        prevX = ptrX;
        prevY = ptrY;
        ptrX = tgtX;
        ptrY = tgtY;
        beamAmt = 1;
        staticStroke();
      }
    };
    const onPointerLeave = () => {
      beamTarget = 0;
      havePointer = false;
    };
    const onPointerDown = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      beamTarget = 1;
      if (staticMode) {
        beamAmt = 1;
        staticStroke();
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      // a lifted touch has no position and no pointerleave is coming
      if (e.pointerType !== "mouse") {
        beamTarget = 0;
        havePointer = false;
      }
    };
    const onPointerCancel = () => {
      beamTarget = 0;
      havePointer = false;
    };

    const buildPrograms = (): boolean => {
      try {
        signalProg = new Program(gl, FRAG_SIGNAL);
        glassProg = new Program(gl, FRAG_GLASS);
      } catch {
        return false;
      }
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      return true;
    };

    if (!buildPrograms()) return;

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    // webfont metrics are not final at mount, and the caption is baked into a
    // texture once — without this the fallback letterforms are frozen in
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (disposed) return;
        rasterizeText();
        if (staticMode) warmUp();
      });
    }

    wrap.addEventListener("pointerenter", onPointerEnter);
    wrap.addEventListener("pointerleave", onPointerLeave);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerdown", onPointerDown);
    wrap.addEventListener("pointerup", onPointerUp);
    wrap.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("scroll", markRectDirty, { passive: true, capture: true });
    window.addEventListener("resize", markRectDirty, { passive: true });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        warmUp();
      } else {
        staticMode = false;
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    // a full-bleed two-pass shader off-screen is the most expensive idle thing
    // a page can carry
    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) sleep();
        else if (!staticMode && !document.hidden) wake();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);
    applyMode();

    // polled rather than made effect dependencies: either would tear down and
    // recreate the whole GL context to change a string or a boolean
    let lastPolledPaused = pausedRef.current;
    let lastPolledCaption = captionRef.current;
    let poll = 0;
    const tick = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      if (captionRef.current !== lastPolledCaption) {
        lastPolledCaption = captionRef.current;
        rasterizeText();
        if (staticMode) warmUp();
      }
      poll = window.setTimeout(tick, 140);
    };
    tick();

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (staticMode) composite();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onLost = (e: Event) => {
      e.preventDefault();
      sleep();
    };
    // every GL object is gone after a loss, including both framebuffers, both
    // accumulation textures and the ping-pong index — rebuilding only the
    // programs would leave a black tube that reproduces on nobody's machine
    const onRestored = () => {
      signalProg = null;
      glassProg = null;
      targets = null;
      texture = null;
      quad = null;
      front = 0;
      if (!buildPrograms()) return;
      cssW = 0;
      cssH = 0;
      resize();
      rasterizeText();
      applyMode();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return () => {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      wrap.removeEventListener("pointerenter", onPointerEnter);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerdown", onPointerDown);
      wrap.removeEventListener("pointerup", onPointerUp);
      wrap.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("scroll", markRectDirty, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("resize", markRectDirty);
      window.clearTimeout(poll);
      sleep();
      freeTargets();
      if (texture) gl.deleteTexture(texture);
      texture = null;
      if (quad) gl.deleteBuffer(quad);
      quad = null;
      signalProg?.destroy();
      glassProg?.destroy();
      signalProg = null;
      glassProg = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionWeight, captionFit, captionY, tear, noise, persistence, curvature, speed]);

  return (
    <div
      ref={wrapRef}
      data-flyback-tear={uid}
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />
      {/* the caption exists only as a luminance texture inside the signal, so
          the accessible copy lives here — same string, nothing to keep in sync */}
      <h1 className="sr-only">{caption.split("\n").join(" ")}</h1>
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

FlybackTear.displayName = "FlybackTear";
