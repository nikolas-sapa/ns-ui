"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// VanishRun — a full-bleed ASCII perspective corridor. A fixed count of
// superellipse ("squircle") rings sit at evenly-spaced world depths and
// advance toward the viewer every frame (z -= speed*dt), wrapping back to
// the far plane once they pass the near clip so the ring count and spacing
// never change — the same treadmill trick a starfield uses, which is what
// makes the loop read as continuous forward motion down a tunnel rather than
// a reset. Every ring point projects into ISOTROPIC pixel space (both axes
// scaled by one constant K1, exactly the ascii-torus-donut discipline) around a
// shared vanishing point, and only THEN quantizes to the mono cell grid, so
// the rings stay true ellipses/squares instead of stretching with the cell's
// ~2:1 aspect. Nearer points win a per-cell Float32Array depth competition
// (bigger 1/z = nearer), same as ascii-torus-donut's depth buffer, because ring
// draw order does not correspond to depth order once rings have wrapped at
// different times — without it, a far ring could paint over a near one. The
// pointer steers the shared vanishing point itself (eased trailing toward
// the raw pointer position), so the whole corridor tilts toward the cursor;
// optional children re-center on that same point every frame via a direct
// style.transform write, never React state.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@"; // 10-step density ramp, index 0 = blank
const RING_COUNT = 16;
const Z_NEAR = 0.55;
const Z_FAR = 6.2;
const CYCLE_SECONDS = 3.4; // time for one ring to travel Z_FAR -> Z_NEAR
const RING_SPEED = (Z_FAR - Z_NEAR) / CYCLE_SECONDS;
const WORLD_A = 1.55; // squircle half-width, world units
const WORLD_B = 1; // squircle half-height, world units
const SQUIRCLE_EXP = 0.5; // 2/n with n=4 — rounded-rect-ish ring
const VP_EASE = 0.07; // per-frame lerp of the vanishing point toward target
const VP_RANGE = 0.34; // fraction of render size the vp can travel
const DT_MAX = 0.05;
const CONTENT_FEATHER_PX = 64; // soft falloff distance beyond the children's box

export interface VanishRunProps {
  /** grid cell size in px */
  cellSize?: number;
  /** headline / CTA centered at the vanishing point */
  children?: ReactNode;
  className?: string;
}

