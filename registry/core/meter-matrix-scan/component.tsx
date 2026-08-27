"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// MeterMatrixScan — a level meter rendered as a genuinely row-multiplexed
// LED dot-matrix panel.
//
// SOURCE, NOT INVENTED: cheap commercial LED dot-matrix signage (scrolling
// ticker boards, gym scoreboards, elevator floor indicators, budget
// character displays built on row/column multiplex driver chips) can't
// afford one continuous driver per LED. Instead the panel scans one row at
// a time at a frequency well above human flicker fusion, relying on
// persistence of vision to read a complete static image, and within each
// row's brief active slice an individual LED's apparent brightness is set
// by PWM (pulse-width modulation) duty cycle — fully on or fully off at any
// instant, perceived brightness being the fraction of the row's active
// window it spends on, quantized to a small number of duty steps. That
// quantized time-division duty cycle (not a continuous alpha/density value)
// is this component's entire identity, distinct from every other
// ASCII/glyph-luminance component in the registry.
//
// THE ROW-SCAN ARTIFACT: a real multiplex board's per-row scan is invisible
// at rest — that's the whole point of persistence of vision. It only ever
// becomes visible when something samples the panel at a rate that doesn't
// divide evenly into its own full-panel refresh, e.g. filming an LED sign
// with a camera whose shutter/frame rate doesn't line up with the panel's
// scan rate produces a soft band drifting through the image (the reason
// dashcam footage sometimes shows a faint bar through LED signage). A literal
// 1:1 real-time render of the raw ROW_SCAN_HZ clock against a ~60Hz browser
// paint rate aliases close enough to the paint rate itself to read as a hard
// strobe/flicker — a rendering-pipeline artifact, not the calm hardware
// phenomenon it's meant to represent. So the scan address (ROW_SCAN_HZ,
// documented below, is the real underlying clock) is deliberately mapped onto
// a slow, continuous sweep position instead of a discrete per-frame row
// index: a soft brightness gradient a couple of rows wide, low amplitude,
// drifting the full height of the panel and back over several seconds — the
// same round-robin row addressing concept, legible on a second look, without
// ever strobing near the paint rate.
// ---------------------------------------------------------------------------

const ROWS = 5;
const ROW_SCAN_HZ = 240; // real per-row multiplex clock this component represents
const PWM_LEVELS = 8; // 3-bit duty-cycle depth
const GUTTER_PX = 3; // gap between dots, ~2-4px per spec
const SWEEP_PERIOD_S = 7.5; // one full down-and-back sweep across the panel
const SWEEP_SIGMA_ROWS = 1.4; // gradient softness, in rows — wide, not a 1-row strip
const SCAN_HIGHLIGHT_ALPHA = 0.055; // luminance-only, low-amplitude boost at the sweep's center
const MIN_ON_ALPHA = 0.16; // floor so PWM band 1/8 never rounds to invisible in light theme

// slow generative "sensor" field used only when no external `value` prop is
// supplied — three non-commensurate traveling sine components, amplitude
// bounded so the simulated reading stays comfortably inside 0..100.
function sensorValue(t: number) {
  const f =
    Math.sin(t * 0.17) + 0.5 * Math.sin(t * 0.43 + 1.3) + 0.3 * Math.sin(t * 0.08 + 2.1);
  const norm = f / 1.8; // amplitude sum 1.8 -> -1..1
  return 55 + norm * 32; // ~23..87
}

// continuous sweep position, in row units (0..ROWS-1), a slow triangle wave
// so the drift is smooth and reverses without a jump-cut at either end
function sweepPosition(t: number) {
  const phase = (t % SWEEP_PERIOD_S) / SWEEP_PERIOD_S; // 0..1
  const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2; // 0 -> 1 -> 0
  return tri * (ROWS - 1);
}

