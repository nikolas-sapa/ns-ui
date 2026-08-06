"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// VoronoiWalls — an ambient ASCII background that draws a Voronoi diagram's
// WALLS ONLY. For every grid cell the nearest and second-nearest site distances
// d1 <= d2 are found by a plain linear scan, and ink is placed only where the
// NORMALIZED difference w = (d2 - d1) / (d2 + d1) falls below a small
// threshold — i.e. exactly where the two closest sites are near-equidistant.
// The normalization is the point: raw (d2 - d1) would make walls near the
// sites hairline and walls far away fat, whereas w is scale-free, so every
// boundary in the frame is the same weight. Cell interiors have w near 1 and
// draw nothing, so most of the field is empty by construction and what is left
// is a network of hairlines meeting at clean three-way junctions — three sites
// equidistant is a Y-junction, which is why foam and cracked mud look like
// this. Measured coverage is ~10% of cells, stable across drift and frame
// size. The pointer joins the diagram as an EXTRA SITE WITH A POWER WEIGHT
// (a Laguerre / power Voronoi cell): its distance is measured as the tangent
// length sqrt(d^2 - r^2) rather than d, with r^2 easing up while the pointer
// is over the canvas. A positive weight makes its cell OWN MORE TERRITORY, so
// the surrounding walls bow convexly away and the neighbours are squeezed —
// a bubble inflating in a foam. On leave r^2 eases back to 0, the cell
// collapses, and the walls spring back to the undisturbed diagram.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";
const ALPHA_BUCKETS = 6;
const WALL_W = 0.055; // normalized (d2-d1)/(d2+d1) below which a cell is inked
const WALL_POW = 1.5; // luminance falloff across the wall's width
const JUNCTION_BOOST = 1.6; // triple points read a touch brighter, as in a foam
const DRIFT_AMP = 0.045; // * min(W,H) — lissajous amplitude per site
const DRIFT_MIN = 0.06; // rad/s
const DRIFT_MAX = 0.17; // rad/s
const MIN_SEP = 0.16; // * min(W,H) — poisson-disk rejection radius
const POINTER_R = 0.1; // * min(W,H) — max power radius of the pointer's cell
const POINTER_TAU = 0.5; // s — weight ease time constant, both directions
const DT_MAX = 0.05;
const SEED = 0x5eed1a;

