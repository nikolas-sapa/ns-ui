"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// PingShadow — a full-bleed acoustic image of a seabed, drawn by a beam that
// sweeps the frame rather than by a picture that simply exists.
//
// The whole surface is one fragment shader working in the beam's polar frame:
// a transducer sits off-frame above the top edge, and every pixel knows its
// range r and bearing theta from it. The sector scanner swings harmonically,
// theta_b(t) = A*sin(wt), and because that is invertible the shader can ask the
// question that normally needs a history buffer — "how long ago did the beam
// last cross MY bearing?" — analytically, from a single asin. Two crossings per
// period, take the nearer one, and that age drives the persistence decay. No
// feedback texture, no ping-pong FBO, and the consequence that matters: the
// very first frame is already a fully painted scene with a correct freshness
// gradient behind the beam, not an empty display waiting to be filled.
//
// What the beam paints is an echo field, not a pattern. Return strength is
// built the way a real insonified bottom builds it: sand ripples lit at grazing
// incidence, so the facets tilted toward the transducer flare and the ones
// tilted away go dark; boulders with a bright near-face specular and an
// ACOUSTIC SHADOW stretching radially away behind them, penumbra widening with
// distance; sparse point scatterers; multiplicative speckle whose correlation
// cell grows with range. The shadows are the tell — they always point directly
// away from the transducer and they lengthen as the bottom drifts past, which
// is the single cue that separates an acoustic image from a texture with a
// wipe over it.
//
// Two details are the difference between "sonar-ish" and sonar. First, azimuth
// resolution degrades linearly with range because the beam is an angle, not a
// width — so the ripple term is low-passed by exp(-(beamWidth*r*rippleFreq)^2),
// and the far field genuinely loses fine structure the near field keeps.
// Second, speckle is seeded by the PASS THAT PAINTED the pixel, floor((t-age)*2/T),
// not by the current time: grain therefore decorrelates one wedge at a time as
// the beam goes over it, exactly like ping-to-ping speckle, instead of the whole
// frame boiling at once.
//
// Palette: the display is luminance-only, which is what a sonar or ultrasound
// screen actually is — return intensity mapped to brightness, no hue anywhere.
// Four stops come from --background, --foreground, --ns-muted and --border via
// getComputedStyle, re-read on a documentElement class MutationObserver. Dark
// theme is the instrument: strong returns bright on a black display. Light
// theme INVERTS to a wet-paper record — strong returns are dark ink on white,
// the way side-scan was printed before it was screened — so the same L drives
// both and only the ramp reverses. --ns-accent is deliberately never sampled:
// nothing about an echo is blue, and the pointer's effect is aim and focus, not
// a coloured highlight.
// ---------------------------------------------------------------------------

