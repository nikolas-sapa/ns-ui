"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// ScreenFloodStroke — a loader / ambient "something is being produced"
// affordance modelled on the real screen-printing flood/print stroke cycle,
// not a percentage bar. A squeegee makes two passes per cycle across a
// printing mesh: a FLOOD stroke (light pressure, left->right) that spreads
// ink evenly across the mesh weave without forcing it through, then a PRINT
// stroke (firm pressure, blade angled ~18deg from vertical, right->left)
// that forces ink through the mesh openings the blade has already crossed
// and deposits a real impression on the substrate underneath. The two
// passes are deliberately drawn with different weight and different effect
// on the surface (a transient low-alpha wash during flood vs a persistent
// high-alpha deposit during print) so the two-stroke mechanic stays legible
// rather than reading as one generic wipe.
//
// The mesh fabric itself is a fixed low-alpha grid, always visible under
// whatever ink sits on top of it — screen pitch is derived from the
// canvas's own smaller dimension via ResizeObserver, finer than the ink
// grain since it represents woven mesh, not a printed dot.
//
// Ink-through is a persistent per-cell field, not a redraw-from-scratch
// wash: an opening the print stroke has just crossed jumps straight to the
// alpha cap (0.9 of --foreground), then decays exponentially (tau = 2.4s)
// toward a floor of 0.2 between impressions — residual staining that never
// reaches 0, so a resting card always shows the ghost of at least one prior
// impression plus whatever the current stroke is doing. That is what keeps
// the loop visibly different at t0 / 2.5s / 5s: t0 catches a bare flood
// pass with no fresh deposit yet, 2.5s shows one impression mid-fade under
// a new flood pass, and 5s stacks two ghosts of different ages under the
// live stroke.
// ---------------------------------------------------------------------------

export interface ScreenFloodStrokeProps {
  /** Optional 0-1 determinate progress. When set, ink only takes on
   * openings within that fraction of the mesh's width — the print stroke
   * still sweeps the full mesh every cycle and the flood wash keeps
   * animating unforced, so the component never reads as "finished and
   * stopped" even once progress reaches 1. Omit for a purely ambient loop. */
  progress?: number;
  /** accessible label for the loader */
  "aria-label"?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

type RGB = [number, number, number];

function parseColor(raw: string): RGB | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length < 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return Number.isNaN(r + g + b) ? null : [r, g, b];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// --- real numbers from the spec's observed flood/print/dwell cycle --------
const FLOOD_MS = 600; // light pass, left -> right, spreads without printing
const PRINT_MS = 900; // firm pass, right -> left, forces ink through
const DWELL_MS = 300; // blade lifts clear before the next flood pass
const CYCLE_MS = FLOOD_MS + PRINT_MS + DWELL_MS; // 1800

const ANGLE = (18 * Math.PI) / 180; // squeegee tilt from vertical
const FLOOD_ALPHA = 0.15; // flat wash alpha while the flood pass is over a cell
const MESH_ALPHA = 0.08; // fixed mesh-fabric line alpha, always visible
const INK_CAP = 0.9; // alpha a freshly printed opening jumps to
const INK_FLOOR = 0.2; // residual-stain floor ink decays toward, never 0
const INK_TAU = 2.4; // seconds, exponential decay time constant

// Reduced-motion freeze frame. The spec names FREEZE_PHASE =
// "print-stroke-60pct" (squeegee mid print-stroke, ~60% of the mesh printed,
// 40% not yet — the most legible "process caught in the act" frame). Taking
// that 60%-through-print-stroke intent at face value rather than the spec's
// literal t=1.5s (which lands exactly at this cycle's flood(0.6)+print(0.9)
// boundary, i.e. a FULLY printed frame with no unprinted mesh left to show)
// is what actually reproduces the described 60/40 split; the value below is
// derived from the phase math instead of the raw seconds figure.
const FREEZE_PHASE = "print-stroke-60pct";
const STATIC_TIME_MS = FLOOD_MS + 0.6 * PRINT_MS; // 1140ms

export function ScreenFloodStroke({
  progress,
  "aria-label": ariaLabel = "Loading",
  className = "",
  style,
}: ScreenFloodStrokeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    // -- token-derived ink: read at mount, re-derived on theme class change.
    // No literal fallback — draw() bails out while fg is still null, so
    // there is genuinely no paint before the first successful token read. --
    let fg: RGB | null = null;
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      const parsed = parseColor(cs.getPropertyValue("--foreground"));
      if (parsed) fg = parsed;
    };
    derive();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let pitch = 6;
    let cols = 0;
    let rows = 0;
    let ink = new Float32Array(0); // per-cell accumulated print-through alpha
    let raf = 0;
    let visible = true;
    let last = 0;

    // Only reallocates (and so only wipes accumulated ghosts) when the grid
    // shape actually changed. A ResizeObserver commonly fires more than
    // once for the same effective size (initial observe, font-load reflow,
    // flex settling); without this guard every one of those calls would
    // erase every ink impression and quietly break the t=2.5s/5s aliveness
    // this component depends on.
    const resizeField = () => {
      const nextCols = Math.max(1, Math.ceil(w / pitch));
      const nextRows = Math.max(1, Math.ceil(h / pitch));
      if (nextCols === cols && nextRows === rows && ink.length === nextCols * nextRows) return;
      cols = nextCols;
      rows = nextRows;
      ink = new Float32Array(cols * rows);
    };

