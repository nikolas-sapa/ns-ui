"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// TorusRender — the donut.c homage, done with real depth buffering. A torus
// (tube radius R1, center radius R2) is swept by two parametric angles
// (theta around the tube, phi around the ring), rotated by two Euler angles
// A/B, projected to PIXEL space (not grid space) around the render area's
// center, and only THEN quantized to a monospace cell via col/row division —
// projecting before quantizing is what keeps the torus circular instead of
// an ellipse, since character cells are ~2:1 tall/narrow but device pixels
// are square. Each sample's 1/z (bigger = nearer) competes for its screen
// cell in a Float32Array depth buffer reset every frame; a Lambertian dot
// product between the surface normal and a fixed light direction indexes a
// 12-step density ramp, stored in a parallel Uint8Array. Drag (mouse or
// touch) rotates A/B directly and tracks a smoothed angular velocity that
// becomes release inertia, decaying back to a slow idle spin — never to a
// dead stop — via one exponential relaxation toward the idle omega. A
// box-drawing frame with a live rotation readout is drawn straight into the
// same canvas grid (never DOM text), so no trig result ever reaches SSR'd
// HTML and the hydration trap in wiki/svg_ssr_trig_hydration_mismatch.md
// never applies here in the first place.
// ---------------------------------------------------------------------------

const R1 = 1; // tube radius, world units
const R2 = 2.15; // center radius, world units
const K2 = 5; // viewer distance, world units
const RAMP = ".,-~:;=!*#$@"; // 12-step Lambertian density ramp

const IDLE_OMEGA_A = 0.16; // rad/s idle pitch spin
const IDLE_OMEGA_B = 0.42; // rad/s idle yaw spin
const FRICTION = 1.6; // s^-1 — relaxation rate back toward idle omega
const MAX_OMEGA = 14; // rad/s — release velocity ceiling
const DRAG_GAIN = 0.012; // rad per px of drag
const VEL_SMOOTH = 0.35; // EMA factor for tracked release velocity
const DT_MAX = 0.05;

// light direction, fixed in world space (not attached to the rotating torus)
const LIGHT = normalize3(-0.4, -0.55, -1);
function normalize3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

export interface TorusRenderProps {
  /** grid cell size in px */
  cellSize?: number;
  className?: string;
}

