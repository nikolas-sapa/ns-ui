"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// SlumpMouldDrape — a content-reveal/settle moment built on kiln-slumping in
// warm glass work: a flat glass blank heated to its slumping range sags
// purely under gravity over a mould, the centre drooping first (least
// supported) while the drape spreads outward toward the rim as heat and time
// progress. It's a slow, staggered viscous deformation, never a snap or a
// bounce — the whole point is the visible LAG between the centre and the
// edges, not a uniformly eased reveal.
//
// The profile is a pure function of elapsed time: N=32 sample points, each
// following y_i(t) = mould(x_i) * (1 - exp(-(t - delay_i) / TAU)), where
// delay_i grows with distance from centre (0 at centre, DELAY_EDGE_S at the
// rim). No physics state carries frame to frame, which is what makes the
// reduced-motion freeze frame a single function call rather than a replay.
// ---------------------------------------------------------------------------

const N_POINTS = 32;
const DRAPE_S = 4.5; // flat -> fully conformed
const HOLD_S = 1.5; // fully slumped, motionless, exact conformity
const RESET_S = 0.4; // lifts back to flat (a fresh blank going into the kiln)
const CYCLE_S = DRAPE_S + HOLD_S + RESET_S; // 6.4s, repeats indefinitely
const TAU_S = 1.0;
const DELAY_EDGE_S = 1.8; // delay at the outermost sample point, 0 at centre
const MAX_DROOP_FRAC = 0.3; // of the container's smaller dimension
const STATIC_TIME_S = 2.5; // reduced-motion freeze: centre conformed, edges still lagging

function mouldDepth(x: number, depth: number): number {
  // shallow-bowl reference curve: 0 at both rims, depth at centre
  return (depth * (1 - Math.cos(2 * Math.PI * x))) / 2;
}

function delayAt(x: number): number {
  return DELAY_EDGE_S * (Math.abs(x - 0.5) / 0.5);
}

// the profile's y-offset (px, downward-positive) for sample x at drape-phase
// elapsed time; only valid while phaseT < DRAPE_S.
function draping(x: number, elapsed: number, depth: number): number {
  const delay = delayAt(x);
  if (elapsed <= delay) return 0;
  return mouldDepth(x, depth) * (1 - Math.exp(-(elapsed - delay) / TAU_S));
}

export interface SlumpMouldDrapeProps {
  /** ambient idle loop (drape -> hold -> reset -> repeat) vs. a one-shot
   * reveal that plays once and holds its settled state forever. @default true */
  loop?: boolean;
  className?: string;
}

export function SlumpMouldDrape({
  loop = true,
  className = "",
}: SlumpMouldDrapeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // -- token-derived ink, read at mount and re-derived on theme flip ------
    let fg = "rgb(237,237,237)";
    let border = "rgba(237,237,237,0.11)";
    let dark = true;
    const readTokens = () => {
      dark = document.documentElement.classList.contains("dark");
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim() || fg;
      border = cs.getPropertyValue("--border").trim() || border;
    };
    readTokens();

    // -- hot-path state: locals only, never React state ---------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let sized = false;
    let paused = false;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let baselineY = 0;
    let depth = 0;
    let lineWidth = 1.4;
    let mouldLineWidth = 1;

    const xAt = (i: number) => i / (N_POINTS - 1);

    // profile y-offset (downward-positive, px) for sample index i at a given
    // absolute elapsed time within one cycle (or clamped past the hold end
    // when !loop).
    const profileOffset = (i: number, phaseT: number) => {
      const x = xAt(i);
      if (phaseT < DRAPE_S) return draping(x, phaseT, depth);
      if (phaseT < DRAPE_S + HOLD_S) return mouldDepth(x, depth); // exact conformity
      const resetT = phaseT - DRAPE_S - HOLD_S;
      const frac = Math.min(1, resetT / RESET_S);
      const eased = frac * frac * (3 - 2 * frac); // smoothstep lift
      return mouldDepth(x, depth) * (1 - eased);
    };

    const drawPolyline = (getY: (i: number) => number, useCurve: boolean) => {
      ctx.beginPath();
      for (let i = 0; i < N_POINTS; i++) {
        const px = (xAt(i) * w);
        const py = getY(i);
        if (i === 0) {
          ctx.moveTo(px, py);
        } else if (useCurve) {
          const prevX = xAt(i - 1) * w;
          const prevY = getY(i - 1);
          const midX = (prevX + px) / 2;
          const midY = (prevY + py) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, midY);
        } else {
          ctx.lineTo(px, py);
        }
      }
      // finish the last curve segment to the final point
      if (useCurve) {
        ctx.lineTo(xAt(N_POINTS - 1) * w, getY(N_POINTS - 1));
      }
      ctx.stroke();
    };

    const draw = (phaseT: number) => {
      if (!sized) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // mould reference contour — a fixed, non-load-bearing target line the
      // profile drapes toward; --border only, never a fill or the "arrived"
      // signal itself (that's read from geometric conformity, not colour).
      ctx.strokeStyle = border;
      ctx.lineWidth = mouldLineWidth;
      ctx.globalAlpha = 1;
      drawPolyline((i) => baselineY + mouldDepth(xAt(i), depth), true);

      // glass profile
      ctx.strokeStyle = fg;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      drawPolyline((i) => baselineY + profileOffset(i, phaseT), true);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      const minDim = Math.min(w, h);
      depth = MAX_DROOP_FRAC * minDim;
      baselineY = h * 0.5 - depth * 0.5;
      lineWidth = Math.max(1.4, 0.007 * minDim);
      // light theme's --border reads at ~1.1:1 — a heavier stroke (same
      // token, not a different one) keeps the mould contour legible as a
      // target line rather than a different-weight rule change per theme.
      mouldLineWidth = Math.max(1, 0.0045 * minDim) * (dark ? 1 : 1.6);
      sized = true;
    };

    const renderStatic = () => {
      draw(STATIC_TIME_S);
    };

    let raf = 0;
    let start = 0;
    const loopFrame = (now: number) => {
      if (!start) start = now;
      const elapsed = (now - start) / 1000;
      const phaseT = loop
        ? elapsed % CYCLE_S
        : Math.min(elapsed, DRAPE_S + HOLD_S);
      draw(phaseT);
      if (!paused) raf = requestAnimationFrame(loopFrame);
    };

    const stopLoop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const startLoop = () => {
      stopLoop();
      if (paused || !sized) return;
      if (reduced) {
        renderStatic();
        return;
      }
      start = 0;
      raf = requestAnimationFrame(loopFrame);
    };

    resize();

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) renderStatic();
    });
    ro.observe(root);

    const onThemeChange = () => {
      readTokens();
      resize(); // mould stroke weight depends on the dark/light read above
      if (reduced) draw(STATIC_TIME_S);
    };
    const mo = new MutationObserver(onThemeChange);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", onThemeChange);

    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedChange = () => {
      reduced = reducedMq.matches;
      startLoop();
    };
    reducedMq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      paused = document.hidden;
      startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let io: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        paused = !entry.isIntersecting || document.hidden;
        startLoop();
      });
      io.observe(root);
    }

    startLoop();

    return () => {
      stopLoop();
      ro.disconnect();
      mo.disconnect();
      colorScheme.removeEventListener("change", onThemeChange);
      reducedMq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
    };
  }, [loop]);

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
    </div>
  );
}
