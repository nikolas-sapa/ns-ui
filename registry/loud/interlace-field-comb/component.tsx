"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// InterlaceFieldComb — a full-bleed background reproducing analog interlaced
// video's defining artifact: combing. Interlaced NTSC/PAL video draws a frame
// as two temporally-offset fields — odd scanlines, then even scanlines, each
// a separate instant. A still frame "weaves" the two fields into one clean
// picture; anything that moved BETWEEN the two field captures makes the odd
// and even rows disagree on where an edge sits, and a diagonal edge serrates
// into a visible horizontal comb. That is the mechanic here: content is drawn
// twice, once per field, with a small relative horizontal offset between the
// two draws that grows and shrinks over time, and the composite interleaves
// real device-pixel rows from each field's render — not a filter simulating
// the look, an actual two-buffer interleave.
//
// This is deliberately distinct from two already-shipped CRT artifacts on
// this registry: flyback-tear is signal/sync LOSS (rolling hold, tear bursts,
// dropout, snow) and rolling-shutter-skew is a CMOS sensor's per-row READOUT
// skew. Combing is neither — it is two co-owned, temporally offset scanline
// sets disagreeing on a moving edge, which only reads correctly when the two
// fields are genuinely composited from separate renders, not derived from one
// buffer with a wobble applied.
//
// DECOUPLING (round 9 note): a real interlaced field rate sits near 50-60Hz,
// which would alias against the page's own 60Hz paint and read as a glitch,
// not as interlacing. So the divergence between fields is driven by a slow,
// deliberately visualized 4.0s cycle instead of any real field rate — see
// PERIOD below — and the field-pair render itself is throttled well under
// 60Hz (DRAW_HZ) so the two-buffer interleave cost stays cheap.
//
// CONTENT: three long, soft-edged diagonal bands (getting their softness from
// ctx.filter blur on a plain rotated fillRect, the same technique already
// used by ring-graze/agar-starve in this registry) drifting slowly and
// wrapping. Diagonal, not horizontal, on purpose — a horizontal edge sitting
// exactly on a scanline boundary would show no comb at all; the bands need a
// real diagonal so a horizontal misalignment between fields visibly staggers
// their edges into steps.
//
// SUBSTRATE: 2D canvas. Two off-DOM canvases hold one field's render each;
// the composite interleaves their pixel rows in groups of PITCH device rows
// (derived from the container's smaller dimension) via ImageData.set() row
// copies, then a single putImageData onto the visible canvas. No WebGL.
// ---------------------------------------------------------------------------

interface Band {
  angleDeg: number; // direction the band's LENGTH runs
  thicknessFrac: number; // of min(W, H)
  speedMul: number; // multiplier on DRIFT_SPEED, travel perpendicular to length
  phaseFrac: number; // 0..1, initial position along the wrap range
  tone: "fg" | "muted";
  alpha: number;
}

const BANDS: Band[] = [
  { angleDeg: 24, thicknessFrac: 0.16, speedMul: 1, phaseFrac: 0.1, tone: "fg", alpha: 0.5 },
  { angleDeg: -16, thicknessFrac: 0.11, speedMul: 0.7, phaseFrac: 0.55, tone: "muted", alpha: 0.42 },
  { angleDeg: 38, thicknessFrac: 0.08, speedMul: 1.3, phaseFrac: 0.82, tone: "fg", alpha: 0.3 },
];

const DRIFT_SPEED = 6; // css px/s, perpendicular travel of each band
const PERIOD = 4.0; // s — the re-weave cycle: divergence returns to ~0 every PERIOD
const DRAW_HZ = 30; // the field-pair render + interleave is throttled to this, not 60Hz
const DRAW_INTERVAL_MS = 1000 / DRAW_HZ;

// The one instant the two fields fully agree — divergence(t) hits exactly 0
// at t = PERIOD / 2 with the phase chosen below (max divergence sits at t=0
// instead, matching the resting loop's t0 read). This is also the most
// structured frame: the underlying bands are visible with zero comb, which
// reduced-motion freezes on rather than the mid-divergence t=0 state.
const STATIC_TIME = PERIOD / 2;

function divergencePx(t: number, maxOffset: number): number {
  return (maxOffset * (1 + Math.cos((2 * Math.PI * t) / PERIOD))) / 2;
}

