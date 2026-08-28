"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// EdmCraterField — a full-bleed metal-surface hero eroded by electrical
// discharge machining: repeated sparks between an electrode and the
// workpiece vaporize material, each discharge leaving a small crater with a
// raised recast rim. Under continuous machining later discharges erode and
// flush away older recast material, so a real EDM surface reaches a
// statistical steady state — birth rate balanced by removal — rather than
// filling in solid. That steady state is the whole point of the component:
// it is never allowed to accumulate toward a saturated frame the way a
// literal "craters pile up" reading would.
//
// IMPLEMENTATION: unlike weld-pool's per-pixel analytic height field, a
// crater field is stamped discretely — a spark either happened somewhere or
// it didn't — so the height field lives in a small CPU-side buffer (a
// LUMINANCE texture, one erosion "cell" of resolution derived from the
// container's SMALLER dimension) rather than being evaluated in the
// fragment shader. Each discharge additively stamps a crater shape (a
// recessed bowl plus a raised outer rim) into that buffer; every real frame
// the whole buffer is multiplied toward zero by an exponential decay factor
// (birth rate is constant, decay is constant, so the resident population is
// a steady simmer, never a monotonic fill). The fragment shader only has to
// sample that texture, central-difference it for a surface normal, and light
// it — the same normal-from-heightfield + achromatic multi-band studio
// approach as weld-pool, simplified to fewer light sources since a pocked
// surface needs less environment structure to read as metal than a mirror
// pool does.
//
// Colours: five stops derived from --background, --foreground, --ns-muted
// and --border (getComputedStyle at mount, re-read on a MutationObserver
// watching documentElement's class) — no literals anywhere, including this
// comment's numbers are unitless ramp positions, not colours. --ns-accent is
// never touched: there is no interactive climactic moment here (a pointer
// only shifts *where* sparks land, never their colour), and that is a
// deliberate reading of the showpiece recipe's standing defect — the exact
// bug edge-yield/granule-churn/shear-billow shipped.
// ---------------------------------------------------------------------------

