"use client";

import { useEffect, useId, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// SandLock — a full-bleed Chladni plate. Tens of thousands of grains of sand
// sit on a vibrating steel plate; a driving oscillator sweeps continuously
// through the plate's resonances, and the sand answers by storming into a
// haze whenever the drive sits between two modes and collapsing onto the
// nodal lines whenever it lands on one. The transition is the whole point:
// chaos resolving into a precise symmetric figure, holding, then breaking
// apart again into a different one.
//
// THE FIELD IS REAL, NOT DECORATIVE. Each mode of a square plate is the
// degenerate pair sin(n*pi*x)*sin(m*pi*y) and sin(m*pi*x)*sin(n*pi*y), which
// share an eigenfrequency w = n^2 + m^2 (Kirchhoff plate scaling), so the
// physical shape at that frequency is any rotation of the pair,
// cos(th)*A - sin(th)*B. Those are the textbook Chladni figures — the
// diagonals, the crosses, the rings-of-squares — and they are what this draws.
// The drive is a single scalar u; every mode responds with the steady-state
// amplitude of a damped oscillator, r_k = 1/sqrt((1-x^2)^2 + (2*z*x)^2) with
// x = u/w_k, and the plate's displacement is the sum of the modes weighted by
// their responses. That one line is what makes the piece behave: at a
// resonance a single r_k dominates and the field is a clean eigenmode with
// sharp nodal lines; halfway between two resonances two comparable responses
// superpose into a field whose zero set is a moving, non-symmetric mess, so
// the sand has nothing stable to land on and storms. Nothing fades a pattern
// out and cross-fades another one in; the mess in between is the honest
// answer to being driven off-resonance.
//
// COVERING A WIDE VIEWPORT WITHOUT LYING. A Chladni figure is square; a hero
// is not. Cropping a square figure to 16:9 throws away the symmetry that makes
// it readable, and stretching it is simply wrong. But every one of these modes
// vanishes on the plate's own boundary (sin(n*pi) = 0), so the odd reflection
// of the field across that boundary is itself an exact mode of the doubled
// plate. The field is therefore evaluated on a folded coordinate — a triangle
// wave into the unit cell with the sign flipped once per crossing — which
// tiles the viewport with mirrored cells that are physically continuous
// across their shared nodal edge. Just under three plate cells across a laptop
// screen: full-bleed and dense even on the low modes, whose figures are only a
// handful of lines and would leave a hero mostly empty at one cell per screen,
// and still an exact solution.
//
// TRANSPORT. Grains are not drawn onto the zero set. Each grain reads the
// local |displacement| field and its gradient and walks DOWN that gradient
// (mobility scaled by how coherent the drive currently is) while diffusing
// with a step size proportional to the local amplitude — a grain sitting on a
// violently moving antinode is thrown far on every bounce, a grain on a nodal
// line is barely disturbed, so sand accumulates at the nodes for the reason it
// does on a real plate rather than because a force field pulled it there.
// Both the drift and the diffusion are gated by a FRICTION threshold: below
// it a grain is not being thrown at all and stays put, which is what gives the
// walk a resting state and what makes the figure a set of LINES instead of a
// lattice of clumps at the line crossings (see the note at the transport). The
// field is rebuilt every frame on a coarse grid (~5 css px cells, separable
// per-mode sine tables, so the cost is a few hundred thousand multiply-adds
// no matter how many grains there are); grains take three bilinear samples
// each. That split is what keeps 40k grains affordable: the expensive,
// mode-dependent part is paid once per cell, not once per grain.
//
// RENDER. One WebGL context, two passes. A fullscreen pass shades the plate
// itself from the same field texture the sim uses — the steel is lit by its
// own flexure, so the antinodes read as bands of moving sheen and you can see
// the plate working under the sand. Then the grains, as points, in a blend
// mode chosen by theme: additive where the page is dark (bright sand piling to
// a hot white line) and multiplicative where it is light (dark grains printing
// into a pale plate). Both directions accumulate, so density reads as value in
// either theme instead of the light theme washing out.
//
// POINTER. The drive is always sweeping, with or without input, so a resting
// frame catches either a resolved figure or a storm. The pointer does not take
// the sweep over — it BOWS the plate: horizontal position detunes the drive by
// up to half a mode spacing (so hovering left or right destabilises whatever
// figure is currently locked and pulls a neighbouring one into being), a press
// bows harder and raises the drive amplitude until the sand storms, and the
// contact point injects local energy that scatters the grains around it. The
// pointer is smoothed on an exponential follower with a lead term: a plain
// follower has a steady-state error of exactly velocity*tau, so the bow would
// visibly trail the cursor; extrapolating the target one tau ahead cancels it.
//
// TOKENS. --background, --foreground, --ns-muted and --border only, read via
// getComputedStyle and re-read on a documentElement class MutationObserver.
// --ns-accent is interaction-only and never touches the plate or the sand: it
// appears solely on the keyboard focus ring of the plate, which is a real
// interaction the user has to initiate. Reduced motion and `paused` draw one
// settled figure — the sim is spun up first, so the still frame is a resolved
// Chladni pattern and never an undeveloped scatter.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return Number.isNaN(r + g + b) ? null : [r / 255, g / 255, b / 255];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r / 255, g / 255, b / 255];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255] : null;
}

