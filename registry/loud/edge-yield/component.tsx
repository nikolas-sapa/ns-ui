"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// EdgeYield — a full-bleed scanning electron micrograph: a packed micro-
// landscape of spore grains, rod crystals and filaments, imaged the way an SEM
// images it rather than the way a renderer lights it.
//
// The organising idea is that this is a DETECTOR SIMULATION, not a lighting
// model. There is no light source anywhere in the shader. One fragment shader
// evaluates a height field h(u) together with its ANALYTIC gradient — every
// primitive is a closed form whose slope is known, so the surface normal costs
// one field evaluation instead of three central-difference taps — and then
// feeds that normal through the two things that actually make an SEM image:
//
//   delta = sec(theta)   secondary-electron yield rises as the surface tilts
//                        away from the beam, because more of the interaction
//                        volume lies within escape depth of a free surface.
//                        This single term is the characteristic glowing rim,
//                        and it is not a fresnel approximation of it — it is
//                        the actual dependence, 1/n.z.
//   eta                  collection efficiency: what fraction of those
//                        electrons reach an Everhart-Thornley detector sitting
//                        off to one upper-left corner. Facets turned away from
//                        it are dim; anything with a grain between it and the
//                        detector is in a deep, hard shadow, found by a three-
//                        step horizon march reaching ~2 grain radii.
//
// Everything is in focus at once because nothing here has a lens — that
// extreme depth of field is a property of the technique, not a choice.
//
// On top of the specimen sits the ACQUISITION, all of it in screen space and
// none of it drifting with the stage, because a detector's faults belong to
// the instrument and not to the sample: a scan comb, per-line DC drift, sub-
// pixel line-to-line misregistration, horizontally correlated shot noise whose
// amplitude tracks sqrt(signal), charge streaking pulled along the fast axis,
// and a sweep line descending the frame. Lines above the sweep were acquired
// this pass and lines below it on the last one, so the stage's drift shears the
// picture very slightly across that line — the tear is what proves the image is
// being scanned rather than rendered.
//
// Palette: an SEM is natively greyscale because it maps electron yield to
// luminance, so monochrome here is the honest reading rather than a
// restriction. Five stops from --background, --foreground, --ns-muted and
// --border via getComputedStyle, re-read on a documentElement class mutation.
// The ramp's DIRECTION never inverts — yield always climbs toward light — but
// the exposure does: dark theme is the micrograph on the console, light theme
// is the same acquisition printed, with the substrate lifted to a paper
// mid-tone so the rims still have headroom to be the brightest thing in frame.
// Nothing in the frame is chromatic, including the beam spot: an accent tint
// under the pointer is the one mark that reads as a rendered glow sprite rather
// than as a dwell, and it is the fastest way to lose the electron-image read.
// The dwell is spent on signal and shot noise instead, which is what a real
// beam parked on a spot actually changes.
// ---------------------------------------------------------------------------

