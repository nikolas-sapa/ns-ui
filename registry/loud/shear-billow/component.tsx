"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// ShearBillow — a full-bleed Kelvin-Helmholtz shear layer: two stratified
// layers sliding past each other, the interface between them rippling,
// steepening, curling over into a train of spiral billows and shredding into
// turbulence downstream, continuously regenerating from the upstream edge.
//
// THE MECHANISM, and it is the whole component: the velocity field is Stuart's
// exact steady solution of the 2D Euler equations for a rolled-up shear layer,
//
//     psi = (1/k) ln( cosh(k(y - yc)) + rho cos(k x - omega t) )
//
// with rho = 0 giving a plain tanh shear profile and rho -> 1 giving a row of
// closed "cat's eye" vortices. Taking rho as a function of x — small upstream,
// saturating downstream — turns the steady solution into a SPATIALLY
// DEVELOPING layer, which is exactly the thing being drawn: at the left edge
// the interface is a nearly flat line with a ripple on it, by mid-frame the
// ripple has steepened and closed into a cat's eye, and past that the rolls
// are fully wound. Because psi is a streamfunction and u = dpsi/dy,
// v = -dpsi/dx are taken analytically (including the drho/dx term), the field
// is divergence-free by construction — no solver, no pressure projection, and
// no drift toward a compressible-looking smear.
//
// THE IMAGE IS NOT THE FIELD. Nothing here draws the velocity. Every pixel
// backward-integrates its own parcel through the flow for TRACE seconds (RK2,
// fixed step count so the loop is coherent) and reads the STRATIFICATION at
// the position and time it came from — a stack of horizontal density layers
// with a thin sheet marking the interface. That single decision is what
// produces the spiral: inside a strong cat's eye the streamlines are closed,
// so the backward trace circles the core several times and drags the sheet
// around with it, while at the upstream edge the same trace is almost a
// straight line and the layers come back flat. The wind-up is therefore
// EARNED by the flow rather than drawn as a spiral primitive, and the braids
// — the stretched sheets of interface pulled taut between adjacent rolls —
// appear on their own, which is the detail that makes a KH photograph read as
// KH and not as generic swirl.
//
// A subharmonic, rho2 cos(kx/2 + phase), grows in only in the downstream half.
// That is vortex PAIRING: alternate billows strengthen at their neighbours'
// expense and roll around each other. It is real KH behaviour and it is also
// what stops the train from reading as a rubber-stamped periodic row, which is
// the failure mode of every analytic version of this.
//
// PALETTE. Stratification reads through value alone. Five stops from
// --background, --foreground, --ns-muted and --border via getComputedStyle,
// re-read on a documentElement class MutationObserver. The ramp's DIRECTION
// carries the theme rather than a bias term: dark is a lit interface in a dark
// column of air, light is the same layer photographed as ink on paper, where
// the dense sheet is the darkest thing on screen. Light is the harder case —
// pale strata over a pale ground wash out — so its stops are spaced apart
// separately rather than derived from dark's. --ns-accent is interaction-only:
// it tints the pointer's own vortices, and it decays to exactly zero.
// ---------------------------------------------------------------------------

