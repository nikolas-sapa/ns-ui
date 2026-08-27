"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// EinkWaveformGhost — an empty-state panel rendered as an idle e-ink display,
// driven by the real electrophoretic update mechanic, not a decorative
// pixel-grid dither. A physical e-ink cell does not switch instantly like an
// emissive pixel: the driver runs it through a short discrete voltage
// WAVEFORM — a fixed sequence of drive steps that physically push charged
// black/white particle capsules into position. Consumer waveforms
// characteristically OVERSHOOT: an intermediate step pushes particles past
// their eventual resting grey level, briefly flashing the cell toward full
// black or full white ("shoot-through") before the final step lands it on
// its true target. This component's whole point is that shoot-through, cell
// by cell, at card scale — every other dither/halftone core component in
// this registry (card-dot-gain-screen, chart-*-halftone) resolves its
// pattern spatially from a static or slow-drifting field; this one resolves
// nothing spatially and is entirely a TEMPORAL settle animation replayed by
// a scattered, ever-changing subset of an otherwise-static grid.
//
// The panel shows one fixed coarse glyph (a small landscape scene: sun,
// two mountain ridges, a ground band) baked once into a per-cell target
// grey (0 = --background/paper, 1 = --foreground/ink). That image never
// changes. What keeps the panel alive is that every cell independently
// re-plays its own drive waveform on a randomized schedule (mean 1.9s,
// drawn from an exponential/Poisson interval so cells desync from each
// other rather than pulsing in lockstep) even though its target grey never
// moves — a stand-in for the residual-charge drift and partial self-refresh
// real e-ink panels perform even while holding a static page. Each replay
// is four fixed 60ms steps (240ms total), discretely switched frame to
// frame (a real waveform steps, it does not ease): step 1 holds the
// pre-replay value, steps 2-3 push the cell fully to whichever pole (black
// or white) sits FARTHER from that starting value — the overshoot — and
// step 4 lands on the cell's true target grey.
//
// Layered on top, every ~14s ± 3s (jittered per mount so multiple instances
// on one page desync) the whole panel runs a synchronized full-refresh: 3
// alternating full-panel black/white flashes at 90ms each (270ms total),
// then every cell reasserts its target grey simultaneously. This is the
// periodic climax Kindle-style readers show every few page turns to clear
// accumulated ghosting — but it sits ON TOP of the continuous per-cell
// layer, not instead of it; the per-cell layer alone is what makes the
// panel provably different at t0/2.5s/5s regardless of where the refresh
// cycle happens to land.
//
// Because cell values interpolate directly between the --background and
// --foreground tokens, the paper/ink relationship inverts for free with the
// site's theme (light theme: pale paper, dark ink, as a real e-reader
// looks; dark theme: pale "ink" cells sit lit against a dark "paper" — the
// literal opposite of a physical e-ink panel, and that inversion is
// intentional, not a bug to special-case away with a hardcoded white base).
// ---------------------------------------------------------------------------

