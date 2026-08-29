"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// TuftingGunLoopPile — an ambient card texture reproducing a tufting gun's
// row-by-row loop-pile build (hand/machine tufting gun operation, carpet
// manufacture), not a generic "loading tiles" fill. A hollow needle plunges
// straight down through a backing cloth, grips a strand of yarn, withdraws
// leaving a loop of pile standing on the front face, the carriage then
// advances one fixed pitch along the row and repeats. Real guns run
// 800-1500 punches/minute per needle; per the round 9 decoupling rule that
// rate is never animated 1:1 — a single tuft "pop" (backing -> filled loop)
// is fixed at 90ms regardless of gun cadence, fast enough to read as a
// discrete event without simultaneous rows and without aliasing against the
// paint rate.
//
// The active row's carriage crosses the row in a fixed 1100ms (per-cell
// interval = 1100 / cols, so a wider card gets a faster per-cell tick but
// the SAME row-crossing time — the ~24-36 cells/s spec figure falls out of
// that division rather than being hand-tuned per width) with a crosshair
// drawn at --foreground continuously interpolated across the row so the eye
// can track carriage position at any instant, cells popping in just behind
// it. Once every cell in the active row is filled, the whole tufted field
// scrolls up by exactly one row-pitch over a 260ms ease — old rows climbing
// toward the top edge, a fixed strip of not-yet-reached rows always resting
// below the active slot — then the field settles, a new row starts empty at
// the same active slot, and the cycle repeats. This never stops or resets:
// the row history is uncapped in principle, only culled from the draw loop
// once it has scrolled fully above the canvas, which is why the specific
// filled/empty pattern visible at t0 is guaranteed to have scrolled
// entirely off-frame by t=5s.
//
// Geometry is derived from the container's own smaller dimension: cell
// pitch = min(width,height)/26, clamped to [6,14]px (so a 240px-tall card
// lands on the spec's ~9px pitch and ~26 rows), and the column count is
// sized a little past width/pitch so the field overhangs both edges rather
// than ending on a half-cell.
// ---------------------------------------------------------------------------

export interface TuftingGunLoopPileProps {
  /** card heading */
  title?: string;
  /** card body copy */
  description?: string;
  /** trailing link label; omit to render the card with no link */
  linkLabel?: string;
  /** link href, used only when linkLabel is set */
  href?: string;
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

function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function relLuminance([r, g, b]: RGB): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Nudge a token's own channels up by a fixed delta (never a colour
 * literal blended in) — the additive analogue of "lighter", stays legible
 * even where the source is already near-black in light theme. */
function lighten(c: RGB, delta: number): RGB {
  return [Math.min(255, c[0] + delta), Math.min(255, c[1] + delta), Math.min(255, c[2] + delta)];
}

function rgbStr([r, g, b]: RGB, alpha = 1): string {
  return `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, ${alpha})`;
}

function easeOutCubic(t: number): number {
  const p = 1 - t;
  return 1 - p * p * p;
}

const PITCH_DIVISOR = 26; // cell pitch = min(w,h) / 26 — a 240px-tall card lands on ~9px, ~26 rows
const PITCH_MIN = 6;
const PITCH_MAX = 14;
const ROW_SWEEP_MS = 1100; // fixed row-crossing time regardless of column count
const POP_MS = 90; // single tuft backing -> filled-loop pop, decoupled from real gun cadence
const SCROLL_MS = 260; // field feed after a row completes
const EMPTY_ROWS_BELOW = 2; // fixed strip of not-yet-reached backing kept below the active row
const FIELD_OVERHANG_CELLS = 2; // extra columns so the field overhangs both edges

type Phase = "sweeping" | "scrolling";

// Reduced motion freezes with the head paused ~50% through its row, a
// handful of completed rows above and empty backing weave below — the most
// structured single frame (mixed filled/unfilled state, head mid-sweep, not
// at a row boundary). Named GUN_MIDROW, exposed via data-reduced-motion-freeze.
const FREEZE_PHASE = "GUN_MIDROW";
const FREEZE_FILLED_FRAC = 0.5;
const FREEZE_COMPLETED_ROWS = 4;

