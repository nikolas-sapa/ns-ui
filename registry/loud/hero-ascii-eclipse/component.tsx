"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Totality — a full-bleed ASCII hero built around an OCCLUSION event: a dark
// disc (the moon) transits a bright glyph disc (the sun) sitting over a
// sparse fixed starfield. This is a compositing problem, not a field-sample
// or particle problem — per cell, in strict paint order: inside the moon's
// radius is always blank (it occludes everything beneath it, sun or star,
// unconditionally); inside the sun's radius but outside the moon draws the
// photosphere (density ramp, brighter toward its own center); a ring band
// just outside the sun's radius draws the CORONA — glyphs whose density
// carries an angular "streamer" flicker (a per-angle sine, not noise, so the
// flare pattern is smooth and repeatable) — but the corona's overall
// intensity is a single scalar driven by how closely the moon's center
// currently sits over the sun's: it is near zero during an ordinary partial
// transit and only blooms as the two centers nearly coincide (totality),
// which is the actual astronomy the effect is named for. Elsewhere, the
// fixed starfield (identical technique to hero-ascii-terrain's sky) shows
// through. The pointer DRAGS the moon across the sun (eased toward the raw
// pointer position); at rest, a slow idle drift carries it back and forth on
// its own so the transit is never a dead frame.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";
const STAR_CHARS = [1, 2, 3];
const CURSOR_EASE = 0.08;
const IDLE_PERIOD = 9; // s for one full idle sweep across the sun
const DT_MAX = 0.05;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TotalityProps {
  /** grid cell size in px */
  cellSize?: number;
  /** headline / CTA rendered over the field */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function Totality({
  cellSize = 13,
  children,
  className = "",
}: TotalityProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    let muted = "currentColor";
    let accent = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    let sunPx = 0;
    let sunPy = 0;
    let sunR = 0;
    let moonR = 0;
    let coronaW = 0;

    let starCol = new Float32Array(0);
    let starRow = new Float32Array(0);
    let starChar = new Uint8Array(0);
    let starPhase = new Float32Array(0);
    let starAlpha = new Float32Array(0);
    let starCount = 0;

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
      const cs = getComputedStyle(document.documentElement);
      muted = cs.getPropertyValue("--ns-muted").trim() || fg;
      accent = cs.getPropertyValue("--ns-accent").trim() || fg;
    };

    const measureCell = (fontFamily: string) => {
      const off = document.createElement("canvas");
      const octx = off.getContext("2d");
      if (!octx) return;
      octx.font = `${cellSize}px ${fontFamily}`;
      cellW = Math.max(4, octx.measureText("MMMMMMMMMM").width / 10);
      cellH = cellSize;
    };

    const buildStars = () => {
      const w = cols * cellW;
      const h = rows * cellH;
      const rand = mulberry32(0x0ec11950 ^ (cols * 71 + rows));
      starCount = Math.min(260, Math.max(0, Math.floor(cols * rows * 0.045)));
      starCol = new Float32Array(starCount);
      starRow = new Float32Array(starCount);
      starChar = new Uint8Array(starCount);
      starPhase = new Float32Array(starCount);
      starAlpha = new Float32Array(starCount);
      for (let i = 0; i < starCount; i++) {
        starCol[i] = rand() * w;
        starRow[i] = rand() * h;
        starChar[i] = STAR_CHARS[Math.floor(rand() * STAR_CHARS.length)]!;
        starPhase[i] = rand() * Math.PI * 2;
        starAlpha[i] = 0.25 + rand() * 0.45;
      }
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

      cols = Math.max(8, Math.ceil(width / cellW));
      rows = Math.max(8, Math.ceil(height / cellH));

      sunPx = cols * cellW * 0.5;
      sunPy = rows * cellH * 0.42;
      sunR = Math.min(cols * cellW, rows * cellH) * 0.15;
      moonR = sunR * 1.04;
      coronaW = sunR * 0.65;

      buildStars();
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(0, sunPx - moonR * 2.4, sunPy);
      }, 150);
    };

    const draw = (t: number, moonPx: number, moonPy: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);

      const centerDist = Math.hypot(moonPx - sunPx, moonPy - sunPy);
      const coronaIntensity = Math.pow(
        Math.max(0, 1 - centerDist / (sunR * 0.85)),
        2
      );

      // -- starfield: sparse breathing background, drawn first ---------------
      ctx.fillStyle = muted;
      for (let i = 0; i < starCount; i++) {
        const dm = Math.hypot(starCol[i]! - moonPx, starRow[i]! - moonPy);
        if (dm <= moonR) continue; // occluded by the moon
        const twinkle = 0.6 + 0.4 * Math.sin(t * 0.6 + starPhase[i]!);
        ctx.globalAlpha = starAlpha[i]! * twinkle;
        ctx.fillText(RAMP[starChar[i]!]!, starCol[i]!, starRow[i]!);
      }

      // -- sun + corona + moon occlusion, one pass over a coarse cell grid ---
      const outerR = sunR + coronaW;
      for (let gy = 0; gy < rows; gy++) {
        const py = gy * cellH + cellH / 2;
        for (let gx = 0; gx < cols; gx++) {
          const px = gx * cellW + cellW / 2;

          const dMoon = Math.hypot(px - moonPx, py - moonPy);
          if (dMoon <= moonR) continue; // the moon occludes everything, always

          const dSun = Math.hypot(px - sunPx, py - sunPy);
          if (dSun <= sunR) {
            const lum = 1 - (dSun / sunR) * 0.55;
            const ci = Math.max(1, Math.floor(lum * (RAMP.length - 1)));
            ctx.fillStyle = fg;
            ctx.globalAlpha = 0.55 + lum * 0.45;
            ctx.fillText(RAMP[ci]!, px, py);
            continue;
          }

          if (dSun <= outerR && coronaIntensity > 0.02) {
            const radial = 1 - (dSun - sunR) / coronaW;
            const angle = Math.atan2(py - sunPy, px - sunPx);
            const streamer = 0.55 + 0.45 * Math.sin(angle * 7 + t * 1.4);
            const lum = radial * streamer * coronaIntensity;
            if (lum > 0.05) {
              const ci = Math.max(1, Math.floor(lum * (RAMP.length - 1)));
              ctx.fillStyle = accent;
              ctx.globalAlpha = Math.min(1, lum);
              ctx.fillText(RAMP[ci]!, px, py);
            }
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    const cursor = { has: false, tx: 0, ty: 0, x: 0, y: 0 };

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;

      let moonPx: number;
      let moonPy: number;
      if (cursor.has) {
        cursor.x += (cursor.tx - cursor.x) * CURSOR_EASE;
        cursor.y += (cursor.ty - cursor.y) * CURSOR_EASE;
        moonPx = cursor.x;
        moonPy = cursor.y;
      } else {
        // idle transit: a slow sweep back and forth through the sun
        const phase = (t / IDLE_PERIOD) % 1;
        const sweep = Math.sin(phase * Math.PI * 2);
        moonPx = sunPx + sweep * moonR * 2.6;
        moonPy = sunPy + Math.sin(phase * Math.PI * 4) * moonR * 0.35;
        cursor.x = moonPx;
        cursor.y = moonPy;
      }

      draw(t, moonPx, moonPy);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      cursor.tx = e.clientX - rect.left;
      cursor.ty = e.clientY - rect.top;
      cursor.has = true;
    };
    const onPointerLeave = () => {
      cursor.has = false;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(0, sunPx - moonR * 2.4, sunPy);
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
        // static frame: moon well clear of the sun, an ordinary partial
        // transit moment, corona at rest (near zero)
        draw(0, sunPx - moonR * 2.4, sunPy);
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
      window.removeEventListener("resize", onResize);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [cellSize]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate w-full overflow-hidden bg-background font-mono ${
        /\bmin-h-/.test(className) ? "" : "min-h-screen"
      } ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 block h-full w-full text-foreground"
      />
      {children ? (
        <div className="relative z-10 flex h-full w-full flex-col items-start justify-end gap-4 p-8 sm:p-14">
          {children}
        </div>
      ) : null}
    </div>
  );
}
