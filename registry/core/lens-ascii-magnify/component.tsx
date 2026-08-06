"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AsciiMagnifyLens — a lens that resolves the region under it into DENSER
// glyphs, not a bigger version of the same glyph. Distinct from slider-loupe
// (optically scales the same canvas-drawn tick marks bigger) and from
// text-prism-split (tears a headline into RGB channel offsets): here every
// character has a small 5x7 dot-matrix representation, and the lens redraws
// whichever characters fall inside it as that matrix — a grid of ascii-ramp
// cells finer than the flat glyph outside the lens, i.e. genuinely more
// characters per character. The base text is real, plain DOM text the whole
// time; the lens is a purely decorative aria-hidden canvas overlay on top of
// it, so accessibility is never in question. Direct-DOM rAF: the lens springs
// toward the pointer (slight optical lag) and parks at the block's center at
// rest and on pointer-leave, so the resting screenshot already shows the
// mechanic rather than plain text with nothing happening.
// ---------------------------------------------------------------------------

const CELL_COLS = 5;
const CELL_ROWS = 7;
const RAMP = " .:-=+*#%@";

// Compact 5x7 dot-matrix font. "1" = ink, "0" = empty. Characters outside
// this table fall back to a light 40%-fill block so nothing renders blank.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10101", "10011", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10011", "10101", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "00000", "01100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "'": ["01100", "01100", "01000", "00000", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

function glyphRows(ch: string): string[] {
  return FONT[ch.toUpperCase()] ?? ["01010", "10101", "01010", "10101", "01010", "10101", "01010"];
}

export interface AsciiMagnifyLensProps {
  /** the magnified text */
  text: string;
  /** lens diameter in px */
  lensSize?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function AsciiMagnifyLens({ text, lensSize = 130, className = "" }: AsciiMagnifyLensProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [reduced, setReduced] = useState(false);

  const chars = useMemo(() => Array.from(text), [text]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ring = ringRef.current;
    if (!container || !canvas || !ring) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let ink = "rgb(237,237,237)";
    let bg = "rgb(10,10,10)";
    let monoFam = "ui-monospace, SFMono-Regular, Menlo, monospace";
    const derive = () => {
      const cs = getComputedStyle(container);
      const root = getComputedStyle(document.documentElement);
      ink = root.getPropertyValue("--foreground").trim() || cs.color || ink;
      bg = root.getPropertyValue("--background").trim() || bg;
      const fam = cs.fontFamily;
      if (fam) monoFam = fam;
    };
    derive();

    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let lx = 0;
    let ly = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;
    let lastT = 0;
    let visible = true;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      tx = w / 2;
      ty = h / 2;
      if (!raf) {
        lx = tx;
        ly = ty;
        render();
      }
    };

    const render = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const r = lensSize / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = bg;
      ctx.fillRect(lx - r, ly - r, r * 2, r * 2);

      const containerRect = container.getBoundingClientRect();
      for (let i = 0; i < chars.length; i++) {
        const el = charRefs.current[i];
        if (!el || !chars[i] || /\s/.test(chars[i]!)) continue;
        const box = el.getBoundingClientRect();
        const cx = box.left - containerRect.left + box.width / 2;
        const cy = box.top - containerRect.top + box.height / 2;
        const dist = Math.hypot(cx - lx, cy - ly);
        if (dist > r + Math.max(box.width, box.height)) continue;

        const rows = glyphRows(chars[i]!);
        const cellW = box.width / CELL_COLS;
        const cellH = box.height / CELL_ROWS;
        const fontPx = Math.max(6, Math.min(cellW, cellH) * 1.6);
        ctx.font = `${fontPx}px ${monoFam}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const originX = box.left - containerRect.left;
        const originY = box.top - containerRect.top;
        for (let row = 0; row < CELL_ROWS; row++) {
          const bits = rows[row] ?? "00000";
          for (let col = 0; col < CELL_COLS; col++) {
            const on = bits[col] === "1";
            const px = originX + col * cellW + cellW / 2;
            const py = originY + row * cellH + cellH / 2;
            if (Math.hypot(px - lx, py - ly) > r) continue;
            const glyph = on ? RAMP[RAMP.length - 2] : RAMP[2];
            ctx.globalAlpha = on ? 1 : 0.28;
            ctx.fillStyle = ink;
            ctx.fillText(glyph!, px, py);
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      const ringR = lensSize / 2;
      ring.style.transform = `translate3d(${(lx - ringR).toFixed(1)}px, ${(ly - ringR).toFixed(1)}px, 0)`;
    };

    if (reduced) {
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      return () => ro.disconnect();
    }

    const loop = (now: number) => {
      const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 1 / 60;
      lastT = now;
      // exponential chase toward the pointer (or the parked center) — a
      // slight optical lag, not an instant snap
      lx += (tx - lx) * Math.min(1, dt * 10);
      ly += (ty - ly) * Math.min(1, dt * 10);
      render();
      const settled = Math.abs(lx - tx) < 0.2 && Math.abs(ly - ty) < 0.2;
      if (!settled && visible && !document.hidden) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
      }
    };
    const wake = () => {
      if (!raf) {
        lastT = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    resize();

    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      tx = e.clientX - rect.left;
      ty = e.clientY - rect.top;
      wake();
    };
    const onLeave = () => {
      const rect = container.getBoundingClientRect();
      tx = rect.width / 2;
      ty = rect.height / 2;
      wake();
    };

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    });
    io.observe(container);
    const mo = new MutationObserver(() => {
      derive();
      render();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const onVis = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [chars, lensSize, reduced]);

  return (
    <div
      ref={containerRef}
      className={`relative touch-none select-none font-mono leading-relaxed text-foreground ${className}`}
    >
      <p className="relative z-0 whitespace-pre-wrap">
        {chars.map((c, i) => (
          <span
            key={i}
            ref={(el) => {
              charRefs.current[i] = el;
            }}
            className="inline-block"
          >
            {c}
          </span>
        ))}
      </p>
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute left-0 top-0 z-10" />
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-20 rounded-full border border-border shadow-[0_4px_18px_-6px_rgba(0,0,0,0.4)] will-change-transform"
        style={{ width: lensSize, height: lensSize }}
      />
    </div>
  );
}
