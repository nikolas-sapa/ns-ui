"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// FrostScrub — scroll is the defroster. A pinned full-bleed image sits behind
// a pane of rippled shower glass: heavily frosted at progress 0 with chromatic
// fringing on every ripple edge, annealing to optical clarity as a 300vh
// section scrubs. Fully reversible; a specular sweep crosses the pane as
// progress runs 0.92 → 1.0. Raw WebGL — one fullscreen quad, one fragment
// shader, zero deps. Direct-DOM rAF loop, no React state on the hot path,
// sleeps when |target − current| < 0.001 and wakes on scroll only.
// ---------------------------------------------------------------------------

const NOISE_SIZE = 256;
const LERP = 0.12; // rendered progress chases target at 0.12/frame
const SETTLE = 0.001;

// house sin-hash value noise on a periodic lattice, so the 256×256 normal-map
// texture tiles seamlessly under REPEAT wrap
function hashP(x: number, y: number, period: number) {
  const xi = ((x % period) + period) % period;
  const yi = ((y % period) + period) % period;
  const n = Math.sin(xi * 127.1 + yi * 311.7 + period * 0.917) * 43758.5453123;
  return n - Math.floor(n);
}
function vnoiseP(x: number, y: number, period: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hashP(xi, yi, period);
  const b = hashP(xi + 1, yi, period);
  const c = hashP(xi, yi + 1, period);
  const d = hashP(xi + 1, yi + 1, period);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// fx, fy in [0,1) across the tile; both octave frequencies divide the tile
function noise2(fx: number, fy: number) {
  return 0.65 * vnoiseP(fx * 8, fy * 8, 8) + 0.35 * vnoiseP(fx * 16, fy * 16, 16);
}

// 256×256 RGBA: normal.xy packed in RG (central differences, wrapped),
// ripple height in B — generated once on the CPU
function buildNoiseTexture() {
  const s = NOISE_SIZE;
  const height = new Float32Array(s * s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      height[y * s + x] = noise2(x / s, y / s);
    }
  }
  const data = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) {
    const up = ((y + s - 1) % s) * s;
    const dn = ((y + 1) % s) * s;
    const row = y * s;
    for (let x = 0; x < s; x++) {
      const l = height[row + ((x + s - 1) % s)] ?? 0;
      const r = height[row + ((x + 1) % s)] ?? 0;
      const t = height[up + x] ?? 0;
      const b = height[dn + x] ?? 0;
      const nx = Math.max(-1, Math.min(1, (l - r) * 6));
      const ny = Math.max(-1, Math.min(1, (t - b) * 6));
      const o = (row + x) * 4;
      data[o] = Math.round((nx * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round((height[row + x] ?? 0) * 255);
      data[o + 3] = 255;
    }
  }
  return data;
}

// monochrome studio still (sphere on a lit wall, film grain) — the default
// subject when no src is provided, so the bare component is self-contained
function buildDefaultArt(): HTMLCanvasElement | null {
  const w = 900;
  const h = 1200;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#181818");
  bg.addColorStop(1, "#090909");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w * 0.5, h * 0.34, 0, w * 0.5, h * 0.34, h * 0.55);
  glow.addColorStop(0, "rgba(255,255,255,0.12)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.45;
  const r = w * 0.3;

  ctx.save();
  ctx.translate(cx, cy + r * 1.32);
  ctx.scale(1, 0.22);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.15);
  shadow.addColorStop(0, "rgba(0,0,0,0.55)");
  shadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const sphere = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.08, cx, cy, r);
  sphere.addColorStop(0, "#f2f2f2");
  sphere.addColorStop(0.45, "#8f8f8f");
  sphere.addColorStop(0.8, "#2c2c2c");
  sphere.addColorStop(1, "#101010");
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const spec = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.48, 0, cx - r * 0.42, cy - r * 0.48, r * 0.22);
  spec.addColorStop(0, "rgba(255,255,255,0.95)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(cx - r * 0.42, cy - r * 0.48, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // film grain — Uint8ClampedArray clamps writes, no manual bounds needed
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = (Math.random() - 0.5) * 10;
    d[i] = (d[i] ?? 0) + g;
    d[i + 1] = (d[i + 1] ?? 0) + g;
    d[i + 2] = (d[i + 2] ?? 0) + g;
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

varying vec2 vUv;

uniform sampler2D uTex;     // image
uniform sampler2D uNoise;   // tiling ripple normal map (RG = normal, B = height)
uniform vec2 uRes;          // pane size, CSS px
uniform vec2 uImgRes;       // image size, px
uniform float uDpr;
uniform float uProgress;    // 0 = frosted, 1 = annealed
uniform float uMaxOffset;   // refraction amplitude at full frost, px
uniform float uFrostRadius; // poisson scatter radius at full frost, px
uniform float uDispersion;  // chromatic step between R/G/B offset scales
uniform float uEdgeFrost;   // 1 = reduced-motion frost vignette at pane edges

// object-fit: cover mapping
vec2 coverUv(vec2 uv) {
  float ra = uRes.x / uRes.y;
  float ia = uImgRes.x / uImgRes.y;
  vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}

// one refracted sample with chromatic dispersion: R/G/B at offset scales
// 1.0 / 1.0+d / 1.0+2d — fringing lives on every ripple edge
vec3 glassTap(vec2 base, vec2 off) {
  float r = texture2D(uTex, coverUv(base + off)).r;
  float g = texture2D(uTex, coverUv(base + off * (1.0 + uDispersion))).g;
  float b = texture2D(uTex, coverUv(base + off * (1.0 + 2.0 * uDispersion))).b;
  return vec3(r, g, b);
}

void main() {
  vec2 uv = vUv;
  vec2 cssPx = gl_FragCoord.xy / uDpr;
  vec3 n = texture2D(uNoise, cssPx / 256.0).rgb * 2.0 - 1.0;

  float frost = 1.0 - uProgress;
  // reduced motion: faint frost confined to the pane edges at p = 1
  vec2 fromCenter = abs(uv - 0.5);
  float edge = smoothstep(0.30, 0.5, max(fromCenter.x, fromCenter.y));
  frost = clamp(max(frost, uEdgeFrost * edge * 0.35), 0.0, 1.0);

  float amp = pow(frost, 1.6);
  vec2 off = n.xy * amp * uMaxOffset / uRes;
  vec2 scatter = vec2(frost * uFrostRadius) / uRes;

  // 5-tap poisson frost scatter around the refracted lookup
  vec3 col = glassTap(uv, off);
  col += glassTap(uv + vec2(-0.94, -0.39) * scatter, off);
  col += glassTap(uv + vec2( 0.97, -0.19) * scatter, off);
  col += glassTap(uv + vec2(-0.37,  0.86) * scatter, off);
  col += glassTap(uv + vec2( 0.45,  0.61) * scatter, off);
  col *= 0.2;

  // frost lifts the pane toward white; ripple height catches a little light
  col = mix(col, vec3(0.82), amp * 0.22);
  col += n.z * amp * 0.06;

  // specular sweep: white band crosses the pane once as p runs 0.92 -> 1.0
  float sw = clamp((uProgress - 0.92) / 0.08, 0.0, 1.0);
  float axis = (uv.x + (1.0 - uv.y) * 0.4) / 1.4;
  float band = smoothstep(0.08, 0.0, abs(axis - mix(-0.15, 1.15, sw)));
  col += vec3(band * 0.35);

  gl_FragColor = vec4(col, 1.0);
}
`;

function createProgram(gl: WebGLRenderingContext, vert: string, frag: string) {
  const compile = (type: number, source: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, source);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, vert);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function FrostScrub({
  src,
  alt = "Image annealing from frosted glass to optical clarity",
  caption = "SCROLL TO ANNEAL",
  maxOffset = 42,
  frostRadius = 10,
  dispersion = 0.012,
  className = "",
  onProgress,
}: {
  /** image url; omit for a generated monochrome studio still */
  src?: string;
  alt?: string;
  /** mono caption on the side rail */
  caption?: string;
  /** px of refraction offset at full frost */
  maxOffset?: number;
  /** px radius of the 5-tap frost scatter at full frost */
  frostRadius?: number;
  /** chromatic dispersion step between R/G/B offset scales */
  dispersion?: number;
  className?: string;
  /** rendered (lerped) progress 0–1, called from the rAF loop */
  onProgress?: (p: number) => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const section = sectionRef.current;
    const pane = paneRef.current;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const bar = barRef.current;
    const pct = pctRef.current;
    if (!section || !pane || !canvas || !img || !bar || !pct) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let raf = 0;
    let target = 0;
    let current = 0;

    const readout = (p: number) => {
      pct.textContent = `${String(Math.round(p * 100)).padStart(3, "0")}%`;
      bar.style.transform = `scaleY(${p.toFixed(4)})`;
      onProgressRef.current?.(p);
    };

    let art: HTMLCanvasElement | null = null;
    const getArt = () => (art ??= buildDefaultArt());

    // fallback when WebGL is unavailable: CSS blur on a plain <img>
    let usingFallback = false;
    const enterFallback = () => {
      usingFallback = true;
      canvas.classList.add("hidden");
      img.classList.remove("hidden");
      if (src) {
        img.src = src;
      } else {
        const a = getArt();
        if (a) img.src = a.toDataURL("image/png");
      }
    };

    let render: ((p: number) => void) | null = null;
    let resize: (() => void) | null = null;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });

    const setup = (): boolean => {
      if (!gl) return false;
      const program = createProgram(gl, VERT, FRAG);
      if (!program) return false;
      gl.useProgram(program);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );
      const aPos = gl.getAttribLocation(program, "aPos");
      if (aPos < 0) return false;
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const u = (name: string) => gl.getUniformLocation(program, name);
      const uRes = u("uRes");
      const uImgRes = u("uImgRes");
      const uDpr = u("uDpr");
      const uProgress = u("uProgress");
      gl.uniform1f(u("uMaxOffset"), maxOffset);
      gl.uniform1f(u("uFrostRadius"), frostRadius);
      gl.uniform1f(u("uDispersion"), dispersion);
      gl.uniform1f(u("uEdgeFrost"), reduced ? 1 : 0);
      gl.uniform1i(u("uTex"), 0);
      gl.uniform1i(u("uNoise"), 1);

      // ripple normal map on unit 1 — REPEAT so the 256 tile wraps seamlessly
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        NOISE_SIZE,
        NOISE_SIZE,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        buildNoiseTexture()
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      // image on unit 0 — NPOT-safe params, dark placeholder until pixels land
      gl.activeTexture(gl.TEXTURE0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([23, 23, 23, 255])
      );
      gl.uniform2f(uImgRes, 1, 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      const uploadSource = (source: TexImageSource, w: number, h: number) => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        gl.uniform2f(uImgRes, w, h);
      };

      if (src) {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          if (disposed) return;
          uploadSource(image, image.naturalWidth, image.naturalHeight);
          render?.(current);
        };
        image.onerror = () => {
          if (disposed) return;
          console.error(`FrostScrub: failed to load src "${src}", falling back to default art`);
          const a = getArt();
          if (a) uploadSource(a, a.width, a.height);
          render?.(current);
        };
        image.src = src;
      } else {
        const a = getArt();
        if (a) uploadSource(a, a.width, a.height);
      }

      resize = () => {
        const w = Math.max(1, pane.clientWidth);
        const h = Math.max(1, pane.clientHeight);
        // Homepage/catalog cards render this exact DOM inside a fixed
        // 1440×900 iframe that a *parent-document* CSS transform shrinks to a
        // ~380px-wide thumbnail — invisible to this document's own layout, so
        // `pane.clientWidth` still reads 1440 and a dpr-only buffer would
        // shade the full 5-tap fragment shader at full desktop resolution for
        // pixels nobody can resolve at thumbnail size. `[data-autoplay-root]`
        // (see autoplay-driver.tsx) is stamped only on that exact route
        // shape, so it doubles as the "I'm a card" signal here: cap the
        // buffer to what a thumbnail can actually show. The real
        // `/preview/<name>` reference page (what scripts/verify.ts shoots)
        // never gets this attribute, so its resolution — and look — is
        // unchanged.
        const isCard = !!pane.closest("[data-autoplay-root]");
        const dpr = isCard
          ? Math.min(0.6, window.devicePixelRatio || 1)
          : Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, w, h);
        gl.uniform1f(uDpr, dpr);
      };
      render = (p: number) => {
        gl.uniform1f(uProgress, p);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      resize();
      return true;
    };

    if (!setup()) enterFallback();

    const drawFrame = (p: number) => {
      if (usingFallback) {
        img.style.filter = p >= 0.999 ? "none" : `blur(${(12 * (1 - p)).toFixed(2)}px)`;
      } else {
        render?.(p);
      }
      readout(p);
    };

    // reduced motion: one static frame at p = 1 — clear image, the shader's
    // uEdgeFrost vignette keeps a faint frost border. No loop, no listener.
    if (reduced) {
      if (usingFallback) img.style.filter = "none";
      drawFrame(1);
      const ro = new ResizeObserver(() => {
        resize?.();
        drawFrame(1);
      });
      ro.observe(pane);
      return () => {
        disposed = true;
        ro.disconnect();
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      };
    }

    const progressFromScroll = () => {
      const rect = section.getBoundingClientRect();
      const span = rect.height - window.innerHeight;
      if (span <= 1) return 1;
      return Math.min(1, Math.max(0, -rect.top / span));
    };

    const loop = () => {
      current += (target - current) * LERP;
      if (Math.abs(target - current) < SETTLE) {
        current = target;
        drawFrame(current);
        raf = 0; // sleep — wakes on scroll only
        return;
      }
      drawFrame(current);
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const onScroll = () => {
      target = progressFromScroll();
      wake();
    };

    target = progressFromScroll();
    current = target;
    drawFrame(current);

    const ro = new ResizeObserver(() => {
      resize?.();
      target = progressFromScroll();
      drawFrame(current);
      wake();
    });
    ro.observe(pane);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("scroll", onScroll);
      ro.disconnect();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // onProgress intentionally excluded — delivered via onProgressRef so an
    // unmemoized inline callback can't tear down the GL setup every render.
  }, [src, maxOffset, frostRadius, dispersion]);

  return (
    <section
      ref={sectionRef}
      className={`relative h-[300vh] bg-background motion-reduce:h-screen ${className}`}
    >
      <div
        ref={paneRef}
        role="img"
        aria-label={alt}
        className="sticky top-0 h-screen w-full overflow-hidden bg-background"
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {/* fallback surface — revealed only when WebGL is unavailable */}
        <img
          ref={imgRef}
          alt=""
          aria-hidden
          className="absolute inset-0 hidden h-full w-full object-cover"
        />
        {/* side rail: caption, progress track, live percent — direct-DOM updates */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-4 z-10 flex flex-col items-center justify-center gap-4 font-mono md:right-8"
        >
          <span
            className="text-[10px] uppercase tracking-[0.3em] text-ns-muted"
            style={{ writingMode: "vertical-rl" }}
          >
            {caption}
          </span>
          <span className="relative h-24 w-px overflow-hidden bg-foreground/20">
            <span
              ref={barRef}
              className="absolute inset-0 origin-top bg-foreground"
              style={{ transform: "scaleY(0)" }}
            />
          </span>
          <span ref={pctRef} className="text-xs tabular-nums text-foreground">
            000%
          </span>
        </div>
      </div>
    </section>
  );
}
