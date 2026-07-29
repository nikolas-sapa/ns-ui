"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// LiquidCollar — wraps any element in a thin band of animated liquid metal.
// A single WebGL canvas is sized to the wrapper's full box (content padded
// inward by `ringWidth`); the fragment shader signs a rounded-rect distance
// field, keeps only a band around that boundary, and fills the band with a
// three-stop color ramp pushed through a two-pass domain-warped value-noise
// flow field, plus a specular streak that sweeps around the ring like light
// catching a rotating metal surface.
//
// This is a from-scratch shader: own hash/noise constants, a linear 3-stop
// ramp (not a 5-stop gaussian palette), a single rotating specular term
// instead of a compositing engine, and one canvas per instance rather than a
// shared offscreen renderer. Colors are read from --accent, --foreground and
// --background via getComputedStyle at mount and re-read on theme flips
// (MutationObserver on documentElement's class attribute). The rAF loop
// pauses on visibilitychange and under prefers-reduced-motion (one static
// frame instead), the backing store is dpr-clamped to 2, and the GL context
// — program, shaders, buffer — is torn down on unmount along with a
// webglcontextlost/restored pair so a lost context never leaves a dead loop
// spinning.
// ---------------------------------------------------------------------------

export interface LiquidCollarProps {
  children: React.ReactNode;
  /** "pill" follows the wrapper's own border-radius; "circle" forces a disc. */
  variant?: "pill" | "circle";
  /** 0..1 overall intensity of the liquid band. */
  strength?: number;
  /** Freezes the shader on its current frame without unmounting the canvas. */
  paused?: boolean;
  /** Width of the liquid band in CSS px. */
  ringWidth?: number;
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
uniform float u_time;
uniform float u_radius;   // css px
uniform float u_band;     // css px
uniform float u_strength;
uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;

// rounded-rect signed distance (Inigo Quilez's standard formula)
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
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
  float sum = 0.0;
  float amp = 0.55;
  for (int i = 0; i < 5; i++) {
    sum += amp * vnoise(p);
    p = p * 2.02 + 17.1;
    amp *= 0.55;
  }
  return sum;
}

void main() {
  vec2 fragPx = gl_FragCoord.xy / u_dpr;
  vec2 center = u_size * 0.5;
  vec2 p = fragPx - center;

  float d = sdRoundBox(p, u_size * 0.5, u_radius);
  // band mask: 0 outside the ring, 1 inside it, feathered edges
  float outer = smoothstep(0.0, 1.5, -d);
  float inner = smoothstep(0.0, 1.5, d + u_band);
  float ring = clamp(outer - inner, 0.0, 1.0);
  if (ring < 0.003) discard;

  // domain-warped flow: two fbm passes offset in time feed a third
  vec2 flow = p * 0.045;
  vec2 warpA = vec2(fbm(flow + u_time * 0.06), fbm(flow - u_time * 0.05 + 9.2));
  vec2 warpB = vec2(fbm(flow + warpA * 1.6 + u_time * 0.03), fbm(flow - warpA * 1.4 - u_time * 0.04));
  float t = fbm(flow * 1.7 + warpB * 2.1);
  t = clamp(t, 0.0, 1.0);

  vec3 col = t < 0.5
    ? mix(u_colorA, u_colorB, smoothstep(0.0, 0.5, t))
    : mix(u_colorB, u_colorC, smoothstep(0.5, 1.0, t));

  // specular sweep: a bright streak that orbits the ring
  float ang = atan(p.y, p.x);
  float sweep = pow(max(0.0, cos(ang - u_time * 0.9)), 28.0);
  float sweep2 = pow(max(0.0, cos(ang + 2.4 + u_time * 0.6)), 40.0);
  col += vec3(sweep * 0.65 + sweep2 * 0.5);

  gl_FragColor = vec4(col, ring * u_strength);
}
`;

function parseHex(raw: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function lighten([r, g, b]: [number, number, number], t: number): [number, number, number] {
  return [r + (1 - r) * t, g + (1 - g) * t, b + (1 - b) * t];
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`liquid-collar: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

