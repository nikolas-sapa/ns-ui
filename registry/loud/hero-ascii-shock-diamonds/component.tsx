"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// ShockTrain — a full-bleed ASCII hero of a supersonic exhaust plume. This is
// gas dynamics, not a pattern: an underexpanded jet leaving a nozzle turns
// through a fan, over-expands, and is turned back by an OBLIQUE SHOCK that
// leaves the nozzle lip at the Mach angle mu = asin(1/M). That shock reflects
// specularly off the free jet boundary, crosses its mirror image from the
// opposite lip, and the whole thing repeats — a shock CELL — every
// L = 1.30 * D * sqrt(M^2 - 1) (Prandtl-Pack). Two travelling families is all
// it takes: p1 = a + b and p2 = a - b, where a is downstream distance in cells
// and b is transverse distance in cells; a cell is ON a shock when either
// phase lands near an integer. Where BOTH land near an integer the two
// families cross, and that crossing is the diamond node — it is inked 1.9x
// harder, which is the whole reason the frame reads as a string of bright X's
// on the centreline rather than a diagonal hatch. Everything else is blank:
// the shocks are hard-masked to the plume's own waisted envelope, and the
// plume's interior between shocks is empty. The pointer is the THROTTLE — its
// x position sets the nozzle pressure ratio, M is re-solved from it
// isentropically, and since L scales with sqrt(M^2 - 1) the diamonds visibly
// stretch apart to the right and compress to the left. Pointer y vectors the
// jet axis. Both ease back to the design plume when the pointer leaves.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";
const ALPHA_BUCKETS = 6;
const SHOCK_TOL = 0.035; // phase half-width of a shock, in cell lengths
const SHOCK_POW = 1.6; // line profile sharpness
const NODE_GAIN = 1.9; // crossing multiplier — makes the X's the picture
const INK_DECAY = 3.4; // shock strength e-folding, in cell lengths
const ENV_DECAY = 3.1; // plume envelope e-folding, in cell lengths
const PLUME_END = 6.0; // stop evaluating past this many cells
const THROTTLE_TAU = 0.6; // s — pointer easing time constant
const PULSE_A = 0.018; // resting breath in cell spacing
const PULSE_B = 0.008;
const CELLS_ACROSS = 4.4; // design: shock cells that fit the frame at rest
const DT_MAX = 0.05;

/** isentropic (gamma 1.4) Mach number from a nozzle pressure ratio */
function machFromNpr(npr: number): number {
  const m2 = 5 * (Math.pow(Math.max(1.0001, npr), 0.2857) - 1);
  return Math.max(1.05, Math.sqrt(Math.max(0.1025, m2)));
}

/** nozzle pressure ratio that produces this design Mach number */
function nprFromMach(m: number): number {
  return Math.pow(1 + 0.2 * m * m, 3.5);
}

/** distance from p to the nearest integer, in [0, 0.5] */
function phaseDist(p: number): number {
  const f = p - Math.floor(p);
  return f < 0.5 ? f : 1 - f;
}

export interface ShockTrainProps {
  /** grid cell size in px */
  cellSize?: number;
  /** design Mach number of the plume at rest */
  mach?: number;
  /** headline / CTA rendered over the plume */
  children?: ReactNode;
  className?: string;
}

