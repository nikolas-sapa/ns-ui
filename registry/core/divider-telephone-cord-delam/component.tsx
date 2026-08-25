"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// DividerTelephoneCordDelam — a full-width section divider rendered as a
// thin-film DELAMINATION BUCKLE: a compressed film bonded to a substrate
// that has debonded and popped upward into a wandering ridge. Real thin-film
// mechanics (silicon-nitride-on-polymer, DLC coatings, dried paint) show the
// debonding front does not run straight — it telescopes side to side as it
// advances, producing the "telephone cord" morphology: a roughly
// constant-width ridge, a characteristic wander wavelength, and recurring
// branch points where the front forks.
//
// DISTINCT FROM THE BANDED-ACCRETION FAMILY (growth-ring, cambium-lay,
// lamina-dome): those deposit material in concentric layers over time — the
// pattern GROWS OUTWARD as new rings are laid down. This divider has no
// deposition step at all; the film is already there, fully formed, and what
// moves is a compressive FAILURE FRONT propagating and re-forking through
// existing material. Same "material process over time" register, opposite
// physics — accretion adds, buckling fails.
//
// DISTINCT FROM CRAZE-RULE: craze-rule's fracture is a one-shot arrival —
// an IntersectionObserver fires once, a dash-offset transition draws the
// crack in, and after a brief idle creep it is finished and static. This
// divider never finishes: the buckle front is a continuous function of
// time, always sweeping and re-forking, because a delaminating film keeps
// failing under sustained compressive stress rather than reaching a healed
// resting state.
//
// GEOMETRY. The ridge centerline is a domain-scrolling sum of two sine
// waves — wavelength set as a FRACTION of the measured container width
// (not a fixed pixel constant), so the wander reads at the same relative
// scale whether the strip is narrow or wide. A second, independent process
// spawns short-lived parallel BRANCH ridges on a fixed cadence (derived
// deterministically from the clock, not stored state) that diverge from the
// main ridge, run alongside it for a stretch, and fade — the recurring
// "re-branching" the brief calls for, not a single fork.
//
// SHADING — RAISED IN BOTH THEMES WITHOUT INVERTING. A raised ridge needs a
// highlight edge and a shadow edge that stay bright/dark respectively
// regardless of theme; naively offsetting one edge toward the raw
// --foreground token and the other toward raw --background would FLIP which
// edge is bright between themes (foreground is dark-on-light in light
// theme, light-on-dark in dark theme) — that inversion is a real bug this
// project shipped once already. Instead both tokens are parsed to RGB and
// compared by luminance at read time; the emboss always uses whichever of
// the two is brighter for the highlight offset-stroke and whichever is
// darker for the shadow offset-stroke, so the same geometric edge of the
// ridge reads as lit in both polarities. The flat, un-buckled film between
// ridges is a faint --ns-muted baseline — never --border, which is a
// separator token invisible as a fill/stroke in light theme.
// ---------------------------------------------------------------------------

export interface DividerTelephoneCordDelamProps {
  /** band height in px. Ridge width and wander wavelength derive from this and the measured width. Default 56. */
  height?: number;
  className?: string;
}

// wander wavelength as a fraction of measured width — keeps the ridge
// reading at the same relative scale narrow or wide, never "zoomed in"
const WIGGLES_PER_WIDTH = 5.2;
const HARMONIC_MULT = 2.35; // incommensurate multiplier -> telescoping wander, not a clean sinusoid
const SCROLL_SPEED_1 = 0.16; // rad/s
const SCROLL_SPEED_2 = 0.27;

const BRANCH_INTERVAL_MS = 2400; // cadence a new fork attempt spawns on
const BRANCH_DURATION_MS = 1900; // how long a fork stays visible before fading
const BRANCH_SPAN_FRAC = 0.16; // fraction of width a branch runs alongside the main ridge

// the frame prefers-reduced-motion freezes on: t=3.2s lands mid-life inside
// branch index 1 (spawns at 2.4s, 1.9s duration -> life progress ~0.42) with
// the main wander already well developed across the strip — a non-t0 frame
// with both the wandering ridge and a branch clearly formed, never a
// degenerate edge-of-cycle state
const STATIC_TIME_S = 3.2;

