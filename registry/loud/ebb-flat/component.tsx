"use client";

import { useEffect, useId, useMemo, useRef } from "react";

// ---------------------------------------------------------------------------
// EbbFlat — a pinned, full-bleed tidal flat where the scroll position IS the
// water level.
//
// The whole frame is one fragment shader over a fixed terrain field h(x, z):
// bars, a meandering channel, a feeder gully, broad relief, ripple marks. The
// only thing the scroll changes is one scalar, the water level, and every pixel
// asks the same question of it:
//
//     above = h(x, z) - level
//
// Positive is flat, negative is water, and the shoreline is wherever that
// difference crosses zero. Nothing is latched and nothing accumulates: the sand
// is not "dry because it has been out for a while", it is dry in proportion to
// how far above the current waterline it stands. That is the property the whole
// component is built on. The terrain carries no time term at all, so the frame
// at level +0.4 m is bit-identical whether the tide was falling into it or
// rising back through it — scrolling up floods the flat in exactly the reverse
// order it drained, bar by bar, and the proof is a diff of two screenshots
// rather than an impression.
//
// What moves on the clock rather than on the scroll: swell running shoreward,
// a foam line breaking wherever the water is shallow, glitter along the glare
// path, and drift in the cloud band. So the un-scrolled resting frame — the one
// the screenshot gate grades — is a near-full flood with one bar just breaking
// and the sea alive across it, never a still.
//
// Relief is real, not painted: the terrain is sampled three times, one pixel
// apart, for a surface normal, and the same three taps give the pixel footprint
// that sets the width of the waterline's antialias. A shoreline is a contour of
// a 2D field, so on the near-flat stretches it would otherwise crawl badly
// while the level moves; deriving the blend width from the local gradient is
// what keeps it a clean wet edge at every level instead of a stair.
//
// Copy is DOM text, never rasterized. The visual blocks are aria-hidden and
// driven by style writes at frame rate; the accessible copy of the sequence is
// one sr-only ordered list, in tide order, always present.
//
// Palette: five luminance stops derived from --background, --foreground,
// --ns-muted and --border via getComputedStyle, re-read on a MutationObserver
// watching documentElement's class. --ns-accent never reaches the canvas: water,
// wet sand and dry sand are three luminances, not three hues, so the flat is
// achromatic in both themes and the ramp direction never inverts.
// ---------------------------------------------------------------------------

export interface EbbStage {
  /** Water level in metres at which this stage is centred. Should descend. */
  level: number;
  /** Short state name, e.g. "First bar". */
  label: string;
  /** Headline for the stage. */
  title: string;
  /** One or two sentences of body copy. */
  body: string;
}

