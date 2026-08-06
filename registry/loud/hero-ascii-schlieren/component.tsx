"use client";

import { useEffect, useRef, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// SchlierenRig — a real schlieren bench rendered in ASCII ink.
//
// A schlieren photograph does not show air. It shows the DERIVATIVE of air:
// light passing through a refractive-index gradient is deflected, and a knife
// edge parked at the focal point clips exactly the deflected half. Uniform
// bulk air deflects nothing, lands dead-centre on the knife, and comes out a
// flat mid-grey — which is why a real schlieren frame is almost entirely
// empty, with only the steep density boundaries surviving as thin bright and
// dark bands.
//
// So: evaluate an analytic density field rho(x,y,t) (a buoyant plume of
// discrete puffs, plus a Kelvin-Helmholtz shear interface across the lower
// third), take its directional gradient on the glyph grid, and map that
// gradient through a HARD cut — ink only where the transmitted fraction
// departs far enough from the knife's mid-point. Everything inside that dead
// band draws nothing at all, which is ~90% of the frame.
//
// The pointer IS the knife, and it rotates. A knife edge only reveals
// gradients perpendicular to it, so turning it re-selects which family of
// boundaries is visible: sweep right and the plume's vertical flanks give way
// to its horizontal puff caps and the shear interface. That is the single
// most characteristic thing an operator does on a real bench.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";
const ALPHA_BUCKETS = 6;

const PLUME_WEIGHT = 0.55; // rho contribution of the buoyant column
const PLUME_X = 0.42; // fraction of W — the column's mean axis
const PLUME_SIGMA = 0.024; // fraction of W — gaussian half-width at the base
const PLUME_SPREAD = 1.2; // the column widens by this factor as it rises
const PUFF_K = 0.038; // rad/px — vertical wavenumber of the shed puff train
const PUFF_FLOOR = 0.5; // puffs MODULATE a standing column, never gate it off:
// at 0 the flanks break into detached dashes and the
// column stops reading as one continuous filament pair

const SHEAR_WEIGHT = 0.13; // rho contribution of the shear interface
const SHEAR_Y = 0.68; // fraction of H — interface sits across the lower third
const SHEAR_THICK = 0.02; // fraction of H — tanh transition thickness
const SHEAR_AMP = 0.035; // fraction of H — KH billow displacement amplitude

const KNIFE_SLOPE = 118; // px — gradient -> transmitted-fraction sensitivity
const DEAD_BAND = 0.24; // |s - 0.5| below this transmits nothing: blank cell
const LUM_SPAN = 0.5 - DEAD_BAND;
const REF_DIAG = Math.hypot(1440, 900); // gain was tuned at this field size
const LUM_POW = 0.85;
const DARK_SCALE = 0.45; // dark flank = same ink, less alpha. never a 2nd hue

const KNIFE_MAX = 0.55; // rad — full knife rotation either side of vertical
const KNIFE_TAU = 0.5; // s — knife rotation time constant
const DT_MAX = 0.05;
const STATIC_T = 1.8; // reduced-motion frozen frame

/**
 * Analytic density field. No advection sim — every cell is evaluated
 * independently and exactly, which is what keeps the gradient clean enough
 * for a hard knife cut to produce thin bands instead of noise.
 */
function density(
  x: number,
  y: number,
  t: number,
  w: number,
  h: number
): number {
  // -- buoyant plume: a meandering column of discrete puffs -----------------
  const axis = PLUME_X * w + 0.06 * w * Math.sin(y * 0.011 - t * 0.9);
  // canvas y grows downward, so (1 - y/h) grows upward: the column widens as
  // it rises, the way a real thermal entrains surrounding air
  const sigma = PLUME_SIGMA * w * (1 + PLUME_SPREAD * (1 - y / h));
  const dx = x - axis;
  const core = Math.exp(-(dx * dx) / (2 * sigma * sigma));
  // rectified puff train — buoyancy sheds discrete parcels, so the column
  // pulses in brightness up its length rather than reading as a smooth smear
  const raw = Math.sin(y * PUFF_K - t * 2.2);
  const rect = raw > 0 ? Math.pow(raw, 1.5) : 0;
  const puff = PUFF_FLOOR + (1 - PUFF_FLOOR) * rect;

  // -- Kelvin-Helmholtz shear interface across the lower third --------------
  // The billow DISPLACES the interface rather than scaling the tanh: scaling
  // it would ripple the far field too (tanh saturates to ±1 everywhere away
  // from the interface), wallpapering the whole frame with a gradient the
  // knife then transmits — the exact "uniform wash" failure this technique
  // exists to avoid. Displacing it leaves the bulk air perfectly flat, and
  // gives the interface the horizontal gradient component that is the only
  // reason a vertical knife can see a horizontal layer at all.
  const billow =
    Math.sin(x * 0.03 - t * 1.4) * (1 + 0.35 * Math.sin(x * 0.017 + t * 0.6));
  const yInterface = SHEAR_Y * h + SHEAR_AMP * h * billow;
  const shear = Math.tanh((y - yInterface) / (SHEAR_THICK * h));

  return 1.0 - PLUME_WEIGHT * core * puff - SHEAR_WEIGHT * shear;
}

export interface SchlierenRigProps {
  /** grid cell size in px */
  cellSize?: number;
  /** knife sensitivity — higher cuts more of the field into visible bands */
  gain?: number;
  /** optional hero content, rendered over the field */
  children?: ReactNode;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function SchlierenRig({
  cellSize = 12,
  gain = 1.0,
  children,
  className = "",
}: SchlierenRigProps) {
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
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let fieldW = 0;
    let fieldH = 0;
    let sized = false;
    let ready = false;
    let disposed = false;

    // rho is sampled once per node on a 1-cell-padded grid so the central
    // differences below are four array reads, not four field evaluations
    let rhoBuf = new Float32Array(0);
    let charBuf = new Uint8Array(0);
    const brightLists: number[][] = Array.from(
      { length: ALPHA_BUCKETS },
      () => []
    );
    const darkLists: number[][] = Array.from(
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fontFamily = getComputedStyle(canvas).fontFamily;
      measureCell(fontFamily);
      ctx.font = `${cellSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      fieldW = width;
      fieldH = height;
      cols = Math.max(4, Math.ceil(width / cellW));
      rows = Math.max(4, Math.ceil(height / cellH));
      rhoBuf = new Float32Array((cols + 2) * (rows + 2));
      charBuf = new Uint8Array(cols * rows);
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(STATIC_T, 0);
      }, 150);
    };

    const draw = (t: number, knife: number) => {
      if (!sized) return;
      ctx.clearRect(0, 0, cols * cellW, rows * cellH);

      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        brightLists[b]!.length = 0;
        darkLists[b]!.length = 0;
      }

      // -- pass 0: sample rho on the padded node grid ------------------------
      const stride = cols + 2;
      for (let gy = -1; gy <= rows; gy++) {
        const py = (gy + 0.5) * cellH;
        const rowOff = (gy + 1) * stride;
        for (let gx = -1; gx <= cols; gx++) {
          rhoBuf[rowOff + gx + 1] = density(
            (gx + 0.5) * cellW,
            py,
            t,
            fieldW,
            fieldH
          );
        }
      }

      // -- pass 1: knife cut -> ramp index + bucket --------------------------
      const ca = Math.cos(knife);
      const sa = Math.sin(knife);
      // Central differences are divided by the cell's own px size so the
      // result is a true per-px derivative: the glyph cell is ~7x12, and
      // differencing in cell units alone would make the knife 1.7x more
      // sensitive to vertical gradients than horizontal ones — a bias that
      // would show up as the field lighting unevenly as the knife rotates.
      const kx = (KNIFE_SLOPE * gain) / (2 * cellW);
      const ky = (KNIFE_SLOPE * gain) / (2 * cellH);
      // A bench's gain is set per shot: the plume's own width scales with the
      // field, so without this a narrow viewport's much steeper gradients
      // would clip every surviving cell to solid '@'.
      const fit = Math.hypot(fieldW, fieldH) / REF_DIAG;
      const gx0 = kx * fit;
      const gy0 = ky * fit;
      let i = 0;
      for (let gy = 0; gy < rows; gy++) {
        const c = (gy + 1) * stride + 1;
        for (let gx = 0; gx < cols; gx++, i++) {
          const n = c + gx;
          // central difference on the glyph grid — the deflection angle a ray
          // picks up crossing this cell
          const dRx = (rhoBuf[n + 1]! - rhoBuf[n - 1]!) * gx0;
          const dRy = (rhoBuf[n + stride]! - rhoBuf[n - stride]!) * gy0;
          // ...projected onto the knife's own axis. A knife only ever reveals
          // gradients perpendicular to its edge.
          const d = ca * dRx + sa * dRy;
          // fraction of the ray's cone the knife lets past. 0.5 = undeflected.
          let s = 0.5 + d;
          s = s < 0 ? 0 : s > 1 ? 1 : s;
          const dev = s - 0.5;
          const mag = dev < 0 ? -dev : dev;
          if (mag <= DEAD_BAND) {
            charBuf[i] = 0; // inside the dead band: the knife shows nothing
            continue;
          }
          const lum = Math.pow((mag - DEAD_BAND) / LUM_SPAN, LUM_POW);
          const ci = Math.floor(lum * (RAMP.length - 1));
          charBuf[i] = ci;
          if (ci === 0) continue;
          const bucket = Math.min(
            ALPHA_BUCKETS - 1,
            Math.floor(lum * ALPHA_BUCKETS)
          );
          (dev > 0 ? brightLists : darkLists)[bucket]!.push(i);
        }
      }

      // -- pass 2: one globalAlpha write per bucket --------------------------
      ctx.fillStyle = fg;
      for (let b = 0; b < ALPHA_BUCKETS; b++) {
        const alpha = 0.12 + (b / (ALPHA_BUCKETS - 1)) * 0.88;
        for (let pass = 0; pass < 2; pass++) {
          const list = pass === 0 ? brightLists[b]! : darkLists[b]!;
          if (list.length === 0) continue;
          ctx.globalAlpha = pass === 0 ? alpha : alpha * DARK_SCALE;
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
      }
      ctx.globalAlpha = 1;
    };

    // -- hot-path state -------------------------------------------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    let knife = 0;
    let knifeTarget = 0;

    const loop = (now: number) => {
      const dt = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      knife += (knifeTarget - knife) * Math.min(1, dt / KNIFE_TAU);
      draw(t, knife);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (rect.width < 2) return;
      const nx = (e.clientX - rect.left) / rect.width;
      knifeTarget = (Math.min(1, Math.max(0, nx)) * 2 - 1) * KNIFE_MAX;
    };
    const onPointerLeave = () => {
      knifeTarget = 0;
    };

    const onVis = () => {
      // a frame requested before the tab hid is still pending (rAF callbacks
      // don't run while hidden); scheduling another here without cancelling it
      // leaves two loops driving t, at double speed
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(STATIC_T, 0);
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
        draw(STATIC_T, 0);
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
  }, [cellSize, gain]);

  // `h-full` matters as much as the min-height: a min-height is only a floor,
  // and in a stretched grid item taller than it the canvas would stop partway
  // down and leave a band of dead background beneath the field.
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
        <div className="relative z-10 flex h-full w-full flex-col items-start justify-end gap-4 p-8 sm:p-14">
          {children}
        </div>
      ) : null}
    </div>
  );
}
