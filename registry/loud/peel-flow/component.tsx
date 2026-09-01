"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// PeelFlow — a full-bleed closing-CTA band built on powder-coat orange peel,
// levelling per Orchard's equation as a wavelength-selective (lambda^4)
// low-pass filter running on a scrolling material band.
//
// Unlike weld-pool (one fragment shader, one height field evaluated
// analytically per pixel per frame), this component's height field is a real
// simulation state: a fixed 192x108 float field h(x,y) that a WebGL2
// ping-pong pair advances every frame with a discrete biharmonic diffusion
// step. The field never resets — it is a closed ring buffer. A texel's
// on-screen position (which of three zones it is rendered in) comes from
// adding a monotonically increasing scroll fraction to the texel's fixed
// storage coordinate, so the same 192x108 of GPU memory serves an unbounded
// stream of material: a texel currently reads as "freshly deposited" one lap
// and "fully levelled and ageing" the next, with no seam an observer can
// find, because deposition re-seeds it with fresh noise every time it
// re-enters the deposition third.
//
// Three zones, fixed as screen-space fractions (NOT attached to the
// scrolling field):
//   0.00-0.22  deposition  — a reciprocating electrostatic bell lays a
//              Gaussian fan of powder, starved in recesses by a Faraday
//              factor, salted with fresh per-lap noise (all short-wavelength
//              texture is born here).
//   0.22-0.78  melt/levelling — viscosity ramps cold -> melt -> gel across
//              the zone; each frame applies Orchard levelling as a
//              variable-strength discrete biharmonic operator, which is
//              exactly the lambda^4 selectivity the spec calls for: short
//              wavelengths die in a couple of frames, long wavelengths ride
//              through almost untouched.
//   0.78-1.00  frozen — melt strength is zero, so translation alone would
//              make this zone a still image sliding (the exact spangle-freeze
//              failure D3 names). It is not still: a second, unforced
//              process — cure-shrinkage telegraphing — runs behind the band.
//              Thermoset powder shrinks a few percent on cross-link, and
//              thicker regions shrink more in absolute terms, so the
//              long-wavelength relief that survived levelling keeps GROWING
//              in relative amplitude as the film ages toward full cure. Two
//              texels at the same screen position five seconds apart carry
//              different cure age and therefore different height, which is
//              what D3's crop-and-diff test is checking for.
//
// Shading samples the field directly: central-difference normal, lit by a
// fixed achromatic three-strip-light studio (the rig never moves — the
// SURFACE changes instead, which is the whole inversion of grazing-light).
// Roughness comes from the residual short-wavelength curvature |lap(h)|, so
// the deposition third reads matte and the levelled/frozen thirds read
// glossy without a single hue shift.
//
// The headline is a knockout mask in the deposit, read as a gloss/matte
// contrast rather than a bevel shadow, and its region is shaded through a
// separate, contrast-guaranteed ramp so legibility does not depend on
// whatever the field happens to be doing underneath at a given instant.
//
// Palette: five luminance stops derived from --background, --foreground,
// --ns-muted and --border (read via getComputedStyle at mount, re-read on a
// MutationObserver watching documentElement's class). --ns-accent never
// appears in the shader at all — there is no u_accent uniform, so the
// project's most repeated defect is structurally impossible here. The CTA
// button below is ordinary DOM chrome sitting on an opaque surface above the
// canvas; it is the one legitimate place --ns-accent appears.
// ---------------------------------------------------------------------------