export interface EbbFlatProps {
  /** Stages in descending water level. */
  stages?: EbbStage[];
  /** Viewport heights of scroll the pinned stage consumes. @default 12 */
  pinLength?: number;
  /** Water level at zero scroll, in metres. @default 1.5 */
  highWater?: number;
  /** Water level at full scroll, in metres. @default -0.62 */
  lowWater?: number;
  /** Ambient (non-scroll) motion multiplier. @default 1 */
  speed?: number;
  /** Rendered over the stage. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_STAGES: EbbStage[] = [
  {
    level: 1.42,
    label: "Slack high water",
    title: "For twenty minutes the sea does nothing at all",
    body: "The flat is under a metre and a half of it. Nothing here suggests there is a floor.",
  },
  {
    level: 1.05,
    label: "First bar",
    title: "The outer bar breaks the surface",
    body: "A back of wet sand, then a second one behind it. The swell starts to trip on them.",
  },
  {
    level: 0.68,
    label: "Draining",
    title: "The channel finds the course it always takes",
    body: "Water leaves the flat the way it arrived, along one meander and its feeder.",
  },
  {
    level: 0.3,
    label: "Ripple marks",
    title: "The floor turns out to have been corrugated the whole time",
    body: "Ripples set by the last flood, held under water for six hours, now catching a low sun.",
  },
  {
    level: -0.05,
    label: "Cut off",
    title: "Some of the sea does not get away",
    body: "The hollows keep what they were holding. Each pool is now its own small tide, going nowhere.",
  },
  {
    level: -0.42,
    label: "Low water",
    title: "Everything the tide had is showing",
    body: "In six hours it comes back over this in the same order, bar last, channel first.",
  },
];

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `
precision highp float;

uniform vec2 u_size;      // css px
uniform float u_dpr;
uniform float u_time;
uniform float u_level;    // water level in metres
uniform float u_rate;     // metres/second of level change, signed, smoothed
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform float u_bias;
uniform float u_contrast;

// Ground plane mapping. The frame is not a plan view: distance from the near
// edge grows exponentially up the frame, so the flat recedes and compresses
// into a horizon the way a real one does, and lateral scale grows with it. An
// exponential rather than a true 1/y projection because its derivative is
// linear in z — the pixel footprint stays finite at the horizon instead of
// running away, which is what makes the far half sampleable at all.
const float SKY = 0.115;   // fraction of the frame above the horizon
const float Z0 = 2.6;      // metres to the near edge
const float ZK = 3.45;     // ln(zFar / Z0)
const float XS = 0.92;     // lateral metres per unit of z, per frame height

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

// screen px -> (x, z) metres on the flat, plus the pixel footprint in metres
vec3 mapW(vec2 p) {
  float yy = clamp((1.0 - p.y / u_size.y - 0.0) / (1.0 - SKY), 0.0, 1.0);
  float z = Z0 * exp(yy * ZK);
  float x = (p.x - u_size.x * 0.5) / u_size.y * z * XS;
  float foot = max(z * ZK / (u_size.y * (1.0 - SKY)), z * XS / u_size.y);
  return vec3(x, z, foot);
}

// A shore-parallel bar, wandering slowly along its own length so it is not a
// ruled line across the frame.
float bar(vec2 w, float zc, float amp, float wid, float wob) {
  float dz = (w.y - zc + wob * sin(w.x * 0.085 + zc)) / wid;
  return amp * exp(-dz * dz);
}

// The flat itself. No time term anywhere in here: this is the entire reason the
// ebb runs backwards coherently, because the frame is then a function of the
// water level alone.
float flat_(vec2 w, float foot) {
  float h = 1.62 - 0.058 * w.y;              // the gentlest of seaward slopes

  // five bars, crests set so each one breaks at one of the stage levels. The
  // first is near enough to fill the bottom of the frame and stands 0.2 m proud
  // at slack high water, so the resting frame has one back of sand already out
  // with the swell tripping over it rather than an undifferentiated sea.
  h += bar(w, 3.5, 0.34, 2.1, 0.7);
  h += bar(w, 7.0, 0.46, 4.6, 1.5);
  h += bar(w, 19.0, 0.60, 6.4, 2.3);
  h += bar(w, 36.0, 0.62, 8.6, 3.1);
  h += bar(w, 58.0, 0.50, 11.0, 3.8);

  // the main channel: one meander, widening seaward, and its feeder
  float cx = 9.5 * sin(w.y * 0.045 + 0.7) + 4.5 * sin(w.y * 0.017 + 2.4);
  float cd = (w.x - cx) / (2.6 + 0.045 * w.y);
  h -= 0.92 * exp(-cd * cd);
  float fx2 = -13.0 + 7.0 * sin(w.y * 0.058 + 2.1);
  float fd = (w.x - fx2) / (1.5 + 0.02 * w.y);
  h -= 0.42 * exp(-fd * fd);

  // broad relief: the hollows that strand pools when the level drops past them
  h += (fbm2(w * 0.055) - 0.5) * 0.46;
  h += (fbm2(w * 0.17 + 4.1) - 0.5) * 0.14;
  // and a metre-scale octave: without it the only hollows are 18 m across, so
  // the flat drains to one clean sheet and never strands the scatter of small
  // pools that is the whole point of the "cut off" stage
  h += (fbm2(w * 0.62 + 11.3) - 0.5) * 0.085 * smoothstep(0.30, 0.06, foot);

  // ripple marks, ~0.6 m crest to crest, faded out where a pixel is wider than
  // they are rather than left to alias into a moire
  float rf = smoothstep(0.16, 0.05, foot);
  if (rf > 0.0) {
    // the crest line itself wanders, and the amplitude is modulated along the
    // ripple rather than constant: a ruled corrugation across the whole flat
    // reads as a scanline artefact, a broken one reads as sand
    float ph = w.y * 10.5 + 2.4 * sin(w.x * 0.42 + w.y * 0.09);
    float am = 0.55 + 0.45 * fbm2(vec2(w.x * 0.30, w.y * 0.13));
    h += (sin(ph) * 0.034 + sin(ph * 2.4 + 1.1) * 0.013) * rf * am;
    // a second, finer set at an angle to the first — the cross-hatch is the
    // only thing in the near field that is not a horizontal band
    float ph2 = (w.y * 0.55 + w.x * 0.83) * 9.0;
    h += sin(ph2) * 0.011 * rf;
  }
  // sand grain, on the same footprint rule, in two octaves: the coarse one
  // carries the mottle, the fine one keeps the near field from going to mush
  h += (vnoise(w * 2.6) - 0.5) * 0.026 * smoothstep(0.45, 0.12, foot);
  h += (vnoise(w * 14.0) - 0.5) * 0.010 * smoothstep(0.05, 0.012, foot);
  return h;
}

vec3 ramp(float x) {
  vec3 c = mix(u_c0, u_c1, smoothstep(0.0, 0.27, x));
  c = mix(c, u_c2, smoothstep(0.25, 0.55, x));
  c = mix(c, u_c3, smoothstep(0.52, 0.83, x));
  c = mix(c, u_c4, smoothstep(0.81, 1.0, x));
  return c;
}

void main() {
  // DOM-space px, y down
  vec2 p = vec2(gl_FragCoord.x, u_size.y * u_dpr - gl_FragCoord.y) / u_dpr;
  float horizon = u_size.y * SKY;
  float nx = (p.x - u_size.x * 0.5) / (u_size.x * 0.5);
  float ebb = min(abs(u_rate) * 2.2, 1.0);   // how hard the tide is running

  // ---- sky ---------------------------------------------------------------
  // Held down to a band: the flat is the subject. Brightest at the horizon,
  // with one slow cloud shelf drifting across it.
  float skyGrad = smoothstep(0.0, 1.0, p.y / max(1.0, horizon));
  float cloud = fbm2(vec2(nx * 1.6 + u_time * 0.012, p.y / max(1.0, horizon) * 1.4));
  float L = 0.60 + 0.30 * skyGrad + (cloud - 0.5) * 0.16 * (1.0 - skyGrad * 0.4);

  if (p.y > horizon) {
    // ---- the flat --------------------------------------------------------
    vec3 m = mapW(p);
    vec2 w = m.xy;
    float z = m.y;
    float foot = m.z;

    // three taps, one pixel apart: one surface normal AND the local gradient
    // that sets how wide the waterline may blend
    float h = flat_(w, foot);
    vec3 mx = mapW(p + vec2(1.0, 0.0));
    vec3 my = mapW(p + vec2(0.0, 1.0));
    float hx = flat_(mx.xy, mx.z);
    float hy = flat_(my.xy, my.z);
    float dhx = (hx - h) / max(mx.z, 0.0002);
    float dhz = (h - hy) / max(my.z, 0.0002);
    vec3 n = normalize(vec3(-dhx * 0.5, -dhz * 0.5, 1.0));

    // a low sun off to the right, so the glare path lands away from the copy
    vec3 sun = normalize(vec3(0.62, -0.30, 0.72));
    float diff = clamp(dot(n, sun), 0.0, 1.0);

    float above = h - u_level;

    // SAND. Wetness is a function of height above the CURRENT waterline, never
    // of how long anything has been out of the water — the moment that becomes
    // a history the tide stops being reversible.
    float wet = exp(-max(above, 0.0) / 0.115);
    float sand = mix(0.66, 0.20, wet);
    sand *= 0.60 + 0.54 * diff;
    // sheen: wet sand holds a mirror of the sky until it drains
    sand += wet * pow(diff, 22.0) * 0.55;
    // the last of the water draining off the flat in threads, on the clock
    float rill = smoothstep(0.55, 0.95, vnoise(vec2(w.x * 1.6, w.y * 0.5 - u_time * 0.5)));
    sand -= rill * wet * 0.09 * (0.35 + 0.65 * ebb);

    // WATER. Depth attenuates the floor toward the surface tone, swell runs
    // shoreward on the clock, and glitter rides the glare path.
    float dep = max(0.0, -above);
    float swell = sin(z * 0.42 - u_time * 1.15 + 2.4 * fbm2(vec2(w.x * 0.05, z * 0.035)));
    float chop = vnoise(vec2(w.x * 0.9, z * 0.55 - u_time * 0.9));
    float surface = 0.44 + 0.10 * swell + (chop - 0.5) * 0.10;
    // the glare path: a corridor of sky under the sun, widening with distance
    float glare = exp(-pow((w.x / max(z, 0.6) - 0.42) / 0.34, 2.0));
    float sparkle = pow(smoothstep(0.55, 1.0, vnoise(vec2(w.x * 3.4, z * 2.2 - u_time * 1.4))), 3.0);
    surface += glare * (0.16 + 0.34 * sparkle);
    float clarity = exp(-dep / 0.42);
    float water = mix(surface, sand * 0.72 + 0.10, clarity * 0.85);
    // deep water goes dark: without it the sea sits at one tone and the whole
    // resting frame reads as a single grey wash with glitter on it
    water *= 1.0 - smoothstep(0.25, 1.8, dep) * 0.34;
    // shadow the water immediately in the lee of an emerging bar
    water -= smoothstep(0.5, 0.0, dep) * 0.05;

    // FOAM. Where the swell runs out of depth it breaks, so the white line sits
    // wherever the water is shallow — which is the shoreline at any level, and
    // over every bar the moment it starts to trip the swell.
    float breakK = smoothstep(0.34, 0.0, dep);
    float foam = breakK * smoothstep(0.15, 0.85, swell * 0.5 + 0.5);
    float lace = vnoise(vec2(w.x * 2.2, z * 1.4 - u_time * 1.9));
    water += foam * (0.30 + 0.22 * lace) * (0.55 + 0.45 * ebb);
    // and a wet fringe on the sand side, where the last wash is still running
    sand += smoothstep(0.10, 0.0, above) * foam * 0.22;

    // the waterline is a contour of a 2D field: the blend width comes from the
    // local gradient, so it is a clean wet edge on a steep bar and a soft one
    // on a near-flat pan, and neither crawls while the level moves
    float aa = abs(hx - h) + abs(hy - h) + 0.0025;
    float land = smoothstep(-aa, aa, above);
    L = mix(water, sand, land);

    // THE SURF LINE. A shoreline you can find at a glance is a bright line, not
    // a change of tone: this is a gaussian on the height above the level alone,
    // so it lies exactly
    // on the contour at every level and on both faces of every bar the moment
    // one breaks, and it is a function of the level with no history in it. Its
    // texture runs on the clock, which is what keeps the resting frame alive.
    // squared by multiplication, not pow(): the height difference is negative everywhere
    // there is water over the flat, and pow() of a negative base is undefined
    // in GLSL — on this stack it returns NaN and takes the whole frame black
    float sr = above / (0.05 + 6.0 * aa);
    float surf = exp(-sr * sr);
    float lather = 0.42 + 0.58 * vnoise(vec2(w.x * 1.3, z * 0.8 - u_time * 1.25));
    L += surf * lather * 0.32 * (0.62 + 0.38 * ebb);

    // distance haze into the horizon, and a hard bright line on it
    float far = smoothstep(0.45, 1.0, (log(z / Z0) / ZK));
    L = mix(L, 0.72, far * 0.55);
    L += exp(-pow((p.y - horizon) / 3.5, 2.0)) * 0.18;
  }

  float Lc = clamp((L - 0.5) * u_contrast + 0.5 + u_bias, 0.0, 1.0);
  vec3 col = ramp(Lc);

  // a mild vignette toward the deepest stop, so the copy column has somewhere
  // to sit in both themes
  float vig = smoothstep(0.62, 1.30, length(vec2(nx, (p.y / u_size.y - 0.5) * 1.5)));
  col = mix(col, u_c0, vig * 0.16);

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
    throw new Error(`ebb-flat: shader compile failed: ${info ?? ""}`);
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
  v2(name: string, x: number, y: number) {
    this.gl?.uniform2f(this.loc(name), x, y);
  }
  v3(name: string, c: RGB) {
    this.gl?.uniform3f(this.loc(name), c[0], c[1], c[2]);
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
// still has swell and foam composed across the flat rather than whatever t = 0
// happens to look like.
const STATIC_TIME = 6.1;

export function EbbFlat({
  stages = DEFAULT_STAGES,
  pinLength = 12,
  highWater = 1.5,
  lowWater = -0.62,
  speed = 1,
  children,
  className = "",
  style,
}: EbbFlatProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const copyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const tickRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const readoutRef = useRef<HTMLSpanElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const uid = useId();

  const list = useMemo(() => (stages.length > 0 ? stages : DEFAULT_STAGES), [stages]);

  // Everything the loop needs about the stage list is read through a ref and
  // polled. Putting it in the effect's deps would tear down and rebuild the GL
  // context every time a consumer passed an inline `stages` array — which is
  // how every consumer writes it.
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
    const span = Math.max(0.2, highWater - lowWater);

    // progress: the target is read once per frame from layout, and the level
    // chases it. Reading it in the scroll handler instead would sample at the
    // browser's scroll cadence — bursty on a trackpad flick, and on some engines
    // delivered after paint — so the level would tear against the frame it is
    // drawn in. One read, one interpolation, one draw, in that order.
    let target = 0;
    let current = 0;
    let rate = 0; // smoothed metres/second, signed
    let lastLevel = highWater;
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
    let contrast = 1.2;

    // Five stops spanning near-black to near-white in BOTH themes: a full-bleed
    // flat IS the page, so the ramp never inverts. Only bias and contrast move —
    // light theme is the flat under an overcast noon, dark theme the same flat
    // at the end of the day with the same sun much lower.
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const border = parseHex(cs.getPropertyValue("--border")) ?? [0.18, 0.18, 0.18];
      const black: RGB = [0, 0, 0];
      const white: RGB = [1, 1, 1];
      if (luminance(bg) < 0.5) {
        c0 = mixRGB(bg, black, 0.62);
        c1 = mixRGB(border, bg, 0.1);
        c2 = mixRGB(muted, border, 0.3);
        c3 = fg;
        c4 = mixRGB(fg, white, 0.75);
        bias = -0.1;
        contrast = 1.26;
      } else {
        c0 = mixRGB(fg, black, 0.4);
        c1 = mixRGB(fg, muted, 0.45);
        c2 = mixRGB(muted, bg, 0.5);
        c3 = mixRGB(bg, muted, 0.18);
        c4 = bg;
        bias = 0.12;
        contrast = 1.3;
      }
    };
    readColors();

    const levelAt = (p: number) => highWater - p * span;

    const readProgress = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const s = rect.height - vh;
      if (s <= 0) return 0;
      return Math.min(1, Math.max(0, -rect.top / s));
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
    const nearestStage = (lv: number) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < items.length; i++) {
        const d = Math.abs(lv - items[i].level);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    };

    // Each stage owns a band set by its own neighbours rather than one window
    // for the whole run: a single window sized for the close stages near high
    // water leaves dead level where no copy is on screen at all.
    const bandOf = (i: number) => {
      const prev = i > 0 ? Math.abs(items[i].level - items[i - 1].level) : 0;
      const next = i < items.length - 1 ? Math.abs(items[i + 1].level - items[i].level) : 0;
      const gap = prev && next ? (prev + next) / 2 : prev || next || 0.4;
      return Math.max(0.08, gap * 0.66);
    };

    const updateCopy = (level: number) => {
      const near = reduced ? nearestStage(level) : -1;
      for (let i = 0; i < items.length; i++) {
        const el = copyRefs.current[i];
        if (!el) continue;
        let a: number;
        let dy = 0;
        if (reduced) {
          a = i === near ? 1 : 0;
        } else {
          const d = (level - items[i].level) / bandOf(i);
          a = Math.max(0, 1 - Math.abs(d));
          a = a * a * (3 - 2 * a);
          // copy rides with the water it describes, at a fraction of its speed,
          // so it is attached to the tide without racing it
          dy = Math.max(-44, Math.min(44, d * 32));
        }
        el.style.opacity = a.toFixed(3);
        el.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
        el.style.visibility = a < 0.004 ? "hidden" : "visible";
        const tick = tickRefs.current[i];
        if (tick) tick.style.opacity = (0.28 + 0.72 * a).toFixed(3);
      }
      if (readoutRef.current) {
        readoutRef.current.textContent = `${level >= 0 ? "+" : "−"}${Math.abs(level).toFixed(2)} m`;
      }
      if (railRef.current) {
        const t = Math.min(1, Math.max(0, (highWater - level) / span));
        railRef.current.style.transform = `scaleY(${t.toFixed(4)})`;
      }
    };

    // ---- frame -----------------------------------------------------------
    const draw = (level: number) => {
      if (!surface.gl || cssW <= 0 || cssH <= 0) return;
      surface.v2("u_size", cssW, cssH);
      surface.f("u_dpr", dpr);
      surface.f("u_time", reduced ? STATIC_TIME : simTime);
      surface.f("u_level", level);
      surface.f("u_rate", reduced ? 0 : rate);
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
      let level: number;

      if (reduced) {
        // discrete states: snap to the nearest stage's level, so the ebb is
        // shown as a set of stands rather than a continuous fall, and redraw
        // only when that snap actually changes
        const snap = nearestStage(levelAt(target));
        level = items[snap].level;
        current = (highWater - level) / span;
        rate = 0;
        lastLevel = level;
        if (snap !== lastSnap || dirty) {
          lastSnap = snap;
          dirty = false;
          updateCopy(level);
          draw(level);
        }
      } else {
        simTime += dt * speed;
        // a trackpad flick lands the target in one event burst; this is what
        // keeps the level from stepping with it. ~90ms is short enough that the
        // water never feels detached from the finger, long enough to absorb a
        // 200px jump over about six frames.
        current += (target - current) * (1 - Math.exp(-dt / 0.09));
        level = levelAt(current);
        const inst = (level - lastLevel) / dt;
        lastLevel = level;
        rate += (inst - rate) * (1 - Math.exp(-dt / 0.12));
        dirty = false;
        updateCopy(level);
        draw(level);
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
    // section paints the right level on the first frame instead of easing to it
    current = target = readProgress();
    lastLevel = levelAt(current);
    updateCopy(lastLevel);
    if (hasGL) draw(lastLevel);

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
      if (!running) draw(lastLevel);
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
        dirty = true;
        lastSnap = -1;
        if (!running) {
          updateCopy(lastLevel);
          draw(lastLevel);
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
  }, [highWater, lowWater, speed]);

  const span = Math.max(0.2, highWater - lowWater);

  return (
    <section
      ref={sectionRef}
      data-ebb-flat={uid}
      aria-label="Tide log"
      className={`relative w-full bg-background ${className}`}
      style={{ height: `${Math.max(2, pinLength) * 100}vh`, ...style }}
    >
      {/* the whole sequence, in tide order, for anything that does not scroll:
          the visual blocks below are aria-hidden because they are driven at
          frame rate and most of them are transparent at any moment */}
      <ol className="sr-only">
        {list.map((s) => (
          <li key={`sr-${s.level}-${s.label}`}>
            <h3>
              {s.level >= 0 ? "+" : "−"}
              {Math.abs(s.level).toFixed(2)} m, {s.label}: {s.title}
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
                  key={`${s.level}-${s.label}`}
                  ref={(el) => {
                    copyRefs.current[i] = el;
                  }}
                  className="absolute inset-x-0 top-0 will-change-[opacity,transform]"
                  style={{ opacity: 0, visibility: "hidden" }}
                >
                  <div className="rounded-lg bg-background/80 p-6 backdrop-blur-md sm:p-7">
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
                      {s.level >= 0 ? "+" : "−"}
                      {Math.abs(s.level).toFixed(2)} m &middot; {s.label}
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

        {/* tide rail — a readout of where the water is, not a control */}
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
                  key={`tick-${s.level}`}
                  ref={(el) => {
                    tickRefs.current[i] = el;
                  }}
                  className="absolute left-0 -translate-y-1/2 font-mono text-[10px] tabular-nums tracking-[0.12em] text-ns-muted"
                  style={{
                    top: `${Math.min(100, Math.max(0, ((highWater - s.level) / span) * 100))}%`,
                    opacity: 0.28,
                  }}
                >
                  {s.level >= 0 ? "+" : "−"}
                  {Math.abs(s.level).toFixed(1)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute left-6 top-6 flex items-baseline gap-3 rounded-sm bg-background/80 px-3 py-2 backdrop-blur-md sm:left-10 sm:top-10">
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
            Tide
          </span>
          <span
            ref={readoutRef}
            aria-hidden="true"
            className="font-mono text-sm tabular-nums text-foreground"
          >
            +1.50 m
          </span>
        </div>

        {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
      </div>
    </section>
  );
}

EbbFlat.displayName = "EbbFlat";
