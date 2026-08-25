"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// SliceComb — a full-bleed hero background: a volume sliced by parallel
// cross-section planes perpendicular to the VIEW axis, drawn as dot rings.
//
// NOT A RESTYLE OF index-contour / hero-isobar-contours / pecked-ring. Every
// one of those draws contours of a HEIGHT FIELD in the plane — iso-lines of
// z(x, y) traced across a flat 2D surface. This component has no height
// field and nothing is drawn "in the plane": it slices a 3D solid (a
// tri-axial superellipsoid, |x/aX|^n + |y/aY|^n + |z/aZ|^n = 1) with planes
// at fixed screen-space depth Z, and each plane's cross-section is an
// orthographic projection of an actual 3D ring, not a traced isovalue. The
// payoff is different too: an isoline field encodes MAGNITUDE (this point is
// higher/lower). This encodes VIEWING GEOMETRY — where the surface normal
// runs near-parallel to the view axis, uniformly-spaced depth slices land
// almost on top of each other in screen space (their radius barely changes
// slice to slice), so they overplot into a bright rim; where the surface
// faces the camera head-on, the same uniform depth spacing produces a large
// jump in screen radius per slice, so the rings spread out and go sparse.
// That's a silhouette detector built entirely out of spacing, with no normal
// vector, no lighting term and no per-point shading anywhere in the code —
// brightness is only ever the accumulated overlap of same-alpha dots.
//
// SUBJECT. A tri-axial superellipsoid rather than mesh data, because the
// exponent `n` alone walks it from an organic egg/torso-ish bust proxy
// (n≈2.4, rounded on every axis) to a UI slab (n≈5, flat faces + rounded
// bezel) — one closed-form surface, two `form` presets, no separate code
// path. Swappable via the `form` prop.
//
// SLICE MATH. Planes are fixed in camera space at z0, and the solid rotates
// under them (continuous spin about the vertical axis) rather than the
// reverse, so "tangent to the camera" always means tangent to the CURRENT
// view, at every frame, not just at rest. Rotation by phi about Y leaves Y
// unchanged, so each slice's cross-section separates into closed form:
//   x' = X*cos(phi) - z0*sin(phi),  z' = X*sin(phi) + z0*cos(phi)
//   g(X) = |x'/aX|^n + |z'/aZ|^n
//   Y(X) = +/- aY * (1 - g(X))^(1/n),  valid where g(X) <= 1
// g is convex in X (a sum of |affine|^n terms, n > 1), so its minimum is
// found by ternary search and the two X roots of g(X)=1 either side of it by
// bisection — no per-point iterative solve, no mesh, exact for any n and any
// rotation. Samples across each slice's [Xlo, Xhi] use a cosine (Chebyshev)
// warp so density stays even along the curve instead of bunching where the
// curve is flat and starving where it's steep.
//
// COLOR. Two tokens only, split on each slice's own extent (Xhi - Xlo)
// against the widest slice this frame: the wide slices — the ones piled up
// near the true silhouette — draw in --foreground; the narrow slices near
// the poles draw in --ns-muted. No --ns-accent anywhere; this is a resting
// background, not interaction chrome. Every dot is the SAME flat alpha in
// its group — density is bought only by how many dots of that alpha land on
// the same pixels (plain source-over accumulation), never by an opacity or
// lighting ramp. Because dots are always --foreground on --background, the
// rim/interior contrast reads correctly in both themes without any
// branching: dark theme accumulates light dots into a bright rim over a
// darker, sparser middle; light theme accumulates dark dots into a dark rim
// over a lighter, sparser middle. Same code, both polarities, by
// construction of the token pair.
//
// ALIVE AT REST. The solid spins continuously about its vertical axis
// (one revolution every ROTATE_MS, ~17s) with no pointer input — the comb
// visibly migrates around the silhouette as it turns. prefers-reduced-motion
// freezes the spin at STATIC_PHI (not phi=0): a small but nonzero angle
// chosen so the frozen frame still shows an asymmetric silhouette (proof
// it's a 3D solid, not a flat ring) while keeping the rim clearly denser
// than the interior.
//
// CONTENT. Headline/eyebrow/subcopy/CTA sit centered over the canvas, right
// where the geometry naturally puts the sparsest slices at rest (near-pole
// cross-sections collapse toward screen center at low rotation angles) — the
// dark interior the mechanic already produces is exactly where type needs
// to sit. A translucent --background scrim behind the text is the only
// extra legibility aid, still token-only.
// ---------------------------------------------------------------------------

