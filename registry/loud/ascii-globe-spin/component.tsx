"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// MeridianSpin — a rotating ASCII globe. A unit sphere is swept by lat/lon
// samples, projected orthographically into ISOTROPIC PIXEL space (both axes
// scaled by the same K1) and only THEN quantized to a monospace cell via
// cellW/cellH — same aspect-correction discipline as torus-render, one code
// path, no missed site. A coarse hand-authored lat/lon rectangle mask stands
// in for continents (see the ponytail note below); a Lambertian dot against
// a light direction FIXED in world space (independent of spin) produces a day
// side and a night side, and the night side is forced toward the sparse end
// of the density ramp regardless of land/water, so the terminator visibly
// sweeps across the surface as the globe turns. Drag (mouse/touch) spins the
// globe on its vertical axis directly, tracks a smoothed release velocity for
// inertia, and relaxes back to a slow idle spin — never a dead stop. A
// box-drawing HUD frame prints a live lat/lon readout under the cursor,
// solved by inverting the same projection+rotation used to draw the globe.
// All angle/readout text is drawn as canvas glyphs, never DOM text, so no
// trig value ever reaches SSR'd HTML.
// ---------------------------------------------------------------------------

const RAMP = ".,-~:;=!*#$@"; // 12-step density ramp, reused from torus-render
const IDLE_OMEGA = 0.22; // rad/s idle yaw spin
const FRICTION = 1.5; // s^-1 — relaxation rate back toward idle omega
const MAX_OMEGA = 10; // rad/s — release velocity ceiling
const DRAG_GAIN = 0.011; // rad per px of horizontal drag
const VEL_SMOOTH = 0.35; // EMA factor for tracked release velocity
const DT_MAX = 0.05;

// ponytail: continents are a coarse hand-authored lat/lon rectangle mask, not
// traced coastlines — at the character-grid resolutions this component
// renders at (tens of cells across), an accurate coastline buys nothing a
// human eye can resolve, and a real geo dependency would break the
// zero-deps/no-fetch constraint. The fidelity ceiling is "recognizable
// continent silhouettes", not "accurate coastlines" — do not mistake the
// output for a map.
const LAND_RECTS: [number, number, number, number][] = [
  // [latMin, latMax, lonMin, lonMax] degrees
  [25, 72, -168, -60], // North America
  [8, 25, -105, -77], // Central America land bridge
  [60, 83, -73, -12], // Greenland
  [-20, 12, -81, -35], // South America, upper/wide
  [-56, -20, -75, -53], // South America, southern taper
  [-35, 37, -18, 52], // Africa
  [35, 72, -10, 60], // Europe / western Asia
  [5, 75, 60, 150], // main Asia
  [50, 72, 150, 180], // Russian far east
  [-44, -10, 112, 154], // Australia
  [-90, -60, -180, 180], // Antarctica
];

function isLand(latDeg: number, lonDeg: number): boolean {
  for (let i = 0; i < LAND_RECTS.length; i++) {
    const [a, b, c, d] = LAND_RECTS[i];
    if (latDeg >= a && latDeg <= b && lonDeg >= c && lonDeg <= d) return true;
  }
  return false;
}

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}
const SUN = normalize3(0.55, 0.3, 0.85); // fixed in world space, independent of spin

export interface MeridianSpinProps {
  /** grid cell size in px */
  cellSize?: number;
  className?: string;
}