export function TuftingGunLoopPile({
  title = "Backing, row 1,842",
  description = "The carriage plunges a loop, advances one pitch, and the field feeds beneath it — the pile never stops building.",
  linkLabel = "Read the process card",
  href = "#",
  className = "",
  style,
}: TuftingGunLoopPileProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    // -- token-derived colour, re-read on any theme class flip, never a
    // literal (not even a fallback) — nothing paints until this has run
    // successfully once. --
    let fg: RGB | null = null;
    let border: RGB | null = null;
    let rim: RGB | null = null;
    let colorsReady = false;
    const deriveColors = () => {
      const cs = getComputedStyle(document.documentElement);
      const nextFg = parseColor(cs.getPropertyValue("--foreground"));
      const nextBg = parseColor(cs.getPropertyValue("--background"));
      const nextBorder = parseColor(cs.getPropertyValue("--border"));
      const nextMuted = parseColor(cs.getPropertyValue("--ns-muted"));
      if (!nextFg || !nextBg || !nextBorder) return;
      fg = nextFg;
      // rim: the same --foreground token nudged up by a fixed additive
      // delta, luminance only, never --ns-accent — sells the loop's
      // rounded top catching light.
      rim = lighten(nextFg, 46);
      // --border is a separator token at ~1.1:1 contrast in light theme —
      // as a crosshatch fill it would be unreadable there, so in light
      // theme it is mixed toward --ns-muted (same precedent as the
      // peen-coverage sibling's light-theme branch) rather than used raw.
      const isDark = relLuminance(nextBg) < 0.5;
      border = isDark || !nextMuted ? nextBorder : mixRGB(nextBorder, nextMuted, 0.7);
      colorsReady = true;
    };
    deriveColors();

    let w = 0;
    let h = 0;
    let dpr = 1;
    // derived from the container's own smaller dimension every layout pass
    let CELL_PITCH = PITCH_MIN;
    let cols = 1;
    let fieldW = 0;
    let fieldOffsetX = 0;
    let activeY = 0; // fixed canvas y (top edge) of the active row's slot
    let visible = true;
    let raf = 0;

    let phase: Phase = "sweeping";
    let filled = 0; // cells confirmed filled in the active row
    let rowElapsed = 0; // ms into the current row's sweep
    let scrollElapsed = 0; // ms into the current scroll transition
    let completedRows = 0; // count of fully-filled rows resting above the active slot
    let lastNow = 0;

    const maxCompletedRows = () => Math.ceil(activeY / CELL_PITCH) + 3;

    const cellInterval = () => ROW_SWEEP_MS / Math.max(1, cols);

    const resetRow = () => {
      filled = 0;
      rowElapsed = 0;
      phase = "sweeping";
    };

    const advanceSweep = (dtMs: number) => {
      rowElapsed = Math.min(ROW_SWEEP_MS + POP_MS, rowElapsed + dtMs);
      const target = Math.min(cols, Math.floor(rowElapsed / cellInterval()));
      if (target > filled) filled = target;
      // wait for the LAST cell's own 90ms pop to finish, not just the
      // sweep clock, so the row never snaps its final cells into place.
      if (filled >= cols && rowElapsed >= ROW_SWEEP_MS + POP_MS) {
        phase = "scrolling";
        scrollElapsed = 0;
      }
    };

    const advanceScroll = (dtMs: number) => {
      scrollElapsed = Math.min(SCROLL_MS, scrollElapsed + dtMs);
      if (scrollElapsed >= SCROLL_MS) {
        completedRows = Math.min(maxCompletedRows(), completedRows + 1);
        resetRow();
      }
    };

    // -- draw a faint crosshatch backing weave for an unfilled cell,
    // --border used correctly as a separator, never a fill of solid shapes --
    const drawBacking = (x: number, y: number) => {
      if (!border) return;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + 1);
      ctx.lineTo(x + CELL_PITCH - 1, y + CELL_PITCH - 1);
      ctx.moveTo(x + CELL_PITCH - 1, y + 1);
      ctx.lineTo(x + 1, y + CELL_PITCH - 1);
      ctx.strokeStyle = rgbStr(border, 0.9);
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    // -- a filled loop: a short vertical ellipse in --foreground with a
    // lighter rim arc along its top-left, selling a rounded pile top --
    const drawLoop = (x: number, y: number, popT: number) => {
      if (!fg || !rim) return;
      const cx = x + CELL_PITCH / 2;
      const cy = y + CELL_PITCH / 2;
      const rx = (CELL_PITCH * 0.34) * popT;
      const ry = (CELL_PITCH * 0.42) * popT;
      if (rx <= 0.2 || ry <= 0.2) return;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = rgbStr(fg, 1);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - rx * 0.28, cy - ry * 0.32, rx * 0.55, ry * 0.4, -0.6, 0, Math.PI * 2);
      ctx.strokeStyle = rgbStr(rim, 0.85);
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const drawHead = (x: number, y: number) => {
      if (!fg) return;
      const cx = x;
      const cy = y + CELL_PITCH / 2;
      const arm = CELL_PITCH * 0.75;
      ctx.strokeStyle = rgbStr(fg, 1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - arm, cy);
      ctx.lineTo(cx + arm, cy);
      ctx.moveTo(cx, cy - arm);
      ctx.lineTo(cx, cy + arm);
      ctx.stroke();
    };

    const draw = () => {
      if (w <= 0 || h <= 0 || !colorsReady) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const scrollT = phase === "scrolling" ? easeOutCubic(scrollElapsed / SCROLL_MS) : 0;
      const scrollPx = scrollT * CELL_PITCH;

      // completed rows, oldest at the top, scrolling up together with the
      // in-progress transition; culled once fully above the canvas top
      for (let n = 1; n <= completedRows; n++) {
        const y = activeY - n * CELL_PITCH + scrollPx;
        if (y + CELL_PITCH < -CELL_PITCH) continue;
        if (y > h) continue;
        for (let c = 0; c < cols; c++) {
          drawLoop(fieldOffsetX + c * CELL_PITCH, y, 1);
        }
      }

      // active row, still mid-sweep or mid-scroll (fully filled, sliding
      // toward the "completed" slot one pitch above)
      {
        const y = activeY + scrollPx;
        for (let c = 0; c < cols; c++) {
          const x = fieldOffsetX + c * CELL_PITCH;
          if (c < filled) {
            const cellStart = c * cellInterval();
            const popT = phase === "scrolling" ? 1 : Math.min(1, (rowElapsed - cellStart) / POP_MS);
            drawLoop(x, y, Math.max(0, popT));
          } else {
            drawBacking(x, y);
          }
        }
        // the head stays visible through the scroll transition too, riding
        // up with the row it just finished — round 9's rule that a
        // discrete transition must show departure and arrival, never a
        // blink, applies to the head as much as to the cells.
        const headFrac = phase === "sweeping" ? Math.min(1, rowElapsed / ROW_SWEEP_MS) : 1;
        const headX = fieldOffsetX + headFrac * cols * CELL_PITCH;
        drawHead(headX, y);
      }

      // fixed strip of not-yet-reached backing rows, always resting below
      // the active slot — these never scroll, the active slot is pinned
      for (let n = 1; n <= EMPTY_ROWS_BELOW; n++) {
        const y = activeY + n * CELL_PITCH;
        if (y > h) continue;
        for (let c = 0; c < cols; c++) {
          drawBacking(fieldOffsetX + c * CELL_PITCH, y);
        }
      }
    };

    const loop = (now: number) => {
      const dt = lastNow === 0 ? 0 : Math.min(100, now - lastNow);
      lastNow = now;
      if (phase === "sweeping") advanceSweep(dt);
      else advanceScroll(dt);
      draw();
      if (!reduced && visible) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) {
        lastNow = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    let hasSeeded = false;

    const layout = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));

      CELL_PITCH = Math.min(PITCH_MAX, Math.max(PITCH_MIN, Math.min(w, h) / PITCH_DIVISOR));
      cols = Math.max(4, Math.ceil(w / CELL_PITCH) + FIELD_OVERHANG_CELLS);
      fieldW = cols * CELL_PITCH;
      fieldOffsetX = -(fieldW - w) / 2;

      const activeSlotFromBottom = EMPTY_ROWS_BELOW + 1;
      activeY = h - activeSlotFromBottom * CELL_PITCH;

      if (reduced) {
        phase = "sweeping";
        scrollElapsed = 0;
        completedRows = Math.min(maxCompletedRows(), FREEZE_COMPLETED_ROWS);
        filled = Math.round(cols * FREEZE_FILLED_FRAC);
        rowElapsed = filled * cellInterval() + POP_MS; // every filled cell's pop finished
        draw();
        return;
      }

      if (!hasSeeded) {
        // Seed the resting loop already mid-flight instead of blank: t0 is
        // "head mid-row, roughly a third filled, several completed rows
        // above" per spec, not an empty card that takes ~30s to fill in.
        hasSeeded = true;
        completedRows = maxCompletedRows();
        filled = Math.max(1, Math.round(cols / 3));
        rowElapsed = filled * cellInterval();
        phase = "sweeping";
      } else {
        // a genuine resize (not the resting loop) — keep progress, just
        // clamp it to the new geometry rather than blanking the field.
        completedRows = Math.min(completedRows, maxCompletedRows());
        filled = Math.min(filled, cols);
        rowElapsed = Math.min(rowElapsed, ROW_SWEEP_MS + POP_MS);
      }
      draw();
    };

    layout();
    if (!reduced) wake();

    const ro = new ResizeObserver(layout);
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(root);

    const mo = new MutationObserver(() => {
      deriveColors();
      draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      cancelAnimationFrame(raf);
      raf = 0;
      layout();
      if (!reduced) wake();
    };
    mq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        wake();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    let disposed = false;
    document.fonts.ready.then(() => {
      if (!disposed) layout();
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      mq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-reduced-motion-freeze={FREEZE_PHASE}
      className={`ns-tufting-gun-loop-pile relative w-full max-w-sm overflow-hidden rounded-[14px] border border-border bg-background ${className}`}
      style={style}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      <div ref={contentRef} className="pointer-events-none relative flex flex-col gap-3 p-6">
        <h3 className="text-balance font-sans text-lg font-medium text-foreground">{title}</h3>
        <p className="text-pretty font-mono text-xs leading-relaxed text-ns-muted">{description}</p>
        {linkLabel ? (
          <a
            href={href}
            className="pointer-events-auto mt-1 inline-flex w-fit items-center gap-1 rounded-sm font-mono text-xs font-medium text-foreground underline decoration-border underline-offset-4 transition-colors duration-150 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            {linkLabel}
            <span aria-hidden="true">&rarr;</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

TuftingGunLoopPile.displayName = "TuftingGunLoopPile";

export default TuftingGunLoopPile;
