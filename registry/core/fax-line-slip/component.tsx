"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// FaxLineSlip — a document-preview / attachment-thumbnail loading state
// reproducing a Group 3 fax handshake and page transmission, not a generic
// spinner or shimmer. Source: ITU-T T.30 handshake tones (calling machine
// sends a pulsed CNG tone, the answering machine holds a CED tone) followed
// by the page transmitting as sequential horizontal scan lines at the
// negotiated modem rate, plus the documented thermal-fax mechanical fault
// where the paper momentarily slips through the feed rollers mid-page,
// shearing a thin band of the received image sideways before lines resume
// true.
//
// One cycle, four phases, drawn onto a single persistent canvas that is
// never cleared mid-build (a real received page is composed, not repainted):
//
// 1. Handshake (2200ms): a waveform trace occupies the top ~15% of the
//    frame. A tight-period sine burst stands in for the 1100Hz CNG tone
//    (500ms), a silent 500ms gap, then a tighter-period burst stands in for
//    the 2100Hz CED tone (1200ms) — 500+500+1200 = 2200ms exactly, drawn at
//    human-followable pace because it already is one (not sped up).
// 2. Scan build: one scan line commits every 45ms (~22 lines/sec — real G3
//    at 9600bps is ~5-6 lines/sec, but rendering 220 lines at that real rate
//    would take ~40s, unbearably slow for a resting loop, so this is
//    compressed for pace, not decoupled for alias-avoidance). Line count is
//    derived from the container's own smaller dimension (one line per ~2px
//    of height, capped at 220) so the build reads at card scale. At a
//    randomized point 55-75% down the frame, one 3-line band commits with a
//    hard 14-22px horizontal offset baked permanently into those three
//    lines — the paper-slip artifact — then the very next line resumes at
//    zero offset with no easing, because a real slip is a sudden mechanical
//    discontinuity, not a glitch that repeats.
// 3. Hold (1800ms): the fully composed page sits still.
// 4. Reset (200ms): the frame does not fade — it clears top-to-bottom in one
//    wipe, mirroring a fresh page feeding in, then the handshake replays
//    with a freshly reseeded page and a freshly randomized slip position.
//
// The "document" content itself is a procedural stand-in for scanned text —
// deterministic hash-derived horizontal strokes with word-like gaps, grouped
// into text lines with occasional paragraph breaks — reseeded every cycle so
// no two received pages look identical. `--ns-accent` never appears; ink is
// `--foreground` over a `--background` field, read live via
// getComputedStyle + a MutationObserver on the theme class, matching the dark
// marks on light stock a real thermal print reads (dark theme inverts the
// relationship rather than swapping which token is which).
// ---------------------------------------------------------------------------

export interface FaxLineSlipProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
  /** sr-only status text describing the loading state */
  label?: string;
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

