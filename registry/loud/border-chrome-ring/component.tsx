"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// LiquidCollar — wraps any element in a thick, molten metal tube. The
// fragment shader signs a rounded-rect distance field, fakes a 3D torus
// cross-section across the band width (the trick that sells "metal tube"
// instead of "colored outline"), and lights that fake normal with a rotating
// banded environment ramp so bright/dark reflection stripes sweep around the
// collar like a real curved chrome surface. Two fbm passes perturb the field
// itself — the shape boundary wobbles and the cross-section streaks — so the
// mask and the shading distort together instead of a static ramp under a
// wobbling edge.
//
// Liveness beyond the ambient sweep: hovering biases a specular hit toward
// the cursor; pressing bulges the metal outward and locally thickens the
// band toward the pointer (surface tension pooling toward touch); releasing
// fires a ripple that travels once around the ring and decays. All of it —
// field warp, press bulge, ripple — is centrally-differenced together to
// get the fake normal, so the highlight bands actually move with the liquid
// instead of just riding a static-shaded wobbling edge.
//
// Palette: the achromatic ramp is derived from --background, --foreground,
// --muted and --border (read via getComputedStyle at mount, re-read on a
// MutationObserver watching documentElement's class) with the contrast
// direction picked from the background's luminance rather than a fixed
// token→stop mapping — dark theme reads through bright specular bands,
// light theme reads through the dark occlusion crease at each edge of the
// tube, which is the only way both stay legible. --accent tints only the
// hottest specular pixels, at ~15% mix.
// ---------------------------------------------------------------------------

export interface LiquidCollarProps {
  children: React.ReactNode;
  /** "pill" follows `radius`; "circle" forces a disc sized to the box. */
  variant?: "pill" | "circle";
  /** Corner radius (css px) of the wrapped content, for variant="pill". */
  radius?: number;
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
uniform float u_radius;   // css px, outer corner radius
uniform float u_band;     // css px
uniform float u_strength;
uniform vec3 u_dark;
uniform vec3 u_mid;
uniform vec3 u_light;
uniform vec3 u_hot;
uniform vec3 u_accent;
uniform float u_pressAngle;
uniform float u_press;      // 0..1 eased
uniform float u_rippleAngle;
uniform float u_rippleT;    // seconds since release, huge sentinel if none
uniform float u_hoverAngle;
uniform float u_hoverAmt;   // 0..1 eased

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
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p = p * 2.03 + 17.1;
    amp *= 0.55;
  }
  return sum;
}

// arc-length-normalized angle so the sweep and falloffs don't accelerate
// on the long flanks of a wide pill
float ringAngle(vec2 p) {
  return atan(p.y / (u_size.y * 0.5), p.x / (u_size.x * 0.5));
}

float wrapAngle(float da) { return atan(sin(da), cos(da)); }

float pressFalloffAt(vec2 p) {
  if (u_press <= 0.001) return 0.0;
  float da = wrapAngle(ringAngle(p) - u_pressAngle);
  return exp(-da * da * 5.0) * u_press;
}

float rippleWaveAt(vec2 p) {
  if (u_rippleT < 0.0 || u_rippleT > 2.2) return 0.0;
  float da = abs(wrapAngle(ringAngle(p) - u_rippleAngle));
  float wavefront = u_rippleT * 5.0;
  float env = exp(-u_rippleT * 2.0);
  return exp(-pow((da - wavefront) * 3.2, 2.0)) * env;
}

// the distorted boundary: base rounded-rect SDF plus molten edge wobble,
// a press bulge toward the cursor, and a traveling release ripple. Central-
// differencing this (not the clean SDF) is what makes the shading move
// with the liquid instead of just the mask.
float field(vec2 p) {
  float d = sdRoundBox(p, u_size * 0.5, u_radius);
  vec2 warpUV = p * 0.018;
  float edgeWarp = fbm(warpUV + vec2(u_time * 0.12, -u_time * 0.09)) - 0.5;
  d += edgeWarp * 2.2;
  d -= pressFalloffAt(p) * 6.0;
  d -= rippleWaveAt(p) * 3.0;
  return d;
}

