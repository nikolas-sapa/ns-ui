"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// GlutenWindowpane — the baker's windowpane test as a background-task
// progress indicator: a dough membrane is stretched, held, and released on a
// repeating 4-cycle knead loop, going from opaque/jittery-stranded (cycle 1)
// to translucent/straight-stranded (cycle 4) as kneading "develops" the
// gluten. Strand geometry (count, angular jitter off the horizontal stretch
// axis) and membrane translucency are fixed per cycle — what animates within
// a cycle is the stretch itself: scaleX 1 -> 1.6 over 1800ms, a 600ms hold
// at full stretch, an 800ms snap-back, 3200ms per cycle. After cycle 4 the
// membrane rests fully developed for 1500ms before a fresh dough test
// begins (full loop 14.3s). Translucency is genuine canvas alpha: the
// membrane's own dough-tinted fill is painted at (1 - translucency) opacity
// over a transparent canvas, so the real page --background underneath shows
// through more as kneading progresses — no painted background layer. The
// radial "light passes through most" highlight is the same fill pushed
// toward whichever of --background/--foreground is the lighter of the two
// (computed by luminance, never hardcoded), so it reads as a bright glow in
// dark theme and, in light theme, as the surrounding membrane leaning
// slightly toward the darker token so the near-white highlight still has
// something to contrast against.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const probe = parseColor.ctx ?? (parseColor.ctx = document.createElement("canvas").getContext("2d"));
  if (!probe) return null;
  probe.fillStyle = "#000";
  try {
    probe.fillStyle = raw;
  } catch {
    return null;
  }
  const m = probe.fillStyle.match(/\d+/g);
  if (!m || m.length < 3) return null;
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}
parseColor.ctx = null as CanvasRenderingContext2D | null;

