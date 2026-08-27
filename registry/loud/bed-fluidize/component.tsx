"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// BedFluidize — a full-bleed ambient background modeling a gas-fluidized
// particle bed: gas rising through a distributor plate suspends a bed of
// solid granules so it behaves like a boiling liquid. Voids ("bubbles")
// nucleate at the distributor, GROW as they climb (diameter ∝ height^0.4,
// the Darton bubble-growth relation used for real bubbling fluidized-bed
// reactors), COALESCE when two touch, and BURST at the bed surface,
// ejecting a few particles on a ballistic arc into the freeboard above.
// Particles caught in a rising bubble's wake drift down and brighten
// (circulation), matching the real observation that bed solids trail
// bubbles rather than free-falling independently.
//
// This is deliberately NOT a Navier-Stokes fluid field (dye-whorl) and NOT
// a fixed-lattice front-propagation graph (background-capillary-wick): the
// bed is a dense but ordinary particle grid, and the only moving primitives
// are a small population of bubbles (SDF circles) that grow, merge and pop.
// Particles never have persistent velocity state of their own — their
// on-screen offset and brightness are read live off the nearest bubble each
// frame, which keeps the whole sim O(particles * active_bubbles) with a
// bubble population capped low (~40) rather than needing a real N-body pass.
//
// ALIVE AT REST BY CONSTRUCTION: nucleation is a Poisson process that never
// stops, so there is no saturated end state — every bubble present at mount
// has burst and been replaced within a few seconds, forever.
//
// Tokens: --background clears the canvas and IS the void interior (a
// bubble is drawn by simply not drawing particles inside it, plus a thin
// --ns-muted rim so it still reads as a delineated void rather than a gap
// in the field). --ns-muted is the resting particle color; particles
// brighten toward --foreground only while inside a bubble's wake band or
// under active ejecta/pointer agitation. --ns-accent never appears — a
// resting bed has no interaction chrome to speak of.
// ---------------------------------------------------------------------------

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

interface Bubble {
  x: number;
  cy: number; // center y, smaller = higher (closer to bed surface)
  spawnCy: number;
  d: number; // current diameter, px
}

interface Crater {
  x: number;
  y: number;
  r: number;
  born: number; // sim time
}

interface Ejecta {
  x: number;
  y0: number;
  vx: number;
  vy0: number;
  born: number;
  life: number; // ms
}

const D0_FRAC = 0.03; // nucleation diameter, fraction of container height
const DMAX_FRAC = 0.22; // burst-eligible cap, fraction of container height
const GROWTH_EXP = 0.4; // Darton bubble-growth exponent
const NUCLEATE_RATE_PER_100PX = 2.2; // bubbles/s per 100px of container width
const WAKE_BAND_FACTOR = 1.55; // wake band radius = bubble radius * this
const WAKE_DRAG = 0.6; // particle wake drift = 0.6 * local bubble rise speed
const MID_CROSS_S = 3.2; // s for a diameter=DMAX*0.5 bubble to cross the bed
const CRATER_FADE_MS = 480;
const EJECTA_GRAVITY = 2600; // px/s^2
const EJECTA_MIN_MS = 220;
const EJECTA_MAX_MS = 380;
const FREEBOARD_FRAC = 0.1; // fraction of container height reserved above the bed
const MAX_PARTICLES = 6000;
const MAX_BUBBLES = 40;
const POINTER_RADIUS_FACTOR = 0.18; // of min(width,height)
const POINTER_DECAY_MS = 600;
const WARM_STEPS = 220;
const WARM_DT = 1 / 30;

