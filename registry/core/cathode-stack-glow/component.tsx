"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// CathodeStackGlow — a Nixie-tube stat readout. Ten wire-mesh cathode digits
// sit physically stacked behind a common anode mesh; only the struck cathode
// ionizes and glows, but the nine unstruck digits stay faintly visible as
// ghost outlines through the mesh. A periodic, per-cell "conditioning sweep"
// silently strikes all ten digits in turn at low duty cycle so rarely-used
// cathodes don't foul. Single canvas, direct rAF loop, zero deps.
// ---------------------------------------------------------------------------

function hash(seed: number) {
  const x = Math.sin(seed) * 43758.5453123;
  return x - Math.floor(x);
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

const DIGIT_GLYPHS = "0123456789";

// real numbers, per spec
const GHOST_MIN_DARK = 0.03;
const GHOST_MAX_DARK = 0.07;
const GHOST_MIN_LIGHT = 0.06;
const GHOST_MAX_LIGHT = 0.09;
const GHOST_CLAMP_MIN = 0.02;
const GHOST_CLAMP_MAX = 0.09;
const GHOST_DRIFT_AMPLITUDE = 0.02; // slow oscillation envelope, ±0.5%/min-ish
const SWEEP_MIN_MS = 15_000;
const SWEEP_MAX_MS = 30_000;
const SWEEP_PER_DIGIT_MS = 80;
const SWEEP_RISE_MS = 20;
const SWEEP_HOLD_MS = 40;
const SWEEP_TOTAL_MS = SWEEP_PER_DIGIT_MS * 10; // ~800ms
const FLICKER_MIN_HZ = 3;
const FLICKER_MAX_HZ = 6;
const FLICKER_MIN = 0.92;
const FLICKER_MAX = 1.0;
const STRIKE_FLASH_MIN_MS = 20;
const STRIKE_FLASH_MS_RANGE = 10; // 20-30ms

type Cell = {
  char: string;
  isDigit: boolean;
  digit: number; // -1 for non-digit static characters
  nextSweepAt: number;
  sweepStart: number | null;
  flickerCurrent: number;
  flickerTarget: number;
  nextFlickerAt: number;
  strikeFlashUntil: number;
};

function randRange(now: number, cellIndex: number, salt: number, lo: number, hi: number) {
  return lo + hash(now * 0.0001 + cellIndex * 13.7 + salt) * (hi - lo);
}

function ghostOpacity(cellIndex: number, digit: number, now: number, light: boolean) {
  const seed = cellIndex * 97.13 + digit * 13.37;
  const base = light
    ? lerp(GHOST_MIN_LIGHT, GHOST_MAX_LIGHT, hash(seed))
    : lerp(GHOST_MIN_DARK, GHOST_MAX_DARK, hash(seed));
  const periodMs = 60_000 + hash(seed + 1) * 180_000; // 1-4 minute drift cycle
  const phase = hash(seed + 2) * Math.PI * 2;
  const value = base + GHOST_DRIFT_AMPLITUDE * Math.sin((2 * Math.PI * now) / periodMs + phase);
  return clamp(value, GHOST_CLAMP_MIN, GHOST_CLAMP_MAX);
}

function glyphOffset(cellIndex: number, digit: number) {
  // deterministic fan, sold as physical stacking depth — 0 to ~1.6px
  const fanAngle = -0.7 + hash(cellIndex * 5.3) * 0.6;
  const mag = 0.16 + hash(cellIndex * 2.1 + digit * 0.7) * 0.06;
  return {
    dx: Math.cos(fanAngle) * digit * mag,
    dy: Math.sin(fanAngle) * digit * mag,
  };
}

function parseLuminance(color: string): number {
  const m = color.match(/[\d.]+/g);
  if (!m || m.length < 3) return 0;
  const [r, g, b] = m.map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function CathodeStackGlow({
  value = "482",
  className = "",
}: {
  /** the readout string; non-digit characters (currency signs, separators, decimals) render statically */
  value?: string | number;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const valueRef = useRef(String(value));
  const updateValueRef = useRef<((next: string) => void) | null>(null);
  const mountedValue = useRef(String(value));
  valueRef.current = String(value);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- tokens, read fresh, never a literal ----
    let fg = "";
    let bg = "";
    let muted = "";
    let isLight = true;
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = cs.getPropertyValue("--foreground").trim() || fg;
      bg = cs.getPropertyValue("--background").trim() || bg;
      muted = cs.getPropertyValue("--ns-muted").trim() || muted;
      isLight = parseLuminance(bg) > 0.5;
    };
    readTokens(); // no paint before the first token read

    let cells: Cell[] = [];
    const buildCells = (str: string, now: number) => {
      cells = Array.from(str).map((char, i) => {
        const isDigit = char >= "0" && char <= "9";
        return {
          char,
          isDigit,
          digit: isDigit ? Number(char) : -1,
          nextSweepAt: now + randRange(now, i, 1, SWEEP_MIN_MS, SWEEP_MAX_MS),
          sweepStart: null,
          flickerCurrent: 1,
          flickerTarget: 1,
          nextFlickerAt: now,
          strikeFlashUntil: 0,
        };
      });
    };
    buildCells(valueRef.current, performance.now());

    // live prop updates: switch the struck cathode instantly (no crossfade)
    // and re-strike with a fast 20-30ms flash-up, matching real Nixie switching
    updateValueRef.current = (next: string) => {
      const now = performance.now();
      if (next.length !== cells.length) {
        buildCells(next, now);
        layout();
        return;
      }
      for (let i = 0; i < next.length; i++) {
        const char = next[i];
        const cell = cells[i];
        if (char === cell.char) continue;
        cell.char = char;
        cell.isDigit = char >= "0" && char <= "9";
        cell.digit = cell.isDigit ? Number(char) : -1;
        cell.sweepStart = null;
        cell.strikeFlashUntil = now + STRIKE_FLASH_MIN_MS + hash(now + i) * STRIKE_FLASH_MS_RANGE;
      }
    };

    let cw = 0;
    let ch = 0;
    let cellAdvance = 0;
    let fontSize = 0;
    let haloBase = 0;
    let raf = 0;
    let last = 0;
    let visible = true;

    const layout = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      cw = w;
      ch = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(1, cells.length);
      const baseUnit = Math.min(w / count, h);
      fontSize = baseUnit * 0.72;
      ctx.font = `600 ${fontSize}px ui-monospace, "SF Mono", "Cascadia Mono", monospace`;
      cellAdvance = ctx.measureText("0").width * 1.35;
      haloBase = baseUnit * 0.08;
    };

    const drawCell = (cell: Cell, index: number, x: number, now: number) => {
      const cy = ch / 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${fontSize}px ui-monospace, "SF Mono", "Cascadia Mono", monospace`;

      if (!cell.isDigit) {
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.fillStyle = fg;
        ctx.fillText(cell.char, x, cy);
        return;
      }

      // determine what's currently struck: real digit, or a conditioning
      // sweep stepping through 0-9 at this cell independently of value
      let displayDigit = cell.digit;
      let envelope = 1;
      let sweeping = false;
      if (cell.sweepStart != null) {
        const elapsed = now - cell.sweepStart;
        if (elapsed >= SWEEP_TOTAL_MS) {
          cell.sweepStart = null;
          cell.nextSweepAt = now + randRange(now, index, 3, SWEEP_MIN_MS, SWEEP_MAX_MS);
          cell.strikeFlashUntil = now + STRIKE_FLASH_MIN_MS + hash(now + index) * STRIKE_FLASH_MS_RANGE;
        } else {
          sweeping = true;
          const step = Math.min(9, Math.floor(elapsed / SWEEP_PER_DIGIT_MS));
          const local = elapsed - step * SWEEP_PER_DIGIT_MS;
          displayDigit = step;
          if (local < SWEEP_RISE_MS) envelope = local / SWEEP_RISE_MS;
          else if (local < SWEEP_RISE_MS + SWEEP_HOLD_MS) envelope = 1;
          else envelope = 1 - (local - SWEEP_RISE_MS - SWEEP_HOLD_MS) / SWEEP_HOLD_MS;
          envelope = clamp(envelope, 0, 1);
        }
      }

      // ghost stack: all ten cathode positions except whichever is struck now
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1, fontSize * 0.02);
      ctx.strokeStyle = muted;
      for (let d = 0; d < 10; d++) {
        if (d === displayDigit) continue;
        const { dx, dy } = glyphOffset(index, d);
        ctx.globalAlpha = ghostOpacity(index, d, now, isLight);
        ctx.strokeText(DIGIT_GLYPHS[d], x + dx, cy + dy);
      }

      // struck digit: full luminance + soft pulsing halo
      let brightness: number;
      if (sweeping) {
        brightness = envelope; // sweep peak matches idle peak (1.0), not a dimmer flash
      } else if (now < cell.strikeFlashUntil) {
        brightness = 1;
      } else {
        brightness = cell.flickerCurrent;
      }
      const { dx, dy } = glyphOffset(index, displayDigit);
      const haloPulse = haloBase * (1 + 0.1 * Math.sin((cell.flickerCurrent - 0.96) * 25));
      ctx.shadowColor = fg;
      ctx.shadowBlur = haloPulse * brightness;
      ctx.globalAlpha = brightness;
      ctx.fillStyle = fg;
      ctx.fillText(DIGIT_GLYPHS[displayDigit], x + dx, cy + dy);
      ctx.shadowBlur = 0;
    };

    const tick = (now: number, dt: number) => {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cell.isDigit) continue;

        if (cell.sweepStart == null && now >= cell.nextSweepAt) {
          cell.sweepStart = now;
        }

        if (now >= cell.nextFlickerAt) {
          cell.flickerTarget = lerp(FLICKER_MIN, FLICKER_MAX, hash(now * 0.001 + i * 4.4));
          const hz = randRange(now, i, 2, FLICKER_MIN_HZ, FLICKER_MAX_HZ);
          cell.nextFlickerAt = now + 1000 / hz;
        }
        cell.flickerCurrent += (cell.flickerTarget - cell.flickerCurrent) * Math.min(1, dt * 10);
      }
    };

    const paint = (now: number) => {
      ctx.clearRect(0, 0, cw, ch);
      const count = Math.max(1, cells.length);
      const totalWidth = count * cellAdvance;
      let x = cw / 2 - totalWidth / 2 + cellAdvance / 2;
      for (let i = 0; i < cells.length; i++) {
        drawCell(cells[i], i, x, now);
        x += cellAdvance;
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const dt = Math.min(Math.max((now - (last || now)) / 1000, 0), 0.05);
      last = now;
      tick(now, dt);
      paint(now);
      raf = requestAnimationFrame(loop);
    };

    const paintReduced = () => {
      // steady lit digits, full ghost stack at its median opacity — the one
      // frame that communicates the whole mechanic without an in-between state
      const now = performance.now();
      for (const cell of cells) {
        cell.sweepStart = null;
        cell.flickerCurrent = 1;
      }
      paint(now);
    };

    let ro: ResizeObserver | undefined;
    let io: IntersectionObserver | undefined;
    let mo: MutationObserver | undefined;
    let colorScheme: MediaQueryList | undefined;
    const onThemeChange = () => readTokens();

    document.fonts.ready.then(() => {
      if (!root.isConnected) return;
      readTokens();
      layout();

      if (reduced) {
        paintReduced();
        return;
      }

      last = performance.now();
      raf = requestAnimationFrame(loop);

      ro = new ResizeObserver(() => {
        layout();
      });
      ro.observe(root);

      io = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (entry.isIntersecting && !visible) {
            visible = true;
            readTokens(); // no paint before a fresh token read on resume
            layout();
            last = performance.now();
            raf = requestAnimationFrame(loop);
          } else if (!entry.isIntersecting && visible) {
            visible = false;
            cancelAnimationFrame(raf);
            raf = 0;
          }
        },
        { threshold: 0 }
      );
      io.observe(root);

      mo = new MutationObserver(onThemeChange);
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme"],
      });
      colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
      colorScheme.addEventListener("change", onThemeChange);
    });

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      mo?.disconnect();
      colorScheme?.removeEventListener("change", onThemeChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live value updates after mount: re-strike changed cathodes, no crossfade
  useEffect(() => {
    const str = String(value);
    if (str === mountedValue.current) return;
    mountedValue.current = str;
    updateValueRef.current?.(str);
  }, [value]);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={String(value)}
      className={`relative select-none ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
    </div>
  );
}