export function ShockTrain({
  cellSize = 12,
  mach = 2.4,
  children,
  className = "",
}: ShockTrainProps) {
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

    const machDesign = Math.min(4.5, Math.max(1.2, mach));
    const nprDesign = nprFromMach(machDesign);
    const nprMin = nprDesign * 0.41;
    const nprMax = nprDesign * 2.05;

    let fg = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    let nozzleX = 0; // x0 — nozzle exit plane
    let axisY = 0; // yc at rest — the undeflected jet axis
    let nozzleD = 0; // D — nozzle exit diameter
    let vectorMax = 0; // px of thrust-vector travel

    let charBuf = new Uint8Array(0);
    const bucketLists: number[][] = Array.from(
      { length: ALPHA_BUCKETS },
      () => []
    );

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

      cols = Math.max(8, Math.ceil(width / cellW));
      rows = Math.max(8, Math.ceil(height / cellH));

      const w = cols * cellW;
      const h = rows * cellH;
      nozzleX = w * 0.1;
      // the jet axis is snapped to a ROW CENTRE: the on-axis diamond node sits
      // exactly at y = yc, and if that lands between two rows the brightest
      // cell in the whole picture is never sampled and the train degrades into
      // a chevron hatch. Snapping is what keeps the X's on the centreline.
      axisY = Math.round((h * 0.5 - cellH / 2) / cellH) * cellH + cellH / 2;
      vectorMax = h * 0.06;
      // D is the one free geometric parameter: pick it so that at the DESIGN
      // Mach number the Prandtl-Pack cell length lays ~4.4 shock cells across
      // the frame (five to six visible crossings counting the lip). Capped at
      // 0.20*H so a very wide frame never blows the plume out of the viewport.
      // Pinned to machDesign, never the live Mach — D is the hardware, and it
      // is precisely because D is fixed that a throttle change moves L.
      const kDesign = 1.3 * Math.sqrt(machDesign * machDesign - 1);
      nozzleD = Math.min(
        h * 0.2,
        ((w - nozzleX) * 0.98) / (CELLS_ACROSS * kDesign)
      );
      nozzleD = Math.max(nozzleD, cellH * 3.2);

      charBuf = new Uint8Array(cols * rows);
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(0, machDesign, 0);
      }, 150);
    };

    const draw = (t: number, machEff: number, vectorY: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);
      for (let b = 0; b < ALPHA_BUCKETS; b++) bucketLists[b]!.length = 0;

      const M = Math.max(1.05, machEff);
      // Prandtl-Pack shock-cell length, and the Mach angle the lip shock
      // leaves at. Both move together when the throttle moves.
      const L = 1.3 * nozzleD * Math.sqrt(M * M - 1);
      const tanMu = Math.tan(Math.asin(1 / M));
      const invBand = 1 / (L * tanMu);
      // thrust vectoring moves the axis in whole rows, so the node stays on a
      // row centre wherever it is aimed
      const yc = axisY + Math.round(vectorY / cellH) * cellH;
      const rMax = 0.5 * nozzleD * 1.55;
      const envHalf = cellH * 0.55;
      const tau = Math.PI * 2;

      // A shock is 0.035 cell-lengths of phase wide, which on this grid is
      // thinner than one row — sampled naively the line falls between cells and
      // breaks into dashes. Dilate the hit test to at least one cell while
      // keeping the physical 0.035 profile: everything inside the dilation is
      // full-strength line, and the original profile fades over the last
      // 0.035. Conservative rasterization, not a fattened shock.
      const gradMag = Math.hypot(1 / L, invBand);
      const tol = Math.max(SHOCK_TOL, 0.62 * cellH * gradMag);
      const dilate = tol - SHOCK_TOL;
      const profile = (d: number) => {
        const de = d <= dilate ? 0 : d - dilate;
        return Math.pow(Math.max(0, 1 - de / SHOCK_TOL), SHOCK_POW);
      };

      for (let gy = 0; gy < rows; gy++) {
        const py = gy * cellH + cellH / 2;
        const dy = py - yc;
        const ady = dy < 0 ? -dy : dy;
        if (ady > rMax + envHalf) continue; // outside the widest bulge: blank
        const rowBase = gy * cols;

        for (let gx = 0; gx < cols; gx++) {
          const px = gx * cellW + cellW / 2;
          const a = (px - nozzleX) / L; // downstream distance, in shock cells
          if (a < 0 || a > PLUME_END) continue;

          // free-boundary envelope: the periodic bulge/waist of an
          // underexpanded jet, dying out downstream
          const r =
            0.5 *
            nozzleD *
            (1 + 0.55 * Math.sin(tau * a + Math.PI / 2)) *
            Math.exp(-a / ENV_DECAY);

          if (ady > r) {
            // faint trace of the jet boundary itself — the waisted envelope
            if (ady - r < envHalf) {
              const idx = rowBase + gx;
              charBuf[idx] = 1;
              bucketLists[0]!.push(idx);
            }
            continue;
          }

          // the two travelling shock families, as phase coordinates
          const b = dy * invBand;
          const d1 = phaseDist(a + b);
          const d2 = phaseDist(a - b);
          const on1 = d1 < tol;
          const on2 = d2 < tol;
          if (!on1 && !on2) continue; // plume interior between shocks: blank

          let s = 0;
          if (on1) s = profile(d1);
          if (on2) {
            const s2 = profile(d2);
            if (s2 > s) s = s2;
          }
          // both families here — this is the diamond node
          if (on1 && on2) s = Math.min(1, s * NODE_GAIN);
          s *= Math.exp(-a / INK_DECAY);
          if (s <= 0.04) continue;

          const ci = Math.max(1, Math.floor(s * (RAMP.length - 1)));
          const bucket = Math.min(
            ALPHA_BUCKETS - 1,
            Math.floor(s * ALPHA_BUCKETS)
          );
          const idx = rowBase + gx;
          charBuf[idx] = ci;
          bucketLists[bucket]!.push(idx);
        }
      }

      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const list = bucketLists[b]!;
        if (list.length === 0) continue;
        ctx.globalAlpha = 0.1 + (b / (ALPHA_BUCKETS - 1)) * 0.9;
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
    let npr = nprDesign; // eased nozzle pressure ratio — the throttle
    let nprTarget = nprDesign;
    let vector = 0; // eased thrust-vector offset in px
    let vectorTarget = 0;

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;

      const k = Math.min(1, dt / THROTTLE_TAU);
      npr += (nprTarget - npr) * k;
      vector += (vectorTarget - vector) * k;

      // resting breath: a small jitter in cell spacing, never a scroll
      const machEff =
        machFromNpr(npr) *
        (1 + PULSE_A * Math.sin(t * 0.85) + PULSE_B * Math.sin(t * 2.3));

      draw(t, machEff, vector);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const fx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      nprTarget = nprMin + fx * (nprMax - nprMin);
      const fy = (e.clientY - rect.top - rect.height / 2) / (rect.height * 0.25);
      vectorTarget = Math.min(1, Math.max(-1, fy)) * vectorMax;
    };
    const onPointerLeave = () => {
      nprTarget = nprDesign;
      vectorTarget = 0;
    };

    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(0, machDesign, 0);
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
        draw(0, machDesign, 0);
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
  }, [cellSize, mach]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background font-mono ${
        /\bmin-h-/.test(className) ? "" : "min-h-screen"
      } ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 block h-full w-full text-foreground"
      />
      {children ? (
        <div className="absolute inset-0 z-10 flex flex-col items-start justify-end gap-4 p-8 sm:p-14">
          {children}
        </div>
      ) : null}
    </div>
  );
}
