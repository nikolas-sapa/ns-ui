"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// MagnetronRacetrackSweep — a full-bleed background eroded by sputter target
// wear: a magnetron's magnetic field confines plasma into an annular
// "racetrack" band on a planar sputter target's face. Production cathodes
// sweep that racetrack's radius back and forth (rotating/oscillating magnet
// assembly) so erosion doesn't dig one fixed groove and waste the rest of the
// target.
//
// EROSION IS RADIALLY SYMMETRIC, SO THE ACCUMULATION BUFFER IS 1D. The
// racetrack is a full annulus at every instant, never a spot — the whole
// erosion history is therefore a function of radius alone, never angle. That
// lets the "persistent, never-cleared accumulation buffer" (same non-clearing
// technique as rime-creep and edm-crater-field, monotonic here rather than
// decaying — real erosion never heals) live in a 256-texel 1D LUMINANCE
// texture instead of a full 2D grid: cheap to stamp, cheap to sample, and it
// is the mechanic's own physical symmetry that licenses the simplification,
// not a performance shortcut taken against the spec.
//
// The composite pass derives a surface normal from the 1D depth field's
// RADIAL gradient only (there is no tangential slope, by construction) and
// projects it back into 2D along the local radial direction — the target
// reads as a real machined groove, brighter/darker as it catches the
// achromatic studio's light bands, not a flat painted ring.
//
// The live glow ring is a SEPARATE, non-accumulated quantity: it is redrawn
// every frame from the sweep's current phase and added to luminance only
// (never colour — real sputtering plasma glows violet/pink, discarded on
// purpose per the monochrome constraint). A pointer brightens the ring
// locally by angle, never by hue, and never touches the sweep clock itself.
// ---------------------------------------------------------------------------

