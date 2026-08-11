"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// DyeWhorl — a full-bleed tank of still fluid with ink injected into it.
//
// This is a real incompressible fluid solver, not a field visualisation: a
// GPU Navier-Stokes step on a coarse staggered-in-spirit grid (semi-Lagrangian
// advection, vorticity confinement, divergence, warm-started Jacobi pressure
// projection, gradient subtraction) whose velocity field then transports a
// separate, much finer scalar dye field. Nothing on screen is a particle or a
// streak — every pixel is the density of ink at that point, so the image reads
// as volume: billowing plumes with dense cores, sheets that thin as they
// stretch, tendrils shearing off the shoulders, and a slow dissipation into
// haze at the frame's edges.
//
// WHY IT IS ALIVE WITH NOBODY TOUCHING IT. Three mechanisms, and the second is
// the one that produces the threading:
//   1. Five drifting injectors, one anchored in each region of the frame,
//      trail ink continuously along slow local orbits, and a one-shot drop
//      lands every couple of seconds with the momentum of the fall behind it
//      — the moment a bead of ink hits water.
//   2. Density-driven buoyancy taken against a LOCAL mean rather than against
//      zero. Ink is heavier than the fluid, so it sinks; but a constant
//      downward pull on all dye simply sediments the entire field into the
//      bottom of the frame within half a minute and leaves a flat layer.
//      Measuring the excess against a wide 4-tap neighbourhood average makes
//      the force vanish inside a uniform patch and survive only at the
//      interface — which is exactly the Rayleigh-Taylor instability, and it is
//      what grows fingers out of the underside of a plume instead of moving
//      the plume.
//   3. A divergence-free curl-noise body force stirs the whole tank at low
//      frequency, so even the quiet corners are in motion.
//
// The dye advection is MacCormack-corrected (forward step, backward step, half
// the error added back, clamped to the source cell's neighbourhood so the
// correction cannot overshoot into a new extremum). Plain semi-Lagrangian
// advection at this grid size dissipates a filament into a soft blur within a
// couple of seconds; the correction is the difference between ink that threads
// and ink that fogs.
//
// PALETTE. Ink has no hue here — density, value and edge are the only cues, so
// the ramp does all the work. Unlike a reflective surface, which spans
// black-to-white in both themes, ink departs from the page in ONE direction:
// light ink in dark fluid, dark ink in pale fluid. So this genuinely inverts,
// and the two ramps are written separately rather than derived from one with a
// bias term. Light is the harder case — thin dark ink over a pale ground reads
// as dirt unless the low end is pushed down hard (u_gamma) — so its gamma and
// stop spacing are tuned apart from dark's. Every stop comes from
// --background, --foreground, --ns-muted and --border via getComputedStyle,
// re-read on a documentElement class MutationObserver. --ns-accent is
// interaction-only: it tints the freshness channel, which nothing but the
// pointer ever writes.
// ---------------------------------------------------------------------------

