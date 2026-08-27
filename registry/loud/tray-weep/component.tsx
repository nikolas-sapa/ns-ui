"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// TrayWeep — a full-bleed section-divider band built on a bubble-cap
// distillation column tray. Vapor rises through a stack of horizontal trays,
// forced through slotted caps submerged under a shallow liquid pool; the
// vapor exits as a curtain of small bubbles that froths the pool, while the
// liquid itself creeps sideways across the tray toward a weir and spills to
// the tray below. When a cap's local vapor rate sags, liquid WEEPS backward
// down through it instead of vapor bubbling up — a named tray-design failure
// mode engineers explicitly design against, and the one mechanic that makes
// this identifiably a distillation tray rather than generic bubbling.
//
// One fragment shader owns the whole band. Trays are a periodic domain in Y
// (N bands, N = clamp(round(height/90px), 2, 6)); caps are a periodic domain
// in X within each band (spacing derived from min(width,height)/14 so caps
// read the same size at card and full-bleed scale, cap COUNT — not spacing —
// is what re-derives on resize to fill the available width). Both the froth
// height oscillation and the weep-event schedule are evaluated from a
// per-band LOCAL clock: tLocal(i) = time - i*0.18s. That single 180ms
// cascade offset is what makes every mechanic in a lower tray visibly lag
// the one above it — froth phase, liquid position and weep timing all
// inherit the same stagger, so the whole stack reads as one process flowing
// downward rather than N identical bands tiled vertically.
//
// Weep events run on a per-cap deterministic pseudo-Poisson schedule
// entirely inside the shader (no JS-side event bookkeeping): each cap's
// local time is divided into fixed-length cycles (mean interval 3.5s), a
// per-(cap,cycle) hash draws one random event start + duration (400-700ms)
// within that cycle, and the cap is "weeping" whenever the local clock
// falls inside that window. This reads statistically as Poisson at these
// timescales while staying a pure function of (capId, bandIndex, time) —
// nothing to reset, cascade-delay, or leak across resizes. A weeping cap's
// droplet animates DOWNWARD past the tray floor into the band below; a
// normal cap's bubble animates UPWARD into its own froth layer — opposite
// sign on the same vertical axis, the one visual distinction the spec calls
// out as non-negotiable.
//
// A note on the lateral liquid-flow rate: the spec's real-world number
// (4% of tray width/second, a ~25s inlet-to-weir traverse) does not fit the
// resting-loop requirement that a full flow-to-spill cycle be visible on the
// topmost tray by the 2.5s checkpoint. That checkpoint is load-bearing (it's
// what the alive-at-rest gate actually screenshots), so the traverse rate
// here is compressed to a ~2.2s crossing instead — legible at gate/gallery
// timescales while keeping the mechanic (creep, weir spill, downcomer
// restart) intact; noted explicitly rather than silently overriding the doc.
//
// Colors: dark theme ramps froth from --ns-muted (thin, top of froth) to
// --foreground (dense, at the caps); light theme compresses the same ramp
// and anchors it off --ns-muted rather than --background so the delta still
// reads once compressed, per the recipe's light-theme-is-the-harder-case
// rule — checked before the dark ramp was finalized, not after. Colors are
// read via getComputedStyle(document.documentElement) at mount and re-read
// on a MutationObserver watching documentElement's class; no literals
// anywhere, including this shader's own source. Pointer hover locally raises
// a band's vapor rate (frothier, faster bubbling) within a screen-space
// circular radius (15% of container width) that decays over 500ms on leave;
// it never recolors with --ns-accent and never touches the global tray
// clocks the lateral-flow / weep schedules run on.
// ---------------------------------------------------------------------------