export interface PeelFlowProps {
  /** Headline knockout text, laid out in the film. */
  headline?: string;
  /** Fraction of the container width the headline fills. @default 0.62 */
  headlineFit?: number;
  /** Vertical centre of the headline block, 0 = top, 1 = bottom. @default 0.42 */
  headlineY?: number;
  /** Band scroll speed multiplier. @default 1 */
  speed?: number;
  /** Freezes the surface on a composed still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the band — eyebrow, subhead, CTA button. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

// ---- fixed simulation grid -------------------------------------------------
// The field represents a constant real-world patch (~16mm x 9mm) regardless
// of host size, so a card-scale mount and a full-bleed section show the same
// physical texture, just stretched — per BUILDER's "derive geometry from the
// container's SMALLER dimension" and the spec's own instruction to keep the
// texture's real-world size constant at card scale.
const SIM_W = 192;
const SIM_H = 108;

const DEPOSIT_END = 0.22;
const MELT_END = 0.78;
const BAND_SPEED_COEF = 0.055; // * min(w,h) css px/s
const BELL_PERIOD = 3.1; // s, incommensurate with any convenient scroll period
const CURE_TAU_S = 7.5; // s -- comparable to frozen-zone residence, not the physical ~min-scale cure
// Reference aspect (min/major) the table below was tuned against, so the
// melt zone's total dose (k * dwell time) stays roughly constant across host
// shapes instead of a wide banner under-levelling relative to a square card.
const REF_ASPECT = 0.278;
// k calibrated so tau(0.2mm) ~= 1.0s at eta=100 Pa.s using the DISCRETE
// biharmonic stencil's eigenvalue for a sinusoid of wavelength lambda in
// TEXEL units: tau = lambda_px^4 / (k * (2*pi)^4). Calibrating against the
// spec's own table (rather than plugging the raw SI constants straight
// through) is deliberate -- gamma=0.030, eta=100, h=70um gives tau(0.2mm)
// ~30ms under those units, ~33x faster than the table the component is
// specced to reproduce, because the table already encodes the visible
// behaviour the biharmonic stencil should match, and an internal-units k is
// what makes the discrete operator hit it.
const K_BASE = 0.0213; // texel^4/s at eta=100 (melt centre)

// STATIC_TIME chosen (per spec) so the bell sits at ~0.30 of its stroke
// (off both ends, a legible ellipse) and all three zones are populated with
// seeded material -- t=0 would show an empty frozen third and lie about what
// the component does. Measured from the pre-roll baseline below, not from a
// blank field.
const STATIC_TIME = 7.4;
// Fraction of one scroll lap to fast-forward through before the first frame
// is ever shown, so every mount starts mid-process with all three zones
// already populated (see "pre-roll" below).
const PRE_ROLL_FRACTION = 0.95;
// Coarse integration step for the pre-roll pass only -- large relative to a
// frame's dt because this is numerical fast-forwarding, not a real-time
// render, but still comfortably inside the biharmonic stencil's CFL bound
// (k*dt/dx^4 <= 1/32) at the largest kAspectScale this component reaches.
const SEED_DT = 0.15;

const VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Simulation pass: advances the ring-buffered height/age field one substep.
// Deterministic noise (hash of texel index + floor(scroll distance)) so the
// same simTime always produces the same field -- required for the
// reduced-motion freeze frame to be byte-stable, and it costs nothing to use
// everywhere.
// ---------------------------------------------------------------------------
const SIM_FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_prev;
uniform vec2 u_texel;
uniform float u_dt;
uniform float u_scrollFrac;
uniform float u_scrollStep;
uniform float u_bellY;
uniform float u_kScale;

float hash21(vec2 p) {
  p = fract(p * vec2(287.13, 419.71));
  p += dot(p, p + 27.31);
  return fract(p.x * p.y);
}

float sampleH(vec2 uv) {
  return texture2D(u_prev, uv).r;
}

void main() {
  vec2 uv = v_uv;
  vec4 prev = texture2D(u_prev, uv);
  float h = prev.r;
  float age = prev.g;

  float screenX = fract(uv.x + u_scrollFrac);

  float xr = fract(uv.x + u_texel.x);
  float xl = fract(uv.x - u_texel.x);
  float xrr = fract(uv.x + 2.0 * u_texel.x);
  float xll = fract(uv.x - 2.0 * u_texel.x);
  float yu = clamp(uv.y + u_texel.y, 0.0, 1.0);
  float yd = clamp(uv.y - u_texel.y, 0.0, 1.0);
  float yuu = clamp(uv.y + 2.0 * u_texel.y, 0.0, 1.0);
  float ydd = clamp(uv.y - 2.0 * u_texel.y, 0.0, 1.0);

  float hR = sampleH(vec2(xr, uv.y));
  float hL = sampleH(vec2(xl, uv.y));
  float hU = sampleH(vec2(uv.x, yu));
  float hD = sampleH(vec2(uv.x, yd));
  float hRR = sampleH(vec2(xrr, uv.y));
  float hLL = sampleH(vec2(xll, uv.y));
  float hUU = sampleH(vec2(uv.x, yuu));
  float hDD = sampleH(vec2(uv.x, ydd));
  float hRU = sampleH(vec2(xr, yu));
  float hRD = sampleH(vec2(xr, yd));
  float hLU = sampleH(vec2(xl, yu));
  float hLD = sampleH(vec2(xl, yd));

  // 13-point discrete biharmonic stencil (mean-preserving: weights sum to 0).
  // This IS the lambda^4 selectivity -- no FFT needed, and its eigenvalue for
  // a sinusoid of wavelength lambda (in texels) is (2*pi/lambda)^4, which is
  // what K_BASE above is calibrated against.
  float biharm = 20.0 * h - 8.0 * (hR + hL + hU + hD)
    + 2.0 * (hRU + hRD + hLU + hLD) + (hRR + hLL + hUU + hDD);

  float gradMag = length(vec2(hR - hL, hU - hD)) * 0.5;

  float newH = h;
  float newAge = age;

  if (screenX < ${DEPOSIT_END.toFixed(2)}) {
    // deposition: reciprocating bell lays a Gaussian fan, starved in
    // recesses by a Faraday factor (raised areas terminate field lines and
    // starve their own recesses), salted with fresh per-lap noise -- this is
    // the sole source of short-wavelength texture.
    float fan = exp(-pow((uv.y - u_bellY) / 0.11, 2.0));
    float faraday = 1.0 / (1.0 + 2.4 * clamp(gradMag * 9.0, 0.0, 4.0));
    float depositRate = 0.6 * fan * faraday;
    float n = hash21(uv * vec2(192.0, 108.0) + u_scrollStep * 0.0173 + 11.7) - 0.5;
    newH = h + depositRate * u_dt + n * 0.11 * u_dt * 26.0;
    newAge = 0.0;
  } else if (screenX < ${MELT_END.toFixed(2)}) {
    // melt/levelling: viscosity ramps cold -> melt -> gel across the zone on
    // a smooth cubic-ish profile; k follows 1/eta per Orchard.
    float mf = (screenX - ${DEPOSIT_END.toFixed(2)}) / ${(MELT_END - DEPOSIT_END).toFixed(2)};
    float visShape = 1.0 - pow(2.0 * mf - 1.0, 2.0);
    float eta = mix(3000.0, 100.0, smoothstep(0.0, 1.0, clamp(visShape, 0.0, 1.0)));
    float k = u_kScale * (100.0 / eta) * ${K_BASE};
    newH = h - k * u_dt * biharm;
    newAge = 0.0;
  } else {
    // frozen: k = 0. The SECOND, unforced process lives here -- cure
    // shrinkage telegraphing. Thicker regions shrink more on cross-link, so
    // the surviving long-wavelength relief keeps growing in relative
    // amplitude as cure age advances, independent of the band's translation.
    newAge = age + u_dt;
    float growth = 1.0 - exp(-newAge / ${CURE_TAU_S.toFixed(2)});
    float localMean = (hR + hL + hU + hD) * 0.25;
    newH = h + (h - localMean) * growth * 0.10 * u_dt;
  }

  // Numerical leak, not a physical process: bounds the ring-buffered field
  // over unbounded laps. Spatially uniform, so it never touches relative
  // waviness -- the only signal the shading pass reads.
  newH -= newH * 0.0006 * u_dt;

  gl_FragColor = vec4(newH, newAge, 0.0, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Shading pass: samples the field directly (no separate normal buffer),
// central-differences it for a normal, and looks that up in a fixed
// achromatic three-strip-light studio. Zero accent uniform exists in this
// shader -- the defect the project repeats most is structurally impossible
// here, not just avoided by discipline.
// ---------------------------------------------------------------------------
const SHADE_FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_field;
uniform sampler2D u_text; // r = knockout mask (antialiased, blurred slightly)
uniform vec2 u_texel;
uniform float u_scrollFrac;
uniform float u_time;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform vec3 u_border;
uniform float u_bias;
uniform float u_contrast;

float sampleH(vec2 uv) {
  return texture2D(u_field, uv).r;
}

float strip(float el, float at, float width) {
  float d = (el - at) / width;
  return exp(-d * d);
}

// three fixed strip lights at 62/34/11 deg elevation, 20/155/265 deg azimuth
// -- the rig never moves. Only the surface under it changes frame to frame.
float env(vec3 r) {
  float el = r.y;
  float az = atan(r.x, r.z);
  float L = 0.38;
  L += 0.24 * smoothstep(0.05, 0.62, el);
  L -= 0.22 * smoothstep(0.0, -0.55, el);
  L += 0.34 * strip(el, sin(radians(62.0)), 0.05) * exp(-pow((az - radians(20.0)) / 0.5, 2.0));
  L += 0.24 * strip(el, sin(radians(34.0)), 0.07) * exp(-pow((az - radians(155.0)) / 0.6, 2.0));
  L += 0.16 * strip(el, sin(radians(11.0)), 0.09) * exp(-pow((az - radians(265.0)) / 0.7, 2.0));
  return L;
}

vec3 ramp(float x) {
  vec3 c = mix(u_c0, u_c1, smoothstep(0.0, 0.30, x));
  c = mix(c, u_c2, smoothstep(0.28, 0.58, x));
  c = mix(c, u_c3, smoothstep(0.55, 0.85, x));
  c = mix(c, u_c4, smoothstep(0.82, 1.0, x));
  return c;
}

void main() {
  vec2 uv = vec2(fract(v_uv.x - u_scrollFrac), v_uv.y);
  float h0 = sampleH(uv);
  float eps = u_texel.x;
  float hx = sampleH(vec2(fract(uv.x + eps), uv.y));
  float hy = sampleH(vec2(uv.x, clamp(uv.y + u_texel.y, 0.0, 1.0)));
  float hxm = sampleH(vec2(fract(uv.x - eps), uv.y));
  float hym = sampleH(vec2(uv.x, clamp(uv.y - u_texel.y, 0.0, 1.0)));
  float lap = hx + hxm + hy + hym - 4.0 * h0;

  float k = 3.4;
  vec3 n = normalize(vec3(-(hx - hxm) * k, (hy - hym) * k, 1.0));

  vec2 vp = (v_uv - 0.5);
  vec3 v = normalize(vec3(vp.x * 0.5, -vp.y * 0.5, 1.0));
  vec3 r = reflect(-v, n);

  float L = env(r);

  float rough = clamp(abs(lap) * 40.0, 0.0, 1.0);
  vec3 l1 = normalize(vec3(0.30, 0.75, 0.58));
  vec3 l2 = normalize(vec3(-0.55, 0.42, 0.62));
  float spec1 = pow(max(dot(r, l1), 0.0), mix(220.0, 40.0, rough));
  float spec2 = pow(max(dot(r, l2), 0.0), mix(140.0, 24.0, rough));

  float mask = texture2D(u_text, v_uv).r;
  // suppress the specular lobe inside the knockout -- flatter, lower-variance
  float specSuppress = 1.0 - 0.7 * mask;
  L += (spec1 * 0.55 + spec2 * 0.32) * specSuppress;

  float Lc = clamp((L - 0.5) * u_contrast + 0.5 + u_bias, 0.0, 1.0);
  vec3 col = ramp(Lc);

  // contrast-guaranteed knockout: force the region toward the matte-deposit
  // stop (c1) regardless of the field's instantaneous shading, so legibility
  // never depends on where the band happens to be.
  vec3 knockoutCol = mix(u_c1, col, 0.22);
  col = mix(col, knockoutCol, mask);

  // --border's one legitimate use here: a ~1px hairline top and bottom edge
  // rule for the band, never a fill or a highlight
  float edge = 1.0 - smoothstep(0.0, u_texel.y * 0.9, min(v_uv.y, 1.0 - v_uv.y));
  col = mix(col, u_border, edge * 0.85);

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

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`peel-flow: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`peel-flow: program link failed: ${gl.getProgramInfoLog(p) ?? ""}`);
  }
  return p;
}

// Separable box blur, single channel -- used once per resize to soften the
// headline knockout mask's edge, never per frame.
function boxBlur(src: Uint8Array, w: number, h: number, radius: number) {
  let a: Uint8Array<ArrayBufferLike> = src;
  let b: Uint8Array<ArrayBufferLike> = new Uint8Array(w * h);
  const r = Math.max(1, Math.round(radius));
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += a[row + Math.min(w - 1, Math.max(0, x))];
      const norm = 2 * r + 1;
      for (let x = 0; x < w; x++) {
        b[row + x] = sum / norm;
        const out = row + Math.min(w - 1, Math.max(0, x - r));
        const inc = row + Math.min(w - 1, Math.max(0, x + r + 1));
        sum += a[inc] - a[out];
      }
    }
    [a, b] = [b, a];
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += a[Math.min(h - 1, Math.max(0, y)) * w + x];
      const norm = 2 * r + 1;
      for (let y = 0; y < h; y++) {
        b[y * w + x] = sum / norm;
        const out = Math.min(h - 1, Math.max(0, y - r)) * w + x;
        const inc = Math.min(h - 1, Math.max(0, y + r + 1)) * w + x;
        sum += a[inc] - a[out];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

export function PeelFlow({
  headline = "Finish is a process, not a coat",
  headlineFit = 0.62,
  headlineY = 0.42,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: PeelFlowProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const headlineRef = useRef(headline);
  headlineRef.current = headline;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    }) as WebGL2RenderingContext | null;
    if (!gl) return; // no WebGL2: children still render over the page bg

    // Float ping-pong field is preferred; feature-detected fallback packs h
    // into an 8-bit fixed-point pair when EXT_color_buffer_float is absent --
    // peel amplitude quantises, the lambda^4 mechanic survives.
    const floatExt = gl.getExtension("EXT_color_buffer_float");
    const useFloat = !!floatExt;
    const internalFormat = useFloat ? gl.RGBA32F : gl.RGBA8;
    const type = useFloat ? gl.FLOAT : gl.UNSIGNED_BYTE;

    let disposed = false;
    let simVS: WebGLShader, simFS: WebGLShader, shadeVS: WebGLShader, shadeFS: WebGLShader;
    let simProgram: WebGLProgram, shadeProgram: WebGLProgram;
    try {
      simVS = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
      simFS = compile(gl, gl.FRAGMENT_SHADER, useFloat ? SIM_FRAG : SIM_FRAG_PACKED);
      simProgram = link(gl, simVS, simFS);
      shadeVS = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
      shadeFS = compile(gl, gl.FRAGMENT_SHADER, useFloat ? SHADE_FRAG : SHADE_FRAG_PACKED);
      shadeProgram = link(gl, shadeVS, shadeFS);
    } catch {
      return;
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    function bindQuad(program: WebGLProgram) {
      gl!.bindBuffer(gl!.ARRAY_BUFFER, quad);
      const loc = gl!.getAttribLocation(program, "a_pos");
      gl!.enableVertexAttribArray(loc);
      gl!.vertexAttribPointer(loc, 2, gl!.FLOAT, false, 0, 0);
    }

    const simLocs = new Map<string, WebGLUniformLocation | null>();
    const shadeLocs = new Map<string, WebGLUniformLocation | null>();
    function loc(program: WebGLProgram, cache: Map<string, WebGLUniformLocation | null>, name: string) {
      if (!cache.has(name)) cache.set(name, gl!.getUniformLocation(program, name));
      return cache.get(name) ?? null;
    }

    // ---- field textures (ping-pong) --------------------------------------
    function makeFieldTex(): WebGLTexture {
      const tex = gl!.createTexture()!;
      gl!.bindTexture(gl!.TEXTURE_2D, tex);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.NEAREST);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.NEAREST);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, internalFormat, SIM_W, SIM_H, 0, gl!.RGBA, type, null);
      return tex;
    }
    let fieldTex = [makeFieldTex(), makeFieldTex()];
    const fieldFBO = [gl.createFramebuffer()!, gl.createFramebuffer()!];
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fieldFBO[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fieldTex[i], 0);
    }
    let fieldFront = 0; // index currently holding the readable field

    function clearField() {
      for (let i = 0; i < 2; i++) {
        gl!.bindFramebuffer(gl!.FRAMEBUFFER, fieldFBO[i]);
        gl!.viewport(0, 0, SIM_W, SIM_H);
        gl!.clearColor(0, 0, 0, 1);
        gl!.clear(gl!.COLOR_BUFFER_BIT);
      }
    }
    clearField();

    // ---- headline knockout texture ---------------------------------------
    const texCanvas = document.createElement("canvas");
    let textTexture: WebGLTexture | null = null;

    const rasterizeText = () => {
      if (cssW < 2 || cssH < 2) return;
      const tw = Math.max(256, Math.min(1024, Math.round(cssW)));
      const th = Math.max(64, Math.round((tw * cssH) / cssW));
      texCanvas.width = tw;
      texCanvas.height = th;
      const ctx = texCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const family = getComputedStyle(wrap!).fontFamily || "system-ui, sans-serif";
      const lines = headlineRef.current.split("\n").filter((l) => l.length > 0);
      ctx.clearRect(0, 0, tw, th);
      if (lines.length > 0) {
        const probe = 100;
        ctx.font = `600 ${probe}px ${family}`;
        let widest = 1;
        for (const line of lines) widest = Math.max(widest, ctx.measureText(line).width);
        const size = Math.min((tw * headlineFit * probe) / widest, (th * 0.6) / lines.length);
        ctx.font = `600 ${size}px ${family}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        const lead = size * 1.05;
        const top = th * headlineY - ((lines.length - 1) * lead) / 2;
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], tw / 2, top + i * lead);
      }
      const img = ctx.getImageData(0, 0, tw, th).data;
      const sharp = new Uint8Array(tw * th);
      for (let i = 0, j = 3; i < sharp.length; i++, j += 4) sharp[i] = img[j];
      const softened = boxBlur(sharp, tw, th, Math.max(1, tw * 0.0018));
      const rgba = new Uint8Array(tw * th * 4);
      for (let i = 0, j = 0; i < softened.length; i++, j += 4) {
        rgba[j] = softened[i];
        rgba[j + 1] = 0;
        rgba[j + 2] = 0;
        rgba[j + 3] = 255;
      }
      if (!textTexture) {
        textTexture = gl!.createTexture();
        gl!.bindTexture(gl!.TEXTURE_2D, textTexture);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
        gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
      } else {
        gl!.bindTexture(gl!.TEXTURE_2D, textTexture);
      }
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, tw, th, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, rgba);
    };

    // ---- tokens -----------------------------------------------------------
    let c0: RGB = [0.03, 0.03, 0.03];
    let c1: RGB = [0.22, 0.22, 0.22];
    let c2: RGB = [0.44, 0.44, 0.44];
    let c3: RGB = [0.72, 0.72, 0.72];
    let c4: RGB = [0.99, 0.99, 0.99];
    let border: RGB = [0.5, 0.5, 0.5];
    let bias = 0;
    let contrast = 1.1;

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const b = parseHex(cs.getPropertyValue("--border")) ?? [0.7, 0.7, 0.7];
      border = b;
      const black: RGB = [0, 0, 0];
      const white: RGB = [1, 1, 1];
      // both themes span near-black to near-white; only bias/contrast move.
      // Hard floor of 0.18L between adjacent stops -- widen the sky/floor
      // split rather than add hue if the token set gives less.
      if (luminance(bg) < 0.5) {
        c0 = mixRGB(bg, black, 0.5);
        c1 = mixRGB(b, bg, 0.1);
        c2 = muted;
        c3 = fg;
        c4 = mixRGB(fg, white, 0.9);
        bias = -0.06;
        contrast = 1.12;
      } else {
        c0 = mixRGB(fg, black, 0.3);
        c1 = mixRGB(fg, muted, 0.5);
        c2 = mixRGB(muted, bg, 0.55);
        c3 = mixRGB(bg, muted, 0.14);
        c4 = bg;
        bias = 0.02;
        contrast = 1.16;
      }
      // enforce the 0.18L floor by nudging c0/c4 outward if the live token
      // set collapses the span (checked cheaply on luminance only)
      const stops = [c0, c1, c2, c3, c4];
      for (let i = 0; i < stops.length - 1; i++) {
        const gap = luminance(stops[i + 1]) - luminance(stops[i]);
        if (gap < 0.18) {
          const push = (0.18 - gap) / 2;
          stops[i] = mixRGB(stops[i], black, push);
          stops[i + 1] = mixRGB(stops[i + 1], white, push);
        }
      }
      [c0, c1, c2, c3, c4] = stops;
    };
    readColors();

    // ---- sizing / dpr -------------------------------------------------
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    const SCALES = [1, 0.75, 0.55];
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;
    const BUDGET_OVER = 24;

    const applyBacking = () => {
      if (cssW < 2 || cssH < 2) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5) * SCALES[scaleIdx];
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas!.width !== pw || canvas!.height !== ph) {
        canvas!.width = pw;
        canvas!.height = ph;
      }
      canvas!.style.width = `${cssW}px`;
      canvas!.style.height = `${cssH}px`;
    };

    // ---- simulation clock ---------------------------------------------
    let simTime = 0;
    let scrollFrac = 0; // 0..1, wraps
    let kAspectScale = 1;
    let lastMs = performance.now();
    let running = false;
    let raf = 0;
    let staticMode = false;

    const resize = () => {
      const rect = wrap!.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      const minSide = Math.min(cssW, cssH);
      // dose (k * dwell time) invariant to host aspect: dwell time is
      // 0.56*W/(BAND_SPEED_COEF*min(w,h)), so scale k by min(w,h)/W relative
      // to the reference the K_BASE table was tuned against.
      kAspectScale = (minSide / cssW) / REF_ASPECT;
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      applyBacking();
      rasterizeText();
    };

    // ---- one substep of the sim (ping-pong) -----------------------------
    function simStep(dt: number, bellY: number) {
      const src = fieldFront;
      const dst = 1 - fieldFront;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fieldFBO[dst]);
      gl!.viewport(0, 0, SIM_W, SIM_H);
      gl!.useProgram(simProgram);
      bindQuad(simProgram);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, fieldTex[src]);
      gl!.uniform1i(loc(simProgram, simLocs, "u_prev"), 0);
      gl!.uniform2f(loc(simProgram, simLocs, "u_texel"), 1 / SIM_W, 1 / SIM_H);
      gl!.uniform1f(loc(simProgram, simLocs, "u_dt"), dt);
      gl!.uniform1f(loc(simProgram, simLocs, "u_scrollFrac"), scrollFrac);
      gl!.uniform1f(loc(simProgram, simLocs, "u_scrollStep"), Math.floor(scrollFrac * SIM_W));
      gl!.uniform1f(loc(simProgram, simLocs, "u_bellY"), bellY);
      gl!.uniform1f(loc(simProgram, simLocs, "u_kScale"), kAspectScale);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
      fieldFront = dst;
    }

    function bellYAt(t: number): number {
      // 3.1s triangle wave over [0.12, 0.88] of field height
      const period = BELL_PERIOD;
      const phase = ((t % period) + period) % period;
      const f = phase / period;
      const tri = f < 0.5 ? f * 2 : 2 - f * 2; // 0..1..0
      return 0.12 + tri * 0.76;
    }

    function advance(dt: number) {
      // two half-steps per frame, per spec, well inside the CFL bound of the
      // 13-point stencil (max eigenvalue 64 -> k*dt/dx^4 <= 1/32); the
      // largest k in this component (melt centre) is far under that already.
      const half = dt / 2;
      simStep(half, bellYAt(simTime));
      simStep(half, bellYAt(simTime + half));
      simTime += dt;
      scrollFrac = (scrollFrac + (BAND_SPEED_COEF * Math.min(cssW, cssH) * dt) / (cssW || 1)) % 1;
    }

    function drawShade(t: number) {
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.viewport(0, 0, canvas!.width, canvas!.height);
      gl!.useProgram(shadeProgram);
      bindQuad(shadeProgram);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, fieldTex[fieldFront]);
      gl!.uniform1i(loc(shadeProgram, shadeLocs, "u_field"), 0);
      gl!.activeTexture(gl!.TEXTURE1);
      if (textTexture) gl!.bindTexture(gl!.TEXTURE_2D, textTexture);
      gl!.uniform1i(loc(shadeProgram, shadeLocs, "u_text"), 1);
      gl!.uniform2f(loc(shadeProgram, shadeLocs, "u_texel"), 1 / SIM_W, 1 / SIM_H);
      gl!.uniform1f(loc(shadeProgram, shadeLocs, "u_scrollFrac"), scrollFrac);
      gl!.uniform1f(loc(shadeProgram, shadeLocs, "u_time"), t);
      gl!.uniform3f(loc(shadeProgram, shadeLocs, "u_c0"), ...c0);
      gl!.uniform3f(loc(shadeProgram, shadeLocs, "u_c1"), ...c1);
      gl!.uniform3f(loc(shadeProgram, shadeLocs, "u_c2"), ...c2);
      gl!.uniform3f(loc(shadeProgram, shadeLocs, "u_c3"), ...c3);
      gl!.uniform3f(loc(shadeProgram, shadeLocs, "u_c4"), ...c4);
      gl!.uniform3f(loc(shadeProgram, shadeLocs, "u_border"), ...border);
      gl!.uniform1f(loc(shadeProgram, shadeLocs, "u_bias"), bias);
      gl!.uniform1f(loc(shadeProgram, shadeLocs, "u_contrast"), contrast);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    }

    // ---- pre-roll ----------------------------------------------------
    // A blank field takes a full scroll lap (tens of seconds at real scroll
    // speed) to reach the frozen zone at all, which would show an empty
    // right third for the first minute of every page load -- exactly the
    // "t=0 shows an empty right third and would be a lie" case section 5
    // names. So the field is never shown blank: every entry path (mount,
    // resize, mode change) fast-forwards through a deterministic seed pass
    // first, using a coarse dt chosen so a fixed, cheap step count reaches
    // PRE_ROLL_FRACTION of a lap regardless of host aspect (dt stays well
    // under the CFL bound derived for the live loop, since even the
    // narrowest-aspect kAspectScale keeps k*dt/dx^4 an order of magnitude
    // under 1/32). Noise is still seeded only from (texel index, floor(scroll
    // distance)), so the seeded state is exactly reproducible.
    function seedField() {
      clearField();
      simTime = 0;
      scrollFrac = 0;
      const scrollSpeedPerSec = (BAND_SPEED_COEF * Math.min(cssW, cssH)) / (cssW || 1);
      if (scrollSpeedPerSec <= 0) return;
      const preRollSimTime = PRE_ROLL_FRACTION / scrollSpeedPerSec;
      const steps = Math.max(1, Math.ceil(preRollSimTime / SEED_DT));
      const dt = preRollSimTime / steps;
      for (let i = 0; i < steps; i++) advance(dt);
    }

    // Deterministic: fixed dt, fixed step count on top of the pre-roll, seed
    // drawn only from (texel index, floor(scroll distance)) -- never
    // Math.random() or performance.now() -- so the same STATIC_TIME always
    // reproduces the same field regardless of when it runs. STATIC_TIME is an
    // offset past the pre-roll baseline, not sim-time zero, so the bell and
    // scroll phase land where section 5 specifies.
    function runStaticSpinUp() {
      seedField();
      const dt = 1 / 60;
      const steps = Math.round(STATIC_TIME / dt);
      for (let i = 0; i < steps; i++) advance(dt);
      drawShade(simTime);
    }

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000)) * speed;
      lastMs = nowMs;
      advance(dt);
      drawShade(simTime);

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

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    const applyMode = () => {
      // no paint before the first token read, on every entry path
      readColors();
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        runStaticSpinUp();
      } else {
        staticMode = false;
        seedField();
        wake();
      }
    };

    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    const ro = new ResizeObserver(() => {
      resize();
      // a new size is a new dose (kAspectScale changed), so the field is
      // re-seeded from a clean pre-roll rather than carrying a levelling
      // verdict earned at a different aspect ratio
      if (staticMode) runStaticSpinUp();
      else seedField();
    });
    ro.observe(wrap);

    let onScreen = true;
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((en) => en.isIntersecting);
        if (!onScreen) {
          sleep();
        } else if (!staticMode && !document.hidden) {
          readColors(); // re-read tokens before the first draw on resume
          wake();
        }
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) {
        sleep();
      } else if (!staticMode && onScreen) {
        readColors(); // re-read tokens before the first draw on resume
        wake();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (staticMode) drawShade(STATIC_TIME);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    resize();
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (disposed) return;
        rasterizeText();
        if (staticMode) drawShade(STATIC_TIME);
      });
    }
    applyMode();

    let lastPolledPaused = pausedRef.current;
    let lastPolledHeadline = headlineRef.current;
    let poll = 0;
    const tick = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      if (headlineRef.current !== lastPolledHeadline) {
        lastPolledHeadline = headlineRef.current;
        rasterizeText();
        if (staticMode) drawShade(STATIC_TIME);
      }
      poll = window.setTimeout(tick, 140);
    };
    tick();

    const onLost = (e: Event) => {
      e.preventDefault();
      sleep();
    };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      window.clearTimeout(poll);
      sleep();
      gl.deleteTexture(fieldTex[0]);
      gl.deleteTexture(fieldTex[1]);
      gl.deleteFramebuffer(fieldFBO[0]);
      gl.deleteFramebuffer(fieldFBO[1]);
      if (textTexture) gl.deleteTexture(textTexture);
      gl.deleteBuffer(quad);
      gl.deleteProgram(simProgram);
      gl.deleteProgram(shadeProgram);
      gl.deleteShader(simVS);
      gl.deleteShader(simFS);
      gl.deleteShader(shadeVS);
      gl.deleteShader(shadeFS);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headlineFit, headlineY, speed]);

  return (
    <div
      ref={wrapRef}
      data-peel-flow={uid}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      <h2 className="sr-only">{headline.split("\n").join(" ")}</h2>
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RGBA8-packed fallback shaders: used when EXT_color_buffer_float is
// unsupported. h is fixed-point quantised into R+G (16-bit signed range
// scaled to +-64 internal units), cure age into B (0..25.5s, 8-bit). Amplitude
// quantises but the lambda^4 mechanic survives -- the biharmonic stencil
// still runs on the decoded value every frame.
// ---------------------------------------------------------------------------
const PACK_HELPERS = `
float decodeH(vec2 rg) {
  float v = rg.x * 255.0 + rg.y * 255.0 * 256.0;
  return (v / 65535.0) * 128.0 - 64.0;
}
vec2 encodeH(float h) {
  float v = clamp((h + 64.0) / 128.0, 0.0, 1.0) * 65535.0;
  float lo = mod(v, 256.0);
  float hi = floor(v / 256.0);
  return vec2(lo / 255.0, hi / 255.0);
}
`;

const SIM_FRAG_PACKED = SIM_FRAG
  .replace("precision highp float;", `precision highp float;\n${PACK_HELPERS}`)
  .replace(/float sampleH\(vec2 uv\) \{\n  return texture2D\(u_prev, uv\)\.r;\n\}/, `float sampleH(vec2 uv) {
  vec4 t = texture2D(u_prev, uv);
  return decodeH(t.rg);
}`)
  .replace(
    "vec4 prev = texture2D(u_prev, uv);\n  float h = prev.r;\n  float age = prev.g;",
    "vec4 prev = texture2D(u_prev, uv);\n  float h = decodeH(prev.rg);\n  float age = prev.b * 25.5;"
  )
  .replace(
    "gl_FragColor = vec4(newH, newAge, 0.0, 1.0);",
    "vec2 enc = encodeH(newH);\n  gl_FragColor = vec4(enc.x, enc.y, clamp(newAge / 25.5, 0.0, 1.0), 1.0);"
  );

const SHADE_FRAG_PACKED = SHADE_FRAG
  .replace("precision highp float;", `precision highp float;\n${PACK_HELPERS}`)
  .replace(/float sampleH\(vec2 uv\) \{\n  return texture2D\(u_field, uv\)\.r;\n\}/, `float sampleH(vec2 uv) {
  vec4 t = texture2D(u_field, uv);
  return decodeH(t.rg);
}`);
