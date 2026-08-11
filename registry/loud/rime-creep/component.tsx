"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// RimeCreep — a full-bleed pane of window frost that is GROWN, not sampled.
//
// Three parts. A CPU tip simulation walks dendrite tips across the pane on a
// fixed six-fold lattice — six primary arms per nucleation point, side branches
// at exactly +/-60 degrees from the parent heading, every generation staying on
// the same lattice. That fixed angle set is the whole tell: a curvature-driven
// or noise-driven front produces mushy emergent branch angles and the eye reads
// it as smoke. Deposits go into a persistent RGBA8 accumulation buffer that is
// never cleared, so the cost per frame is the number of NEW segments and not
// the amount of frost already on the glass. One fragment shader then reads that
// buffer as ice: scatter first, shading second, because frost is bright from
// air-ice interfaces rather than from a lamp pointed at it.
//
// A coarse occupancy grid stamped with grain ids is what makes fronts collide
// properly. A tip stepping into another grain's cell dies where it stands, so
// two fronts advancing at each other both stop a cell short and leave a thin
// unfrosted seam — a grain boundary, which is the second thing that says ice.
//
// Nothing redraws old frost. Arms thicken because the render pass lowers its
// coverage threshold with the AGE stored per texel, so a segment's soft skirt
// crosses the threshold seconds after its core did and the clear glass between
// the arms closes over on its own.
//
// Palette: five luminance stops from --background, --foreground, --ns-muted and
// --border (getComputedStyle, re-read on a documentElement class mutation). The
// glass level is an explicit uniform because the two themes are different
// pictures: dark is a cold black pane with the ice owning the top of the range;
// light sets the clear glass at a mid pale grey so the frost keeps headroom
// ABOVE it for the arm cores and BELOW it for the contact lines. Nothing here
// is chromatic, the warm pointer included — a tinted halo is the fastest way to
// make a monochrome pane look like a glow sprite pasted over it.
// ---------------------------------------------------------------------------