export interface DyeWhorlProps {
  /** Overall simulation rate. @default 1 */
  speed?: number;
  /** Ink injected per second by the ambient sources, 0..2. @default 1 */
  density?: number;
  /** How hard the pointer stirs the fluid, 0..2. @default 1 */
  stir?: number;
  /** Freezes the tank on a fully developed still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the tank — eyebrow, headline, CTA. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// Pointer smoothing. Lifted from weld-pool's model, and the reasoning carries
// over unchanged: a plain exponential follower has a steady-state error of
// exactly v*tau under constant velocity, so laying the stir down at the
// followed position makes the fluid respond LATE — a worse fault than the
// beading the smoothing was fixing, because the eye reads lateness as the
// surface ignoring it. Extrapolating the target one tau ahead cancels that
// term algebraically, leaving the smoothing to do only what it should: absorb
// direction changes and interpolate between events sparser than frames.
const POINTER_TAU = 0.012;
const VEL_TAU = 0.06;
const LEAD_MAX = 26;
// Stir samples are deposited by distance with a one-frame time ceiling, so the
// injection cadence is the DISPLAY's 60Hz and not the pointer event rate. A
// deposit every other frame reads as lag even when the frame time is a flat
// 16.7ms, which is how the same bug hid in weld-pool for two passes.
const SAMPLE_SPACING = 11;
const SAMPLE_MAX_GAP = 0.016;
const MAX_SUBSAMPLES = 6;

// Splat slots shared by the force pass and the dye pass: 5 ambient injectors,
// 1 drop, and up to 6 pointer sub-samples per frame.
//
// Five, not three, and the count is a composition decision rather than a
// physics one: three sources on a 1440x900 frame leave whole thirds of it
// empty for minutes at a time, and empty space on a full-bleed field reads as
// a component that has not loaded. Five paths, phase-offset by the golden
// angle so no two ever fall into a repeating arrangement, keep ink somewhere
// in every region while each one carries less of the total.
const SPLATS = 12;
const AMBIENT = 5;
const DROP_SLOT = 5;
const PTR_BASE = 6;

const DROP_MIN = 1.5; // s between drops
const DROP_JITTER = 1.7;

// One anchor per ambient source, spread so no third of the frame is more than
// a plume's width from ink. Deliberately off-grid: an even grid of five reads
// as a pattern the moment two of them line up.
const ANCHORS = [0.12, 0.66, 0.34, 0.22, 0.53, 0.82, 0.74, 0.34, 0.92, 0.7];

const VERT_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Velocity is stored in GRID CELLS PER SECOND, never in uv/s. The sim grid is
// cut to the container's aspect, so a cell is very nearly square in screen
// space and the metric is isotropic — curl, divergence and the pressure
// Laplacian are all written with dx = 1 and a vortex comes out round. In uv
// units every one of those operators would be silently anisotropic and the
// whorls would come out as ellipses stretched with the window.
const SPLAT_UNIFORMS = `
uniform vec4 u_sp[${SPLATS}];  // xy = uv centre, z = radius (uv-x units), w = dye amount
uniform vec4 u_sf[${SPLATS}];  // xy = force (cells/s), z = accent amount, w = unused
uniform float u_aspect;

float splatFall(vec2 uv, vec2 c, float r) {
  vec2 d = (uv - c) * vec2(u_aspect, 1.0);
  return exp(-dot(d, d) / max(1e-5, r * r));
}`;

const ADVECT_VEL_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_vel;
uniform vec2 u_texel;
uniform float u_dt;
uniform float u_diss;
void main() {
  vec2 v = texture(u_vel, v_uv).xy;
  vec2 src = v_uv - u_dt * v * u_texel;
  fragColor = vec4(texture(u_vel, src).xy * u_diss, 0.0, 1.0);
}`;

// One pass carrying every body force, so the sim never pays a program switch
// for a term that costs four taps. Vorticity confinement is computed inline
// from the velocity field rather than through a separate curl target: at this
// grid size the twenty extra fetches are far cheaper than two more full-screen
// passes plus their FBO binds.
const FORCE_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_vel;
uniform sampler2D u_dye;
uniform vec2 u_texel;
uniform float u_dt;
uniform float u_time;
uniform float u_curlAmt;
uniform float u_buoy;
uniform float u_ambient;
${SPLAT_UNIFORMS}

float curlAt(vec2 uv) {
  float r = texture(u_vel, uv + vec2(u_texel.x, 0.0)).y;
  float l = texture(u_vel, uv - vec2(u_texel.x, 0.0)).y;
  float t = texture(u_vel, uv + vec2(0.0, u_texel.y)).x;
  float b = texture(u_vel, uv - vec2(0.0, u_texel.y)).x;
  return 0.5 * ((r - l) - (t - b));
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

float fbm(vec2 p) {
  return vnoise(p) * 0.62 + vnoise(p * 2.13 + 7.3) * 0.28;
}

void main() {
  vec2 v = texture(u_vel, v_uv).xy;

  // --- vorticity confinement: push energy back into the whorls the advection
  // step numerically bled away, which is what keeps tendrils curling instead
  // of straightening out into sheets
  float c = curlAt(v_uv);
  float cr = abs(curlAt(v_uv + vec2(u_texel.x, 0.0)));
  float cl = abs(curlAt(v_uv - vec2(u_texel.x, 0.0)));
  float ct = abs(curlAt(v_uv + vec2(0.0, u_texel.y)));
  float cb = abs(curlAt(v_uv - vec2(0.0, u_texel.y)));
  vec2 g = vec2(cr - cl, ct - cb) * 0.5;
  float gl = length(g);
  if (gl > 1e-5) {
    vec2 n = g / gl;
    v += vec2(n.y, -n.x) * c * u_curlAmt * u_dt;
  }

  // --- buoyancy against a LOCAL mean. Ink is denser than the fluid, so the
  // excess sinks; taken against a wide neighbourhood average the force is zero
  // inside a uniform patch and non-zero only across an interface, which grows
  // fingers off the underside of a plume rather than dragging the whole field
  // to the floor. Against a fixed zero the tank sediments in ~30s.
  float wide = 6.0;
  float d0 = texture(u_dye, v_uv).x;
  float dAvg = 0.25 * (
    texture(u_dye, v_uv + vec2(u_texel.x * wide, 0.0)).x +
    texture(u_dye, v_uv - vec2(u_texel.x * wide, 0.0)).x +
    texture(u_dye, v_uv + vec2(0.0, u_texel.y * wide)).x +
    texture(u_dye, v_uv - vec2(0.0, u_texel.y * wide)).x
  );
  float excess = d0 - dAvg;
  // the lateral term is the symmetry break: a perfectly horizontal interface
  // is a stable equilibrium under a purely vertical force and would never
  // finger at all
  v.y -= excess * u_buoy * u_dt;
  v.x += excess * u_buoy * 0.22 * u_dt * (vnoise(v_uv * 9.0 + u_time * 0.15) - 0.5);

  // --- divergence-free curl-noise stirring, from the analytic perpendicular
  // gradient of a scalar potential, so it cannot fight the projection step
  vec2 q = v_uv * vec2(u_aspect, 1.0) * 1.7 + vec2(u_time * 0.031, -u_time * 0.024);
  float e = 0.035;
  float px = fbm(q + vec2(e, 0.0)) - fbm(q - vec2(e, 0.0));
  float py = fbm(q + vec2(0.0, e)) - fbm(q - vec2(0.0, e));
  v += vec2(py, -px) / (2.0 * e) * u_ambient * u_dt;

  // --- injectors, drop, pointer
  for (int i = 0; i < ${SPLATS}; i++) {
    if (u_sp[i].z <= 0.0) continue;
    v += u_sf[i].xy * splatFall(v_uv, u_sp[i].xy, u_sp[i].z) * u_dt;
  }

  // --- soft walls. Full-bleed means the frame edge is a crop, not a boundary,
  // but without this the tank empties itself into the margins and the ambient
  // stirring has nothing left to stir.
  vec2 e2 = min(v_uv, 1.0 - v_uv);
  float wall = smoothstep(0.0, 0.045, min(e2.x, e2.y));
  v *= mix(0.86, 1.0, wall);

  fragColor = vec4(v, 0.0, 1.0);
}`;

const DIVERGENCE_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_vel;
uniform vec2 u_texel;
void main() {
  float r = texture(u_vel, v_uv + vec2(u_texel.x, 0.0)).x;
  float l = texture(u_vel, v_uv - vec2(u_texel.x, 0.0)).x;
  float t = texture(u_vel, v_uv + vec2(0.0, u_texel.y)).y;
  float b = texture(u_vel, v_uv - vec2(0.0, u_texel.y)).y;
  fragColor = vec4(0.5 * ((r - l) + (t - b)), 0.0, 0.0, 1.0);
}`;

const JACOBI_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_pressure;
uniform sampler2D u_div;
uniform vec2 u_texel;
void main() {
  float r = texture(u_pressure, v_uv + vec2(u_texel.x, 0.0)).x;
  float l = texture(u_pressure, v_uv - vec2(u_texel.x, 0.0)).x;
  float t = texture(u_pressure, v_uv + vec2(0.0, u_texel.y)).x;
  float b = texture(u_pressure, v_uv - vec2(0.0, u_texel.y)).x;
  float d = texture(u_div, v_uv).x;
  fragColor = vec4((l + r + b + t - d) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADSUB_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_pressure;
uniform sampler2D u_vel;
uniform vec2 u_texel;
void main() {
  float r = texture(u_pressure, v_uv + vec2(u_texel.x, 0.0)).x;
  float l = texture(u_pressure, v_uv - vec2(u_texel.x, 0.0)).x;
  float t = texture(u_pressure, v_uv + vec2(0.0, u_texel.y)).x;
  float b = texture(u_pressure, v_uv - vec2(0.0, u_texel.y)).x;
  vec2 v = texture(u_vel, v_uv).xy - 0.5 * vec2(r - l, t - b);
  fragColor = vec4(v, 0.0, 1.0);
}`;

// Half of the MacCormack pair: a plain semi-Lagrangian step, run once forward
// and once backward. u_dir flips the sign so one program serves both.
const DYE_ADVECT_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_src;
uniform sampler2D u_vel;
uniform vec2 u_simTexel;
uniform float u_dt;
uniform float u_dir;
void main() {
  vec2 v = texture(u_vel, v_uv).xy;
  vec2 src = v_uv - u_dir * u_dt * v * u_simTexel;
  fragColor = vec4(texture(u_src, src).xy, 0.0, 1.0);
}`;

// The MacCormack correction plus every dye source, in one pass.
//
// phi_new = phi_fwd + 0.5 * (phi - phi_back), clamped to the min/max of the
// four cells the backtrace actually landed between. The clamp is not optional:
// unclamped, the correction is an antidiffusion term and it manufactures new
// extrema at every sharp interface — the filament edges ring, then go negative,
// then the ringing advects and the whole field speckles. Clamped, the same term
// buys back most of the detail plain advection throws away, which is the entire
// reason a filament here stays a filament for ten seconds instead of blurring
// into fog in two.
const DYE_RESOLVE_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_src;    // phi at t
uniform sampler2D u_fwd;    // advect(phi, +dt)
uniform sampler2D u_back;   // advect(fwd, -dt)
uniform sampler2D u_vel;
uniform vec2 u_texel;
uniform vec2 u_simTexel;
uniform float u_dt;
uniform float u_diss;
uniform float u_accentDiss;
uniform float u_correct;
${SPLAT_UNIFORMS}

void main() {
  vec2 fwd = texture(u_fwd, v_uv).xy;
  vec2 phi = texture(u_src, v_uv).xy;
  vec2 back = texture(u_back, v_uv).xy;
  vec2 outv = fwd + 0.5 * (phi - back) * u_correct;

  // clamp against the neighbourhood the backtrace sampled
  vec2 v = texture(u_vel, v_uv).xy;
  vec2 src = v_uv - u_dt * v * u_simTexel;
  vec2 a = texture(u_src, src + vec2(u_texel.x, u_texel.y)).xy;
  vec2 b = texture(u_src, src + vec2(-u_texel.x, u_texel.y)).xy;
  vec2 c = texture(u_src, src + vec2(u_texel.x, -u_texel.y)).xy;
  vec2 d = texture(u_src, src + vec2(-u_texel.x, -u_texel.y)).xy;
  vec2 lo = min(min(a, b), min(c, d));
  vec2 hi = max(max(a, b), max(c, d));
  outv = clamp(outv, lo, hi);

  outv.x *= u_diss;
  outv.y *= u_accentDiss;

  for (int i = 0; i < ${SPLATS}; i++) {
    if (u_sp[i].z <= 0.0) continue;
    float f = splatFall(v_uv, u_sp[i].xy, u_sp[i].z);
    outv.x += u_sp[i].w * f;
    outv.y += u_sf[i].z * f;
  }

  // A ceiling on density, which is a compositional constraint and not a
  // physical one. Without it a source sitting in slow water piles up an
  // unbounded pool that renders as a flat black hole with no internal
  // structure — the opposite of ink, which is legible precisely because even
  // its dense core stays modulated. Capping just above the top ramp stop lets
  // the core saturate while the structure around it keeps reading.
  fragColor = vec4(clamp(outv, vec2(0.0), vec2(1.05, 1.0)), 0.0, 1.0);
}`;

// Display-resolution pass. The only thing that runs per screen pixel.
const RENDER_SRC = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_dye;
uniform vec2 u_dyeTexel;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform vec3 u_accent;
uniform float u_gamma;
uniform float u_rim;
uniform float u_ink;

vec3 ramp(float x) {
  vec3 c = mix(u_c0, u_c1, smoothstep(0.0, 0.22, x));
  c = mix(c, u_c2, smoothstep(0.18, 0.48, x));
  c = mix(c, u_c3, smoothstep(0.45, 0.78, x));
  c = mix(c, u_c4, smoothstep(0.76, 1.0, x));
  return c;
}

void main() {
  vec2 s = texture(u_dye, v_uv).xy;
  float d = s.x;

  // Edge term, deliberately SUBORDINATE. Density carries the image; the
  // gradient only puts a thin lift on the shoulder of a plume so a sheet
  // seen edge-on separates from the one behind it. Pushed any harder this
  // stops being ink and becomes a web of bright lines, which is a different
  // component that already exists twice in this registry.
  float dr = texture(u_dye, v_uv + vec2(u_dyeTexel.x, 0.0)).x;
  float dl = texture(u_dye, v_uv - vec2(u_dyeTexel.x, 0.0)).x;
  float dt = texture(u_dye, v_uv + vec2(0.0, u_dyeTexel.y)).x;
  float db = texture(u_dye, v_uv - vec2(0.0, u_dyeTexel.y)).x;
  float grad = length(vec2(dr - dl, dt - db)) * 0.5;

  float cov = 1.0 - exp(-d * u_ink);
  cov = pow(clamp(cov, 0.0, 1.0), u_gamma);
  cov = clamp(cov + grad * u_rim, 0.0, 1.0);

  vec3 col = ramp(cov);

  // Freshness: written by the pointer and nothing else, advected by the same
  // velocity field as the density so the tint travels with the ink it marks
  // rather than detaching from it.
  //
  // Deliberately weak. At 0.55 mix and a 2.4 gain this saturated whole plumes
  // into flat blue, which stops reading as tinted ink and starts reading as
  // coloured dye — a different, worse component, and the one the palette rule
  // exists to prevent. The accent has to say "you just touched this" without
  // becoming the subject, so it is a tint on already-bright ink, capped well
  // short of the pure token.
  // The tint has to survive an inverted ramp, and the fix is the target
  // colour, not the coverage window. Fresh ink is the DENSEST ink, which in
  // light means near-black — and mixing the raw token into near-black is a
  // muddy navy that reads as a dirty patch, while windowing the tint away from
  // the dense core (tried) simply deletes it in both themes. So the accent is
  // pre-adapted per theme on the CPU: lifted toward white for dark ink on a
  // dark ground, let down toward --background for dark ink on a pale one. Same
  // token, same cue, legible either way.
  float fresh = clamp(s.y * 1.05, 0.0, 1.0) * smoothstep(0.05, 0.28, cov);
  col = mix(col, mix(col, u_accent, 0.42), fresh);

  // a mild vignette toward the empty-fluid stop keeps the crop from competing
  // with whatever the caller overlays
  vec2 vp = v_uv - 0.5;
  float vig = smoothstep(0.42, 0.95, length(vp * vec2(1.0, 1.25)) * 1.6);
  col = mix(col, u_c0, vig * 0.30);

  // the ramp's low end is a very long, very flat gradient across a full-bleed
  // field, which is exactly where 8-bit banding is visible; one hash of
  // sub-LSB noise costs nothing and removes it
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.0055;

  fragColor = vec4(col, 1.0);
}`;

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

type FBO = {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
  texel: [number, number];
};

type Double = { read: FBO; write: FBO; swap: () => void };

// ---------------------------------------------------------------------------
// Solver — the GL host. It owns the context, the programs, the ping-pong
// targets and the fullscreen blit, and knows nothing about ink: the component
// drives it one pass at a time. Kept inside this file rather than shared, so
// the component stays a single-folder drop-in.
// ---------------------------------------------------------------------------
class Solver {
  gl: WebGL2RenderingContext | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private programs: WebGLProgram[] = [];
  private locs = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private fbos: FBO[] = [];
  private active: WebGLProgram | null = null;
  constructor(private canvas: HTMLCanvasElement) {}

  init(): boolean {
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) return false;
    this.gl = gl;
    // R16F/RG16F are only colour-renderable behind one of these. Nothing here
    // works without it, and the encode-into-RGBA8 alternative costs more than
    // it is worth for the handful of drivers that would need it — so the
    // component renders nothing and the caller's children sit on --background.
    const ext =
      gl.getExtension("EXT_color_buffer_float") ??
      gl.getExtension("EXT_color_buffer_half_float");
    if (!ext) return false;
    gl.getExtension("OES_texture_float_linear");

    this.buffer = gl.createBuffer();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    return true;
  }

  program(frag: string): WebGLProgram | null {
    const gl = this.gl;
    if (!gl) return null;
    const vs = this.compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this.compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    // location 0 is what the single VAO is wired to, for every program
    gl.bindAttribLocation(p, 0, "a_pos");
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      gl.deleteProgram(p);
      return null;
    }
    this.programs.push(p);
    this.locs.set(p, new Map());
    return p;
  }

  private compile(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  use(p: WebGLProgram) {
    this.gl?.useProgram(p);
    this.active = p;
  }

  private loc(name: string): WebGLUniformLocation | null {
    const p = this.active;
    if (!p || !this.gl) return null;
    const map = this.locs.get(p)!;
    if (!map.has(name)) map.set(name, this.gl.getUniformLocation(p, name));
    return map.get(name) ?? null;
  }

  f(n: string, x: number) {
    this.gl?.uniform1f(this.loc(n), x);
  }
  v2(n: string, x: number, y: number) {
    this.gl?.uniform2f(this.loc(n), x, y);
  }
  v3(n: string, c: RGB) {
    this.gl?.uniform3f(this.loc(n), c[0], c[1], c[2]);
  }
  v4a(n: string, data: Float32Array) {
    this.gl?.uniform4fv(this.loc(n), data);
  }
  tex(n: string, unit: number, t: WebGLTexture) {
    const gl = this.gl;
    if (!gl) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.uniform1i(this.loc(n), unit);
  }

  makeFBO(w: number, h: number, internal: number, format: number): FBO | null {
    const gl = this.gl!;
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fbo);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return null;
    }
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const f: FBO = { tex, fbo, w, h, texel: [1 / w, 1 / h] };
    this.fbos.push(f);
    return f;
  }

  makeDouble(w: number, h: number, internal: number, format: number): Double | null {
    const a = this.makeFBO(w, h, internal, format);
    const b = this.makeFBO(w, h, internal, format);
    if (!a || !b) return null;
    const d: Double = {
      read: a,
      write: b,
      swap: () => {
        const t = d.read;
        d.read = d.write;
        d.write = t;
      },
    };
    return d;
  }

  blit(target: FBO | null) {
    const gl = this.gl;
    if (!gl) return;
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Free one target. Used so a resize can build its replacements, copy the
   *  live field across and only then release the old ones. */
  free(f: FBO | null) {
    const gl = this.gl;
    if (!gl || !f) return;
    gl.deleteTexture(f.tex);
    gl.deleteFramebuffer(f.fbo);
    this.fbos = this.fbos.filter((x) => x !== f);
  }