export function VanishRun({
  cellSize = 13,
  children,
  className = "",
}: VanishRunProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let fg = "currentColor";
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
    let vpMaxPx = 0;
    let rootW = 0;
    let rootH = 0;

    // -- children's measured box, kept fresh via ResizeObserver, used to
    // attenuate the ring field under whatever the caller passes as children --
    const content = contentRef.current;
    const hasContent = !!content;
    let contentW = 0;
    let contentH = 0;
    const measureContent = () => {
      if (!content) return;
      const r = content.getBoundingClientRect();
      contentW = r.width;
      contentH = r.height;
    };
    measureContent();
    const contentRO = content ? new ResizeObserver(measureContent) : null;
    if (content) contentRO?.observe(content);

    let depthBuf = new Float32Array(0);
    let charBuf = new Uint8Array(0);

    let pointsPerRing = 96;
    const ringZ = new Float32Array(RING_COUNT);
    for (let i = 0; i < RING_COUNT; i++) {
      ringZ[i] = Z_NEAR + (i * (Z_FAR - Z_NEAR)) / RING_COUNT;
    }

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
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

      rootW = width;
      rootH = height;

      cols = Math.max(4, Math.floor(width / cellW));
      rows = Math.max(6, Math.floor(height / cellH));

      rMinRow = 0;
      rMaxRow = rows;
      rMinCol = 0;
      rMaxCol = cols;

      const renderW = rMaxCol * cellW;
      const renderH = rMaxRow * cellH;
      renderCx = renderW / 2;
      renderCy = renderH / 2;
      const minRenderPx = Math.min(renderW, renderH);
      K1 = minRenderPx * 0.46;
      vpMaxPx = minRenderPx * VP_RANGE;

      pointsPerRing = Math.min(220, Math.max(48, Math.round(minRenderPx / 5)));

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
        if (reduced) draw();
      }, 150);
    };

    const draw = () => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);
      depthBuf.fill(0);
      charBuf.fill(0);

      const cx = renderCx + vp.x;
      const cy = renderCy + vp.y;
      const thetaStep = (Math.PI * 2) / pointsPerRing;

      for (let i = 0; i < RING_COUNT; i++) {
        const z = ringZ[i];
        const ooz = 1 / z;
        const depthT = Math.min(
          1,
          Math.max(0, 1 - (z - Z_NEAR) / (Z_FAR - Z_NEAR))
        );
        const li = Math.min(
          RAMP.length - 1,
          Math.max(1, Math.round(Math.pow(depthT, 0.85) * (RAMP.length - 1)))
        );

        for (let p = 0; p < pointsPerRing; p++) {
          const theta = p * thetaStep;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);
          const wx =
            WORLD_A * Math.sign(cosT) * Math.pow(Math.abs(cosT), SQUIRCLE_EXP);
          const wy =
            WORLD_B * Math.sign(sinT) * Math.pow(Math.abs(sinT), SQUIRCLE_EXP);

          const px = cx + K1 * ooz * wx;
          const py = cy + K1 * ooz * wy;
          const col = Math.round(px / cellW);
          const row = Math.round(py / cellH);
          if (col < rMinCol || col >= rMaxCol || row < rMinRow || row >= rMaxRow)
            continue;

          const idx = row * cols + col;
          if (ooz > depthBuf[idx]) {
            depthBuf[idx] = ooz;
            charBuf[idx] = li + 1;
          }
        }
      }

      // children's box in the same coordinate space canvas cells are drawn
      // in (root-local CSS px) — the field attenuates toward the background
      // under it, feathering out over CONTENT_FEATHER_PX rather than a hard
      // cut, so it reads as glyphs dimming out rather than a punched hole
      const hasContentBox = hasContent && contentW > 0 && contentH > 0;
      const contentCx = rootW / 2 + vp.x;
      const contentCy = rootH / 2 + vp.y;
      const innerHalfW = contentW / 2;
      const innerHalfH = contentH / 2;

      ctx.fillStyle = fg;
      for (let row = rMinRow; row < rMaxRow; row++) {
        for (let col = rMinCol; col < rMaxCol; col++) {
          const idx = row * cols + col;
          const ci = charBuf[idx];
          if (ci === 0) continue;
          const li = ci - 1;
          let alpha = 0.3 + (li / (RAMP.length - 1)) * 0.7;
          const px = col * cellW + cellW / 2;
          const py = row * cellH + cellH / 2;
          if (hasContentBox) {
            const dx = Math.max(Math.abs(px - contentCx) - innerHalfW, 0);
            const dy = Math.max(Math.abs(py - contentCy) - innerHalfH, 0);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const t = Math.min(1, Math.max(0, dist / CONTENT_FEATHER_PX));
            const atten = t * t * (3 - 2 * t); // smoothstep
            if (atten <= 0.02) continue;
            alpha *= atten;
          }
          ctx.globalAlpha = alpha;
          ctx.fillText(RAMP[li], px, py);
        }
      }
      ctx.globalAlpha = 1;
    };

    // -- hot-path state: locals only, never React state ---------------------
    let raf = 0;
    let last = 0;
    const vp = { tx: 0, ty: 0, x: 0, y: 0 };

    const placeContent = () => {
      const content = contentRef.current;
      if (!content) return;
      content.style.transform = `translate(-50%, -50%) translate(${vp.x}px, ${vp.y}px)`;
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      for (let i = 0; i < RING_COUNT; i++) {
        ringZ[i] -= RING_SPEED * dt;
        if (ringZ[i] < Z_NEAR) ringZ[i] += Z_FAR - Z_NEAR;
      }
      vp.x += (vp.tx - vp.x) * VP_EASE;
      vp.y += (vp.ty - vp.y) * VP_EASE;
      draw();
      placeContent();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      vp.tx = nx * 2 * vpMaxPx;
      vp.ty = ny * 2 * vpMaxPx;
    };
    const onPointerLeave = () => {
      vp.tx = 0;
      vp.ty = 0;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw();
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
        draw();
        placeContent();
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    window.addEventListener("resize", onResize);
    if (!reduced) {
      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", onPointerLeave);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      contentRO?.disconnect();
      window.removeEventListener("resize", onResize);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate min-h-screen w-full overflow-hidden bg-background font-mono ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 block h-full w-full text-foreground" />
      {children ? (
        <div
          ref={contentRef}
          className="absolute left-1/2 top-1/2 flex w-full max-w-md flex-col items-center gap-4 px-6 text-center"
          style={{ transform: "translate(-50%, -50%)" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
