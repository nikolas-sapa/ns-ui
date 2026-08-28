"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// TermiteVentilationShafts — a full-bleed ambient background modeling
// Macrotermes mound ventilation: thermosiphon convection through a FIXED
// network of surface ridge/shaft conduits (Turner 2001, "On the mound of
// Macrotermes michaelseni" — the exhalent/inhalent flow model). The conduit
// network — a chimney trunk at the container's center branching outward via
// a recursive angle-split — is generated exactly ONCE at mount and never
// re-grown or re-simulated. That is the load-bearing difference from the
// space-colonization pieces (auxin-canal, forage-vein, agar-starve): those
// regenerate or discover their network topology live; here the topology is
// architecture, fixed the moment the mound is built, and what's alive is
// only the flow direction and volume moving through it.
//
// MECHANIC: a single slow diurnal clock (42s period, a compressed day/night
// cycle) drives a temperature differential dT(t) = sin(2*PI*t/42). dT > 0 is
// exhale (warm air rising out through the network, flow runs trunk-to-tip);
// dT < 0 is inhale (flow reverses, tip-to-trunk). |dT| sets flow magnitude,
// so the network goes nearly still at the two crossover points each cycle
// (t=0, t=21) rather than snapping between directions. Each conduit segment
// eases its fill-fraction toward clamp(|dT| * segmentDepthFactor, 0, 1) on a
// 2.5s time constant, with segmentDepthFactor = 1 - 0.05*generation so flow
// visibly propagates outward from the trunk (or inward toward it) rather
// than updating everywhere at once. Direction is legible from a fill
// gradient alone only ambiguously, which is why a particle overlay carries
// it explicitly: any segment whose fill-fraction exceeds 0.15 gets 4-8 dots
// (scaled by segment length) advancing at 12px/s along the current flow
// direction, wrapping at the segment end. For the ~1.5s window around each
// crossover (|dT| < 0.08) particle motion pauses entirely — a real, briefly
// still moment twice per cycle — rather than crawling through zero.
//
// TOKENS: conduit outlines stroke in --border (the fixed structure, never a
// fill). Fill wash strokes the same path in --ns-muted at alpha scaled 0 to
// ~0.4 by fill-fraction. Flow particles are small --foreground dots at low
// alpha (raised in light theme, where the --ns-muted wash and --foreground
// sit closer together in contrast). --ns-accent never appears — direction
// is carried entirely by particle motion, magnitude entirely by fill-alpha,
// never by hue, so the piece stays legible with color removed entirely.
// ---------------------------------------------------------------------------

const CYCLE_S = 42; // diurnal period, s — the single governing clock
const FILL_TAU = 2.5; // s, fill-fraction ease time constant
const DEPTH_FACTOR_STEP = 0.05; // fill-target attenuation per generation (lag outward)
const PARTICLE_SPEED = 12; // px/s along a conduit
const STALL_THRESHOLD = 0.08; // |dT| below which particle motion fully stops
const FILL_GATE = 0.15; // fill-fraction above which particles render at all

const MAX_GEN = 6; // generations, trunk = 0
const TRUNK_COUNT = 7; // initial branches radiating from the chimney
const LENGTH_RATIO = 0.72; // per-generation length falloff
const SPREAD_MIN = (25 * Math.PI) / 180;
const SPREAD_MAX = (40 * Math.PI) / 180;
const CHILD_MIN = 2;
const CHILD_MAX = 3;
const EDGE_MARGIN = 0.46; // fraction of min(width,height)/1 — recursion stops past this radius
const TRUNK_LEN = 0.14; // fraction of min(width,height), generation-0 branch length

const REDUCED_FREEZE_T = 10.5; // in-cycle seconds -> dT=1, PEAK_EXHALE

// mulberry32 — deterministic per-mount PRNG so the fixed network is stable
// across re-renders within one mount (only the seed varies mount to mount).
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Segment {
  x0: number; // normalized coords, fraction of min(width,height), origin at container center
  y0: number;
  x1: number;
  y1: number;
  generation: number;
  length: number; // px, filled in on resize
  fill: number; // current eased fill-fraction, 0..1
  particles: Float32Array; // t in [0,1] along the segment, one entry per particle
}