    // squeegee's local x position at a given row, angled ANGLE from vertical
    // around the blade's centreline (baseX, h/2)
    const localX = (baseX: number, cy: number) => baseX + (cy - h / 2) * Math.sin(ANGLE);

    const step = (timeMs: number, dtMs: number) => {
      const t = timeMs % CYCLE_MS;
      const phase: "flood" | "print" | "dwell" = t < FLOOD_MS ? "flood" : t < FLOOD_MS + PRINT_MS ? "print" : "dwell";

      let baseX: number;
      if (phase === "flood") {
        baseX = (t / FLOOD_MS) * w;
      } else if (phase === "print") {
        const p = (t - FLOOD_MS) / PRINT_MS;
        baseX = w * (1 - p);
      } else {
        baseX = 0;
      }

      // decay every already-inked cell toward the residual-stain floor —
      // untouched cells (ink 0) stay 0 until their first impression
      const decay = Math.exp(-dtMs / 1000 / INK_TAU);
      for (let i = 0; i < ink.length; i++) {
        const v = ink[i];
        if (v > 0) ink[i] = INK_FLOOR + (v - INK_FLOOR) * decay;
      }

      // print stroke deposits: every cell already crossed by the blade
      // (to the right of its current, leftward-travelling position) jumps
      // straight to the alpha cap
      if (phase === "print") {
        const cap = progressRef.current;
        for (let j = 0; j < rows; j++) {
          const cy = j * pitch + pitch / 2;
          const lx = localX(baseX, cy);
          for (let i = 0; i < cols; i++) {
            const cx = i * pitch + pitch / 2;
            if (cx < lx) continue; // not yet crossed by the blade
            if (cap !== undefined && cx / w > Math.max(0, Math.min(1, cap))) continue;
            ink[j * cols + i] = INK_CAP;
          }
        }
      }

      return { phase, baseX };
    };

    const draw = (phase: "flood" | "print" | "dwell", baseX: number, timeMs: number) => {
      if (w <= 0 || h <= 0 || !fg) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // mesh fabric — fixed low alpha, always drawn first so ink sits on
      // top of it while the grid still shows through the ink's own alpha
      ctx.strokeStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${MESH_ALPHA})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= cols; i++) {
        const x = Math.min(w, i * pitch);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let j = 0; j <= rows; j++) {
        const y = Math.min(h, j * pitch);
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // print-through ink, per cell
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const v = ink[j * cols + i];
          if (v <= 0.005) continue;
          ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${v})`;
          ctx.fillRect(i * pitch, j * pitch, pitch, pitch);
        }
      }

      // flood wash — transient, recomputed live every frame, never stored:
      // it represents ink sitting on the mesh surface, not yet forced
      // through, so it has no persistence beyond the current flood pass
      if (phase === "flood") {
        ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${FLOOD_ALPHA})`;
        for (let j = 0; j < rows; j++) {
          const cy = j * pitch + pitch / 2;
          const lx = localX(baseX, cy);
          const xEnd = Math.max(0, Math.min(w, lx));
          if (xEnd > 0) ctx.fillRect(0, j * pitch, xEnd, pitch);
        }
      }

      // squeegee blade itself
      const barLen = h / Math.cos(ANGLE) + pitch * 2;
      const barWidth = Math.max(2, Math.min(w, h) * 0.045);
      let alpha = phase === "print" ? 0.95 : phase === "flood" ? 0.5 : 0;
      if (phase === "dwell") {
        const lift = (timeMs % CYCLE_MS) - (FLOOD_MS + PRINT_MS);
        alpha = Math.max(0, 0.4 * (1 - lift / DWELL_MS));
      }
      if (alpha > 0.01) {
        ctx.save();
        ctx.translate(baseX, h / 2);
        ctx.rotate(ANGLE);
        ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},${alpha})`;
        ctx.fillRect(-barWidth / 2, -barLen / 2, barWidth, barLen);
        ctx.restore();
      }
    };

    const loop = (now: number) => {
      if (last === 0) last = now;
      const dt = Math.min(100, now - last);
      last = now;
      const { phase, baseX } = step(now, dt);
      draw(phase, baseX, now);
      if (!reduced && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      // mesh pitch off the container's own smaller dimension — finer than
      // a printed-dot pitch since it represents woven fabric, not ink
      pitch = Math.min(9, Math.max(4, Math.min(w, h) / 60));
      resizeField();
      if (reduced) {
        const { phase, baseX } = step(STATIC_TIME_MS, 0);
        draw(phase, baseX, STATIC_TIME_MS);
      } else {
        last = 0;
        const { phase, baseX } = step(0, 0);
        draw(phase, baseX, 0);
      }
    };

    resize();
    if (!reduced) wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      if (reduced) {
        const { phase, baseX } = step(STATIC_TIME_MS, 0);
        draw(phase, baseX, STATIC_TIME_MS);
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        ink.fill(0);
        resizeField();
        const { phase, baseX } = step(STATIC_TIME_MS, 0);
        draw(phase, baseX, STATIC_TIME_MS);
      } else {
        ink.fill(0);
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver((entries) => {
      const isVisible = entries[0]?.isIntersecting ?? true;
      visible = isVisible && document.visibilityState === "visible";
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={ariaLabel}
      data-freeze-phase={FREEZE_PHASE}
      className={`ns-sfs relative h-40 w-40 overflow-hidden rounded-[10px] border border-border bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

ScreenFloodStroke.displayName = "ScreenFloodStroke";

export default ScreenFloodStroke;
