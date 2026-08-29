"use client";

import { useEffect, useId, useRef } from "react";

// ---------------------------------------------------------------------------
// PhotostatReverse — a full-bleed hero headline reproduced the way a photostat
// camera reproduced line art: direct-onto-paper photography that comes out
// TONE-REVERSED (a negative), so getting a true-tone copy back means shooting
// the negative a second time. Every generation pass also softens and thickens
// the line work a little — real, documented generation loss in photographic
// line-art reproduction — and the whole thing compounds for five generations
// before a fresh, crisp exposure resets it.
//
// The palette problem is solved the same way weld-pool and flyback-tear solve
// it: the mechanic IS a value inversion already, so there is nothing to
// re-hue. Two tokens only, --background and --foreground, and which one
// plays "ink" versus "field" is exactly what flips every 1.3s.
//
// APPROXIMATE SDF: a true signed-distance field is overkill for one rasterized
// headline, so the mask is baked once (on mount / resize / headline change) as
// two channels of one texture — R a sharp alpha straight off the 2D canvas
// (whose own antialiasing already gives a few px of usable gradient at every
// edge), G the same mask blurred by the canvas 2D `filter: blur()` — and the
// runtime shader mixes R -> G by how degraded the current generation is, then
// re-thresholds the mix. Thresholding a blurred alpha below 0.5 dilates it
// (thicker strokes), above 0.5 erodes it (thinner) — the standard cheap
// stand-in for a real distance field, and exactly what "stroke width grows,
// edges soften" needs.
// ---------------------------------------------------------------------------

export interface PhotostatReverseProps {
  /** Headline rasterized into the mask. "\n" splits lines. */
  headline?: string;
  /** Glyph weight for the headline. @default 800 */
  headlineWeight?: number;
  /** Fraction of the width the longest headline line fills. @default 0.62 */
  headlineFit?: number;
  /** Vertical centre of the headline, 0..1. @default 0.5 */
  headlineY?: number;
  /** Generation-cycle and paper-grain speed. @default 1 */
  speed?: number;
  /** Freezes on the composed still frame without unmounting. */
  paused?: boolean;
  /** Rendered in the DOM over the field — eyebrow, subhead, CTA. */
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

uniform vec2 u_size;
uniform float u_dpr;
uniform float u_time;
uniform sampler2D u_mask;

// from-generation (outgoing) params
uniform float u_threshFrom;
uniform float u_edgeFrom;
uniform float u_toneFrom;   // 0 = positive (fg on bg), 1 = negative (bg on fg)
// to-generation (incoming) params
uniform float u_threshTo;
uniform float u_edgeTo;
uniform float u_toneTo;
uniform float u_transition; // 0..1, eased, 0 = fully "from", 1 = fully "to"

uniform vec2 u_ptr;         // css px, y down
uniform float u_ptrActive;
uniform float u_ptrRadius;

uniform vec3 u_bg;
uniform vec3 u_fg;

float hash21(vec2 p) {
  p = fract(p * vec2(287.13, 419.71));
  p += dot(p, p + 27.31);
  return fract(p.x * p.y);
}

// effective in-letter fraction for one generation's params, given the same
// raw soft-alpha sample: thresholding a blurred mask below 0.5 dilates it,
// above erodes it, which is the whole "stroke width" knob.
float genMask(float soft, float thresh, float edge, float tone) {
  float m = smoothstep(thresh - edge, thresh + edge, soft);
  // tone flip swaps which side of the mask is "ink": a negative generation
  // reads the FIELD as ink and the letterform as the gap in it.
  return mix(m, 1.0 - m, tone);
}

void main() {
  vec2 fc = gl_FragCoord.xy / u_dpr;
  vec2 uv = vec2(fc.x / u_size.x, fc.y / u_size.y);

  vec2 mc = texture2D(u_mask, uv).rg;
  float sharp = mc.r;
  float softSample = mc.g;

  // local "fresh exposure": pointer proximity pulls BOTH the from- and the
  // to-generation params toward generation-1 crispness (edge -> its floor,
  // threshold -> 0.5) without touching the tone flip or the global cadence,
  // so hovering never desyncs the flip elsewhere in the frame.
  float d = distance(fc, u_ptr);
  float crisp = u_ptrActive * smoothstep(u_ptrRadius, 0.0, d);
  float tf = mix(u_threshFrom, 0.5, crisp);
  float ef = mix(u_edgeFrom, 0.012, crisp);
  float tt = mix(u_threshTo, 0.5, crisp);
  float et = mix(u_edgeTo, 0.012, crisp);

  // Softness itself also relaxes toward the sharp channel under the pointer
  // (a fresh exposure has no accumulated blur to draw from).
  float soft = mix(softSample, sharp, crisp);
  soft = mix(soft, sharp, 0.0); // keep sharp channel reachable below

  float mFrom = genMask(mix(soft, sharp, crisp), tf, ef, u_toneFrom);
  float mTo = genMask(mix(soft, sharp, crisp), tt, et, u_toneTo);

  // THE FLIP: both generations are evaluated against the SAME mask sample and
  // blended by the eased transition, so the 260ms window genuinely shows
  // departure (mFrom fading out) and arrival (mTo fading in) rather than a
  // hard cut between two textures.
  float m = mix(mFrom, mTo, u_transition);

  vec3 col = mix(u_bg, u_fg, m);

  // paper grain: photostat stock is never perfectly flat. A slow per-texel
  // hash keeps the field alive at rest even in a stretch between flips, at an
  // amplitude far below the flip itself so it never competes with it.
  float grain = hash21(floor(fc * 0.6) + floor(u_time * 3.0));
  col += (grain - 0.5) * 0.025;

  // a soft vignette toward the deepest stop keeps the frame edges from
  // competing with the headline
  vec2 cc = uv * 2.0 - 1.0;
  float vig = smoothstep(0.55, 1.35, length(cc));
  col = mix(col, mix(u_bg, u_fg, m * 0.6), vig * 0.12);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
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
    throw new Error(`photostat-reverse: shader compile failed: ${info ?? ""}`);
  }
  return s;
}