export interface PingShadowProps {
  /** Sweep rate multiplier; also scales the bottom's drift past the vehicle. @default 1 */
  speed?: number;
  /** Seconds for one full there-and-back sweep (two passes). @default 5.4 */
  sweepPeriod?: number;
  /** Persistence multiplier — how far behind the beam the image stays readable. @default 1 */
  persistence?: number;
  /** Feature size of the bottom; larger reads as a coarser, rockier seabed. @default 1 */
  scale?: number;
  /** Freezes the display on a composed still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the display — eyebrow, headline, CTA. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Boulders on the bottom. Each costs one exp() pair for its near-face specular
// and a handful of smoothsteps for its shadow, so the count is bounded by taste
// rather than by budget: past ~a dozen the frame reads as rubble instead of as
// discrete targets casting discrete shadows, which is the whole point.
const OBJECTS = 11;

// Lead-compensated pointer follower. A plain exponential follower has a
// steady-state error of exactly v*tau under constant velocity, so smoothing the
// aim that way makes the beam trail the cursor by a fixed distance and reads as
// the instrument being late. Extrapolating the target one tau ahead cancels the
// term algebraically: at constant velocity the aim sits ON the pointer, and the
// smoothing is spent only on direction changes and on frames that carried no
// pointer event. VEL_TAU must outlive the gap between two events or the
// estimate — and with it the compensation — collapses on every empty frame.
const POINTER_TAU = 0.05;
const VEL_TAU = 0.06;
const LEAD_MAX = 140;

const FRAG_SRC = `
precision highp float;

#define OBJECTS ${OBJECTS}

uniform vec2 u_size;      // css px
uniform float u_dpr;
uniform float u_time;
uniform float u_period;   // seconds, full there-and-back
uniform float u_tau;      // persistence time constant, seconds
uniform float u_scale;
uniform vec2 u_apex;      // transducer, css px (above the top edge)
uniform float u_sector;   // half-angle, radians
uniform float u_refR;     // apex -> bottom-centre range, the display's full scale
uniform float u_aim;      // -1..1, pointer bearing bias
uniform float u_focus;    // 0..1, focal range as a fraction of u_refR
uniform float u_hover;    // 0..1 eased
uniform vec4 u_obj[OBJECTS]; // x,y css px, z radius px, w height 0..1
uniform float u_gamma;    // per-theme display curve
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

const float PI = 3.14159265;

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
  float s = vnoise(p) * 0.63;
  s += vnoise(p * 2.11 + 17.3) * 0.31;
  return s;
}

float fbm3(vec2 p) {
  float s = vnoise(p) * 0.54;
  s += vnoise(p * 2.03 + 13.7) * 0.27;
  s += vnoise(p * 4.09 + 31.1) * 0.14;
  return s;
}

// Time since the beam last crossed this bearing. The scanner is harmonic, so
// sin(phase) = x has two roots per period — asin(x) and PI - asin(x) — and the
// age is the smaller of the two backward phase distances. This one function is
// why the display needs no history buffer and why frame zero is already painted.
float ageAt(float x, float phase, float omega) {
  float a = asin(clamp(x, -1.0, 1.0));
  float d1 = mod(phase - a, 2.0 * PI);
  float d2 = mod(phase - (PI - a), 2.0 * PI);
  return min(d1, d2) / omega;
}

void main() {
  // DOM-space px (y down) so pointer coords, object positions and the polar
  // frame all share one coordinate system
  vec2 p = vec2(gl_FragCoord.x, u_size.y * u_dpr - gl_FragCoord.y) / u_dpr;

  vec2 d = p - u_apex;
  float r = max(length(d), 1.0);
  float th = atan(d.x, d.y);          // 0 = straight down the boresight
  vec2 u = d / r;                     // unit vector along the outgoing ray
  vec2 perp = vec2(-u.y, u.x);
  float rn = r / u_refR;

  // ---- sweep ------------------------------------------------------------
  float omega = 2.0 * PI / u_period;
  float phase = mod(u_time * omega, 2.0 * PI);
  float centre = u_aim * u_sector * 0.34;
  // The swing is set to EXACTLY the widest bearing the frame contains — the
  // sector is that angle plus a 5% margin, so 0.952 of it lands on the top
  // corners. Both neighbouring values are wrong in a way that shows: swung
  // wider, the wedge spends a beat past the corners at each turnaround and the
  // display has no beam in it, which is the frame a screenshot is most likely
  // to catch; swung narrower, the frame grows two permanently unswept wedges at
  // its edges that read as vignette rather than as an image.
  float amp = u_sector * (0.952 - 0.28 * abs(u_aim));
  float thb = centre + amp * sin(phase);
  float x = (th - centre) / amp;
  float age = ageAt(x, phase, omega);
  // bearings outside the swung sector are only ever grazed at a turnaround
  // only bearings the swing genuinely never reaches are penalised, and gently:
  // aiming the beam to one side should leave the other side DECAYING, not
  // blacked out
  float inSector = 1.0 - smoothstep(1.0, 1.3, abs(x));

  // The live wedge, in ANGLE rather than in time: its width is the two-way beam
  // pattern, which is an angle, so on screen it fans out with range instead of
  // staying a constant-width stripe. Focus narrows it around the focal range,
  // the way a focused aperture does.
  float focR = mix(0.55, u_focus, u_hover) * u_refR;
  float defocus = 0.55 + 1.5 * abs(r - focR) / u_refR;
  float bw = (0.0055 + 0.0175 * rn) * defocus;
  float dth = th - thb;
  float edge = exp(-pow(dth / bw, 2.0));
  // the trailing skirt of the main lobe, an order of magnitude wider and much
  // fainter — without it the wedge has a hard edge no transducer ever had
  float skirt = exp(-pow(dth / (bw * 5.5), 2.0));

  // ---- the bottom -------------------------------------------------------
  // the vehicle creeps forward, so the bottom drifts past and every shadow
  // lengthens and swings while it does
  vec2 wp = (p + vec2(0.0, u_time * 7.0)) / u_scale;

  float bed = fbm3(wp * 0.0034) * 0.72 + fbm2(wp * 0.0011) * 0.5;

  // Sand ripples, lit at grazing incidence. The facet tilted toward the
  // transducer returns; the one tilted away does not. dot(u, rd) is the
  // obliquity of the ray to the ripple crests, so ripples broadside to the beam
  // band hard and ripples end-on almost vanish — the strongest single cue that
  // the frame is lit from one moving point.
  vec2 rd = normalize(vec2(0.86, 0.51));
  float warp = fbm2(wp * 0.0016);
  float ph2 = dot(wp, rd) * 0.062 + warp * 6.5;
  float rippleFreq = 0.062;
  // azimuth resolution is an ANGLE, so the along-arc footprint grows with range
  // and the ripple term is low-passed by it: fine structure survives near, and
  // genuinely does not survive far
  // the along-arc footprint is bw*r px and the ripple wavelength is
  // 2PI/rippleFreq px, so the attenuation is set by the ratio of the two. The
  // first pass at this used a constant an order of magnitude too large and the
  // ripples vanished everywhere except within a few hundred px of the
  // transducer, which read as "no ripples" and cost the frame its texture.
  float smear = exp(-pow(bw * r * rippleFreq * 0.55, 2.0));
  float rip = -sin(ph2) * dot(u, rd) * 0.52 * smear;
  // a second, finer ripple train at an angle to the first — real bottoms carry
  // an older set under the current one, and the interference is what stops the
  // banding reading as a single sine
  rip += -sin(dot(wp, vec2(-0.42, 0.91)) * 0.11 + warp * 4.0) * dot(u, vec2(-0.42, 0.91)) * 0.2 * smear;

  float E = 0.42 + bed * 0.9 + rip;

  // sparse point scatterers — shell hash, a chain, one bright cell in a hundred
  float sc = hash21(floor(wp / 6.0) + 31.7);
  E += smoothstep(0.988, 1.0, sc) * 1.3;

  // ---- targets and their shadows ---------------------------------------
  float shadow = 0.0;
  for (int i = 0; i < OBJECTS; i++) {
    vec2 od = u_obj[i].xy - u_apex;
    float orr = length(od);
    float oth = atan(od.x, od.y);
    float orad = u_obj[i].z;
    float oh = u_obj[i].w;
    float hw = orad / orr;
    float dt2 = th - oth;

    // near-face specular: the side of the boulder square to the beam
    float dr = r - (orr - orad * 0.45);
    E += exp(-pow(dt2 / (hw * 0.85), 2.0)) * exp(-pow(dr / (orad * 0.6), 2.0)) * (1.5 + 1.1 * oh);

    // the shadow: everything at this bearing beyond the target, its penumbra
    // widening with distance behind because the source is not a point
    float behind = r - orr;
    float len = orad * (3.0 + 11.0 * oh) * (0.7 + rn);
    float lat = 1.0 - smoothstep(hw * 0.7, hw * 1.25 + behind * 0.00055, abs(dt2));
    float s = smoothstep(0.0, orad * 0.55, behind) * (1.0 - smoothstep(len * 0.45, len, behind)) * lat;
    shadow = max(shadow, s * (0.6 + 0.4 * oh));
  }
  E *= 1.0 - 0.94 * shadow;

  // ---- speckle ----------------------------------------------------------
  // Multiplicative, with the correlation cell growing with range (a resolution
  // cell is an angle times a pulse length). Seeded by the pass that PAINTED
  // this pixel rather than by now, so grain decorrelates one wedge at a time as
  // the beam goes over it instead of the whole frame boiling together.
  float cell = 1.2 + 3.0 * rn;
  float pass = floor((u_time - age) * 2.0 / u_period);
  vec2 seed = vec2(pass * 19.7, pass * 7.3);
  vec2 sp = floor(wp / cell) + seed;
  // one hard cell plus one interpolated octave: a pure cell hash reads as square
  // pixels, and pure smooth noise reads as cloud — a resolution cell is neither
  float spk = hash21(sp) * 0.55 + hash21(sp * 1.7 + 5.1) * 0.2 + vnoise(wp / cell * 0.55 + seed) * 0.25;
  E *= 0.5 + 1.05 * spk;

  // time-varying gain leaves a residual: near range still hotter than far
  E *= mix(1.25, 0.5, clamp(rn, 0.0, 1.0));
  // and the focal zone is where the aperture actually concentrates energy
  E *= 1.0 + 0.55 * u_hover * exp(-pow((r - focR) / (u_refR * 0.16), 2.0));
  // one overall level, set so the bottom lands in the middle stops after
  // compression: the log curve fits the dynamic range but does not choose where
  // the image sits, and without this the seabed clips to white and takes the
  // persistence gradient with it
  E = max(E, 0.0) * 0.34;

  // log compression — the mapping every acoustic display uses to fit a decade
  // of return into a screen's worth of luminance
  float sig = log(1.0 + 7.5 * E) / log(8.5);

  // ---- persistence ------------------------------------------------------
  // The floor is the argument here. Decaying to near-zero is what a phosphor
  // does and it looked right in the equations, but on a full-bleed frame it
  // means two thirds of the page is black and the component is a stripe on
  // nothing. A real scan converter holds the last complete sweep and dims it,
  // so the floor is high enough that the WHOLE seabed stays readable and the
  // decay is a gradient of freshness across it rather than an erasure.
  float fresh = exp(-age / u_tau);
  float gain = (0.38 + 0.62 * fresh) * mix(0.62, 1.0, inSector);
  gain += edge * 0.7 + skirt * 0.18;

  float L = sig * gain;
  // the transmitted wedge is visible even where nothing returns
  L += (edge * 0.11 + skirt * 0.02) * inSector;

  // ---- instrument furniture --------------------------------------------
  // range rings and bearing ticks, at the threshold of legibility: enough to
  // read as a calibrated display, not enough to compete with the image
  float ring = abs(fract(rn * 5.0) - 0.5) * 2.0;
  L += (1.0 - smoothstep(0.86, 1.0, ring)) * 0.042 * (0.35 + 0.65 * fresh);
  float bearing = abs(fract(th * 9.55) - 0.5) * 2.0;
  L += (1.0 - smoothstep(0.9, 1.0, bearing)) * 0.03 * step(0.12, rn) * (0.3 + 0.7 * fresh);

  // receiver noise: present everywhere, including in the shadows and in the
  // dark behind the beam, and re-drawn every frame — a real display is never
  // still, and this is what keeps the far side of the sweep alive
  float grain = hash21(p * 1.7 + fract(u_time) * vec2(91.3, 57.1));
  L += (grain - 0.5) * (0.055 + 0.05 * fresh);
  // a slow swell in the noise floor, so the dark is textured rather than flat
  L += (fbm2(p * 0.006 + vec2(0.0, u_time * 0.09)) - 0.5) * 0.05;

  // slight vignette toward the deepest stop: full bleed, but the corners stop
  // pulling against the wedge
  vec2 vp = (p - u_size * 0.5) / max(u_size.x, u_size.y);
  L -= smoothstep(0.34, 0.78, length(vp * vec2(1.0, 1.25))) * 0.1;

  // Display gamma: the log compression above fits the dynamic range, this
  // chooses where the image SITS in it, and it is the one place the two themes
  // genuinely differ. On the dark instrument, lifting the mid-returns (0.86)
  // puts the bottom in the middle stops instead of leaving a dark field with a
  // bright wedge on it. On the paper record, ink is subtractive and a page is
  // mostly paper, so the same signal is pushed the other way (1.28) and only
  // strong returns print — otherwise the light theme is a black page with white
  // holes in it, which is an inversion rather than a print.
  L = pow(clamp(L, 0.0, 1.0), u_gamma);

  vec3 col = mix(u_c0, u_c1, smoothstep(0.0, 0.3, L));
  col = mix(col, u_c2, smoothstep(0.26, 0.62, L));
  col = mix(col, u_c3, smoothstep(0.58, 1.0, L));

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
    throw new Error(`ping-shadow: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// ---------------------------------------------------------------------------
// GLSurface — the minimal full-bleed fragment-shader host: one program, one
// fullscreen triangle pair, uniform locations resolved lazily by name.
// ---------------------------------------------------------------------------
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

// The clock the reduced-motion / paused frame is drawn at, and the value the
// running clock STARTS at. The analytic persistence means any t is a fully
// painted scene, so this only picks which one: the beam a third of the way off
// boresight and travelling near its fastest, with a full freshness gradient
// trailing it and three or four shadows in the fresh sector.
const STATIC_TIME = 3.02;

export function PingShadow({
  speed = 1,
  sweepPeriod = 5.4,
  persistence = 1,
  scale = 1,
  paused = false,
  children,
  className = "",
  style,
}: PingShadowProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();

  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const surface = new GLSurface(canvas, FRAG_SRC);
    let raf = 0;
    let running = false;
    let staticMode = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let disposed = false;
    let lastMs = performance.now();

    // Adaptive render ladder — insurance, not the fix. The shader costs roughly
    // a dozen noise taps and an 11-iteration analytic loop per fragment, which
    // measures well inside a 60Hz budget full-bleed on the machines we can
    // test; the steps exist for the ones we cannot. Every threshold is in
    // milliseconds of wall clock, never in frames: a frame-counted gate waits
    // longest exactly on the machines that need help soonest.
    const SCALES = [1, 0.78, 0.58];
    const BUDGET_OVER = 24;
    // Shader compile, first paint and hydration all land inside the first
    // second, and their frames are not this surface's cost. Without a warm-up
    // the ladder reads that burst as a slow machine and drops resolution on a
    // display that then runs at vsync for the rest of the session — measured:
    // a step to 0.78 on a run whose median interval was 16.7ms.
    const WARMUP_MS = 1500;
    let warmMs = 0;
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;
    // integrated, per-frame-clamped clock: a GC pause or a tab return advances
    // the sweep by one clamped step instead of teleporting the beam
    let simTime = STATIC_TIME;

    let hoverTarget = 0;
    let hoverAmt = 0;

    // pointer: raw target from events, smoothed position advanced in the loop
    let havePointer = false;
    let tgtX = 0;
    let tgtY = 0;
    let ptrX = 0;
    let ptrY = 0;
    let velX = 0;
    let velY = 0;
    let lastTgtX = 0;
    let lastTgtY = 0;
    let rectLeft = 0;
    let rectTop = 0;
    let rectDirty = true;

    const objects = new Float32Array(OBJECTS * 4);
    // Deterministic layout: the same seabed every mount, so a screenshot gate
    // grades one scene rather than eleven random ones.
    const seeds: { x: number; y: number; rad: number; h: number }[] = [];
    {
      let s = 0x2f6e2b1;
      const rnd = () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
      for (let i = 0; i < OBJECTS; i++) {
        seeds.push({ x: rnd(), y: rnd(), rad: rnd(), h: rnd() });
      }
    }

    let c0: RGB = [0.02, 0.02, 0.02];
    let c1: RGB = [0.16, 0.16, 0.16];
    let c2: RGB = [0.55, 0.55, 0.55];
    let c3: RGB = [0.97, 0.97, 0.97];
    let gamma = 0.86;

    // Four luminance stops. Dark theme is the instrument — strong returns
    // bright on a black screen. Light theme is the same data as a wet-paper
    // record, strong returns as dark ink on white, which is how side-scan was
    // read before it was screened. Same L in both; only the ramp reverses, so
    // there is nothing in the shader that knows about the theme.
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const border = parseHex(cs.getPropertyValue("--border")) ?? [0.18, 0.18, 0.18];
      const black: RGB = [0, 0, 0];
      const white: RGB = [1, 1, 1];
      if (luminance(bg) < 0.5) {
        c0 = mixRGB(bg, black, 0.72);
        c1 = mixRGB(border, bg, 0.1);
        c2 = mixRGB(muted, fg, 0.25);
        c3 = mixRGB(fg, white, 0.7);
        gamma = 0.86;
      } else {
        c0 = mixRGB(bg, white, 0.6);
        c1 = mixRGB(bg, muted, 0.42);
        c2 = mixRGB(muted, fg, 0.5);
        c3 = mixRGB(fg, black, 0.3);
        gamma = 1.28;
      }
    };
    readColors();

    // ---- geometry ---------------------------------------------------------
    // The transducer sits well above the top edge rather than on it: an apex on
    // the frame would leave the top corners outside any sector and the display
    // would have two dead wedges. Pushed back to 1.18H the whole rectangle fits
    // inside one sector, the frame is full bleed, and the shadows still diverge
    // visibly instead of running parallel.
    let apexX = 0;
    let apexY = 0;
    let sector = 0.7;
    let refR = 1;
    const layout = () => {
      apexX = cssW * 0.5;
      apexY = -cssH * 1.18;
      refR = Math.hypot(0, cssH - apexY);
      // the widest bearing any pixel has (a top corner), plus a margin
      sector = Math.atan((cssW * 0.5) / -apexY) * 1.05;
    };

    const updateObjects = (t: number) => {
      // world band taller than the frame; the bottom drifts through it at the
      // same 7px/s the shader's noise field drifts, so targets and texture stay
      // locked together
      const bandH = cssH * 1.7;
      const ref = Math.min(cssW, cssH);
      for (let i = 0; i < OBJECTS; i++) {
        const s = seeds[i];
        const y = ((s.y * bandH - t * 7 * scale) % bandH + bandH) % bandH;
        objects[i * 4] = (0.04 + s.x * 0.92) * cssW;
        objects[i * 4 + 1] = y - cssH * 0.25;
        objects[i * 4 + 2] = ref * (0.012 + s.rad * 0.032) * scale;
        objects[i * 4 + 3] = 0.25 + s.h * 0.75;
      }
    };

    const draw = () => {
      if (!surface.gl || cssW <= 0 || cssH <= 0) return;
      const t = staticMode ? STATIC_TIME : simTime;
      updateObjects(t);
      const aim = havePointer ? Math.max(-1, Math.min(1, (ptrX / cssW - 0.5) * 2)) : 0;
      const focus = havePointer ? Math.max(0.08, Math.min(1, ptrY / cssH)) : 0.55;
      surface.v2("u_size", cssW, cssH);
      surface.f("u_dpr", dpr);
      surface.f("u_time", t);
      surface.f("u_period", Math.max(1.2, sweepPeriod));
      surface.f("u_tau", Math.max(0.12, sweepPeriod * 0.32 * Math.max(0.15, persistence)));
      surface.f("u_scale", Math.max(0.3, scale));
      surface.v2("u_apex", apexX, apexY);
      surface.f("u_sector", sector);
      surface.f("u_refR", refR);
      surface.f("u_aim", aim * hoverAmt);
      surface.f("u_focus", focus);
      surface.f("u_hover", hoverAmt);
      surface.v4a("u_obj", objects);
      surface.f("u_gamma", gamma);
      surface.v3("u_c0", c0);
      surface.v3("u_c1", c1);
      surface.v3("u_c2", c2);
      surface.v3("u_c3", c3);
      surface.draw(canvas.width, canvas.height);
    };

    const stepPointer = (dt: number) => {
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

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
      lastMs = nowMs;
      simTime += dt * speed;
      hoverAmt += (hoverTarget - hoverAmt) * (1 - Math.exp(-dt * 4));
      stepPointer(dt);
      draw();
      const clamped = Math.min(50, rawMs);
      if (warmMs < WARMUP_MS) {
        warmMs += clamped;
        raf = requestAnimationFrame(loop);
        return;
      }
      frameEma += (clamped - frameEma) * (1 - Math.exp(-clamped / 120));
      if (frameEma > BUDGET_OVER) {
        overMs += clamped;
        underMs = 0;
      } else {
        underMs += clamped;
        overMs = 0;
      }
      // asymmetric: drop after ~1.5s of stutter, climb back only after a much
      // longer clean stretch, so a marginal machine cannot oscillate
      const down = overMs > 1500 && scaleIdx < SCALES.length - 1;
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

    // DPR capped at 1.5: full bleed at a device ratio of 2 is four times the
    // fragments, and the speckle this shader draws is a per-pixel hash whose
    // legibility does not improve past about 1.5 anyway.
    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5) * SCALES[scaleIdx];
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      draw();
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      rectLeft = rect.left;
      rectTop = rect.top;
      rectDirty = false;
      layout();
      // a new size is a new cost, so the ladder starts over rather than
      // carrying a verdict earned at a different fragment count
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      warmMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      applyBacking();
      draw();
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
      velX = 0;
      velY = 0;
      lastTgtX = tgtX;
      lastTgtY = tgtY;
      havePointer = true;
    };

    const onPointerEnter = (e: PointerEvent) => {
      hoverTarget = 1;
      setTarget(e);
      snapPointer();
      if (staticMode) draw();
    };
    const onPointerLeave = () => {
      hoverTarget = 0;
      havePointer = false;
      if (staticMode) draw();
    };
    const onPointerMove = (e: PointerEvent) => {
      setTarget(e);
      if (!havePointer) {
        // no enter fired: the display appeared under a resting pointer, or a
        // touch was lifted and put back down
        snapPointer();
        hoverTarget = 1;
      }
      if (staticMode) {
        ptrX = tgtX;
        ptrY = tgtY;
        hoverAmt = 1;
        draw();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      hoverTarget = 1;
      if (staticMode) {
        hoverAmt = 1;
        draw();
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      // a lifted touch has no position and no pointerleave is coming
      if (e.pointerType !== "mouse") {
        hoverTarget = 0;
        havePointer = false;
      }
    };
    const onPointerCancel = () => {
      hoverTarget = 0;
      havePointer = false;
    };

    if (!surface.init()) return; // no WebGL: children still render over the page bg
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    wrap.addEventListener("pointerenter", onPointerEnter);
    wrap.addEventListener("pointerleave", onPointerLeave);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerdown", onPointerDown);
    wrap.addEventListener("pointerup", onPointerUp);
    wrap.addEventListener("pointercancel", onPointerCancel);
    // the wrap's viewport offset only moves on scroll or layout, so mark it
    // stale here and re-read it once on the next pointer event instead of
    // forcing a layout inside every pointermove
    window.addEventListener("scroll", markRectDirty, { passive: true, capture: true });
    window.addEventListener("resize", markRectDirty, { passive: true });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        draw();
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

    // a full-bleed shader off-screen is the most expensive idle thing a page
    // can carry
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

    let lastPolledPaused = pausedRef.current;
    // polled rather than made an effect dependency: a dependency would tear
    // down and recreate the whole GL context to change a boolean
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
      if (staticMode) draw();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onLost = (e: Event) => {
      e.preventDefault();
      sleep();
    };
    const onRestored = () => {
      if (surface.init()) {
        resize();
        applyMode();
      }
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
      surface.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, sweepPeriod, persistence, scale]);

  return (
    <div
      ref={wrapRef}
      data-ping-shadow={uid}
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

PingShadow.displayName = "PingShadow";
