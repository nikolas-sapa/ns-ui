"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// weir-crest — a pricing section as a spillway.
//
// Three plans are three dams standing in ONE reservoir. A plan's crest height
// is its included volume (log scale), and the level slider raises a single
// continuous water surface across the whole viewport. The moment the surface
// passes a crest, that dam is overtopped and pours — which is exactly the
// moment that plan's overage term stops being zero. The crossover is therefore
// something you watch happen rather than something you compute.
//
// Everything numeric is DOM text. The canvas draws water, piers, nappes and
// foam, and is aria-hidden; it never renders a price.
// ---------------------------------------------------------------------------

export interface WeirCrestPlan {
  id: string;
  name: string;
  tagline: string;
  /** monthly base, before any annual discount */
  base: number;
  /** included events per month — this is the dam's crest height */
  included: number;
  /** overage charged per 1,000 events above `included` */
  overagePer1k: number;
  features: string[];
  cta: string;
}

export interface WeirCrestProps {
  plans?: WeirCrestPlan[];
  minUsage?: number;
  maxUsage?: number;
  defaultUsage?: number;
  eyebrow?: string;
  headline?: string;
  footnote?: string;
  /** fraction taken off the base on annual billing (0.2 = 20% off) */
  annualDiscount?: number;
  onChange?: (usage: number, annual: boolean) => void;
  className?: string;
}

const DEFAULT_PLANS: WeirCrestPlan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "A low crest. Holds a trickle, spills early.",
    base: 19,
    included: 50_000,
    overagePer1k: 0.9,
    features: ["1 project", "7-day retention", "Email alerts", "Community support"],
    cta: "Start on Starter",
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "The working crest. Most teams sit under it.",
    base: 79,
    included: 400_000,
    overagePer1k: 0.45,
    features: ["10 projects", "90-day retention", "Alert routing", "Priority support"],
    cta: "Choose Growth",
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "A high crest. Dry until the reservoir is full.",
    base: 249,
    included: 2_000_000,
    overagePer1k: 0.22,
    features: ["Unlimited projects", "2-year retention", "Custom routing", "Named engineer"],
    cta: "Talk to sales",
  },
];

const VERT_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// The frozen clock used for prefers-reduced-motion and the very first frame:
// far enough in that the swell has structure and the short dam's nappe is a
// developed sheet rather than a flat wash.
const STATIC_TIME = 7.3;

// Each dam gets one spillway bay, alternating sides so the frame has rhythm;
// the plan's type sits on the solid shoulder opposite it, floor to ceiling, so
// the pour never has to share space with a panel.
const NOTCH_W = 0.4;
const NOTCH_SIDES = [0, 1, 0] as const; // 0 = bay on the left, 1 = on the right