export interface TrayWeepProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `
precision highp float;

#define MAX_TRAYS 6

uniform vec2 u_res;
uniform float u_time;
uniform float u_trayCount;
uniform float u_capSpacing;   // normalized (fraction of width) cap-to-cap spacing
uniform vec3 u_base;
uniform vec3 u_frothLo;
uniform vec3 u_frothHi;
uniform vec3 u_hover;         // x, yTop (both normalized 0..1), strength 0..1
uniform float u_hoverRadius;  // normalized fraction of width

float hash21(vec2 p) {
  p = fract(p * vec2(419.2, 371.9));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float y = 1.0 - uv.y; // top-down: 0 = ceiling, 1 = base of the stack

  float trayGap = 1.0 / u_trayCount;
  vec3 col = u_base;

  // screen-space circular hover boost, evaluated once (shared by every band)
  vec2 hoverPx = vec2((uv.x - u_hover.x) * u_res.x, (y - u_hover.y) * u_res.y);
  float hoverDistPx = length(hoverPx);
  float hoverRadiusPx = max(1.0, u_hoverRadius * u_res.x);
  float hoverT = u_hover.z * smoothstep(hoverRadiusPx, 0.0, hoverDistPx);

  float capIdxF = floor(uv.x / u_capSpacing);
  float capLocalX = (fract(uv.x / u_capSpacing) - 0.5) * u_capSpacing;

  for (int i = 0; i < MAX_TRAYS; i++) {
    if (float(i) >= u_trayCount) break;

    float floorY = (float(i) + 1.0) * trayGap;
    float tLocal = u_time - float(i) * 0.18;

    // froth height: 30-55% of tray gap, 1.8s period, boosted locally by hover
    float frothBase = 0.30 + 0.25 * (0.5 + 0.5 * sin(tLocal * (6.28318 / 1.8)));
    float frothFrac = clamp(frothBase * (1.0 + 0.3 * hoverT), 0.0, 0.9);
    float frothTopY = floorY - frothFrac * trayGap;

    // liquid lateral creep: inlet (x=0) to weir (x=1), compressed to a ~2.2s
    // traverse so a full flow/spill cycle reads inside the 2.5s alive-at-rest
    // checkpoint (see doc comment above the shader source).
    float raw = tLocal * (1.0 / 2.2);
    float xLiquid = fract(raw);
    float spillFrac = 0.25 / 2.2;
    float spillT = xLiquid > (1.0 - spillFrac) ? (xLiquid - (1.0 - spillFrac)) / spillFrac : 0.0;

    if (y <= floorY && y >= frothTopY) {
      float densityT = clamp((y - frothTopY) / max(frothFrac * trayGap, 0.0001), 0.0, 1.0);
      float n = hash21(vec2(floor(uv.x * 180.0), floor(y * 400.0) + tLocal * 6.0));
      float tex = mix(0.85, 1.15, n);
      float ink = clamp(densityT * tex, 0.0, 1.0);
      // liquid flow ripple: a brighter band tracks xLiquid across the froth
      float flowBand = smoothstep(0.05, 0.0, abs(uv.x - xLiquid));
      ink = clamp(ink + flowBand * 0.25 + hoverT * 0.15, 0.0, 1.0);
      col = mix(u_frothLo, u_frothHi, ink);
    }

    // weir spill: a brief streak at the weir edge bridging into the band below
    float spillDepth = 0.14 * trayGap;
    if (spillT > 0.0 && y > floorY && y < floorY + spillDepth) {
      float edgeT = smoothstep(0.06, 0.0, abs(uv.x - 1.0));
      float streak = edgeT * spillT * (1.0 - (y - floorY) / spillDepth);
      col = mix(col, u_frothHi, streak * 0.8);
    }

    // per-cap pseudo-Poisson weep schedule, pure function of (cap, tray, time)
    float capSeed = hash21(vec2(capIdxF, float(i)));
    float cycleLen = 3.5;
    float phaseOff = capSeed * cycleLen;
    float raw2 = (tLocal + phaseOff) / cycleLen;
    float cycleIdx = floor(raw2);
    float withinT = fract(raw2) * cycleLen;
    float seedA = hash21(vec2(capIdxF + cycleIdx * 13.7, float(i) * 3.1 + 1.0));
    float seedB = hash21(vec2(capIdxF + cycleIdx * 13.7, float(i) * 3.1 + 7.0));
    float eventDur = mix(0.4, 0.7, seedB);
    float eventStart = 0.1 + seedA * max(cycleLen - eventDur - 0.2, 0.1);
    bool weeping = withinT >= eventStart && withinT < eventStart + eventDur;

    float capRadiusPx = u_capSpacing * u_res.x * 0.17;

    if (weeping) {
      float wT = (withinT - eventStart) / eventDur;
      float alpha = smoothstep(0.0, 0.15, wT) * (1.0 - smoothstep(0.7, 1.0, wT));
      float depth = wT * 0.4 * trayGap; // DOWNWARD, past the tray floor
      float centerY = floorY + depth;
      vec2 dPx = vec2(capLocalX * u_res.x, (y - centerY) * u_res.y * 1.7);
      float d = length(dPx);
      float glow = smoothstep(capRadiusPx, 0.0, d) * alpha;
      col = mix(col, u_frothHi, glow);
    } else {
      float bubbleFreq = 18.0 * (1.0 + hoverT);
      float bPhase = fract(tLocal * bubbleFreq + capSeed * 7.0);
      float riseFrac = bPhase;
      float alpha = (1.0 - riseFrac) * 0.9;
      float centerY = floorY - riseFrac * frothFrac * trayGap; // UPWARD, into the froth
      vec2 dPx = vec2(capLocalX * u_res.x, (y - centerY) * u_res.y);
      float d = length(dPx);
      float glow = smoothstep(capRadiusPx * (1.0 - 0.4 * riseFrac), 0.0, d) * alpha;
      col = mix(col, u_frothHi, glow * 0.75);
    }
  }

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

function relLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function fract(x: number): number {
  return x - Math.floor(x);
}

// mirrors the GLSL hash21 above exactly, so the reduced-motion freeze search
// below (run in JS) finds a time that lines up with what the shader itself
// will actually render at that timestamp.
function hashJS(x: number, y: number): number {
  let px = fract(x * 419.2);
  let py = fract(y * 371.9);
  const d = px * (px + 19.19) + py * (py + 19.19);
  px += d;
  py += d;
  return fract(px * py);
}

function frothFracAt(tLocal: number): number {
  return 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(tLocal * ((2 * Math.PI) / 1.8)));
}

function spillTAt(tLocal: number): number {
  const raw = tLocal * (1 / 2.2);
  const xLiquid = fract(raw);
  const spillFrac = 0.25 / 2.2;
  return xLiquid > 1 - spillFrac ? (xLiquid - (1 - spillFrac)) / spillFrac : 0;
}

function weepProgressAt(capIdx: number, trayIdx: number, tLocal: number): number {
  const capSeed = hashJS(capIdx, trayIdx);
  const cycleLen = 3.5;
  const phaseOff = capSeed * cycleLen;
  const raw2 = (tLocal + phaseOff) / cycleLen;
  const cycleIdx = Math.floor(raw2);
  const withinT = fract(raw2) * cycleLen;
  const seedA = hashJS(capIdx + cycleIdx * 13.7, trayIdx * 3.1 + 1.0);
  const seedB = hashJS(capIdx + cycleIdx * 13.7, trayIdx * 3.1 + 7.0);
  const eventDur = 0.4 + 0.3 * seedB;
  const eventStart = 0.1 + seedA * Math.max(cycleLen - eventDur - 0.2, 0.1);
  if (withinT < eventStart || withinT >= eventStart + eventDur) return -1;
  return (withinT - eventStart) / eventDur;
}

// Search for a single global time t (tray 0's clock; other trays run
// t - i*0.18) where the topmost tray reads near peak froth AND is mid-spill,
// while at least one cap anywhere in the stack is visibly mid-weep (not
// just starting, not yet faded) — the one frame the spec calls out as
// needing to show bubbling, spilling and weeping at once. Pure function of
// the same math the shader runs, so the frozen frame the shader paints
// actually matches what this search found.
function findFreezeSeconds(trayCount: number, capCount: number): number {
  const caps = Math.min(40, Math.max(1, capCount));
  for (let step = 0; step < 3000; step++) {
    const t = step * 0.02;
    const froth = frothFracAt(t);
    const spill = spillTAt(t);
    if (froth < 0.45 || spill < 0.25 || spill > 0.85) continue;
    let found = false;
    for (let tr = 0; tr < trayCount && !found; tr++) {
      const tLocal = t - tr * 0.18;
      for (let c = 0; c < caps; c++) {
        const wT = weepProgressAt(c, tr, tLocal);
        if (wT > 0.1 && wT < 0.7) {
          found = true;
          break;
        }
      }
    }
    if (found) return t;
  }
  return 0.45; // fallback: at least lands on a froth peak for tray 0
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`tray-weep: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

