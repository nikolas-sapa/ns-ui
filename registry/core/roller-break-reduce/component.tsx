"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// RollerBreakReduce — an ambient multi-stage pipeline indicator built as a
// flour mill's break system: grain passes through a sequence of paired
// corrugated rollers (B1..B4), each pair spinning at a 2.5:1 differential
// (fast roll over slow roll) so the nip SHEARS the stock rather than
// crushing it. Every stage narrows the roll gap; every pass through a nip
// reduces particle size by ~35% and is drawn as a 150ms compression, never
// an instant swap. This is a continuous ambient stream (no query, no
// gravity/mesh threshold) — distinct from a sieve's pass/fail aperture gate.
//
// Rollers are plain DOM + CSS transform (fixed geometry, cheap to rotate);
// the particle stream is a single 2D canvas overlay. Stage count and roller
// diameter derive from the container's smaller dimension so the mechanism
// still reads at card scale. Colours used on the canvas are read once via
// getComputedStyle on the documentElement and re-read on a MutationObserver
// watching its class — no canvas paint happens before that first read. DOM
// roller/hairline colour comes straight from CSS var() tokens.
// ---------------------------------------------------------------------------

export interface RollerBreakReduceProps {
  /** Highlights one stage's corrugation via a luminance boost (never accent). */
  activeStage?: number;
  className?: string;
}

const FEED_RATE = 3; // particles / second entering at the left edge
const BASE_DIAM_MIN = 8; // px, coarse entry particle
const BASE_DIAM_MAX = 10;
const REDUCTION = 0.65; // ~35% size loss per break stage
const SEG_MS = 900; // inter-stage travel time
const NIP_MS = 150; // compression window at each nip crossing
const POP_CAP = 35; // steady-state on-screen ceiling (spec: 25-35)
const SLOW_REV_S = 0.6; // slow roll rev/s
const FAST_REV_S = 1.5; // fast roll rev/s (2.5:1 differential, matches the real ratio)
const RIDGE_COUNT = 60; // corrugation ridges per roller rim (fine pitch)

interface Particle {
  id: number;
  segIndex: number; // which travel segment [0 .. stageCount] the particle is in
  segStart: number; // ms timestamp the current segment began
  yOffset: number; // px scatter around the nip centreline while travelling
  baseDiameter: number; // px, at spawn (before any break stage)
}

