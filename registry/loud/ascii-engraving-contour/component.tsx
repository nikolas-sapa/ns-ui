"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// BurinEtch — ASCII art rendered as a genuine engraving, not a brightness
// photograph in monospace. Most "image to text" renderers map luminance
// straight to glyph weight; this instead traces CONTOUR bands through a
// scalar field the way a burin cuts hatch lines across a curved plate —
// density comes from how close a cell sits to one of a stack of concentric
// iso-lines through the field, so the surface reads as ridged linework, not
// a gradient. The field is a small cluster of metaballs that slowly orbit a
// shared center, so the plate depicts a soft rounded subject with true
// engraved contour hatching over its body and a clean vignette where the
// field falls below the plate's edge threshold.
//
// A polish trail follows the pointer: cells it has recently crossed get
// finer, denser hatching that decays back to the ambient coarseness over
// roughly a second, like burnished metal dulling. Independently, on a fixed
// interval, a short burst of rows re-samples from a jittered column offset —
// a burin slip — and self-heals a couple hundred ms later. Direct-DOM rAF
// loop with no React state on the hot path, glyph ink pinned to the live
// --foreground token so both themes render correctly, single static frame
// (no polish, no slip) under prefers-reduced-motion.
// ---------------------------------------------------------------------------

const RAMP = " ·-+=*#%@"; // sparse -> dense; a hatch line is densest at its own center

interface Ball {
  baseX: number;
  baseY: number;
  orbitR: number;
  speed: number;
  phase: number;
  r: number;
}

function makeBalls(w: number, h: number): Ball[] {
  const cx = w / 2;
  const cy = h / 2;
  const unit = Math.min(w, h);
  return [
    { baseX: cx, baseY: cy, orbitR: unit * 0.06, speed: 0.18, phase: 0, r: unit * 0.22 },
    { baseX: cx - unit * 0.1, baseY: cy - unit * 0.05, orbitR: unit * 0.14, speed: 0.27, phase: 1.7, r: unit * 0.16 },
    { baseX: cx + unit * 0.12, baseY: cy + unit * 0.06, orbitR: unit * 0.12, speed: 0.22, phase: 3.4, r: unit * 0.15 },
    { baseX: cx + unit * 0.02, baseY: cy - unit * 0.14, orbitR: unit * 0.1, speed: 0.31, phase: 5.1, r: unit * 0.12 },
  ];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export interface BurinEtchProps {
  className?: string;
  /** grid cell size in px */
  cellSize?: number;
  /** hatch lines per field unit — higher reads finer */
  ringDensity?: number;
  /** fraction of each ring cycle that draws ink, the rest is the gap between hatch lines */
  ringWidth?: number;
  /** px radius of the pointer's polish influence */
  polishRadius?: number;
  /** extra hatch density under a fresh polish trail, 0-1 */
  polishStrength?: number;
  /** ms between burin-slip glitch bursts; 0 disables */
  glitchIntervalMs?: number;
}

export function BurinEtch({
  className = "",
  cellSize = 11,
  ringDensity = 0.09,
  ringWidth = 0.4,
  polishRadius = 130,
  polishStrength = 0.85,
  glitchIntervalMs = 2600,
}: BurinEtchProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let fg = getComputedStyle(canvas).color;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let balls: Ball[] = [];
    let polish = new Float32Array(0);
    let glitchBands = new Map<number, number>();
    let nextGlitchAt = 0;
    let glitchUntil = 0;
    let raf = 0;
    const pointer = { x: -1e4, y: -1e4, active: false };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${Math.round(cellSize * 0.92)}px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      cols = Math.ceil(width / cellSize);
      rows = Math.ceil(height / cellSize);
      polish = new Float32Array(cols * rows);
      balls = makeBalls(width, height);
    };

    const updateGlitch = (now: number) => {
      if (!glitchIntervalMs || now < nextGlitchAt) return;
      glitchBands = new Map();
      const bandCount = 1 + Math.floor(Math.random() * 2);
      for (let b = 0; b < bandCount; b++) {
        const row = Math.floor(Math.random() * rows);
        const offset = (Math.random() - 0.5) * cellSize * 6;
        glitchBands.set(row, offset);
      }
      glitchUntil = now + 90 + Math.random() * 110;
      nextGlitchAt = now + glitchIntervalMs * (0.7 + Math.random() * 0.6);
    };

    const draw = (now: number, live: boolean) => {
      if (width === 0 || height === 0) return;
      const t = live ? now * 0.001 : 0;
      const bx: number[] = [];
      const by: number[] = [];
      for (const ball of balls) {
        bx.push(ball.baseX + Math.cos(t * ball.speed + ball.phase) * ball.orbitR);
        by.push(ball.baseY + Math.sin(t * ball.speed * 1.3 + ball.phase) * ball.orbitR);
      }

      if (live) {
        updateGlitch(now);
        if (now > glitchUntil) glitchBands.clear();
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = fg;

      const rPolish2 = polishRadius * polishRadius;
      for (let row = 0; row < rows; row++) {
        const rowOffset = glitchBands.get(row) ?? 0;
        for (let col = 0; col < cols; col++) {
          const px = col * cellSize + cellSize / 2;
          const py = row * cellSize + cellSize / 2;
          const idx = row * cols + col;

          let pol = live ? polish[idx] * 0.965 : 0;
          if (live && pointer.active) {
            const dxp = px - pointer.x;
            const dyp = py - pointer.y;
            const d2p = dxp * dxp + dyp * dyp;
            if (d2p < rPolish2) {
              const boost = 1 - Math.sqrt(d2p) / polishRadius;
              if (boost > pol) pol = boost;
            }
          }
          if (live) polish[idx] = pol;

          let v = 0;
          for (let b = 0; b < balls.length; b++) {
            const dx = px - bx[b]!;
            const dy = py - by[b]!;
            const r = balls[b]!.r;
            v += (r * r) / (dx * dx + dy * dy + 1);
          }

          const edgeAlpha = smoothstep(0.16, 0.42, v);
          if (edgeAlpha <= 0.01) continue;

          const density = ringDensity * (1 + pol * polishStrength);
          const cycle = v * density;
          const phase = cycle - Math.floor(cycle);
          if (phase > ringWidth) continue;
          const ringT = 1 - phase / ringWidth;

          const charIdx = Math.min(RAMP.length - 1, Math.floor(ringT * (RAMP.length - 1)));
          const ch = RAMP[charIdx];
          if (!ch || ch === " ") continue;

          ctx.globalAlpha = edgeAlpha * (0.3 + 0.7 * ringT);
          ctx.fillText(ch, px + rowOffset, py);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      draw(now, true);
      raf = requestAnimationFrame(loop);
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    const onThemeChange = () => {
      fg = getComputedStyle(canvas).color;
      if (reduced) draw(0, false);
    };

    // ResizeObserver fires once asynchronously right after observe() even
    // with no actual size change — canvas.width/height assignment in resize()
    // clears the backing store and resets its transform, so the single
    // reduced-motion draw() must be re-run after every resize, not just once
    // up front, or that first async callback silently wipes the static frame.
    const handleResize = () => {
      resize();
      if (reduced) draw(0, false);
    };

    handleResize();
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    if (!reduced) {
      raf = requestAnimationFrame(loop);
      canvas.addEventListener("pointermove", onPointer);
      canvas.addEventListener("pointerleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [cellSize, ringDensity, ringWidth, polishRadius, polishStrength, glitchIntervalMs]);

  return (
    <div ref={containerRef} data-ascii-engraving-contour className={`relative h-full w-full overflow-hidden ${className}`}>
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full text-foreground" />
    </div>
  );
}
