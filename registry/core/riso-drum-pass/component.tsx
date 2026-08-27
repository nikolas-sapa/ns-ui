"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// RisoDrumPass — a loader / background ambient texture reproducing a
// risograph duplication run, not a generic dot grid. A riso duplicator
// forces ink from inside a perforated cylindrical drum, wrapped in a
// stencil master, out through the stencil's micro-perforations onto paper
// as the drum makes ONE full rotation per printed sheet. Multi-colour riso
// work is never printed in one pass — it is run as SEQUENTIAL separate
// drum passes, one physical drum per colour, fed back through by hand or a
// colour-change unit — and every pass after the first mis-registers by a
// few pixels against the one before it purely from paper-feed tolerance,
// plus every pass shows faint concentric banding from uneven drum surface
// pressure across that one rotation. This is a single-screen, single-drum
// mechanic (card-dot-gain-screen) reproducing tonal dot-gain, and a
// two-screen static moiré mechanic (background-halftone-rosette)
// reproducing plate registration ANGLE drift; this component's identity is
// neither — it is three SEQUENTIAL, TIME-ORDERED sweeps of the SAME
// stencil dot field, each drawn as a live top-to-bottom rotation, offset a
// few pixels from the shared field so the drift reads as doubled edges and
// moiré between passes, never as three unrelated random layers.
//
// Per cycle: three passes, 2s each (drum rotation: 1.4s sweep + 0.6s pause
// for the drum swap, budgeted inside that same 2s slot) = 6s total. Pass
// index k (0,1,2) shares ONE value-noise stencil field for the whole cycle
// (so the same dots are common to all three passes — the actual mechanic a
// riso mis-registers) but nudges its own open/closed threshold by a small
// per-pass delta, standing in for that colour's own stencil-cutting
// tolerance, and reads its dots at a cumulative registration offset of
// (k*1.3px, k*0.7px) off the shared grid — the same sheet drifting further
// through each successive nip, not three independent misalignments. The
// whole stencil field is reseeded fresh every lap of the loop, so no two
// cycles print an identical sheet.
//
// Drum pressure banding: a dot's alpha is modulated by a sinusoid tied to
// the rotation angle at which its row was printed (row / totalRows
// standing in for angle-around-the-drum, amplitude 0.08), phase-shifted a
// third of a turn per pass index so the three passes' bands beat against
// each other rather than stacking as one static gradient. Baked in
// permanently at the moment that row is swept, because on a real press
// that row's ink density was fixed the instant the drum's high-pressure
// arc passed over it, not something that re-modulates after printing.
//
// Overlap: three passes at nominal alpha 0.55 compositing normally (as
// separate real ink layers do) would union to ~0.91 opacity where all
// three land on the same shared dot — past what the spec caps as visually
// "still separate layers of ink" rather than solid plugged fill. Per cell,
// each pass's alpha is therefore reduced ONLY when it would push the
// running Porter-Duff union past 0.82: alpha_k = min(banded, (0.82 -
// prior) / (1 - prior)). The first two passes on any shared cell almost
// always keep their full alpha; only a genuine triple-overlap cell gets
// its third layer thinned.
// ---------------------------------------------------------------------------