class Program {
  prog: WebGLProgram | null = null;
  private vs: WebGLShader | null = null;
  private fs: WebGLShader | null = null;
  private locs = new Map<string, WebGLUniformLocation | null>();

  constructor(private gl: WebGLRenderingContext, frag: string) {
    this.vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    this.fs = compile(gl, gl.FRAGMENT_SHADER, frag);
    const p = gl.createProgram();
    if (!p) throw new Error("photostat-reverse: createProgram failed");
    this.prog = p;
    gl.attachShader(p, this.vs);
    gl.attachShader(p, this.fs);
    gl.bindAttribLocation(p, 0, "a_pos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error("photostat-reverse: link failed");
    }
  }

  use() {
    this.gl.useProgram(this.prog);
  }

  private loc(name: string) {
    if (!this.locs.has(name)) {
      this.locs.set(name, this.gl.getUniformLocation(this.prog!, name));
    }
    return this.locs.get(name) ?? null;
  }

  f(name: string, x: number) {
    this.gl.uniform1f(this.loc(name), x);
  }
  i(name: string, x: number) {
    this.gl.uniform1i(this.loc(name), x);
  }
  v2(name: string, x: number, y: number) {
    this.gl.uniform2f(this.loc(name), x, y);
  }
  v3(name: string, c: RGB) {
    this.gl.uniform3f(this.loc(name), c[0], c[1], c[2]);
  }

  destroy() {
    const gl = this.gl;
    if (this.prog) gl.deleteProgram(this.prog);
    if (this.vs) gl.deleteShader(this.vs);
    if (this.fs) gl.deleteShader(this.fs);
    this.prog = null;
    this.vs = null;
    this.fs = null;
    this.locs.clear();
  }
}

// Generation cadence, in seconds. One flip every 1.3s, a 260ms crossfade for
// each flip, five generations (indices 0..4) compounding stroke growth (4%)
// and edge softening (6%) before a crisp, non-flipping reset back to index 0.
const GEN_PERIOD = 1.3;
const TRANSITION_DUR = 0.26;
const STROKE_GROWTH = 1.04;
const EDGE_GROWTH = 1.06;
const BASE_THRESH_STEP = 0.024;
const BASE_EDGE = 0.014;