export function LiquidCollar({
  children,
  variant = "pill",
  strength = 1,
  paused = false,
  ringWidth = 5,
  className = "",
  style,
}: LiquidCollarProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();
  // Runtime-tunable props are read through refs inside the rAF closure so
  // changing them doesn't require tearing down and recreating the GL context
  // (which only needs to happen for variant/ringWidth, which affect layout).
  const strengthRef = useRef(strength);
  strengthRef.current = strength;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let vShader: WebGLShader | null = null;
    let fShader: WebGLShader | null = null;
    let buffer: WebGLBuffer | null = null;
    let raf = 0;
    let running = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let startedAt = performance.now();
    let pausedAt = 0;

    let uSize: WebGLUniformLocation | null = null;
    let uDpr: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uRadius: WebGLUniformLocation | null = null;
    let uBand: WebGLUniformLocation | null = null;
    let uStrength: WebGLUniformLocation | null = null;
    let uColorA: WebGLUniformLocation | null = null;
    let uColorB: WebGLUniformLocation | null = null;
    let uColorC: WebGLUniformLocation | null = null;

    let colorA: [number, number, number] = [0, 107 / 255, 255 / 255];
    let colorB: [number, number, number] = [1, 1, 1];
    let colorC: [number, number, number] = [0, 0, 0];

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const accent = parseHex(cs.getPropertyValue("--accent").trim()) ?? [0, 0.42, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground").trim()) ?? [1, 1, 1];
      const bg = parseHex(cs.getPropertyValue("--background").trim()) ?? [0, 0, 0];
      colorA = accent;
      colorB = lighten(accent, 0.65);
      colorC = lighten(bg, 0.08) as [number, number, number];
      // keep contrast against foreground so the streak never disappears
      void fg;
    };
    readColors();

    const setup = (): boolean => {
      gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true }) as WebGLRenderingContext | null;
      if (!gl) return false;
      vShader = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
      fShader = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      program = gl.createProgram();
      if (!program) return false;
      gl.attachShader(program, vShader);
      gl.attachShader(program, fShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
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
      const loc = gl.getAttribLocation(program, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      uSize = gl.getUniformLocation(program, "u_size");
      uDpr = gl.getUniformLocation(program, "u_dpr");
      uTime = gl.getUniformLocation(program, "u_time");
      uRadius = gl.getUniformLocation(program, "u_radius");
      uBand = gl.getUniformLocation(program, "u_band");
      uStrength = gl.getUniformLocation(program, "u_strength");
      uColorA = gl.getUniformLocation(program, "u_colorA");
      uColorB = gl.getUniformLocation(program, "u_colorB");
      uColorC = gl.getUniformLocation(program, "u_colorC");

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      return true;
    };

    const teardown = () => {
      if (!gl) return;
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (vShader) gl.deleteShader(vShader);
      if (fShader) gl.deleteShader(fShader);
      buffer = program = vShader = fShader = null;
      gl = null;
    };

    const radius = () =>
      variant === "circle" ? Math.min(cssW, cssH) / 2 : Math.min(12, Math.min(cssW, cssH) / 2);

    const draw = (nowMs: number) => {
      if (!gl || !program || cssW <= 0 || cssH <= 0) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uSize, cssW, cssH);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uTime, (nowMs - startedAt) / 1000);
      gl.uniform1f(uRadius, radius());
      gl.uniform1f(uBand, ringWidth);
      gl.uniform1f(uStrength, Math.max(0, Math.min(1, strengthRef.current)));
      gl.uniform3f(uColorA, colorA[0], colorA[1], colorA[2]);
      gl.uniform3f(uColorB, colorB[0], colorB[1], colorB[2]);
      gl.uniform3f(uColorC, colorC[0], colorC[1], colorC[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const loop = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => {
      cancelAnimationFrame(raf);
      running = false;
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      cssW = rect.width;
      cssH = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      draw(pausedAt || performance.now());
    };

    if (!setup()) return; // no WebGL: children still render, just no ring
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        pausedAt = performance.now();
        sleep();
        draw(pausedAt);
      } else {
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);
    applyMode();

    // pausedRef is checked on a light poll instead of an effect dependency —
    // that would tear down and recreate the whole GL context just to toggle
    // a boolean, which is disproportionate for a prop that can change often.
    let pausedPoll = 0;
    let lastPolledPaused = pausedRef.current;
    const pollPaused = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      pausedPoll = window.setTimeout(pollPaused, 120);
    };
    pollPaused();

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!reduced && !pausedRef.current) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (reduced || pausedRef.current) draw(pausedAt || performance.now());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

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
      ro.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      window.clearTimeout(pausedPoll);
      sleep();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, ringWidth]);

  return (
    <div
      ref={wrapRef}
      data-liquid-collar={uid}
      className={`relative inline-block ${variant === "circle" ? "rounded-full" : "rounded-md"} ${className}`}
      style={{ padding: ringWidth, ...style }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${variant === "circle" ? "rounded-full" : "rounded-md"}`}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

LiquidCollar.displayName = "LiquidCollar";
