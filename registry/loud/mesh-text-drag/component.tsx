"use client";

import { useEffect, useRef } from "react";

// Cloth-like kinetic type: a headline rasterized once to an offscreen canvas,
// then re-drawn every frame through a warped mesh of spring-loaded nodes.
// Each grid cell is split into two triangles and texture-mapped onto its
// current (warped) corner positions via a solved 2D affine transform — the
// standard three-point affine texture-mapping trick, since canvas 2D has no
// native quad/homography draw. Hovering pulls nearby nodes toward the
// pointer; leaving lets them spring home with damping. Direct-DOM rAF loop,
// no React state on the hot path, sleeps once the mesh has settled and the
// pointer is gone.

type Node = {
  hx: number; // home x/y (rest grid position, logical px)
  hy: number;
  x: number; // current warped position
  y: number;
  vx: number;
  vy: number;
};

const GRID_COLS = 12; // cells across (13 node columns)
const GRID_ROWS = 4; // cells down (5 node rows)
const CAPTURE_RADIUS = 150; // px — pointer influence falls off to 0 past this
const PULL = 0.6; // fraction of (pointer - home) a fully-captured node targets
const SPRING_K = 170; // s⁻²
const ZETA = 0.72; // damping ratio — < 1 so release has a visible overshoot
const DT_MAX = 0.032;
const GLOW_SPEED = 90; // px/s — cell average speed above this gets an accent glow
const SETTLE_EPS = 0.15;

/**
 * Solve the 2x2 linear map + translation that sends src triangle (p0,p1,p2)
 * to dst triangle (P0,P1,P2), via basis vectors relative to point 0. Exact
 * for any non-degenerate triangle (three point correspondences fully
 * determine an affine transform).
 */
function solveAffine(
  x0: number, y0: number, x1: number, y1: number, x2: number, y2: number,
  X0: number, Y0: number, X1: number, Y1: number, X2: number, Y2: number
): [number, number, number, number, number, number] {
  const ux = x1 - x0, uy = y1 - y0;
  const vx = x2 - x0, vy = y2 - y0;
  const Ux = X1 - X0, Uy = Y1 - Y0;
  const Vx = X2 - X0, Vy = Y2 - Y0;
  const det = ux * vy - uy * vx || 1e-6;
  const a = (Ux * vy - Vx * uy) / det;
  const c = (Vx * ux - Ux * vx) / det;
  const b = (Uy * vy - Vy * uy) / det;
  const d = (Vy * ux - Uy * vx) / det;
  const e = X0 - (a * x0 + c * y0);
  const f = Y0 - (b * x0 + d * y0);
  return [a, b, c, d, e, f];
}

const smooth01 = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

