"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

// ---------------------------------------------------------------------------
// DeviceMockupAsciiScreen — a phone-frame device mockup whose screen content
// is a live ASCII/scanline raster (a fake app UI rendered as monospace glyph
// density plus a slow scanline sweep), not a static screenshot. Dragging the
// handle tilts the FRAME via a real CSS skew() transform, while the screen's
// own canvas draw pass independently RESAMPLES its glyph raster to the same
// skew — every row's glyphs are shifted horizontally by an amount
// proportional to that row's distance from center and the current skew
// angle, recomputed every frame the tilt changes — so the content genuinely
// re-renders into the tilt rather than being a flat texture wrapped in the
// bezel's own CSS transform. This stays a 2D skew, deliberately: no
// perspective/projection engine, no three. Distinct from image-crop-mat
// (four mat boards defining a crop window over a static photo, no tilt, no
// raster) and minimap-pantograph (an IK linkage between two scroll
// viewports, no device chrome and no glyph rendering at all).
// ---------------------------------------------------------------------------

export interface DeviceMockupAsciiScreenProps {
  className?: string;
}

const MAX_SKEW = 14; // deg
const DRAG_RANGE = 120; // px of drag to reach MAX_SKEW
const SETTLE_MS = 420;
const CELL = 8;
const SCAN_PERIOD_MS = 3200;

interface Tokens {
  fg: string;
  bg: string;
  border: string;
  accent: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    fg: get("--foreground", "#ededed"),
    bg: get("--background", "#0a0a0a"),
    border: get("--border", "#2e2e2e"),
    accent: get("--ns-accent", "#006bff"),
  };
}

// fake UI layout: a row-density map (0..1) standing in for a header, a
// stat block and a few paragraph lines — enough visual structure for the
// shear to read against.
function densityAt(gx: number, gy: number, cols: number, rows: number): number {
  const rowFrac = gy / rows;
  if (rowFrac < 0.08) return 0.95; // header bar
  if (rowFrac < 0.28) {
    // stat tiles: three blocks with gaps
    const colFrac = gx / cols;
    const inBlock = colFrac % 0.34 < 0.28;
    return inBlock ? 0.6 : 0;
  }
  if (rowFrac > 0.92) return 0.15; // footer hairline
  // paragraph lines: alternating density bands with ragged right edge
  const lineIdx = Math.floor((rowFrac - 0.32) * 26);
  if (lineIdx < 0) return 0;
  const lineOn = lineIdx % 3 !== 2;
  if (!lineOn) return 0;
  const raggedEnd = 0.35 + 0.55 * ((Math.sin(lineIdx * 1.7) + 1) / 2);
  const colFrac = gx / cols;
  return colFrac < raggedEnd ? 0.5 : 0;
}