function drawField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  xOffset: number,
  fg: string,
  muted: string
) {
  ctx.clearRect(0, 0, w, h);
  const diag = Math.hypot(w, h);
  const minDim = Math.min(w, h);
  for (const b of BANDS) {
    const wrapRange = diag * 1.3;
    const travel = ((t * DRIFT_SPEED * b.speedMul + b.phaseFrac * wrapRange) % wrapRange + wrapRange) % wrapRange;
    const pos = travel - diag * 0.15;
    const angle = (b.angleDeg * Math.PI) / 180;
    // perpendicular unit vector — this is the axis the band travels along
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);
    const cx = w / 2 + perpX * (pos - diag / 2) + xOffset;
    const cy = h / 2 + perpY * (pos - diag / 2);
    const thickness = b.thicknessFrac * minDim;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.filter = `blur(${(thickness * 0.55).toFixed(1)}px)`;
    ctx.fillStyle = b.tone === "fg" ? fg : muted;
    ctx.globalAlpha = b.alpha;
    ctx.fillRect(-diag * 0.7, -thickness / 2, diag * 1.4, thickness);
    ctx.restore();
  }
  ctx.filter = "none";
  ctx.globalAlpha = 1;
}

export interface InterlaceFieldCombProps {
  /** headline / CTA rendered over the field */
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function InterlaceFieldComb({ children, className = "", style }: InterlaceFieldCombProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const oddCanvas = document.createElement("canvas");
    const evenCanvas = document.createElement("canvas");
    const oddCtx = oddCanvas.getContext("2d", { willReadFrequently: true });
    const evenCtx = evenCanvas.getContext("2d", { willReadFrequently: true });
    if (!oddCtx || !evenCtx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // token fields start empty; nothing paints until readTokens() has run —
    // guarded in draw() below, closing every path (rAF, resize, the reduced
    // branch) that could otherwise paint a literal.
    let fgColor = "";
    let mutedColor = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fgColor = cs.getPropertyValue("--foreground").trim();
      mutedColor = cs.getPropertyValue("--ns-muted").trim();
    };

    let w = 0;
    let h = 0;
    let dpr = 1;
    let pitchDev = 1; // device rows per field line
    let maxOffsetCss = 1;
    let sized = false;
    let visible = true;
    let raf = 0;
    let t = reduced ? STATIC_TIME : 0;
    let last = 0;
    let lastDrawMs = -Infinity;
    let composite: ImageData | null = null;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const pw = Math.max(1, Math.round(w * dpr));
      const ph = Math.max(1, Math.round(h * dpr));
      canvas.width = pw;
      canvas.height = ph;
      oddCanvas.width = pw;
      oddCanvas.height = ph;
      evenCanvas.width = pw;
      evenCanvas.height = ph;
      oddCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      evenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const minDim = Math.min(w, h);
      const pitchCss = Math.max(1, Math.min(3, Math.round(minDim / 260)));
      pitchDev = Math.max(1, Math.round(pitchCss * dpr));
      maxOffsetCss = pitchCss * 2;
      composite = new ImageData(pw, ph);
      sized = true;
      lastDrawMs = -Infinity; // force an immediate redraw at the new size
    };

    const draw = () => {
      if (!sized || !fgColor || !composite) return;
      const pw = canvas.width;
      const ph = canvas.height;
      const div = divergencePx(t, maxOffsetCss);
      drawField(oddCtx, w, h, t, div / 2, fgColor, mutedColor);
      drawField(evenCtx, w, h, t, -div / 2, fgColor, mutedColor);
      const oddData = oddCtx.getImageData(0, 0, pw, ph).data;
      const evenData = evenCtx.getImageData(0, 0, pw, ph).data;
      const out = composite.data;
      const rowBytes = pw * 4;
      for (let y = 0; y < ph; y++) {
        const scan = Math.floor(y / pitchDev);
        const src = scan % 2 === 0 ? oddData : evenData;
        const start = y * rowBytes;
        out.set(src.subarray(start, start + rowBytes), start);
      }
      ctx.putImageData(composite, 0, 0);
    };

    const loop = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      if (now - lastDrawMs >= DRAW_INTERVAL_MS) {
        lastDrawMs = now;
        draw();
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw();
      }, 120);
    });
    ro.observe(root);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && !reduced && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVis = () => {
      if (!document.hidden && visible && !reduced && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || !raf) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    readTokens();
    resize();

    if (reduced) {
      draw();
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative isolate min-h-screen w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 block h-full w-full" />
      {children ? (
        <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center gap-4 px-6 text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}

InterlaceFieldComb.displayName = "InterlaceFieldComb";