export interface EinkWaveformGhostProps {
  /** empty-state heading below the panel */
  title?: string;
  /** empty-state supporting copy below the heading */
  description?: string;
  /** optional CTA link label; omitted entirely when not provided */
  ctaLabel?: string;
  /** CTA href, used only when ctaLabel is set */
  ctaHref?: string;
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Baked landscape glyph: returns a target grey in [0,1] for a cell at
// normalised (nx, ny) in [0,1)x[0,1). 0 = paper (--background), 1 = ink
// (--foreground). Coarse and blocky on purpose — it only has to read at
// weather-icon scale, not survive close inspection.
function glyphTarget(nx: number, ny: number): number {
  // sun: soft mid-grey disc, upper right
  const sdx = nx - 0.72;
  const sdy = ny - 0.24;
  if (sdx * sdx + sdy * sdy < 0.016) return 0.42;

  // ground band: darkest flat tone across the bottom
  if (ny >= 0.82) return 0.85;

  // triangle-ridge half-width at this row: 0 at the peak, hw at the base
  const triHalfWidth = (py: number, by: number, hw: number) =>
    ny > py && ny < by ? hw * ((ny - py) / (by - py)) : -1;

  // far ridge (lighter, sits behind)
  const farW = triHalfWidth(0.42, 0.82, 0.3);
  if (farW >= 0 && Math.abs(nx - 0.32) <= farW) return 0.62;

  // near ridge (darkest, sits in front, drawn last)
  const nearW = triHalfWidth(0.52, 0.82, 0.26);
  if (nearW >= 0 && Math.abs(nx - 0.6) <= nearW) return 1;

  return 0; // open sky / paper
}

interface Cell {
  target: number;
  value: number;
  phase: "idle" | "stepping";
  stepStart: number;
  overshoot: number;
  nextFire: number;
}

const MEAN_INTERVAL_S = 1.9; // per-cell mean replay interval (Poisson)
const STEP_MS = 60; // one waveform drive step
const WAVEFORM_MS = STEP_MS * 4; // 240ms total per replay
const REFRESH_MEAN_S = 14;
const REFRESH_JITTER_S = 3;
const REFRESH_FLASH_MS = 90;
const REFRESH_FLASHES = 3; // 270ms total, alternating black/white
const CELL_DIVISOR = 20; // cellPx = container's smaller dimension / 20

// -- the reduced-motion freeze frame is "zero cells mid-waveform": every
// cell resting at its true baked target grey, the clearest possible read of
// the settled page. There is no simulated clock to freeze at a numeric
// STATIC_TIME here — that state IS simply "draw once, don't animate" — but
// it corresponds to the deliberately-chosen non-t0 instant described in the
// component spec where the panel is maximally legible. ----------------------
function nextInterval(): number {
  return -MEAN_INTERVAL_S * Math.log(Math.max(1e-6, Math.random())) * 1000;
}

export function EinkWaveformGhost({
  title = "No documents yet",
  description = "Documents you create will show up here.",
  ctaLabel,
  ctaHref = "#",
  className = "",
  style,
}: EinkWaveformGhostProps) {
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

    // -- token-derived paper/ink: read at mount, re-derived on theme change --
    let bg: RGB = [10, 10, 10];
    let fg: RGB = [237, 237, 237];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
    };
    derive();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let cellW = 0;
    let cellH = 0;
    let cells: Cell[] = [];
    let raf = 0;
    let visible = true;
    let refreshActive = false;
    let refreshFlashIdx = 0;
    let refreshFlashStart = 0;
    let nextRefreshAt = 0;

    const scheduleRefresh = (now: number) => {
      const jitter = (Math.random() * 2 - 1) * REFRESH_JITTER_S;
      nextRefreshAt = now + (REFRESH_MEAN_S + jitter) * 1000;
    };

