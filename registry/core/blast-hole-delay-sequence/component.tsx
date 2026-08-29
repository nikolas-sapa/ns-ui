"use client";

// ---------------------------------------------------------------------------
// BlastRoundPattern — a bench-blast shot pattern: a grid of charged holes
// that fires row by row on a fixed delay wave, not all at once. Real
// electronic detonators run 25-50ms between rows (far too fast to read as
// a sequence), so the row cadence here is deliberately decoupled from that
// real rate and rendered 36x slower at 900ms/row — the real number is
// documented, the animation is the legible one.
//
// Each cell is a div whose crater is painted from two CSS custom properties,
// --fire (0 unfired -> 1 peak flash) and --spent (0 fresh -> 1 spent-dark),
// set directly on the row wrapper each frame (never React state) and read
// by every cell in that row through ordinary CSS inheritance — one rAF
// write per row, not per cell. Every colour is `var(--foreground)` /
// `var(--ns-muted)` mixed against itself or scaled with `filter:brightness`,
// so direction (darker/lighter) tracks whichever theme is active without
// ever branching on it in JS.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";

const MIN_GRID = 6;
const MAX_GRID = 9;
const TARGET_CELL_PX = 32;

const ROW_DELAY_MS = 900; // decoupled render rate; real electronic-det. delay is 25-50ms/row
const RISE_MS = 80;
const HOLD_MS = 120;
const DECAY_MS = 600;
const FLASH_MS = RISE_MS + HOLD_MS + DECAY_MS; // 800ms — a row is fully spent 100ms before the next fires
const CLEARED_PAUSE_MS = 2000;
const RECHARGE_PER_ROW_MS = 250;

// loop-start phase: mounts mid-hold on row 0 so t0 already shows motion
const START_PHASE_MS = RISE_MS + HOLD_MS / 2;

const SPENT_BRIGHTNESS_FLOOR = 0.38; // filter:brightness() applied to muted — always darker, both themes

function computeGridSize(minDim: number): number {
  const n = Math.round(minDim / TARGET_CELL_PX);
  return Math.min(MAX_GRID, Math.max(MIN_GRID, n));
}

// ease-out for the rise, ease-in for the decay — fast punch, slow settle
function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}
function easeInCubic(t: number): number {
  return t * t * t;
}

// Per-row (--fire, --spent) at a given time-into-pattern (can be negative
// before the row's own fireStart, and keeps returning "spent" indefinitely
// after the row finishes until the recharge sweep resets it explicitly).
function rowFireState(tSinceRowStart: number): { fire: number; spent: number } {
  if (tSinceRowStart < 0) return { fire: 0, spent: 0 };
  if (tSinceRowStart < RISE_MS) {
    return { fire: easeOutCubic(tSinceRowStart / RISE_MS), spent: 0 };
  }
  if (tSinceRowStart < RISE_MS + HOLD_MS) {
    return { fire: 1, spent: 0 };
  }
  if (tSinceRowStart < FLASH_MS) {
    const d = easeInCubic((tSinceRowStart - RISE_MS - HOLD_MS) / DECAY_MS);
    return { fire: 1 - d, spent: d };
  }
  return { fire: 0, spent: 1 };
}

export interface BlastRoundPatternProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible label for the pattern */
  "aria-label"?: string;
}