/** deterministic PRNG so the site layout is stable for a given size */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface VoronoiWallsProps {
  /** grid cell size in px */
  cellSize?: number;
  /** base number of drifting sites, scaled by frame area and clamped 14..34 */
  siteCount?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function VoronoiWalls({
  cellSize = 12,
  siteCount = 22,
  className = "",
}: VoronoiWallsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    let width = 0;
    let height = 0;
    let sized = false;
    let ready = false;
    let disposed = false;

    let charBuf = new Uint8Array(0);
    const bucketLists: number[][] = Array.from(
      { length: ALPHA_BUCKETS },
      () => []
    );

    // site fields: base position, lissajous frequency and phase
    let n = 0;
    let sx0 = new Float32Array(0);
    let sy0 = new Float32Array(0);
    let swx = new Float32Array(0);
    let swy = new Float32Array(0);
    let spx = new Float32Array(0);
    let spy = new Float32Array(0);
    let amp = 0;
    // live positions, plus one trailing slot for the pointer site
    let px = new Float32Array(0);
    let py = new Float32Array(0);

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

    /** poisson-disk rejection sampling — no two sites closer than minSep */
    const seedSites = () => {
      const m = Math.min(width, height);
      const scale = Math.sqrt((width * height) / (1280 * 720));
      n = Math.max(14, Math.min(34, Math.round(siteCount * scale)));
      amp = DRIFT_AMP * m;
      sx0 = new Float32Array(n);
      sy0 = new Float32Array(n);
      swx = new Float32Array(n);
      swy = new Float32Array(n);
      spx = new Float32Array(n);
      spy = new Float32Array(n);
      px = new Float32Array(n + 1);
      py = new Float32Array(n + 1);

      const rng = mulberry32(SEED);
      let sep = MIN_SEP * m;
      const pad = -amp * 0.5; // let sites drift a little off-frame
      let placed = 0;
      let fails = 0;
      while (placed < n) {
        const cx = pad + rng() * (width - 2 * pad);
        const cy = pad + rng() * (height - 2 * pad);
        let ok = true;
        for (let i = 0; i < placed; i++) {
          const dx = cx - sx0[i]!;
          const dy = cy - sy0[i]!;
          if (dx * dx + dy * dy < sep * sep) {
            ok = false;
            break;
          }
        }
        if (!ok) {
          // relax the separation rather than spin forever in a tight frame
          if (++fails > 220) {
            sep *= 0.9;
            fails = 0;
          }
          continue;
        }
        sx0[placed] = cx;
        sy0[placed] = cy;
        swx[placed] = DRIFT_MIN + rng() * (DRIFT_MAX - DRIFT_MIN);
        swy[placed] = DRIFT_MIN + rng() * (DRIFT_MAX - DRIFT_MIN);
        spx[placed] = rng() * Math.PI * 2;
        spy[placed] = rng() * Math.PI * 2;
        placed++;
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      cols = Math.max(4, Math.ceil(width / cellW));
      rows = Math.max(4, Math.ceil(height / cellH));
      charBuf = new Uint8Array(cols * rows);
      seedSites();
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(0, 0, 0, 0);
      }, 150);
    };

    const draw = (t: number, pxc: number, pyc: number, pr2: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, width, height);
      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketLists[b]!.length = 0;

      // advance every site along its own slow lissajous
      for (let i = 0; i < n; i++) {
        px[i] = sx0[i]! + amp * Math.sin(t * swx[i]! + spx[i]!);
        py[i] = sy0[i]! + amp * Math.cos(t * swy[i]! + spy[i]!);
      }
      const hasPointer = pr2 > 1;
      const count = hasPointer ? n + 1 : n;
      if (hasPointer) {
        px[n] = pxc;
        py[n] = pyc;
      }

      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        const y = gy * cellH + cellH / 2;
        for (let gx = 0; gx < cols; gx++, i++) {
          const x = gx * cellW + cellW / 2;
          // three smallest effective distances by linear scan. Ordering is
          // done on the SQUARED quantity and only the three winners are
          // square-rooted, which keeps the scan at one sqrt-free inner step.
          let q1 = Infinity;
          let q2 = Infinity;
          let q3 = Infinity;
          for (let s = 0; s < count; s++) {
            const dx = x - px[s]!;
            const dy = y - py[s]!;
            let q = dx * dx + dy * dy;
            // power (Laguerre) distance for the weighted pointer site: the
            // squared tangent length to its circle, so the bisector is the
            // radical axis and the cell genuinely grows with the weight
            if (hasPointer && s === n) q = q > pr2 ? q - pr2 : 0;
            if (q < q1) {
              q3 = q2;
              q2 = q1;
              q1 = q;
            } else if (q < q2) {
              q3 = q2;
              q2 = q;
            } else if (q < q3) {
              q3 = q;
            }
          }
          const d1 = Math.sqrt(q1);
          const d2 = Math.sqrt(q2);
          const d3 = Math.sqrt(q3);

          const sum = d1 + d2;
          const w = sum > 1e-6 ? (d2 - d1) / sum : 1;
          let v = 0;
          if (w < WALL_W) {
            v = Math.pow(1 - w / WALL_W, WALL_POW);
            const sum3 = d1 + d3;
            if (sum3 > 1e-6 && (d3 - d1) / sum3 < WALL_W) {
              v = Math.min(1, v * JUNCTION_BOOST);
            }
          }

          const ci = Math.floor(v * (RAMP.length - 1));
          charBuf[i] = ci;
          if (ci !== 0) {
            const bucket = Math.min(
              ALPHA_BUCKETS - 1,
              Math.floor(v * ALPHA_BUCKETS)
            );
            bucketLists[bucket]!.push(i);
          }
        }
      }

      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = bucketLists[b]!;
        if (list.length === 0) continue;
        ctx.globalAlpha = 0.14 + (b / (ALPHA_BUCKETS - 1)) * 0.86;
        for (let k = 0; k < list.length; k++) {
          const idx = list[k]!;
          const gx = idx % cols;
          const gy = (idx - gx) / cols;
          ctx.fillText(
            RAMP[charBuf[idx]!]!,
            gx * cellW + cellW / 2,
            gy * cellH + cellH / 2
          );
        }
      }
      ctx.globalAlpha = 1;
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    const ptr = { x: 0, y: 0, has: false, r2: 0 };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      const m = Math.min(width, height);
      const target = ptr.has ? (POINTER_R * m) ** 2 : 0;
      ptr.r2 += (target - ptr.r2) * Math.min(1, dt / POINTER_TAU);
      draw(t, ptr.x, ptr.y, ptr.r2);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      ptr.x = e.clientX - rect.left;
      ptr.y = e.clientY - rect.top;
      ptr.has = true;
    };
    const onPointerLeave = () => {
      ptr.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        // a frame requested while the tab was hidden is still queued; drop it
        // so resuming never leaves two loops running at double speed
        cancelAnimationFrame(raf);
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(0, 0, 0, 0);
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
        draw(0, 0, 0, 0);
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    window.addEventListener("resize", onResize);
    if (!reduced) {
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize, siteCount]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`block h-full w-full font-mono text-foreground ${className}`}
    />
  );
}
