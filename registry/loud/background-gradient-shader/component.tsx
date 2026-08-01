"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ChromaTide — a full-bleed animated gradient background: a WebGL fragment
// shader drifts three theme-derived colors through a domain-warped fbm flow
// field and maps the result through a simple 3-stop ramp. No pattern-shape
// switch, no swirl-iteration loop, no per-channel alpha blending — one flow
// field, one ramp, one drift direction, kept deliberately simple so it reads
// as a calm moving backdrop rather than a shader demo.
//
// Colors default to --accent, --background lightened, and --foreground
// dimmed, all read via getComputedStyle at mount and re-read on a
// MutationObserver watching documentElement's class attribute, so the tide
// re-tints itself on a theme flip without a remount. An explicit `colors`
// prop (1-4 hex strings) overrides the token defaults for callers who want a
// fixed palette regardless of theme.
// ---------------------------------------------------------------------------

export interface ChromaTideProps {
  /** Optional fixed palette (hex strings) overriding the theme-derived default. */
  colors?: string[];
  /** Flow speed multiplier. @default 1 */
  speed?: number;
  /** Noise zoom — smaller reads as broader, slower-moving fields. @default 1 */
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
}

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_scale;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

float hash21(vec2 p) {
  p = fract(p * vec2(419.2, 371.9));
  p += dot(p, p + 19.19);
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
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p = p * 2.15 + 5.7;
    amp *= 0.52;
  }
  return sum;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * (2.4 * u_scale);
  p += vec2(u_time * 0.045, u_time * -0.028);

  vec2 warp = vec2(fbm(p + u_time * 0.06), fbm(p - u_time * 0.05 + 8.3));
  float t = fbm(p * 1.3 + warp * 1.5);
  // fbm output clusters near its mean — stretch contrast around 0.5 so the
  // ramp's outer stops actually get reached instead of the field reading as
  // one dominant midtone with faint smudges.
  t = clamp(0.5 + (t - 0.5) * 2.1, 0.0, 1.0);

  vec3 col = t < 0.5
    ? mix(u_c1, u_c2, smoothstep(0.0, 0.5, t))
    : mix(u_c2, u_c3, smoothstep(0.5, 1.0, t));

  gl_FragColor = vec4(col, 1.0);
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

function mix3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`chroma-tide: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

export function ChromaTide({ colors, speed = 1, scale = 1, className = "", style }: ChromaTideProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let gl: WebGLRenderingContext | null = null;
    let program: WebGLProgram | null = null;
    let vShader: WebGLShader | null = null;
    let fShader: WebGLShader | null = null;
    let buffer: WebGLBuffer | null = null;
    let raf = 0;
    let running = false;
    let startedAt = performance.now();
    let pausedAt = 0;
    let w = 0;
    let h = 0;

    let uRes: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uScale: WebGLUniformLocation | null = null;
    let uC1: WebGLUniformLocation | null = null;
    let uC2: WebGLUniformLocation | null = null;
    let uC3: WebGLUniformLocation | null = null;

    let c1: [number, number, number] = [0, 0.42, 1];
    let c2: [number, number, number] = [0.3, 0.3, 0.3];
    let c3: [number, number, number] = [0, 0, 0];

    const readColors = () => {
      if (colors && colors.length >= 2) {
        const parsed = colors.map((c) => parseHex(c)).filter((c): c is [number, number, number] => !!c);
        c1 = parsed[0] ?? c1;
        c2 = parsed[1] ?? parsed[0] ?? c1;
        c3 = parsed[2] ?? parsed[1] ?? parsed[0] ?? c1;
        return;
      }
      const cs = getComputedStyle(document.documentElement);
      const accent = parseHex(cs.getPropertyValue("--accent").trim()) ?? [0, 0.42, 1];
      const bg = parseHex(cs.getPropertyValue("--background").trim()) ?? [0, 0, 0];
      const fg = parseHex(cs.getPropertyValue("--foreground").trim()) ?? [1, 1, 1];
      c1 = mix3(bg, fg, 0.12);
      c2 = accent;
      c3 = mix3(bg, [0, 0, 0], 0.0);
    };
    readColors();

    const setup = (): boolean => {
      gl = canvas.getContext("webgl", { alpha: false, antialias: true }) as WebGLRenderingContext | null;
      if (!gl) return false;
      vShader = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
      fShader = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
      program = gl.createProgram();
      if (!program) return false;
      gl.attachShader(program, vShader);
      gl.attachShader(program, fShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
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

      uRes = gl.getUniformLocation(program, "u_res");
      uTime = gl.getUniformLocation(program, "u_time");
      uScale = gl.getUniformLocation(program, "u_scale");
      uC1 = gl.getUniformLocation(program, "u_c1");
      uC2 = gl.getUniformLocation(program, "u_c2");
      uC3 = gl.getUniformLocation(program, "u_c3");
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

    // viewport/resolution/scale/palette are each only touched by resize(),
    // readColors() or a prop change — never by time. WebGL retains uniform
    // values across draw calls on the same program, so re-sending all six
    // uniforms and re-setting the viewport on every single animation frame
    // (this ran continuously, forever) was pure waste on the one uniform
    // (u_time) that actually changes frame to frame. Setting the static ones
    // only at their own change points cuts the per-frame GL call count from
    // 8 to 2.
    const applyViewportUniforms = () => {
      if (!gl || !program) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uScale, scale);
    };
    const applyColorUniforms = () => {
      if (!gl || !program) return;
      gl.uniform3f(uC1, c1[0], c1[1], c1[2]);
      gl.uniform3f(uC2, c2[0], c2[1], c2[2]);
      gl.uniform3f(uC3, c3[0], c3[1], c3[2]);
    };

    const draw = (nowMs: number) => {
      if (!gl || !program || w <= 0 || h <= 0) return;
      gl.uniform1f(uTime, ((nowMs - startedAt) / 1000) * speedRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    // The flow field drifts slowly enough that 60 draws/sec buys nothing a
    // viewer can see over ~30 — it's a calm ambient backdrop, not motion
    // graphics. Halving the draw rate halves the shader + compositor cost of
    // an animation that already runs forever with no idle state, which was
    // the dominant cost of this component. rAF itself still fires every
    // frame (needed for a smooth stop the instant the tab hides or reduced-
    // motion flips), it just skips the GL work on alternate frames.
    const FRAME_INTERVAL_MS = 1000 / 30;
    let lastDrawMs = 0;
    const loop = (t: number) => {
      if (t - lastDrawMs >= FRAME_INTERVAL_MS) {
        lastDrawMs = t;
        draw(t);
      }
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
      const rect = container.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      applyViewportUniforms();
      draw(pausedAt || performance.now());
    };

    if (!setup()) return; // no WebGL: render nothing, container stays transparent
    applyColorUniforms();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const applyMode = () => {
      if (reduced) {
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

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!reduced) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const themeObserver = new MutationObserver(() => {
      readColors();
      applyColorUniforms();
      if (reduced) draw(pausedAt || performance.now());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onLost = (e: Event) => {
      e.preventDefault();
      sleep();
    };
    const onRestored = () => {
      if (setup()) {
        applyColorUniforms();
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
      sleep();
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, scale]);

  return (
    <div ref={containerRef} aria-hidden="true" className={`relative h-full w-full overflow-hidden ${className}`} style={style}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}

ChromaTide.displayName = "ChromaTide";
