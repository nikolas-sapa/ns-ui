"use client";

import { useEffect, useRef, useState } from "react";
import { CrackCompare } from "./component";

const RAMP = " .:-=+*#%@";

/** deterministic hash noise — same scene on every render, zero assets */
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** grayscale night-ridge scene sampled at (u, v) in [0,1]² */
function luminance(u: number, v: number): number {
  const horizon =
    0.56 + 0.07 * Math.sin(u * 5.1 + 1.2) + 0.035 * Math.sin(u * 13.7 + 4.0);
  const ridge = Math.max(
    horizon + 0.03,
    0.74 + 0.05 * Math.sin(u * 3.4 + 0.4) + 0.02 * Math.sin(u * 21.0)
  );
  const moon = Math.hypot((u - 0.74) * 1.55, v - 0.2);
  let l: number;
  if (v < horizon) {
    l = 0.14 + v * 0.2; // sky brightens toward the horizon
    l += Math.max(0, 0.32 - moon * 1.7); // moon glow
    if (moon < 0.05) l = 0.92; // moon disc
    if (hash(Math.floor(u * 150), Math.floor(v * 150)) > 0.996) l = 0.85; // stars
  } else if (v < ridge) {
    l = 0.3 - (v - horizon) * 0.5 + 0.03 * Math.sin(u * 44 + v * 9);
  } else {
    l = 0.16 - (v - ridge) * 0.3 + 0.02 * Math.sin(u * 60);
  }
  l += (hash(u * 997.3, v * 613.7) - 0.5) * 0.05;
  return Math.min(1, Math.max(0, l));
}

/** the same scene rendered as a photo or as its ascii-dither treatment */
function SceneLayer({ mode }: { mode: "photo" | "ascii" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw < 2 || ch < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (mode === "photo") {
        const cols = 200;
        const rows = Math.max(2, Math.round((ch / cw) * cols));
        const off = document.createElement("canvas");
        off.width = cols;
        off.height = rows;
        const octx = off.getContext("2d");
        if (!octx) return;
        const img = octx.createImageData(cols, rows);
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const g = Math.round(luminance(x / cols, y / rows) * 255);
            const i = (y * cols + x) * 4;
            img.data[i] = g;
            img.data[i + 1] = g;
            img.data[i + 2] = g;
            img.data[i + 3] = 255;
          }
        }
        octx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(off, 0, 0, cw, ch);
      } else {
        ctx.fillStyle = "#050505";
        ctx.fillRect(0, 0, cw, ch);
        const cell = 9;
        ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textBaseline = "top";
        for (let y = 0; y < ch; y += cell + 2) {
          for (let x = 0; x < cw; x += cell) {
            const l = luminance(x / cw, y / ch);
            const glyph = RAMP[Math.min(RAMP.length - 1, Math.floor(l * RAMP.length))];
            if (glyph === " ") continue;
            ctx.fillStyle = `rgba(237,237,237,${(0.2 + l * 0.7).toFixed(2)})`;
            ctx.fillText(glyph, x, y);
          }
        }
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [mode]);

  return <canvas ref={ref} aria-hidden className="h-full w-full" />;
}

export default function CrackCompareDemo() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-background px-6 py-24 text-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-ns-muted">
          ns-ui / compare-crack-seam
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          The divider is a fracture
        </h1>
        <p className="max-w-md text-sm text-ns-muted">
          Drag the seam between the photo and its ASCII treatment. Fast drags
          splinter micro-fissures off the crack, slow drags heal them shut, and
          on release a specular glint runs the fracture.
        </p>
      </div>

      <div className="w-full max-w-3xl">
        <CrackCompare
          key={resetKey}
          label="Photo versus ASCII treatment"
          before={
            <div className="relative h-full w-full bg-background">
              <SceneLayer mode="photo" />
              <span className="absolute left-4 top-3 font-mono text-[11px] tracking-[0.25em] text-foreground/80">
                A
              </span>
            </div>
          }
          after={
            <div className="relative h-full w-full bg-background">
              <SceneLayer mode="ascii" />
              <span className="absolute bottom-3 right-4 font-mono text-[11px] tracking-[0.25em] text-foreground/80">
                B
              </span>
            </div>
          }
        />
      </div>

      <button
        type="button"
        onClick={() => setResetKey((k) => k + 1)}
        className="font-mono text-xs text-ns-muted underline underline-offset-4 transition-colors hover:text-foreground"
      >
        recenter seam
      </button>
    </main>
  );
}
