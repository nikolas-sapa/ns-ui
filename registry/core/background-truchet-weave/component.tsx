"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// TruchetWeave — an ambient Truchet arc weave. Every cell carries one of two
// quarter-arc tiles, and both tilings are edge-compatible (each cell edge is
// crossed at its midpoint), so the arcs join across every boundary into one
// continuous interlaced curve — the classic Truchet "maze of loops". What
// picks the tile is not a coin flip but the SIGN of a slow three-term harmonic
// field, so the frame organises into large soft domains of consistent
// orientation. Sparsity is the other half: stroke alpha falls off with the
// field's DISTANCE FROM ZERO, so cells sitting on the zero set — the domain
// walls, exactly where the orientation is about to flip — fade out entirely
// and the weave reads as torn open along pale seams rather than as a uniform
// mat. The pointer adds a gaussian bias to the field BEFORE the sign test, so
// cells with small |f| flip first: a new domain wall opens as a ring around
// the cursor and re-routes the arcs outward from it, then retreats when the
// pointer leaves.
// ---------------------------------------------------------------------------

const ALPHA_BUCKETS = 5;
const MIN_ALPHA = 0.06; // below this a cell is skipped entirely
const FADE_SCALE = 1.2; // |f| at which a cell reaches full ink
const FADE_POW = 1.6; // steepness of the seam falloff
const ANGLE_A = 0.42; // rad — first harmonic rotation
const ANGLE_B = 1.93; // rad — second harmonic rotation
const BIAS_RADIUS = 5.5; // cells — gaussian sigma of the pointer bias
const BIAS_PEAK = 1.35; // peak added to the field under the pointer
const BIAS_TAU = 0.5; // s — ease-in / relax-back time constant
const BIAS_CUT2 = (BIAS_RADIUS * 4) * (BIAS_RADIUS * 4);
const LINE_WIDTH = 1.25;
const DT_MAX = 1 / 30;

const COS_A = Math.cos(ANGLE_A);
const SIN_A = Math.sin(ANGLE_A);
const SIN_B = Math.sin(ANGLE_B);
const COS_B = Math.cos(ANGLE_B);

const HALF_PI = Math.PI / 2;

/** Three-term harmonic sum evaluated at two fixed rotation angles. */
function field(cx: number, cy: number, t: number): number {
  const u = cx * COS_A + cy * SIN_A;
  const v = -cx * SIN_B + cy * COS_B;
  return (
    Math.sin(u * 0.26 + 0.11 * t) +
    0.7 * Math.sin(v * 0.19 - 0.09 * t) +
    0.45 * Math.sin((u + v) * 0.11 + 0.05 * t)
  );
}

export interface TruchetWeaveProps {
  /** square tile size in px */
  tileSize?: number;
  className?: string;
}

export function TruchetWeave({
  tileSize = 28,
  className = "",
}: TruchetWeaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const TILE = Math.max(8, tileSize);
    const R = TILE / 2;

    let fg = "currentColor";
    let cols = 0;
    let rows = 0;
    let sized = false;
    let disposed = false;

    // per-bucket cell-index lists, reused every frame
    const bucketLists: number[][] = Array.from(
      { length: ALPHA_BUCKETS },
      () => []
    );

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
    };

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      if (width < 4 || height < 4) {
        sized = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(2, Math.ceil(width / TILE));
      rows = Math.max(2, Math.ceil(height / TILE));
      sized = true;
    };

    const draw = (t: number, px: number, py: number, strength: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, cols * TILE + TILE, rows * TILE + TILE);

      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketLists[b]!.length = 0;

      const sigma2 = 2 * BIAS_RADIUS * BIAS_RADIUS;
      const biased = strength > 0.01;

      // pass one — classify every cell into an alpha bucket
      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++, i++) {
          const cx = gx + 0.5;
          const cy = gy + 0.5;
          let f = field(cx, cy, t);
          if (biased) {
            const dx = cx - px;
            const dy = cy - py;
            const d2 = dx * dx + dy * dy;
            if (d2 < BIAS_CUT2) {
              f += BIAS_PEAK * strength * Math.exp(-d2 / sigma2);
            }
          }
          const a = Math.pow(
            Math.min(1, Math.abs(f) / FADE_SCALE),
            FADE_POW
          );
          if (a < MIN_ALPHA) continue;
          const b = Math.min(ALPHA_BUCKETS - 1, Math.floor(a * ALPHA_BUCKETS));
          // sign of the field picks the tile; pack it into the stored index
          bucketLists[b]!.push(f > 0 ? i : -i - 1);
        }
      }

      // pass two — one path, one globalAlpha write and one stroke per bucket
      ctx.strokeStyle = fg;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineCap = "butt";
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = bucketLists[b]!;
        if (list.length === 0) continue;
        ctx.beginPath();
        for (let k = 0; k < list.length; k++) {
          const packed = list[k]!;
          const bit = packed >= 0;
          const idx = bit ? packed : -packed - 1;
          const gx = idx % cols;
          const gy = (idx - gx) / cols;
          const x = gx * TILE;
          const y = gy * TILE;
          if (bit) {
            // tile A — arcs centred on the top-left and bottom-right corners
            ctx.moveTo(x + R, y);
            ctx.arc(x, y, R, 0, HALF_PI);
            ctx.moveTo(x + TILE - R, y + TILE);
            ctx.arc(x + TILE, y + TILE, R, Math.PI, Math.PI + HALF_PI);
          } else {
            // tile B — arcs centred on the top-right and bottom-left corners
            ctx.moveTo(x + TILE, y + R);
            ctx.arc(x + TILE, y, R, HALF_PI, Math.PI);
            ctx.moveTo(x, y + TILE - R);
            ctx.arc(x, y + TILE, R, -HALF_PI, 0);
          }
        }
        ctx.globalAlpha = 0.1 + (b / (ALPHA_BUCKETS - 1)) * 0.62;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    const ptr = { x: -1e5, y: -1e5, has: false, strength: 0 };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      const target = ptr.has ? 1 : 0;
      ptr.strength += (target - ptr.strength) * Math.min(1, dt / BIAS_TAU);
      draw(t, ptr.x, ptr.y, ptr.strength);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ptr.x = (e.clientX - rect.left) / TILE;
      ptr.y = (e.clientY - rect.top) / TILE;
      ptr.has = true;
    };
    const onPointerLeave = () => {
      ptr.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && !disposed) {
        last = 0;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(0, -1e5, -1e5, 0);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0, -1e5, -1e5, 0);
    });
    ro.observe(canvas);

    readTokens();
    resize();
    if (reduced) {
      draw(0, -1e5, -1e5, 0);
    } else {
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
      raf = requestAnimationFrame(loop);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      mo.disconnect();
      ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [tileSize]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full text-foreground ${className}`}
    />
  );
}