  freeDouble(d: Double | null) {
    if (!d) return;
    this.free(d.read);
    this.free(d.write);
  }

  dropTargets() {
    const gl = this.gl;
    if (!gl) return;
    for (const f of this.fbos) {
      gl.deleteTexture(f.tex);
      gl.deleteFramebuffer(f.fbo);
    }
    this.fbos = [];
  }

  destroy() {
    const gl = this.gl;
    if (!gl) return;
    this.dropTargets();
    for (const p of this.programs) gl.deleteProgram(p);
    this.programs = [];
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.buffer = null;
    this.vao = null;
    this.gl = null;
  }
}

// A fluid has no meaningful t=0: an empty tank is an empty frame. So the sim is
// spun up before the first paint, in every mode, and the reduced-motion still
// frame is simply a longer spin-up that is then never stepped again. The count
// is a wall-clock budget in disguise — 260 coarse steps cost ~60ms on the
// machines we can measure, which is under one frame of the mount it hides in.
const WARMUP_STEPS = 260;
const STATIC_STEPS = 380;
const FIXED_DT = 1 / 60;

export function DyeWhorl({
  speed = 1,
  density = 1,
  stir = 1,
  paused = false,
  children,
  className = "",
  style,
}: DyeWhorlProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const densityRef = useRef(density);
  densityRef.current = density;
  const stirRef = useRef(stir);
  stirRef.current = stir;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const solver = new Solver(canvas);
    if (!solver.init()) return;
    const gl = solver.gl!;

    const pAdvectVel = solver.program(ADVECT_VEL_SRC);
    const pForce = solver.program(FORCE_SRC);
    const pDiv = solver.program(DIVERGENCE_SRC);
    const pJacobi = solver.program(JACOBI_SRC);
    const pGrad = solver.program(GRADSUB_SRC);
    const pDyeAdvect = solver.program(DYE_ADVECT_SRC);
    const pDyeResolve = solver.program(DYE_RESOLVE_SRC);
    const pRender = solver.program(RENDER_SRC);
    if (
      !pAdvectVel || !pForce || !pDiv || !pJacobi || !pGrad ||
      !pDyeAdvect || !pDyeResolve || !pRender
    ) {
      solver.destroy();
      return;
    }

    let raf = 0;
    let running = false;
    let staticMode = false;
    let disposed = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let simW = 0;
    let simH = 0;
    let simTime = 0;
    let lastMs = performance.now();

    // Quality ladder. Tier 0 is what every machine we can measure actually
    // runs; the lower tiers exist for the ones we cannot — a weak integrated
    // GPU, a 6K panel, a laptop throttling on battery. Sim resolution is the
    // LAST thing to go: it is what makes the tendrils fine. Jacobi iterations
    // go first (the flow looks near-identical at 10 as at 18 — incompressibility
    // reads far less than filament width), then the MacCormack correction,
    // then dye resolution, then the display scale.
    const TIERS = [
      { sim: 208, dye: 768, jacobi: 18, correct: 1, scale: 1 },
      { sim: 208, dye: 640, jacobi: 12, correct: 1, scale: 1 },
      { sim: 176, dye: 512, jacobi: 10, correct: 0, scale: 0.8 },
      { sim: 144, dye: 384, jacobi: 8, correct: 0, scale: 0.65 },
    ];
    const BUDGET_OVER = 26; // ms/frame that counts as missing the budget
    let tier = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;

    let velocity: Double | null = null;
    let dye: Double | null = null;
    let pressure: Double | null = null;
    let divergence: FBO | null = null;
    let dyeTmpA: FBO | null = null;
    let dyeTmpB: FBO | null = null;

    // splat slots, shared by the force pass and the dye pass
    const sp = new Float32Array(SPLATS * 4);
    const sf = new Float32Array(SPLATS * 4);

    let c0: RGB = [0.04, 0.04, 0.04];
    let c1: RGB = [0.14, 0.14, 0.14];
    let c2: RGB = [0.4, 0.4, 0.4];
    let c3: RGB = [0.78, 0.78, 0.78];
    let c4: RGB = [1, 1, 1];
    let accent: RGB = [0, 0.42, 1];
    let gamma = 1;
    let rim = 1;
    let inkK = 1;

    // Two ramps, written apart on purpose. A reflective surface spans
    // black-to-white in both themes and only shifts its distribution; ink does
    // not — it departs from the page in one direction, so this inverts.
    //
    // Light is the harder half and it took two passes. The first tuning pushed
    // its low end down hard (gamma 1.55) on the theory that thin dark ink over
    // a pale ground reads as dirt. It does not — it reads as a washed-out
    // component, which is worse, because the same field that was dense and
    // volumetric in dark went nearly invisible over half the frame. The real
    // asymmetry is smaller than it looks: light needs slightly MORE ink per
    // unit density (2.90 vs 2.50) and only a little more toe (1.18 vs 1.08),
    // and its haze stop has to leave --background early or the low half of the
    // range does nothing at all.
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
        // light ink in dark fluid
        c0 = mixRGB(bg, black, 0.35);
        c1 = mixRGB(bg, border, 0.9);
        c2 = mixRGB(border, muted, 0.75);
        c3 = mixRGB(muted, fg, 0.72);
        c4 = mixRGB(fg, white, 0.55);
        accent = mixRGB(accent, white, 0.2);
        gamma = 1.08;
        rim = 2.6;
        inkK = 2.5;
      } else {
        // dark ink in pale fluid
        c0 = bg;
        c1 = mixRGB(bg, muted, 0.3);
        c2 = mixRGB(muted, bg, 0.22);
        c3 = mixRGB(fg, muted, 0.24);
        c4 = mixRGB(fg, black, 0.55);
        accent = mixRGB(accent, bg, 0.5);
        gamma = 1.18;
        rim = 2.2;
        inkK = 2.9;
      }
    };
    readColors();

    // ---- ambient sources -------------------------------------------------
    // Three injectors trailing ink along slow lissajous paths, each with a jet
    // whose heading rotates on its own period, plus a one-shot drop every few
    // seconds. Together they are why the tank never runs out of ink and never
    // settles into a single steady plume.
    let nextDrop = 0.7;
    let dropSeed = 3;

    const clearSplats = () => {
      sp.fill(0);
      sf.fill(0);
    };

    const setSplat = (
      i: number,
      x: number,
      y: number,
      r: number,
      amount: number,
      fx: number,
      fy: number,
      acc: number
    ) => {
      sp[i * 4] = x;
      sp[i * 4 + 1] = y;
      sp[i * 4 + 2] = r;
      sp[i * 4 + 3] = amount;
      sf[i * 4] = fx;
      sf[i * 4 + 1] = fy;
      sf[i * 4 + 2] = acc;
    };

    const updateSources = (dt: number) => {
      const amt = Math.max(0, densityRef.current);
      for (let i = 0; i < AMBIENT; i++) {
        const ph = i * 2.399963; // golden angle: no two paths ever synchronise
        const sp1 = 0.048 + i * 0.014;
        // Anchored orbits, not five samples of one global lissajous. Sharing a
        // path shape means every source is somewhere near the middle at the
        // same time and the corners stay empty for minutes — the first build
        // did exactly that. An anchor each plus a local orbit makes coverage a
        // property of the layout rather than of the phases happening to spread.
        const x = ANCHORS[i * 2] + 0.12 * Math.sin(simTime * sp1 + ph);
        const y = ANCHORS[i * 2 + 1] + 0.15 * Math.sin(simTime * sp1 * 0.78 + ph * 1.7);
        const head = simTime * (0.19 + i * 0.05) + ph;
        const push = 58 + 24 * Math.sin(simTime * 0.31 + ph);
        setSplat(
          i,
          x,
          y,
          0.05 + 0.016 * Math.sin(simTime * 0.23 + ph),
          0.46 * amt * dt,
          Math.cos(head) * push * dt * 60,
          Math.sin(head) * push * dt * 60,
          0
        );
      }
      // the drop: a bead of ink hitting the surface, with the momentum of the
      // fall behind it. One frame of very high amplitude, so it blooms rather
      // than seeps.
      nextDrop -= dt;
      if (nextDrop <= 0) {
        dropSeed = (dropSeed * 1103515245 + 12345) & 0x7fffffff;
        const r1 = ((dropSeed >> 7) & 1023) / 1023;
        dropSeed = (dropSeed * 1103515245 + 12345) & 0x7fffffff;
        const r2 = ((dropSeed >> 7) & 1023) / 1023;
        dropSeed = (dropSeed * 1103515245 + 12345) & 0x7fffffff;
        const r3 = ((dropSeed >> 7) & 1023) / 1023;
        const ang = r3 * Math.PI * 2;
        setSplat(
          DROP_SLOT,
          0.12 + r1 * 0.76,
          0.18 + r2 * 0.68,
          0.07 + r3 * 0.045,
          1.35 * amt,
          Math.cos(ang) * 300,
          Math.sin(ang) * 300 - 120,
          0
        );
        nextDrop = DROP_MIN + r1 * DROP_JITTER;
      }
    };

    // ---- pointer ---------------------------------------------------------
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
    let rectLeft = 0;
    let rectTop = 0;
    let rectDirty = true;

    const stepPointer = (dt: number) => {
      if (!havePointer || dt <= 0 || cssW < 2) return;
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

      const dx = ptrX - sampleX;
      const dy = ptrY - sampleY;
      const dist = Math.hypot(dx, dy);
      const gap = simTime - lastSampleT;
      if (dist < SAMPLE_SPACING && !(gap >= SAMPLE_MAX_GAP && dist > 0.5)) return;

      const n = Math.min(MAX_SUBSAMPLES, Math.max(1, Math.round(dist / SAMPLE_SPACING)));
      // the stir force is the pointer's own velocity, in sim cells/s, so the
      // fluid is pushed at the speed the hand is actually moving
      const sc = stirRef.current;
      const cellsPerPx = simW / Math.max(1, cssW);
      const fx = (dx / Math.max(1e-4, gap)) * cellsPerPx * 0.55 * sc;
      const fy = -(dy / Math.max(1e-4, gap)) * cellsPerPx * 0.55 * sc;
      const mag = Math.min(1, Math.hypot(fx, fy) / 120);
      for (let s = 1; s <= n; s++) {
        const f = s / n;
        const px = (sampleX + dx * f) / cssW;
        // uv v runs bottom-up; DOM y runs top-down
        const py = 1 - (sampleY + dy * f) / cssH;
        setSplat(
          PTR_BASE + (s - 1),
          px,
          py,
          0.035,
          (0.36 + 0.72 * mag) * sc * Math.max(0.25, densityRef.current) / n,
          fx / n,
          fy / n,
          (0.1 + 0.2 * mag) / n
        );
      }
      sampleX = ptrX;
      sampleY = ptrY;
      lastSampleT = simTime;
    };

    // ---- sim step --------------------------------------------------------
    const step = (dt: number) => {
      if (!velocity || !dye || !pressure || !divergence || !dyeTmpA || !dyeTmpB) return;
      const t = TIERS[tier];
      const simTexel = velocity.read.texel;
      const aspect = cssW / Math.max(1, cssH);

      // advect velocity
      solver.use(pAdvectVel);
      solver.tex("u_vel", 0, velocity.read.tex);
      solver.v2("u_texel", simTexel[0], simTexel[1]);
      solver.f("u_dt", dt);
      solver.f("u_diss", Math.exp(-dt * 0.16));
      solver.blit(velocity.write);
      velocity.swap();

      // body forces + vorticity confinement + splats
      solver.use(pForce);
      solver.tex("u_vel", 0, velocity.read.tex);
      solver.tex("u_dye", 1, dye.read.tex);
      solver.v2("u_texel", simTexel[0], simTexel[1]);
      solver.f("u_dt", dt);
      solver.f("u_time", simTime);
      solver.f("u_curlAmt", 24);
      solver.f("u_buoy", 46);
      solver.f("u_ambient", 8.5);
      solver.f("u_aspect", aspect);
      solver.v4a("u_sp", sp);
      solver.v4a("u_sf", sf);
      solver.blit(velocity.write);
      velocity.swap();

      // divergence
      solver.use(pDiv);
      solver.tex("u_vel", 0, velocity.read.tex);
      solver.v2("u_texel", simTexel[0], simTexel[1]);
      solver.blit(divergence);

      // pressure — warm-started from last frame, so a modest iteration count
      // still converges: the field it is solving barely changed
      solver.use(pJacobi);
      solver.v2("u_texel", simTexel[0], simTexel[1]);
      solver.tex("u_div", 1, divergence.tex);
      for (let i = 0; i < t.jacobi; i++) {
        solver.tex("u_pressure", 0, pressure.read.tex);
        solver.blit(pressure.write);
        pressure.swap();
      }

      solver.use(pGrad);
      solver.tex("u_pressure", 0, pressure.read.tex);
      solver.tex("u_vel", 1, velocity.read.tex);
      solver.v2("u_texel", simTexel[0], simTexel[1]);
      solver.blit(velocity.write);
      velocity.swap();

      // dye: MacCormack forward / backward, then resolve + inject
      const dyeTexel = dye.read.texel;
      solver.use(pDyeAdvect);
      solver.tex("u_vel", 1, velocity.read.tex);
      solver.v2("u_simTexel", simTexel[0], simTexel[1]);
      solver.f("u_dt", dt);
      solver.f("u_dir", 1);
      solver.tex("u_src", 0, dye.read.tex);
      solver.blit(dyeTmpA);
      if (t.correct > 0) {
        solver.f("u_dir", -1);
        solver.tex("u_src", 0, dyeTmpA.tex);
        solver.blit(dyeTmpB);
      }

      solver.use(pDyeResolve);
      solver.tex("u_src", 0, dye.read.tex);
      solver.tex("u_fwd", 1, dyeTmpA.tex);
      solver.tex("u_back", 2, t.correct > 0 ? dyeTmpB.tex : dyeTmpA.tex);
      solver.tex("u_vel", 3, velocity.read.tex);
      solver.v2("u_texel", dyeTexel[0], dyeTexel[1]);
      solver.v2("u_simTexel", simTexel[0], simTexel[1]);
      solver.f("u_dt", dt);
      solver.f("u_diss", Math.exp(-dt * 0.1));
      solver.f("u_accentDiss", Math.exp(-dt * 2.0));
      solver.f("u_correct", t.correct);
      solver.f("u_aspect", aspect);
      solver.v4a("u_sp", sp);
      solver.v4a("u_sf", sf);
      solver.blit(dye.write);
      dye.swap();
    };

    const render = () => {
      if (!dye) return;
      const dyeTexel = dye.read.texel;
      solver.use(pRender);
      solver.tex("u_dye", 0, dye.read.tex);
      solver.v2("u_dyeTexel", dyeTexel[0], dyeTexel[1]);
      solver.v3("u_c0", c0);
      solver.v3("u_c1", c1);
      solver.v3("u_c2", c2);
      solver.v3("u_c3", c3);
      solver.v3("u_c4", c4);
      solver.v3("u_accent", accent);
      solver.f("u_gamma", gamma);
      solver.f("u_rim", rim);
      solver.f("u_ink", inkK);
      solver.blit(null);
    };

    const advance = (dt: number) => {
      clearSplats();
      simTime += dt;
      updateSources(dt);
      stepPointer(dt);
      step(dt);
    };

    const spin = (steps: number) => {
      for (let i = 0; i < steps; i++) advance(FIXED_DT);
    };

    // ---- sizing ----------------------------------------------------------
    let allocated = false;

    const allocate = () => {
      if (cssW < 2 || cssH < 2 || !solver.gl) return;
      const t = TIERS[tier];
      const aspect = cssW / cssH;
      if (aspect >= 1) {
        simW = t.sim;
        simH = Math.max(48, Math.round(t.sim / aspect));
      } else {
        simH = t.sim;
        simW = Math.max(48, Math.round(t.sim * aspect));
      }
      const dyeW = aspect >= 1 ? t.dye : Math.max(96, Math.round(t.dye * aspect));
      const dyeH = aspect >= 1 ? Math.max(96, Math.round(t.dye / aspect)) : t.dye;

      // Build the replacements BEFORE releasing the old ones, so the live
      // field can be carried across. A resize that drops the targets and
      // re-seeds from empty is the difference between a hitch and a lock-up:
      // ResizeObserver fires on every step of a window drag, a cold seed is
      // 260 sim steps of roughly 300M fragments, and the ink the viewer was
      // watching disappears and rebuilds each time. Resampling costs two
      // full-screen copies and keeps the field continuous through the drag.
      const oldVel = velocity;
      const oldDye = dye;
      const nVel = solver.makeDouble(simW, simH, gl.RG16F, gl.RG);
      const nDye = solver.makeDouble(dyeW, dyeH, gl.RG16F, gl.RG);
      const nPressure = solver.makeDouble(simW, simH, gl.R16F, gl.RED);
      const nDiv = solver.makeFBO(simW, simH, gl.R16F, gl.RED);
      const nTmpA = solver.makeFBO(dyeW, dyeH, gl.RG16F, gl.RG);
      const nTmpB = solver.makeFBO(dyeW, dyeH, gl.RG16F, gl.RG);
      if (!nVel || !nDye || !nPressure || !nDiv || !nTmpA || !nTmpB) {
        solver.freeDouble(nVel);
        solver.freeDouble(nDye);
        solver.freeDouble(nPressure);
        solver.free(nDiv);
        solver.free(nTmpA);
        solver.free(nTmpB);
        return;
      }

      // the advection program with dt = 0 samples straight through, so it is
      // also the resampling blit — no second program for one line of work
      const carry = allocated && oldVel && oldDye;
      if (carry) {
        solver.use(pDyeAdvect);
        solver.v2("u_simTexel", 1, 1);
        solver.f("u_dt", 0);
        solver.f("u_dir", 1);
        solver.tex("u_vel", 1, oldVel!.read.tex);
        solver.tex("u_src", 0, oldVel!.read.tex);
        solver.blit(nVel.read);
        solver.tex("u_src", 0, oldDye!.read.tex);
        solver.blit(nDye.read);
      }

      solver.freeDouble(oldVel);
      solver.freeDouble(oldDye);
      solver.freeDouble(pressure);
      solver.free(divergence);
      solver.free(dyeTmpA);
      solver.free(dyeTmpB);

      velocity = nVel;
      dye = nDye;
      pressure = nPressure;
      divergence = nDiv;
      dyeTmpA = nTmpA;
      dyeTmpB = nTmpB;

      // A carried field needs only enough steps to re-project it onto the new
      // grid; a cold one needs a real warm-up, because a fluid has no
      // meaningful t = 0 and an empty tank is an empty frame. The clock is
      // never reset here — resetting it would restart every injector phase.
      const steps = carry ? 8 : staticMode ? STATIC_STEPS : WARMUP_STEPS;
      allocated = true;
      spin(steps);
      clearSplats();
      render();
    };

    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2) * TIERS[tier].scale;
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
      applyBacking();
      // a new size is a new cost, so the quality ladder starts over rather than
      // carrying a verdict earned at a different number of fragments
      if (changed) {
        tier = 0;
        overMs = 0;
        underMs = 0;
        upWindow = 8000;
        frameEma = 16.7;
        applyBacking();
        allocate();
      }
      render();
    };

    const applyTier = () => {
      applyBacking();
      allocate();
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      lastMs = nowMs;
      // clamped so a GC pause or a tab returning cannot teleport the fluid; a
      // long frame advances it by one clamped step instead
      const dt = Math.min(0.033, Math.max(0.001, rawMs / 1000)) * Math.max(0.05, speed);
      advance(dt);
      render();

      const clamped = Math.min(50, rawMs);
      frameEma += (clamped - frameEma) * (1 - Math.exp(-clamped / 120));
      if (frameEma > BUDGET_OVER) {
        overMs += clamped;
        underMs = 0;
      } else {
        underMs += clamped;
        overMs = 0;
      }
      // Every threshold is wall clock, never frames: a frame-counted gate is
      // backwards, because the slower the machine the longer it waits before
      // helping. Asymmetric, so a marginal machine cannot oscillate — drop
      // after ~1.8s of stutter, climb back only after a long clean stretch,
      // and double the wait on each failure so a transient recovers in 8s
      // while a genuinely slow machine stops probing within a few seconds.
      //
      // 1.8s and not 0.9s: the frame time this watches is the PAGE's, not this
      // component's, and at ~6ms of GPU work per frame the tank is almost
      // never what blew the budget. A burst of main-thread work next to it —
      // measured here with a screenshot pass, but an image decode or a layout
      // storm does the same — was enough to trip the shorter window and soften
      // a surface that was in fact running at a flat 60Hz.
      const down = overMs > 1800 && tier < TIERS.length - 1;
      const up = underMs > upWindow && tier > 0;
      if (down || up) {
        tier += down ? 1 : -1;
        if (down) upWindow = Math.min(64000, upWindow * 2);
        overMs = 0;
        underMs = 0;
        frameEma = 16.7;
        applyTier();
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

    // ---- pointer events --------------------------------------------------
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
      // the last coalesced point is the pointer's true current position; the
      // event's own coordinates can be a frame stale on a high-rate device
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
      sampleX = tgtX;
      sampleY = tgtY;
      lastSampleT = simTime;
      havePointer = true;
    };

    // A static frame has no loop to smooth in and a frozen clock, so a stir
    // there is one step of the sim under the pointer rather than a train.
    const staticStir = () => {
      if (cssW < 2) return;
      clearSplats();
      setSplat(
        PTR_BASE,
        tgtX / cssW,
        1 - tgtY / cssH,
        0.05,
        0.9 * Math.max(0.25, densityRef.current),
        0,
        0,
        0.2
      );
      step(FIXED_DT);
      clearSplats();
      render();
    };

    const onPointerEnter = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      if (staticMode) staticStir();
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
        staticStir();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      if (staticMode) {
        staticStir();
        return;
      }
      // a press drops a bead of ink at the contact point
      const ang = simTime * 2.7;
      setSplat(
        DROP_SLOT,
        tgtX / cssW,
        1 - tgtY / cssH,
        0.085,
        2.2 * Math.max(0.25, densityRef.current),
        Math.cos(ang) * 210,
        Math.sin(ang) * 210,
        0.3
      );
    };
    const onPointerUp = (e: PointerEvent) => {
      // a lifted touch or pen has no position any more and no pointerleave is
      // coming: without this the fluid stays stirred forever after one tap
      if (e.pointerType !== "mouse") {
        havePointer = false;
      }
    };
    const onPointerCancel = () => {
      havePointer = false;
    };

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
    staticMode = reduced || pausedRef.current;

    // Coalesced to one realloc per frame. ResizeObserver fires on every step of
    // a window drag, and each fire tears down six float targets and re-seeds
    // the field; handling them one-to-one turns a drag into a stall.
    let resizeRaf = 0;
    const ro = new ResizeObserver(() => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        resize();
      });
    });
    ro.observe(wrap);
    resize();
    if (cssW >= 2 && !velocity) allocate();

    const applyMode = () => {
      const wantStatic = reduced || pausedRef.current;
      if (wantStatic === staticMode && (wantStatic ? true : running)) return;
      staticMode = wantStatic;
      if (staticMode) {
        sleep();
        // a frozen fluid still has to be a developed one, so a pause spins the
        // sim on rather than freezing whatever half-formed frame was up
        spin(60);
        clearSplats();
        render();
      } else {
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    // pause when scrolled out of view — a full-bleed solver off-screen is the
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

    if (!staticMode) wake();
    else {
      clearSplats();
      render();
    }

    // polled rather than made an effect dependency: either would tear down and
    // recreate the whole GL context and every target to change a boolean
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
      if (!running) render();
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
      if (solver.init()) {
        resize();
        allocate();
        applyMode();
      }
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return () => {
      disposed = true;
      ro.disconnect();
      cancelAnimationFrame(resizeRaf);
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
      solver.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  return (
    <div
      ref={wrapRef}
      data-dye-whorl={uid}
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

DyeWhorl.displayName = "DyeWhorl";