function luminance(c: RGB): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// ---------------------------------------------------------------------------
// Modes. n !== m throughout: n === m makes the antisymmetric combination
// identically zero, a degenerate non-figure. Frequency is the Kirchhoff plate
// eigenvalue w = n^2 + m^2, and `theta` picks which rotation of the degenerate
// pair the plate happens to be driven into — a real plate settles into one or
// the other depending on where it is clamped and bowed, and the two look
// completely different, so varying it across the sequence is what stops the
// figures from all reading as the same family.
// ---------------------------------------------------------------------------
// The eigenvalues are NOT arbitrary and the SPACING between them is the thing
// that had to be designed. n^2 + m^2 is dense — (3,4) and (1,5) land on 25 and
// 26, four percent apart — and two modes four percent apart are both within
// each other's resonance skirt at any drive, so their responses never separate
// and the plate is permanently smeared across a superposition that has no
// crisp figure at all. The drive therefore visits a SPARSE subset whose
// eigenvalues are ~1.4x apart, which is exactly what a person sweeping a real
// signal generator does: you stop at the frequencies that give a clean figure
// and pass over the ones that only ever give mush.
const MODES: readonly { n: number; m: number; w: number }[] = [
  { n: 2, m: 3 },
  { n: 2, m: 4 },
  { n: 2, m: 5 },
  { n: 4, m: 5 },
  { n: 3, m: 7 },
  { n: 6, m: 7 },
].map((k) => ({ ...k, w: k.n * k.n + k.m * k.m }));

// every distinct harmonic index used by any mode, so the separable sine tables
// are built once per axis per frame instead of once per mode
const HARMONICS: readonly number[] = Array.from(
  new Set(MODES.flatMap((k) => [k.n, k.m]))
).sort((a, b) => a - b);
const HARMONIC_SLOT = new Map<number, number>(HARMONICS.map((h, i) => [h, i]));

const ZETA = 0.022; // modal damping ratio; sets how narrow a resonance is
const ACTIVE = 3; // strongest responses actually summed into the field

// Where the drive stops, and in which rotation of the degenerate pair. Not
// monotonic: a sweep that only ever climbs reads as a progress bar, and the
// leg back down re-forms the figures in a different order, which is what stops
// the loop being legible as a loop. The same eigenvalue appears more than once
// at a different theta, because a plate clamped or bowed somewhere else really
// does settle into the other rotation of the pair, and the two figures for one
// frequency look nothing alike.
const SEQUENCE: readonly { k: number; theta: number }[] = [
  { k: 3, theta: 0 },
  { k: 1, theta: 0.62 },
  { k: 4, theta: 0 },
  { k: 2, theta: 0 },
  { k: 5, theta: 0.5 },
  { k: 0, theta: 0.42 },
  { k: 3, theta: 0.9 },
  { k: 4, theta: 1.15 },
  { k: 1, theta: 0 },
  { k: 5, theta: 0 },
  { k: 2, theta: 0.75 },
  { k: 0, theta: 0 },
];

const VERT_PLATE = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// The plate itself: steel lit by its own flexure. Slope of the displacement
// field becomes a surface normal, so antinodes read as broad moving sheen and
// the nodal lines as the flat seams between them. Every colour is a uniform.
const FRAG_PLATE = `
precision highp float;
uniform vec2 u_size;
uniform vec2 u_grid;
uniform sampler2D u_field;
uniform float u_time;
uniform float u_amp;
uniform float u_coh;
uniform vec3 u_plate;
uniform vec3 u_hi;
uniform vec3 u_lo;
uniform float u_dir;

float fieldAt(vec2 p) {
  vec2 uv = mix(0.5 / u_grid, 1.0 - 0.5 / u_grid, p);
  return texture2D(u_field, uv).r * 2.0 - 1.0;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 p = gl_FragCoord.xy / u_size;
  vec2 e = 1.0 / u_grid;
  float f = fieldAt(p);
  float fx = fieldAt(p + vec2(e.x, 0.0)) - fieldAt(p - vec2(e.x, 0.0));
  float fy = fieldAt(p + vec2(0.0, e.y)) - fieldAt(p - vec2(0.0, e.y));

  // The plate flexes far faster than any display can show it. Lighting the
  // steel from the INSTANTANEOUS deflection means sampling that oscillation at
  // the refresh rate, and the sign flip aliases straight down into a full-bleed
  // strobe: measured at 6.5 Hz, a 3.3% mean-luminance sawtooth with 0.024
  // between consecutive frames — a photosensitivity hazard on a surface this
  // size, and the flicker the plate was reported for. What an eye (or a camera)
  // integrates over any interval it can resolve is the ENVELOPE of the motion,
  // so the sheen rides on that instead, strictly positive and with only a slow
  // continuous breath left in it so the steel is not dead.
  float phase = 0.88 + 0.12 * sin(u_time * 0.55);
  vec3 n = normalize(vec3(-fx * 5.4 * u_amp * phase, -fy * 5.4 * u_amp * phase, 1.0));
  vec3 l = normalize(vec3(0.42, 0.66, 0.62));
  float diff = max(dot(n, l), 0.0);
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec3 h = normalize(l + v);
  float spec = pow(max(dot(n, h), 0.0), 46.0);

  // rolled steel: a stretched grain that runs across the plate, at two scales
  // so the surface has something to say where the field is flat
  float grain = hash(floor(gl_FragCoord.xy * vec2(0.5, 2.9))) - 0.5;
  grain += (hash(floor(gl_FragCoord.xy * vec2(0.07, 0.31))) - 0.5) * 0.8;
  float env = abs(f);

  float shade = 0.5 + (diff - 0.62) * 0.85 + spec * 0.5;
  shade += grain * 0.075;
  // the antinodes are lobes of moving metal: under raking light they read as
  // broad panels flipping either side of the seams, so the figure is already
  // legible in the steel before a single grain lands on it
  shade += f * phase * 0.1 * u_amp;
  shade += (env * env - 0.3) * 0.22 * u_amp;
  shade -= (1.0 - u_coh) * 0.03;

  vec3 col = u_plate;
  col = mix(col, u_lo, clamp(-shade + 0.5, 0.0, 1.0) * 0.95);
  col = mix(col, u_hi, clamp(shade - 0.5, 0.0, 1.0) * 0.95);

  // a mild elliptical vignette so the frame edges stop competing with the figure
  vec2 q = (p - 0.5) * vec2(1.0, u_size.y / u_size.x);
  float vig = smoothstep(0.62, 0.16, length(q));
  col = mix(mix(col, u_lo, 0.55 * u_dir + 0.16), col, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT_GRAIN = `
