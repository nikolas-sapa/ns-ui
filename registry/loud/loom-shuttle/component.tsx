"use client";

import { useEffect, useRef } from "react";

// Loader as a loom: warp threads span the frame, a shuttle carries the weft
// back and forth, and progress IS the woven cloth accumulating row by row.
// Direction alternates per row like real weaving, each completed pass is
// beaten up against the fell with a small compression bounce. All canvas ink
// comes from CSS tokens, re-read on theme change.
export function LoomShuttle({
  value,
  label = "Loading assets",
  className = "",
}: {
  /** 0–100. Omit to self-run a staged demo loop. */
  value?: number;
  label?: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const WARP_PITCH = 7;
    const ROW_PITCH = 5;
    let w = 0;
    let h = 0;
    let warpCount = 0;
    let rowCount = 0;
    let ink = { fg: "#888", muted: "#888", border: "#888" };
    const fabric = document.createElement("canvas");
    const fctx = fabric.getContext("2d")!;
    let fabricRows = 0;

    const readInk = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = {
        fg: cs.getPropertyValue("--foreground").trim() || "#888",
        muted: cs.getPropertyValue("--muted").trim() || "#888",
        border: cs.getPropertyValue("--border").trim() || "#888",
      };
    };
    readInk();

    const warpX = (i: number) => (i + 0.5) * WARP_PITCH;

    // one weft row drawn into the offscreen fabric, with over/under texture
    const weaveRow = (ctx2: CanvasRenderingContext2D, row: number, toX: number) => {
      const y = (row + 0.5) * ROW_PITCH;
      ctx2.strokeStyle = ink.fg;
      ctx2.globalAlpha = 0.85;
      ctx2.lineWidth = 1.6;
      ctx2.beginPath();
      const even = row % 2 === 0;
      ctx2.moveTo(even ? 0 : w, y + Math.sin(row * 1.7) * 0.5);
      ctx2.lineTo(toX, y + Math.sin(row * 1.7) * 0.5);
      ctx2.stroke();
      // warp goes back over the weft at alternating crossings
      ctx2.strokeStyle = ink.muted;
      ctx2.globalAlpha = 0.7;
      ctx2.lineWidth = 1;
      const from = Math.min(even ? 0 : toX, even ? toX : w);
      const to = Math.max(even ? 0 : toX, even ? toX : w);
      for (let i = 0; i < warpCount; i++) {
        if ((i + row) % 2 !== 0) continue;
        const x = warpX(i);
        if (x < from || x > to) continue;
        ctx2.beginPath();
        ctx2.moveTo(x, y - ROW_PITCH / 2);
        ctx2.lineTo(x, y + ROW_PITCH / 2);
        ctx2.stroke();
      }
      ctx2.globalAlpha = 1;
    };

    const rebuildFabric = () => {
      fctx.clearRect(0, 0, w, h);
      for (let r = 0; r < fabricRows; r++) weaveRow(fctx, r, r % 2 === 0 ? w : 0);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fabric.width = Math.round(w * dpr);
      fabric.height = Math.round(h * dpr);
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      warpCount = Math.floor(w / WARP_PITCH);
      rowCount = Math.max(1, Math.floor((h - 8) / ROW_PITCH));
      rebuildFabric();
    };

    // staged self-run when uncontrolled: fast, stall, fast, stall, finish
    const STAGES: [number, number][] = [
      [0.35, 1100],
      [0.35, 1700],
      [0.72, 3000],
      [0.72, 3600],
      [1.0, 5200],
      [1.0, 6800],
    ];
    const start = performance.now();
    const CYCLE = 7600;
    const selfProgress = (now: number) => {
      const t = (now - start) % CYCLE;
      let prev: [number, number] = [0, 0];
      for (const s of STAGES) {
        if (t < s[1]) {
          const span = s[1] - prev[1];
          const f = span > 0 ? (t - prev[1]) / span : 1;
          const e = 1 - Math.pow(1 - f, 3);
          return prev[0] + (s[0] - prev[0]) * e;
        }
        prev = s;
      }
      return 1;
    };

    let raf = 0;
    let beatAt = -Infinity;
    let announced = false;
    let lastPct = -1;

    const drawFrame = (now: number) => {
      const p =
        valueRef.current !== undefined
          ? Math.max(0, Math.min(1, valueRef.current / 100))
          : selfProgress(now);

      const rowsF = p * rowCount;
      const fullRows = Math.floor(rowsF);
      const frac = rowsF - fullRows;

      if (fullRows !== fabricRows) {
        if (fullRows > fabricRows && fullRows === fabricRows + 1) {
          weaveRow(fctx, fabricRows, fabricRows % 2 === 0 ? w : 0);
          fabricRows = fullRows;
        } else {
          fabricRows = fullRows;
          rebuildFabric();
        }
        beatAt = now;
      }

      ctx.clearRect(0, 0, w, h);

      // warp
      ctx.strokeStyle = ink.muted;
      ctx.lineWidth = 1;
      for (let i = 0; i < warpCount; i++) {
        ctx.globalAlpha = 0.22 + ((i * 2654435761) % 100) / 100 * 0.1;
        const x = warpX(i);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // beat-up: the cloth compresses against the fell for a beat
      const beat = reduced ? 0 : Math.max(0, 1 - (now - beatAt) / 140);
      ctx.drawImage(
        fabric,
        0,
        -beat * 1.5,
        w,
        h
      );

      // fell line — the woven edge
      const fellY = fabricRows * ROW_PITCH + 0.5;
      ctx.strokeStyle = ink.border;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, fellY);
      ctx.lineTo(w, fellY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // current pass: partial weft + shuttle
      if (p < 1 && fabricRows < rowCount) {
        const row = fabricRows;
        const even = row % 2 === 0;
        const sx = reduced
          ? even
            ? frac * w
            : w - frac * w
          : even
            ? frac * w
            : w - frac * w;
        weaveRow(ctx, row, sx);
        // shuttle: a pointed lozenge riding the row
        const y = (row + 0.5) * ROW_PITCH;
        ctx.fillStyle = ink.fg;
        ctx.save();
        ctx.translate(sx, y);
        if (!even) ctx.scale(-1, 1);
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.quadraticCurveTo(3, -3.4, -7, -2.2);
        ctx.quadraticCurveTo(-9, 0, -7, 2.2);
        ctx.quadraticCurveTo(3, 3.4, 9, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // DOM readouts (throttled to whole percents)
      const pct = Math.round(p * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        if (pctRef.current) pctRef.current.textContent = `${pct}%`;
        barRef.current?.setAttribute("aria-valuenow", String(pct));
        if (pct >= 100 && !announced) {
          announced = true;
          if (liveRef.current) liveRef.current.textContent = "Complete — cloth woven.";
        } else if (pct < 100 && announced) {
          announced = false;
          if (liveRef.current) liveRef.current.textContent = "";
        }
      }
    };

    const loop = (t: number) => {
      drawFrame(t);
      raf = requestAnimationFrame(loop);
    };

    const themeObserver = new MutationObserver(() => {
      readInk();
      rebuildFabric();
      if (reduced) drawFrame(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);

    const ro = new ResizeObserver(() => {
      resize();
      drawFrame(performance.now());
    });
    ro.observe(canvas);
    resize();

    if (reduced) {
      // static frame per value change; uncontrolled reduced-motion shows 72%
      if (valueRef.current === undefined) valueRef.current = 72;
      drawFrame(performance.now());
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(raf);
    };
    // ponytail: uncontrolled loop only re-renders via refs; `value` flows through valueRef
  }, []);

  return (
    <div ref={rootRef} className={className}>
      <div
        ref={barRef}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        className="overflow-hidden rounded-md border border-border bg-background"
      >
        <canvas ref={canvasRef} className="block h-40 w-full" />
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          {label}
        </span>
        <span
          ref={pctRef}
          aria-hidden="true"
          className="font-mono text-sm tabular-nums text-foreground"
        >
          0%
        </span>
      </div>
      <p ref={liveRef} aria-live="polite" className="sr-only" />
    </div>
  );
}