export interface RimeCreepProps {
  /** How many crystals nucleate — higher is a finer, busier pane. @default 1 */
  density?: number;
  /** Tip advance rate multiplier. @default 1 */
  growth?: number;
  /** Strength of the surface relief lighting on the ice. @default 1 */
  relief?: number;
  /** Micro-facet scintillation amount, 0 turns the twinkle off. @default 1 */
  sparkle?: number;
  /** Global time multiplier. @default 1 */
  speed?: number;
  /** Freezes the pane on a composed still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the pane — eyebrow, headline, CTA. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// The birth clock. Every deposit stores the phase of this sawtooth in the G
// channel and the render pass differences it against the current phase to get
// the texel's age. It is long relative to the thaw sweep on purpose: a texel
// that survived a whole turn of the clock would read as newborn again and its
// arm would visibly thin, so the clock has to outlast anything the sweep leaves
// standing.
const BIRTH_CLOCK = 96;
// Age (in seconds) at which an arm has finished fattening.
const MATURE = 11;
// One pass of the thaw front across the pane, and the band's width in the same
// normalised projection units.
const SWEEP_PERIOD = 31;
const THAW_W = 0.075;
const THAW_RATE = 3.6;

// Simulation constants, all in CSS px.
const CELL = 5; // occupancy cell size
const EMIT_STEP = 4; // travel between deposited segments
const MAX_TIPS = 2400;
const MAX_GEN = 5;
const BASE_SPEED = 47;
const GEN_SPEED = 0.63;
const GEN_WIDTH = 0.66;
const BASE_WIDTH = 2.7;
const BASE_GAP = 21; // travel between side branches
const GEN_GAP = 0.78;
// Range budget per generation, and it is the FIRST entry that sets the picture:
// primaries left to run until they hit something produce a handful of enormous
// crystals with bare glass between them, which reads as snowflake clip art
// rather than as a frosted pane. Capping the primary run means many crystals of
// a similar size, colliding into each other, which is what a cold window
// actually does. Every child then gets a shorter budget so an arm tapers into a
// fern instead of spreading into a bush.
const GEN_RANGE = [430, 145, 66, 31, 15, 8];

// Pointer follower. A plain exponential follower has a steady-state error of
// exactly velocity*tau under constant velocity, which reads as the glass being
// slow to warm rather than as damping; extrapolating the target one tau ahead
// cancels that term algebraically, and LEAD_MAX stops a teleporting pointer
// flinging the warm spot past the cursor.
const POINTER_TAU = 0.014;
const VEL_TAU = 0.06;
const LEAD_MAX = 26;

// How far ahead of the first painted frame the simulation is run at mount, so
// the pane arrives already half-frosted instead of proving its liveness with an
// autoplay descriptor.
const PREWARM = 18;
const PREWARM_STILL = 26;
const PREWARM_DT = 1 / 40;

const SCREEN_VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// One segment of dendrite. The quad is padded well beyond the arm so the
// feather barbs have somewhere to live; the core and the skirt are clipped
// longitudinally to the segment's own length so butt-jointed segments sum to a
// continuous arm instead of beading at every joint.
const DEPOSIT_VERT = `
attribute vec2 a_pos;
attribute vec2 a_local;
attribute vec4 a_meta;
attribute float a_birth;
uniform vec2 u_size;
varying vec2 v_local;
varying vec4 v_meta;
varying float v_birth;
void main() {
  v_local = a_local;
  v_meta = a_meta;
  v_birth = a_birth;
  vec2 c = vec2(a_pos.x / u_size.x * 2.0 - 1.0, 1.0 - a_pos.y / u_size.y * 2.0);
  gl_Position = vec4(c, 0.0, 1.0);
}
`;

const DEPOSIT_FRAG = `
precision highp float;
varying vec2 v_local;   // x = along the arm, y = across it, both css px
varying vec4 v_meta;    // half-width, barb length, segment length, orientation
varying float v_birth;
uniform float u_pass;   // 0 = density, 1 = birth + orientation tags

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

void main() {
  float hw = max(v_meta.x, 0.5);
  float len = v_meta.z;
  float u = v_local.x;
  float av = abs(v_local.y);
  float side = v_local.y < 0.0 ? 0.0 : 1.0;

  // The arm itself: a tight ridge plus a broad low reservoir.
  // The skirt is wide and low on purpose. It is the reservoir the render pass's
  // falling age threshold eats into, and because two nearby arms' skirts SUM,
  // the glass between them crosses the threshold before either arm's own skirt
  // would — which is the mechanism by which the clear gaps close over instead
  // of every arm merely getting fatter in place.
  float ends = smoothstep(-0.6, 0.6, u) * smoothstep(-0.6, 0.6, len - u);
  float core = exp(-(av * av) / (hw * hw) * 1.55);
  float skirt = exp(-(av * av) / (hw * hw * 26.0));
  float body = (core * 0.22 + skirt * 0.038) * ends;

  // barbs on a lattice along the arm, at the same +/-60 the branches use, with
  // hashed lengths so the feather is irregular at pixel scale rather than at
  // simulation scale
  float sp = hw * 3.0 + 1.7;
  float idx = floor(u / sp);
  float hair = 0.0;
  for (int k = 0; k < 2; k++) {
    float i = idx + float(k);
    float u0 = (i + 0.5) * sp;
    float inSeg = step(0.0, u0) * step(u0, len);
    float du = u - u0;
    float a = du * 0.5 + av * 0.8660254;
    float b = -du * 0.8660254 + av * 0.5;
    float L = v_meta.y * (0.5 + 0.8 * hash11(i * 1.37 + v_meta.w * 13.0 + side * 5.1));
    float w = hw * 0.52;
    hair = max(hair, exp(-(b * b) / (w * w) * 1.7) * smoothstep(L, 0.0, a) * step(-0.6, a) * inSeg);
  }

  float dens = body + hair * 0.13;
  dens *= 0.76 + 0.36 * hash21(v_local * 0.75 + v_meta.wz * 57.0);

  if (u_pass < 0.5) {
    gl_FragColor = vec4(dens, 0.0, 0.0, 1.0);
  } else {
    // near-binary alpha, so a segment's faint skirt cannot drag the birth phase
    // of the glass it passes over toward "half as old"
    gl_FragColor = vec4(0.0, v_birth, v_meta.w, smoothstep(0.010, 0.055, dens));
  }
}
`;

// The only thing that ever REMOVES frost: a multiply-down pass, written with a
// colour mask over the density channel only. Decaying the birth channel as well
// would drive age upward, and since age is what fattens an arm, melting frost
// would thicken exactly as it should be vanishing.
const DECAY_FRAG = `
precision highp float;
uniform vec2 u_buf;    // accumulation buffer size, texels
uniform vec2 u_size;   // css px
uniform float u_dt;
uniform vec4 u_thaw;   // xy unit direction, z front position, w band width
uniform float u_thawRate;
uniform vec3 u_warm;   // xy css px (y up), z strength
uniform float u_warmR;

void main() {
  vec2 uv = gl_FragCoord.xy / u_buf;
  // the thaw front: a band crossing the pane, strong enough that a texel it
  // passes over is cleared, and zero once it has gone by, so crystals nucleate
  // and regrow in its wake instead of being held down forever
  float proj = dot(uv, u_thaw.xy);
  float k = (proj - u_thaw.z) / max(0.02, u_thaw.w);
  float rate = u_thawRate * exp(-k * k);
  // the warm fingertip, in css px
  vec2 p = uv * u_size;
  float d = length(p - u_warm.xy) / max(1.0, u_warmR);
  rate += u_warm.z * 9.0 * exp(-d * d * 1.9);
  gl_FragColor = vec4(exp(-rate * u_dt), 1.0, 1.0, 1.0);
}
`;

const SCREEN_FRAG = `
precision highp float;

uniform sampler2D u_acc;
uniform vec2 u_res;      // drawing buffer px
uniform vec2 u_size;     // css px
uniform vec2 u_texel;    // 1 / accumulation buffer size
uniform float u_time;
uniform float u_phase;   // birth clock phase, 0..1
uniform float u_mature;  // MATURE / BIRTH_CLOCK
uniform float u_relief;
uniform float u_sparkle;
uniform vec3 u_warm;     // xy css px (y up), z strength
uniform float u_warmR;
uniform float u_glass;
uniform float u_iceGain;
uniform float u_haloGain;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform float u_bias;
uniform float u_contrast;

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

float fbm(vec2 p) {
  float s = vnoise(p) * 0.58;
  s += vnoise(p * 2.13 + 9.1) * 0.28;
  s += vnoise(p * 4.31 + 21.7) * 0.14;
  return s;
}

// coverage at one texel: the density that has crossed the age-dependent
// threshold. Young frost only shows its core; old frost shows its whole skirt,
// which is how an arm fattens behind its own tip.
float coverOf(vec3 a) {
  float age = u_phase - a.g;
  age += age < 0.0 ? 1.0 : 0.0;
  float thr = mix(0.145, 0.038, smoothstep(0.0, u_mature, age));
  return smoothstep(thr, thr + 0.055, a.r);
}

float coverAt(vec2 uv) {
  return coverOf(texture2D(u_acc, uv).rgb);
}

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.25) return mix(u_c0, u_c1, t / 0.25);
  if (t < 0.5) return mix(u_c1, u_c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(u_c2, u_c3, (t - 0.5) / 0.25);
  return mix(u_c3, u_c4, (t - 0.75) / 0.25);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = vec2(uv.x * u_size.x, uv.y * u_size.y); // css px, y up

  vec3 a0 = texture2D(u_acc, uv).rgb;
  float cov = coverOf(a0);
  float dens = a0.r;
  float grain = a0.b; // the crystal's lattice orientation, 0..1 over 60 degrees

  // the warm fingertip. Expressed only in coverage and luminance — the frost
  // under the pointer has already been eaten out of the accumulation buffer,
  // this is the part that responds within the frame.
  float wd = length(p - u_warm.xy) / max(1.0, u_warmR);
  float warm = u_warm.z * exp(-wd * wd * 1.6);
  cov *= 1.0 - 0.88 * warm;

  vec2 e = u_texel;
  float cx = coverAt(uv + vec2(e.x, 0.0)) - coverAt(uv - vec2(e.x, 0.0));
  float cy = coverAt(uv + vec2(0.0, e.y)) - coverAt(uv - vec2(0.0, e.y));
  float edge = clamp(length(vec2(cx, cy)) * 1.35, 0.0, 1.0);
  vec3 n = normalize(vec3(-cx * 5.5 * u_relief, -cy * 5.5 * u_relief, 1.0));
  vec3 lightDir = normalize(vec3(-0.52, 0.60, 0.61));
  float diff = max(dot(n, lightDir), 0.0);

  // thickness: how much ice is stacked here, independent of whether it has
  // crossed the coverage threshold yet
  float thick = clamp(dens * 2.1, 0.0, 1.0) * cov;

  // micro-facets. Each cell keeps a fixed seed and beats at its own rate, so
  // the whole frosted area scintillates continuously and the frame differs
  // everywhere between any two moments, not only at the advancing tips.
  vec2 fc = floor(p / 2.6);
  float fs = hash21(fc + 5.7);
  float fs2 = hash21(fc + 91.3);
  float tw = 0.5 + 0.5 * sin(u_time * (1.4 + 3.4 * fs) + fs2 * 40.0);
  float sparkle = pow(tw, 9.0) * step(0.66, fs2) * u_sparkle;

  // A very slow band of grazing light crossing the pane, phase-shifted by the
  // crystal's own lattice orientation — neighbouring grains catch it at
  // different moments, which is what makes a grain boundary legible even where
  // two ferns have grown into each other and closed the seam.
  float sweep = 0.5 + 0.5 * sin((p.x * 0.0016 + p.y * 0.0011) - u_time * 0.11 + grain * 4.4);
  float graze = pow(sweep, 3.0);

  // Scatter first, shading second: frost is bright because it is a mess of
  // air-ice interfaces, not because a lamp is pointed at it. The compression at
  // the end is what keeps a dense crystal from clipping to a flat white plate —
  // uncompressed, the arm cores, their rims and the sparkle all land above 1.0
  // together and the whole fern reads as cut paper.
  float ice = 0.0;
  ice += thick * 0.40;
  ice += edge * 0.32;
  ice += diff * cov * 0.16;
  ice += cov * graze * 0.09;
  ice += sparkle * cov * (0.10 + 0.22 * graze);
  ice = ice / (1.0 + ice * 0.55);

  // The dark contact line: the outermost fringe of an arm's skirt, the ice too
  // thin to scatter, which on a real pane reads as a shadow around the crystal.
  // It has to be a BAND and not simply "everything below the coverage
  // threshold" — the open version speckles the interior of a dense crystal
  // black wherever the deposits happened to leave a mid-density pixel, which in
  // the light theme turns the busiest part of the pane into soot.
  float halo = smoothstep(0.010, 0.055, dens) * (1.0 - smoothstep(0.075, 0.20, dens)) * (1.0 - cov);

  // the glass itself, hazing and breathing slowly so the bare parts of the pane
  // are never a flat plate
  float haze = fbm(p * 0.0045 + vec2(u_time * 0.011, -u_time * 0.008));
  float bloom = fbm(p * 0.017 + vec2(-u_time * 0.02, u_time * 0.014));
  float glass = u_glass + (haze - 0.5) * 0.075 + (bloom - 0.5) * 0.022;

  vec2 q = uv - 0.5;
  float vign = 1.0 - 0.32 * dot(q, q) * 2.2;

  float L = glass * vign + ice * u_iceGain - halo * u_haloGain;
  L += warm * 0.045;
  L += (hash21(floor(gl_FragCoord.xy) + u_time) - 0.5) * 0.012;

  L = clamp((L - 0.5) * u_contrast + 0.5 + u_bias, 0.0, 1.0);
  gl_FragColor = vec4(ramp(L), 1.0);
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
    throw new Error(`rime-creep: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// One program with lazily-resolved uniform and attribute locations. Three of
// these run the component: deposit, decay, screen.
class Program {
  program: WebGLProgram | null = null;
  private vs: WebGLShader | null = null;
  private fs: WebGLShader | null = null;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  private attribs = new Map<string, number>();

  constructor(private gl: WebGLRenderingContext, vert: string, frag: string) {
    this.vs = compile(gl, gl.VERTEX_SHADER, vert);
    this.fs = compile(gl, gl.FRAGMENT_SHADER, frag);
    const p = gl.createProgram();
    if (!p) throw new Error("rime-creep: could not create program");
    this.program = p;
    gl.attachShader(p, this.vs);
    gl.attachShader(p, this.fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(p);
      throw new Error(`rime-creep: link failed: ${info ?? ""}`);
    }
  }

  use() {
    this.gl.useProgram(this.program);
  }

  attrib(name: string): number {
    if (!this.attribs.has(name)) {
      this.attribs.set(name, this.gl.getAttribLocation(this.program!, name));
    }
    return this.attribs.get(name)!;
  }

  private loc(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) {
      this.uniforms.set(name, this.gl.getUniformLocation(this.program!, name));
    }
    return this.uniforms.get(name) ?? null;
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
  v3(name: string, x: number, y: number, z: number) {
    this.gl.uniform3f(this.loc(name), x, y, z);
  }
  v3c(name: string, c: RGB) {
    this.gl.uniform3f(this.loc(name), c[0], c[1], c[2]);
  }
  v4(name: string, x: number, y: number, z: number, w: number) {
    this.gl.uniform4f(this.loc(name), x, y, z, w);
  }

  destroy() {
    const gl = this.gl;
    if (this.program) gl.deleteProgram(this.program);
    if (this.vs) gl.deleteShader(this.vs);
    if (this.fs) gl.deleteShader(this.fs);
    this.program = null;
    this.vs = null;
    this.fs = null;
    this.uniforms.clear();
    this.attribs.clear();
  }
}

type Tip = {
  x: number;
  y: number;
  ang: number;
  speed: number;
  width: number;
  gap: number;
  sinceGap: number;
  sinceEmit: number;
  ex: number;
  ey: number;
  range: number;
  gen: number;
  grain: number;
  orient: number;
  alive: boolean;
};

const TAU = Math.PI * 2;
const SIXTH = Math.PI / 3;
const FLOATS_PER_VERTEX = 9;
const VERTS_PER_SEG = 6;

export function RimeCreep({
  density = 1,
  growth = 1,
  relief = 1,
  sparkle = 1,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: RimeCreepProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

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
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    }) as WebGLRenderingContext | null;
    if (!gl) return; // no WebGL: children still render over the page background

    let depositProg: Program | null = null;
    let decayProg: Program | null = null;
    let screenProg: Program | null = null;
    let quadBuf: WebGLBuffer | null = null;
    let segBuf: WebGLBuffer | null = null;
    let accTex: WebGLTexture | null = null;
    let accFbo: WebGLFramebuffer | null = null;

    let raf = 0;
    let running = false;
    let staticMode = false;
    let disposed = false;
    let ready = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let accW = 0;
    let accH = 0;
    let lastMs = performance.now();
    let simTime = 0;

    // Adaptive render scale, insurance and not the mechanism: it steps only
    // after a sustained stretch of wall-clock overrun and climbs back on a
    // doubling window. Every threshold is milliseconds, never frames — a
    // frame-counted gate waits longer the slower the machine is, backwards.
    // It scales the VISIBLE canvas only; the accumulation buffer is sized
    // independently, so a step down cannot wipe the frost off the glass.
    const SCALES = [1, 0.8, 0.62];
    const BUDGET_OVER = 24;
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;

    // --- simulation state ---------------------------------------------------
    let tips: Tip[] = [];
    let occ: Uint16Array = new Uint16Array(0);
    let stamp: Int32Array = new Int32Array(0);
    let gw = 0;
    let gh = 0;
    let frameNo = 0;
    let grainSeq = 1;
    let seedTimer = 0;
    let rngState = 0x9e3779b9;

    const rnd = () => {
      // xorshift, so a resize reseeds deterministically rather than pulling on
      // Math.random and making two mounts of the same page differ
      rngState ^= rngState << 13;
      rngState ^= rngState >>> 17;
      rngState ^= rngState << 5;
      return ((rngState >>> 0) % 100000) / 100000;
    };

    // Segment vertices staged here and flushed once per frame. One buffer, two
    // draw calls — a draw call per segment would make the mount prewarm
    // thousands of calls inside a single frame.
    let staging = new Float32Array(4096 * FLOATS_PER_VERTEX * VERTS_PER_SEG);
    let staged = 0; // segments

    const pushSegment = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      hw: number,
      orient: number,
      birth: number
    ) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len < 0.001) return;
      if ((staged + 1) * FLOATS_PER_VERTEX * VERTS_PER_SEG > staging.length) {
        const next = new Float32Array(staging.length * 2);
        next.set(staging);
        staging = next;
      }
      const ux = dx / len;
      const uy = dy / len;
      const px = -uy;
      const py = ux;
      const hair = hw * 2.6 + 2.2;
      const padA = hair + hw * 3.2;
      const padC = hair + hw * 3.6;
      // corners in (along, across) local px, then mapped into css px
      const cornersU = [-padA, len + padA, len + padA, -padA, len + padA, -padA];
      const cornersV = [-padC, -padC, padC, -padC, padC, padC];
      let o = staged * FLOATS_PER_VERTEX * VERTS_PER_SEG;
      for (let i = 0; i < 6; i++) {
        const a = cornersU[i];
        const b = cornersV[i];
        staging[o++] = x0 + ux * a + px * b;
        staging[o++] = y0 + uy * a + py * b;
        staging[o++] = a;
        staging[o++] = b;
        staging[o++] = hw;
        staging[o++] = hair;
        staging[o++] = len;
        staging[o++] = orient;
        staging[o++] = birth;
      }
      staged++;
    };

    const cellOf = (x: number, y: number) => {
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return -1;
      return cy * gw + cx;
    };

    // Stamp the occupancy grid along a segment. Grain ids, not a boolean: the
    // difference between "something is here" and "someone else's crystal is
    // here" is the whole grain-boundary behaviour.
    const stampLine = (x0: number, y0: number, x1: number, y1: number, grain: number) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (CELL * 0.6)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const c = cellOf(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        if (c >= 0) {
          occ[c] = grain;
          stamp[c] = frameNo;
        }
      }
    };

    const spawnTip = (
      x: number,
      y: number,
      ang: number,
      gen: number,
      grain: number,
      orient: number,
      width: number,
      gap: number
    ) => {
      if (tips.length >= MAX_TIPS) return;
      tips.push({
        x,
        y,
        ang,
        speed: BASE_SPEED * Math.pow(GEN_SPEED, gen) * (0.82 + 0.36 * rnd()),
        width,
        gap: gap * (0.7 + 0.6 * rnd()),
        sinceGap: 0,
        sinceEmit: 0,
        ex: x,
        ey: y,
        range: GEN_RANGE[Math.min(gen, GEN_RANGE.length - 1)] * (0.7 + 0.6 * rnd()),
        gen,
        grain,
        orient,
        alive: true,
      });
    };

    // A nucleation point: one grain, one lattice orientation, six primary arms.
    const nucleate = (x: number, y: number) => {
      const c = cellOf(x, y);
      if (c < 0) return;
      const grain = grainSeq++ % 60000 || 1;
      const theta = rnd() * SIXTH;
      const orient = theta / SIXTH;
      const arms = 6;
      for (let k = 0; k < arms; k++) {
        spawnTip(x, y, theta + k * SIXTH, 0, grain, orient, BASE_WIDTH, BASE_GAP);
      }
      occ[c] = grain;
      stamp[c] = frameNo;
    };

    // Is there room here? Checked over a neighbourhood rather than one cell, so
    // seeds do not nucleate inside the fringe of an existing crystal.
    const clearAround = (x: number, y: number, r: number) => {
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      const rc = Math.ceil(r / CELL);
      for (let j = -rc; j <= rc; j++) {
        for (let i = -rc; i <= rc; i++) {
          const gx = cx + i;
          const gy = cy + j;
          if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
          if (occ[gy * gw + gx] !== 0) return false;
        }
      }
      return true;
    };

    // Clear the occupancy the thaw front and the warm pointer have passed over,
    // so tips can creep back into glass that has been melted clear.
    const clearRegion = (x: number, y: number, r: number) => {
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      const rc = Math.ceil(r / CELL);
      for (let j = -rc; j <= rc; j++) {
        for (let i = -rc; i <= rc; i++) {
          const gx = cx + i;
          const gy = cy + j;
          if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue;
          if (i * i + j * j > rc * rc) continue;
          occ[gy * gw + gx] = 0;
        }
      }
    };

    let thawDirX = 0.944;
    let thawDirY = 0.33;
    let thawPos = -THAW_W;

    const resetSim = () => {
      tips = [];
      gw = Math.max(1, Math.ceil(cssW / CELL) + 1);
      gh = Math.max(1, Math.ceil(cssH / CELL) + 1);
      occ = new Uint16Array(gw * gh);
      stamp = new Int32Array(gw * gh);
      frameNo = 0;
      grainSeq = 1;
      seedTimer = 0;
      rngState = 0x9e3779b9;
      thawDirX = 0.944;
      thawDirY = 0.33;
      thawPos = -THAW_W;
      // seeds scale with the pane's area, so a wide hero and a narrow card get
      // the same crystals-per-square-inch rather than the same crystal count
      const area = (cssW * cssH) / (1440 * 900);
      const n = Math.max(4, Math.round(9 * area * Math.max(0.3, density)));
      for (let i = 0; i < n; i++) seedSomewhere(true);
    };

    // Real frost nucleates on flaws, and the pane's edge is one long flaw, so a
    // share of the seeds start hard against a border and grow inward.
    const seedSomewhere = (allowEdge: boolean) => {
      for (let attempt = 0; attempt < 12; attempt++) {
        let x: number;
        let y: number;
        if (allowEdge && rnd() < 0.42) {
          const side = Math.floor(rnd() * 4);
          const t = rnd();
          if (side === 0) {
            x = t * cssW;
            y = 2;
          } else if (side === 1) {
            x = t * cssW;
            y = cssH - 2;
          } else if (side === 2) {
            x = 2;
            y = t * cssH;
          } else {
            x = cssW - 2;
            y = t * cssH;
          }
        } else {
          x = rnd() * cssW;
          y = rnd() * cssH;
        }
        // an infill seed is allowed into a smaller gap than a fresh-pane seed,
        // which is what lets late crystals slot between the early big ones
        if (clearAround(x, y, allowEdge ? 30 : 17)) {
          nucleate(x, y);
          return true;
        }
      }
      return false;
    };

    const birthPhase = () => (simTime % BIRTH_CLOCK) / BIRTH_CLOCK;

    const stepSim = (dt: number) => {
      frameNo++;
      const phase = birthPhase();
      const live: Tip[] = [];
      for (let i = 0; i < tips.length; i++) {
        const tip = tips[i];
        const step = tip.speed * Math.max(0.05, growth) * dt;
        const nx = tip.x + Math.cos(tip.ang) * step;
        const ny = tip.y + Math.sin(tip.ang) * step;
        if (nx < -8 || ny < -8 || nx > cssW + 8 || ny > cssH + 8) {
          tip.alive = false;
        } else {
          const c = cellOf(nx, ny);
          if (c >= 0) {
            const owner = occ[c];
            // another grain: the two fronts stop against each other and leave
            // the seam that reads as a grain boundary. Its own grain: only if
            // the cell is a few frames old, or a tip would suicide on the cell
            // it just wrote and no fern would ever get past its first branch.
            if (owner !== 0 && (owner !== tip.grain || frameNo - stamp[c] > 4)) {
              tip.alive = false;
            }
          }
        }
        if (!tip.alive) continue;

        tip.x = nx;
        tip.y = ny;
        tip.range -= step;
        tip.sinceEmit += step;
        tip.sinceGap += step;

        if (tip.sinceEmit >= EMIT_STEP) {
          pushSegment(tip.ex, tip.ey, tip.x, tip.y, tip.width, tip.orient, phase);
          stampLine(tip.ex, tip.ey, tip.x, tip.y, tip.grain);
          tip.ex = tip.x;
          tip.ey = tip.y;
          tip.sinceEmit = 0;
        }

        if (tip.sinceGap >= tip.gap && tip.gen < MAX_GEN && tips.length < MAX_TIPS) {
          tip.sinceGap = 0;
          // side branches at exactly +/-60 from the heading, which keeps every
          // generation on the parent grain's six-fold lattice
          const sides = rnd() < 0.72 ? [1, -1] : [rnd() < 0.5 ? 1 : -1];
          for (const s of sides) {
            spawnTip(
              tip.x,
              tip.y,
              tip.ang + s * SIXTH,
              tip.gen + 1,
              tip.grain,
              tip.orient,
              tip.width * GEN_WIDTH,
              tip.gap * GEN_GAP
            );
          }
        }

        if (tip.range <= 0) tip.alive = false;
        if (tip.alive) live.push(tip);
      }
      tips = live;

      // continuous nucleation into whatever glass is clear — including the
      // glass the pointer just melted
      seedTimer += dt;
      const interval = 0.26 / Math.max(0.3, density);
      while (seedTimer >= interval) {
        seedTimer -= interval;
        seedSomewhere(false);
      }

      // The thaw front: a band crossing the pane on a heading that turns each
      // pass, so no two passes clear the same way. Its travel is normalised to
      // the projection span of the current heading, which is why a diagonal
      // sweep takes the same time as an axis-aligned one instead of spending
      // two thirds of its pass off-screen.
      const span = thawSpan();
      thawPos += (dt * (span.hi - span.lo + 2 * THAW_W)) / SWEEP_PERIOD;
      if (thawPos > span.hi + THAW_W) {
        const a = rnd() * TAU;
        thawDirX = Math.cos(a);
        thawDirY = Math.sin(a);
        thawPos = thawSpan().lo - THAW_W;
      }

      // Clear the occupancy inside the band so crystals regrow behind the thaw.
      // Solved per row for the interval of columns that lie in the band rather
      // than tested over the whole grid — this runs on every prewarm step too,
      // and the whole-grid version costs more than the simulation it serves.
      const ax = (CELL / Math.max(1, cssW)) * thawDirX;
      const by = (CELL / Math.max(1, cssH)) * thawDirY;
      for (let j = 0; j < gh; j++) {
        // occupancy rows run top-down; the projection is in the bottom-up frame
        // the shader samples, so the row's contribution is (1 - j*cell/H)
        const base = thawDirY - j * by;
        const lo = thawPos - THAW_W - base;
        const hi = thawPos + THAW_W - base;
        let i0: number;
        let i1: number;
        if (Math.abs(ax) < 1e-6) {
          if (lo > 0 || hi < 0) continue;
          i0 = 0;
          i1 = gw - 1;
        } else {
          const a = lo / ax;
          const b = hi / ax;
          i0 = Math.max(0, Math.ceil(Math.min(a, b)));
          i1 = Math.min(gw - 1, Math.floor(Math.max(a, b)));
        }
        const row = j * gw;
        for (let i = i0; i <= i1; i++) occ[row + i] = 0;
      }
    };

    // Projection span of the unit square onto the current heading, in the
    // bottom-up frame the decay shader uses.
    const thawSpan = () => {
      const dx = thawDirX;
      const dy = thawDirY;
      const lo = Math.min(0, dx) + Math.min(0, dy);
      const hi = Math.max(0, dx) + Math.max(0, dy);
      return { lo, hi };
    };

    // --- gl plumbing --------------------------------------------------------
    const buildAcc = () => {
      if (accTex) gl.deleteTexture(accTex);
      if (accFbo) gl.deleteFramebuffer(accFbo);
      accTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, accTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, accW, accH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      accFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, accFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, accTex, 0);
      gl.viewport(0, 0, accW, accH);
      gl.colorMask(true, true, true, true);
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    const bindQuad = (prog: Program) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      const loc = prog.attrib("a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    };

    // Flush the frame's deposits: one upload, two draws. Pass 0 adds density
    // through a red-only colour mask; pass 1 writes birth and orientation
    // source-over through a green/blue mask.
    const flushDeposits = () => {
      if (staged === 0 || !depositProg || !accFbo) return;
      const prog = depositProg;
      prog.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, accFbo);
      gl.viewport(0, 0, accW, accH);
      gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
      const count = staged * VERTS_PER_SEG * FLOATS_PER_VERTEX;
      gl.bufferData(gl.ARRAY_BUFFER, staging.subarray(0, count), gl.DYNAMIC_DRAW);
      const stride = FLOATS_PER_VERTEX * 4;
      const bind = (name: string, size: number, offset: number) => {
        const loc = prog.attrib(name);
        if (loc < 0) return;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
      };
      bind("a_pos", 2, 0);
      bind("a_local", 2, 8);
      bind("a_meta", 4, 16);
      bind("a_birth", 1, 32);
      prog.v2("u_size", cssW, cssH);

      gl.enable(gl.BLEND);
      gl.colorMask(true, false, false, false);
      gl.blendFunc(gl.ONE, gl.ONE);
      prog.f("u_pass", 0);
      gl.drawArrays(gl.TRIANGLES, 0, staged * VERTS_PER_SEG);

      gl.colorMask(false, true, true, false);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      prog.f("u_pass", 1);
      gl.drawArrays(gl.TRIANGLES, 0, staged * VERTS_PER_SEG);

      gl.colorMask(true, true, true, true);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // the deposit attributes must not stay enabled for the fullscreen passes
      for (const name of ["a_local", "a_meta", "a_birth"]) {
        const loc = prog.attrib(name);
        if (loc >= 0) gl.disableVertexAttribArray(loc);
      }
      staged = 0;
    };

    let warmX = 0;
    let warmY = 0;
    let warmAmt = 0;
    let hoverTarget = 0;
    const WARM_R = 118;

    const runDecay = (dt: number) => {
      if (!decayProg || !accFbo) return;
      const prog = decayProg;
      prog.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, accFbo);
      gl.viewport(0, 0, accW, accH);
      bindQuad(prog);
      prog.v2("u_buf", accW, accH);
      prog.v2("u_size", cssW, cssH);
      prog.f("u_dt", dt);
      prog.v4("u_thaw", thawDirX, thawDirY, thawPos, THAW_W);
      prog.f("u_thawRate", THAW_RATE);
      // y flipped into the accumulation buffer's bottom-up frame
      prog.v3("u_warm", warmX, cssH - warmY, warmAmt);
      prog.f("u_warmR", WARM_R);
      gl.enable(gl.BLEND);
      gl.colorMask(true, false, false, false);
      gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.colorMask(true, true, true, true);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    let c0: RGB = [0.03, 0.03, 0.03];
    let c1: RGB = [0.18, 0.18, 0.18];
    let c2: RGB = [0.56, 0.56, 0.56];
    let c3: RGB = [0.93, 0.93, 0.93];
    let c4: RGB = [1, 1, 1];
    let glassLevel = 0.16;
    let iceGain = 1;
    let haloGain = 0.12;
    let bias = 0;
    let contrast = 1;

    // The two themes are different pictures, not one picture inverted. Dark is a
    // cold black pane and the ice owns the whole top of the range. Light is the
    // harder case: a white pane leaves frost no headroom above it, so the clear
    // glass is set to a mid pale grey and the ice climbs from there while the
    // contact lines drop well below it. Putting the glass ON the paper value is
    // the wash-out that turns a pale frost into flat white.
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const border = parseHex(cs.getPropertyValue("--border")) ?? [0.18, 0.18, 0.18];
      const black: RGB = [0, 0, 0];
      const white: RGB = [1, 1, 1];
      if (luminance(bg) < 0.5) {
        c0 = mixRGB(bg, black, 0.55);
        c1 = mixRGB(border, bg, 0.15);
        c2 = mixRGB(muted, fg, 0.1);
        c3 = mixRGB(fg, white, 0.35);
        c4 = mixRGB(fg, white, 0.95);
        glassLevel = 0.19;
        iceGain = 1.12;
        haloGain = 0.11;
        bias = 0.0;
        contrast = 1.07;
      } else {
        c0 = mixRGB(fg, black, 0.2);
        c1 = mixRGB(fg, muted, 0.62);
        c2 = mixRGB(muted, bg, 0.35);
        c3 = mixRGB(bg, muted, 0.22);
        c4 = bg;
        glassLevel = 0.5;
        iceGain = 1.0;
        haloGain = 0.12;
        bias = 0.02;
        contrast = 1.12;
      }
    };
    readColors();

    const drawScreen = () => {
      if (!screenProg || !ready || cssW <= 0) return;
      const prog = screenProg;
      prog.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      bindQuad(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, accTex);
      prog.i("u_acc", 0);
      prog.v2("u_res", canvas.width, canvas.height);
      prog.v2("u_size", cssW, cssH);
      prog.v2("u_texel", 1 / accW, 1 / accH);
      prog.f("u_time", simTime);
      prog.f("u_phase", birthPhase());
      prog.f("u_mature", MATURE / BIRTH_CLOCK);
      prog.f("u_relief", Math.max(0, relief));
      prog.f("u_sparkle", Math.max(0, sparkle));
      prog.v3("u_warm", warmX, cssH - warmY, warmAmt);
      prog.f("u_warmR", WARM_R);
      prog.f("u_glass", glassLevel);
      prog.f("u_iceGain", iceGain);
      prog.f("u_haloGain", haloGain);
      prog.v3c("u_c0", c0);
      prog.v3c("u_c1", c1);
      prog.v3c("u_c2", c2);
      prog.v3c("u_c3", c3);
      prog.v3c("u_c4", c4);
      prog.f("u_bias", bias);
      prog.f("u_contrast", contrast);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // Pointer follower state.
    let havePointer = false;
    let tgtX = 0;
    let tgtY = 0;
    let velX = 0;
    let velY = 0;
    let lastTgtX = 0;
    let lastTgtY = 0;
    let rectLeft = 0;
    let rectTop = 0;
    let rectDirty = true;

    const stepPointer = (dt: number) => {
      if (dt <= 0) return;
      if (havePointer) {
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
        warmX += (tgtX + leadX - warmX) * k;
        warmY += (tgtY + leadY - warmY) * k;
      }
      warmAmt += (hoverTarget - warmAmt) * (1 - Math.exp(-dt * 5.5));
    };

    const advance = (dt: number) => {
      simTime += dt;
      stepSim(dt);
      flushDeposits();
      runDecay(dt);
      // the pointer melts the occupancy too, so tips creep back into the glass
      // it cleared instead of the melt leaving a permanent scar
      if (havePointer && warmAmt > 0.05) clearRegion(warmX, warmY, WARM_R * 0.72);
    };

    const prewarm = (seconds: number) => {
      const steps = Math.round(seconds / PREWARM_DT);
      for (let i = 0; i < steps; i++) advance(PREWARM_DT);
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
      lastMs = nowMs;
      stepPointer(dt);
      advance(dt * Math.max(0, speed));
      drawScreen();

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
      if (running || disposed || !ready) return;
      running = true;
      lastMs = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    // The visible canvas takes the ladder; the accumulation buffer does not.
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
      if (!havePointer) {
        warmX = cssW * 0.5;
        warmY = cssH * 0.5;
      }
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      applyBacking();
      if (changed) {
        if (accW === 0) rebuildPane();
        // A new size is a new pane — the frost lives in the accumulation
        // buffer's own pixels — but rebuilding it costs a full prewarm, and
        // doing that per ResizeObserver callback would run a fresh simulation
        // on every frame of a window drag. Until the drag settles the existing
        // frost is simply stretched, which is invisible for a second.
        else {
          window.clearTimeout(rebuildTimer);
          rebuildTimer = window.setTimeout(rebuildPane, 260);
        }
      }
      drawScreen();
    };

    let rebuildTimer = 0;
    const rebuildPane = () => {
      if (disposed || cssW < 2 || cssH < 2) return;
      // the accumulation buffer is capped below the visible DPR: the ice is
      // diffuse, so its detail survives a linear upsample, while the buffer's
      // cost is paid on every deposit and every decay pass
      const accDpr = Math.min(window.devicePixelRatio || 1, 1.75);
      accW = Math.max(2, Math.round(cssW * accDpr));
      accH = Math.max(2, Math.round(cssH * accDpr));
      buildAcc();
      resetSim();
      staged = 0;
      prewarm(staticMode ? PREWARM_STILL : PREWARM);
      drawScreen();
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

    // havePointer is only ever set by a real pointer event. The warm spot is
    // destructive, so a headless run with the mouse parked at the origin must
    // not scrape a permanent bald corner into the pane.
    const snapPointer = () => {
      warmX = tgtX;
      warmY = tgtY;
      velX = 0;
      velY = 0;
      lastTgtX = tgtX;
      lastTgtY = tgtY;
      havePointer = true;
    };

    const onPointerEnter = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      hoverTarget = 1;
      if (staticMode) drawScreen();
    };
    const onPointerMove = (e: PointerEvent) => {
      setTarget(e);
      if (!havePointer) {
        snapPointer();
        hoverTarget = 1;
      }
      if (staticMode) {
        warmX = tgtX;
        warmY = tgtY;
        warmAmt = 1;
        drawScreen();
      }
    };
    const onPointerLeave = () => {
      hoverTarget = 0;
      havePointer = false;
      if (staticMode) {
        warmAmt = 0;
        drawScreen();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      hoverTarget = 1;
      if (staticMode) onPointerMove(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") onPointerLeave();
    };

    try {
      depositProg = new Program(gl, DEPOSIT_VERT, DEPOSIT_FRAG);
      decayProg = new Program(gl, SCREEN_VERT, DECAY_FRAG);
      screenProg = new Program(gl, SCREEN_VERT, SCREEN_FRAG);
    } catch {
      depositProg?.destroy();
      decayProg?.destroy();
      screenProg?.destroy();
      return;
    }
    quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    segBuf = gl.createBuffer();
    ready = true;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    staticMode = reduced || pausedRef.current;

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    wrap.addEventListener("pointerenter", onPointerEnter);
    wrap.addEventListener("pointerleave", onPointerLeave);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerdown", onPointerDown);
    wrap.addEventListener("pointerup", onPointerUp);
    wrap.addEventListener("pointercancel", onPointerLeave);
    window.addEventListener("scroll", markRectDirty, { passive: true, capture: true });
    window.addEventListener("resize", markRectDirty, { passive: true });

    const applyMode = () => {
      if (reduced || pausedRef.current) {
        const wasLive = !staticMode;
        staticMode = true;
        sleep();
        // a still frame is a fully grown pane, never a blank sheet of glass
        if (wasLive) prewarm(PREWARM_STILL - PREWARM);
        drawScreen();
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

    // polled rather than made an effect dependency: the dependency would tear
    // down and recreate the whole GL context — and the whole pane of frost — to
    // change a boolean
    let lastPolledPaused = pausedRef.current;
    let poll = 0;
    const tick = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      poll = window.setTimeout(tick, 140);
    };
    tick();

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (staticMode) drawScreen();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onLost = (e: Event) => {
      e.preventDefault();
      ready = false;
      sleep();
    };
    const onRestored = () => {
      // the accumulated frost died with the context; rebuild and regrow it
      try {
        depositProg = new Program(gl, DEPOSIT_VERT, DEPOSIT_FRAG);
        decayProg = new Program(gl, SCREEN_VERT, DECAY_FRAG);
        screenProg = new Program(gl, SCREEN_VERT, SCREEN_FRAG);
      } catch {
        return;
      }
      quadBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      segBuf = gl.createBuffer();
      ready = true;
      cssW = 0;
      cssH = 0;
      resize();
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
      wrap.removeEventListener("pointercancel", onPointerLeave);
      window.removeEventListener("scroll", markRectDirty, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("resize", markRectDirty);
      window.clearTimeout(poll);
      sleep();
      depositProg?.destroy();
      decayProg?.destroy();
      screenProg?.destroy();
      if (quadBuf) gl.deleteBuffer(quadBuf);
      if (segBuf) gl.deleteBuffer(segBuf);
      if (accTex) gl.deleteTexture(accTex);
      if (accFbo) gl.deleteFramebuffer(accFbo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, growth, relief, sparkle, speed]);

  return (
    <div
      ref={wrapRef}
      data-rime-creep={uid}
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

RimeCreep.displayName = "RimeCreep";