function buildNetwork(rand: () => number): Segment[] {
  const segments: Segment[] = [];

  const grow = (x: number, y: number, angle: number, length: number, generation: number) => {
    const x1 = x + Math.cos(angle) * length;
    const y1 = y + Math.sin(angle) * length;
    segments.push({ x0: x, y0: y, x1, y1, generation, length: 0, fill: 0, particles: new Float32Array(0) });

    const r1 = Math.hypot(x1, y1);
    if (generation >= MAX_GEN - 1 || r1 >= EDGE_MARGIN) return;

    const childCount = rand() < 0.5 ? CHILD_MIN : CHILD_MAX;
    const spread = SPREAD_MIN + rand() * (SPREAD_MAX - SPREAD_MIN);
    const nextLength = length * LENGTH_RATIO;
    for (let i = 0; i < childCount; i++) {
      const t = i / (childCount - 1) - 0.5; // -0.5..0.5
      const jitter = (rand() - 0.5) * spread * 0.3;
      const childAngle = angle + t * spread * 2 + jitter;
      grow(x1, y1, childAngle, nextLength, generation + 1);
    }
  };

  for (let i = 0; i < TRUNK_COUNT; i++) {
    const angle = (i / TRUNK_COUNT) * Math.PI * 2 + rand() * 0.3;
    grow(0, 0, angle, TRUNK_LEN, 0);
  }

  return segments;
}

function particleCountFor(px: number): number {
  const n = Math.round(4 + (px / 90) * 4);
  return Math.max(4, Math.min(8, n));
}