export interface MeterMatrixScanProps {
  /** current level, 0..max. Omit to drive the meter from an internal simulated sensor read. */
  value?: number;
  /** domain ceiling for value. Default 100. */
  max?: number;
  /** accessible name for the reading, e.g. "CPU load". Default "Level". */
  label?: string;
  /** panel height in px; ROWS=5 fixed, cell size derives as height / 5. Default 60. */
  height?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function MeterMatrixScan({
  value,
  max = 100,
  label = "Level",
  height = 60,
  className = "",
}: MeterMatrixScanProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let bg = "";
    let fg = "";

    const cellSize = Math.max(2, height / ROWS);
    const radius = Math.max(1, (cellSize - GUTTER_PX) / 2);

    let cols = 0;
    let sized = false;
    let lastWidth = 0;

    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      // fallbacks are CSS keywords, never literal colour values
      bg = root.getPropertyValue("--background").trim() || "transparent";
      fg = root.getPropertyValue("--foreground").trim() || "currentColor";
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
      cols = Math.max(6, Math.floor(width / cellSize));
      sized = true;
    };

    // globalT: seconds, drives both the simulated sensor field (when
    // `value` is uncontrolled) and the sweep position. Never resets.
    let globalT = 0;

    const currentValue = () => {
      const external = valueRef.current;
      const v = external === undefined ? sensorValue(globalT) : external;
      return Math.min(max, Math.max(0, v));
    };

    const draw = (sweepPos: number | null) => {
      if (!sized) return;
      const w = cols * cellSize;
      ctx.clearRect(0, 0, w, height);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, height);

      const filled = (currentValue() / max) * cols;
      const fullCols = Math.min(cols, Math.floor(filled));
      const frac = filled - fullCols;
      // fractional boundary LED's brightness is a literal quantized PWM
      // duty step, never a smooth alpha ramp
      const boundaryLevel = Math.round(frac * PWM_LEVELS);

      for (let r = 0; r < ROWS; r++) {
        const cy = r * cellSize + cellSize / 2;
        // soft Gaussian weight of this row against the sweep's current
        // center — a wide, low-amplitude bump, not a hard on/off strip, so
        // several rows share a gentle gradient rather than one strobing
        let sweepBoost = 0;
        if (sweepPos !== null) {
          const d = r - sweepPos;
          sweepBoost = SCAN_HIGHLIGHT_ALPHA * Math.exp(-(d * d) / (2 * SWEEP_SIGMA_ROWS * SWEEP_SIGMA_ROWS));
        }
        for (let c = 0; c < cols; c++) {
          let level = 0;
          if (c < fullCols) level = PWM_LEVELS;
          else if (c === fullCols) level = boundaryLevel;
          if (level <= 0) continue;

          let alpha = level / PWM_LEVELS;
          alpha = Math.max(MIN_ON_ALPHA, alpha);
          alpha = Math.min(1, alpha + sweepBoost);

          const cx = c * cellSize + cellSize / 2;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // the same soft gradient laid across only the off (background)
        // columns of this row — what makes the sweep legible independent of
        // the value fill, luminance only, never a hard band. Confined to the
        // unlit region so it never stacks on top of an already-boosted dot.
        const offStartX = Math.min(w, (fullCols + 1) * cellSize);
        if (sweepBoost > 0.002 && offStartX < w) {
          ctx.globalAlpha = sweepBoost * 0.7;
          ctx.fillStyle = fg;
          ctx.fillRect(offStartX, r * cellSize, w - offStartX, cellSize);
        }
      }
      ctx.globalAlpha = 1;

      wrapper.setAttribute("aria-valuenow", String(Math.round(currentValue())));
    };

    // -- loop ----------------------------------------------------------------
    let raf = 0;
    let last = 0;

    const loop = (now: number) => {
      const dtMs = last ? Math.min(250, now - last) : 1000 / 60;
      last = now;
      globalT += dtMs / 1000;
      draw(sweepPosition(globalT));
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(null);
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
        draw(reduced ? null : sweepPosition(globalT));
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
      // freeze with the sweep locked off entirely — no gradient visible,
      // every row rendered as if simultaneously lit at its true duty level —
      // at a value past the field's cold-start instant, same convention as
      // this registry's other generative components.
      globalT = 1.4;
      draw(null);
    } else {
      draw(sweepPosition(globalT));
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
  }, [height, max]);

  return (
    <div
      ref={wrapperRef}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      className={`ns-mms w-full ${className}`}
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