function easeOutCubic(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

export function DeviceMockupAsciiScreen({ className = "" }: DeviceMockupAsciiScreenProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokensRef = useRef<Tokens>(
    typeof document === "undefined"
      ? { fg: "#ededed", bg: "#0a0a0a", border: "#2e2e2e", accent: "#006bff" }
      : readTokens()
  );
  const reducedRef = useRef(false);
  const rafRef = useRef(0);

  const skewRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const settleRef = useRef({ from: { x: 0, y: 0 }, start: 0, active: false });
  const draggingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, skewX: 0, skewY: 0 });

  const [, forceTick] = useState(0);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mo = new MutationObserver(() => {
      tokensRef.current = readTokens();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => mo.disconnect();
  }, []);

  const applyFrameTransform = () => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.transform = `skew(${skewRef.current.x.toFixed(2)}deg, ${skewRef.current.y.toFixed(2)}deg)`;
  };

  const paint = (t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 1;
    const cssH = canvas.clientHeight || 1;
    const targetW = Math.ceil(cssW * dpr);
    const targetH = Math.ceil(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { fg, bg, accent } = tokensRef.current;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    const cols = Math.max(1, Math.ceil(cssW / CELL));
    const rows = Math.max(1, Math.ceil(cssH / CELL));
    const cellW = cssW / cols;
    const cellH = cssH / rows;
    // shear factor in px-per-row, derived from the live skewX angle: the
    // raster resamples to the SAME tilt the frame's CSS transform applies
    const shearPxPerRow = Math.tan((skewRef.current.x * Math.PI) / 180) * cellH * -1;
    const centerRow = rows / 2;

    ctx.font = `${Math.max(6, Math.round(cellH * 0.92))}px "GeistMono", ui-monospace, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const scanProgress = reducedRef.current ? 0.5 : (t % SCAN_PERIOD_MS) / SCAN_PERIOD_MS;
    const scanRow = scanProgress * rows;

    for (let gy = 0; gy < rows; gy++) {
      const rowShear = shearPxPerRow * (gy - centerRow);
      const nearScan = Math.abs(gy - scanRow) < 1.4;
      for (let gx = 0; gx < cols; gx++) {
        const d = densityAt(gx, gy, cols, rows);
        if (d <= 0) continue;
        const ch = d > 0.85 ? "#" : d > 0.55 ? "=" : d > 0.3 ? "-" : ".";
        ctx.fillStyle = nearScan ? accent : fg;
        // tiered alpha bucketed to the same glyph tiers as `ch`, the same
        // idea as background-ascii-caustics' ALPHA_BUCKETS: contrast comes
        // from real void (d <= 0 draws nothing, above) plus pushing drawn
        // ink UP toward opaque, not compressing every band into a narrow
        // mid-grey range — a continuous curve that dims already-faint bands
        // further is the opposite of legible structure
        ctx.globalAlpha = nearScan ? 1 : d > 0.85 ? 1 : d > 0.55 ? 0.78 : d > 0.3 ? 0.55 : 0.32;
        ctx.fillText(ch, gx * cellW + rowShear, gy * cellH);
      }
    }
    ctx.globalAlpha = 1;
  };

  useEffect(() => {
    let mounted = true;
    const loop = (t: number) => {
      if (!mounted) return;
      // settle animation: eases skew back toward target (usually 0 on release)
      const s = settleRef.current;
      if (s.active) {
        const elapsed = performance.now() - s.start;
        const p = Math.min(1, elapsed / SETTLE_MS);
        const e = easeOutCubic(p);
        skewRef.current = {
          x: s.from.x + (targetRef.current.x - s.from.x) * e,
          y: s.from.y + (targetRef.current.y - s.from.y) * e,
        };
        applyFrameTransform();
        if (p >= 1) s.active = false;
      }
      paint(t);
      const needsMotion = !reducedRef.current || s.active || draggingRef.current;
      if (needsMotion) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSkew = (x: number, y: number) => {
    skewRef.current = {
      x: Math.max(-MAX_SKEW, Math.min(MAX_SKEW, x)),
      y: Math.max(-MAX_SKEW, Math.min(MAX_SKEW, y)),
    };
    targetRef.current = { ...skewRef.current };
    applyFrameTransform();
    forceTick((n) => n + 1);
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    draggingRef.current = true;
    settleRef.current.active = false;
    startRef.current = { x: e.clientX, y: e.clientY, skewX: skewRef.current.x, skewY: skewRef.current.y };
    (e.target as Element).setPointerCapture(e.pointerId);
    if (rafRef.current === 0) rafRef.current = requestAnimationFrame(paint as unknown as FrameRequestCallback);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    const nx = startRef.current.skewX + (dx / DRAG_RANGE) * MAX_SKEW;
    const ny = startRef.current.skewY + (dy / DRAG_RANGE) * MAX_SKEW;
    skewRef.current = {
      x: Math.max(-MAX_SKEW, Math.min(MAX_SKEW, nx)),
      y: Math.max(-MAX_SKEW, Math.min(MAX_SKEW, ny)),
    };
    applyFrameTransform();
  };
  const settleToZero = () => {
    settleRef.current = { from: { ...skewRef.current }, start: performance.now(), active: true };
    targetRef.current = { x: 0, y: 0 };
    if (rafRef.current === 0) {
      const loop = (t: number) => {
        const s = settleRef.current;
        if (s.active) {
          const elapsed = performance.now() - s.start;
          const p = Math.min(1, elapsed / SETTLE_MS);
          const e = easeOutCubic(p);
          skewRef.current = {
            x: s.from.x + (targetRef.current.x - s.from.x) * e,
            y: s.from.y + (targetRef.current.y - s.from.y) * e,
          };
          applyFrameTransform();
          if (p >= 1) s.active = false;
        }
        paint(t);
        if (s.active) rafRef.current = requestAnimationFrame(loop);
        else rafRef.current = 0;
      };
      rafRef.current = requestAnimationFrame(loop);
    }
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // synthetic pointer during autoplay — nothing to release
    }
    if (reducedRef.current) {
      setSkew(0, 0);
    } else {
      settleToZero();
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const step = 3;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSkew(skewRef.current.x - step, skewRef.current.y);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSkew(skewRef.current.x + step, skewRef.current.y);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSkew(skewRef.current.x, skewRef.current.y - step);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSkew(skewRef.current.x, skewRef.current.y + step);
    } else if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
      e.preventDefault();
      if (reducedRef.current) setSkew(0, 0);
      else settleToZero();
    }
  };

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div
        ref={frameRef}
        data-device-frame
        className="relative rounded-[28px] border-[6px] border-border bg-background p-2 shadow-sm"
        style={{ width: 220, height: 440, transformOrigin: "center" }}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-2 h-1.5 w-14 -translate-x-1/2 rounded-full bg-border"
        />
        <canvas ref={canvasRef} aria-hidden className="block h-full w-full rounded-[18px]" />
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label="Drag or use arrow keys to tilt the device"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="cursor-grab select-none touch-none rounded-full border border-border bg-surface px-4 py-1.5 font-mono text-[11px] tracking-widest text-ns-muted transition-colors duration-150 hover:border-foreground/25 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent active:cursor-grabbing"
      >
        DRAG TO TILT
      </div>
    </div>
  );
}
