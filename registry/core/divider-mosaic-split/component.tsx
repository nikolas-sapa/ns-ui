"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// DividerMosaicSplit — a full-width section divider rendered in NAPLPS
// "separated mosaic" mode.
//
// NAPLPS (the videotex standard behind Prestel, Telidon, and early consumer
// online services' graphics mode) and the teletext alphamosaic sets it
// descends from both address a 2-wide x 3-tall sub-cell grid per character
// cell — the same sextant addressing this registry's divider-teletext-mosaic
// already ships in its CONTIGUOUS mode (lit sub-cells flush against their
// neighbours, forming solid shapes). NAPLPS adds a second selectable
// attribute per mosaic run: SEPARATED — the identical 6-bit sub-cell code,
// but every lit block is drawn inset by a fixed gap on all four sides, so
// the mosaic reads as a field of small floating tiles instead of a solid
// silhouette. Real terminals let a page author toggle this per attribute
// byte; broadcasters used separated mode for graphs/diagrams where
// individual sub-cell boundaries needed to stay legible, contiguous for
// photo-like fills. This is the specific variant divider-teletext-mosaic's
// own source comment names but does not build.
//
// THE GAP IS THE ENTIRE IDENTITY of this component and must be a real
// luminance gap, never a --border stroke (--border measures ~1.1:1 in light
// theme and would make the gap structurally invisible right where it needs
// to prove separated mode is different from contiguous). The gap is literal
// unpainted --background between two --foreground/--ns-muted fills, inset
// 18% of the sub-cell's side per edge, floored to a minimum physical pixel
// count so it never anti-aliases away at small card-scale cell sizes.
//
// GRID: this band is a single row of character cells (unlike the teletext
// sibling's 6-row page), so geometry derives entirely from the band's own
// height: sub-cell side = height / 3 (exactly 3 sub-cell rows fill the
// band), character cell = 2 sub-cells wide x 3 tall, i.e. cellW = 2 *
// subCell, cellH = height. Column count = floor(width / cellW).
//
// ALIVE AT REST: real videotex pages arrive byte-serial off a transmission
// line — this band reproduces that with a write cursor sweeping LEFT TO
// RIGHT across column-groups (not top-to-bottom across rows, the teletext
// sibling's mechanic), re-sampling a slow generative field into a fresh
// 6-bit pattern per column-group on a 90ms cadence, faster than the
// sibling's 420ms per-row cadence since this sweeps narrow column-groups
// across a single short band rather than full character rows across a
// six-row page. A completed left-to-right pass holds for an 800ms sync
// pause before the next pass begins.
// ---------------------------------------------------------------------------

const SUB_COLS = 2; // sub-cell grid width per character cell (NAPLPS sextant)
const SUB_ROWS = 3; // sub-cell grid height per character cell (NAPLPS sextant)
const GROUP_COLS = 3; // character cells per write step (a "column group")
const COLUMN_INTERVAL_MS = 90; // time between successive column-group writes
const PAUSE_MS = 800; // sync pause between a completed pass and the next
const GAP_RATIO = 0.18; // gap inset, fraction of a sub-cell's side, per edge
const MIN_GAP_PX = 1; // floor so the gap never anti-aliases away at small scale

// three non-commensurate traveling components summed and normalized — a
// distinct field from the teletext sibling's (different frequencies/phase
// structure), slow enough that a 90ms column-group cadence still samples
// visibly different content pass over pass.
function fieldValue(sx: number, sy: number, t: number) {
  const f =
    Math.sin(sx * 0.5 - t * 1.1) +
    0.55 * Math.sin(sy * 0.8 + sx * 0.18 + t * 0.44) +
    0.35 * Math.sin((sx - sy) * 0.3 + t * 0.71);
  const v = (f + 1.9) / 3.8;
  return Math.min(1, Math.max(0, v));
}

function subCellPattern(colGlobal: number, t: number) {
  // returns a 6-bit mask, bit i = sub-cell i (0=top-left ... 5=bottom-right)
  let bits = 0;
  for (let subRow = 0; subRow < SUB_ROWS; subRow++) {
    for (let subCol = 0; subCol < SUB_COLS; subCol++) {
      const idx = subRow * SUB_COLS + subCol;
      const sx = colGlobal * SUB_COLS + subCol;
      const sy = subRow;
      const v = fieldValue(sx, sy, t);
      if (v > 0.5) bits |= 1 << idx;
    }
  }
  return bits;
}

export interface DividerMosaicSplitProps {
  /** band height in px; sub-cell side is height / 3. Default 42. */
  height?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function DividerMosaicSplit({
  height = 42,
  className = "",
}: DividerMosaicSplitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let bg = "";
    let fg = "";
    let muted = "";

    const subCell = Math.max(2, height / SUB_ROWS);
    const cellW = subCell * SUB_COLS;
    const gap = Math.max(MIN_GAP_PX, Math.round(subCell * GAP_RATIO));
    const block = Math.max(1, subCell - gap * 2);

    let cols = 0;
    let sized = false;
    let lastWidth = 0;

    // per-column state: 6-bit pattern and the timestamp (component-local
    // clock, seconds) it was last written, for the write-flash
    let patterns: Uint8Array = new Uint8Array(0);
    let writeAt: Float32Array = new Float32Array(0);

    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      // fallbacks are CSS keywords, never literal colour values — only
      // reached if the token is somehow undefined on documentElement
      bg = root.getPropertyValue("--background").trim() || "transparent";
      fg = root.getPropertyValue("--foreground").trim() || "currentColor";
      muted = root.getPropertyValue("--ns-muted").trim() || fg;
    };