export function MeshTextDrag({
  text = "ELASTIC",
  className = "",
}: {
  text?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const label = labelRef.current;
    if (!container || !canvas || !label) return;
    // reduced motion: canvas stays hidden (CSS), real label stays visible,
    // a slow CSS opacity ripple stands in for the warp — no rAF loop at all
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dampC = 2 * ZETA * Math.sqrt(SPRING_K);

    let width = 0;
    let height = 0;
    let dpr = 1;
    let nodes: Node[] = [];
    let cellW = 0;
    let cellH = 0;
    let offscreen: HTMLCanvasElement | null = null;
    let raf = 0;
    let last = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerActive = false;
    let disposed = false;
    let fgColor = "#ededed";
    let accentColor = "#006bff";

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fgColor = cs.getPropertyValue("--foreground").trim() || "#ededed";
      accentColor = cs.getPropertyValue("--accent").trim() || "#006bff";
    };

    const rebuildOffscreen = () => {
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(width * dpr));
      off.height = Math.max(1, Math.round(height * dpr));
      const octx = off.getContext("2d");
      if (!octx) return null;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cs = getComputedStyle(label);
      const size = parseFloat(cs.fontSize) || 48;
      octx.font = `${cs.fontWeight || 700} ${size}px ${cs.fontFamily}`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillStyle = fgColor;
      octx.fillText(text, width / 2, height / 2);
      return off;
    };

    const buildGrid = () => {
      cellW = width / GRID_COLS;
      cellH = height / GRID_ROWS;
      const next: Node[] = [];
      for (let j = 0; j <= GRID_ROWS; j++) {
        for (let i = 0; i <= GRID_COLS; i++) {
          const hx = i * cellW;
          const hy = j * cellH;
          next.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0 });
        }
      }
      nodes = next;
    };

    const idx = (i: number, j: number) => j * (GRID_COLS + 1) + i;

    const init = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 4 || h < 4) return;
      width = w;
      height = h;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGrid();
      offscreen = rebuildOffscreen();
    };

    // Clip path is dilated slightly outward from the triangle's centroid so
    // neighboring triangles overlap by a fraction of a pixel instead of
    // leaving an anti-aliased hairline gap between them — since both sides
    // sample the identically-registered source bitmap, the overlap repaints
    // the same pixels and stays seamless even at rest (identity transform).
    const CLIP_DILATE = 0.75;
    const dilated = (px: number, py: number, cx: number, cy: number): [number, number] => {
      const dx = px - cx;
      const dy = py - cy;
      const len = Math.hypot(dx, dy) || 1;
      return [px + (dx / len) * CLIP_DILATE, py + (dy / len) * CLIP_DILATE];
    };

    const drawTriangle = (
      n0: Node, n1: Node, n2: Node,
      speed: number
    ) => {
      if (!offscreen) return;
      const cx = (n0.x + n1.x + n2.x) / 3;
      const cy = (n0.y + n1.y + n2.y) / 3;
      const [p0x, p0y] = dilated(n0.x, n0.y, cx, cy);
      const [p1x, p1y] = dilated(n1.x, n1.y, cx, cy);
      const [p2x, p2y] = dilated(n2.x, n2.y, cx, cy);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p0x, p0y);
      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.closePath();
      ctx.clip();
      const m = solveAffine(
        n0.hx * dpr, n0.hy * dpr, n1.hx * dpr, n1.hy * dpr, n2.hx * dpr, n2.hy * dpr,
        n0.x, n0.y, n1.x, n1.y, n2.x, n2.y
      );
      ctx.transform(...m);
      if (speed > GLOW_SPEED) {
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = Math.min(14, (speed - GLOW_SPEED) / 14);
      }
      ctx.drawImage(offscreen, 0, 0);
      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(DT_MAX, Math.max(0, (now - last) / 1000));
      last = now;

      let settled = true;
      for (const n of nodes) {
        let tx = n.hx;
        let ty = n.hy;
        if (pointerActive) {
          const dx = pointerX - n.hx;
          const dy = pointerY - n.hy;
          const dist = Math.hypot(dx, dy);
          if (dist < CAPTURE_RADIUS) {
            const falloff = smooth01(1 - dist / CAPTURE_RADIUS);
            tx = n.hx + dx * falloff * PULL;
            ty = n.hy + dy * falloff * PULL;
          }
        }
        const ax = SPRING_K * (tx - n.x) - dampC * n.vx;
        const ay = SPRING_K * (ty - n.y) - dampC * n.vy;
        n.vx += ax * dt;
        n.vy += ay * dt;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (
          Math.abs(tx - n.x) > SETTLE_EPS ||
          Math.abs(ty - n.y) > SETTLE_EPS ||
          Math.abs(n.vx) > 0.5 ||
          Math.abs(n.vy) > 0.5
        ) {
          settled = false;
        }
      }

      ctx.clearRect(0, 0, width, height);
      for (let j = 0; j < GRID_ROWS; j++) {
        for (let i = 0; i < GRID_COLS; i++) {
          const tl = nodes[idx(i, j)];
          const tr = nodes[idx(i + 1, j)];
          const bl = nodes[idx(i, j + 1)];
          const br = nodes[idx(i + 1, j + 1)];
          const speed = (
            Math.hypot(tl.vx, tl.vy) + Math.hypot(tr.vx, tr.vy) +
            Math.hypot(bl.vx, bl.vy) + Math.hypot(br.vx, br.vy)
          ) / 4;
          drawTriangle(tl, tr, bl, speed);
          drawTriangle(tr, br, bl, speed);
        }
      }

      raf = settled && !pointerActive ? 0 : requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      pointerY = e.clientY - rect.top;
      pointerActive = true;
      wake();
    };
    const onLeave = () => {
      pointerActive = false;
      wake();
    };

    let ro: ResizeObserver | undefined;
    readTokens();
    const mo = new MutationObserver(() => {
      readTokens();
      offscreen = rebuildOffscreen();
      wake();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.fonts.ready.then(() => {
      if (disposed) return;
      init();
      // draw the flat resting frame immediately so there is no blank paint
      // before the first pointer event ever arrives
      if (ctx && offscreen) {
        ctx.clearRect(0, 0, width, height);
        for (let j = 0; j < GRID_ROWS; j++) {
          for (let i = 0; i < GRID_COLS; i++) {
            const tl = nodes[idx(i, j)];
            const tr = nodes[idx(i + 1, j)];
            const bl = nodes[idx(i, j + 1)];
            const br = nodes[idx(i + 1, j + 1)];
            drawTriangle(tl, tr, bl, 0);
            drawTriangle(tr, br, bl, 0);
          }
        }
      }
      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const w = Math.round(entry.contentRect.width);
        const h = Math.round(entry.contentRect.height);
        if (w !== width || h !== height) {
          init();
          wake();
        }
      });
      ro.observe(container);
    });

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      mo.disconnect();
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
    };
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full cursor-crosshair select-none px-4 py-16 ${className}`}
    >
      <style>{`@keyframes nsui-mtd-ripple{0%,100%{opacity:0.88}50%{opacity:1}}`}</style>
      <span
        ref={labelRef}
        role="text"
        aria-label={text}
        className="block whitespace-nowrap text-center font-sans font-bold text-foreground opacity-0 motion-reduce:opacity-100 motion-reduce:[animation:nsui-mtd-ripple_6s_ease-in-out_infinite]"
        style={{ fontSize: "clamp(2.5rem, 8vw, 6rem)", lineHeight: 1.1 }}
      >
        {text}
      </span>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full motion-reduce:hidden"
      />
    </div>
  );
}
