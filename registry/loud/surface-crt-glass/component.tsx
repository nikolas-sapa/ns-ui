"use client";

import { useLayoutEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// SurfaceCrtGlass — a curved-glass treatment for a real product surface
// (pricing card, hero panel, terminal block): the wrapper's own children
// render as ordinary DOM, and a canvas overlay on top draws the glass — a
// barrel-mapped scanline grid, a rolling brightness bar, a drifting specular
// sheen and a background-toned vignette — everything a curved CRT face would
// show sitting in front of a picture, without ever touching the picture.
//
// IMPLEMENTATION ROUTE, stated plainly: this does NOT rasterize children to
// a texture and warp that texture through a shader. There is no reliable
// dependency-free way to sample arbitrary live DOM into a canvas (an
// html2canvas-style rasterizer is exactly the dependency + fragility this
// repo avoids), and doing so would also destroy the one property that
// matters most here — real, selectable, focusable, screen-reader-ordered
// content. Instead: children stay in normal DOM flow, completely untouched,
// and every "glass" cue lives in a `pointer-events-none aria-hidden` canvas
// layered on top. The barrel/pincushion curvature is REAL, literal geometry
// — the scanline grid's own row spacing is warped through a cubic pincushion
// map, so lines visibly compress toward the top/bottom edges the way a
// convex tube's raster does — but it is curvature of the GLASS TEXTURE, not
// of the letterforms under it. "Phosphor bleed" is likewise honest about its
// scope: shadowBlur is applied to the overlay's own light sources (the
// rolling bar, the specular sheen), giving them a soft glow the way a real
// phosphor would, but no blur ever touches the real content pixels — an
// html2canvas-based true-texture-warp route was considered and rejected for
// exactly that reason. State this plainly wherever this component is
// described: it approximates curved glass in front of content, it does not
// physically warp the content itself.
//
// Tokens via getComputedStyle + a MutationObserver on documentElement's
// class (house idiom, duplicated per-component by contract — no shared
// lib). One rAF loop, paused on IntersectionObserver + visibilitychange.
// ---------------------------------------------------------------------------

export interface SurfaceCrtGlassProps {
  /** wrapped content — rendered as real, untouched DOM under the glass overlay */
  children: React.ReactNode;
  /** 0..1, how strongly the scanline grid bows toward the edges. default 0.5 */
  curvature?: number;
  /** peak alpha of the scanline grid itself. default 0.06 — deliberately low, this sits over real copy */
  scanlineOpacity?: number;
  /** draws a --border bezel ring around the glass. default true */
  bezel?: boolean;
  /** extra classes merged onto the outer wrapper */
  className?: string;
}

// reduced-motion / paused freeze frame: not t=0. At 3.1s the rolling bar
// sits mid-height (clear of both the vignette-heavy top and bottom edges),
// the dash-jitter phase is mid-cycle rather than aligned to a seam, and the
// specular sheen has already drifted off its start position — the most
// "already alive" static frame the loop passes through, not a degenerate
// edge-of-cycle one.
const STATIC_TIME = 3.1;

const ROLL_PERIOD = 9; // s, one full top-to-bottom pass of the rolling bar
const SHEEN_PERIOD = 41; // s, slow ambient drift of the specular highlight
const JITTER_HZ = 0.9; // rad/s-ish rate of the per-row dash-offset wobble

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function SurfaceCrtGlass({
  children,
  curvature = 0.5,
  scanlineOpacity = 0.06,
  bezel = true,
  className = "",
}: SurfaceCrtGlassProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const curveAmt = clamp(curvature, 0, 1) * 0.22 + 0.06; // 0.06..0.28, keeps the pincushion map monotonic

    // token fields start empty and are assigned unconditionally from
    // getComputedStyle below, before anything paints — no fallback literal.
    let bg = "";
    let fg = "";

    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    let minSide = 0;

    const readTokens = () => {
      const s = getComputedStyle(document.documentElement);
      bg = s.getPropertyValue("--background").trim();
      fg = s.getPropertyValue("--foreground").trim();
    };

    // barrel/pincushion row map: equal steps in normalized v (-1..1) land
    // unevenly in y, compressing toward the top/bottom edges — real
    // geometry of the scanline grid, not a filter over it.
    const rowY = (vNorm: number) => {
      const v2 = vNorm - curveAmt * vNorm ** 3;
      return ((v2 + 1) / 2) * h;
    };

    const draw = (t: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const diag = Math.hypot(w, h);

      // 1. vignette — background-toned falloff toward the corners, so the
      // edges recede into the panel's own token color in both themes
      // rather than a hue or a foreground wash.
      const vignette = ctx.createRadialGradient(cx, cy, diag * 0.18, cx, cy, diag * 0.62);
      // zero-alpha stop uses the "transparent" keyword rather than hex+alpha
      // math on the token string — tokens may be 3- or 6-digit hex, and
      // appending an alpha suffix to a 3-digit hex is invalid CSS.
      vignette.addColorStop(0, "transparent");
      vignette.addColorStop(1, bg);
      ctx.save();
      ctx.globalAlpha = 0.1 + curveAmt * 0.55;
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // 2. scanline grid, barrel-mapped row spacing + per-row dash jitter.
      const pitchTarget = clamp(minSide / 70, 2.2, 5);
      const rows = Math.max(8, Math.round(h / pitchTarget));
      const jitterAmp = clamp(minSide * 0.004, 0.4, 1.6);
      ctx.save();
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1;
      for (let i = 0; i < rows; i++) {
        const vNorm = (i / (rows - 1)) * 2 - 1;
        const y = Math.round(rowY(vNorm)) + 0.5;
        const rowSeed = i * 12.9898;
        const phase = Math.sin(rowSeed) * Math.PI * 2;
        const offsetX = jitterAmp * Math.sin(t * JITTER_HZ + phase) + i * 2.3;
        const dash = pitchTarget * 2.4;
        const gap = pitchTarget * 1.3;
        ctx.setLineDash([dash, gap]);
        ctx.lineDashOffset = offsetX;
        // slight per-row brightness variation so the grid reads as
        // structure, not a uniform screen-door overlay.
        const rowBright = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(rowSeed * 1.7));
        ctx.globalAlpha = scanlineOpacity * rowBright;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();

      // 3. rolling brightness bar — continuous top-to-bottom pass, soft
      // phosphor-style bleed via shadowBlur on the bar itself only, never
      // on real content.
      const rollFrac = (t % ROLL_PERIOD) / ROLL_PERIOD;
      const rollY = rollFrac * h;
      const rollHeight = Math.max(6, minSide * 0.05);
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.shadowColor = fg;
      ctx.shadowBlur = rollHeight * 1.4;
      const rollGrad = ctx.createLinearGradient(0, rollY - rollHeight, 0, rollY + rollHeight);
      rollGrad.addColorStop(0, "transparent");
      rollGrad.addColorStop(0.5, fg);
      rollGrad.addColorStop(1, "transparent");
      ctx.fillStyle = rollGrad;
      ctx.fillRect(0, rollY - rollHeight, w, rollHeight * 2);
      ctx.restore();

      // 4. specular sheen — a slow-drifting soft highlight suggesting a
      // convex reflective face; blurred so it reads as glass light, not a
      // hard shape.
      const sheenT = (t % SHEEN_PERIOD) / SHEEN_PERIOD;
      const sheenX = w * (0.22 + 0.18 * Math.sin(sheenT * Math.PI * 2));
      const sheenY = h * (0.16 + 0.1 * Math.cos(sheenT * Math.PI * 2));
      const sheenR = diag * 0.28;
      const sheen = ctx.createRadialGradient(sheenX, sheenY, 0, sheenX, sheenY, sheenR);
      sheen.addColorStop(0, fg);
      sheen.addColorStop(1, "transparent");
      ctx.save();
      ctx.globalAlpha = 0.05;
      ctx.shadowColor = fg;
      ctx.shadowBlur = sheenR * 0.4;
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      minSide = Math.min(w, h);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        resize();
        if (reduced) draw(STATIC_TIME);
      });
      ro.observe(host);
    }

    let raf = 0;
    let onScreen = true;
    let staticMode = reduced;

    const loop = (now: number) => {
      draw(now / 1000);
      if (onScreen && !document.hidden && !staticMode) {
        raf = requestAnimationFrame(loop);
      }
    };

    const wake = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
    const sleep = () => cancelAnimationFrame(raf);

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          onScreen = entries.some((e) => e.isIntersecting);
          if (!onScreen) sleep();
          else if (!staticMode && !document.hidden) wake();
        },
        { threshold: 0 }
      );
      io.observe(host);
    }

    const onVis = () => {
      if (document.hidden) sleep();
      else if (!staticMode && onScreen) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      draw(staticMode ? STATIC_TIME : performance.now() / 1000);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    readTokens();
    resize();
    if (staticMode) {
      // prefers-reduced-motion: no jitter, no rolling bar, no sheen drift —
      // a single draw at STATIC_TIME with curvature, scanlines and vignette
      // still fully legible, then no rAF at all.
      draw(STATIC_TIME);
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [curvature, scanlineOpacity]);

  return (
    <div
      ref={hostRef}
      className={`relative isolate overflow-hidden rounded-lg ${bezel ? "border border-border" : ""} ${className}`}
    >
      {children}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 block h-full w-full"
      />
    </div>
  );
}