void main() {
  vec2 fragPx = gl_FragCoord.xy / u_dpr;
  vec2 p = fragPx - u_size * 0.5;
  float ang = ringAngle(p);

  float pf = pressFalloffAt(p);
  float bandLocal = u_band + pf * u_band * 0.6;

  float d = field(p);
  // two independent feathered step functions, multiplied — not subtracted.
  // subtracting two smoothsteps that both saturate to 1 across most of the
  // band cancels to ~0 everywhere except a sliver near one edge, which is
  // exactly the "1-2px pale outline" bug this rebuild exists to fix.
  float outer = 1.0 - smoothstep(-1.4, 1.4, d);
  float inner = smoothstep(-bandLocal - 1.4, -bandLocal + 1.4, d);
  float mask = outer * inner;
  if (mask < 0.003) discard;

  // fake torus cross-section: t=0 outer edge, t=1 inner edge, cs in [-1,1]
  float t = clamp(-d / bandLocal, 0.0, 1.0);
  float cs = t * 2.0 - 1.0;
  float streak = fbm(vec2(ang * 3.2, t * 2.4) + vec2(u_time * 0.35, -u_time * 0.22));
  cs = clamp(cs + (streak - 0.5) * 0.4, -1.0, 1.0);
  float z = sqrt(max(0.0, 1.0 - cs * cs));

  float eps = 1.5;
  vec2 n2 = normalize(vec2(
    field(p + vec2(eps, 0.0)) - field(p - vec2(eps, 0.0)),
    field(p + vec2(0.0, eps)) - field(p - vec2(0.0, eps))
  ));
  vec3 normal = normalize(vec3(n2 * cs, z));

  // banded environment reflection, rotating so the bands sweep around
  float rot = u_time * 0.5;
  float envCoord = normal.x * cos(rot) - normal.y * sin(rot);
  envCoord = envCoord * 0.55 + normal.z * 0.45;
  float bands = pow(sin(envCoord * 8.0 + streak * 2.4) * 0.5 + 0.5, 1.8);

  vec3 col = mix(u_dark, u_mid, smoothstep(0.0, 0.45, bands));
  col = mix(col, u_light, smoothstep(0.45, 0.8, bands));
  col = mix(col, u_hot, smoothstep(0.82, 1.0, bands));

  // primary orbiting specular streak — light catching a rotating tube
  float sweep = pow(max(0.0, cos(ang - u_time * 0.7)), 36.0);
  float sweep2 = pow(max(0.0, cos(ang + 2.3 + u_time * 0.5)), 55.0);
  vec3 specCol = mix(u_hot, u_accent, 0.14);
  col += specCol * (sweep * 0.85 + sweep2 * 0.55) * (0.6 + 0.4 * u_hoverAmt);

  // cursor-locked glint while hovering, independent of the ambient sweep
  if (u_hoverAmt > 0.001) {
    float hda = wrapAngle(ang - u_hoverAngle);
    float hoverSpec = pow(max(0.0, cos(hda)), 24.0) * u_hoverAmt;
    col += mix(u_hot, u_accent, 0.2) * hoverSpec * 0.6;
  }

  // dark occlusion crease at the cross-section extremes — the depth cue
  // that keeps the tube legible even against a near-white background
  float occ = smoothstep(0.0, 0.3, z);
  col *= mix(0.28, 1.0, occ);

  // release ripple glint
  col += u_hot * rippleWaveAt(p) * 0.5;

  gl_FragColor = vec4(col, mask * u_strength);
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

function mixColors(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function lighten(c: [number, number, number], t: number): [number, number, number] {
  return mixColors(c, [1, 1, 1], t);
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`border-chrome-ring: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// A time offset (not 0) chosen so the static frame drawn under
// prefers-reduced-motion / paused actually shows a specular hit and a
// non-flat band, rather than whatever the ramp looks like at t=0.
const STATIC_TIME = 1.35;

export function LiquidCollar({
  children,
  variant = "pill",
  radius = 16,
  strength = 1,
  paused = false,
  ringWidth = 14,
  className = "",
  style,
}: LiquidCollarProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const uid = useId();
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
    let staticMode = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    const startedAt = performance.now();
    let lastMs = startedAt;

    // interaction state, all read/written from event handlers below and
    // consumed once per frame in draw()
    let pressTarget = 0;
    let pressAmt = 0;
    let pressAngle = 0;
    let hoverTarget = 0;
    let hoverAmt = 0;
    let hoverAngle = 0;
    let rippleAngle = 0;
    let rippleStart = -1e6; // seconds, in the same clock as u_time

    let uSize: WebGLUniformLocation | null = null;
    let uDpr: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uRadius: WebGLUniformLocation | null = null;
    let uBand: WebGLUniformLocation | null = null;
    let uStrength: WebGLUniformLocation | null = null;
    let uDark: WebGLUniformLocation | null = null;
    let uMid: WebGLUniformLocation | null = null;
    let uLight: WebGLUniformLocation | null = null;
    let uHot: WebGLUniformLocation | null = null;
    let uAccent: WebGLUniformLocation | null = null;
    let uPressAngle: WebGLUniformLocation | null = null;
    let uPress: WebGLUniformLocation | null = null;
    let uRippleAngle: WebGLUniformLocation | null = null;
    let uRippleT: WebGLUniformLocation | null = null;
    let uHoverAngle: WebGLUniformLocation | null = null;
    let uHoverAmt: WebGLUniformLocation | null = null;

    let dark: [number, number, number] = [0.09, 0.09, 0.09];
    let mid: [number, number, number] = [0.55, 0.55, 0.55];
    let light: [number, number, number] = [0.9, 0.9, 0.9];
    let hot: [number, number, number] = [1, 1, 1];
    let accent: [number, number, number] = [0, 0.42, 1];

    // The ramp's contrast direction flips between themes, not its stops:
    // on a dark background the bright specular bands carry the read; on a
    // white background the dark occlusion crease is what draws the tube's
    // shape, since near-white fill blends into the page. Deciding which
    // ramp to use from the background's own luminance (rather than a fixed
    // token->stop mapping) is what keeps both themes legible.
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseHex(cs.getPropertyValue("--background").trim()) ?? [1, 1, 1];
      const fg = parseHex(cs.getPropertyValue("--foreground").trim()) ?? [0.09, 0.09, 0.09];
      const muted = parseHex(cs.getPropertyValue("--muted").trim()) ?? [0.55, 0.55, 0.55];
      const border = parseHex(cs.getPropertyValue("--border").trim()) ?? [0.18, 0.18, 0.18];
      const accentTok = parseHex(cs.getPropertyValue("--accent").trim()) ?? [0, 0.42, 1];
      accent = accentTok;
      if (luminance(bg) < 0.5) {
        dark = mixColors(border, bg, 0.3);
        mid = muted;
        light = fg;
        hot = lighten(fg, 0.9);
      } else {
        dark = mixColors(fg, [0, 0, 0], 0.25);
        mid = muted;
        light = mixColors(fg, bg, 0.62);
        hot = lighten(light, 0.9);
      }
    };
    readColors();

    // compile()/linking can throw or fail without an exception; either way
    // setup() must resolve to a clean false (children still render sans
    // ring) rather than an uncaught throw, which would skip the `if
    // (!setup()) return;` early-return below and leave the effect's cleanup
    // never registered — a permanent GL leak on a bad driver.
    const setup = (): boolean => {
      gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true }) as WebGLRenderingContext | null;
      if (!gl) return false;
      try {
        vShader = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
        fShader = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
        program = gl.createProgram();
        if (!program) {
          teardown();
          return false;
        }
        gl.attachShader(program, vShader);
        gl.attachShader(program, fShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          teardown();
          return false;
        }
      } catch {
        teardown();
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
      uDark = gl.getUniformLocation(program, "u_dark");
      uMid = gl.getUniformLocation(program, "u_mid");
      uLight = gl.getUniformLocation(program, "u_light");
      uHot = gl.getUniformLocation(program, "u_hot");
      uAccent = gl.getUniformLocation(program, "u_accent");
      uPressAngle = gl.getUniformLocation(program, "u_pressAngle");
      uPress = gl.getUniformLocation(program, "u_press");
      uRippleAngle = gl.getUniformLocation(program, "u_rippleAngle");
      uRippleT = gl.getUniformLocation(program, "u_rippleT");
      uHoverAngle = gl.getUniformLocation(program, "u_hoverAngle");
      uHoverAmt = gl.getUniformLocation(program, "u_hoverAmt");

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

    // outer corner radius = child radius + band width, so the band reads
    // as constant-thickness padding around the child rather than pinching
    // at the corners
    const outerRadius = () =>
      variant === "circle" ? Math.min(cssW, cssH) / 2 : radius + ringWidth;

    const draw = (nowMs: number) => {
      if (!gl || !program || cssW <= 0 || cssH <= 0) return;
      const timeVal = staticMode ? STATIC_TIME : (nowMs - startedAt) / 1000;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uSize, cssW, cssH);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uTime, timeVal);
      gl.uniform1f(uRadius, outerRadius());
      gl.uniform1f(uBand, ringWidth);
      gl.uniform1f(uStrength, Math.max(0, Math.min(1, strengthRef.current)));
      gl.uniform3f(uDark, dark[0], dark[1], dark[2]);
      gl.uniform3f(uMid, mid[0], mid[1], mid[2]);
      gl.uniform3f(uLight, light[0], light[1], light[2]);
      gl.uniform3f(uHot, hot[0], hot[1], hot[2]);
      gl.uniform3f(uAccent, accent[0], accent[1], accent[2]);
      gl.uniform1f(uPressAngle, pressAngle);
      gl.uniform1f(uPress, pressAmt);
      gl.uniform1f(uRippleAngle, rippleAngle);
      gl.uniform1f(uRippleT, timeVal - rippleStart);
      gl.uniform1f(uHoverAngle, hoverAngle);
      gl.uniform1f(uHoverAmt, hoverAmt);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const loop = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0, (nowMs - lastMs) / 1000));
      lastMs = nowMs;
      // physics-style exponential ease toward the interaction targets
      pressAmt += (pressTarget - pressAmt) * (1 - Math.exp(-dt * 16));
      hoverAmt += (hoverTarget - hoverAmt) * (1 - Math.exp(-dt * 10));
      draw(nowMs);
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (running) return;
      running = true;
      lastMs = performance.now();
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
      draw(performance.now());
    };

    // pointer -> ring-space angle, normalized the same way the shader
    // normalizes it (ellipse-scaled) so it lines up with the shader's arcs
    const angleFromEvent = (e: PointerEvent): number => {
      const rect = wrap.getBoundingClientRect();
      const px = e.clientX - (rect.left + rect.width / 2);
      const py = e.clientY - (rect.top + rect.height / 2);
      return Math.atan2(py / (rect.height / 2 || 1), px / (rect.width / 2 || 1));
    };

    const onPointerEnter = () => {
      hoverTarget = 1;
    };
    const onPointerLeave = () => {
      hoverTarget = 0;
      if (pressTarget) {
        rippleAngle = pressAngle;
        rippleStart = staticMode ? STATIC_TIME : (performance.now() - startedAt) / 1000;
      }
      pressTarget = 0;
    };
    const onPointerMove = (e: PointerEvent) => {
      const a = angleFromEvent(e);
      hoverAngle = a;
      if (pressTarget) pressAngle = a;
    };
    const onPointerDown = (e: PointerEvent) => {
      pressTarget = 1;
      pressAngle = angleFromEvent(e);
      // only (re)start the loop if animation is actually allowed — under
      // prefers-reduced-motion/paused, staticMode holds the loop stopped and
      // a press should still redraw the one frozen frame, not spin up rAF
      if (!staticMode) wake();
      else draw(performance.now());
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressTarget) {
        rippleAngle = angleFromEvent(e);
        rippleStart = staticMode ? STATIC_TIME : (performance.now() - startedAt) / 1000;
      }
      pressTarget = 0;
    };

    if (!setup()) return; // no WebGL: children still render, just no ring
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    wrap.addEventListener("pointerenter", onPointerEnter);
    wrap.addEventListener("pointerleave", onPointerLeave);
    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced || pausedRef.current) {
        staticMode = true;
        sleep();
        draw(performance.now());
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
      if (staticMode) draw(performance.now());
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
      wrap.removeEventListener("pointerenter", onPointerEnter);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.clearTimeout(pausedPoll);
      sleep();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, ringWidth, radius]);

  return (
    <div
      ref={wrapRef}
      data-border-chrome-ring={uid}
      className={`relative inline-block touch-none ${variant === "circle" ? "rounded-full" : ""} ${className}`}
      style={{
        padding: ringWidth,
        borderRadius: variant === "circle" ? undefined : radius + ringWidth,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${variant === "circle" ? "rounded-full" : ""}`}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

LiquidCollar.displayName = "LiquidCollar";