export interface ShearBillowProps {
  /** Billows across the frame's width. @default 6 */
  billows?: number;
  /** Flow rate multiplier. @default 1 */
  speed?: number;
  /** How hard the interface shreds downstream, 0..2. @default 1 */
  turbulence?: number;
  /** Density banding in each layer — 0 leaves two plain slabs. @default 1 */
  strata?: number;
  /** How hard the pointer stirs the layer, 0..2. @default 1 */
  stir?: number;
  /** Freezes the layer on a fully developed still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the layer — eyebrow, headline, CTA. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Backward-trace resolution. STEPS is fixed rather than adaptive so the loop
// is uniform across the whole draw — a per-pixel step count on a field this
// cheap costs more in divergence than it saves in evaluations.
const STEPS = 18;
const VORT = 4;

// Pointer smoothing, carried over from weld-pool along with the reason: a
// plain exponential follower has a steady-state error of exactly v*tau under
// constant velocity, so a stir laid down at the followed position is LATE by
// that much, and the eye reads lateness as the surface ignoring the cursor.
// Extrapolating the target one tau ahead cancels the term algebraically and
// leaves the smoothing doing only what it should — absorbing direction changes
// and interpolating between events that arrived sparser than frames.
const POINTER_TAU = 0.012;
const VEL_TAU = 0.06;
const LEAD_MAX = 26;
// Vortices are deposited by distance with a one-frame time ceiling, so the
// deposit cadence is the DISPLAY's 60Hz and not the pointer event rate. A
// deposit every other frame reads as lag even at a flat 16.7ms frame time.
const SAMPLE_SPACING = 46;
const SAMPLE_MAX_GAP = 0.016;
const VORT_LIFE = 2.6;

const FRAG_SRC = `
precision highp float;

#define STEPS ${STEPS}
#define VORT ${VORT}

uniform vec2 u_size;       // css px
uniform float u_dpr;
uniform float u_time;
uniform float u_k;         // wavenumber, rad/px
uniform float u_om;        // pattern angular frequency, rad/s
uniform float u_yc;        // interface height, css px
uniform float u_um;        // mean drift, px/s
uniform float u_u0;        // shear half-velocity, px/s
uniform float u_trace;     // seconds integrated backwards
uniform float u_turb;
uniform float u_strata;
uniform vec4 u_vort[VORT]; // x, y css px, z = birth time (negative = unused), w = signed strength
uniform float u_vrad;
uniform float u_stir;      // 0 when every pointer vortex has decayed
uniform float u_vminborn;  // earliest birth time among live vortices
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform vec3 u_accent;
uniform float u_dark;

float hash21(vec2 p) {
  p = fract(p * vec2(291.37, 417.13));
  p += dot(p, p + 23.91);
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
  float s = vnoise(p) * 0.55;
  s += vnoise(p * 2.07 + 11.7) * 0.27;
  s += vnoise(p * 4.13 + 29.1) * 0.14;
  return s;
}

// smoothstep and its derivative in one call: the derivative of the roll-up
// amplitude is not decoration, it is the drho/dx term of v = -dpsi/dx, and
// dropping it is what makes an x-modulated Stuart field stop being
// divergence-free and start looking like it is being squeezed.
vec2 sstepD(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  float on = step(0.0, (x - a) * (b - x));
  return vec2(t * t * (3.0 - 2.0 * t), 6.0 * t * (1.0 - t) / (b - a) * on);
}

// Roll-up amplitude: exponential-looking growth out of the upstream edge,
// saturation where the cat's eye closes, then a slow decay once the roll has
// broken up and the mixing region has taken over. rho + rho2 must stay under
// 1 or D goes non-positive and the log singularity punches a hole in the field.
vec2 rhoOf(float xn) {
  vec2 g = sstepD(0.015, 0.60, xn);
  vec2 d = sstepD(0.68, 1.10, xn);
  float v = 0.735 * g.x * (1.0 - 0.34 * d.x);
  float dv = 0.735 * (g.y * (1.0 - 0.34 * d.x) - g.x * 0.34 * d.y);
  return vec2(v, dv);
}

// The subharmonic. It grows in only downstream, so alternate billows start
// pulling on each other exactly where a real layer pairs.
vec2 rho2Of(float xn) {
  vec2 g = sstepD(0.26, 0.98, xn);
  return vec2(0.185 * g.x, 0.185 * g.y);
}

// Velocity at (p, t): u = dpsi/dy, v = -dpsi/dx of Stuart's streamfunction,
// plus whatever pointer vortices were alive at time t.
vec2 flow(vec2 p, float t) {
  float xn = p.x / u_size.x;
  vec2 R = rhoOf(xn);
  vec2 R2 = rho2Of(xn);

  float Y = clamp(u_k * (p.y - u_yc), -7.0, 7.0);
  float e = exp(Y);
  float ie = 1.0 / e;
  float ch = 0.5 * (e + ie);
  float sh = 0.5 * (e - ie);

  float ph = u_k * p.x - u_om * t;
  float c1 = cos(ph);
  float s1 = sin(ph);
  float hp = 0.5 * ph + 1.37;
  float c2 = cos(hp);
  float s2 = sin(hp);

  float D = max(ch + R.x * c1 + R2.x * c2, 0.06);
  float invD = 1.0 / D;

  float u = sh * invD;
  // dD/dx, with the two amplitude derivatives carried in css-px units
  float dDdx = (R.y * c1 + R2.y * c2) / u_size.x - u_k * (R.x * s1 + 0.5 * R2.x * s2);
  float v = -dDdx * invD / u_k;

  vec2 vel = vec2(u_um + u_u0 * u, u_u0 * v);

  // uniform branch, coherent across the draw: at rest — where the page spends
  // most of its life — the stir costs nothing at all. The second half of the
  // test is the same skip one step earlier: the trace reaches back further than
  // a vortex has existed, so for every step before the earliest live birth the
  // loop below can only ever hit age < 0 and continue. Hoisting that to a
  // uniform comparison drops the loop entirely on those steps — same output,
  // and the branch is coherent because tt is identical across the draw.
  if (u_stir > 0.0 && t >= u_vminborn) {
    for (int i = 0; i < VORT; i++) {
      float born = u_vort[i].z;
      float age = t - born;
      // a vortex that had not been laid down yet at trace time t must not act
      // on the parcel, or the pointer's wake reaches backwards through it
      if (born < 0.0 || age < 0.0 || age > ${VORT_LIFE.toFixed(2)}) continue;
      vec2 d = p - u_vort[i].xy;
      float r2 = dot(d, d) / (u_vrad * u_vrad);
      if (r2 > 8.0) continue;
      float amp = u_vort[i].w * smoothstep(0.0, 0.10, age) * exp(-age * 1.15);
      vel += amp * exp(-r2) * vec2(-d.y, d.x) / u_vrad;
    }
  }
  return vel;
}

// Divergence-free stir for the downstream breakdown: the curl of one scalar
// noise, so the shredding transports the layers rather than inflating them.
vec2 curl(vec2 p) {
  float e = 0.55;
  float a = fbm2(p + vec2(0.0, e));
  float b = fbm2(p - vec2(0.0, e));
  float c = fbm2(p + vec2(e, 0.0));
  float d = fbm2(p - vec2(e, 0.0));
  return vec2(a - b, d - c) / (2.0 * e);
}

vec3 ramp(float x) {
  vec3 c = mix(u_c0, u_c1, smoothstep(0.0, 0.28, x));
  c = mix(c, u_c2, smoothstep(0.26, 0.56, x));
  c = mix(c, u_c3, smoothstep(0.54, 0.82, x));
  c = mix(c, u_c4, smoothstep(0.80, 1.0, x));
  return c;
}

void main() {
  // DOM-space px, y down, so pointer coordinates and the field share one
  // coordinate system
  vec2 p = vec2(gl_FragCoord.x, u_size.y * u_dpr - gl_FragCoord.y) / u_dpr;
  float xn = p.x / u_size.x;

  // ---- backward trace ---------------------------------------------------
  vec2 q = p;
  float tt = u_time;
  float dt = -u_trace / float(STEPS);
  for (int i = 0; i < STEPS; i++) {
    vec2 k1 = flow(q, tt);
    vec2 k2 = flow(q + k1 * dt, tt + dt);
    q += 0.5 * (k1 + k2) * dt;
    tt += dt;
  }

  // ---- downstream breakdown ---------------------------------------------
  // The mixing region thickens with distance, so the shredding is gated both
  // by how far downstream the pixel is and by how close its parcel came from
  // to the interface. Applied to the SAMPLE point, not integrated: a curl
  // field inside the trace loop costs eight noise taps per step for detail the
  // eye reads identically at one tap per pixel.
  float Yq = u_k * (q.y - u_yc);
  float mix0 = exp(-Yq * Yq * 0.055);
  float turbAmt = u_turb * smoothstep(0.34, 1.02, xn) * (0.30 + 0.70 * mix0);
  float ref = min(u_size.x, u_size.y);
  // upstream of xn = 0.34 turbAmt is exactly zero, so both curl fields are
  // multiplied out — 32 hash taps per pixel producing a displacement of 0.
  // Skipping them there is not an approximation, and the branch is coherent
  // because it depends only on the column.
  if (turbAmt > 0.0) {
    q += curl(q * 0.0075 + vec2(u_time * 0.021, 3.1)) * turbAmt * ref * 0.30;
    q += curl(q * 0.026 + vec2(-u_time * 0.05, 8.4)) * turbAmt * ref * 0.055;
  }

  float Y0 = u_k * (q.y - u_yc);
  // the source stratification drifts with the mean flow, so its texture is a
  // property of the fluid rather than a pattern pinned to the viewport
  vec2 src = q - vec2(u_um * tt, 0.0);

  // ---- stratification ---------------------------------------------------
  // Two slabs of different density with a thin sheet between them. Everything
  // the image shows is this profile, dragged around by the trace.
  float tn = Y0 / (1.0 + abs(Y0));
  float sigma = 0.45 + 0.20 * tn;

  // density banding inside each slab, tilted by a very low-frequency swim so
  // the layers are not drafting-board parallel
  float swim = fbm2(src * 0.0011 + vec2(0.0, 4.7));
  float bands = sin(Y0 * 2.7 + swim * 5.5);
  sigma += bands * 0.085 * u_strata;

  // laminar wind streaks: one noise sample stretched ~40:1 along the flow, so
  // the undisturbed layers read as moving air and the interface reads as the
  // only place anything is happening
  float streak = vnoise(vec2(src.x * 0.0022, src.y * 0.085) + vec2(0.0, 1.7));
  sigma += (streak - 0.5) * 0.085;

  // the interface sheet — the thing that actually gets wound into a spiral
  float sheet = exp(-Y0 * Y0 * 1.25);
  sigma += sheet * 0.52;

  // filament grain, advected with the parcel: fine structure inside the rolls
  float grain = fbm3(src * 0.019 + vec2(0.0, 0.0));
  sigma += (grain - 0.5) * (0.10 + 0.16 * mix0);
  sigma += (fbm2(src * 0.075) - 0.5) * 0.07 * (0.2 + turbAmt);

  sigma = clamp(sigma, 0.0, 1.0);

  vec3 col = ramp(sigma);

  // ---- pointer ----------------------------------------------------------
  // accent only where a live pointer vortex is, and it reaches zero when the
  // last one decays, so a resting frame carries no accent at all
  if (u_stir > 0.0) {
    float near = 0.0;
    for (int i = 0; i < VORT; i++) {
      float born = u_vort[i].z;
      float age = u_time - born;
      if (born < 0.0 || age < 0.0 || age > ${VORT_LIFE.toFixed(2)}) continue;
      vec2 d = p - u_vort[i].xy;
      float r2 = dot(d, d) / (u_vrad * u_vrad);
      near += exp(-r2 * 0.85) * exp(-age * 1.4);
    }
    near = clamp(near, 0.0, 1.0);
    vec3 tint = mix(u_accent, mix(u_c4, u_accent, 0.5), sheet);
    col = mix(col, tint, near * 0.34 * (0.30 + 0.70 * sheet));
  }

  // mild elliptical vignette toward the deepest stop so the frame edges stop
  // competing with whatever is overlaid
  vec2 vp = (p - u_size * 0.5) / ref;
  float vig = smoothstep(0.62, 1.24, length(vp * vec2(1.0, 1.35)));
  col = mix(col, mix(u_c4, u_c0, u_dark), vig * 0.26);

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
    throw new Error(`shear-billow: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// ---------------------------------------------------------------------------
// GLSurface — the minimal full-bleed fragment-shader host: one program, one
// fullscreen triangle pair, uniform locations resolved lazily by name. It knows
// nothing about the shear layer.
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

// A time offset chosen so the frame drawn under prefers-reduced-motion — and
// the resting frame the screenshot gate grades — already has the full train
// developed: a flat interface upstream, two closed cat's eyes mid-frame and a
// paired, shredding roll downstream. Never an undeveloped flat line.
const STATIC_TIME = 34.0;

// DPR is capped at 1.5 rather than 2. The per-pixel cost here is 36 evaluations
// of the streamfunction plus 20 noise taps, so the area term dominates
// completely and the structure the shader draws — spiral sheets a few px wide —
// survives a 1.5x backing store intact, unlike a scanline comb would.
const DPR_CAP = 1.5;

export function ShearBillow({
  billows = 6,
  speed = 1,
  turbulence = 1,
  strata = 1,
  stir = 1,
  paused = false,
  children,
  className = "",
  style,
}: ShearBillowProps) {
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

    // Adaptive render scale, and it is insurance rather than the fix: the
    // shader runs well inside budget on every machine we can measure, so
    // SCALES[0] is what they all sit at. The steps exist for the ones we
    // cannot — a weak integrated GPU, a 6K panel, a laptop throttling on
    // battery. Every threshold is in milliseconds of wall clock, never in
    // frames: a frame-counted gate waits longer the slower the machine is,
    // which is backwards. Recovery is asymmetric, because the frame time this
    // watches is the PAGE's — a sibling animation blowing the budget must not
    // soften this surface for the rest of the visit.
    const SCALES = [1, 0.75, 0.55];
    const BUDGET_OVER = 24;
    // The first second of a surface's life is not evidence about the surface:
    // hydration, the shader compile and the first uploads all land inside it,
    // and they cost the same whatever resolution the canvas is. Measured, that
    // transient alone was enough to walk the ladder down two rungs on every
    // load — and since recovery needs 8s under budget and doubles after each
    // demotion, it then stayed at the bottom rung for the whole visit, soft, on
    // a machine that renders it at 60Hz at full scale. The ladder must judge
    // the steady state or it is just a resolution downgrade with extra steps.
    const LADDER_SETTLE = 1500;
    let settleMs = 0;
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;
    // integrated, per-frame-clamped clock: a long frame advances the flow by
    // one clamped step instead of teleporting the whole train sideways, and
    // time simply stops while the surface is asleep offscreen
    let simTime = STATIC_TIME * 0.34;

    const vort = new Float32Array(VORT * 4).fill(-1);
    let vortHead = 0;
    let vortSign = 1;

    let havePointer = false;
    let tgtX = 0;
    let tgtY = 0;
    let ptrX = 0;
    let ptrY = 0;
    let velX = 0;
    let velY = 0;
    let lastTgtX = 0;
    let lastTgtY = 0;
    let sampleX = 0;
    let sampleY = 0;
    let lastSampleT = 0;
    // the wrap's viewport offset, cached: reading it per pointermove is a
    // forced layout on the hottest path there is
    let rectLeft = 0;
    let rectTop = 0;
    let rectDirty = true;

    let c0: RGB = [0.03, 0.03, 0.03];
    let c1: RGB = [0.12, 0.12, 0.12];
    let c2: RGB = [0.34, 0.34, 0.34];
    let c3: RGB = [0.7, 0.7, 0.7];
    let c4: RGB = [1, 1, 1];
    let accent: RGB = [0, 0.42, 1];
    let darkMode = 1;

    // Two ramps, written separately rather than derived from one with a bias
    // term. A reflective surface spans black-to-white in both themes; a
    // density field does not — it departs from the page in ONE direction, so
    // the interface sheet is the brightest thing on a dark page and the
    // darkest thing on a pale one, and the ordering of the stops is the only
    // place that inversion lives.
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
        darkMode = 1;
        c0 = mixRGB(bg, black, 0.45);
        c1 = mixRGB(border, bg, 0.1);
        c2 = mixRGB(muted, border, 0.34);
        c3 = mixRGB(fg, muted, 0.22);
        c4 = mixRGB(fg, white, 0.6);
      } else {
        // light: pale air at the low end, ink at the high end, and the mids
        // deliberately held back toward the page. Pushing c2/c3 hard at the
        // foreground the way the dark ramp does made the whole dense slab a
        // flat near-black half-frame — an inverted dark theme, not paper — and
        // buried the strata inside it. Only c4, the interface sheet itself,
        // commits to ink, so the sheet stays the darkest thing on screen.
        darkMode = 0;
        c0 = bg;
        c1 = mixRGB(bg, muted, 0.3);
        c2 = mixRGB(muted, bg, 0.22);
        c3 = mixRGB(fg, muted, 0.52);
        c4 = mixRGB(fg, black, 0.25);
      }
    };
    readColors();

    // ---- frame ------------------------------------------------------------
    const draw = () => {
      if (!surface.gl || cssW <= 0 || cssH <= 0) return;
      const t = staticMode ? STATIC_TIME : simTime;

      const k = (2 * Math.PI * Math.max(2, billows)) / cssW;
      const um = cssW * 0.042;
      const u0 = cssW * 0.062;
      // Trace length in eddy turnover times. Under ~1.2 the cat's eye never
      // closes into a spiral and the frame reads as a wavy line; over ~2.2 the
      // upstream half winds up too, and the whole point is that it should not.
      const trace = (1.65 * 2 * Math.PI) / (k * u0);

      let alive = false;
      let minBorn = Infinity;
      for (let i = 0; i < VORT; i++) {
        const born = vort[i * 4 + 2];
        if (born >= 0 && t - born <= VORT_LIFE) {
          alive = true;
          if (born < minBorn) minBorn = born;
        }
      }

      surface.v2("u_size", cssW, cssH);
      surface.f("u_dpr", dpr);
      surface.f("u_time", t);
      surface.f("u_k", k);
      surface.f("u_om", um * k);
      surface.f("u_yc", cssH * 0.5);
      surface.f("u_um", um);
      surface.f("u_u0", u0);
      surface.f("u_trace", trace);
      surface.f("u_turb", Math.max(0, turbulence));
      surface.f("u_strata", Math.max(0, strata));
      surface.v4a("u_vort", vort);
      surface.f("u_vrad", Math.min(cssW, cssH) * 0.17);
      surface.f("u_stir", alive ? 1 : 0);
      surface.f("u_vminborn", alive ? minBorn : 0);
      surface.v3("u_c0", c0);
      surface.v3("u_c1", c1);
      surface.v3("u_c2", c2);
      surface.v3("u_c3", c3);
      surface.v3("u_c4", c4);
      surface.v3("u_accent", accent);
      surface.f("u_dark", darkMode);
      surface.draw(canvas.width, canvas.height);
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
      lastMs = nowMs;
      simTime += dt * speed;
      stepPointer(dt);
      draw();
      // clamped the same way the clock is, so a tab returning from the
      // background cannot inject a one-second frame into the average, and
      // time-constant rather than frame-count smoothing so the average settles
      // in ~120ms of wall clock whatever the frame rate is
      const clamped = Math.min(50, rawMs);
      if (settleMs < LADDER_SETTLE) {
        settleMs += clamped;
        frameEma = 16.7;
        overMs = 0;
        underMs = 0;
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
      // waking from offscreen or from a hidden tab re-uploads and re-warms the
      // same way a first mount does, so the same settle applies
      settleMs = 0;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * SCALES[scaleIdx];
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      // assigning width/height clears the drawing buffer even when the value
      // is unchanged, so only touch it on a real change
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
      // a new size is a new cost, so the adaptive ladder starts over rather
      // than carrying a verdict earned at a different number of fragments
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      settleMs = 0;
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

    // Deposits alternate in sign along the path. A single-sign trail merges
    // into one fat rotating blob within a second; alternating signs shed a row
    // of counter-rotating cores, which is what dragging something through a
    // shear layer actually leaves behind.
    const pushVort = (x: number, y: number, born: number, amp: number) => {
      const i = vortHead * 4;
      vort[i] = x;
      vort[i + 1] = y;
      vort[i + 2] = born;
      vort[i + 3] = amp * vortSign;
      vortHead = (vortHead + 1) % VORT;
      vortSign = -vortSign;
    };

    // Advance the smoothed pointer one frame and lay down whatever vortices
    // that step of travel earned. Everything the field sees about the pointer
    // is produced here, in the frame, from a target the event handlers only
    // ever assign to — so event cadence, coalescing and burstiness cannot
    // reach the surface.
    const stepPointer = (dt: number) => {
      if (!havePointer || dt <= 0) return;
      // velocity of the raw target, smoothed over a window longer than the gap
      // between two events so it survives a frame that carried none
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
      const kk = 1 - Math.exp(-dt / POINTER_TAU);
      ptrX += (tgtX + leadX - ptrX) * kk;
      ptrY += (tgtY + leadY - ptrY) * kk;

      const dx = ptrX - sampleX;
      const dy = ptrY - sampleY;
      const dist = Math.hypot(dx, dy);
      const gap = simTime - lastSampleT;
      if (dist < SAMPLE_SPACING && !(gap >= SAMPLE_MAX_GAP && dist > 1.5)) return;

      // strength tracks how fast the pointer is actually moving, so a resting
      // cursor stops stirring instead of drilling a hole
      const spd = Math.min(1400, Math.hypot(velX, velY));
      const amp = Math.min(1, 0.22 + spd / 900) * Math.max(0, stir) * Math.min(cssW, cssH) * 0.32;
      pushVort(ptrX, ptrY, simTime, amp);
      sampleX = ptrX;
      sampleY = ptrY;
      lastSampleT = simTime;
    };

    // Static mode has no loop and a frozen clock, so a pointer over it gets one
    // vortex at the contact point, aged into its strongest moment.
    const staticPoint = () => {
      vort.fill(-1);
      vortHead = 0;
      vortSign = 1;
      pushVort(ptrX, ptrY, STATIC_TIME - 0.5, Math.max(0, stir) * Math.min(cssW, cssH) * 0.32);
      draw();
    };
    // Static mode carries no loop, so a pointermove is the only thing that can
    // schedule a frame — and a pointer device reporting at 120Hz+ would
    // otherwise buy a full-resolution draw PER EVENT, several per vsync, all
    // but the last of them thrown away unseen. Coalesce to one draw per frame,
    // which is the most a display can show anyway.
    let staticRaf = 0;
    const staticPointSoon = () => {
      if (staticRaf) return;
      staticRaf = requestAnimationFrame(() => {
        staticRaf = 0;
        staticPoint();
      });
    };

    const setTarget = (e: PointerEvent) => {
      syncRect();
      // the last coalesced point is the pointer's true current position; the
      // event's own coordinates can be a frame stale on a high-rate device
      const co = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : null;
      const last = co && co.length > 0 ? co[co.length - 1] : e;
      tgtX = last.clientX - rectLeft;
      tgtY = last.clientY - rectTop;
    };

    // entering, pressing, or coming back after a gap teleports the smoothed
    // position instead of easing to it — otherwise re-entry drags a row of
    // vortices across everything between where the pointer left and came back
    const snapPointer = () => {
      ptrX = tgtX;
      ptrY = tgtY;
      // a teleport carries no velocity, and a stale estimate would extrapolate
      // the head off along whatever direction the pointer had before it left
      velX = 0;
      velY = 0;
      lastTgtX = tgtX;
      lastTgtY = tgtY;
      sampleX = tgtX;
      sampleY = tgtY;
      lastSampleT = simTime;
      havePointer = true;
    };

    const onPointerEnter = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      if (staticMode) staticPoint();
    };
    const onPointerLeave = () => {
      havePointer = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      setTarget(e);
      if (!havePointer) {
        // no enter fired: the surface appeared under a resting pointer, or a
        // touch was lifted and put back down
        snapPointer();
      }
      if (staticMode) {
        ptrX = tgtX;
        ptrY = tgtY;
        staticPointSoon();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      if (staticMode) {
        staticPoint();
        return;
      }
      // a press drops one full-strength core at the contact point
      pushVort(tgtX, tgtY, simTime, Math.max(0, stir) * Math.min(cssW, cssH) * 0.4);
    };
    const onPointerUp = (e: PointerEvent) => {
      // a lifted touch or pen has no position any more, and no pointerleave is
      // coming: without this the field keeps stirring after one tap
      if (e.pointerType !== "mouse") havePointer = false;
    };
    const onPointerCancel = () => {
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
    // stale here and re-read it once, on the next pointer event, instead of
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

    // pause when scrolled out of view — a full-bleed shader off-screen is the
    // most expensive idle thing a page can carry
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

    // polled instead of made an effect dependency: that would tear down and
    // recreate the whole GL context to change a boolean
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
      if (staticRaf) cancelAnimationFrame(staticRaf);
      sleep();
      surface.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billows, speed, turbulence, strata, stir]);

  return (
    <div
      ref={wrapRef}
      data-shear-billow={uid}
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

ShearBillow.displayName = "ShearBillow";