const FRAG_SRC = `
precision highp float;

uniform vec2 u_res;
uniform float u_dpr;
uniform float u_time;
uniform float u_level;
uniform float u_bodyTop;
uniform float u_bodyBot;
uniform float u_slosh;
uniform float u_tick0;
uniform float u_tickStep;
uniform vec4 u_cols[3];
uniform vec4 u_notch[3];
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

// One surface for the whole reservoir: three harmonics plus a drifting fbm
// term, all scaled by the slosh the level spring is carrying — plus, over any
// dam whose crest is already drowned, the standing boil a submerged weir
// actually throws. That boil is the surface-level tell that this plan is
// spilling, and unlike the pour down the face it sits in open water where
// nothing can hide it.
float surfH(float x) {
  float t = u_time;
  float amp = 2.4 + u_slosh * 11.0;
  float h = sin(x * 0.0113 + t * 0.85) * amp
          + sin(x * 0.0271 - t * 1.35) * amp * 0.48
          + sin(x * 0.0605 + t * 2.05) * amp * 0.2
          + (fbm(vec2(x * 0.011, t * 0.33)) - 0.5) * amp * 1.5;
  for (int i = 0; i < 3; i++) {
    vec4 c = u_cols[i];
    vec4 n = u_notch[i];
    float inX = smoothstep(-26.0, 14.0, x - n.x) * smoothstep(-26.0, 14.0, n.x + n.y - x);
    h -= inX * c.w * (3.5
       + sin(x * 0.085 - t * 4.2) * 2.6
       + (fbm(vec2(x * 0.05, t * 1.7)) - 0.5) * 9.0);
  }
  return u_level + h;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x / u_dpr, u_res.y - gl_FragCoord.y / u_dpr);
  float bodyH = max(1.0, u_bodyBot - u_bodyTop);

  // --- dry field ---------------------------------------------------------
  float gy = clamp((p.y - u_bodyTop) / bodyH, 0.0, 1.0);
  vec3 col = mix(u_c0, mix(u_c0, u_c1, 0.42), gy * 0.55);

  // decade rules: the gauge the rail is labelled against, run full width so
  // the whole frame reads as one instrument rather than a picture with a
  // slider beside it
  float rules = 0.0;
  for (int k = 0; k < 8; k++) {
    float f = u_tick0 + float(k) * u_tickStep;
    float ty = u_bodyBot - f * bodyH;
    float major = mod(float(k), 3.0) < 0.5 ? 1.0 : 0.45;
    rules = max(rules, (1.0 - smoothstep(0.0, 1.1, abs(p.y - ty))) * major * step(f, 1.001));
  }
  col = mix(col, mix(u_c1, u_c2, 0.5), rules * 0.55);

  // --- piers -------------------------------------------------------------
  float pier = 0.0;
  float edge = 0.0;
  float crest = 0.0;
  float nappe = 0.0;
  float foam = 0.0;
  float lip = 0.0;
  float crestShadow = 0.0;

  for (int i = 0; i < 3; i++) {
    vec4 c = u_cols[i];
    vec4 n = u_notch[i];
    float x0 = c.x;
    float x1 = c.x + c.y;
    float cy = c.z;
    float sp = c.w;

    float inX = smoothstep(-1.0, 1.0, p.x - x0) * smoothstep(-1.0, 1.0, x1 - p.x);
    // The spillway bay: the crest number a plan advertises is the elevation of
    // this notch, and the non-overflow shoulders either side stand a parapet
    // above it — so the pour has one lane, permanently clear of the type that
    // sits on the shoulder.
    float inN = smoothstep(-1.0, 1.0, p.x - n.x) * smoothstep(-1.0, 1.0, n.x + n.y - p.x);
    float topY = mix(cy - 22.0, cy, inN);
    float below = smoothstep(-1.0, 1.5, p.y - topY) * smoothstep(2.0, -1.0, p.y - u_bodyBot);
    float body = inX * below;
    pier = max(pier, body);

    float e = max(1.0 - smoothstep(0.4, 1.6, abs(p.x - x0)),
                  1.0 - smoothstep(0.4, 1.6, abs(p.x - x1)));
    e = max(e, max(1.0 - smoothstep(0.4, 1.6, abs(p.x - n.x)),
                   1.0 - smoothstep(0.4, 1.6, abs(p.x - n.x - n.y)))
              * smoothstep(0.0, 3.0, p.y - cy + 22.0) * (1.0 - smoothstep(18.0, 26.0, p.y - cy + 22.0)));
    edge = max(edge, e * below);

    crest = max(crest, inX * (1.0 - smoothstep(1.2, 3.2, abs(p.y - topY))));
    crestShadow = max(crestShadow, inX * (1.0 - smoothstep(2.0, 16.0, p.y - topY)) * step(topY, p.y));

    if (sp > 0.002) {
      body *= inN;
      float fall = clamp((p.y - cy) / max(60.0, u_bodyBot - cy), 0.0, 1.0);
      // vertical striations scrolling down the face, faster the harder it pours
      float streak = fbm(vec2(p.x * 0.055, p.y * 0.004 - u_time * (1.1 + 2.2 * sp)));
      float ribs = 0.5 + 0.5 * sin(p.x * 0.075 + fbm(vec2(p.x * 0.012, u_time * 0.35)) * 5.0);
      float sheet = body * sp * (0.22 + 1.15 * streak) * (0.45 + 0.55 * ribs) * (0.55 + 0.5 * fall);
      nappe = max(nappe, sheet);

      // the lip: a thick bright roll of water right at the crest, and the
      // clear glassy tongue just under it before the sheet breaks up
      lip = max(lip, inN * sp * (1.0 - smoothstep(0.0, 6.0 + 11.0 * sp, abs(p.y - cy - 4.0))));

      // the apron: a boiling hydraulic jump where the sheet lands
      float boil = fbm(vec2(p.x * 0.045, (u_bodyBot - p.y) * 0.05 - u_time * 1.5))
                 + 0.6 * fbm(vec2(p.x * 0.12 + 11.0, u_time * 2.1));
      float apron = body * sp * exp(-abs(p.y - u_bodyBot + 6.0) * 0.028) * (0.25 + 0.95 * boil);
      foam = max(foam, apron);
    }
  }

  // masonry courses, so a submerged pier still reads as built structure
  float course = 1.0 - smoothstep(0.0, 1.4, abs(mod(p.y, 19.0) - 9.5));
  float joint = 1.0 - smoothstep(0.0, 1.4, abs(mod(p.x + floor(p.y / 19.0) * 26.0, 52.0) - 26.0));
  vec3 pierCol = mix(u_c1, u_c2, 0.26);
  pierCol = mix(pierCol, mix(u_c1, u_c0, 0.6), max(course, joint * (1.0 - course)) * 0.5);
  pierCol = mix(pierCol, u_c0, clamp((p.y - u_bodyTop) / bodyH, 0.0, 1.0) * 0.3);
  col = mix(col, pierCol, pier);
  col = mix(col, mix(u_c2, u_c3, 0.3), edge * 0.5);

  // --- water -------------------------------------------------------------
  float hs = surfH(p.x);
  float sub = smoothstep(-1.0, 1.0, p.y - hs);
  float d = max(0.0, p.y - hs);
  float caust = sin(d * 0.048 - u_time * 0.8 + p.x * 0.0072
                    + fbm(vec2(p.x * 0.0055, d * 0.0055 - u_time * 0.11)) * 3.6);
  float caust2 = sin(d * 0.017 + u_time * 0.45 - p.x * 0.0033
                    + fbm(vec2(p.x * 0.0032 + 4.0, d * 0.003)) * 2.4);
  vec3 water = mix(u_c1, u_c2, 0.24 + 0.42 * (caust * 0.5 + 0.5) * exp(-d * 0.0016));
  water = mix(water, u_c2, (caust2 * 0.5 + 0.5) * 0.16);
  water = mix(water, u_c0, clamp(d * 0.0008, 0.0, 0.38));
  col = mix(col, water, sub * 0.86);

  // Rising bubbles, biased toward whichever dam is pouring: the aeration a
  // drowned crest drags under is the second surface-level tell, and unlike the
  // face pour it happens in open water.
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float pick = hash(vec2(fi, 3.0));
    float bx = fract(pick + fi * 0.19) * u_res.x;
    for (int k = 0; k < 3; k++) {
      vec4 c = u_cols[k];
      bx = mix(bx, c.x + c.y * (0.15 + 0.7 * pick), step(0.55, c.w) * step(hash(vec2(fi, 5.0 + float(k))), 0.42));
    }
    float ph = fract(u_time * (0.05 + 0.03 * fi) + hash(vec2(fi, 7.0)));
    float by = mix(u_bodyBot, hs, ph);
    float r = 1.6 + 2.4 * hash(vec2(fi, 11.0));
    vec2 dv = p - vec2(bx + sin(u_time * 0.9 + fi) * 7.0, by);
    float g = exp(-dot(dv, dv) / (r * r * 2.0));
    col = mix(col, u_c3, g * 0.26 * sub * (1.0 - ph * 0.3));
  }

  // --- surface line ------------------------------------------------------
  float men = 1.0 - smoothstep(0.0, 2.4, abs(p.y - hs));
  col = mix(col, u_c3, men * 0.6);
  float glow = exp(-max(0.0, hs - p.y) * 0.05) * (1.0 - sub);
  col = mix(col, mix(u_c2, u_c3, 0.45), glow * 0.12);

  // --- pour --------------------------------------------------------------
  col = mix(col, mix(u_c2, u_c3, 0.55), clamp(nappe, 0.0, 1.0) * 0.95);
  col = mix(col, mix(u_c2, u_c3, 0.85), clamp(lip, 0.0, 1.0) * 0.8);
  col = mix(col, u_c3, clamp(foam, 0.0, 1.0) * 0.6);
  // the crest reads as an edge: a bright sill with its own shadow under it
  col = mix(col, u_c0, crestShadow * 0.5);
  col = mix(col, mix(u_c2, u_c3, 0.85), crest * 0.9);

  // grain + a mild vignette so the frame edges never out-value the type
  col += (hash(p * 1.7 + fract(u_time)) - 0.5) * 0.013;
  vec2 q = (p / u_res - 0.5) * vec2(1.25, 1.0);
  col = mix(col, u_c0, clamp(dot(q, q) * 0.55, 0.0, 0.3));

  gl_FragColor = vec4(col, 1.0);
}
`;

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3 && parts.every((v) => Number.isFinite(v))) {
      return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
    }
  }
  return null;
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
    throw new Error(`weir-crest: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

// Minimal full-bleed fragment-shader host: one program, one fullscreen
// triangle pair, uniform locations resolved lazily by name.
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
  v4a(name: string, data: Float32Array) {
    this.gl?.uniform4fv(this.loc(name), data);
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

// --- number shaping --------------------------------------------------------

function compactVolume(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}k`;
  }
  return `${Math.round(n)}`;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function fullVolume(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function WeirCrest({
  plans = DEFAULT_PLANS,
  minUsage = 10_000,
  maxUsage = 5_000_000,
  defaultUsage = 300_000,
  eyebrow = "ns-ui / weir-crest",
  headline = "Raise the level.\nSee which dam holds.",
  footnote = "Every plan is a dam. Its crest is the volume it holds without overage — past the crest it pours, and you pay for the spill.",
  annualDiscount = 0.2,
  onChange,
  className = "",
}: WeirCrestProps) {
  const uid = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<(HTMLElement | null)[]>([]);
  const bandRefs = useRef<(HTMLElement | null)[]>([]);

  const [usage, setUsage] = useState(defaultUsage);
  const [annual, setAnnual] = useState(false);
  const [announce, setAnnounce] = useState("");

  const logMin = Math.log(minUsage);
  const logMax = Math.log(maxUsage);
  const span = Math.max(1e-6, logMax - logMin);

  const fracOf = useCallback(
    (v: number) => (Math.log(Math.min(maxUsage, Math.max(minUsage, v))) - logMin) / span,
    [logMin, span, minUsage, maxUsage]
  );
  const valueOf = useCallback(
    (f: number) => Math.exp(logMin + Math.min(1, Math.max(0, f)) * span),
    [logMin, span]
  );

  const priced = useMemo(() => {
    return plans.map((p) => {
      const base = p.base * (annual ? 1 - annualDiscount : 1);
      const over = Math.max(0, usage - p.included) / 1000 * p.overagePer1k;
      return { plan: p, base, over, total: base + over, frac: fracOf(p.included) };
    });
  }, [plans, usage, annual, annualDiscount, fracOf]);

  const bestIndex = useMemo(() => {
    let bi = 0;
    for (let i = 1; i < priced.length; i++) if (priced[i].total < priced[bi].total) bi = i;
    return bi;
  }, [priced]);

  const levelFrac = fracOf(usage);

  // Everything the render loop reads lives in refs: the loop must never depend
  // on a React render landing first.
  const levelFracRef = useRef(levelFrac);
  levelFracRef.current = levelFrac;
  const crestFracsRef = useRef<number[]>(priced.map((p) => p.frac));
  crestFracsRef.current = priced.map((p) => p.frac);
  // [first decade's fraction, one decade in fractions] — the gauge the shader
  // rules the frame with, and the same domain the rail is labelled on
  const gaugeRef = useRef<[number, number]>([0, 1]);
  gaugeRef.current = [
    (Math.ceil(Math.log10(minUsage)) * Math.LN10 - logMin) / span,
    Math.LN10 / span,
  ];

  const commit = useCallback(
    (v: number) => {
      const best = plans.reduce(
        (acc, p) => {
          const base = p.base * (annual ? 1 - annualDiscount : 1);
          const t = base + (Math.max(0, v - p.included) / 1000) * p.overagePer1k;
          return t < acc.t ? { p, t } : acc;
        },
        { p: plans[0], t: Number.POSITIVE_INFINITY }
      );
      setAnnounce(
        `${fullVolume(v)} events per month. Cheapest plan ${best.p.name}, ${money(best.t)} per month${
          annual ? ", billed annually" : ""
        }.`
      );
    },
    [plans, annual, annualDiscount]
  );

  const apply = useCallback(
    (v: number, announceIt: boolean) => {
      const clamped = Math.min(maxUsage, Math.max(minUsage, v));
      setUsage(clamped);
      onChange?.(clamped, annual);
      if (announceIt) commit(clamped);
    },
    [maxUsage, minUsage, onChange, annual, commit]
  );

  // --- slider: pointer -----------------------------------------------------
  const draggingRef = useRef(false);

  const fromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return usage;
      const r = track.getBoundingClientRect();
      const f = 1 - (clientY - r.top) / Math.max(1, r.height);
      return valueOf(f);
    },
    [usage, valueOf]
  );

  const onTrackPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      if (!track) return;
      draggingRef.current = true;
      try {
        track.setPointerCapture(e.pointerId);
      } catch {
        /* a synthetic pointerId matches no live pointer */
      }
      track.focus();
      apply(fromClientY(e.clientY), false);
    },
    [apply, fromClientY]
  );

  const onTrackPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      apply(fromClientY(e.clientY), false);
    },
    [apply, fromClientY]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        trackRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* see above */
      }
      commit(usage);
    },
    [commit, usage]
  );

  const onTrackKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = 0.02;
      let f = fracOf(usage);
      switch (e.key) {
        case "ArrowUp":
        case "ArrowRight":
          f += step;
          break;
        case "ArrowDown":
        case "ArrowLeft":
          f -= step;
          break;
        case "PageUp":
          f += step * 5;
          break;
        case "PageDown":
          f -= step * 5;
          break;
        case "Home":
          f = 0;
          break;
        case "End":
          f = 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      const v = valueOf(Math.min(1, Math.max(0, f)));
      apply(v, true);
    },
    [apply, fracOf, usage, valueOf]
  );

  // --- the surface ---------------------------------------------------------
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const surface = new GLSurface(canvas, FRAG_SRC);
    if (!surface.init()) return;

    let raf = 0;
    let running = false;
    let disposed = false;
    let reduced = false;
    let visible = true;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let lastMs = performance.now();
    let simTime = STATIC_TIME;

    let bodyTop = 0;
    let bodyBot = 0;
    const cols = new Float32Array(12);
    const notches = new Float32Array(12);
    const colGeom: { x: number; w: number }[] = [];

    // level in px, integrated by a spring so a drag throws chop and the
    // surface settles rather than teleporting
    let levelPx = -1;
    let levelVel = 0;
    let slosh = 0;

    let c0: RGB = [0.04, 0.04, 0.04];
    let c1: RGB = [0.14, 0.14, 0.14];
    let c2: RGB = [0.5, 0.5, 0.5];
    let c3: RGB = [0.93, 0.93, 0.93];

    // Four stops. A full-bleed reservoir IS the page, so both themes span a
    // wide range and neither inverts: light reads as a mid-grey pool under a
    // pale sky, dark as a lit pour in a dark room.
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      const fg = parseColor(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      const muted = parseColor(cs.getPropertyValue("--ns-muted")) ?? [0.55, 0.55, 0.55];
      const border = parseColor(cs.getPropertyValue("--border")) ?? [0.2, 0.2, 0.2];
      if (luminance(bg) < 0.5) {
        c0 = mixRGB(bg, [0, 0, 0], 0.45);
        c1 = mixRGB(bg, border, 0.9);
        c2 = mixRGB(muted, fg, 0.15);
        c3 = fg;
      } else {
        c0 = mixRGB(bg, fg, 0.035);
        c1 = mixRGB(bg, fg, 0.34);
        c2 = mixRGB(bg, fg, 0.62);
        c3 = fg;
      }
      surface.v3("u_c0", c0);
      surface.v3("u_c1", c1);
      surface.v3("u_c2", c2);
      surface.v3("u_c3", c3);
    };

    // The reservoir band is the intersection of the three columns' clear
    // middles — the strip of the layout that carries no DOM, so the pour is
    // never hidden behind a panel.
    const measure = () => {
      const wr = wrap.getBoundingClientRect();
      let top = -Infinity;
      let bot = Infinity;
      colGeom.length = 0;
      for (let i = 0; i < 3; i++) {
        const r = colRefs.current[i]?.getBoundingClientRect();
        colGeom.push(r ? { x: r.left - wr.left, w: r.width } : { x: 0, w: 0 });
        const b = bandRefs.current[i]?.getBoundingClientRect();
        if (b) {
          top = Math.max(top, b.top - wr.top);
          bot = Math.min(bot, b.bottom - wr.top);
        }
      }
      bodyTop = Number.isFinite(top) ? top : wr.height * 0.35;
      bodyBot = Number.isFinite(bot) ? bot : wr.height * 0.9;
      if (bodyBot - bodyTop < 40) bodyBot = bodyTop + 40;
    };

    const resize = () => {
      const w = Math.max(1, Math.round(wrap.clientWidth));
      const h = Math.max(1, Math.round(wrap.clientHeight));
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cssW = w;
      cssH = h;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      measure();
      levelPx = -1; // re-seed the spring at the new geometry
      draw(0);
    };

    const targetLevel = () => {
      const h = Math.max(1, bodyBot - bodyTop);
      return bodyBot - levelFracRef.current * h;
    };

    const draw = (dt: number) => {
      const h = Math.max(1, bodyBot - bodyTop);
      const tgt = targetLevel();
      if (levelPx < 0 || reduced) {
        levelPx = tgt;
        levelVel = 0;
        slosh = 0;
      } else {
        // semi-implicit Euler, ~one small overshoot then settled inside 0.8s
        const acc = -60 * (levelPx - tgt) - 11 * levelVel;
        levelVel += acc * dt;
        levelPx += levelVel * dt;
        slosh += (Math.min(1, Math.abs(levelVel) / 900) - slosh) * Math.min(1, dt * 6);
      }

      for (let i = 0; i < 3; i++) {
        const g = colGeom[i] ?? { x: 0, w: 0 };
        const crestY = bodyBot - (crestFracsRef.current[i] ?? 0) * h;
        const spill = Math.min(1, Math.max(0, (crestY - levelPx) / 70));
        cols[i * 4] = g.x;
        cols[i * 4 + 1] = g.w;
        cols[i * 4 + 2] = crestY;
        cols[i * 4 + 3] = spill;
        const nw = g.w * NOTCH_W;
        notches[i * 4] = NOTCH_SIDES[i] === 0 ? g.x + g.w * 0.05 : g.x + g.w * (0.95 - NOTCH_W);
        notches[i * 4 + 1] = nw;
      }

      surface.v2("u_res", cssW, cssH);
      surface.f("u_dpr", dpr);
      surface.f("u_time", simTime);
      surface.f("u_level", levelPx);
      surface.f("u_bodyTop", bodyTop);
      surface.f("u_bodyBot", bodyBot);
      surface.f("u_slosh", slosh);
      surface.f("u_tick0", gaugeRef.current[0]);
      surface.f("u_tickStep", gaugeRef.current[1]);
      surface.v4a("u_cols", cols);
      surface.v4a("u_notch", notches);
      surface.draw(canvas.width, canvas.height);
    };

    const frame = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, Math.max(0, (now - lastMs) / 1000));
      lastMs = now;
      simTime += dt;
      draw(dt);
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || disposed || reduced || !visible || document.hidden) return;
      running = true;
      lastMs = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    readColors();
    resize();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => {
      reduced = mq.matches;
      if (reduced) {
        stop();
        simTime = STATIC_TIME;
        draw(0);
      } else {
        start();
      }
    };
    reduced = mq.matches;
    onMq();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) start();
        else stop();
      },
      { threshold: 0 }
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVis);
    mq.addEventListener("change", onMq);

    const themeObs = new MutationObserver(() => {
      readColors();
      if (reduced || !running) draw(0);
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    const onSchemeChange = () => {
      readColors();
      if (reduced || !running) draw(0);
    };
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", onSchemeChange);

    const onLost = (e: Event) => {
      e.preventDefault();
      stop();
    };
    const onRestored = () => {
      if (surface.init()) {
        readColors();
        resize();
        start();
      }
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    // React state changes (usage, annual, layout) land here through refs; a
    // frozen surface still has to repaint once.
    const poke = () => {
      measure();
      if (reduced || !running) draw(0);
    };
    (wrap as HTMLDivElement & { __weirPoke?: () => void }).__weirPoke = poke;

    return () => {
      disposed = true;
      stop();
      ro.disconnect();
      io.disconnect();
      themeObs.disconnect();
      mq.removeEventListener("change", onMq);
      scheme.removeEventListener("change", onSchemeChange);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      delete (wrap as HTMLDivElement & { __weirPoke?: () => void }).__weirPoke;
      surface.destroy();
    };
  }, []);

  // A reduced-motion surface draws only on demand, so every value change has
  // to knock on it.
  useEffect(() => {
    const wrap = wrapRef.current as (HTMLDivElement & { __weirPoke?: () => void }) | null;
    wrap?.__weirPoke?.();
  }, [usage, annual, plans]);

  const ticks = useMemo(() => {
    const out: { v: number; f: number }[] = [];
    for (let e = Math.ceil(Math.log10(minUsage)); Math.pow(10, e) <= maxUsage; e++) {
      const v = Math.pow(10, e);
      out.push({ v, f: fracOf(v) });
    }
    return out;
  }, [minUsage, maxUsage, fracOf]);

  return (
    <div
      ref={wrapRef}
      className={`relative isolate h-full min-h-screen w-full overflow-hidden bg-background text-foreground ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block h-full w-full" />

      <div className="relative z-10 flex h-full min-h-screen flex-col gap-4 px-4 py-5 sm:px-8 sm:py-7">
        {/* --- header ------------------------------------------------------ */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl rounded-md bg-background/78 px-4 py-3 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ns-muted sm:text-[11px]">
              {eyebrow}
            </p>
            <h2 className="mt-2 whitespace-pre-line text-[clamp(1.6rem,4.2vw,3.1rem)] font-medium leading-[0.98] tracking-tight text-foreground">
              {headline}
            </h2>
          </div>

          <div className="flex items-end gap-4 rounded-md bg-background/78 px-4 py-3 backdrop-blur-md">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-ns-muted">
                Volume / month
              </p>
              <p className="mt-1 font-mono text-2xl leading-none tracking-tight text-foreground tabular-nums sm:text-3xl">
                {compactVolume(usage)}
              </p>
            </div>
            <fieldset className="border-0 p-0">
              <legend className="sr-only">Billing term</legend>
              <div className="flex overflow-hidden rounded-sm border border-border">
                {[
                  { label: "Monthly", value: false },
                  { label: "Annual", value: true },
                ].map((opt) => (
                  <label
                    key={opt.label}
                    className={`cursor-pointer px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ns-accent ${
                      annual === opt.value
                        ? "bg-foreground text-background"
                        : "bg-background/60 text-ns-muted hover:text-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${uid}-term`}
                      className="sr-only"
                      checked={annual === opt.value}
                      onChange={() => {
                        setAnnual(opt.value);
                        onChange?.(usage, opt.value);
                        setAnnounce(
                          `${opt.label} billing. ${fullVolume(usage)} events per month.`
                        );
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </div>

        {/* --- body: rail + three dams ------------------------------------- */}
        <div className="relative flex min-h-0 flex-1 gap-3 sm:gap-5">
          {/* the level rail: this slider IS the water surface */}
          <div className="flex w-16 shrink-0 flex-col sm:w-24">
            <div
              ref={trackRef}
              data-weir-track=""
              role="slider"
              tabIndex={0}
              aria-label="Monthly event volume"
              aria-orientation="vertical"
              aria-valuemin={minUsage}
              aria-valuemax={maxUsage}
              aria-valuenow={Math.round(usage)}
              aria-valuetext={`${fullVolume(usage)} events per month`}
              onPointerDown={onTrackPointerDown}
              onPointerMove={onTrackPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onTrackKeyDown}
              className="relative min-h-0 flex-1 cursor-ns-resize touch-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              <span aria-hidden="true" className="absolute inset-y-0 right-2 w-px bg-border" />
              {ticks.map((t) => (
                <span
                  key={t.v}
                  aria-hidden="true"
                  className="absolute right-2 flex -translate-y-1/2 items-center gap-1"
                  style={{ top: `${(1 - t.f) * 100}%` }}
                >
                  <span className="font-mono text-[10px] tabular-nums text-ns-muted">
                    {compactVolume(t.v)}
                  </span>
                  <span className="block h-px w-1.5 bg-border" />
                </span>
              ))}
              {/* the handle: a level marker, not a knob */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -translate-y-1/2"
                style={{ top: `${(1 - levelFrac) * 100}%` }}
              >
                <span className="flex items-center justify-end">
                  <span className="mr-1 bg-background/78 px-1 font-mono text-[10px] leading-tight tabular-nums text-foreground backdrop-blur-sm">
                    {compactVolume(usage)}
                  </span>
                  <span className="block h-2.5 w-2.5 shrink-0 -translate-x-[3px] rotate-45 border border-foreground bg-background" />
                </span>
              </span>
            </div>
          </div>

          {/* three plans, three crests */}
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 sm:gap-5">
            {priced.map((row, i) => {
              const best = i === bestIndex;
              const spilling = usage > row.plan.included;
              return (
                <article
                  key={row.plan.id}
                  ref={(el) => {
                    colRefs.current[i] = el;
                  }}
                  aria-label={`${row.plan.name} plan`}
                  className="relative flex min-h-0 flex-col gap-3 sm:gap-5"
                >
                  <div
                    className={`overflow-hidden rounded-md bg-background/78 p-3 backdrop-blur-md sm:p-4 ${HEAD_H}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-base font-medium tracking-tight text-foreground sm:text-lg">
                        {row.plan.name}
                      </h3>
                      {best ? (
                        <span className="shrink-0 rounded-sm border border-foreground px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-foreground">
                          Cheapest here
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 hidden text-xs leading-snug text-ns-muted sm:block">
                      {row.plan.tagline}
                    </p>
                    <p className="mt-3 font-mono text-[clamp(1.5rem,3.4vw,2.6rem)] leading-none tracking-tight text-foreground tabular-nums">
                      {money(row.total)}
                      <span className="ml-1 font-sans text-xs text-ns-muted">/mo</span>
                    </p>
                    <p className="mt-2 font-mono text-[10px] leading-relaxed text-ns-muted tabular-nums sm:text-[11px]">
                      {money(row.base)} base
                      {spilling
                        ? ` + ${money(row.over)} spill · ${compactVolume(usage - row.plan.included)} over the crest`
                        : " · holds, no spill"}
                    </p>
                  </div>

                  {/* the dam itself: kept clear of DOM so the pour is visible */}
                  <div
                    ref={(el) => {
                      bandRefs.current[i] = el;
                    }}
                    className="relative min-h-0 flex-1"
                  >
                    <span
                      className="pointer-events-none absolute inset-x-0 -translate-y-full pb-1 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-ns-muted"
                      style={{ top: `${(1 - row.frac) * 100}%` }}
                    >
                      <span className="bg-background/78 px-1.5 py-0.5 backdrop-blur-sm">
                        Crest · {compactVolume(row.plan.included)} included
                      </span>
                    </span>
                  </div>

                  <div
                    className={`overflow-hidden rounded-md bg-background/78 p-3 backdrop-blur-md sm:p-4 ${FOOT_H}`}
                  >
                    <ul className="hidden space-y-1 text-xs text-ns-muted sm:block">
                      {row.plan.features.map((f) => (
                        <li key={f} className="flex gap-2">
                          <span aria-hidden="true" className="mt-[7px] h-px w-2.5 shrink-0 bg-border" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ns-muted sm:mt-3">
                      {money(row.plan.overagePer1k * 1000)} per million over
                    </p>
                    <button
                      type="button"
                      className={`mt-2 w-full rounded-sm px-3 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent sm:text-sm ${
                        best
                          ? "bg-ns-accent text-white hover:bg-ns-accent-hover"
                          : "border border-border bg-background/70 text-foreground hover:bg-background"
                      }`}
                    >
                      {row.plan.cta}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* --- footer ------------------------------------------------------ */}
        <p className="max-w-3xl rounded-md bg-background/78 px-3 py-2 font-mono text-[10px] leading-relaxed text-ns-muted backdrop-blur-md sm:text-[11px]">
          {footnote}
        </p>
      </div>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}

export default WeirCrest;
