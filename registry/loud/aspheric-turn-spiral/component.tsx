"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// AsphericTurnSpiral — a full-bleed WebGL hero rendering a lens blank mid
// single-point diamond turning: a spiral groove cut from center to rim by a
// tool whose radial feed reverses smoothly rather than ever resetting.
//
// ONE HEIGHT FIELD, three contributions, evaluated per pixel and central-
// differenced for a surface normal:
//   (1) a shallow concave bowl (-BOWL_AMP*r^2), the lens's own aspheric sag
//   (2) the spiral groove itself, cos(2π*(θ/2π + turns(r))) where turns(r) =
//       N_BASE*r + N_ASPH*r^2 — the r^2 term is what makes the groove pitch
//       tighten toward the rim the way a real aspheric surface's local slope
//       increases with radius, not a uniform Archimedean spiral
//   (3) a faint isotropic pre-cut texture on the still-blank annulus outside
//       the tool's current radius, so "already turned" and "not yet turned"
//       read as two different surfaces, not one disc with a groove painted
//       partway across it
//
// THE FEED IS A TRIANGLE WAVE, never a reset: cutRadius(t) sweeps center→rim
// over 45s then rim→center over the next 45s (FEED_PERIOD = 90s total), so
// the tool is always mid-traverse — reversing direction is itself a real
// process event (a verification or re-finishing pass), not fabricated
// motion. The boundary between cut and uncut carries a bright edgeGlow term:
// freshly-turned surface catches light hardest right at the tool's current
// position, which is the slow (45s-scale) structural cue for "alive at
// rest."
//
// THE FAST, FOLLOWABLE cue is separate: the reflection environment's azimuth
// is rotated by u_time * SPINDLE_RATE (0.08 rev/s, slowed hard from a real
// SPDT spindle's ~600-3000rpm and documented here rather than driven 1:1 —
// the round 9 decoupling rule), so a specular band sweeps around the groove
// continuously. A second, higher-frequency azimuthal panel (4x the spindle
// rate) buys a visible band crossing roughly every ~3s without needing the
// base rotation itself to be that fast.
//
// MONOCHROME: five luminance stops derived from --background, --foreground,
// --ns-muted and --border (getComputedStyle at mount, re-read on a
// MutationObserver watching documentElement's class). No --ns-accent
// anywhere in the shader — this is a full-bleed sheet like weld-pool, so the
// ramp spans near-black to near-white in BOTH themes; only bias/contrast
// move between themes, never direction. Density comes from the environment
// having several narrow light sources at different elevations plus two
// azimuthal panels, the same "give the room structure, not the material
// more noise" approach as weld-pool, so an almost-flat patch of the bowl
// still crosses multiple reflection bands.
//
// POINTER: a gentle parallax only — the pointer nudges the view direction
// (±0.18 of view-space xy, eased over ~150ms), orbiting the specular
// highlight across the groove. It never restarts the cut, changes the feed
// direction, or touches spiral phase.
// ---------------------------------------------------------------------------

export interface AsphericTurnSpiralProps {
  /** Flow/feed speed multiplier. @default 1 */
  speed?: number;
  /** Feature scale — smaller reads as a tighter, more zoomed-in disc. @default 1 */
  scale?: number;
  /** How far the groove and bowl stand out of the surface, 0..1+. @default 1 */
  relief?: number;
  /** Freezes the surface on a composed still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the surface — eyebrow, subhead, CTA. */
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

uniform vec2 u_size;   // css px
uniform float u_dpr;
uniform float u_time;
uniform float u_scale;
uniform float u_relief;
uniform vec2 u_ptr;    // -1..1 eased pointer offset
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_c4;
uniform float u_bias;
uniform float u_contrast;

const float TWO_PI = 6.28318530718;
const float FEED_PERIOD = 90.0;
const float SPINDLE_RATE = 0.08; // rev/s, decoupled from a real ~600-3000rpm SPDT spindle
const float N_BASE = 14.0;
const float N_ASPH = 26.0;
const float BOWL_AMP = 0.55;
const float GROOVE_AMP = 0.11;

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

// pitch tightens toward the rim: the r^2 term is the aspheric read
float turns(float r) {
  return N_BASE * r + N_ASPH * r * r;
}

// the tool's radial position: a triangle wave, never a reset. Direction
// reversal at each end is a real process event, not fabricated motion.
float cutRadius(float t) {
  float ph = fract(t / FEED_PERIOD);
  float tri = ph < 0.5 ? ph * 2.0 : 2.0 - ph * 2.0;
  return mix(0.05, 1.04, tri);
}

float height(vec2 p, out float cutMask, out float edgeGlow, out float r) {
  vec2 c = u_size * 0.5;
  float ref = min(u_size.x, u_size.y);
  float discR = ref * 0.46 * u_scale;
  vec2 d = (p - c) / discR;
  r = length(d);
  float theta = atan(d.y, d.x);

  float rc = cutRadius(u_time);
  cutMask = smoothstep(rc + 0.018, rc - 0.018, r);
  edgeGlow = exp(-pow((r - rc) / 0.022, 2.0));

  float idx = theta / TWO_PI + turns(r);
  float groove = cos(idx * TWO_PI);

  float bowl = -BOWL_AMP * r * r;
  // pre-cut blank texture, only where the tool has not yet passed
  float blank = (vnoise(d * 9.0 + 4.1) - 0.5) * 0.05 * (1.0 - cutMask);

  return bowl + GROOVE_AMP * groove * cutMask + blank;
}

float heightOnly(vec2 p) {
  float m; float e; float rr;
  return height(p, m, e, rr);
}

vec3 ramp(float x) {
  vec3 c = mix(u_c0, u_c1, smoothstep(0.0, 0.27, x));
  c = mix(c, u_c2, smoothstep(0.25, 0.55, x));
  c = mix(c, u_c3, smoothstep(0.52, 0.83, x));
  c = mix(c, u_c4, smoothstep(0.81, 1.0, x));
  return c;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_size.y * u_dpr - gl_FragCoord.y) / u_dpr;