// generation index -> (thresholdOffset, edgeWidth) for that generation's own
// degradation level, compounding STROKE_GROWTH / EDGE_GROWTH per step
function genParams(level: number): { thresh: number; edge: number } {
  const strokeGrowth = Math.pow(STROKE_GROWTH, level) - 1;
  const edgeGrowth = Math.pow(EDGE_GROWTH, level);
  return {
    thresh: 0.5 - BASE_THRESH_STEP * strokeGrowth * 4, // dilation grows with generation
    edge: BASE_EDGE * edgeGrowth,
  };
}

// The reduced-motion / paused still: generation 3 (index 2), positive tone,
// fully settled — soft enough to show generation loss exists, still legible,
// never the near-mush of generation 5.
const STATIC_LEVEL = 2;
const STATIC_TONE = 0;

export function PhotostatReverse({
  headline = "GENERATION\nLOSS",
  headlineWeight = 800,
  headlineFit = 0.62,
  headlineY = 0.5,
  speed = 1,
  paused = false,
  children,
  className = "",
  style,
}: PhotostatReverseProps) {
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

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    }) as WebGLRenderingContext | null;
    if (!gl) return; // no WebGL: children still render over the page background

    let prog: Program | null = null;
    let quad: WebGLBuffer | null = null;
    let mask: WebGLTexture | null = null;
    let maskReady = false;

    let raf = 0;
    let running = false;
    let staticMode = false;
    let disposed = false;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    let lastMs = performance.now();
    let simTime = 0;

    // Cheap single-pass shader (one texture sample, two smoothstep evals) —
    // full DPR holds comfortably, unlike the multi-tap accumulation passes in
    // weld-pool/flyback-tear that cap lower.
    const SCALES = [1, 0.8, 0.65];
    const BUDGET_OVER = 24;
    let scaleIdx = 0;
    let frameEma = 16.7;
    let overMs = 0;
    let underMs = 0;
    let upWindow = 8000;
    const DPR_CAP = 2;

    // ---- generation state machine -----------------------------------------
    let genLevel = 0; // 0..4
    let toneTo = STATIC_TONE;
    let toneFrom = STATIC_TONE;
    let threshFrom = 0.5;
    let edgeFrom = BASE_EDGE;
    let threshTo = 0.5;
    let edgeTo = BASE_EDGE;
    let nextFlipAt = GEN_PERIOD;
    let transitionStart = 0;

    const armGeneration = (level: number, tone: number) => {
      const p = genParams(level);
      threshFrom = threshTo;
      edgeFrom = edgeTo;
      toneFrom = toneTo;
      threshTo = p.thresh;
      edgeTo = p.edge;
      toneTo = tone;
    };

    const stepGenerations = (t: number) => {
      if (t < nextFlipAt) return;
      transitionStart = nextFlipAt;
      nextFlipAt = t + GEN_PERIOD;
      const wasAtTop = genLevel >= 4;
      const nextLevel = wasAtTop ? 0 : genLevel + 1;
      // every step flips tone EXCEPT the reset step (top generation back to
      // level 0), which lands crisp on whatever tone was already showing
      const nextTone = wasAtTop ? toneTo : toneTo === 0 ? 1 : 0;
      genLevel = nextLevel;
      armGeneration(nextLevel, nextTone);
    };
    // seed generation 1 (level 0) as both from/to so frame 0 already reads
    // as a settled state, not an interpolation from nothing
    armGeneration(0, STATIC_TONE);
    threshFrom = threshTo;
    edgeFrom = edgeTo;
    toneFrom = toneTo;

    // ---- pointer -----------------------------------------------------------
    let havePointer = false;
    let tgtX = 0;
    let tgtY = 0;
    let ptrX = 0;
    let ptrY = 0;
    let ptrActive = 0;
    let rectLeft = 0;
    let rectTop = 0;
    let rectDirty = true;

    const stepPointer = (dt: number) => {
      const k = 1 - Math.exp(-dt / 0.05);
      ptrX += (tgtX - ptrX) * k;
      ptrY += (tgtY - ptrY) * k;
      const targetActive = havePointer ? 1 : 0;
      ptrActive += (targetActive - ptrActive) * (1 - Math.exp(-dt / 0.12));
    };

    // ---- palette -----------------------------------------------------------
    let bg: RGB = [1, 1, 1];
    let fg: RGB = [0.09, 0.09, 0.09];

    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
      fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
      // The tone flip already IS the value inversion the monochrome rule asks
      // for, so both themes read from the same two tokens with no bias/contrast
      // remap — unlike a shaded material, a two-tone field has no "direction"
      // left to invert; --background/--foreground already carry it correctly
      // in both themes by construction.
      void luminance; // referenced for parity with sibling files' palette shape
    };
    readColors();

    // ---- headline mask: R = sharp alpha, G = blurred alpha -----------------
    const sharpCanvas = document.createElement("canvas");
    const softCanvas = document.createElement("canvas");

    const rasterizeText = () => {
      if (cssW < 2 || cssH < 2) return;
      const tw = Math.max(256, Math.min(1024, Math.round(cssW)));
      const th = Math.max(128, Math.round(tw * (cssH / cssW)));
      sharpCanvas.width = tw;
      sharpCanvas.height = th;
      softCanvas.width = tw;
      softCanvas.height = th;
      const sctx = sharpCanvas.getContext("2d", { willReadFrequently: true });
      const soctx = softCanvas.getContext("2d", { willReadFrequently: true });
      if (!sctx || !soctx) return;

      const family = getComputedStyle(wrap).fontFamily || "system-ui, sans-serif";
      const lines = headlineRef.current.split("\n").filter((l) => l.length > 0);
      sctx.clearRect(0, 0, tw, th);
      if (lines.length > 0) {
        const probe = 100;
        sctx.font = `${headlineWeight} ${probe}px ${family}`;
        let widest = 1;
        for (const line of lines) widest = Math.max(widest, sctx.measureText(line).width);
        const size = Math.min((tw * headlineFit * probe) / widest, (th * 0.42) / lines.length);
        sctx.font = `${headlineWeight} ${size}px ${family}`;
        sctx.textAlign = "center";
        sctx.textBaseline = "middle";
        sctx.fillStyle = "#fff";
        const lead = size * 1.06;
        const top = th * headlineY - ((lines.length - 1) * lead) / 2;
        for (let i = 0; i < lines.length; i++) sctx.fillText(lines[i], tw / 2, top + i * lead);
      }

      // soft channel: the same sharp raster, redrawn through a canvas 2D blur
      // filter — the cheap stand-in for a distance field's falloff, baked
      // once per text/size change rather than swept per-frame in the shader
      soctx.clearRect(0, 0, tw, th);
      const blurPx = Math.max(2, tw * 0.02);
      soctx.filter = `blur(${blurPx}px)`;
      soctx.drawImage(sharpCanvas, 0, 0);
      soctx.filter = "none";

      const sharpImg = sctx.getImageData(0, 0, tw, th).data;
      const softImg = soctx.getImageData(0, 0, tw, th).data;
      const rgba = new Uint8Array(tw * th * 4);
      for (let i = 0, j = 0; i < tw * th; i++, j += 4) {
        rgba[j] = sharpImg[j + 3];
        rgba[j + 1] = softImg[j + 3];
        rgba[j + 3] = 255;
      }
      if (!mask) {
        mask = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, mask);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      } else {
        gl.bindTexture(gl.TEXTURE_2D, mask);
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      maskReady = lines.length > 0;
    };

    // ---- draw ---------------------------------------------------------------
    const composite = () => {
      if (!prog || !mask) return;
      prog.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, mask);
      prog.i("u_mask", 0);
      prog.v2("u_size", cssW, cssH);
      prog.f("u_dpr", dpr);
      prog.f("u_time", simTime);

      let tf = threshFrom;
      let ef = edgeFrom;
      let tt = threshTo;
      let et = edgeTo;
      let tone0 = toneFrom;
      let tone1 = toneTo;
      let transition = staticMode
        ? 1
        : Math.min(1, Math.max(0, (simTime - transitionStart) / TRANSITION_DUR));
      transition = transition * transition * (3 - 2 * transition); // smoothstep ease

      if (staticMode) {
        const p = genParams(STATIC_LEVEL);
        tf = p.thresh;
        ef = p.edge;
        tt = p.thresh;
        et = p.edge;
        tone0 = STATIC_TONE;
        tone1 = STATIC_TONE;
      }

      prog.f("u_threshFrom", tf);
      prog.f("u_edgeFrom", ef);
      prog.f("u_toneFrom", tone0);
      prog.f("u_threshTo", tt);
      prog.f("u_edgeTo", et);
      prog.f("u_toneTo", tone1);
      prog.f("u_transition", transition);
      prog.v2("u_ptr", ptrX, canvas.height / dpr - ptrY);
      prog.f("u_ptrActive", staticMode ? ptrActive : ptrActive);
      prog.f("u_ptrRadius", Math.min(cssW, cssH) * 0.22);
      prog.v3("u_bg", bg);
      prog.v3("u_fg", fg);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const loop = (nowMs: number) => {
      const rawMs = nowMs - lastMs;
      const dt = Math.min(0.05, Math.max(0.0005, rawMs / 1000));
      lastMs = nowMs;
      simTime += dt * Math.max(0.05, speed);
      stepGenerations(simTime);
      stepPointer(dt);
      composite();

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
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * SCALES[scaleIdx];
      const pw = Math.max(2, Math.round(cssW * dpr));
      const ph = Math.max(2, Math.round(cssH * dpr));
      canvas.width = pw;
      canvas.height = ph;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      if (maskReady) composite();
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const changed = Math.abs(rect.width - cssW) > 0.5 || Math.abs(rect.height - cssH) > 0.5;
      cssW = rect.width;
      cssH = rect.height;
      rectLeft = rect.left;
      rectTop = rect.top;
      rectDirty = false;
      scaleIdx = 0;
      overMs = 0;
      underMs = 0;
      upWindow = 8000;
      frameEma = 16.7;
      if (changed) rasterizeText();
      applyBacking();
    };

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

    const setTarget = (e: PointerEvent) => {
      syncRect();
      tgtX = e.clientX - rectLeft;
      tgtY = e.clientY - rectTop;
    };
    const onPointerEnter = (e: PointerEvent) => {
      setTarget(e);
      ptrX = tgtX;
      ptrY = tgtY;
      havePointer = true;
      if (staticMode) composite();
    };
    const onPointerMove = (e: PointerEvent) => {
      setTarget(e);
      havePointer = true;
      if (staticMode) {
        ptrX = tgtX;
        ptrY = tgtY;
        ptrActive = 1;
        composite();
      }
    };
    const onPointerLeave = () => {
      havePointer = false;
      if (staticMode) {
        ptrActive = 0;
        composite();
      }
    };

    const buildProgram = (): boolean => {
      try {
        prog = new Program(gl, FRAG_SRC);
      } catch {
        return false;
      }
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      return true;
    };

    if (!buildProgram()) return;

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    // webfont metrics are not final at mount, and the mask is baked once from
    // measured text — without this a fallback-font raster freezes permanently
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (disposed) return;
        rasterizeText();
        if (staticMode) composite();
      });
    }

    wrap.addEventListener("pointerenter", onPointerEnter);
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
        if (maskReady) composite();
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
        if (staticMode) composite();
      }
      poll = window.setTimeout(tick, 140);
    };
    tick();

    const themeObserver = new MutationObserver(() => {
      readColors();
      if (staticMode) composite();
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
      prog = null;
      mask = null;
      quad = null;
      maskReady = false;
      if (!buildProgram()) return;
      cssW = 0;
      cssH = 0;
      resize();
      rasterizeText();
      applyMode();
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
      wrap.removeEventListener("pointerenter", onPointerEnter);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", markRectDirty, {
        capture: true,
      } as EventListenerOptions);
      window.removeEventListener("resize", markRectDirty);
      window.clearTimeout(poll);
      sleep();
      if (mask) gl.deleteTexture(mask);
      mask = null;
      if (quad) gl.deleteBuffer(quad);
      quad = null;
      prog?.destroy();
      prog = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headlineWeight, headlineFit, headlineY, speed]);

  return (
    <div
      ref={wrapRef}
      data-photostat-reverse={uid}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 block" />
      {/* the headline exists only as a mask driving the shader, so the
          accessible copy lives here — same string, nothing to keep in sync */}
      <h1 className="sr-only">{headline.split("\n").join(" ")}</h1>
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

PhotostatReverse.displayName = "PhotostatReverse";
