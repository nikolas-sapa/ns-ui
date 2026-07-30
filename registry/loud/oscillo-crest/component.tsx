"use client";

import { useEffect, useRef, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// OscilloCrest — an instrument-register waveform hero. A wide trace, drawn
// full-width in a monospace glyph grid, is the SUM of three harmonics (a
// dominant fundamental plus two weaker overtones at different spatial
// frequencies and phase speeds) so it has real structure rather than a bare
// sine. Consecutive columns are connected with box-drawing corner glyphs
// (╮ ╭ ╰ ╯) and vertical rule (│) rather than one dot per column, so the
// trace reads as one continuous line even where the slope is steep, never a
// scatter of disconnected points. The pointer EXCITES the line: moving over
// it injects velocity into a real 1D wave-equation simulation at that column
// (finite-difference, fixed-point ends, explicit damping), which propagates
// outward to neighboring columns as a travelling disturbance and rings out
// over roughly a second — the base waveform is undisturbed, the excitation
// is a separate displacement layer summed on top and always settles back to
// zero. A box-drawing frame and a live amplitude/frequency readout are drawn
// as canvas glyphs, so the whole thing reads as an instrument, not a chart.
// Canvas 2D, direct-DOM rAF, all buffers (displacement, velocity, per-column
// row, char grid) allocated once per resize and reused every frame.
// ---------------------------------------------------------------------------

const WAVE_C2 = 620; // simulated tension coefficient, columns^2/s^2
const DAMPING = 3.1; // s^-1 — rings out to ~4% amplitude in ~1.1s
const SUBSTEP = 1 / 120; // s — fixed physics substep for stability
const EXCITE_GAIN = 0.09; // velocity injected per px/frame of pointer speed
const EXCITE_SPREAD = 2; // columns either side of the pointer that catch some energy
const MAX_VEL = 5; // clamp on injected velocity
const DISP_CLAMP = 0.85; // hard ceiling on the excitation layer, so even an extreme drag rings instead of pinning flat against the frame
const DT_MAX = 0.05;

function waveBase(x: number, t: number, ff: number): number {
  const a = Math.sin(x * 0.09 * ff + t * 1.3);
  const b = 0.5 * Math.sin(x * 0.19 * ff - t * 2.05 + 0.7);
  const c = 0.28 * Math.sin(x * 0.035 * ff + t * 0.7);
  return (a + b + c) / 1.78;
}

export interface OscilloCrestProps {
  /** trace amplitude, 0..1 fraction of the interior half-height */
  amplitude?: number;
  /** base frequency shown on the readout and used to scale the waveform's spatial frequency */
  frequency?: number;
  /** grid cell size in px */
  cellSize?: number;
  className?: string;
  /** optional headline, laid over the field */
  children?: ReactNode;
}

export function OscilloCrest({
  amplitude = 0.6,
  frequency = 2.4,
  cellSize = 14,
  className = "",
  children,
}: OscilloCrestProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let fg = "currentColor";
    let muted = "currentColor";
    let cellW = cellSize;
    let cellH = cellSize;
    let cols = 0;
    let rows = 0;
    let dpr = 1;
    let sized = false;
    let ready = false;
    let disposed = false;

    let rMinRow = 0;
    let rMaxRow = 0; // exclusive
    let rMinCol = 0;
    let rMaxCol = 0; // exclusive
    let n = 0; // interior column count

    let disp = new Float32Array(0);
    let vel = new Float32Array(0);
    let accel = new Float32Array(0);
    let yBuf = new Float32Array(0);
    let charBuf = new Uint8Array(0);

    const PALETTE = [" ", "─", "│", "╮", "╭", "╰", "╯"];

    const readTokens = () => {
      fg = getComputedStyle(canvas).color;
      muted =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--muted")
          .trim() || fg;
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

      cols = Math.max(12, Math.floor(width / cellW));
      rows = Math.max(8, Math.floor(height / cellH));

      rMinRow = 2;
      rMaxRow = rows - 1;
      rMinCol = 1;
      rMaxCol = cols - 1;
      n = Math.max(2, rMaxCol - rMinCol);

      disp = new Float32Array(n);
      vel = new Float32Array(n);
      accel = new Float32Array(n);
      yBuf = new Float32Array(n);
      charBuf = new Uint8Array(cols * rows);
      centerRow = (rMinRow + rMaxRow - 1) / 2;
      halfRows = (rMaxRow - rMinRow) / 2 - 0.6;
      sized = true;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) draw(0);
      }, 150);
    };

    const stepPhysics = (dt: number) => {
      for (let i = 1; i < n - 1; i++) {
        accel[i] =
          WAVE_C2 * (disp[i - 1] - 2 * disp[i] + disp[i + 1]) -
          DAMPING * vel[i];
      }
      for (let i = 1; i < n - 1; i++) {
        vel[i] += accel[i] * dt;
        let d = disp[i] + vel[i] * dt;
        if (d > DISP_CLAMP) {
          d = DISP_CLAMP;
          if (vel[i] > 0) vel[i] = 0;
        } else if (d < -DISP_CLAMP) {
          d = -DISP_CLAMP;
          if (vel[i] < 0) vel[i] = 0;
        }
        disp[i] = d;
      }
      // fixed ends — energy reflects off the anchored edges, never escapes as NaN
      disp[0] = 0;
      vel[0] = 0;
      disp[n - 1] = 0;
      vel[n - 1] = 0;
    };

    const drawFrame = () => {
      ctx.fillStyle = muted;
      ctx.globalAlpha = 0.85;
      const cx = (c: number) => c * cellW + cellW / 2;
      const cy = (r: number) => r * cellH + cellH / 2;
      ctx.fillText("┌", cx(0), cy(0));
      ctx.fillText("┐", cx(cols - 1), cy(0));
      ctx.fillText("└", cx(0), cy(rows - 1));
      ctx.fillText("┘", cx(cols - 1), cy(rows - 1));
      for (let c = 1; c < cols - 1; c++) {
        ctx.fillText("─", cx(c), cy(0));
        ctx.fillText("─", cx(c), cy(rows - 1));
      }
      for (let r = 1; r < rows - 1; r++) {
        ctx.fillText("│", cx(0), cy(r));
        ctx.fillText("│", cx(cols - 1), cy(r));
      }
      const label = `AMP ${amplitude.toFixed(2)}  FREQ ${frequency.toFixed(2)}Hz`;
      const interiorW = cols - 2;
      const start = Math.max(1, 1 + Math.floor((interiorW - label.length) / 2));
      for (let i = 0; i < label.length && start + i < cols - 1; i++) {
        const ch = label[i];
        if (ch === " ") continue;
        ctx.fillText(ch, cx(start + i), cy(1));
      }
      ctx.globalAlpha = 1;
    };

    const setCell = (col: number, row: number, code: number) => {
      const r = Math.max(rMinRow, Math.min(rMaxRow - 1, row));
      charBuf[r * cols + col] = code;
    };

    // draws the transition from r0 to r1 in the given column with box-drawing
    // corner glyphs so it reads as one continuous stroke, never a dotted plot
    const drawSegment = (col: number, r0: number, r1: number) => {
      if (r0 === r1) {
        setCell(col, r0, 1); // ─
        return;
      }
      const top = Math.min(r0, r1);
      const bot = Math.max(r0, r1);
      const movingDown = r1 > r0; // top row is the segment's start
      for (let r = top; r <= bot; r++) {
        if (r === top) setCell(col, r, movingDown ? 3 : 4); // ╮ : ╭
        else if (r === bot) setCell(col, r, movingDown ? 5 : 6); // ╰ : ╯
        else setCell(col, r, 2); // │
      }
    };

    let centerRow = 0;
    let halfRows = 1;

    const draw = (t: number) => {
      if (!sized) return;
      const w = cols * cellW;
      const h = rows * cellH;
      ctx.clearRect(0, 0, w, h);
      charBuf.fill(0);

      const ff = frequency / 2.4;
      for (let i = 0; i < n; i++) {
        const base = waveBase(i, t, ff) * amplitude;
        const combined = Math.max(-1.15, Math.min(1.15, base + disp[i]));
        yBuf[i] = centerRow - combined * halfRows;
      }

      let prevRow = Math.round(yBuf[0]);
      drawSegment(rMinCol, prevRow, prevRow);
      for (let i = 1; i < n; i++) {
        const row = Math.round(yBuf[i]);
        drawSegment(rMinCol + i, prevRow, row);
        prevRow = row;
      }

      ctx.fillStyle = fg;
      for (let r = rMinRow; r < rMaxRow; r++) {
        for (let c = rMinCol; c < rMaxCol; c++) {
          const code = charBuf[r * cols + c];
          if (!code) continue;
          ctx.fillText(
            PALETTE[code],
            c * cellW + cellW / 2,
            r * cellH + cellH / 2
          );
        }
      }
      drawFrame();
    };

    // -- hot-path state: locals only, never React state --------------------
    let raf = 0;
    let last = 0;
    let t = 0;
    let px = -1e5;
    let py = -1e5;
    let havePrev = false;

    const loop = (now: number) => {
      const dtFrame = last ? Math.min(DT_MAX, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dtFrame;
      // fixed substeps keep the explicit integrator stable even after a
      // large dt (e.g. resuming from a hidden tab)
      let remaining = dtFrame;
      while (remaining > 0) {
        const step = Math.min(SUBSTEP, remaining);
        stepPhysics(step);
        remaining -= step;
      }
      draw(t);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const excite = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (havePrev) {
        const speed = Math.hypot(x - px, y - py);
        const col = Math.round(x / cellW) - rMinCol;
        if (speed > 0.5 && col > 0 && col < n - 1) {
          const impulse = Math.min(MAX_VEL, speed * EXCITE_GAIN);
          for (let d = -EXCITE_SPREAD; d <= EXCITE_SPREAD; d++) {
            const i = col + d;
            if (i <= 0 || i >= n - 1) continue;
            const falloff = Math.exp(-(d * d) / (EXCITE_SPREAD || 1));
            vel[i] += impulse * falloff;
          }
        }
      }
      px = x;
      py = y;
      havePrev = true;
    };

    const onMove = (e: PointerEvent) => excite(e.clientX, e.clientY);
    const onLeave = () => {
      havePrev = false;
    };
    const onVis = () => {
      if (!document.hidden && !reduced && ready) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw(t);
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // rasterize only once the mono webfont is loaded — a fallback-font
    // measurement bakes in the wrong grid aspect ratio
    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      ready = true;
      if (reduced) {
        draw(0); // real harmonic structure at t=0, disp all zero — the correct settled frame
      } else {
        raf = requestAnimationFrame(loop);
      }
    });

    window.addEventListener("resize", onResize);
    if (!reduced) {
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerleave", onLeave);
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [amplitude, frequency, cellSize]);

  return (
    <div className={`relative h-full w-full ${className}`}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="block h-full w-full font-mono text-foreground"
      />
      {children ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