function hexToRgb(hex: string): [number, number, number] | null {
  const s = hex.trim().replace("#", "");
  if (s.length !== 6 && s.length !== 3) return null;
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const rgbStr = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${a})`;
const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** mulberry32 — deterministic given a seed, used only to key each branch's shape off its own index */
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mainCenterY(x: number, t: number, width: number, midY: number, ampA: number, ampB: number) {
  const k1 = (2 * Math.PI * WIGGLES_PER_WIDTH) / width;
  const y1 = ampA * Math.sin(k1 * x - SCROLL_SPEED_1 * t);
  const y2 = ampB * Math.sin(k1 * HARMONIC_MULT * x - SCROLL_SPEED_2 * t + 1.7);
  return midY + y1 + y2;
}

function activeBranch(t: number, width: number) {
  const idx = Math.floor((t * 1000) / BRANCH_INTERVAL_MS);
  const localMs = t * 1000 - idx * BRANCH_INTERVAL_MS;
  if (localMs > BRANCH_DURATION_MS) return null;
  const rng = mulberry32(idx + 1);
  const startFrac = 0.08 + rng() * 0.68;
  const startX = startFrac * width;
  const spanX = width * BRANCH_SPAN_FRAC * (0.8 + rng() * 0.4);
  const side = rng() < 0.5 ? -1 : 1;
  const life = localMs / BRANCH_DURATION_MS; // 0..1
  return { startX, spanX, side, life };
}

export function DividerTelephoneCordDelam({
  height = 56,
  className = "",
}: DividerTelephoneCordDelamProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // -- tokens: start empty, assigned unconditionally from getComputedStyle,
    // nothing paints before the first read below --
    let mutedRgb: [number, number, number] = [0, 0, 0];
    let brightRgb: [number, number, number] = [0, 0, 0];
    let darkRgb: [number, number, number] = [0, 0, 0];
    let tokensReady = false;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      const fg = hexToRgb(cs.getPropertyValue("--foreground")) ?? [0, 0, 0];
      const bg = hexToRgb(cs.getPropertyValue("--background")) ?? [0, 0, 0];
      const mu = hexToRgb(cs.getPropertyValue("--ns-muted")) ?? [0, 0, 0];
      mutedRgb = mu;
      // luminance-sorted, not positionally fixed -> the same geometric edge
      // of the ridge stays bright/dark in both themes (see header comment)
      if (luminance(fg) >= luminance(bg)) {
        brightRgb = fg;
        darkRgb = bg;
      } else {
        brightRgb = bg;
        darkRgb = fg;
      }
      tokensReady = true;
    };

    let width = 0;
    let midY = height / 2;
    let sized = false;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = rect.width;
      if (width < 2) {
        sized = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      midY = height / 2;
      sized = true;
    };

    const ridgeW = () => Math.max(6, Math.min(22, height * 0.28));

    const draw = (t: number) => {
      if (!sized || !tokensReady) return;
      ctx.clearRect(0, 0, width, height);

      const ampA = height * 0.22;
      const ampB = height * 0.1;
      const rw = ridgeW();

      // -- flat unbuckled film baseline: faint, always present, --ns-muted --
      ctx.strokeStyle = rgbStr(mutedRgb, 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      const drawBevelPath = (
        pathFn: (x: number) => number,
        x0: number,
        x1: number,
        w: number,
        alphaMul: number,
      ) => {
        const step = Math.max(2, width / 220);
        // shadow stroke: offset toward the falling edge, broad + dim
        ctx.strokeStyle = rgbStr(darkRgb, 0.5 * alphaMul);
        ctx.lineWidth = w * 1.05;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let x = x0; x <= x1; x += step) {
          const y = pathFn(x) + w * 0.4;
          if (x === x0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // highlight stroke: offset toward the rising edge, narrower + bright
        ctx.strokeStyle = rgbStr(brightRgb, 0.55 * alphaMul);
        ctx.lineWidth = w * 0.85;
        ctx.beginPath();
        for (let x = x0; x <= x1; x += step) {
          const y = pathFn(x) - w * 0.4;
          if (x === x0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // crest: thin, crisp, brightest — the true top of the buckle
        ctx.strokeStyle = rgbStr(brightRgb, 0.85 * alphaMul);
        ctx.lineWidth = w * 0.32;
        ctx.beginPath();
        for (let x = x0; x <= x1; x += step) {
          const y = pathFn(x);
          if (x === x0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      drawBevelPath((x) => mainCenterY(x, t, width, midY, ampA, ampB), 0, width, rw, 1);

      const branch = activeBranch(t, width);
      if (branch) {
        // fade in/out across the branch's life so it materializes and
        // dissolves rather than popping — the front "catching" then
        // healing, matching real delamination re-forking
        const fade = Math.sin(Math.min(1, branch.life) * Math.PI);
        const x0 = branch.startX;
        const x1 = Math.min(width, branch.startX + branch.spanX);
        drawBevelPath(
          (x) => {
            const p = (x - x0) / (branch.spanX || 1);
            const lateral = branch.side * rw * 1.8 * Math.sin(Math.min(1, p) * Math.PI);
            return mainCenterY(x, t, width, midY, ampA, ampB) + lateral;
          },
          x0,
          x1,
          rw * 0.72,
          fade,
        );
      }
    };

    // -- loop, paused offscreen and when the tab is hidden --
    let raf = 0;
    let visible = true;
    const startTime = performance.now();

    const loop = (now: number) => {
      const t = (now - startTime) / 1000;
      draw(t);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible = e.isIntersecting;
        if (visible && !document.hidden && !reduced) {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && visible && !reduced) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(STATIC_TIME_S);
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(STATIC_TIME_S);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    readTokens();
    resize();

    if (reduced) {
      draw(STATIC_TIME_S);
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [height]);

  return (
    <div
      ref={wrapRef}
      role="separator"
      aria-orientation="horizontal"
      className={`ns-dtcd w-full ${className}`}
      style={{ height }}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="block w-full" style={{ height }} />
    </div>
  );
}