    const allocCols = () => {
      patterns = new Uint8Array(cols);
      writeAt = new Float32Array(cols).fill(-Infinity);
    };

    // globalT: seconds, drives the generative field. Never resets.
    let globalT = 0;
    const numGroups = () => Math.max(1, Math.ceil(cols / GROUP_COLS));
    // step machine: stepIndex 0..numGroups-1 writes that column-group,
    // stepIndex===numGroups is the sync pause.
    let stepIndex = 0;
    let stepAcc = 0;

    const stepDuration = (i: number) => (i < numGroups() ? COLUMN_INTERVAL_MS : PAUSE_MS);

    const writeGroup = (groupIndex: number) => {
      if (!sized) return;
      const start = groupIndex * GROUP_COLS;
      const end = Math.min(cols, start + GROUP_COLS);
      for (let c = start; c < end; c++) {
        patterns[c] = subCellPattern(c, globalT);
        writeAt[c] = globalT;
      }
    };

    // full pass at increasing globalT — used after a resize (a new column
    // count leaves nothing painted otherwise) and, twice, to reach the
    // reduced-motion freeze frame.
    const warmPass = () => {
      const groups = numGroups();
      for (let g = 0; g < groups; g++) {
        globalT += COLUMN_INTERVAL_MS / 1000;
        writeGroup(g);
      }
      stepIndex = 0;
      stepAcc = 0;
    };

    // the FIRST paint only: a real videotex page never opens fully blank,
    // but it also never opens fully painted — it opens mid-transmission.
    // Write roughly the first half of the column-groups so t0 reads as a
    // genuine mid-sweep frame (half written, half still open background),
    // with the just-written group's flash visible at the leading edge, and
    // park the step machine right there so the loop continues the same
    // sweep rather than restarting it.
    const partialWarmStart = () => {
      const groups = numGroups();
      const half = Math.max(1, Math.floor(groups / 2));
      for (let g = 0; g < half; g++) {
        globalT += COLUMN_INTERVAL_MS / 1000;
        writeGroup(g);
      }
      stepIndex = half;
      stepAcc = 0;
    };

    const resize = () => {
      const { width } = canvas.getBoundingClientRect();
      if (width < 2) {
        sized = false;
        return;
      }
      if (sized && Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.max(4, Math.floor(width / cellW));
      sized = true;
      allocCols();
    };

    const draw = () => {
      if (!sized) return;
      ctx.clearRect(0, 0, cols * cellW + cellW, height);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cols * cellW + cellW, height);

      for (let c = 0; c < cols; c++) {
        const bits = patterns[c];
        if (bits === 0) continue;
        const flashing = !reduced && globalT - writeAt[c] < COLUMN_INTERVAL_MS / 1000;
        ctx.fillStyle = flashing ? fg : muted;
        const x = c * cellW;
        for (let subRow = 0; subRow < SUB_ROWS; subRow++) {
          for (let subCol = 0; subCol < SUB_COLS; subCol++) {
            const idx = subRow * SUB_COLS + subCol;
            if (!(bits & (1 << idx))) continue;
            const bx = Math.round(x + subCol * subCell + gap);
            const by = Math.round(subRow * subCell + gap);
            ctx.fillRect(bx, by, Math.ceil(block), Math.ceil(block));
          }
        }
      }
    };

    // -- loop ----------------------------------------------------------------
    let raf = 0;
    let last = 0;

    const loop = (now: number) => {
      const dtMs = last ? Math.min(250, now - last) : 1000 / 60;
      last = now;
      globalT += dtMs / 1000;
      stepAcc += dtMs;

      const groups = numGroups();
      let guard = 0;
      while (stepAcc >= stepDuration(stepIndex) && guard < groups + 1) {
        stepAcc -= stepDuration(stepIndex);
        if (stepIndex < groups) writeGroup(stepIndex);
        stepIndex = (stepIndex + 1) % (groups + 1);
        guard++;
      }

      draw();
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        readTokens();
        resize();
        // a resize invalidates the previous column count/layout entirely —
        // repaint the whole band rather than leaving half of it blank
        if (sized) {
          warmPass();
          if (reduced) stepIndex = numGroups();
        }
        draw();
      }, 150);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting;
        if (visible && !reduced && sized) {
          cancelAnimationFrame(raf);
          last = 0;
          raf = requestAnimationFrame(loop);
        } else if (!visible) {
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced && sized) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // no paint before the first token read
    readTokens();
    resize();

    if (reduced) {
      // freeze mid-PAUSE_MS hold: a warm start pass, then one full extra
      // pass past it so every column-group has been rewritten at least
      // twice (field clear of its cold-start state), then land stepIndex
      // on the pause slot with no flash — every column filled, full
      // separated-gap tile structure legible edge to edge. Explicitly not
      // t0's half-written sweep state.
      warmPass();
      warmPass();
      stepIndex = numGroups();
      draw();
    } else {
      partialWarmStart();
      draw();
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [height]);

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={`ns-dms w-full ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block w-full"
        style={{ height }}
      />
    </div>
  );
}