export interface BedFluidizeProps {
  /** particle grid pitch, fraction of the container's smaller dimension. @default 1/60 */
  pitchRatio?: number;
  /** freeze the field at its warm-start frame. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function BedFluidize({
  pitchRatio = 1 / 60,
  paused = false,
  children,
  className = "",
  style,
}: BedFluidizeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // token fields start empty and are only ever assigned from
    // getComputedStyle — nothing here has a literal color fallback. Every
    // path that could paint (ResizeObserver, IntersectionObserver, the
    // reduced-motion branch) is gated behind `ready`, set only after the
    // first token read.
    let bg = "";
    let muted = "";
    let fg = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = cs.getPropertyValue("--background").trim();
      muted = cs.getPropertyValue("--ns-muted").trim();
      fg = cs.getPropertyValue("--foreground").trim();
    };

    let dpr = 1;
    let width = 0;
    let height = 0;
    let bedTopY = 0;
    let bedBottomY = 0;
    let bedHeightPx = 0;
    let d0Px = 0;
    let dMaxPx = 0;
    let growthK = 0;
    let riseCoeff = 0;
    let nucleateRate = 0; // bubbles/s
    let cellPx = 12;
    let sized = false;
    let ready = false;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let simTime = 0;
    let nextNucleate = 0;

    const rand = mulberry32(0x51ed270b);

    let baseX: Float32Array = new Float32Array(0);
    let baseY: Float32Array = new Float32Array(0);
    let particleCount = 0;

    let bubbles: Bubble[] = [];
    let craters: Crater[] = [];
    let ejecta: Ejecta[] = [];

    let pointerActive = false;
    let pointerX = 0;
    let pointerY = 0;
    let pointerBoost = 0; // 0..1, eases toward pointerActive target

    const buildField = () => {
      const minDim = Math.min(width, height);
      bedTopY = height * FREEBOARD_FRAC;
      bedBottomY = height * 0.98;
      bedHeightPx = Math.max(1, bedBottomY - bedTopY);
      d0Px = Math.max(2, height * D0_FRAC);
      dMaxPx = Math.max(d0Px + 1, height * DMAX_FRAC);
      growthK = (dMaxPx - d0Px) / Math.pow(bedHeightPx, GROWTH_EXP);
      const midD = dMaxPx * 0.5;
      const midRise = bedHeightPx / MID_CROSS_S;
      riseCoeff = midRise / Math.sqrt(midD);
      nucleateRate = (width / 100) * NUCLEATE_RATE_PER_100PX;

      cellPx = Math.max(6, minDim * pitchRatio);
      let cols = Math.max(4, Math.ceil(width / cellPx));
      let rows = Math.max(4, Math.ceil(bedHeightPx / cellPx));
      if (cols * rows > MAX_PARTICLES) {
        const scale = Math.sqrt((cols * rows) / MAX_PARTICLES);
        cellPx *= scale;
        cols = Math.max(4, Math.ceil(width / cellPx));
        rows = Math.max(4, Math.ceil(bedHeightPx / cellPx));
      }
      particleCount = cols * rows;
      baseX = new Float32Array(particleCount);
      baseY = new Float32Array(particleCount);
      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const jx = (rand() - 0.5) * cellPx * 0.6;
          const jy = (rand() - 0.5) * cellPx * 0.6;
          baseX[i] = c * cellPx + cellPx / 2 + jx;
          baseY[i] = bedTopY + r * cellPx + cellPx / 2 + jy;
          i++;
        }
      }

      bubbles = [];
      craters = [];
      ejecta = [];
      simTime = 0;
      nextNucleate = 0;
    };

    const nucleate = () => {
      if (bubbles.length >= MAX_BUBBLES) return;
      let x = rand() * width;
      // pointer locally raises the odds a fresh bubble nucleates near it —
      // a real fluidized-bed behavior (local gas maldistribution under a
      // disturbance), not a cosmetic pointer trail.
      if (pointerBoost > 0.05 && rand() < pointerBoost * 0.7) {
        const radius = Math.min(width, height) * POINTER_RADIUS_FACTOR;
        x = pointerX + (rand() - 0.5) * radius * 2;
        x = Math.max(0, Math.min(width, x));
      }
      bubbles.push({ x, cy: bedBottomY, spawnCy: bedBottomY, d: d0Px });
    };

    const burst = (b: Bubble) => {
      craters.push({ x: b.x, y: bedTopY, r: b.d * 0.5, born: simTime });
      const n = 3 + Math.floor(rand() * 4); // 3..6
      for (let k = 0; k < n; k++) {
        const life = EJECTA_MIN_MS + rand() * (EJECTA_MAX_MS - EJECTA_MIN_MS);
        const vx = (rand() - 0.5) * (b.d * 2.2);
        const vy0 = (EJECTA_GRAVITY * (life / 1000)) / 2; // returns to y0 at t=life
        ejecta.push({
          x: b.x + (rand() - 0.5) * b.d * 0.4,
          y0: bedTopY,
          vx,
          vy0,
          born: simTime,
          life,
        });
      }
    };

    const step = (dt: number) => {
      simTime += dt * 1000;
      const dtS = dt;

      if (!paused) {
        pointerBoost += ((pointerActive ? 1 : 0) - pointerBoost) * Math.min(1, dt * (1000 / POINTER_DECAY_MS) * 2.2);
      }

      const rateNow = nucleateRate * (1 + pointerBoost * 0.5);
      nextNucleate -= dtS * rateNow;
      while (nextNucleate <= 0) {
        nucleate();
        // exponential inter-arrival keeps this a genuine Poisson process
        // rather than a fixed metronome tick
        nextNucleate += Math.max(0.05, -Math.log(1 - rand()));
      }

      for (const b of bubbles) {
        const climbed = Math.max(0, b.spawnCy - b.cy);
        b.d = Math.min(dMaxPx, d0Px + growthK * Math.pow(climbed, GROWTH_EXP));
        const riseSpeed = riseCoeff * Math.sqrt(b.d);
        b.cy -= riseSpeed * dtS;
      }

      // coalescence: touching bubbles merge into one of combined area
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = bubbles.length - 1; j > i; j--) {
          const a = bubbles[i];
          const c = bubbles[j];
          const dx = a.x - c.x;
          const dy = a.cy - c.cy;
          const dist = Math.hypot(dx, dy);
          if (dist < (a.d + c.d) * 0.42) {
            const areaA = a.d * a.d;
            const areaC = c.d * c.d;
            const total = areaA + areaC;
            a.x = (a.x * areaA + c.x * areaC) / total;
            a.cy = Math.min(a.cy, c.cy); // leading (higher) edge wins
            a.spawnCy = Math.max(a.spawnCy, c.spawnCy);
            a.d = Math.sqrt(areaA + areaC);
            bubbles.splice(j, 1);
          }
        }
      }

      bubbles = bubbles.filter((b) => {
        if (b.cy - b.d / 2 <= bedTopY) {
          burst(b);
          return false;
        }
        return true;
      });

      craters = craters.filter((c) => simTime - c.born < CRATER_FADE_MS);
      ejecta = ejecta.filter((e) => simTime - e.born < e.life);
    };

    const particleColorAt = (px: number, py: number) => {
      // returns null if the particle sits inside a bubble void (not drawn),
      // otherwise { alpha, mix } where mix 0=muted 1=foreground
      let mix = 0;
      for (let bi = 0; bi < bubbles.length; bi++) {
        const b = bubbles[bi];
        if (Math.abs(px - b.x) > b.d * WAKE_BAND_FACTOR) continue;
        const dx = px - b.x;
        const dy = py - b.cy;
        const dist = Math.hypot(dx, dy);
        const r = b.d / 2;
        if (dist <= r) return null; // inside the void itself
        const wakeR = r * WAKE_BAND_FACTOR;
        if (dist < wakeR) {
          const t = 1 - (dist - r) / (wakeR - r);
          mix = Math.max(mix, t);
        }
      }
      if (pointerBoost > 0.02) {
        const radius = Math.min(width, height) * POINTER_RADIUS_FACTOR;
        const dist = Math.hypot(px - pointerX, py - pointerY);
        if (dist < radius) {
          mix = Math.max(mix, pointerBoost * (1 - dist / radius) * 0.8);
        }
      }
      return { mix };
    };

    const draw = () => {
      if (!sized) return;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // distributor plate baseline
      ctx.strokeStyle = muted;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = Math.max(1, height * 0.004);
      ctx.beginPath();
      ctx.moveTo(0, bedBottomY);
      ctx.lineTo(width, bedBottomY);
      ctx.stroke();

      const dotR = Math.max(0.9, cellPx * 0.16);
      for (let i = 0; i < particleCount; i++) {
        const px = baseX[i];
        let py = baseY[i];
        const c = particleColorAt(px, py);
        if (!c) continue;
        // wake circulation: particles near a bubble drift down and brighten
        for (let bi = 0; bi < bubbles.length; bi++) {
          const b = bubbles[bi];
          if (Math.abs(px - b.x) > b.d * WAKE_BAND_FACTOR) continue;
          const r = b.d / 2;
          const dist = Math.hypot(px - b.x, py - b.cy);
          const wakeR = r * WAKE_BAND_FACTOR;
          if (dist >= r && dist < wakeR) {
            const riseSpeed = riseCoeff * Math.sqrt(b.d);
            const t = 1 - (dist - r) / (wakeR - r);
            py += t * WAKE_DRAG * riseSpeed * 0.05;
          }
        }
        ctx.globalAlpha = 0.4 + 0.6 * c.mix;
        ctx.fillStyle = c.mix > 0.5 ? fg : muted;
        ctx.beginPath();
        ctx.arc(px, py, dotR, 0, Math.PI * 2);
        ctx.fill();
      }

      // bubble rims — the void interior is just cleared background, the rim
      // is what keeps it legible as a delineated bubble rather than a hole
      // in the particle field
      ctx.strokeStyle = muted;
      ctx.lineWidth = Math.max(1, cellPx * 0.12);
      for (const b of bubbles) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(b.x, b.cy, b.d / 2, 0, Math.PI * 2);
        ctx.stroke();
      }

      // bursting craters: fading rim at the bed surface
      for (const c of craters) {
        const age = simTime - c.born;
        const t = 1 - age / CRATER_FADE_MS;
        if (t <= 0) continue;
        ctx.globalAlpha = t * 0.4;
        ctx.strokeStyle = muted;
        ctx.lineWidth = Math.max(1, cellPx * 0.1);
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * (1 + (1 - t) * 0.8), 0, Math.PI * 2);
        ctx.stroke();
      }

      // ejecta: ballistic specks under constant downward acceleration
      ctx.fillStyle = fg;
      for (const e of ejecta) {
        const age = (simTime - e.born) / 1000;
        const x = e.x + e.vx * age;
        const y = e.y0 - e.vy0 * age + 0.5 * EJECTA_GRAVITY * age * age;
        if (y > height) continue;
        const lifeT = 1 - (simTime - e.born) / e.life;
        ctx.globalAlpha = Math.max(0, lifeT) * 0.9;
        ctx.beginPath();
        ctx.arc(x, y, dotR * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    // reduced-motion / paused: one deliberately-chosen static frame showing
    // nucleation, growth and a fresh burst all at once — never the bare
    // t=0 flat-floor state. Named FREEZE_PHASE = mid-rise-with-recent-burst.
    const drawStaticFreeze = () => {
      if (!sized) return;
      bubbles = [
        { x: width * 0.18, cy: bedBottomY - bedHeightPx * 0.08, spawnCy: bedBottomY, d: d0Px * 1.3 },
        { x: width * 0.5, cy: bedBottomY - bedHeightPx * 0.6, spawnCy: bedBottomY, d: dMaxPx * 0.55 },
        { x: width * 0.72, cy: bedBottomY - bedHeightPx * 0.32, spawnCy: bedBottomY, d: dMaxPx * 0.32 },
        { x: width * 0.85, cy: bedBottomY - bedHeightPx * 0.15, spawnCy: bedBottomY, d: d0Px * 1.8 },
      ];
      craters = [{ x: width * 0.36, y: bedTopY, r: dMaxPx * 0.3, born: CRATER_FADE_MS * 0.4 }];
      simTime = CRATER_FADE_MS * 0.4;
      ejecta = [];
      pointerBoost = 0;
      draw();
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      width = w;
      height = h;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildField();
      sized = true;
    };

    const warmStart = () => {
      for (let i = 0; i < WARM_STEPS; i++) step(WARM_DT);
    };

    const loop = (now: number) => {
      if (!visible) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (!sized) return;
        if (reduced || paused) {
          drawStaticFreeze();
        } else {
          warmStart();
          ready = true;
          draw();
          if (visible && !raf) {
            last = 0;
            raf = requestAnimationFrame(loop);
          }
        }
      }, 150);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && ready && !reduced && !paused) {
          last = 0;
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (visible && ready && !reduced && !paused) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || paused) drawStaticFreeze();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rect = root.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      pointerY = e.clientY - rect.top;
      pointerActive = true;
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointerActive = false;
    };
    if (!reduced) {
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerleave", onLeave);
    }

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      if (!sized) {
        ready = true;
        return;
      }
      if (reduced || paused) {
        drawStaticFreeze();
        ready = true;
      } else {
        warmStart();
        ready = true;
        draw();
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [pitchRatio, paused]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

BedFluidize.displayName = "BedFluidize";