function hash01(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// -- handshake timing: 500ms CNG-stand-in burst, 500ms silence, 1200ms
// CED-stand-in burst — total 2200ms, real ITU-T T.30 pace, not compressed. --
const BURST1_MS = 500;
const GAP_MS = 500;
const BURST2_MS = 1200;
const HANDSHAKE_MS = BURST1_MS + GAP_MS + BURST2_MS; // 2200ms
const BURST1_CYCLES = 15; // tight-period trace standing in for 1100Hz
const BURST2_CYCLES = 28; // tighter-period trace standing in for 2100Hz

// -- scan build: one committed line every 45ms, capped at 220 for card scale --
const LINE_INTERVAL_MS = 45;
const MAX_LINES = 220;
const MIN_LINES = 30;
const SLIP_BAND_LINES = 3;
const SLIP_MIN_PX = 14;
const SLIP_MAX_PX = 22;
const SLIP_RANGE_START = 0.55; // fraction down the frame the slip may start
const SLIP_RANGE_SPAN = 0.2; // 0.55 - 0.75

const HOLD_MS = 1800;
const WIPE_MS = 200;

export function FaxLineSlip({ className = "", style, label = "Connecting" }: FaxLineSlipProps) {
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

    // -- token-derived ink/paper: read at mount, re-derived on theme change --
    let fg: RGB = [0, 0, 0];
    let bg: RGB = [255, 255, 255];
    let fgCSS = "rgb(0,0,0)";
    let bgCSS = "rgb(255,255,255)";
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      fgCSS = `rgb(${fg[0]},${fg[1]},${fg[2]})`;
      bgCSS = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    };
    derive();

    let w = 0;
    let h = 0;
    let dpr = 1;
    let lineCount = MIN_LINES;
    let rowH = 1;
    let letterCell = 3;
    let lineSpacing = 7;
    let marginPx = 6;

    let seed = 0;
    let slipStartLine = -1;
    let slipOffsetPx = 0;
    let cycleBase = 0;
    let cycleIndex = 0;
    let lastLineDrawn = -1;
    let scanCleared = false;

    let raf = 0;
    let visible = true;

    // -- one procedurally-baked text line's metadata: blank (paragraph gap)
    // or a right margin fraction, deterministic per lineIndex+seed so every
    // raster row belonging to that text line agrees on its shape. ----------
    const lineMeta = (lineIndex: number) => {
      const blankRoll = hash01(lineIndex * 1.7 + seed, 3.1);
      if (blankRoll < 0.12) return { blank: true, widthFrac: 0 };
      const widthFrac = 0.45 + hash01(lineIndex * 2.3 + seed, 7.7) * 0.45;
      return { blank: false, widthFrac };
    };

    // -- commit one raster row of the document's baked content, offset in x
    // by xOffsetPx when this row falls inside the current cycle's slip band. --
    const drawDocumentRow = (y0: number, y1: number, xOffsetPx: number) => {
      const midY = (y0 + y1) / 2;
      const lineIndex = Math.floor(midY / lineSpacing);
      const meta = lineMeta(lineIndex);
      if (meta.blank) return;
      const bandFrac = (midY - lineIndex * lineSpacing) / lineSpacing;
      if (bandFrac > 0.5) return; // gap between text lines
      const usableW = w - marginPx * 2;
      const rightEdge = marginPx + meta.widthFrac * usableW;
      ctx.fillStyle = fgCSS;
      for (let x = marginPx; x < rightEdge; x += letterCell) {
        const bucket = Math.floor(x / letterCell);
        const v = hash01(lineIndex * 5.13 + seed, bucket * 3.71 + seed);
        if (v > 0.34) {
          ctx.fillRect(x + xOffsetPx, y0, letterCell * 0.82, Math.max(1, y1 - y0));
        }
      }
    };

    const clearCanvas = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = bgCSS;
      ctx.fillRect(0, 0, w, h);
    };

    const commitLine = (lineIdx: number) => {
      const y0 = lineIdx * rowH;
      const y1 = y0 + rowH;
      const inSlip = lineIdx >= slipStartLine && lineIdx < slipStartLine + SLIP_BAND_LINES;
      drawDocumentRow(y0, y1, inSlip ? slipOffsetPx : 0);
    };

    const drawWaveform = (t: number) => {
      const bandH = h * 0.15;
      ctx.fillStyle = bgCSS;
      ctx.fillRect(0, 0, w, bandH);
      const midY = bandH * 0.5;
      const amp = bandH * 0.32;
      ctx.strokeStyle = fgCSS;
      ctx.lineWidth = Math.max(1, Math.min(w, h) / 220);

      const drawBurst = (revealFrac: number, cycles: number) => {
        if (revealFrac <= 0) return;
        const revealW = w * revealFrac;
        const steps = Math.max(2, Math.floor(revealW / 2));
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * revealW;
          const phase = (x / w) * cycles * Math.PI * 2;
          const y = midY + Math.sin(phase) * amp;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      if (t < BURST1_MS) {
        drawBurst(t / BURST1_MS, BURST1_CYCLES);
      } else if (t < BURST1_MS + GAP_MS) {
        // silent gap — band stays clear
      } else {
        const t2 = t - BURST1_MS - GAP_MS;
        drawBurst(Math.min(1, t2 / BURST2_MS), BURST2_CYCLES);
      }
    };

    const drawWipe = (frac: number) => {
      ctx.fillStyle = bgCSS;
      ctx.fillRect(0, 0, w, h * frac);
    };

    const reseedCycle = () => {
      seed = cycleIndex * 811.7;
      const rand = mulberry32(0x9e3779b9 ^ (cycleIndex + 1));
      slipStartLine = Math.max(
        0,
        Math.min(lineCount - SLIP_BAND_LINES, Math.floor(lineCount * (SLIP_RANGE_START + rand() * SLIP_RANGE_SPAN)))
      );
      const mag = SLIP_MIN_PX + rand() * (SLIP_MAX_PX - SLIP_MIN_PX);
      slipOffsetPx = rand() < 0.5 ? mag : -mag;
      lastLineDrawn = -1;
      scanCleared = false;
    };

    const totalCycleMs = () => HANDSHAKE_MS + lineCount * LINE_INTERVAL_MS + HOLD_MS + WIPE_MS;

    const drawStaticFrame = () => {
      // reduced-motion freeze: the fully-scanned page at rest, slip baked in
      reseedCycle();
      clearCanvas();
      for (let i = 0; i < lineCount; i++) commitLine(i);
    };

    const loop = (now: number) => {
      let cycleTime = now - cycleBase;
      const total = totalCycleMs();
      if (cycleTime >= total) {
        const laps = Math.floor(cycleTime / total);
        cycleBase += laps * total;
        cycleIndex += laps;
        reseedCycle();
        clearCanvas();
        cycleTime = now - cycleBase;
      }

      const scanMs = lineCount * LINE_INTERVAL_MS;
      if (cycleTime < HANDSHAKE_MS) {
        drawWaveform(cycleTime);
      } else if (cycleTime < HANDSHAKE_MS + scanMs) {
        if (!scanCleared) {
          clearCanvas();
          scanCleared = true;
        }
        const scanElapsed = cycleTime - HANDSHAKE_MS;
        const targetLine = Math.min(lineCount - 1, Math.floor(scanElapsed / LINE_INTERVAL_MS));
        while (lastLineDrawn < targetLine) {
          lastLineDrawn++;
          commitLine(lastLineDrawn);
        }
      } else if (cycleTime < HANDSHAKE_MS + scanMs + HOLD_MS) {
        if (!scanCleared) {
          clearCanvas();
          scanCleared = true;
        }
        while (lastLineDrawn < lineCount - 1) {
          lastLineDrawn++;
          commitLine(lastLineDrawn);
        }
      } else {
        const wipeT = cycleTime - HANDSHAKE_MS - scanMs - HOLD_MS;
        drawWipe(Math.min(1, wipeT / WIPE_MS));
      }

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

      // scan-line resolution derived from the container's smaller dimension
      const minDim = Math.min(w, h);
      lineCount = Math.min(MAX_LINES, Math.max(MIN_LINES, Math.round(h / 2)));
      rowH = h / lineCount;
      letterCell = Math.min(5, Math.max(2, minDim / 70));
      lineSpacing = Math.min(9, Math.max(5, minDim / 28));
      marginPx = Math.max(4, w * 0.05);

      cycleBase = performance.now();
      cycleIndex = 0;
      reseedCycle();

      if (reduced) {
        drawStaticFrame();
      } else {
        clearCanvas();
        wake();
      }
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const mo = new MutationObserver(() => {
      derive();
      if (reduced) drawStaticFrame();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        drawStaticFrame();
      } else {
        cycleBase = performance.now();
        cycleIndex = 0;
        reseedCycle();
        clearCanvas();
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
      role="status"
      aria-busy="true"
      className={`ns-fls relative h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <span className="sr-only">{label}</span>
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

FaxLineSlip.displayName = "FaxLineSlip";

export default FaxLineSlip;