export function MeridianSpin({
  cellSize = 13,
  className = "",
}: MeridianSpinProps) {
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

    let rMinRow = 0;
    let rMaxRow = 0;
    let rMinCol = 0;
    let rMaxCol = 0;
    let renderCx = 0;
    let renderCy = 0;
    let K1 = 0;

    let depthBuf = new Float32Array(0);
    let charBuf = new Uint8Array(0);

    let latSteps = 90;
    let lonSteps = 240;

    // cursor, in canvas-local px, for the lat/lon readout
    let cursorX = -1e5;
    let cursorY = -1e5;
    let cursorOver = false;

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
      K1 = minRenderPx * 0.46;

      latSteps = Math.min(140, Math.max(70, Math.round(minRenderPx / 6)));
      lonSteps = Math.min(360, Math.max(200, Math.round(minRenderPx / 2.2)));

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
        if (reduced) draw(rotY);
      }, 150);
    };

    // solves the lat/lon under the tracked cursor by inverting the same
    // orthographic projection + spin used to draw the globe
    const readoutFor = (rot: number): string => {
      if (!cursorOver) return "lat  --.-°  lon  ---.-°";
      const sx = (cursorX - renderCx) / K1;
      const sy = -(cursorY - renderCy) / K1;
      const d2 = sx * sx + sy * sy;
      if (d2 > 1) return "lat  --.-°  lon  ---.-°";
      const sz = Math.sqrt(Math.max(0, 1 - d2));
      const latDeg = (Math.asin(sy) * 180) / Math.PI;
      let lonDeg = ((Math.atan2(sx, sz) - rot) * 180) / Math.PI;
      lonDeg = ((lonDeg + 180) % 360 + 360) % 360 - 180;
      const latS = (latDeg >= 0 ? latDeg : -latDeg).toFixed(1).padStart(4, "0");
      const lonS = (lonDeg >= 0 ? lonDeg : -lonDeg).toFixed(1).padStart(5, "0");
      return `lat ${latDeg >= 0 ? "N" : "S"}${latS}°  lon ${lonDeg >= 0 ? "E" : "W"}${lonS}°`;
    };

    const drawFrame = (rot: number) => {
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
      const label = readoutFor(rot);
      const interiorW = cols - 2;
      const start = Math.max(1, 1 + Math.floor((interiorW - label.length) / 2));
      for (let i = 0; i < label.length && start + i < cols - 1; i++) {
        const ch = label[i];
        if (ch === " ") continue;
        ctx.fillText(ch, cx(start + i), cy(1));
      }
      ctx.globalAlpha = 1;
    };

    const draw = (rot: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);
      depthBuf.fill(-2);
      charBuf.fill(0);

      const latStep = Math.PI / latSteps; // -PI/2..PI/2
      const lonStep = (Math.PI * 2) / lonSteps;
      const [sx0, sy0, sz0] = SUN;

      for (let li = 0; li <= latSteps; li++) {
        const lat = -Math.PI / 2 + li * latStep;
        const cosLat = Math.cos(lat);
        const sinLat = Math.sin(lat);
        const latDeg = (lat * 180) / Math.PI;

        for (let oi = 0; oi < lonSteps; oi++) {
          const lon = oi * lonStep;
          const lonR = lon + rot;
          const x = cosLat * Math.sin(lonR);
          const y = sinLat;
          const z = cosLat * Math.cos(lonR);
          if (z <= 0) continue; // back hemisphere, never visible

          const px = renderCx + K1 * x;
          const py = renderCy - K1 * y;
          const col = Math.round(px / cellW);
          const row = Math.round(py / cellH);
          if (col < rMinCol || col >= rMaxCol || row < rMinRow || row >= rMaxRow)
            continue;

          const idx = row * cols + col;
          if (z <= depthBuf[idx]) continue;
          depthBuf[idx] = z;

          const lum = x * sx0 + y * sy0 + z * sz0; // Lambertian, -1..1
          const dayFactor = lum > 0 ? lum : 0;
          let lonDeg = (lon * 180) / Math.PI;
          if (lonDeg > 180) lonDeg -= 360;
          const landBoost = isLand(latDeg, lonDeg) ? 1 : 0.4;
          // night side drops toward the sparse end regardless of land/water,
          // but keeps a faint ambient floor so the terminator reads as a
          // gradient, not a hard clip
          const density = Math.min(1, (0.05 + 0.95 * dayFactor) * landBoost);
          if (density < 0.05) continue; // true blank — no glyph
          const ci = Math.round(density * (RAMP.length - 1));
          charBuf[idx] = ci + 1;
        }
      }

      ctx.fillStyle = fgCss;
      for (let row = rMinRow; row < rMaxRow; row++) {
        for (let col = rMinCol; col < rMaxCol; col++) {
          const idx = row * cols + col;
          const ci = charBuf[idx];
          if (ci === 0) continue;
          const li = ci - 1;
          ctx.globalAlpha = 0.3 + (li / (RAMP.length - 1)) * 0.7;
          ctx.fillText(
            RAMP[li],
            col * cellW + cellW / 2,
            row * cellH + cellH / 2
          );
        }
      }
      ctx.globalAlpha = 1;
      drawFrame(rot);
    };

    // -- hot-path rotation state: plain locals, never React state -----------
    let rotY = 0.4; // non-degenerate start angle
    let omega = IDLE_OMEGA;
    let raf = 0;
    let last = 0;
    let dragging = false;
    let pointerId = -1;
    let startX = 0;
    let baseRot = 0;
    let lastMoveT = 0;
    let vel = 0;

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      if (!dragging) {
        rotY += omega * dt;
        omega = IDLE_OMEGA + (omega - IDLE_OMEGA) * Math.exp(-FRICTION * dt);
      }
      draw(rotY);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      baseRot = rotY;
      lastMoveT = performance.now();
      vel = 0;
      canvas.style.cursor = "grabbing";
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointer, ignore */
      }
    };
    const updateCursor = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      cursorX = e.clientX - rect.left;
      cursorY = e.clientY - rect.top;
      cursorOver = true;
    };
    const onPointerMove = (e: PointerEvent) => {
      updateCursor(e);
      if (reduced) draw(rotY); // static frame still tracks the readout on hover
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const nextRot = baseRot + dx * DRAG_GAIN;
      const now = performance.now();
      const dt = Math.max(0.008, (now - lastMoveT) / 1000);
      const instVel = (nextRot - rotY) / dt;
      vel = vel * (1 - VEL_SMOOTH) + instVel * VEL_SMOOTH;
      rotY = nextRot;
      lastMoveT = now;
      if (reduced) draw(rotY);
    };
    const endDrag = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = -1;
      canvas.style.cursor = "grab";
      omega = Math.max(-MAX_OMEGA, Math.min(MAX_OMEGA, vel));
    };
    const onLeave = () => {
      cursorOver = false;
      if (reduced) draw(rotY);
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(rotY);
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
        draw(rotY);
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    window.addEventListener("resize", onResize);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onLeave);
    if (!reduced) {
      canvas.addEventListener("pointerdown", onPointerDown);
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
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-meridian-canvas
      className={`block h-full w-full touch-none select-none font-mono text-foreground ${className}`}
      style={{ cursor: "grab" }}
    />
  );
}