export interface RisoDrumPassProps {
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

// deterministic per-cell hash — the ONE shared stencil field a cycle's
// three passes all read from (see module doc: shared field is what makes
// the registration offset between passes actually visible).
function hash01(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

// each 2s pass slot budgets a 1.4s live rotation sweep + a 0.6s drum-swap
// pause, so three slots total exactly 6s with no gap or invented rest.
const SWEEP_MS = 1400;
const PAUSE_MS = 600;
const PASS_SLOT_MS = SWEEP_MS + PAUSE_MS; // 2000ms
const CYCLE_MS = PASS_SLOT_MS * 3; // 6000ms, 3 passes, no trailing rest
const PASS_COUNT = 3;

const REG_OFFSET_X = 1.3; // px, cumulative per pass index
const REG_OFFSET_Y = 0.7;
const BAND_AMPLITUDE = 0.08; // pressure-banding alpha modulation
const PASS_ALPHA = 0.55;
const ALPHA_CAP = 0.82; // hard union cap where all three passes overlap
const DOT_THRESHOLD = 0.5; // shared stencil cutoff — roughly half the field open
const THRESHOLD_DELTA = 0.04; // per-pass cutting tolerance around the shared threshold

// spec's explicit freeze time: passes 1 and 2 fully complete (their sweeps
// end at 3400ms), pass 3 already sweeping (its sweep starts at 4000ms) —
// the most structurally dense, most legibly drifted static frame short of
// waiting for the whole cycle to finish.
const STATIC_TIME_MS = 4200;

function passStart(k: number): number {
  return k * PASS_SLOT_MS;
}

/** sweep progress of pass k in [0,1] at cycleTime; 0 before its sweep
 * starts, 1 once its sweep is done (through its own pause and beyond). */
function passProgress(k: number, cycleTime: number): number {
  const start = passStart(k);
  if (cycleTime <= start) return 0;
  return Math.min(1, (cycleTime - start) / SWEEP_MS);
}

export function RisoDrumPass({ className = "", style }: RisoDrumPassProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    // -- token-derived ink: read at mount, re-derived on theme class change --
    let fg: RGB = [0, 0, 0];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
    };
    derive();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let pitch = 6;
    let cols = 0;
    let rows = 0;
    let raf = 0;
    let visible = true;
    let cycleBase = 0; // performance.now() at the start of the current cycle
    let cycleIndex = 0; // increments once per lap — reseeds the shared stencil

    // -- draw the sheet as it stands at `cycleTime` (ms since this cycle's
    // stencil was cut). Every cell is visited once; each of the three
    // passes that has swept past that cell's row reads the SAME shared
    // dot field (nudged by its own threshold delta) at its own cumulative
    // registration offset, alpha-capped per cell via a running union. -----
    const draw = (cycleTime: number) => {
      if (w <= 0 || h <= 0 || cols <= 0 || rows <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgb(${fg[0]},${fg[1]},${fg[2]})`;

      const seed = cycleIndex * 997.13;
      const radius = pitch * 0.4;

      // per-pass sweep front row (fractional) and whether the pass has
      // started at all this cycleTime, precomputed once per frame
      const fronts: number[] = [];
      const started: boolean[] = [];
      for (let k = 0; k < PASS_COUNT; k++) {
        const p = passProgress(k, cycleTime);
        started.push(cycleTime > passStart(k));
        fronts.push(p * rows);
      }

      for (let j = 0; j < rows; j++) {
        const rotationFrac = rows > 1 ? j / (rows - 1) : 0;
        for (let i = 0; i < cols; i++) {
          const n = hash01(i * 0.37 + seed, j * 0.41 + seed); // ONE shared field
          let prior = 0; // running combined alpha for this cell this frame
          for (let k = 0; k < PASS_COUNT; k++) {
            if (!started[k]) break; // later passes never precede earlier ones
            const front = fronts[k] ?? 0;
            if (j > front) continue; // this pass hasn't swept this row yet

            // shared stencil, nudged by this colour's own cutting tolerance
            const threshold = DOT_THRESHOLD + (k - 1) * THRESHOLD_DELTA;
            if (n < threshold) continue;

            // pressure banding baked in at the rotation angle this row
            // printed at, phased a third of a turn apart per pass
            const phase = 2 * Math.PI * rotationFrac + (k * 2 * Math.PI) / 3;
            const band = 1 + BAND_AMPLITUDE * Math.sin(phase);
            let alpha = PASS_ALPHA * band;

            // cap the running union at ALPHA_CAP, thinning only the layer
            // that would actually push the cell past it
            const room = (ALPHA_CAP - prior) / Math.max(0.0001, 1 - prior);
            alpha = Math.max(0, Math.min(alpha, room));
            if (alpha <= 0.004) continue;
            prior = prior + alpha * (1 - prior);

            const cx = (i + 0.5) * pitch + k * REG_OFFSET_X;
            const cy = (j + 0.5) * pitch + k * REG_OFFSET_Y;

            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;

      // faint sweep-front nip line for the pass currently in motion —
      // luminance only, no accent, a soft foreground band at the drum's
      // current contact row
      for (let k = 0; k < PASS_COUNT; k++) {
        const p = passProgress(k, cycleTime);
        if (p > 0 && p < 1) {
          const y = (fronts[k] ?? 0) * pitch;
          const grad = ctx.createLinearGradient(0, y - pitch * 2, 0, y + pitch * 2);
          grad.addColorStop(0, `rgba(${fg[0]},${fg[1]},${fg[2]},0)`);
          grad.addColorStop(0.5, `rgba(${fg[0]},${fg[1]},${fg[2]},0.05)`);
          grad.addColorStop(1, `rgba(${fg[0]},${fg[1]},${fg[2]},0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, y - pitch * 2, w, pitch * 4);
        }
      }
    };

    const loop = (now: number) => {
      let cycleTime = now - cycleBase;
      if (cycleTime >= CYCLE_MS) {
        const laps = Math.floor(cycleTime / CYCLE_MS);
        cycleBase += laps * CYCLE_MS;
        cycleIndex += laps;
        cycleTime = now - cycleBase;
      }
      draw(cycleTime);
      if (!reduced && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      // stencil pitch derived from the container's own smaller dimension so
      // the drum screen reads at card scale rather than coarsening or vanishing
      pitch = Math.min(10, Math.max(5, Math.min(w, h) / 40));
      cols = Math.ceil(w / pitch) + 1;
      rows = Math.ceil(h / pitch) + 1;
      if (reduced) {
        draw(STATIC_TIME_MS);
      } else {
        draw(Math.max(0, performance.now() - cycleBase));
      }
    };

    cycleBase = performance.now();
    resize();
    if (!reduced) wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      draw(reduced ? STATIC_TIME_MS : Math.max(0, performance.now() - cycleBase));
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        draw(STATIC_TIME_MS);
      } else {
        cycleBase = performance.now();
        cycleIndex = 0;
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) {
        wake();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver((entries) => {
      const intersecting = entries[0]?.isIntersecting ?? true;
      visible = intersecting && document.visibilityState === "visible";
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
      className={`ns-rdp relative h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

RisoDrumPass.displayName = "RisoDrumPass";

export default RisoDrumPass;