interface Layout {
  w: number;
  h: number;
  stageCount: number;
  rollerDiameter: number;
  nipGaps: number[]; // px, one per stage — narrows stage to stage
  boundaryX: number[]; // [0, nip0, nip1, ..., width], length stageCount + 2
  centerY: number;
  jitterAmp: number;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp01(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function computeLayout(w: number, h: number): Layout {
  const minDim = Math.min(w, h);
  const stageCount = minDim < 280 ? 3 : 4;
  const rollerDiameter = minDim * 0.14;
  const marginX = w * 0.08;
  const usableW = Math.max(1, w - marginX * 2);
  const boundaryX: number[] = [0];
  for (let i = 0; i < stageCount; i++) {
    boundaryX.push(marginX + (usableW * (i + 0.5)) / stageCount);
  }
  boundaryX.push(w);
  const nipGaps: number[] = [];
  for (let i = 0; i < stageCount; i++) {
    // each break stage narrows the gap
    nipGaps.push(Math.max(rollerDiameter * 0.05, rollerDiameter * (0.22 - i * 0.045)));
  }
  return {
    w,
    h,
    stageCount,
    rollerDiameter,
    nipGaps,
    boundaryX,
    centerY: h / 2,
    jitterAmp: rollerDiameter * 0.55,
  };
}

export function RollerBreakReduce({ activeStage, className = "" }: RollerBreakReduceProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fastRefs = useRef<(HTMLDivElement | null)[]>([]);
  const slowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hairlineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeStageRef = useRef<number | undefined>(activeStage);
  activeStageRef.current = activeStage;

  // keep the luminance-boost highlight in sync even when the main rAF loop
  // isn't running (reduced motion's frozen frame, or an off-screen pause).
  useEffect(() => {
    for (let i = 0; i < stageRefs.current.length; i++) {
      const el = stageRefs.current[i];
      if (el) el.style.filter = activeStage === i ? "brightness(1.4)" : "";
    }
  }, [activeStage]);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let layout: Layout = computeLayout(1, 1);
    let dpr = 1;
    let particles: Particle[] = [];
    let idCounter = 0;
    let spawnAcc = 0;
    let fastAngle = 0;
    let slowAngle = 0;
    let raf = 0;
    let last = 0;
    let visible = true;
    let sized = false;

    // -- colour: read once via getComputedStyle, re-read only on a class
    // mutation (theme flip). No canvas paint happens before this first read.
    let fg = "";
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim() || fg;
    };
    readColors();

    const mo = new MutationObserver(readColors);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const applyRollerStyles = () => {
      const sc = layout.stageCount;
      for (let i = 0; i < stageRefs.current.length; i++) {
        const stageEl = stageRefs.current[i];
        const hairEl = hairlineRefs.current[i];
        if (i >= sc) {
          if (stageEl) stageEl.style.display = "none";
          if (hairEl) hairEl.style.display = "none";
          continue;
        }
        const fastEl = fastRefs.current[i];
        const slowEl = slowRefs.current[i];
        if (!stageEl || !fastEl || !slowEl) continue;
        stageEl.style.display = "";
        if (hairEl) hairEl.style.display = "";
        const x = layout.boundaryX[i + 1] ?? 0;
        const gap = layout.nipGaps[i] ?? 0;
        const r = layout.rollerDiameter;
        stageEl.style.left = `${x}px`;
        stageEl.style.top = `${layout.centerY}px`;
        stageEl.style.width = `${r}px`;
        stageEl.style.filter = activeStageRef.current === i ? "brightness(1.4)" : "";
        fastEl.style.width = `${r}px`;
        fastEl.style.height = `${r}px`;
        fastEl.style.transform = `translate(-50%, calc(-100% - ${gap / 2}px)) rotate(${fastAngle}deg)`;
        slowEl.style.width = `${r}px`;
        slowEl.style.height = `${r}px`;
        slowEl.style.transform = `translate(-50%, ${gap / 2}px) rotate(${slowAngle}deg)`;
        if (hairEl) {
          hairEl.style.left = `${x}px`;
        }
      }
    };

    const draw = (now: number) => {
      const { boundaryX, stageCount, centerY, w, h } = layout;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = fg;
      for (const p of particles) {
        const segFrac = clamp01((now - p.segStart) / SEG_MS);
        const ease = easeInOutCubic(segFrac);
        const x = lerp(boundaryX[p.segIndex] ?? 0, boundaryX[p.segIndex + 1] ?? w, ease);
        const passingNipAhead = p.segIndex < stageCount;
        let compressT = 0;
        if (passingNipAhead && segFrac >= 1 - NIP_MS / SEG_MS) {
          compressT = (segFrac - (1 - NIP_MS / SEG_MS)) / (NIP_MS / SEG_MS);
        }
        const squish = Math.sin(Math.PI * clamp01(compressT)) * 0.45;
        const diamPre = p.baseDiameter * Math.pow(REDUCTION, Math.min(p.segIndex, stageCount));
        const diamPost = p.baseDiameter * Math.pow(REDUCTION, Math.min(p.segIndex + 1, stageCount));
        const diameter = passingNipAhead ? lerp(diamPre, diamPost, compressT) : diamPre;
        const rx = Math.max(0.5, (diameter / 2) * (1 + squish * 0.6));
        const ry = Math.max(0.5, (diameter / 2) * (1 - squish));
        const yOffsetNow = passingNipAhead ? lerp(p.yOffset, 0, compressT) : p.yOffset;
        const y = centerY + yOffsetNow;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = (now: number, dt: number) => {
      const { stageCount, jitterAmp } = layout;
      const totalSegs = stageCount + 1;

      spawnAcc += dt;
      const spawnInterval = 1000 / FEED_RATE;
      while (spawnAcc >= spawnInterval && particles.length < POP_CAP * 2) {
        spawnAcc -= spawnInterval;
        particles.push({
          id: idCounter++,
          segIndex: 0,
          segStart: now,
          yOffset: (Math.random() * 2 - 1) * jitterAmp,
          baseDiameter: BASE_DIAM_MIN + Math.random() * (BASE_DIAM_MAX - BASE_DIAM_MIN),
        });
      }

      const next: Particle[] = [];
      for (const p of particles) {
        const segFrac = (now - p.segStart) / SEG_MS;
        if (segFrac >= 1) {
          const crossedNip = p.segIndex < stageCount;
          const overshoot = (segFrac - 1) * SEG_MS;
          const newSegIndex = p.segIndex + 1;
          if (newSegIndex >= totalSegs) continue; // exited the pipeline
          p.segIndex = newSegIndex;
          p.segStart = now - overshoot;
          if (crossedNip && next.length < POP_CAP) {
            // a kernel breaks into fragments: 1:2 split, capped at steady state
            next.push({
              ...p,
              id: idCounter++,
              yOffset: (Math.random() * 2 - 1) * jitterAmp,
            });
          }
        }
        next.push(p);
      }
      particles = next;

      fastAngle = (fastAngle + FAST_REV_S * 360 * (dt / 1000)) % 360;
      slowAngle = (slowAngle + SLOW_REV_S * 360 * (dt / 1000)) % 360;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || !sized) return;
      if (last === 0) last = now;
      const dt = Math.min(100, now - last);
      last = now;
      step(now, dt);
      applyRollerStyles();
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    // -- reduced motion: freeze on a deliberately chosen non-t0 frame — mid
    // nip at stage 2, with the full size-reduction gradient already visible
    // across the rest of the pipeline. No rAF loop is ever started. -------
    const renderReducedFrame = () => {
      const { stageCount, jitterAmp } = layout;
      fastAngle = 132;
      slowAngle = 47;
      const frameParticles: Particle[] = [];
      // one particle resting mid-segment for every travel segment...
      for (let seg = 0; seg <= stageCount; seg++) {
        frameParticles.push({
          id: seg,
          segIndex: seg,
          segStart: -SEG_MS * 0.45,
          yOffset: (seg % 2 === 0 ? 1 : -1) * jitterAmp * 0.4,
          baseDiameter: (BASE_DIAM_MIN + BASE_DIAM_MAX) / 2,
        });
      }
      // ...except stage index 1 ("stage 2"), caught mid-compression in its nip.
      if (stageCount >= 2) {
        frameParticles[1] = {
          id: 99,
          segIndex: 1,
          segStart: -(SEG_MS - NIP_MS / 2),
          yOffset: 0,
          baseDiameter: (BASE_DIAM_MIN + BASE_DIAM_MAX) / 2,
        };
      }
      particles = frameParticles;
      applyRollerStyles();
      draw(0);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      layout = computeLayout(rect.width, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;

      if (reduced) {
        renderReducedFrame();
        return;
      }
      last = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(root);
    resize();

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && sized && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(root);

    const onVis = () => {
      visible = document.visibilityState === "visible";
      if (visible && !reduced && sized && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // stage count is not known until measured; render a fixed max of 4 stage
  // shells (the effect only ever writes styles onto however many the
  // current layout uses, the rest stay display:none via the loop below —
  // but since stageCount is derived from the same measurement the effect
  // uses, we just always mount 4 and let unused ones sit off in width 0).
  const stageSlots = [0, 1, 2, 3];

  return (
    <div ref={rootRef} className={`relative overflow-hidden bg-background ${className}`}>
      {stageSlots.map((i) => (
        <div key={i} className="absolute h-px w-px border-l border-border" style={{ top: 0, bottom: 0, height: "100%" }} ref={(el) => { hairlineRefs.current[i] = el; }} />
      ))}
      {stageSlots.map((i) => (
        <div
          key={i}
          ref={(el) => {
            stageRefs.current[i] = el;
          }}
          className="absolute"
          aria-hidden="true"
        >
          <div
            ref={(el) => {
              fastRefs.current[i] = el;
            }}
            className="absolute left-0 top-0 rounded-full"
            style={{
              background: "var(--ns-muted)",
              backgroundImage: `repeating-conic-gradient(from 0deg, var(--foreground) 0deg ${
                360 / RIDGE_COUNT / 2
              }deg, transparent ${360 / RIDGE_COUNT / 2}deg ${360 / RIDGE_COUNT}deg)`,
              opacity: 0.92,
            }}
          />
          <div
            ref={(el) => {
              slowRefs.current[i] = el;
            }}
            className="absolute left-0 top-0 rounded-full"
            style={{
              background: "var(--ns-muted)",
              backgroundImage: `repeating-conic-gradient(from 0deg, var(--foreground) 0deg ${
                360 / RIDGE_COUNT / 2
              }deg, transparent ${360 / RIDGE_COUNT / 2}deg ${360 / RIDGE_COUNT}deg)`,
              opacity: 0.92,
            }}
          />
        </div>
      ))}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}