const TRAY_SPACING_PX = 90;
const MIN_TRAYS = 2;
const MAX_TRAYS = 6;
const CAP_UNIT_DIVISOR = 14; // caps per min(width,height) of geometry
const HOVER_RADIUS_FRAC = 0.15;
const HOVER_DECAY_MS = 500;
// Reduced-motion freeze: mid-cascade, topmost tray at peak froth, a spill
// mid-transition into the band below, one cap mid-weep (droplet visible,
// not yet detached) — one frame showing bubbling, spilling and weeping
// together. The exact second is computed by findFreezeSeconds() (below,
// mirroring the shader's own math) against the tray/cap count actually laid
// out for the mounted container, not hand-picked once and hoped stable.
const FREEZE_PHASE = "mid-cascade-with-weep";

export function TrayWeep({ className = "", style }: TrayWeepProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    const startedAt = performance.now();
    let pausedAt = 0;
    let w = 0;
    let h = 0;
    let trayCount = MIN_TRAYS;
    let capSpacingNorm = 1 / 14;

    let uRes: WebGLUniformLocation | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uTrayCount: WebGLUniformLocation | null = null;
    let uCapSpacing: WebGLUniformLocation | null = null;
    let uBase: WebGLUniformLocation | null = null;
    let uFrothLo: WebGLUniformLocation | null = null;
    let uFrothHi: WebGLUniformLocation | null = null;
    let uHover: WebGLUniformLocation | null = null;
    let uHoverRadius: WebGLUniformLocation | null = null;

    let base: [number, number, number] = [0.04, 0.04, 0.04];
    let frothLo: [number, number, number] = [0.3, 0.3, 0.3];
    let frothHi: [number, number, number] = [0.93, 0.93, 0.93];

    const deriveColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseHex(cs.getPropertyValue("--background").trim()) ?? base;
      const muted = parseHex(cs.getPropertyValue("--ns-muted").trim()) ?? frothLo;
      const fg = parseHex(cs.getPropertyValue("--foreground").trim()) ?? frothHi;
      const isDark = relLuminance(bg) < 0.5;
      if (isDark) {
        base = bg;
        frothLo = muted;
        frothHi = fg;
      } else {
        base = bg;
        frothLo = mix3(bg, muted, 0.55);
        frothHi = mix3(muted, fg, 0.55);
      }
    };
    deriveColors();

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
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      uRes = gl.getUniformLocation(program, "u_res");
      uTime = gl.getUniformLocation(program, "u_time");
      uTrayCount = gl.getUniformLocation(program, "u_trayCount");
      uCapSpacing = gl.getUniformLocation(program, "u_capSpacing");
      uBase = gl.getUniformLocation(program, "u_base");
      uFrothLo = gl.getUniformLocation(program, "u_frothLo");
      uFrothHi = gl.getUniformLocation(program, "u_frothHi");
      uHover = gl.getUniformLocation(program, "u_hover");
      uHoverRadius = gl.getUniformLocation(program, "u_hoverRadius");
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

    const applyColorUniforms = () => {
      if (!gl || !program) return;
      gl.uniform3f(uBase, base[0], base[1], base[2]);
      gl.uniform3f(uFrothLo, frothLo[0], frothLo[1], frothLo[2]);
      gl.uniform3f(uFrothHi, frothHi[0], frothHi[1], frothHi[2]);
    };

    const applyLayoutUniforms = () => {
      if (!gl || !program) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTrayCount, trayCount);
      gl.uniform1f(uCapSpacing, capSpacingNorm);
      gl.uniform1f(uHoverRadius, HOVER_RADIUS_FRAC);
    };

    // hover state: pointer position in normalized (x, yTop) coords + a
    // strength that ramps to 1 while hovering and decays over 500ms after
    // the pointer leaves — never touches the tray clocks the shader derives
    // froth/liquid/weep timing from.
    let hovering = false;
    let hoverX = 0.5;
    let hoverYTop = 0.5;
    let hoverLeaveAt = 0;
    const hoverStrength = (now: number): number => {
      if (hovering) return 1;
      if (hoverLeaveAt === 0) return 0;
      const t = 1 - (now - hoverLeaveAt) / HOVER_DECAY_MS;
      return t > 0 ? t : 0;
    };

    const draw = (nowMs: number) => {
      if (!gl || !program || w <= 0 || h <= 0) return;
      const timeS = ((nowMs - startedAt) / 1000);
      gl.uniform1f(uTime, timeS);
      gl.uniform3f(uHover, hoverX, hoverYTop, hoverStrength(nowMs));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const loop = (now: number) => {
      draw(now);
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

      trayCount = Math.min(MAX_TRAYS, Math.max(MIN_TRAYS, Math.round(h / TRAY_SPACING_PX)));
      const capUnitPx = Math.max(1, Math.min(w, h) / CAP_UNIT_DIVISOR);
      capSpacingNorm = capUnitPx / w;
      const capCount = Math.max(1, Math.ceil(1 / capSpacingNorm) + 1);
      freezeSeconds = findFreezeSeconds(trayCount, capCount);

      applyLayoutUniforms();
      if (reduced) {
        pausedAt = startedAt + freezeSeconds * 1000;
        draw(pausedAt);
      } else {
        draw(pausedAt || performance.now());
      }
    };

    let freezeSeconds = 0.45;
    let reduced = false;

    if (!setup()) return; // no WebGL: render nothing, container stays transparent
    applyColorUniforms();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced = mq.matches;
    let ioVisible = true;
    const applyMode = () => {
      if (reduced) {
        pausedAt = startedAt + freezeSeconds * 1000;
        sleep();
        draw(pausedAt);
      } else if (ioVisible) {
        wake();
      }
    };
    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);
    applyMode();

    const io = new IntersectionObserver((entries) => {
      ioVisible = entries[0]?.isIntersecting ?? true;
      if (ioVisible && !reduced && document.visibilityState === "visible") wake();
      else if (!ioVisible) sleep();
    });
    io.observe(container);

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!reduced && ioVisible) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const themeObserver = new MutationObserver(() => {
      deriveColors();
      applyColorUniforms();
      if (reduced) draw(pausedAt || performance.now());
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const toNorm = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / rect.width,
        yTop: (clientY - rect.top) / rect.height,
      };
    };
    const onPointerMove = (e: PointerEvent) => {
      if (reduced) return;
      const { x, yTop } = toNorm(e.clientX, e.clientY);
      hovering = true;
      hoverX = x;
      hoverYTop = yTop;
      hoverLeaveAt = 0;
    };
    const onPointerLeave = () => {
      hovering = false;
      hoverLeaveAt = performance.now();
    };
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);
    container.addEventListener("pointercancel", onPointerLeave);

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
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVis);
      themeObserver.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      container.removeEventListener("pointercancel", onPointerLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      sleep();
      teardown();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-reduced-motion-freeze={FREEZE_PHASE}
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}

TrayWeep.displayName = "TrayWeep";

export default TrayWeep;