type Form = "bust" | "slab";

const FORM_PRESETS: Record<Form, { aX: number; aY: number; aZ: number; n: number }> = {
  // organic: rounded on every axis, taller than wide — a head-and-torso proxy.
  bust: { aX: 0.66, aY: 1.0, aZ: 0.6, n: 2.4 },
  // UI slab: flat front/back faces, thin depth, rounded bezel from the exponent.
  slab: { aX: 1.0, aY: 0.62, aZ: 0.155, n: 5 },
};

const ROTATE_MS = 17000; // one full revolution — slow enough to read as ambient, not distracting behind a headline
const STATIC_PHI = 0.5; // reduced-motion freeze angle (~28.6deg): asymmetric silhouette, rim still clearly denser than interior
const MARGIN = 0.42; // R = min(w,h) * MARGIN — real margin around the solid, derives scale from the smaller dimension (rule: must read at card size too)
const DPR_CAP = 2;
const DOT_ALPHA_RIM = 0.55;
const DOT_ALPHA_INTERIOR = 0.5;
const RIM_SPLIT = 0.55; // fraction of the widest slice's extent above which a slice counts as "rim" (--foreground) rather than "interior" (--ns-muted)

// SLICES/SAMPLES are derived from the container's smaller CSS dimension so a
// registry-card-size render still shows a legible handful of distinct
// slices instead of gray mush, and a full hero gets the richer comb.
function sliceCounts(minDim: number) {
  const slices = Math.min(48, Math.max(16, Math.round(minDim / 14)));
  const samples = Math.min(40, Math.max(12, Math.round(minDim / 13)));
  return { slices, samples };
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(v, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

// g(X) for a fixed slice depth z0 and rotation phi — convex in X.
function gAt(X: number, z0: number, cosPhi: number, sinPhi: number, aX: number, aZ: number, n: number) {
  const xp = X * cosPhi - z0 * sinPhi;
  const zp = X * sinPhi + z0 * cosPhi;
  return Math.pow(Math.abs(xp) / aX, n) + Math.pow(Math.abs(zp) / aZ, n);
}

// Ternary search for the X minimizing convex g(X, z0, phi).
function minimizeG(
  z0: number,
  cosPhi: number,
  sinPhi: number,
  aX: number,
  aZ: number,
  n: number,
  range: number
) {
  let lo = -range;
  let hi = range;
  for (let i = 0; i < 28; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const g1 = gAt(m1, z0, cosPhi, sinPhi, aX, aZ, n);
    const g2 = gAt(m2, z0, cosPhi, sinPhi, aX, aZ, n);
    if (g1 < g2) hi = m2;
    else lo = m1;
  }
  return (lo + hi) / 2;
}

// Bisect g(X) = 1 between a known-inside X (g <= 1) and a known-outside X (g >= 1).
function bisectRoot(
  xInside: number,
  xOutside: number,
  z0: number,
  cosPhi: number,
  sinPhi: number,
  aX: number,
  aZ: number,
  n: number
) {
  let a = xInside;
  let b = xOutside;
  for (let i = 0; i < 22; i++) {
    const mid = (a + b) / 2;
    const g = gAt(mid, z0, cosPhi, sinPhi, aX, aZ, n);
    if (g <= 1) a = mid;
    else b = mid;
  }
  return a;
}

interface SlicePoint {
  x: number;
  y: number;
}

// Solves one depth slice and returns its ring points plus its own extent
// (Xhi - Xlo), used purely to classify the slice rim/interior for color —
// never to modulate opacity or size.
function solveSlice(
  z0: number,
  phi: number,
  aX: number,
  aY: number,
  aZ: number,
  n: number,
  samples: number,
  out: SlicePoint[]
): number {
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const range = aX + aZ + Math.abs(z0) + 1;
  const xMin = minimizeG(z0, cosPhi, sinPhi, aX, aZ, n, range);
  const gMin = gAt(xMin, z0, cosPhi, sinPhi, aX, aZ, n);
  if (gMin > 1) return 0;
  const xHi = bisectRoot(xMin, range, z0, cosPhi, sinPhi, aX, aZ, n);
  const xLo = bisectRoot(xMin, -range, z0, cosPhi, sinPhi, aX, aZ, n);
  const span = xHi - xLo;
  if (span <= 0) return 0;
  for (let j = 0; j < samples; j++) {
    const t = samples === 1 ? 0.5 : j / (samples - 1);
    const u = (1 - Math.cos(Math.PI * t)) / 2; // Chebyshev warp: even coverage along the curve, not along X
    const X = xLo + u * span;
    const g = Math.min(1, Math.max(0, gAt(X, z0, cosPhi, sinPhi, aX, aZ, n)));
    const Y = aY * Math.pow(1 - g, 1 / n);
    out.push({ x: X, y: Y });
    if (Y > 0.001) out.push({ x: X, y: -Y });
  }
  return span;
}

export interface HeroSliceCombProps {
  /** which analytic solid to slice. @default "bust" */
  form?: Form;
  /** mono eyebrow label above the headline */
  eyebrow?: string;
  /** headline text; an array renders one line per entry */
  headline?: string | string[];
  /** supporting copy under the headline */
  subcopy?: string;
  /** optional CTA rendered under the copy */
  cta?: { label: string; href?: string; onClick?: () => void };
  /** freezes the spin without unmounting */
  paused?: boolean;
  /** ms for one full revolution. @default 17000 */
  rotateMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function HeroSliceComb({
  form = "bust",
  eyebrow,
  headline = "Turned, not traced",
  subcopy,
  cta,
  paused = false,
  rotateMs = ROTATE_MS,
  className = "",
  style,
}: HeroSliceCombProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const formRef = useRef(form);
  formRef.current = form;
  const rotateMsRef = useRef(rotateMs);
  rotateMsRef.current = rotateMs;

  const headlineLines = Array.isArray(headline) ? headline : [headline];

  // Token colors — start empty, assigned unconditionally in useLayoutEffect
  // before any frame paints, re-read on a documentElement class observer.
  const colorsRef = useRef({ fg: "", muted: "", bg: "" });

  useLayoutEffect(() => {
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      colorsRef.current = {
        fg: cs.getPropertyValue("--foreground"),
        muted: cs.getPropertyValue("--ns-muted"),
        bg: cs.getPropertyValue("--background"),
      };
    };
    readColors();
    const observer = new MutationObserver(readColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    let cssW = 0;
    let cssH = 0;
    let dpr = 1;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      cssW = Math.max(1, rect.width);
      cssH = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const points: SlicePoint[] = [];

    const draw = (phi: number) => {
      const { fg, muted, bg } = colorsRef.current;
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cssW, cssH);

      const preset = FORM_PRESETS[formRef.current];
      const R = Math.min(cssW, cssH) * MARGIN;
      const aX = R * preset.aX;
      const aY = R * preset.aY;
      const aZ = R * preset.aZ;
      const n = preset.n;
      const cx = cssW / 2;
      const cy = cssH / 2;

      const { slices, samples } = sliceCounts(Math.min(cssW, cssH));
      const zHalf = Math.hypot(aX * Math.sin(phi), aZ * Math.cos(phi));

      // Pass 1: solve every slice, track the widest extent this frame.
      const spans: number[] = new Array(slices);
      const ranges: [number, number][] = new Array(slices);
      let maxSpan = 0;
      for (let i = 0; i < slices; i++) {
        const t = (i + 0.5) / slices;
        const z0 = -zHalf + t * 2 * zHalf;
        const start = points.length;
        const span = solveSlice(z0, phi, aX, aY, aZ, n, samples, points);
        ranges[i] = [start, points.length];
        spans[i] = span;
        if (span > maxSpan) maxSpan = span;
      }

      const [fr, fgc, fb] = parseHex(fg);
      const [mr, mgc, mb] = parseHex(muted);
      const dotSize = Math.max(1, 1.1 * (dpr > 1 ? 1 : 1));

      for (let i = 0; i < slices; i++) {
        const isRim = maxSpan > 0 && spans[i] >= maxSpan * RIM_SPLIT;
        const [r, g, b] = isRim ? [fr, fgc, fb] : [mr, mgc, mb];
        const alpha = isRim ? DOT_ALPHA_RIM : DOT_ALPHA_INTERIOR;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        const [start, end] = ranges[i];
        for (let p = start; p < end; p++) {
          const pt = points[p];
          const sx = cx + pt.x;
          const sy = cy - pt.y;
          ctx.fillRect(sx - dotSize / 2, sy - dotSize / 2, dotSize, dotSize);
        }
      }
      points.length = 0;
    };

    let raf = 0;
    let elVisible = true;
    let pageVisible = document.visibilityState === "visible";
    let visible = elVisible && pageVisible;
    let startTime = 0;
    let staticMode = reduced || pausedRef.current;

    const renderStatic = () => draw(STATIC_PHI);

    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const phi = (((now - startTime) / rotateMsRef.current) % 1) * Math.PI * 2;
      draw(phi);
      raf = visible ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (!raf && visible && !staticMode) raf = requestAnimationFrame(tick);
    };
    const sleep = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const applyMode = () => {
      const wantStatic = reduced || pausedRef.current;
      if (wantStatic === staticMode) return;
      staticMode = wantStatic;
      if (staticMode) {
        sleep();
        renderStatic();
      } else {
        startTime = 0;
        wake();
      }
    };

    if (staticMode) renderStatic();
    else wake();

    const onMq = () => {
      reduced = mq.matches;
      applyMode();
    };
    mq.addEventListener("change", onMq);

    let lastPolledPaused = pausedRef.current;
    let pollId = 0;
    const poll = () => {
      if (pausedRef.current !== lastPolledPaused) {
        lastPolledPaused = pausedRef.current;
        applyMode();
      }
      pollId = window.setTimeout(poll, 150);
    };
    poll();

    let resizeRaf = 0;
    const ro = new ResizeObserver(() => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        resize();
        if (staticMode) renderStatic();
      });
    });
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        elVisible = entries[0]?.isIntersecting ?? true;
        visible = elVisible && pageVisible;
        if (!visible) sleep();
        else wake();
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      visible = elVisible && pageVisible;
      if (!visible) sleep();
      else wake();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      sleep();
      window.clearTimeout(pollId);
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className={`relative isolate flex min-h-[32rem] w-full items-center justify-center overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center rounded-md bg-background/60 px-8 py-10 text-center backdrop-blur-[2px]">
        {eyebrow ? <p className="mb-5 font-mono text-[11px] tracking-widest text-ns-muted">{eyebrow}</p> : null}
        <h1
          className="font-semibold text-foreground"
          style={{ fontSize: "clamp(2rem, 5.5vw, 3.75rem)", lineHeight: 1.08, letterSpacing: "-0.03em" }}
        >
          {headlineLines.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h1>
        {subcopy ? <p className="mt-5 max-w-md text-base leading-relaxed text-ns-muted">{subcopy}</p> : null}
        {cta ? (
          cta.href ? (
            <a
              href={cta.href}
              onClick={cta.onClick}
              className="mt-8 rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              {cta.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={cta.onClick}
              className="mt-8 rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity duration-200 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              {cta.label}
            </button>
          )
        ) : null}
      </div>
    </section>
  );
}