function parseHex(raw: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return [128, 128, 128];
  let h = m[1];
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface TermiteVentilationShaftsProps {
  /** Skips mounting the canvas layer entirely; children render on the plain background. */
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function TermiteVentilationShafts({
  disabled = false,
  children,
  className = "",
  style,
}: TermiteVentilationShaftsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (disabled) return;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // mount mid-cycle at a random phase, not t=0, so the resting loop shows
    // motion already in progress from the first paint
    const rand = mulberry32((Math.random() * 0xffffffff) >>> 0);
    const segments = buildNetwork(rand);
    // mount phase, in-cycle seconds; reduced motion freezes on PEAK_EXHALE regardless
    const phaseOffset = reduced ? REDUCED_FREEZE_T : rand() * CYCLE_S;
    const startTime = performance.now() / 1000 - phaseOffset;

    let disposed = false;
    let ready = false;
    let raf = 0;
    let last = 0;

    let width = 0;
    let height = 0;
    let minDim = 0;

    let borderColor: [number, number, number] = [200, 200, 200];
    let mutedColor: [number, number, number] = [128, 128, 128];
    let fgColor: [number, number, number] = [23, 23, 23];
    let particleAlpha = 0.5;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      borderColor = parseHex(cs.getPropertyValue("--border") || "#e5e5e5");
      mutedColor = parseHex(cs.getPropertyValue("--ns-muted") || "#8f8f8f");
      fgColor = parseHex(cs.getPropertyValue("--foreground") || "#171717");
      // light theme's fill/foreground contrast compresses relative to dark,
      // so particles need a higher floor to stay distinct against the wash
      const isDark = document.documentElement.classList.contains("dark");
      particleAlpha = isDark ? 0.5 : 0.68;
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 2 || h < 2) return;
      width = w;
      height = h;
      minDim = Math.min(w, h);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (const seg of segments) {
        const px0 = width / 2 + seg.x0 * minDim;
        const py0 = height / 2 + seg.y0 * minDim;
        const px1 = width / 2 + seg.x1 * minDim;
        const py1 = height / 2 + seg.y1 * minDim;
        seg.length = Math.hypot(px1 - px0, py1 - py0);
        const count = particleCountFor(seg.length);
        if (seg.particles.length !== count) {
          const next = new Float32Array(count);
          for (let i = 0; i < count; i++) next[i] = i / count;
          seg.particles = next;
        }
      }
    };

    const dTAt = (tCycle: number) => Math.sin((2 * Math.PI * tCycle) / CYCLE_S);

    const step = (nowS: number, dt: number) => {
      const tCycle = ((nowS % CYCLE_S) + CYCLE_S) % CYCLE_S;
      const dT = dTAt(tCycle);
      const mag = Math.abs(dT);
      const direction = dT >= 0 ? 1 : -1; // +1 exhale/outward, -1 inhale/inward
      const stalled = mag < STALL_THRESHOLD;
      const easeAmount = FILL_TAU > 0 ? 1 - Math.exp(-dt / FILL_TAU) : 1;

      for (const seg of segments) {
        const depthFactor = 1 - DEPTH_FACTOR_STEP * seg.generation;
        const target = clamp01(mag * depthFactor);
        seg.fill += (target - seg.fill) * easeAmount;

        if (seg.fill <= FILL_GATE || stalled || seg.length <= 0) continue;
        const dtNorm = (PARTICLE_SPEED * dt) / seg.length;
        for (let i = 0; i < seg.particles.length; i++) {
          let t = seg.particles[i] + direction * dtNorm;
          if (t > 1) t -= 1;
          else if (t < 0) t += 1;
          seg.particles[i] = t;
        }
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      // pass 1: fixed outline, --border, thinner further out
      ctx.strokeStyle = `rgb(${borderColor[0]}, ${borderColor[1]}, ${borderColor[2]})`;
      for (const seg of segments) {
        const w = Math.max(0.6, minDim * 0.014 * Math.pow(LENGTH_RATIO, seg.generation));
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx + seg.x0 * minDim, cy + seg.y0 * minDim);
        ctx.lineTo(cx + seg.x1 * minDim, cy + seg.y1 * minDim);
        ctx.stroke();
      }

      // pass 2: flow fill wash, --ns-muted, alpha by fill-fraction (0..~0.4)
      for (const seg of segments) {
        if (seg.fill <= 0.01) continue;
        const w = Math.max(0.8, minDim * 0.022 * Math.pow(LENGTH_RATIO, seg.generation));
        const alpha = seg.fill * 0.4;
        ctx.strokeStyle = `rgba(${mutedColor[0]}, ${mutedColor[1]}, ${mutedColor[2]}, ${alpha})`;
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(cx + seg.x0 * minDim, cy + seg.y0 * minDim);
        ctx.lineTo(cx + seg.x1 * minDim, cy + seg.y1 * minDim);
        ctx.stroke();
      }

      // pass 3: flow particles, --foreground, low alpha
      ctx.fillStyle = `rgba(${fgColor[0]}, ${fgColor[1]}, ${fgColor[2]}, ${particleAlpha})`;
      const dotR = Math.max(0.9, minDim * 0.0032);
      for (const seg of segments) {
        if (seg.fill <= FILL_GATE) continue;
        for (let i = 0; i < seg.particles.length; i++) {
          const t = seg.particles[i];
          const px = cx + (seg.x0 + (seg.x1 - seg.x0) * t) * minDim;
          const py = cy + (seg.y0 + (seg.y1 - seg.y0) * t) * minDim;
          ctx.beginPath();
          ctx.arc(px, py, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const loop = (nowMs: number) => {
      if (!ready) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const nowS = nowMs / 1000;
      const dt = last ? Math.min(0.1, nowS - last) : 1 / 60;
      last = nowS;
      step(nowS - startTime, dt);
      render();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const renderFrozenFrame = () => {
      // one deterministic settle pass at the PEAK_EXHALE phase (fill targets
      // fully converged, no easing lag left) so the freeze doesn't land
      // mid-ease from whatever partial fill mount happened to start at
      for (let i = 0; i < 40; i++) step(REDUCED_FREEZE_T, FILL_TAU);
      render();
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced && ready) renderFrozenFrame();
      }, 150);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (ready) {
        if (reduced) renderFrozenFrame();
        else render();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let ro: ResizeObserver | undefined;
    let io: IntersectionObserver | undefined;
    let visible = true;

    readTokens();
    document.fonts.ready.then(() => {
      if (disposed) return;
      resize();
      ready = true;
      if (reduced) {
        renderFrozenFrame();
      } else {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
      ro = new ResizeObserver(onResize);
      ro.observe(root);
      if (!reduced) {
        io = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (!entry) return;
            visible = entry.isIntersecting;
            if (visible && !raf) {
              last = 0;
              raf = requestAnimationFrame(loop);
            } else if (!visible && raf) {
              cancelAnimationFrame(raf);
              raf = 0;
            }
          },
          { threshold: 0 },
        );
        io.observe(root);
      }
    });

    if (!reduced) document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      if (resizeTimer) clearTimeout(resizeTimer);
      ro?.disconnect();
      io?.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [disabled]);

  return (
    <div
      ref={rootRef}
      className={`relative flex h-full w-full flex-col overflow-hidden bg-background ${className}`}
      style={style}
    >
      {!disabled ? (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 block h-full w-full"
        />
      ) : null}
      {children ? <div className="relative z-10 flex h-full w-full flex-col">{children}</div> : null}
    </div>
  );
}