export function TorusRender({
  cellSize = 13,
  className = "",
}: TorusRenderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let fgCss = "currentColor";
    let mutedCss = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    // render-area bounds inside the box-drawing frame (see header comment)
    let rMinRow = 0;
    let rMaxRow = 0; // exclusive
    let rMinCol = 0;
    let rMaxCol = 0; // exclusive
    let renderCx = 0; // px, center of the render area
    let renderCy = 0;
    let K1 = 0; // projection scale, px

    let depthBuf = new Float32Array(0);
    let charBuf = new Uint8Array(0);

    let thetaSteps = 96;
    let phiSteps = 260;

    const readTokens = () => {
      fgCss = getComputedStyle(canvas).color;
      mutedCss =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--muted")
          .trim() || fgCss;
    };

    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize;
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 2 || height < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      cols = Math.max(4, Math.floor(width / cellW));
      rows = Math.max(6, Math.floor(height / cellH));

      rMinRow = 2;
      rMaxRow = rows - 1;
      rMinCol = 1;
      rMaxCol = cols - 1;

      const renderW = (rMaxCol - rMinCol) * cellW;
      const renderH = (rMaxRow - rMinRow) * cellH;
      renderCx = rMinCol * cellW + renderW / 2;
      renderCy = rMinRow * cellH + renderH / 2;
      const minRenderPx = Math.min(renderW, renderH);
      K1 = minRenderPx * 0.28;

      // sample density scales with the render area so the surface stays
      // solid (no gaps between samples) at both small cards and large
      // windows, capped so a very large viewport can't blow up the per-frame
      // trig cost
      thetaSteps = Math.min(150, Math.max(80, Math.round(minRenderPx / 6)));
      phiSteps = Math.min(420, Math.max(220, Math.round(minRenderPx / 2)));

      depthBuf = new Float32Array(cols * rows);
      charBuf = new Uint8Array(cols * rows);
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(angleA, angleB);
      }, 150);
    };

    const drawFrame = (angleADeg: number, angleBDeg: number) => {
      ctx.fillStyle = mutedCss;
      ctx.globalAlpha = 0.85;
      const cx = (c: number) => c * cellW + cellW / 2;
      const cy = (r: number) => r * cellH + cellH / 2;
      // top / bottom borders with corners
      ctx.fillText("┌", cx(0), cy(0));
      ctx.fillText("┐", cx(cols - 1), cy(0));
      ctx.fillText("└", cx(0), cy(rows - 1));
      ctx.fillText("┘", cx(cols - 1), cy(rows - 1));
      for (let c = 1; c < cols - 1; c++) {
        ctx.fillText("─", cx(c), cy(0));
        ctx.fillText("─", cx(c), cy(rows - 1));
      }
      // side borders, every row except the two border rows
      for (let r = 1; r < rows - 1; r++) {
        ctx.fillText("│", cx(0), cy(r));
        ctx.fillText("│", cx(cols - 1), cy(r));
      }
      // readout row (row 1): rotation angles, printed as glyphs — never DOM
      // text, so no trig result ever reaches server-rendered HTML
      const label = `a ${angleADeg.toFixed(1)}°  b ${angleBDeg.toFixed(1)}°`;
      const interiorW = cols - 2;
      const start = Math.max(1, 1 + Math.floor((interiorW - label.length) / 2));
      for (let i = 0; i < label.length && start + i < cols - 1; i++) {
        const ch = label[i];
        if (ch === " ") continue;
        ctx.fillText(ch, cx(start + i), cy(1));
      }
      ctx.globalAlpha = 1;
    };

    const draw = (angleA: number, angleB: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);

      depthBuf.fill(0);
      charBuf.fill(0);

      const cosA = Math.cos(angleA);
      const sinA = Math.sin(angleA);
      const cosB = Math.cos(angleB);
      const sinB = Math.sin(angleB);
      const [lx, ly, lz] = LIGHT;

      const thetaStep = (Math.PI * 2) / thetaSteps;
      const phiStep = (Math.PI * 2) / phiSteps;

      for (let ti = 0; ti < thetaSteps; ti++) {
        const theta = ti * thetaStep;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const circleX = R2 + R1 * cosT;
        const circleY = R1 * sinT;

        for (let pi = 0; pi < phiSteps; pi++) {
          const phi = pi * phiStep;
          const cosP = Math.cos(phi);
          const sinP = Math.sin(phi);

          const x =
            circleX * (cosB * cosP + sinA * sinB * sinP) -
            circleY * cosA * sinB;
          const y =
            circleX * (sinB * cosP - sinA * cosB * sinP) +
            circleY * cosA * cosB;
          const z = K2 + cosA * circleX * sinP + circleY * sinA;
          const ooz = 1 / z;

          // surface normal at (theta, phi) before A/B rotation, then rotated
          // the same way as the point — this is the Lambertian term
          const nx0 = cosT * cosP;
          const ny0 = cosT * sinP;
          const nz0 = sinT;
          const nx = cosB * nx0 + sinA * sinB * ny0 - cosA * sinB * nz0;
          const ny = sinB * nx0 - sinA * cosB * ny0 + cosA * cosB * nz0;
          const nz = cosA * ny0 + sinA * nz0;
          const L = nx * lx + ny * ly + nz * lz;
          if (L <= 0) continue;

          // project in isotropic PIXEL space (both axes scaled by the same
          // K1) and quantize to the non-square cell grid only afterward via
          // cellW/cellH — the aspect correction happens by construction and
          // there is exactly one code path, so it can't be missed
          const px = renderCx + K1 * ooz * x;
          const py = renderCy - K1 * ooz * y;
          const col = Math.round(px / cellW);
          const row = Math.round(py / cellH);
          if (col < rMinCol || col >= rMaxCol || row < rMinRow || row >= rMaxRow)
            continue;

          const idx = row * cols + col;
          if (ooz > depthBuf[idx]) {
            depthBuf[idx] = ooz;
            const li = Math.min(RAMP.length - 1, Math.max(0, Math.round(L * 8)));
            charBuf[idx] = li + 1;
          }
        }
      }

      ctx.fillStyle = fgCss;
      for (let row = rMinRow; row < rMaxRow; row++) {
        for (let col = rMinCol; col < rMaxCol; col++) {
          const idx = row * cols + col;
          const ci = charBuf[idx];
          if (ci === 0) continue;
          const li = ci - 1;
          ctx.globalAlpha = 0.35 + (li / (RAMP.length - 1)) * 0.65;
          ctx.fillText(
            RAMP[li],
            col * cellW + cellW / 2,
            row * cellH + cellH / 2
          );
        }
      }
      ctx.globalAlpha = 1;

      const deg = (r: number) => (((r * 180) / Math.PI) % 360 + 360) % 360;
      drawFrame(deg(angleA), deg(angleB));
    };

    // -- hot-path rotation state: plain locals, never React state -----------
    let angleA = 0.6;
    let angleB = 0.9;
    let omegaA = IDLE_OMEGA_A;
    let omegaB = IDLE_OMEGA_B;
    let raf = 0;
    let last = 0;
    let dragging = false;
    let pointerId = -1;
    let startX = 0;
    let startY = 0;
    let baseA = 0;
    let baseB = 0;
    let lastMoveT = 0;
    let velA = 0;
    let velB = 0;

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      if (!dragging) {
        angleA += omegaA * dt;
        angleB += omegaB * dt;
        const decay = Math.exp(-FRICTION * dt);
        omegaA = IDLE_OMEGA_A + (omegaA - IDLE_OMEGA_A) * decay;
        omegaB = IDLE_OMEGA_B + (omegaB - IDLE_OMEGA_B) * decay;
      }
      draw(angleA, angleB);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      baseA = angleA;
      baseB = angleB;
      lastMoveT = performance.now();
      velA = 0;
      velB = 0;
      canvas.style.cursor = "grabbing";
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointer, ignore */
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const nextB = baseB + dx * DRAG_GAIN;
      const nextA = baseA + dy * DRAG_GAIN;
      const now = performance.now();
      const dt = Math.max(0.008, (now - lastMoveT) / 1000);
      const instVelA = (nextA - angleA) / dt;
      const instVelB = (nextB - angleB) / dt;
      velA = velA * (1 - VEL_SMOOTH) + instVelA * VEL_SMOOTH;
      velB = velB * (1 - VEL_SMOOTH) + instVelB * VEL_SMOOTH;
      angleA = nextA;
      angleB = nextB;
      lastMoveT = now;
      if (reduced) draw(angleA, angleB);
    };
    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = -1;
      canvas.style.cursor = "grab";
      const clamp = (v: number) => Math.max(-MAX_OMEGA, Math.min(MAX_OMEGA, v));
      omegaA = clamp(velA);
      omegaB = clamp(velB);
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(angleA, angleB);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      ready = true;
      if (reduced) {
        draw(angleA, angleB);
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    window.addEventListener("resize", onResize);
    if (!reduced) {
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", endDrag);
      canvas.addEventListener("pointercancel", endDrag);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-torus-canvas
      className={`block h-full w-full touch-none select-none font-mono text-foreground ${className}`}
      style={{ cursor: "grab" }}
    />
  );
}