export interface EdgeYieldProps {
  /** Feature size. Higher = further in, fewer and larger grains. @default 1 */
  magnification?: number;
  /** How tightly the micro-landscape is packed. @default 1 */
  density?: number;
  /** Vertical exaggeration of the specimen, which drives the rim response. @default 1 */
  relief?: number;
  /** Shot-noise amplitude. 0 is a clean frame-averaged capture. @default 1 */
  noise?: number;
  /** Stage drift speed multiplier. @default 1 */
  speed?: number;
  /** Freezes acquisition on a composed still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the micrograph — eyebrow, subhead, CTA. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Pointer smoothing. A plain exponential follower has a steady-state error of
// exactly velocity*tau under constant velocity, so smoothing the stage that way
// would make the specimen lag the hand by a fixed distance — read by the eye as
// the instrument not responding rather than as damping. Extrapolating the
// target one tau ahead cancels that term algebraically: at constant velocity
// the stage sits under the cursor, and the smoothing is spent only on direction
// changes and on interpolating between events that arrived sparser than frames.
// LEAD_MAX caps the extrapolation so a teleporting pointer (a tab switch, a
// warp across the frame) cannot fling the stage past the cursor.
const POINTER_TAU = 0.014;
const VEL_TAU = 0.06;
const LEAD_MAX = 30;

// One sweep of the beam down the frame. Slow enough to read as an acquisition
// pass rather than a strobe, fast enough that the drift shear across the sweep
// line stays a few pixels — at 4s the same shear would be a visible skew of the
// whole specimen, which reads as a broken transform, not as scanning.
const SWEEP_PERIOD = 1.15;

const STATIC_TIME = 9.6;

const FRAG_SRC = `
precision highp float;

uniform vec2 u_size;      // css px
uniform float u_dpr;
uniform float u_time;
uniform float u_px;       // world units per css px
uniform vec2 u_stage;     // stage position, world units
uniform vec2 u_lagVel;    // stage velocity, world units/sec (drives the sweep tear)
uniform float u_rot;      // stage rotation, radians
uniform float u_density;
uniform float u_relief;
uniform float u_noise;
uniform vec2 u_beam;      // pointer, css px
uniform float u_hover;    // 0..1 eased
uniform float u_sweep;    // 0..1 down the frame
uniform float u_pass;     // acquisition pass counter
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform float u_bias;
uniform float u_contrast;

// The detector. Upper-left, ~34 degrees of elevation, and it is the ONLY
// directional term in the shader — there is no light.
const vec3 DET = vec3(-0.593, -0.526, 0.610);
// height the march must clear per unit of its own step parameter: since a step
// of t moves length(DET.xy) horizontally, this is DET.z, not tan(elevation)
const float DET_RISE = 0.610;

// Ceiling, in css px, on how far the stage's motion may shear the picture
// across the sweep line. See the note at the shear itself in main().
const float SHEAR_MAX = 0.8;

float hash21(vec2 p) {
  p = fract(p * vec2(287.13, 419.71));
  p += dot(p, p + 27.31);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  return vec2(hash21(p), hash21(p + 19.19));
}

// Value noise with its analytic derivative. Everything in the field returns
// vec3(value, d/dx, d/dy) so one evaluation yields the normal.
vec3 noised(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 du = 6.0 * f * (1.0 - f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  float k1 = b - a;
  float k2 = c - a;
  float k3 = a - b - c + d;
  return vec3(
    a + k1 * u.x + k2 * u.y + k3 * u.x * u.y,
    du.x * (k1 + k3 * u.y),
    du.y * (k2 + k3 * u.x)
  );
}

float noiseOnly(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Rotation between octaves, with its transpose carried alongside so the
// derivative chains correctly instead of being subtly wrong in a way that only
// shows up as normals that do not match the silhouette.
const mat2 OCT = mat2(1.624, 1.218, -1.218, 1.624);   // 2.03 * rot(36.9deg)
const mat2 OCT_T = mat2(1.624, -1.218, 1.218, 1.624);

// sc is applied inside rather than by the caller so the chain rule back to u
// cannot be forgotten at a call site — a gradient that is right in magnitude
// but wrong by a constant factor is the kind of bug that shows up only as
// normals that do not agree with the silhouette.
vec3 fbmd(vec2 p, float sc, float amp) {
  vec3 s = vec3(0.0);
  float a = amp;
  vec2 q = p * sc;
  mat2 t = mat2(1.0, 0.0, 0.0, 1.0);
  for (int i = 0; i < 3; i++) {
    vec3 n = noised(q);
    s.x += a * (n.x - 0.5);
    s.yz += a * (t * n.yz);
    a *= 0.5;
    q = OCT * q;
    t = OCT_T * t;
  }
  s.yz *= sc;
  return s;
}

float fbmOnly(vec2 p, float sc, float amp) {
  float s = 0.0;
  float a = amp;
  vec2 q = p * sc;
  for (int i = 0; i < 3; i++) {
    s += a * (noiseOnly(q) - 0.5);
    a *= 0.5;
    q = OCT * q;
  }
  return s;
}

// Smooth union that keeps the crease narrow. k is fed in CSS pixels converted
// to world units, so the seam where two grains meet is the same couple of
// pixels wide at any magnification and any device pixel ratio — the crevice is
// a line, not a soft valley, but it is never a one-pixel normal discontinuity
// that sparkles under the sec(theta) response.
vec3 smaxG(vec3 a, vec3 b, float k) {
  float w = clamp(0.5 + 0.5 * (b.x - a.x) / k, 0.0, 1.0);
  return vec3(mix(a.x, b.x, w) + k * w * (1.0 - w), mix(a.yz, b.yz, w));
}

float smaxH(float a, float b, float k) {
  float w = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(a, b, w) + k * w * (1.0 - w);
}

// ---------------------------------------------------------------------------
// Grains. A jittered lattice of ellipsoid caps, h = A*sqrt(1 - |d|^2/r^2) — the
// exact spheroid, and deliberately sqrt rather than a tunable pow(t, prof): a
// general exponent costs TWO pow() per cell (the height and the derivative's
// t^(prof-1)) and there are up to 45 cells per fragment across the five layers
// plus the horizon march. The silhouette's last pixel is kept off the aliasing
// edge by the tc floor and the smax crease instead.
//
// Because q = u*S, the S in the height and the S in dq/du cancel: the gradient
// is scale-free, which is correct — a sphere has the same slopes however small
// it is drawn — and it means every layer shares one closed form.
// ---------------------------------------------------------------------------
vec3 grains(vec2 u, float S, mat2 warp, mat2 warpT, float seed, float rmin,
            float rspan, float elong, float jit, out float matId) {
  vec2 q = warp * u * S;
  vec2 ip = floor(q);
  vec2 f = fract(q);
  // The loop carries a SCORE, not a height. h = elong*r*sqrt(tc)/S is monotonic
  // in r*r*tc, so the winner is found without a sqrt per cell, and the
  // gradient's reciprocal and the warp transpose are paid once instead of nine
  // times. What that buys is not the arithmetic — it is that the nine live
  // vec3s collapse to four floats. This shader was register-spilling, and the
  // measured cost of the specimen was a cliff rather than a slope.
  float bs = 0.0;
  vec2 bd = vec2(0.0);
  matId = 0.5;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(ip + g + seed);
      float r = rmin + rspan * fract(o.x * 7.13 + o.y * 3.71);
      vec2 d = f - (g + 0.5 + (o - 0.5) * jit);
      float t = 1.0 - dot(d, d) / (r * r);
      if (t > 0.0) {
        float sc = r * r * max(t, 0.0008);
        if (sc > bs) {
          bs = sc;
          bd = d;
          matId = o.y;
        }
      }
    }
  }
  if (bs <= 0.0) return vec3(0.0);
  // s = r*sqrt(tc), so the height is elong*s/S and inversesqrt(tc)/r is 1/s:
  // dh/dq = -elong*d/s, and dq/du = S*warp, so the two S cancel and what is
  // left is the warp's TRANSPOSE — a sphere has the same slopes however small
  // it is drawn
  float s = sqrt(bs);
  return vec3(elong * s / S, warpT * ((-elong / s) * bd));
}

float grainsH(vec2 u, float S, mat2 warp, float seed, float rmin, float rspan,
              float elong, float jit) {
  vec2 q = warp * u * S;
  vec2 ip = floor(q);
  vec2 f = fract(q);
  float bs = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(ip + g + seed);
      float r = rmin + rspan * fract(o.x * 7.13 + o.y * 3.71);
      vec2 d = f - (g + 0.5 + (o - 0.5) * jit);
      float t = 1.0 - dot(d, d) / (r * r);
      if (t > 0.0) bs = max(bs, r * r * max(t, 0.0008));
    }
  }
  return elong * sqrt(bs) / S;
}

// Filaments draped across the specimen: a warped ridge train. The warp comes
// from the same noise the substrate uses, so the fibres wander with the
// fracture surface instead of lying on it like printed stripes.
vec3 fibre(vec2 u, vec2 dir, float F, float amp, float warpAmt, float seed) {
  vec3 w = noised(u * 2.7 + seed);
  float s = dot(u, dir) * F + w.x * warpAmt;
  vec2 ds = dir * F + w.yz * (warpAmt * 2.7);
  float strand = hash21(vec2(floor(s), seed));
  float a = amp * (0.35 + 0.65 * strand);
  float k = fract(s) - 0.5;
  float e = exp(-k * k * 30.0);
  return vec3(a * e, a * e * (-60.0 * k) * ds);
}

float fibreH(vec2 u, vec2 dir, float F, float amp, float warpAmt, float seed) {
  float s = dot(u, dir) * F + noiseOnly(u * 2.7 + seed) * warpAmt;
  float strand = hash21(vec2(floor(s), seed));
  float k = fract(s) - 0.5;
  return amp * (0.35 + 0.65 * strand) * exp(-k * k * 30.0);
}

const vec2 FIB_A = vec2(0.9272, 0.3746);
const vec2 FIB_B = vec2(-0.3624, 0.9320);

// The specimen. Returns the height field and its gradient; 'coarse' is the
// same surface without the additive debris and micro-relief, which is what the
// horizon march compares against so shadows are not biased by detail the march
// cannot see.
const mat2 IDENT = mat2(1.0, 0.0, 0.0, 1.0);
// squashed and turned, so the medium layer reads as rods and prisms wedged
// between the round grains rather than as a second, smaller copy of the same
// population
const mat2 ROD = mat2(0.918, 0.397, -0.834, 1.928);
const mat2 ROD_T = mat2(0.918, -0.834, 0.397, 1.928);

void specimen(vec2 u, float dens, out vec2 grad, out float matId, out float marchH) {
  float k = u_px * 2.6;
  float m1;
  float m2;

  vec3 h = fbmd(u, 2.9, 0.026);
  // a sparse population of much larger bodies. Without it every grain is the
  // same size and the field reads as a manufactured lattice — packed roe rather
  // than a specimen. r stays well under half a cell, so most cells are empty and
  // the big ones arrive at an irregular spacing the eye cannot pre-empt.
  float m0;
  h = smaxG(h, grains(u, 4.2 * dens, IDENT, IDENT, 137.0,
                      0.15, 0.19, 0.86, 0.95, m0), k);
  h = smaxG(h, fibre(u, FIB_A, 5.6 * dens, 0.0125, 0.55, 3.1), k);
  h = smaxG(h, fibre(u, FIB_B, 8.3 * dens, 0.0085, 0.42, 17.7), k);
  vec3 g1 = grains(u, 10.5 * dens, IDENT, IDENT, 5.0,
                   0.30, 0.20, 0.80, 0.72, m1);
  // the march's reference height, captured here for free: it must be THIS
  // layer's raw height, because this layer is the only thing the march samples
  marchH = g1.x;
  h = smaxG(h, g1, k);
  h = smaxG(h, grains(u, 24.0 * dens, ROD, ROD_T, 41.0,
                      0.26, 0.26, 0.90, 0.80, m2), k);
  // the big bodies get their own atomic number too, so a boulder is not forced
  // to the same brightness as the small grains it is sitting among
  matId = mix(mix(m1, m2, 0.4), m0, 0.35);

  // debris and micro-relief sit ON whatever surface won, so they are summed
  // rather than unioned — a fleck of dust on top of a grain is above it, and a
  // union would hide every small thing behind every large one
  float m3;
  h += grains(u, 58.0 * dens, IDENT, IDENT, 91.0,
              0.20, 0.22, 0.85, 0.88, m3) * 0.85;
  h += fbmd(u, 21.0, 0.0042);
  h += fbmd(u, 96.0, 0.0016);

  grad = h.yz;
}

// What the march samples: the round-grain population and NOTHING else.
//
// Cost here is a cliff, not a slope — this shader lives near the edge of its
// register budget, and adding a second lattice layer plus the substrate fbm to
// the march once took it from ~15ms to 50-75ms, a 2.3x increase in work for a
// 3.5x increase in time. So the march gets exactly one layer, and h0 is
// that SAME layer's raw height at u (captured in specimen() for free) rather
// than the full surface: comparing a full-surface h0 against a one-layer sample
// biases every comparison and the frame loses its shadows altogether.
float specimenH(vec2 u, float dens) {
  return grainsH(u, 10.5 * dens, IDENT, 5.0, 0.30, 0.20, 0.80, 0.72);
}

// Horizon march toward the detector. The reach matters more than the step
// count: it has to clear the largest grain radius comfortably, or the result is
// a tight contact halo around every bump — which is ambient occlusion on a
// heightfield, the exact generic read this is trying not to be.
float collect(vec2 u, float h0, float dens) {
  float s = 1.0;
  float t = u_px * 4.0;
  for (int i = 0; i < 3; i++) {
    float hs = specimenH(u + DET.xy * t, dens);
    float over = hs - (h0 + t * DET_RISE);
    s = min(s, 1.0 - clamp(over / (u_px * 5.0 + t * 0.30), 0.0, 1.0));
    t *= 4.2;
  }
  return s;
}

vec3 ramp(float x) {
  vec3 c = mix(u_c0, u_c1, smoothstep(0.0, 0.26, x));
  c = mix(c, u_c2, smoothstep(0.24, 0.54, x));
  c = mix(c, u_c3, smoothstep(0.51, 0.82, x));
  c = mix(c, u_c4, smoothstep(0.80, 1.0, x));
  return c;
}

void main() {
  // DOM-space css px, y down, so the pointer, the scan lines and the field all
  // share one coordinate system
  vec2 p = vec2(gl_FragCoord.x, u_size.y * u_dpr - gl_FragCoord.y) / u_dpr;
  float ref = min(u_size.x, u_size.y);

  // ---- acquisition geometry (screen space, never drifts with the stage) ----
  float line = floor(p.y);
  float yf = p.y / u_size.y;
  // lines above the sweep were written this pass, lines below on the last one
  float below = step(u_sweep, yf);
  float pass = u_pass - below;
  // how long ago this line was acquired: the stage kept moving in between, so
  // the picture shears very slightly across the sweep line
  float lag = (below > 0.5 ? (1.0 + u_sweep - yf) : (u_sweep - yf)) * ${SWEEP_PERIOD.toFixed(3)};
  // sub-pixel line-to-line misregistration, applied to the sample position so
  // the shadows move with the rims instead of sliding under them
  float jx = (hash21(vec2(line, pass * 5.7)) - 0.5) * 0.55;

  float dens = clamp(u_density, 0.35, 3.0);
  vec2 sp = vec2(p.x + jx, p.y);
  vec2 cu = (sp - u_size * 0.5) * u_px;
  float cs = cos(u_rot);
  float sn = sin(u_rot);
  // The shear this lag buys has to stay SUB-PIXEL. Left unbounded it is
  // |u_lagVel| * SWEEP_PERIOD / u_px css px: about 6px on the drift alone, and
  // up to ~75px while the hand is panning, since the pan velocity is folded
  // into u_lagVel. At that size the sweep line stops reading as a scan and
  // reads as a tear — the specimen above it is a different picture from the
  // one below, which is the one thing a continuous surface must never do.
  // Saturating instead of clamping keeps it exactly linear in the slow regime
  // that is honest, and asymptotic to SHEAR_MAX css px at any speed.
  vec2 sh = u_lagVel * lag;
  float shm = SHEAR_MAX * u_px;
  sh *= shm / (length(sh) + shm);
  vec2 u = mat2(cs, sn, -sn, cs) * cu + u_stage - sh;

  vec2 grad;
  float matId;
  float marchH;
  specimen(u, dens, grad, matId, marchH);

  float gm = length(grad);
  if (gm > 12.0) grad *= 12.0 / gm;
  vec3 n = normalize(vec3(-grad.x * u_relief, -grad.y * u_relief, 1.0));

  // ---- detector model ------------------------------------------------------
  // secondary yield: sec(theta), floored so the silhouette saturates instead of
  // going singular in whichever pixel happens to land on it
  float nz = max(n.z, 0.13);
  float delta = pow(1.0 / nz, 0.95);
  // atomic-number contrast: different grains are different stuff
  delta *= 0.86 + 0.30 * matId;

  float shadow = collect(u, marchH, dens);
  float facing = max(dot(n, DET), 0.0);
  float eta = 0.30 + 0.70 * facing * shadow;
  // a small isotropic pedestal: electrons that scatter off the chamber wall and
  // come back, which is why a real crevice is dark but never black
  eta += 0.055 * shadow;

  float sig = delta * eta * 0.42;
  // the far side of the specimen subtends less of the detector — a broad
  // brightness gradient toward the detector, which is what an SEM has instead
  // of a vignette
  sig *= 1.0 + 0.13 * dot(normalize(vec2(-0.6, -0.55)), (p - u_size * 0.5) / ref);
  sig = sig / (1.0 + sig * 0.50);

  // ---- beam spot -----------------------------------------------------------
  // where the pointer is, the beam dwells: more electrons per pixel, so more
  // signal and less shot noise. That is the whole interaction — no glow sprite.
  vec2 bd = (p - u_beam) / (ref * 0.155);
  float spot = exp(-dot(bd, bd)) * u_hover;
  sig = mix(sig, sig * 1.30 + 0.045, spot * 0.85);

  // ---- acquisition ---------------------------------------------------------
  float comb = 1.0 - 0.042 * (0.5 + 0.5 * cos(6.2831853 * p.y / 2.7));
  sig *= comb;
  // per-line DC: a fast component that changes every pass, and a slow drift
  // that reads as the amplifier wandering
  sig += (hash21(vec2(line, pass * 3.1)) - 0.5) * 0.026;
  sig += (noiseOnly(vec2(line * 0.07, u_time * 0.6)) - 0.5) * 0.045;
  // charge streaking, pulled along the fast (horizontal) axis and gated on
  // signal, since it is bright features that charge
  float streak = noiseOnly(vec2(p.x * 0.010, p.y * 0.62) + vec2(u_time * 0.05, 0.0));
  sig += (streak - 0.5) * 0.085 * smoothstep(0.35, 0.9, sig);

  // shot noise: Poisson, so the amplitude tracks sqrt of the signal, and
  // correlated with the pixel to its left because the beam has not finished
  // moving. The lattice is css px and phase-locked to the display, so the
  // adaptive render scale cannot change the grain size.
  vec2 pix = floor(p);
  vec2 ns = vec2(pass * 17.3, pass * 7.7);
  float nA = hash21(pix + ns);
  float nB = hash21(pix + vec2(-1.0, 0.0) + ns);
  float shot = mix(nA, nB, 0.42) - 0.5;
  sig += shot * 0.115 * u_noise * (0.35 + 0.65 * sqrt(max(sig, 0.0))) * mix(1.0, 0.28, spot);

  // the sweep line itself: the beam is on it right now
  // its amplitude is the whole question. At 0.22 it was a saturated rule right
  // across the frame — measured at +76/255 over the surrounding rows, five
  // times the brightest ordinary grain row, which is not what a beam passing
  // over a line looks like. Kept just clear of the shot noise so it reads as
  // the pass going by, and rolled off where the signal is already high so it
  // cannot blow a rim out.
  float sweepD = abs(yf - u_sweep);
  float onLine = 0.040 * exp(-sweepD * sweepD * 26000.0)
               + 0.016 * exp(-sweepD * sweepD * 700.0);
  sig += onLine * (1.0 - 0.55 * clamp(sig, 0.0, 1.0));

  float L = clamp((sig - 0.5) * u_contrast + 0.5 + u_bias, 0.0, 1.0);
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
    throw new Error(`edge-yield: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// The minimal full-bleed fragment-shader host: one program, one fullscreen
// triangle pair, uniform locations resolved lazily by name. It knows nothing
// about the micrograph.
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

export function EdgeYield({
  magnification = 1,
  density = 1,
  relief = 1,
  noise = 1,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: EdgeYieldProps) {
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
    let simTime = 0;

    // Adaptive render scale. Insurance, not the fix: the ladder only steps after
    // a sustained stretch of wall-clock overrun, so one GC pause or a tab switch
    // cannot cost resolution, and it climbs back as soon as the page is inside
    // budget again — the frame time this watches is the PAGE's, not this
    // component's, and a sibling animation blowing the budget must not soften
    // the micrograph for the rest of the visit. Every threshold is milliseconds
    // of wall clock, never frames: a frame-counted gate waits longer the slower
    // the machine is, which is backwards.
    const SCALES = [1, 0.78, 0.58];
    const BUDGET_OVER = 24;
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;

    // stage: an integrated position rather than a function of time, so a long
    // frame advances it by one clamped step instead of teleporting the specimen
    let stageX = 0;
    let stageY = 0;
    let panX = 0;
    let panY = 0;
    let lastPanX = 0;
    let lastPanY = 0;
    let driftVX = 0;
    let driftVY = 0;
    let sweep = 0;
    let passCount = 0;

    let hoverTarget = 0;
    let hoverAmt = 0;

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

    let c0: RGB = [0.03, 0.03, 0.03];
    let c1: RGB = [0.18, 0.18, 0.18];
    let c2: RGB = [0.56, 0.56, 0.56];
    let c3: RGB = [0.93, 0.93, 0.93];
    let c4: RGB = [1, 1, 1];
    let bias = 0;
    let contrast = 1;

    // Five stops, and the ramp's direction is the same in both themes because
    // electron yield only ever climbs toward light. What the theme changes is
    // the exposure. Dark is the micrograph as it appears on the console: the
    // substrate sits low and the rims carry the whole top of the range. Light
    // is the same acquisition printed — the top stop is the paper, and the
    // substrate is lifted to a mid grey so the rims still have somewhere
    // brighter to go. Putting the substrate ON the paper value instead is the
    // wash-out: the rims lose their headroom and the one feature that makes
    // this read as an electron image flattens out.
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
        c2 = mixRGB(muted, fg, 0.15);
        c3 = fg;
        c4 = mixRGB(fg, white, 0.92);
        bias = 0.035;
        contrast = 1.24;
      } else {
        c0 = mixRGB(fg, black, 0.35);
        c1 = mixRGB(fg, muted, 0.72);
        c2 = mixRGB(muted, bg, 0.6);
        c3 = mixRGB(bg, muted, 0.08);
        c4 = bg;
        bias = 0.17;
        contrast = 1.26;
      }
    };
    readColors();

    const draw = () => {
      if (!surface.gl || cssW <= 0 || cssH <= 0) return;
      const t = staticMode ? STATIC_TIME : simTime;
      const ref = Math.min(cssW, cssH);
      // magnification breathing: the working distance creeping, slow enough
      // that it is felt rather than watched
      const view = ref * (0.82 / Math.max(0.25, magnification)) * (1 + 0.045 * Math.sin(t * 0.043));
      const px = 1 / view;

      let sx = stageX;
      let sy = stageY;
      let lagX = driftVX;
      let lagY = driftVY;
      if (staticMode) {
        // a composed still: the drift integrated to a fixed point, and a lag
        // velocity so the sweep tear is present in the frozen frame too
        sx = STATIC_TIME * 0.0062;
        sy = STATIC_TIME * 0.0031;
        lagX = 0.0062;
        lagY = 0.0031;
      }
      sx += panX * px;
      sy += panY * px;

      surface.v2("u_size", cssW, cssH);
      surface.f("u_dpr", dpr);
      surface.f("u_time", t);
      surface.f("u_px", px);
      surface.v2("u_stage", sx, sy);
      surface.v2("u_lagVel", lagX, lagY);
      surface.f("u_rot", t * 0.0075);
      surface.f("u_density", Math.max(0.35, density));
      surface.f("u_relief", Math.max(0, relief));
      surface.f("u_noise", Math.max(0, noise));
      surface.v2("u_beam", ptrX, ptrY);
      surface.f("u_hover", hoverAmt);
      surface.f("u_sweep", staticMode ? 0.63 : sweep);
      surface.f("u_pass", staticMode ? 7 : passCount);
      surface.v3("u_c0", c0);
      surface.v3("u_c1", c1);
      surface.v3("u_c2", c2);
      surface.v3("u_c3", c3);
      surface.v3("u_c4", c4);
      surface.f("u_bias", bias);
      surface.f("u_contrast", contrast);
      surface.draw(canvas.width, canvas.height);
    };

    // The stage never stops: a constant drift whose heading turns slowly, so
    // the specimen is always moving under the beam but never on a loop the eye
    // can memorise.
    const stepStage = (dt: number) => {
      const a = simTime * 0.085;
      driftVX = 0.0072 * Math.cos(a) + 0.0016 * Math.sin(simTime * 0.31);
      driftVY = 0.0072 * Math.sin(a * 0.83 + 1.2) - 0.0013 * Math.cos(simTime * 0.24);
      stageX += driftVX * dt;
      stageY += driftVY * dt;
    };

    // Advance the smoothed pointer one frame. Everything the sim sees about the
    // pointer is produced here, in the frame, from a target the event handlers
    // only ever assign to — so a 120Hz trackpad, a 60Hz mouse and a synthetic
    // driver all produce the same stage motion.
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
        ptrX += (tgtX + leadX - ptrX) * k;
        ptrY += (tgtY + leadY - ptrY) * k;
      }
      // the stage translation the pointer asks for, eased on a longer constant
      // than the beam itself: a stage is heavy, a beam is not
      const want = havePointer ? 0.11 : 0;
      const targetPanX = -(ptrX - cssW * 0.5) * want;
      const targetPanY = -(ptrY - cssH * 0.5) * want;
      const pk = 1 - Math.exp(-dt / 0.16);
      lastPanX = panX;
      lastPanY = panY;
      panX += (targetPanX - panX) * pk;
      panY += (targetPanY - panY) * pk;
      // the pan contributes to the acquisition tear exactly as the drift does,
      // so a fast sweep of the hand visibly shears the frame at the sweep line
      const view = Math.min(cssW, cssH) * (0.82 / Math.max(0.25, magnification));
      const pvx = ((panX - lastPanX) / dt) / view;
      const pvy = ((panY - lastPanY) / dt) / view;
      driftVX += Math.max(-0.09, Math.min(0.09, pvx));
      driftVY += Math.max(-0.09, Math.min(0.09, pvy));
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
      lastMs = nowMs;
      simTime += dt * Math.max(0, speed);
      hoverAmt += (hoverTarget - hoverAmt) * (1 - Math.exp(-dt * 6));
      stepStage(dt * Math.max(0, speed));
      stepPointer(dt);
      sweep += dt / SWEEP_PERIOD;
      while (sweep >= 1) {
        sweep -= 1;
        passCount += 1;
      }
      draw();

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

    // Full DPR 2. The high-frequency structure — shot noise, the scan comb, the
    // rim band — is what a reduced backing store destroys first, so anything
    // under 2 is the first thing this component gives away and the last thing
    // it should. It was capped at 1.5 for a while because the shader could not
    // hold 60fps at 2880x1800; that was a register-spill in the grain lattice,
    // not a fill-rate wall, and fixing it left the frame at ~2.8ms with the
    // ladder resting on its top rung. The ladder stays as insurance for
    // machines slower than this one, not as the thing that buys the frame rate.
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
      if (!havePointer) {
        ptrX = cssW * 0.5;
        ptrY = cssH * 0.5;
      }
      // a new size is a new number of fragments, so the ladder starts over
      // rather than carrying a verdict earned at a different cost
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
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
    const onPointerMove = (e: PointerEvent) => {
      setTarget(e);
      if (!havePointer) {
        snapPointer();
        hoverTarget = 1;
      }
      if (staticMode) {
        // frozen frame: no loop to smooth in, so the beam is placed directly
        ptrX = tgtX;
        ptrY = tgtY;
        hoverAmt = 1;
        panX = -(ptrX - cssW * 0.5) * 0.11;
        panY = -(ptrY - cssH * 0.5) * 0.11;
        draw();
      }
    };
    const onPointerLeave = () => {
      hoverTarget = 0;
      havePointer = false;
      if (staticMode) {
        hoverAmt = 0;
        panX = 0;
        panY = 0;
        draw();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      hoverTarget = 1;
      if (staticMode) onPointerMove(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      // a lifted touch has no position any more and no pointerleave is coming
      if (e.pointerType !== "mouse") onPointerLeave();
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
    wrap.addEventListener("pointercancel", onPointerLeave);
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

    // a full-bleed shader scrolled off-screen is the most expensive idle thing
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

    // polled instead of made an effect dependency: the dependency would tear
    // down and recreate the whole GL context to change a boolean
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
      wrap.removeEventListener("pointercancel", onPointerLeave);
      window.removeEventListener("scroll", markRectDirty, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("resize", markRectDirty);
      window.clearTimeout(poll);
      sleep();
      surface.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magnification, density, relief, noise, speed]);

  return (
    <div
      ref={wrapRef}
      data-edge-yield={uid}
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

EdgeYield.displayName = "EdgeYield";