  float cutMask; float edgeGlow; float r;
  float h0 = height(p, cutMask, edgeGlow, r);
  float eps = 1.2;
  float hx = heightOnly(p + vec2(eps, 0.0));
  float hy = heightOnly(p + vec2(0.0, eps));

  float k = u_relief / eps;
  vec3 n = normalize(vec3(-(hx - h0) * k, (hy - h0) * k, 1.0));

  vec2 c = u_size * 0.5;
  float ref = min(u_size.x, u_size.y);
  vec2 vp = (p - c) / ref;
  vec3 v = normalize(vec3(vp.x * 0.5 + u_ptr.x * 0.18, -vp.y * 0.5 - u_ptr.y * 0.18, 1.0));
  vec3 rf = reflect(-v, n);

  float el = rf.y;
  float az = atan(rf.x, rf.z) + u_time * SPINDLE_RATE * TWO_PI;

  // an analytic achromatic studio: several narrow sources at different
  // elevations plus two azimuthal panels, one at the spindle rate and one 4x
  // faster, so a nearly-flat patch of the bowl still crosses several
  // reflection bands and the frame does not read as pure horizon banding
  float L = 0.40;
  L += 0.22 * smoothstep(0.05, 0.62, el);
  L -= 0.20 * smoothstep(0.0, -0.55, el);
  L += 0.26 * exp(-pow((el - 0.16) / 0.075, 2.0));
  L += 0.16 * exp(-pow((el + 0.28) / 0.10, 2.0));
  L += 0.15 * exp(-pow(sin(az * 1.0) / 0.42, 2.0));
  L += 0.09 * exp(-pow(sin(az * 4.0 + 1.3) / 0.24, 2.0));

  float fres = pow(1.0 - max(dot(n, v), 0.0), 5.0);
  L += fres * 0.10;

  // freshly-turned surface catches light hardest right at the tool's edge
  L += edgeGlow * 0.35;

  vec3 l1 = normalize(vec3(-0.3, 0.65, 0.6));
  float s1 = pow(max(dot(rf, l1), 0.0), 70.0);
  L += s1 * 0.5;

  // flat backdrop beyond the disc rim
  float discEdge = smoothstep(1.0, 1.06, r);
  L = mix(L, 0.30, discEdge);

  float Lc = clamp((L - 0.5) * u_contrast + 0.5 + u_bias, 0.0, 1.0);
  vec3 col = ramp(Lc);