function luminance([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function rgbaStr(c: RGB, a: number): string {
  return `rgba(${c[0].toFixed(0)},${c[1].toFixed(0)},${c[2].toFixed(0)},${a.toFixed(3)})`;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

interface CycleParams {
  count: number;
  jitterDeg: number;
  alpha: number;
}

// real numbers: strand count 8 -> 14 -> 22 -> 34, jitter +-35deg -> +-4deg,
// membrane alpha (translucency, 0 = opaque) 0.05 -> 0.62
const CYCLES: CycleParams[] = [
  { count: 8, jitterDeg: 35, alpha: 0.05 },
  { count: 14, jitterDeg: 22, alpha: 0.18 },
  { count: 22, jitterDeg: 11, alpha: 0.35 },
  { count: 34, jitterDeg: 4, alpha: 0.62 },
];

const STRETCH_MS = 1800;
const HOLD_MS = 600;
const SNAP_MS = 800;
const CYCLE_MS = STRETCH_MS + HOLD_MS + SNAP_MS; // 3200
const POST_REST_MS = 1500;
const LOOP_MS = CYCLE_MS * CYCLES.length + POST_REST_MS; // 14300
const MAX_STRANDS = CYCLES[CYCLES.length - 1]!.count;
const MEMBRANE_TINT = 0.22; // how far the dough fill leans off the lighter token toward the darker one (by luminance, not a fixed --background/--foreground direction)

// Midpoint-subdivision activation order over the 34 strand slots: any
// prefix of this order is itself evenly spread across the full slot range,
// so raising strand count only ever ADDS a strand between two that already
// exist — a slot, once occupied, never moves or vacates. This is what lets
// a strand keep its own jitter/position identity as count climbs within a
// stretch (5 -> 34 across the whole loop) instead of every strand
// reshuffling on each integer step.
function buildSlotOrder(n: number): number[] {
  const order = [0, n - 1];
  const queue: [number, number][] = [[0, n - 1]];
  while (queue.length) {
    const [lo, hi] = queue.shift()!;
    if (hi - lo < 2) continue;
    const mid = (lo + hi) >> 1;
    order.push(mid);
    queue.push([lo, mid], [mid, hi]);
  }
  return order;
}
const SLOT_ORDER = buildSlotOrder(MAX_STRANDS);

interface FrameState {
  count: number;
  jitterDeg: number;
  alpha: number;
  scaleX: number;
  thin: number; // 0..1, how "thinned" (stretched) the membrane is right now
}

// a synthetic "cycle -1" baseline the first cycle's stretch departs from, so
// cycle 1 also shows a within-cycle develop, not just a pop to its target
const BASELINE: CycleParams = { count: 5, jitterDeg: 45, alpha: 0.02 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function frameState(tMs: number): FrameState {
  const loopT = ((tMs % LOOP_MS) + LOOP_MS) % LOOP_MS;
  if (loopT >= CYCLE_MS * CYCLES.length) {
    // post-cycle-4 rest: fully developed, relaxed, no active stretch
    const p = CYCLES[CYCLES.length - 1]!;
    return { count: p.count, jitterDeg: p.jitterDeg, alpha: p.alpha * 0.85, scaleX: 1, thin: 0 };
  }
  const cycleIdx = Math.min(CYCLES.length - 1, Math.floor(loopT / CYCLE_MS));
  const local = loopT - cycleIdx * CYCLE_MS;
  const from = cycleIdx === 0 ? BASELINE : CYCLES[cycleIdx - 1]!;
  const to = CYCLES[cycleIdx]!;
  let scaleX: number;
  let thin: number;
  // develop: the ONE thing a viewer follows — opaque/jittery -> translucent/
  // aligned across the 1800ms stretch, holding its arrival through hold+snap
  let develop: number;
  if (local < STRETCH_MS) {
    const f = easeInOut(local / STRETCH_MS);
    scaleX = 1 + 0.6 * f;
    thin = f;
    develop = f;
  } else if (local < STRETCH_MS + HOLD_MS) {
    scaleX = 1.6;
    thin = 1;
    develop = 1;
  } else {
    const f = easeInOut((local - STRETCH_MS - HOLD_MS) / SNAP_MS);
    scaleX = 1.6 - 0.6 * f;
    thin = 1 - f;
    develop = 1;
  }
  const count = lerp(from.count, to.count, develop);
  const jitterDeg = lerp(from.jitterDeg, to.jitterDeg, develop);
  const alpha = lerp(from.alpha, to.alpha, develop) * (0.85 + 0.15 * thin);
  return { count, jitterDeg, alpha, scaleX, thin };
}

// reduced-motion freeze: cycle 4's own 600ms hold, mid-point — max
// translucency, tightest strand alignment, full stretch, the most
// structured frame (never t0).
const REDUCED_FREEZE_MS = CYCLE_MS * (CYCLES.length - 1) + STRETCH_MS + HOLD_MS / 2;

export interface GlutenWindowpaneProps {
  /** accessible label for the status region */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function GlutenWindowpane({
  label = "Processing",
  className = "",
}: GlutenWindowpaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = mulberry32(0x9a10a9); // stable per-strand jitter/spread seed

    let disposed = false;
    let visible = true;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    // -- token read: no paint happens before this runs at least once. -----
    let lightColor: RGB = [255, 255, 255];
    let darkColor: RGB = [23, 23, 23];
    let isDarkTheme = false;
    const deriveColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const bg = parseColor(cs.getPropertyValue("--background").trim()) ?? lightColor;
      const fg = parseColor(cs.getPropertyValue("--foreground").trim()) ?? darkColor;
      isDarkTheme = luminance(bg) < luminance(fg);
      lightColor = isDarkTheme ? fg : bg;
      darkColor = isDarkTheme ? bg : fg;
    };

    // per-strand stable jitter angle sign/magnitude and perpendicular spread
    // slot, precomputed once so a given strand index keeps its identity as
    // count grows across cycles (34 slots, subsets used at lower counts)
    const strandJitterUnit = new Float32Array(MAX_STRANDS);
    for (let i = 0; i < MAX_STRANDS; i++) strandJitterUnit[i] = (rand() - 0.5) * 2;

    // pointer-driven stretch-center bias (springed, decays to container
    // center when idle) — luminance-only highlight, never accent-tinted
    let centerX = 0;
    let centerY = 0;
    let targetX = 0;
    let targetY = 0;

    const build = () => {
      const rect = container.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      centerX = w / 2;
      centerY = h / 2;
      targetX = centerX;
      targetY = centerY;
    };

    const draw = (state: FrameState) => {
      if (w < 2 || h < 2) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const minDim = Math.min(w, h);
      const baseLen = minDim * 0.8;
      const patchHalfW = (baseLen / 2) * state.scaleX;
      const patchHalfH = minDim * 0.34;

      // clip to the membrane patch ellipse — translucency and highlight only
      // ever apply within the dough itself, never the surrounding card
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, patchHalfW * 1.05, patchHalfH * 1.05, 0, 0, Math.PI * 2);
      ctx.clip();

      // dough base fill: a fixed tint off the lighter token toward the
      // darker one, painted at (1 - translucency) so more of the real page
      // --background shows through the transparent canvas as alpha climbs
      const doughColor = mix(lightColor, darkColor, MEMBRANE_TINT);
      ctx.fillStyle = rgbaStr(doughColor, Math.max(0, 1 - state.alpha));
      ctx.fillRect(centerX - patchHalfW * 1.1, centerY - patchHalfH * 1.1, patchHalfW * 2.2, patchHalfH * 2.2);

      // radial light-through highlight: pushes further toward the LIGHTER
      // token at the hotspot, fading back to the dough tint — brightness
      // only, never var(--ns-accent)
      const hotR = Math.max(patchHalfW, patchHalfH) * (0.35 + 0.25 * state.thin);
      const grad = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, hotR);
      const hotColor = mix(doughColor, lightColor, 0.9);
      grad.addColorStop(0, rgbaStr(hotColor, 0.16 + 0.5 * state.alpha));
      grad.addColorStop(1, rgbaStr(hotColor, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(centerX - patchHalfW * 1.1, centerY - patchHalfH * 1.1, patchHalfW * 2.2, patchHalfH * 2.2);

      // strands: thin --foreground lines, angle jitter around the
      // horizontal stretch axis, evenly spread across the patch height.
      // Strands activate in SLOT_ORDER (fixed, midpoint-subdivided) rather
      // than by live index into `count`, so a slot once drawn keeps its own
      // jitter/position for the rest of the loop — raising count only adds
      // strands between the ones already there, never reshuffles them. The
      // newest (fractional) strand fades in by alpha instead of popping.
      const drawCount = Math.min(MAX_STRANDS, Math.ceil(state.count));
      const jitterRad = (state.jitterDeg * Math.PI) / 180;
      // floor kept well above the "invisible at dpr-scaled subpixel" line
      const lineWidth = Math.max(0.85, 1.9 - drawCount * 0.03);
      // strands read as --foreground: the darker-reading token carries ink
      const strandColor = isDarkTheme ? lightColor : darkColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      for (let i = 0; i < drawCount; i++) {
        const slotIdx = SLOT_ORDER[i] ?? Math.floor(MAX_STRANDS / 2);
        const slot = slotIdx / (MAX_STRANDS - 1) - 0.5;
        const unit = strandJitterUnit[slotIdx] ?? 0;
        const angle = unit * jitterRad;
        const len = baseLen * state.scaleX * (0.92 + 0.08 * Math.abs(unit));
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const px = -dy; // perpendicular for spread offset
        const py = dx;
        const spread = slot * patchHalfH * 1.7;
        const ox = centerX + px * spread;
        const oy = centerY + py * spread;
        const fade = Math.max(0, Math.min(1, state.count - i));
        ctx.strokeStyle = rgbaStr(strandColor, 0.82 * fade);
        ctx.beginPath();
        ctx.moveTo(ox - (dx * len) / 2, oy - (dy * len) / 2);
        ctx.lineTo(ox + (dx * len) / 2, oy + (dy * len) / 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    let last = 0;
    const startPerf = performance.now();
    // phase-desync the mount so any two page loads show different states
    const mountOffsetMs = Date.now() % LOOP_MS;

    const loop = (now: number) => {
      if (disposed || !visible) {
        raf = 0;
        return;
      }
      const dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000);
      last = now;

      const springRate = 1 - Math.exp(-dt * 10);
      centerX += (targetX - centerX) * springRate;
      centerY += (targetY - centerY) * springRate;

      const elapsedMs = now - startPerf + mountOffsetMs;
      draw(frameState(elapsedMs));
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (!raf && !reduced) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const drawReduced = () => {
      draw(frameState(REDUCED_FREEZE_MS));
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      // shift toward the cursor, clamped to a modest fraction of the patch
      // so the stretch center never leaves the dough itself
      const maxShift = Math.min(w, h) * 0.18;
      targetX = w / 2 + Math.max(-maxShift, Math.min(maxShift, px - w / 2)) * 0.6;
      targetY = h / 2 + Math.max(-maxShift, Math.min(maxShift, py - h / 2)) * 0.6;
    };
    const onPointerLeave = () => {
      targetX = w / 2;
      targetY = h / 2;
    };

    deriveColors();
    build();
    if (reduced) {
      drawReduced();
    } else {
      startLoop();
    }

    const ro = new ResizeObserver(() => {
      build();
      if (reduced) drawReduced();
    });
    ro.observe(container);

    const mo = new MutationObserver(() => {
      deriveColors();
      if (reduced) drawReduced();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced) startLoop();
    });
    io.observe(container);

    if (!reduced) {
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerleave", onPointerLeave);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      role="status"
      className={`relative aspect-[4/3] w-full max-w-[320px] touch-none overflow-hidden rounded-md border border-border bg-background ${className}`}
    >
      <span className="sr-only">{label}</span>
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
    </div>
  );
}