attribute vec3 a_grain;
attribute float a_seed;
uniform vec2 u_size;
uniform float u_dpr;
uniform float u_psize;
varying float v_ink;
void main() {
  vec2 p = a_grain.xy / u_size;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  // a settled grain (low local amplitude) prints solid; one being thrown
  // around on an antinode is a blur, so it prints faint and slightly larger
  float agit = clamp(a_grain.z, 0.0, 1.0);
  gl_PointSize = u_psize * u_dpr * (0.82 + a_seed * 0.5 + agit * 0.55);
  v_ink = mix(1.0, 0.34, agit) * (0.62 + a_seed * 0.55);
}
`;

const FRAG_GRAIN = `
precision mediump float;
uniform vec3 u_ink;
uniform float u_gain;
varying float v_ink;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d) * 4.0;
  float a = 1.0 - smoothstep(0.35, 1.0, r);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(u_ink * (a * v_ink * u_gain), 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function link(
  gl: WebGLRenderingContext,
  vsSrc: string,
  fsSrc: string
): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

// Pointer smoothing. POINTER_TAU is the absorption window; LEAD cancels the
// v*tau steady-state error of the follower so the bow sits under the cursor
// instead of a frame behind it.
const POINTER_TAU = 0.055;
const VEL_TAU = 0.09;
const LEAD_MAX = 220;

export interface SandLockProps {
  /** grains of sand on the plate. default 40000 */
  grains?: number;
  /** multiplier on the drive sweep's clock. default 1 */
  speed?: number;
  /** plate cell size as a fraction of the viewport's short edge. default 0.5 */
  plateScale?: number;
  /** freeze on one settled figure */
  paused?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SandLock({
  grains = 40000,
  speed = 1,
  plateScale = 0.5,
  paused = false,
  children,
  className = "",
  style,
}: SandLockProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // Bumped on webglcontextrestored so the effect below tears down and rebuilds
  // every GL object. Without it the component handled loss by stopping the loop
  // and never came back: a lost context left the plate permanently blank, and
  // browsers drop the oldest context once enough live ones exist, which a
  // gallery of WebGL cards reaches on its own.
  const [glEpoch, setGlEpoch] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    }) as WebGLRenderingContext | null;
    if (!gl) return;

    const plateProg = link(gl, VERT_PLATE, FRAG_PLATE);
    const grainProg = link(gl, VERT_GRAIN, FRAG_GRAIN);
    if (!plateProg || !grainProg) return;

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const locCache = new Map<string, WebGLUniformLocation | null>();
    const U = (prog: WebGLProgram, tag: string, name: string) => {
      const key = tag + name;
      if (!locCache.has(key)) locCache.set(key, gl.getUniformLocation(prog, name));
      return locCache.get(key) ?? null;
    };

    // ---- grain state -----------------------------------------------------
    const COUNT = Math.max(2000, Math.min(120000, Math.floor(grains)));
    const gx = new Float32Array(COUNT);
    const gy = new Float32Array(COUNT);
    const gpu = new Float32Array(COUNT * 3); // x, y, agitation
    const seeds = new Float32Array(COUNT);

    // xorshift: Math.random is called several times per grain per frame, and
    // this is measurably cheaper at 40k
    let rngState = 0x9e3779b9;
    const rnd = () => {
      rngState ^= rngState << 13;
      rngState ^= rngState >>> 17;
      rngState ^= rngState << 5;
      return ((rngState >>> 0) % 16777216) / 16777216;
    };
    for (let i = 0; i < COUNT; i++) seeds[i] = rnd();

    const grainBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, grainBuf);
    gl.bufferData(gl.ARRAY_BUFFER, gpu.byteLength, gl.DYNAMIC_DRAW);
    const seedBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

    // ---- field grid ------------------------------------------------------
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let GW = 2;
    let GH = 2;
    let field = new Float32Array(4); // signed displacement
    let absF = new Float32Array(4); // |displacement|, normalised to 0..1
    let gradX = new Float32Array(4);
    let gradY = new Float32Array(4);
    let tex8 = new Uint8Array(4);
    let sinX = new Float32Array(4); // per-harmonic sine tables, folded
    let sinY = new Float32Array(4);
    let parX = new Float32Array(4); // reflection parity per column / row
    let parY = new Float32Array(4);
    let cell = 1; // plate cell size in css px

    const fieldTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Fold a world coordinate into the unit cell by a triangle wave and record
    // the parity of the crossing: the odd reflection of a mode across its own
    // nodal boundary is an exact mode of the doubled plate, so mirrored cells
    // join continuously instead of showing a seam.
    const buildTables = () => {
      const H = HARMONICS.length;
      sinX = new Float32Array(H * GW);
      sinY = new Float32Array(H * GH);
      parX = new Float32Array(GW);
      parY = new Float32Array(GH);
      const fold = (world: number, size: number, par: Float32Array, i: number, org: number) => {
        // centre the cell lattice on the viewport so the figure is not
        // arbitrarily offset by the window's width
        const t = (world - (size - cell) * 0.5 - org) / cell;
        const c = Math.floor(t);
        const frac = t - c;
        par[i] = c & 1 ? -1 : 1;
        return c & 1 ? 1 - frac : frac;
      };
      for (let i = 0; i < GW; i++) {
        const u = fold((i / (GW - 1)) * cssW, cssW, parX, i, orgX);
        for (let hi = 0; hi < H; hi++) sinX[hi * GW + i] = Math.sin(HARMONICS[hi] * Math.PI * u);
      }
      for (let j = 0; j < GH; j++) {
        const v = fold((j / (GH - 1)) * cssH, cssH, parY, j, orgY);
        for (let hi = 0; hi < H; hi++) sinY[hi * GH + j] = Math.sin(HARMONICS[hi] * Math.PI * v);
      }
    };

    // Where the cell lattice sits. It has to MOVE, once per sweep, and that is
    // not decoration: a cell boundary is a nodal line of every mode at once, so
    // it is the one place on the plate that is never shaken no matter what the
    // drive is doing. Leave it fixed and it is a permanent trap — grains that
    // land on it under one figure are still parked there thirty seconds and
    // four figures later, and the plate slowly drains into a bright cross while
    // the actual figures thin out to nothing (measured: by ten seconds most of
    // the sand was on the seams). Shifting the lattice by an irrational
    // fraction of a cell each time the sweep leaves a resonance puts those
    // grains back on live steel; it happens while the plate is already storming
    // between two modes, so what you see is the plate reconfiguring, which is
    // what it is — a different clamping gives a different plate.
    // It has to SLIDE there rather than cut, though. Reseating the lattice in a
    // single frame translates every nodal line at once, which is a step change
    // in what the whole viewport is showing — measured as the only luminance
    // discontinuity left after the sheen was fixed (0.0067 between consecutive
    // frames, against a 0.0009 p95 elsewhere). Easing it over the sweep costs
    // one table rebuild per frame while it is in flight (a few thousand sines,
    // against a few hundred thousand multiply-adds for the field) and reads as
    // the plate being re-clamped, which is what it is.
    let orgX = 0;
    let orgY = 0;
    let orgTX = 0;
    let orgTY = 0;
    const ORG_TAU = 0.75;
    const shiftLattice = () => {
      orgTX += cell * 0.381966;
      orgTY += cell * 0.236068;
    };
    const stepLattice = (dt: number) => {
      if (orgX === orgTX && orgY === orgTY) return;
      const k = 1 - Math.exp(-dt / ORG_TAU);
      orgX += (orgTX - orgX) * k;
      orgY += (orgTY - orgY) * k;
      if (Math.abs(orgTX - orgX) < 0.02 && Math.abs(orgTY - orgY) < 0.02) {
        // land exactly, then fold both back into one lattice period so the
        // offsets cannot drift off into a range where the fold loses precision
        orgTX %= cell * 2;
        orgTY %= cell * 2;
        orgX = orgTX;
        orgY = orgTY;
      }
      buildTables();
    };

    const allocGrid = () => {
      const target = 5.2; // css px per cell — finer than half the shortest
      GW = Math.max(24, Math.min(360, Math.round(cssW / target)));
      GH = Math.max(24, Math.min(360, Math.round(cssH / target)));
      const n = GW * GH;
      field = new Float32Array(n);
      absF = new Float32Array(n);
      gradX = new Float32Array(n);
      gradY = new Float32Array(n);
      tex8 = new Uint8Array(n);
      buildTables();
    };

    // ---- drive -----------------------------------------------------------
    const resp = new Float32Array(MODES.length);
    const weights = new Float32Array(MODES.length);
    const activeIdx: number[] = [];
    let coh = 1;
    let ampNorm = 1;

    // steady-state amplitude of a damped oscillator driven at u — the entire
    // reason the sand storms between resonances and locks on them
    const respond = (u: number) => {
      let sum = 0;
      let peak = 0;
      for (let k = 0; k < MODES.length; k++) {
        const x = u / MODES[k].w;
        const d = (1 - x * x) * (1 - x * x) + (2 * ZETA * x) * (2 * ZETA * x);
        const r = 1 / Math.sqrt(Math.max(1e-9, d));
        resp[k] = r;
        sum += r;
        if (r > peak) peak = r;
      }
      // coherence: how much of the total response one mode owns. 1 on a
      // resonance, ~0.5 halfway between two — this is the storm signal.
      coh = sum > 0 ? peak / sum : 1;
      activeIdx.length = 0;
      const order = Array.from(resp.keys()).sort((a, b) => resp[b] - resp[a]);
      let wsum = 0;
      for (let i = 0; i < ACTIVE && i < order.length; i++) {
        activeIdx.push(order[i]);
        wsum += resp[order[i]];
      }
      for (const k of activeIdx) weights[k] = resp[k] / Math.max(1e-9, wsum);
      ampNorm = Math.min(1, peak / 6);
    };

    const buildField = () => {
      const H = HARMONICS.length;
      field.fill(0);
      for (const k of activeIdx) {
        const mode = MODES[k];
        const w = weights[k];
        if (w < 0.02) continue;
        const sn = (HARMONIC_SLOT.get(mode.n) ?? 0) * GW;
        const sm = (HARMONIC_SLOT.get(mode.m) ?? 0) * GW;
        const tn = (HARMONIC_SLOT.get(mode.n) ?? 0) * GH;
        const tm = (HARMONIC_SLOT.get(mode.m) ?? 0) * GH;
        const ca = Math.cos(modeTheta[k]) * w;
        const sa = Math.sin(modeTheta[k]) * w;
        for (let j = 0; j < GH; j++) {
          const row = j * GW;
          const ynj = sinY[tn + j];
          const ymj = sinY[tm + j];
          const py = parY[j];
          for (let i = 0; i < GW; i++) {
            const par = parX[i] * py;
            const A = sinX[sn + i] * ymj;
            const B = sinX[sm + i] * ynj;
            field[row + i] += par * (ca * (A - B) + sa * (A + B));
          }
        }
      }
      // normalise so the sand's response does not depend on how many modes
      // happened to be summed, then take |.| and its gradient once per cell
      let peak = 1e-6;
      for (let i = 0; i < field.length; i++) {
        const a = Math.abs(field[i]);
        if (a > peak) peak = a;
      }
      const inv = 1 / peak;
      for (let i = 0; i < field.length; i++) {
        field[i] *= inv;
        absF[i] = Math.abs(field[i]);
        tex8[i] = Math.round((field[i] * 0.5 + 0.5) * 255);
      }
      // gradient in units of "per plate cell", so the mobility constant means
      // the same thing at any viewport size
      const sx = (GW - 1) / cssW;
      const sy = (GH - 1) / cssH;
      for (let j = 0; j < GH; j++) {
        const row = j * GW;
        for (let i = 0; i < GW; i++) {
          const im = i > 0 ? i - 1 : i;
          const ip = i < GW - 1 ? i + 1 : i;
          const jm = j > 0 ? row - GW : row;
          const jp = j < GH - 1 ? row + GW : row;
          gradX[row + i] = ((absF[row + ip] - absF[row + im]) * sx * cell) / 2;
          gradY[row + i] = ((absF[jp + i] - absF[jm + i]) * sy * cell) / 2;
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        GW,
        GH,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        tex8
      );
    };

    // ---- transport -------------------------------------------------------
    const MOBILITY = 3.4; // cell-widths per second per unit gradient
    const DIFFUSE = 0.34; // cell-widths per sqrt(second) at full amplitude
    const FRICTION = 0.085; // local amplitude below which a grain does not move
    const REST = 0.5; // px of tremble a parked grain still carries

    const stepGrains = (dt: number) => {
      const sxg = (GW - 1) / cssW;
      const syg = (GH - 1) / cssH;
      const mob = MOBILITY * cell * dt * (0.35 + 0.85 * coh);
      // off-resonance the plate has no stable zero set, so the same physical
      // bouncing reads as a storm; on resonance it reads as settling
      const chaos = 0.5 + 2.1 * (1 - coh) + bowAmt * 2.2;
      const jit = DIFFUSE * cell * Math.sqrt(dt) * chaos;
      const maxStep = cell * 0.09;
      // The pointer BOWS the plate, and a bow injects DRIVE, not a force on the
      // sand. The first version only shoved grains sideways around the contact
      // and shaved a little off the friction threshold, which is why it read as
      // doing nothing: a settled grain sits where the local amplitude is a
      // couple of percent, an order below the threshold, so it was never
      // unparked and the figure underneath the cursor simply did not move. The
      // contact now RAISES the local amplitude — the steel under the pointer is
      // being driven harder — which lifts those grains over the threshold and
      // lets the ordinary diffusion throw them off the line. The radial shove
      // stays as the wake of the contact, but scaled by dt, because the old one
      // was per-frame and so meant something different on every machine.
      const bowR = Math.max(90, Math.min(cssW, cssH) * 0.34);
      const bowR2 = bowR * bowR;
      const bowing = presence * (0.3 + bowAmt * 1.25);
      // the wake is deliberately weaker than the energy injection: a strong
      // radial shove alone just sweeps a clean bald disc, which reads as an
      // eraser. Most of what happens under the contact should be the sand being
      // THROWN — isotropic, off the line, a storm — with the bow only giving it
      // a direction.
      const wake = cell * 0.7 * dt;

      for (let i = 0; i < COUNT; i++) {
        let x = gx[i];
        let y = gy[i];
        const fx = x * sxg;
        const fy = y * syg;
        let i0 = fx | 0;
        let j0 = fy | 0;
        if (i0 < 0) i0 = 0;
        else if (i0 > GW - 2) i0 = GW - 2;
        if (j0 < 0) j0 = 0;
        else if (j0 > GH - 2) j0 = GH - 2;
        const tx = fx - i0;
        const ty = fy - j0;
        const a00 = j0 * GW + i0;
        const a10 = a00 + 1;
        const a01 = a00 + GW;
        const a11 = a01 + 1;
        const w00 = (1 - tx) * (1 - ty);
        const w10 = tx * (1 - ty);
        const w01 = (1 - tx) * ty;
        const w11 = tx * ty;

        let amp = absF[a00] * w00 + absF[a10] * w10 + absF[a01] * w01 + absF[a11] * w11;
        const dx = gradX[a00] * w00 + gradX[a10] * w10 + gradX[a01] * w01 + gradX[a11] * w11;
        const dy = gradY[a00] * w00 + gradY[a10] * w10 + gradY[a01] * w01 + gradY[a11] * w11;

        // local energy from the bow, added to the amplitude the grain answers to
        let pushX = 0;
        let pushY = 0;
        if (bowing > 0) {
          const bx = x - ptrX;
          const by = y - ptrY;
          const d2 = bx * bx + by * by;
          if (d2 < bowR2) {
            const q = 1 - d2 / bowR2;
            const bow = q * q * bowing;
            amp += bow * 0.7;
            const invd = 1 / Math.sqrt(Math.max(1, d2));
            pushX = bx * invd * bow * wake;
            pushY = by * invd * bow * wake;
          }
        }

        // A grain only goes anywhere while the plate is throwing it. Below a
        // FRICTION threshold on the local amplitude it stays where it is, the
        // way sand on a real plate sits still wherever the steel is barely
        // moving — and that threshold is the single most load-bearing number
        // in the transport, because without it the walk has no resting state.
        // A grain sitting on a nodal line still feels the second-order
        // along-the-line component of the amplitude gradient (the transverse
        // steepness varies along the line and vanishes at the crossings), so a
        // drift with no cutoff is a ratchet: every grain crawls along the lines
        // into their intersections and the figure degenerates into a lattice of
        // four-pointed clumps with no lines between them at all. Measured on
        // the mode (4,5) figure: at twenty seconds, sixty-odd clumps and not
        // one continuous line. With the cutoff the grains park across the whole
        // quiet band — which IS the nodal line — and the knots at the crossings
        // are the honest widening of that band where both gradients vanish.
        // The threshold drops as the plate is bowed harder and as the drive
        // loses coherence, so a storm really does put the whole plate back in
        // motion instead of leaving a stale figure stencilled underneath it.
        const thresh = FRICTION * (1 - 0.8 * bowAmt) * (0.35 + 0.65 * coh);
        const excess = amp - thresh;
        let stepX: number;
        let stepY: number;
        if (excess <= 0) {
          // parked, but not dead: real sand at a node is still being bounced,
          // it just isn't being thrown anywhere
          stepX = (rnd() + rnd() - 1) * REST;
          stepY = (rnd() + rnd() - 1) * REST;
        } else {
          stepX = -dx * mob * excess;
          stepY = -dy * mob * excess;
          const sl = Math.hypot(stepX, stepY);
          if (sl > maxStep) {
            stepX = (stepX / sl) * maxStep;
            stepY = (stepY / sl) * maxStep;
          }
          // diffusion proportional to how far past the threshold the plate is
          // throwing this grain: violent on an antinode, nothing on a node
          const s = jit * excess;
          stepX += (rnd() + rnd() - 1) * s;
          stepY += (rnd() + rnd() - 1) * s;
        }

        x += stepX + pushX;
        y += stepY + pushY;
        if (x < 0) x = -x;
        else if (x > cssW) x = 2 * cssW - x;
        if (y < 0) y = -y;
        else if (y > cssH) y = 2 * cssH - y;
        gx[i] = x;
        gy[i] = y;
        const o = i * 3;
        gpu[o] = x;
        gpu[o + 1] = y;
        gpu[o + 2] = amp * (0.45 + 1.5 * (1 - coh));
      }
    };

    const seedGrains = () => {
      for (let i = 0; i < COUNT; i++) {
        gx[i] = rnd() * cssW;
        gy[i] = rnd() * cssH;
      }
    };

    // ---- colours ---------------------------------------------------------
    let plateCol: RGB = [0, 0, 0];
    let hiCol: RGB = [1, 1, 1];
    let loCol: RGB = [0, 0, 0];
    let inkCol: RGB = [1, 1, 1];
    let inkGain = 1;
    let isLight = false;

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background")) ?? [0, 0, 0];
      const fg = parseColor(cs.getPropertyValue("--foreground")) ?? [1, 1, 1];
      const muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? mixRGB(bg, fg, 0.5);
      const border = parseColor(cs.getPropertyValue("--border")) ?? mixRGB(bg, fg, 0.2);
      isLight = luminance(bg) > 0.5;

      if (isLight) {
        // pale steel: the plate sits a little below paper white so dark grains
        // have somewhere to print and the sheen has somewhere to go
        plateCol = mixRGB(bg, border, 0.95);
        plateCol = mixRGB(plateCol, muted, 0.16);
        hiCol = bg;
        loCol = mixRGB(muted, fg, 0.45);
        // grains darken the plate multiplicatively, so the source value is the
        // ratio that takes the plate down to ink in one full-strength hit
        inkCol = [
          Math.max(0, Math.min(1, 1 - fg[0] / Math.max(0.02, plateCol[0]))),
          Math.max(0, Math.min(1, 1 - fg[1] / Math.max(0.02, plateCol[1]))),
          Math.max(0, Math.min(1, 1 - fg[2] / Math.max(0.02, plateCol[2]))),
        ];
        inkGain = 0.62;
      } else {
        plateCol = mixRGB(bg, border, 0.62);
        hiCol = mixRGB(border, muted, 0.75);
        loCol = mixRGB(bg, plateCol, 0.15);
        inkCol = mixRGB(fg, bg, 0.02);
        inkGain = 0.5;
      }
    };
    readColors();

    // ---- pointer ---------------------------------------------------------
    let ptrX = 0;
    let ptrY = 0;
    let tgtX = 0;
    let tgtY = 0;
    let lastTgtX = 0;
    let lastTgtY = 0;
    let velX = 0;
    let velY = 0;
    let havePointer = false;
    let presence = 0;
    let bowTarget = 0;
    let bowAmt = 0;
    let rectLeft = 0;
    let rectTop = 0;
    let rectDirty = true;

    const syncRect = () => {
      if (!rectDirty) return;
      const r = wrap.getBoundingClientRect();
      rectLeft = r.left;
      rectTop = r.top;
      rectDirty = false;
    };
    const markRectDirty = () => {
      rectDirty = true;
    };

    const stepPointer = (dt: number) => {
      bowAmt += (bowTarget - bowAmt) * (1 - Math.exp(-dt * 6));
      // presence fades the bow in and out instead of switching it. The detune is
      // now large enough to change which mode the plate is in, so applying it on
      // the frame the cursor crosses the edge would snap the whole field at once
      // — the same class of discontinuity as the sheen strobe, just rarer.
      presence += ((havePointer ? 1 : 0) - presence) * (1 - Math.exp(-dt * 4.5));
      if (!havePointer && presence < 0.002) presence = 0;
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

    // ---- sweep schedule --------------------------------------------------
    // dwell on a resonance long enough to read the figure, then sweep to the
    // next one slowly enough that the storm in between is its own event
    const DWELL = 3.6;
    const SWEEP = 2.3;
    let seqPos = 0;
    let phaseT = 0;
    let dwelling = true;
    let drive = MODES[SEQUENCE[0].k].w;
    let keyDetune = 0; // arrow keys bend the drive, same axis the pointer bows

    // which rotation of each degenerate pair the plate is currently sitting in.
    // Set when the sweep commits to a stop, so the modes still ringing in the
    // background keep the rotation they were last driven in rather than
    // snapping to a new one the instant the drive passes them.
    const modeTheta = new Float32Array(MODES.length);
    for (const v of SEQUENCE) modeTheta[v.k] = v.theta;
    modeTheta[SEQUENCE[0].k] = SEQUENCE[0].theta;

    const scheduledDrive = (t: number) => {
      const from = MODES[SEQUENCE[seqPos].k].w;
      const to = MODES[SEQUENCE[(seqPos + 1) % SEQUENCE.length].k].w;
      if (dwelling) {
        // never perfectly still: a real oscillator wanders, and a dead-still
        // drive makes a locked figure look like a frozen frame
        return from * (1 + 0.0016 * Math.sin(t * 1.7));
      }
      const s = Math.min(1, phaseT / SWEEP);
      const e = s * s * (3 - 2 * s);
      return from + (to - from) * e;
    };

    const advanceSchedule = (dt: number, t: number) => {
      phaseT += dt;
      if (dwelling && phaseT >= DWELL) {
        dwelling = false;
        phaseT = 0;
        // commit the incoming rotation as the sweep leaves, so the next figure
        // grows in its own orientation instead of snapping at the far end
        const next = SEQUENCE[(seqPos + 1) % SEQUENCE.length];
        modeTheta[next.k] = next.theta;
        // move the cell lattice off the seams the last figure buried its sand
        // in, under cover of the storm that is about to start
        shiftLattice();
      } else if (!dwelling && phaseT >= SWEEP) {
        dwelling = true;
        phaseT = 0;
        seqPos = (seqPos + 1) % SEQUENCE.length;
      }
      let d = scheduledDrive(t);
      // the pointer BOWS: horizontal position detunes the drive by up to half
      // the local mode spacing, enough to break a locked figure and pull the
      // neighbouring one in, never enough to take the sweep over.
      // THE SIZE OF THAT NUMBER IS THE WHOLE INTERACTION. The modes in the
      // sequence are ~1.4x apart and a resonance is only a couple of percent
      // wide, so an eight percent detune (what this was) walks the drive off the
      // peak without ever changing WHICH mode dominates: the figure keeps its
      // shape and only dims, which is indistinguishable from nothing happening.
      // Half a mode spacing is ~20%, and that is where a neighbour's response
      // becomes comparable, coherence collapses and the figure actually breaks.
      // A press bows harder — it also stiffens the plate, so it detunes on its
      // own and storms the sand even with the pointer sitting dead centre.
      const bend = presence * (ptrX / Math.max(1, cssW) - 0.5) * 2;
      d *= 1 + (bend * 0.2 + keyDetune * 0.2) * (1 + 0.5 * bowAmt) + bowAmt * 0.13;
      drive = d;
    };

    // ---- frame -----------------------------------------------------------
    let simTime = 0;
    let lastMs = 0;
    let running = false;
    let raf = 0;
    let staticMode = false;
    let disposed = false;
    let onScreen = true;

    const SCALES = [1, 0.78, 0.62];
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;

    const drawPlate = () => {
      gl.useProgram(plateProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      const ap = gl.getAttribLocation(plateProg, "a_pos");
      gl.enableVertexAttribArray(ap);
      gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(U(plateProg, "p", "u_field"), 0);
      gl.uniform2f(U(plateProg, "p", "u_size"), canvas.width, canvas.height);
      gl.uniform2f(U(plateProg, "p", "u_grid"), GW, GH);
      gl.uniform1f(U(plateProg, "p", "u_time"), simTime);
      gl.uniform1f(U(plateProg, "p", "u_amp"), ampNorm);
      gl.uniform1f(U(plateProg, "p", "u_coh"), coh);
      gl.uniform1f(U(plateProg, "p", "u_dir"), isLight ? 0 : 1);
      gl.uniform3f(U(plateProg, "p", "u_plate"), plateCol[0], plateCol[1], plateCol[2]);
      gl.uniform3f(U(plateProg, "p", "u_hi"), hiCol[0], hiCol[1], hiCol[2]);
      gl.uniform3f(U(plateProg, "p", "u_lo"), loCol[0], loCol[1], loCol[2]);
      gl.disable(gl.BLEND);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(ap);
    };

    const drawGrains = () => {
      gl.useProgram(grainProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, grainBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, gpu);
      const ag = gl.getAttribLocation(grainProg, "a_grain");
      gl.enableVertexAttribArray(ag);
      gl.vertexAttribPointer(ag, 3, gl.FLOAT, false, 12, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
      const as = gl.getAttribLocation(grainProg, "a_seed");
      gl.enableVertexAttribArray(as);
      gl.vertexAttribPointer(as, 1, gl.FLOAT, false, 4, 0);
      gl.uniform2f(U(grainProg, "g", "u_size"), cssW, cssH);
      gl.uniform1f(U(grainProg, "g", "u_dpr"), dpr);
      gl.uniform1f(U(grainProg, "g", "u_psize"), 2.1);
      gl.uniform1f(U(grainProg, "g", "u_gain"), inkGain);
      gl.uniform3f(U(grainProg, "g", "u_ink"), inkCol[0], inkCol[1], inkCol[2]);
      gl.enable(gl.BLEND);
      // dark page: sand adds light and piles blow out to a hot line.
      // light page: sand multiplies the plate down and piles print to ink.
      if (isLight) gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
      else gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, COUNT);
      gl.disable(gl.BLEND);
      gl.disableVertexAttribArray(ag);
      gl.disableVertexAttribArray(as);
    };

    const draw = () => {
      if (cssW < 2 || cssH < 2) return;
      drawPlate();
      drawGrains();
    };

    const simulate = (dt: number) => {
      simTime += dt;
      advanceSchedule(dt, simTime);
      stepLattice(dt);
      respond(drive);
      buildField();
      stepGrains(dt);
    };

    // Spin the plate up before the first paint so the opening frame is a
    // resolved figure rather than the random scatter it starts from.
    const spinUp = (steps: number) => {
      for (let i = 0; i < steps; i++) simulate(1 / 60);
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      lastMs = nowMs;
      const dt = Math.min(0.05, Math.max(0.001, rawMs / 1000)) * Math.max(0.05, speed);
      stepPointer(dt);
      simulate(dt);
      draw();

      const clamped = Math.min(50, rawMs);
      frameEma += (clamped - frameEma) * (1 - Math.exp(-clamped / 140));
      if (frameEma > 22) {
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
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      gl.viewport(0, 0, pw, ph);
      draw();
    };

    let seeded = false;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const first = !seeded;
      const changed = Math.abs(rect.width - cssW) > 0.5 || Math.abs(rect.height - cssH) > 0.5;
      if (!changed && seeded) return;
      const oldW = cssW;
      const oldH = cssH;
      cssW = rect.width;
      cssH = rect.height;
      rectLeft = rect.left;
      rectTop = rect.top;
      rectDirty = false;
      cell = Math.min(cssW, cssH) * Math.max(0.25, plateScale);
      // the lattice offsets are in px, so a cell that just changed size makes an
      // in-flight slide meaningless: land it rather than let it crawl
      orgX = orgTX;
      orgY = orgTY;
      allocGrid();
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      if (first) {
        seedGrains();
        seeded = true;
        respond(drive);
        buildField();
        spinUp(150);
      } else if (oldW > 0 && oldH > 0) {
        // keep the sand: rescale it into the new frame rather than re-seeding,
        // which would throw away a settled figure on every window drag
        const sx = cssW / oldW;
        const sy = cssH / oldH;
        for (let i = 0; i < COUNT; i++) {
          gx[i] *= sx;
          gy[i] *= sy;
        }
        respond(drive);
        buildField();
      }
      applyBacking();
    };

    // ---- pointer events --------------------------------------------------
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
    const onEnter = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
    };
    const onMove = (e: PointerEvent) => {
      setTarget(e);
      if (!havePointer) snapPointer();
    };
    const onLeave = () => {
      havePointer = false;
      bowTarget = 0;
    };
    const onDown = (e: PointerEvent) => {
      setTarget(e);
      snapPointer();
      bowTarget = 1;
    };
    const onUp = (e: PointerEvent) => {
      bowTarget = 0;
      if (e.pointerType !== "mouse") havePointer = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") keyDetune = Math.max(-1, keyDetune - 0.25);
      else if (e.key === "ArrowRight" || e.key === "ArrowUp")
        keyDetune = Math.min(1, keyDetune + 0.25);
      else return;
      e.preventDefault();
    };
    const onBlur = () => {
      keyDetune = 0;
    };

    wrap.addEventListener("pointerenter", onEnter);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onLeave);
    wrap.addEventListener("keydown", onKey);
    wrap.addEventListener("blur", onBlur);
    window.addEventListener("scroll", markRectDirty, { passive: true, capture: true });
    window.addEventListener("resize", markRectDirty, { passive: true });

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        // a still frame of a Chladni plate should be a figure, not a scatter
        spinUp(180);
        draw();
      } else {
        staticMode = false;
        if (onScreen && !document.hidden) wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

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

    let lastPaused = pausedRef.current;
    let poll = 0;
    const tick = () => {
      if (pausedRef.current !== lastPaused) {
        lastPaused = pausedRef.current;
        applyMode();
      }
      poll = window.setTimeout(tick, 160);
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

    // preventDefault is what makes the context restorable at all; without it
    // the browser never fires webglcontextrestored.
    const onLost = (e: Event) => {
      e.preventDefault();
      sleep();
    };
    const onRestored = () => {
      if (!disposed) setGlEpoch((n) => n + 1);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    return () => {
      disposed = true;
      sleep();
      ro.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      wrap.removeEventListener("pointerenter", onEnter);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onLeave);
      wrap.removeEventListener("keydown", onKey);
      wrap.removeEventListener("blur", onBlur);
      window.removeEventListener("scroll", markRectDirty, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("resize", markRectDirty);
      window.clearTimeout(poll);
      gl.deleteBuffer(quad);
      gl.deleteBuffer(grainBuf);
      gl.deleteBuffer(seedBuf);
      gl.deleteTexture(fieldTex);
      gl.deleteProgram(plateProg);
      gl.deleteProgram(grainProg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grains, speed, plateScale, glEpoch]);

  return (
    <div
      ref={wrapRef}
      data-sand-lock={uid}
      tabIndex={0}
      role="img"
      aria-label="A vibrating plate scattered with sand; the grains gather along the nodal lines of the plate's resonant modes as the driving frequency sweeps."
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-inset ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}