export interface MagnetronRacetrackSweepProps {
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

uniform vec2 u_size;       // css px
uniform float u_dpr;
uniform vec2 u_center;     // css px, target centre
uniform float u_targetR;   // css px, target radius
uniform sampler2D u_erosion; // 1D depth field, N x 1
uniform float u_erosionN;
uniform float u_ringR;         // current live sweep radius, normalized 0..1
uniform float u_ringHalfWidth; // normalized
uniform float u_pointerAngle;
uniform float u_pointerActive;
uniform float u_time;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform vec3 u_bg;
uniform float u_bias;
uniform float u_contrast;

float sampleDepth(float r) {
  return texture2D(u_erosion, vec2(clamp(r, 0.0, 1.0), 0.5)).r;
}

float strip(float el, float at, float width) {
  float d = (el - at) / width;
  return exp(-d * d);
}

// simplified achromatic studio — a machined-metal read needs fewer bands
// than a mirror pool, same family as edm-crater-field's env().
float env(vec3 r) {
  float el = r.y;
  float az = atan(r.x, r.z);
  float L = 0.42;
  L += 0.20 * smoothstep(0.05, 0.62, el);
  L -= 0.18 * smoothstep(0.0, -0.55, el);
  L += 0.28 * strip(el, 0.14, 0.06);
  L += 0.14 * strip(el, 0.46, 0.09);
  L += 0.08 * exp(-pow(sin(az * 1.0 + u_time * 0.03) / 0.42, 2.0));
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
  vec2 p = vec2(gl_FragCoord.x, u_size.y * u_dpr - gl_FragCoord.y) / u_dpr - u_center;
  float dist = length(p);
  float r = dist / u_targetR;

  float edge = smoothstep(1.02, 0.985, r);
  if (edge <= 0.0) {
    gl_FragColor = vec4(u_bg, 1.0);
    return;
  }

  vec2 rDir = dist > 0.0005 ? p / dist : vec2(0.0, 1.0);
  float texel = 1.0 / u_erosionN;
  float d0 = sampleDepth(r);
  float dPlus = sampleDepth(r + texel);
  float dMinus = sampleDepth(r - texel);
  float slope = (dPlus - dMinus) / (2.0 * texel);
  float relief = 2.2;
  vec3 n = normalize(vec3(-slope * relief * rDir, 1.0));
  vec2 vp = p / u_targetR;
  vec3 v = normalize(vec3(vp.x * 0.5, -vp.y * 0.5, 1.0));
  vec3 refl = reflect(-v, n);

  float L = env(refl);
  vec3 l1 = normalize(vec3(-0.28, 0.7, 0.6));
  float s1 = pow(max(dot(refl, l1), 0.0), 90.0);
  L += s1 * 0.6;

  // material removed reads as LOWER relative luminance than the fresh face,
  // in both themes — direction never flips, only bias/contrast do.
  float depthVis = clamp(d0 / 1.4, 0.0, 1.0);
  L -= depthVis * 0.34;

  // live glow ring — additive luminance only, never accumulated, never hue.
  float ringMask = 1.0 - smoothstep(u_ringHalfWidth * 0.7, u_ringHalfWidth * 1.15, abs(r - u_ringR));
  L += ringMask * 0.5;

  if (u_pointerActive > 0.5) {
    float ang = atan(p.x, -p.y);
    float diff = ang - u_pointerAngle;
    diff = mod(diff + 3.14159265, 6.2831853) - 3.14159265;
    float angularBoost = exp(-pow(diff / 0.35, 2.0));
    L += ringMask * angularBoost * 0.35;
  }

  float fres = pow(1.0 - max(dot(n, v), 0.0), 5.0);
  L += fres * 0.08;

  float Lc = clamp((L - 0.5) * u_contrast + 0.5 + u_bias, 0.0, 1.0);
  vec3 col = mix(u_bg, ramp(Lc), edge);
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
    throw new Error(`magnetron-racetrack-sweep: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// Minimal full-bleed fragment-shader host, same shape as weld-pool /
// edm-crater-field's GLSurface: one program, one fullscreen triangle pair,
// lazily-resolved uniform locations.
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

// ---------------------------------------------------------------------------
// Real numbers (docs/specs/r10/magnetron-racetrack-sweep.md):
//  - racetrack radius oscillates between 0.3 and 0.7 of target radius
//  - oscillation period: 22s
//  - racetrack ring width: 0.08 * targetRadius
//  - erosion accumulation rate: 0.002 depth-units/s wherever the ring
//    currently sits — monotonic, never decays
// ---------------------------------------------------------------------------
const RING_MID = 0.5; // (0.3 + 0.7) / 2
const RING_AMPLITUDE = 0.2; // (0.7 - 0.3) / 2
const SWEEP_PERIOD_S = 22;
const RING_WIDTH = 0.08;
const EROSION_RATE = 0.002; // depth-units/s within the band
const EROSION_BUCKETS = 256;
const WARMUP_STEP = 0.25;
const LIVE_WARMUP_S = 40; // "existing erosion groove faint" at t0
const STATIC_WARMUP_S = 480; // deep enough for the dual-band asymmetry to read at a glance
const STATIC_PHASE_S = SWEEP_PERIOD_S * 0.5; // sweep phase 0.5 -> "racetrack-mid"

function ringRAt(tSeconds: number): number {
  return RING_MID + RING_AMPLITUDE * Math.sin((2 * Math.PI * tSeconds) / SWEEP_PERIOD_S);
}

export function MagnetronRacetrackSweep({
  paused = false,
  children,
  className = "",
  style,
}: MagnetronRacetrackSweepProps) {
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

    // persistent, never-cleared radial erosion buffer — 1D because the
    // mechanic itself is radially symmetric (see header comment).
    const depthBuf = new Float32Array(EROSION_BUCKETS);
    const uploadBuf = new Uint8Array(EROSION_BUCKETS);
    let erosionTex: WebGLTexture | null = null;

    let simTime = 0;

    let hoverAngle = 0;
    let pointerActive = 0; // eased 0..1
    let pointerTarget = 0;

    const SCALES = [1, 0.7];
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
    let bg: RGB = [0, 0, 0];
    let bias = 0;
    let contrast = 1.15;

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bgTok = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseHex(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const border = parseHex(cs.getPropertyValue("--border")) ?? [0.18, 0.18, 0.18];
      const black: RGB = [0, 0, 0];
      const white: RGB = [1, 1, 1];
      bg = bgTok;
      if (luminance(bgTok) < 0.5) {
        c0 = mixRGB(bgTok, black, 0.5);
        c1 = mixRGB(border, bgTok, 0.15);
        c2 = muted;
        c3 = fg;
        c4 = mixRGB(fg, white, 0.82);
        bias = -0.06;
        contrast = 1.18;
      } else {
        c0 = mixRGB(fg, black, 0.32);
        c1 = mixRGB(fg, muted, 0.55);
        c2 = mixRGB(muted, bgTok, 0.6);
        c3 = mixRGB(bgTok, muted, 0.16);
        c4 = bgTok;
        bias = 0.03;
        contrast = 1.2;
      }
    };
    readColors();

    // advance the erosion field by dt at absolute sim time t — pure function
    // of the sweep clock, no randomness, so warmup and the live loop use the
    // exact same function and a reduced-motion replay is deterministic.
    const simulate = (dt: number, t: number) => {
      const ringR = ringRAt(t);
      const half = RING_WIDTH / 2;
      const lo = ringR - half;
      const hi = ringR + half;
      const loIdx = Math.max(0, Math.floor(lo * EROSION_BUCKETS));
      const hiIdx = Math.min(EROSION_BUCKETS - 1, Math.ceil(hi * EROSION_BUCKETS));
      for (let i = loIdx; i <= hiIdx; i++) {
        depthBuf[i] += EROSION_RATE * dt;
      }
    };

    const warmup = (seconds: number) => {
      depthBuf.fill(0);
      let t = 0;
      while (t < seconds) {
        const step = Math.min(WARMUP_STEP, seconds - t);
        simulate(step, t);
        t += step;
      }
    };

    const uploadTexture = () => {
      const gl = surface.gl;
      if (!gl) return;
      for (let i = 0; i < EROSION_BUCKETS; i++) {
        const v = Math.max(0, Math.min(1.4, depthBuf[i]!)) / 1.4;
        uploadBuf[i] = Math.round(v * 255);
      }
      if (!erosionTex) {
        erosionTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, erosionTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        gl.bindTexture(gl.TEXTURE_2D, erosionTex);
      }
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        EROSION_BUCKETS,
        1,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        uploadBuf
      );
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, erosionTex);
    };

    const draw = (t: number) => {
      if (!surface.gl || cssW <= 0 || cssH <= 0) return;
      uploadTexture();
      const targetR = Math.min(cssW, cssH) * 0.42;
      surface.v2("u_size", cssW, cssH);
      surface.f("u_dpr", dpr);
      surface.v2("u_center", cssW / 2, cssH / 2);
      surface.f("u_targetR", targetR);
      surface.f("u_erosionN", EROSION_BUCKETS);
      surface.f("u_ringR", ringRAt(t));
      surface.f("u_ringHalfWidth", RING_WIDTH / 2);
      surface.f("u_pointerAngle", hoverAngle);
      surface.f("u_pointerActive", pointerActive);
      surface.f("u_time", t);
      surface.v3("u_c0", c0);
      surface.v3("u_c1", c1);
      surface.v3("u_c2", c2);
      surface.v3("u_c3", c3);
      surface.v3("u_c4", c4);
      surface.v3("u_bg", bg);
      surface.f("u_bias", bias);
      surface.f("u_contrast", contrast);
      surface.i("u_erosion", 0);
      surface.draw(canvas.width, canvas.height);
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
      lastMs = nowMs;
      simTime += dt;

      pointerActive += (pointerTarget - pointerActive) * (1 - Math.exp(-dt / 0.25));

      simulate(dt, simTime);
      draw(simTime);

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
      dpr = Math.min(window.devicePixelRatio || 1, 1.5) * SCALES[scaleIdx]!;
      const pw = Math.round(cssW * dpr);
      const ph = Math.round(cssH * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      draw(staticMode ? STATIC_PHASE_S : simTime);
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
      applyBacking();
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

    // pointer only sets WHERE the ring reads brighter (angle), never the
    // sweep clock — the sweep is a fixed physical cycle, not pointer-driven.
    const onPointerMove = (e: PointerEvent) => {
      syncRect();
      const cx = rectLeft + cssW / 2;
      const cy = rectTop + cssH / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      hoverAngle = Math.atan2(dx, -dy);
      pointerTarget = 1;
      if (staticMode) draw(STATIC_PHASE_S);
    };
    const onPointerLeave = () => {
      pointerTarget = 0;
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
        warmup(STATIC_WARMUP_S);
        draw(STATIC_PHASE_S);
      } else {
        staticMode = false;
        simTime = LIVE_WARMUP_S;
        warmup(LIVE_WARMUP_S);
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
      if (staticMode) draw(STATIC_PHASE_S);
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
      erosionTex = null;
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
      if (erosionTex && surface.gl) surface.gl.deleteTexture(erosionTex);
      erosionTex = null;
      surface.destroy();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      data-magnetron-racetrack-sweep={uid}
      className={`relative isolate h-full w-full touch-none overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

MagnetronRacetrackSweep.displayName = "MagnetronRacetrackSweep";