  float vig = smoothstep(0.9, 1.9, length(vp * vec2(1.0, 1.3)));
  col = mix(col, u_c0, vig * 0.28);

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
    throw new Error(`aspheric-turn-spiral: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// A time offset where the feed is 60% along its outward leg (ph = t/90 =
// 0.3, tri = 0.6) — the tool boundary and its edgeGlow are clearly inside
// the frame with maximum visible groove density behind it, the most
// structured single frame rather than whatever t=0 happens to be.
const STATIC_TIME = 27;
const STATIC_LABEL = "spiral-60pct";

export function AsphericTurnSpiral({
  speed = 1,
  scale = 1,
  relief = 1,
  paused = false,
  children,
  className = "",
  style,
}: AsphericTurnSpiralProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let vs: WebGLShader | null = null;
    let fs: WebGLShader | null = null;
    let buffer: WebGLBuffer | null = null;
    const locs = new Map<string, WebGLUniformLocation | null>();

    let raf = 0;
    let running = false;
    let staticMode = false;
    let disposed = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let lastMs = performance.now();
    let simTime = 0;

    // Adaptive render scale, insurance rather than the fix: steps down only
    // after a sustained (~900ms) stretch over budget, steps back up only
    // after a much longer clean stretch, doubling the wait on each failure —
    // see weld-pool's component.tsx for the full reasoning this mirrors.
    const SCALES = [1, 0.75, 0.55];
    const BUDGET_OVER = 24;
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;

    let ptrTgtX = 0;
    let ptrTgtY = 0;
    let ptrX = 0;
    let ptrY = 0;

    let c0: RGB = [0.03, 0.03, 0.03];
    let c1: RGB = [0.18, 0.18, 0.18];
    let c2: RGB = [0.56, 0.56, 0.56];
    let c3: RGB = [0.93, 0.93, 0.93];
    let c4: RGB = [1, 1, 1];
    let bias = 0;
    let contrast = 1.15;

    // Five stops spanning near-black to near-white in BOTH themes: a
    // full-bleed sheet is the page, so it never inverts direction — only the
    // distribution (bias/contrast) moves between themes.
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
        c2 = muted;
        c3 = fg;
        c4 = mixRGB(fg, white, 0.85);
        bias = -0.08;
        contrast = 1.15;
      } else {
        c0 = mixRGB(fg, black, 0.35);
        c1 = mixRGB(fg, muted, 0.55);
        c2 = mixRGB(muted, bg, 0.6);
        c3 = mixRGB(bg, muted, 0.16);
        c4 = bg;
        bias = 0.02;
        contrast = 1.2;
      }
    };
    // no paint before this first read
    readColors();

    const loc = (name: string): WebGLUniformLocation | null => {
      if (!locs.has(name)) locs.set(name, gl!.getUniformLocation(program!, name));
      return locs.get(name) ?? null;
    };

    const setup = (): boolean => {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
      }) as WebGLRenderingContext | null;
      if (!gl) return false;
      try {
        vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
        fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
        const p = gl.createProgram();
        if (!p) return false;
        program = p;
        gl.attachShader(p, vs);
        gl.attachShader(p, fs);
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return false;
      } catch {
        return false;
      }
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      const aLoc = gl.getAttribLocation(program, "a_pos");
      gl.enableVertexAttribArray(aLoc);
      gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
      locs.clear();
      return true;
    };

    const teardown = () => {
      if (!gl) return;
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      buffer = program = vs = fs = null;
      gl = null;
    };

    const draw = () => {
      if (!gl || !program || cssW <= 0 || cssH <= 0) return;
      const t = staticMode ? STATIC_TIME : simTime;
      gl.uniform2f(loc("u_size"), cssW, cssH);
      gl.uniform1f(loc("u_dpr"), dpr);
      gl.uniform1f(loc("u_time"), t);
      gl.uniform1f(loc("u_scale"), Math.max(0.2, scale));
      gl.uniform1f(loc("u_relief"), 10 * Math.max(0, relief));
      gl.uniform2f(loc("u_ptr"), ptrX, ptrY);
      gl.uniform3f(loc("u_c0"), c0[0], c0[1], c0[2]);
      gl.uniform3f(loc("u_c1"), c1[0], c1[1], c1[2]);
      gl.uniform3f(loc("u_c2"), c2[0], c2[1], c2[2]);
      gl.uniform3f(loc("u_c3"), c3[0], c3[1], c3[2]);
      gl.uniform3f(loc("u_c4"), c4[0], c4[1], c4[2]);
      gl.uniform1f(loc("u_bias"), bias);
      gl.uniform1f(loc("u_contrast"), contrast);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0, rawMs / 1000));
      lastMs = nowMs;
      simTime += dt * speed;
      const pk = 1 - Math.exp(-dt / 0.15);
      ptrX += (ptrTgtX - ptrX) * pk;
      ptrY += (ptrTgtY - ptrY) * pk;
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

    // DPR capped at 1.5, the same full-bleed convention as weld-pool: the
    // area term dominates cost here too, and the shader is cheap enough
    // (three height evaluations/pixel) that 1.5 holds resolution comfortably.
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
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      applyBacking();
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = wrap.getBoundingClientRect();
      ptrTgtX = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
      ptrTgtY = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
      if (staticMode) draw();
    };
    const onPointerLeave = () => {
      ptrTgtX = 0;
      ptrTgtY = 0;
      if (staticMode) draw();
    };

    if (!setup()) return; // no WebGL: children still render over the page bg
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerleave", onPointerLeave);

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
      if (setup()) {
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
      window.clearTimeout(poll);
      sleep();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, relief]);

  return (
    <div
      ref={wrapRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
      data-static-frame={STATIC_LABEL}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

AsphericTurnSpiral.displayName = "AsphericTurnSpiral";