export interface EdmCraterFieldProps {
  /** Freezes the surface on a composed steady-state frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the field — eyebrow, headline, CTA. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `
precision highp float;

uniform vec2 u_size;      // css px
uniform float u_dpr;
uniform sampler2D u_height;
uniform vec2 u_texRes;    // erosion buffer size in texels
uniform float u_relief;
uniform float u_time;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform float u_bias;
uniform float u_contrast;

// texture stores signed height packed 0..1 -> -1..1
float sampleH(vec2 uv) {
  return texture2D(u_height, uv).r * 2.0 - 1.0;
}

float strip(float el, float at, float width) {
  float d = (el - at) / width;
  return exp(-d * d);
}

// A three-source achromatic studio. Fewer bands than a mirror pool needs —
// a pocked, mostly-flat plate only has to cross one or two reflection bands
// per crater rim to read as machined metal rather than paper.
float env(vec3 r) {
  float el = r.y;
  float az = atan(r.x, r.z);
  float L = 0.40;
  L += 0.22 * smoothstep(0.05, 0.62, el);
  L -= 0.20 * smoothstep(0.0, -0.55, el);
  L += 0.30 * strip(el, 0.12, 0.05);
  L += 0.16 * strip(el, 0.44, 0.08);
  L += 0.10 * exp(-pow(sin(az * 1.0 + u_time * 0.045) / 0.42, 2.0));
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
  vec2 p = vec2(gl_FragCoord.x, u_size.y * u_dpr - gl_FragCoord.y) / u_dpr;
  vec2 uv = p / u_size;

  vec2 texel = 1.0 / u_texRes;
  float h0 = sampleH(uv);
  float hx = sampleH(uv + vec2(texel.x, 0.0));
  float hy = sampleH(uv + vec2(0.0, texel.y));

  vec3 n = normalize(vec3(-(hx - h0) * u_relief, (hy - h0) * u_relief, 1.0));
  vec2 vp = (p - u_size * 0.5) / min(u_size.x, u_size.y);
  vec3 v = normalize(vec3(vp.x * 0.5, -vp.y * 0.5, 1.0));
  vec3 r = reflect(-v, n);

  float L = env(r);

  vec3 l1 = normalize(vec3(-0.30, 0.72, 0.58));
  float s1 = pow(max(dot(r, l1), 0.0), 130.0);
  L += s1 * 0.85;

  float fres = pow(1.0 - max(dot(n, v), 0.0), 5.0);
  L += fres * 0.12;

  float Lc = clamp((L - 0.5) * u_contrast + 0.5 + u_bias, 0.0, 1.0);
  vec3 col = ramp(Lc);
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
    throw new Error(`edm-crater-field: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// Minimal full-bleed fragment-shader host, mirroring weld-pool's GLSurface:
// one program, one fullscreen triangle pair, lazily-resolved uniform
// locations.
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

// Deterministic small PRNG so the reduced-motion freeze frame (and the warm
// seed every mount starts from) is reproducible rather than one-shot noise.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Real numbers (from docs/specs/r9/edm-crater-field.md):
//  - discharge (birth) rate: 14/s, uniform-random position
//  - crater radius: 0.9%-2.2% of the smaller container dimension
//  - crater lifetime: 5.5s birth-to-fully-faded — modeled as exponential
//    decay with a time constant of lifetime/3 (~95% faded by three time
//    constants, which is the "fully faded" read)
//  - steady-state resident population target: 14/s * 5.5s ~= 77 craters
//  - rim: raised band at 1.15x the crater's own depth across the outer 15%
//    of its radius
// ---------------------------------------------------------------------------
const BIRTH_RATE = 14; // craters/s, baseline uniform-random
const LOCAL_BOOST_RATE = 28; // additional craters/s inside the pointer radius (3x local)
const CRATER_LIFETIME = 5.5;
const DECAY_TAU = CRATER_LIFETIME / 3;
const RADIUS_MIN_PCT = 0.009;
const RADIUS_MAX_PCT = 0.022;
const RIM_FRACTION = 0.15;
const RIM_HEIGHT_MULT = 1.15;
const DEPTH = 0.34; // normalized bowl depth, buffer is clamped to [-1, 1]
const TEX_TEXELS_PER_MIN_DIM = 220; // erosion buffer resolution across the smaller dimension
const POINTER_RADIUS_CSS = 150;
const POINTER_BOOST_DECAY_MS = 600;
const WARMUP_SECONDS = 10; // ~5.5x the decay time constant — reaches steady state before first paint
const WARMUP_STEP = 0.2;
// A fixed seed so the reduced-motion / paused frame is the same composed
// steady-state field every time, not whatever the live RNG happened to draw.
const STATIC_SEED = 20260827;

export function EdmCraterField({
  paused = false,
  children,
  className = "",
  style,
}: EdmCraterFieldProps) {
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

    // erosion buffer: JS-side signed-height field, decayed and stamped on
    // the CPU, uploaded as a LUMINANCE texture every real frame.
    let texW = 0;
    let texH = 0;
    let heightBuf: Float32Array = new Float32Array(0);
    let uploadBuf: Uint8Array = new Uint8Array(0);
    let heightTex: WebGLTexture | null = null;

    let rng = mulberry32(Date.now() & 0xffffffff);
    let spawnAcc = 0;
    let localSpawnAcc = 0;

    let hoverX = 0;
    let hoverY = 0;
    let boostAmt = 0; // eased 0..1
    let boostTarget = 0;

    // Simple two-tier adaptive DPR scale: the fragment cost here is a single
    // texture sample plus a handful of exp()/pow() calls per pixel, far
    // cheaper than weld-pool's warped fbm, so one step down is plenty of
    // insurance rather than a full ladder.
    const SCALES = [1, 0.7];
    const BUDGET_OVER = 24;
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;

    let simTime = 0;

    let c0: RGB = [0.03, 0.03, 0.03];
    let c1: RGB = [0.18, 0.18, 0.18];
    let c2: RGB = [0.56, 0.56, 0.56];
    let c3: RGB = [0.93, 0.93, 0.93];
    let c4: RGB = [1, 1, 1];
    let bias = 0;
    let contrast = 1.15;

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const border = parseHex(cs.getPropertyValue("--border")) ?? [0.18, 0.18, 0.18];
      const black: RGB = [0, 0, 0];
      const white: RGB = [1, 1, 1];
      if (luminance(bg) < 0.5) {
        c0 = mixRGB(bg, black, 0.5);
        c1 = mixRGB(border, bg, 0.15);
        c2 = muted;
        c3 = fg;
        c4 = mixRGB(fg, white, 0.82);
        bias = -0.08;
        contrast = 1.18;
      } else {
        c0 = mixRGB(fg, black, 0.32);
        c1 = mixRGB(fg, muted, 0.55);
        c2 = mixRGB(muted, bg, 0.6);
        c3 = mixRGB(bg, muted, 0.16);
        c4 = bg;
        bias = 0.02;
        contrast = 1.22;
      }
    };
    readColors();

    // ---- erosion buffer -------------------------------------------------
    const allocBuffer = () => {
      const minDim = Math.max(1, Math.min(cssW, cssH));
      const pxPerTexel = minDim / TEX_TEXELS_PER_MIN_DIM;
      texW = Math.max(24, Math.round(cssW / pxPerTexel));
      texH = Math.max(24, Math.round(cssH / pxPerTexel));
      // a resize allocates a fresh buffer rather than resampling the old one:
      // a real resize is rare relative to the 5.5s crater lifetime, and the
      // caller always re-seeds to steady state right after allocating (see
      // `resize`), so there is never a visible empty-surface frame.
      heightBuf = new Float32Array(texW * texH);
      uploadBuf = new Uint8Array(texW * texH);
    };

    const stampCrater = (cx: number, cy: number, radiusCss: number, pxPerTexel: number) => {
      const rTex = radiusCss / pxPerTexel;
      const cxTex = cx / pxPerTexel;
      const cyTex = cy / pxPerTexel;
      const rOuter = Math.ceil(rTex) + 1;
      const x0 = Math.max(0, Math.floor(cxTex - rOuter));
      const x1 = Math.min(texW - 1, Math.ceil(cxTex + rOuter));
      const y0 = Math.max(0, Math.floor(cyTex - rOuter));
      const y1 = Math.min(texH - 1, Math.ceil(cyTex + rOuter));
      for (let y = y0; y <= y1; y++) {
        const row = y * texW;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cxTex;
          const dy = y - cyTex;
          const d = Math.sqrt(dx * dx + dy * dy) / rTex;
          if (d > 1.0) continue;
          let h: number;
          if (d < 1.0 - RIM_FRACTION) {
            // recessed bowl, smooth toward the floor at the centre
            const t = d / (1.0 - RIM_FRACTION);
            h = -DEPTH * (1.0 - t * t);
          } else {
            // raised recast rim, peaking mid-band then falling to 0 at d=1
            const t = (d - (1.0 - RIM_FRACTION)) / RIM_FRACTION; // 0..1
            h = DEPTH * RIM_HEIGHT_MULT * Math.sin(Math.min(1, t) * Math.PI);
          }
          heightBuf[row + x] += h;
        }
      }
    };

    // Advance the erosion buffer by dt: decay everything toward zero, then
    // stamp however many new discharges dt's worth of the birth rate (plus
    // any local pointer boost) earns. Called both by the live per-frame loop
    // (small dt) and by the mount/reduced-motion warm-up (larger dt chunks)
    // so a component never opens on an empty, freshly-machined-looking
    // surface.
    const simulate = (dt: number, r: () => number) => {
      if (dt <= 0 || texW === 0) return;
      const decay = Math.exp(-dt / DECAY_TAU);
      for (let i = 0; i < heightBuf.length; i++) heightBuf[i] *= decay;

      const minDim = Math.max(1, Math.min(cssW, cssH));
      const pxPerTexel = minDim / TEX_TEXELS_PER_MIN_DIM;

      spawnAcc += BIRTH_RATE * dt;
      let n = Math.floor(spawnAcc);
      spawnAcc -= n;
      while (n-- > 0) {
        const cx = r() * cssW;
        const cy = r() * cssH;
        const radius = (RADIUS_MIN_PCT + r() * (RADIUS_MAX_PCT - RADIUS_MIN_PCT)) * minDim;
        stampCrater(cx, cy, radius, pxPerTexel);
      }

      if (boostAmt > 0.01) {
        localSpawnAcc += LOCAL_BOOST_RATE * boostAmt * dt;
        let ln = Math.floor(localSpawnAcc);
        localSpawnAcc -= ln;
        while (ln-- > 0) {
          const ang = r() * Math.PI * 2;
          const rad = Math.sqrt(r()) * POINTER_RADIUS_CSS;
          const cx = hoverX + Math.cos(ang) * rad;
          const cy = hoverY + Math.sin(ang) * rad;
          const radius = (RADIUS_MIN_PCT + r() * (RADIUS_MAX_PCT - RADIUS_MIN_PCT)) * minDim;
          stampCrater(cx, cy, radius, pxPerTexel);
        }
      }
    };

    const uploadTexture = () => {
      const gl = surface.gl;
      if (!gl || texW === 0) return;
      for (let i = 0; i < heightBuf.length; i++) {
        const v = Math.max(-1, Math.min(1, heightBuf[i]));
        uploadBuf[i] = Math.round((v * 0.5 + 0.5) * 255);
      }
      if (!heightTex) {
        heightTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, heightTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        gl.bindTexture(gl.TEXTURE_2D, heightTex);
      }
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        texW,
        texH,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        uploadBuf
      );
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, heightTex);
    };

    const draw = () => {
      if (!surface.gl || cssW <= 0 || cssH <= 0) return;
      uploadTexture();
      surface.v2("u_size", cssW, cssH);
      surface.f("u_dpr", dpr);
      surface.v2("u_texRes", texW, texH);
      surface.f("u_relief", 6.5);
      surface.f("u_time", simTime);
      surface.i("u_height", 0);
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
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
      lastMs = nowMs;
      simTime += dt;

      // per-frame exponential ease toward the target — driven by dt, not by
      // elapsed-since-last-pointer-event, so continuous movement (which
      // fires pointermove far more often than once per frame) still ramps
      // boostAmt up instead of re-arming a "just changed" timer every event.
      boostAmt += (boostTarget - boostAmt) * (1 - Math.exp(-dt / (POINTER_BOOST_DECAY_MS / 1000)));

      simulate(dt, rng);
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

    // DPR capped at 1.5, matching weld-pool's full-bleed-area-dominates
    // rationale, applied here even though the per-pixel cost is lighter.
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

    const warmup = (seed: number, seconds: number) => {
      const r = mulberry32(seed);
      spawnAcc = 0;
      localSpawnAcc = 0;
      heightBuf.fill(0);
      let remaining = seconds;
      while (remaining > 0) {
        const step = Math.min(WARMUP_STEP, remaining);
        simulate(step, r);
        remaining -= step;
      }
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      allocBuffer();
      // a resize is a new grid, so re-seed to steady state on it too rather
      // than momentarily showing an empty freshly-resized surface
      if (staticMode) warmup(STATIC_SEED, WARMUP_SECONDS);
      else warmup(Date.now() & 0xffffffff, WARMUP_SECONDS);
      applyBacking();
      draw();
    };

    let rectLeft = 0;
    let rectTop = 0;
    let rectDirty = true;
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

    const onPointerMove = (e: PointerEvent) => {
      syncRect();
      hoverX = e.clientX - rectLeft;
      hoverY = e.clientY - rectTop;
      boostTarget = 1;
      if (staticMode) draw();
    };
    const onPointerLeave = () => {
      boostTarget = 0;
    };

    if (!surface.init()) return; // no WebGL: children still render over the page bg
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", markRectDirty, { passive: true, capture: true });
    window.addEventListener("resize", markRectDirty, { passive: true });

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        simTime = 0;
        warmup(STATIC_SEED, WARMUP_SECONDS);
        draw();
      } else {
        staticMode = false;
        warmup(Date.now() & 0xffffffff, WARMUP_SECONDS);
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
      heightTex = null;
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
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", markRectDirty, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", markRectDirty);
      window.clearTimeout(poll);
      sleep();
      if (heightTex && surface.gl) surface.gl.deleteTexture(heightTex);
      heightTex = null;
      surface.destroy();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      data-edm-crater-field={uid}
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

EdmCraterField.displayName = "EdmCraterField";