export function BlastRoundPattern({
  className = "",
  "aria-label": ariaLabel = "Blast round delay sequence",
}: BlastRoundPatternProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [gridSize, setGridSize] = useState(MIN_GRID);

  // grid size tracks the container's smaller dimension, so the pattern
  // reads as 6x6 at card scale and grows toward 9x9 on a larger card
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentBoxSize?.[0];
      const w = box ? box.inlineSize : entry.contentRect.width;
      const h = box ? box.blockSize : entry.contentRect.height;
      setGridSize(computeGridSize(Math.min(w, h)));
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rowEls = rowRefs.current.slice(0, gridSize);

    const cycleFireMs = gridSize * ROW_DELAY_MS;
    const cycleMs = cycleFireMs + CLEARED_PAUSE_MS + gridSize * RECHARGE_PER_ROW_MS;

    const paint = (phase: number) => {
      for (let r = 0; r < rowEls.length; r++) {
        const el = rowEls[r];
        if (!el) continue;

        const rowFireStart = r * ROW_DELAY_MS;
        const rechargeStart = cycleFireMs + CLEARED_PAUSE_MS + r * RECHARGE_PER_ROW_MS;

        let fire = 0;
        let spent: number;

        if (phase < cycleFireMs + CLEARED_PAUSE_MS) {
          // firing phase + the cleared pause that follows it
          const st = rowFireState(phase - rowFireStart);
          fire = st.fire;
          spent = st.spent;
        } else if (phase < rechargeStart) {
          // row hasn't reached its turn in the recharge sweep yet
          spent = 1;
        } else if (phase < rechargeStart + RECHARGE_PER_ROW_MS) {
          // quiet reset, no flash: spent eases back to 0 over its 250ms slot
          const t = (phase - rechargeStart) / RECHARGE_PER_ROW_MS;
          spent = 1 - t;
        } else {
          spent = 0;
        }

        el.style.setProperty("--fire", fire.toFixed(4));
        el.style.setProperty("--spent", spent.toFixed(4));
      }
    };

    if (reduced) {
      // frozen freeze-frame: rows before "4" spent-dark, row 4 (index 3) at
      // peak flash, the rest still unfired-dim — the one frame that shows
      // all three states at once, which no point in the live loop pins down
      const frozenRow = Math.min(3, gridSize - 1);
      for (let r = 0; r < rowEls.length; r++) {
        const el = rowEls[r];
        if (!el) continue;
        if (r < frozenRow) {
          el.style.setProperty("--fire", "0");
          el.style.setProperty("--spent", "1");
        } else if (r === frozenRow) {
          el.style.setProperty("--fire", "1");
          el.style.setProperty("--spent", "0");
        } else {
          el.style.setProperty("--fire", "0");
          el.style.setProperty("--spent", "0");
        }
      }
      return;
    }

    let raf = 0;
    let visible = true;
    const start = performance.now() - START_PHASE_MS;

    const loop = (now: number) => {
      if (visible) {
        const phase = (now - start) % cycleMs;
        paint(phase < 0 ? phase + cycleMs : phase);
      }
      raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    const root = rootRef.current;
    if (root) io.observe(root);

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [gridSize]);

  const cells = Array.from({ length: gridSize });

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={ariaLabel}
      className={`relative flex items-center justify-center overflow-hidden bg-background p-[6%] ${className}`}
    >
      <style>{`
.ns-bhds-grid{
  display: grid;
  gap: 12%;
  width: 100%;
  height: 100%;
  aspect-ratio: 1 / 1;
  max-width: 100%;
  max-height: 100%;
}
.ns-bhds-row{
  display: contents;
}
.ns-bhds-cell{
  position: relative;
  border-radius: 999px;
  background-color: color-mix(
    in oklch,
    var(--ns-muted),
    var(--foreground) calc(var(--fire, 0) * 100%)
  );
  filter: brightness(calc(1 - var(--spent, 0) * ${1 - SPENT_BRIGHTNESS_FLOOR}));
  box-shadow: 0 0 calc(var(--fire, 0) * 18%)
    color-mix(in srgb, var(--foreground) calc(var(--fire, 0) * 60%), transparent);
  transition: filter 60ms linear;
}
.ns-bhds-cell::after{
  content: "";
  position: absolute;
  inset: 22%;
  border-radius: 999px;
  background: color-mix(in srgb, var(--background) calc(38% - var(--fire, 0) * 30%), transparent);
}
`}</style>
      <div
        className="ns-bhds-grid"
        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gridTemplateRows: `repeat(${gridSize}, 1fr)` }}
      >
        {cells.map((_, r) => (
          <div
            key={r}
            ref={(el) => {
              rowRefs.current[r] = el;
            }}
            className="ns-bhds-row"
            style={{ gridRow: r + 1 }}
          >
            {cells.map((__, c) => (
              <div key={c} className="ns-bhds-cell" style={{ gridRow: r + 1, gridColumn: c + 1 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