    const buildGrid = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) return false;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      const cellPx = Math.max(6, Math.min(w, h) / CELL_DIVISOR);
      cols = Math.max(6, Math.round(w / cellPx));
      rows = Math.max(4, Math.round(h / cellPx));
      cellW = w / cols;
      cellH = h / rows;
      const now = performance.now();
      cells = new Array(cols * rows);
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const nx = (gx + 0.5) / cols;
          const ny = (gy + 0.5) / rows;
          const target = glyphTarget(nx, ny);
          cells[gy * cols + gx] = {
            target,
            value: target,
            phase: "idle",
            stepStart: 0,
            overshoot: target >= 0.5 ? 0 : 1,
            nextFire: now + nextInterval(),
          };
        }
      }
      return true;
    };

    const drawStatic = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const cell = cells[gy * cols + gx];
          if (!cell || cell.target <= 0) continue;
          const [r, g, b] = [
            lerp(bg[0], fg[0], cell.target),
            lerp(bg[1], fg[1], cell.target),
            lerp(bg[2], fg[2], cell.target),
          ];
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(gx * cellW, gy * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    };

    const draw = (now: number) => {
      if (w <= 0 || h <= 0) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (refreshActive) {
        const v = refreshFlashIdx % 2 === 0 ? 1 : 0;
        const [r, g, b] = [lerp(bg[0], fg[0], v), lerp(bg[1], fg[1], v), lerp(bg[2], fg[2], v)];
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, w, h);
        return;
      }

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const cell = cells[gy * cols + gx];
          if (!cell || cell.value <= 0) continue;
          const [r, g, b] = [
            lerp(bg[0], fg[0], cell.value),
            lerp(bg[1], fg[1], cell.value),
            lerp(bg[2], fg[2], cell.value),
          ];
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(gx * cellW, gy * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
    };

    const startCellWaveform = (cell: Cell, now: number) => {
      cell.overshoot = cell.value >= 0.5 ? 0 : 1;
      cell.phase = "stepping";
      cell.stepStart = now;
    };

    const advance = (now: number) => {
      // -- full-refresh: synchronized alternating flash, then simultaneous
      // settle, layered on top of the per-cell schedule below. -----------
      if (refreshActive) {
        const elapsed = now - refreshFlashStart;
        const idx = Math.floor(elapsed / REFRESH_FLASH_MS);
        if (idx !== refreshFlashIdx && idx < REFRESH_FLASHES) {
          refreshFlashIdx = idx;
        } else if (idx >= REFRESH_FLASHES) {
          refreshActive = false;
          for (const cell of cells) {
            cell.value = cell.target;
            cell.phase = "idle";
            cell.nextFire = now + nextInterval();
          }
          scheduleRefresh(now);
        }
        return;
      }
      if (now >= nextRefreshAt) {
        refreshActive = true;
        refreshFlashIdx = 0;
        refreshFlashStart = now;
        return;
      }

      // -- continuous per-cell layer: this is what carries "alive at rest".
      for (const cell of cells) {
        if (cell.phase === "idle") {
          if (now >= cell.nextFire) startCellWaveform(cell, now);
          continue;
        }
        const elapsed = now - cell.stepStart;
        if (elapsed >= WAVEFORM_MS) {
          cell.value = cell.target;
          cell.phase = "idle";
          cell.nextFire = now + nextInterval();
          continue;
        }
        const step = Math.min(3, Math.floor(elapsed / STEP_MS));
        // step 0: pre-replay value, steps 1-2: overshoot, step 3: target
        cell.value = step === 0 ? cell.value : step === 3 ? cell.target : cell.overshoot;
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || reduced) return;
      advance(now);
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      if (!buildGrid()) return;
      const now = performance.now();
      if (reduced) {
        drawStatic();
        return;
      }
      scheduleRefresh(now);
      draw(now);
    };

    resize();
    if (!reduced) wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      if (reduced) drawStatic();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(root);

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        for (const cell of cells) cell.value = cell.target;
        drawStatic();
      } else {
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    // -- optional interaction: re-trigger a single cell's local waveform,
    // like marking the panel with a stylus. Stays within the same
    // background/foreground grey palette — never introduces --ns-accent or
    // any hue, and never changes what the cell eventually settles back to. -
    const onPointerDown = (ev: PointerEvent) => {
      if (reduced || refreshActive) return;
      const rect = canvas.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      const gx = Math.floor(px / cellW);
      const gy = Math.floor(py / cellH);
      if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return;
      const cell = cells[gy * cols + gx];
      if (cell && cell.phase === "idle") startCellWaveform(cell, performance.now());
    };
    canvas.addEventListener("pointerdown", onPointerDown);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onReducedChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border border-border bg-surface px-10 py-10 text-center ${className}`}
      style={style}
    >
      <div className="w-full overflow-hidden rounded-sm border border-border bg-background p-2">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2px]">
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="pointer-events-auto absolute inset-0 h-full w-full"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        <p className="max-w-xs text-sm text-ns-muted">{description}</p>
      </div>
      {ctaLabel ? (
        <a
          href={ctaHref}
          className="rounded-sm bg-ns-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {ctaLabel}
        </a>
      ) : null}
    </div>
  );
}

EinkWaveformGhost.displayName = "EinkWaveformGhost";

export default EinkWaveformGhost;
