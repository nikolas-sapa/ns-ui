"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// WarpLattice — a functional card grid drawn on its own visible lattice.
// The lattice is the magnetized medium: hairline grid lines bend toward the
// cursor, and the DOM cards sample the exact same displacement field, riding
// the bent sheet instead of floating over it. One pure field function feeds
// both the canvas and the card transforms from a single rAF loop.
// ---------------------------------------------------------------------------

const DEFAULT_LABELS = ["01", "02", "03", "04", "05", "06"];

// Idle ambient drift — a slow lissajous orbit sampled by the same field so
// the lattice never sits dead flat when nothing is hovering it.
const IDLE_AMT = 0.16; // fraction of full field strength at rest
const IDLE_ANGULAR_SPEED = 0.00022; // rad/ms

// Reads a `#rrggbb` custom property into a "r,g,b" string for rgba() strings.
function hexToRgbString(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const int = parseInt(m[1], 16);
  return `${(int >> 16) & 255},${(int >> 8) & 255},${int & 255}`;
}

type FieldSample = { ox: number; oy: number; w: number };

// The shared displacement field. Pull toward the cursor with gaussian
// falloff: pull = (cursor - p) * A * exp(-r^2 / (2 sigma^2)), magnitude
// clamped to 0.35 * r so a point can never cross the pointer (dead zone).
// `w` is the normalized field influence (0..1) used for line alpha.
// Written into `out` — no allocations on the hot path.
function sampleField(
  px: number,
  py: number,
  cx: number,
  cy: number,
  amp: number,
  twoSigma2: number,
  amt: number,
  out: FieldSample
) {
  const dx = cx - px;
  const dy = cy - py;
  const r2 = dx * dx + dy * dy;
  if (amt < 0.001 || r2 < 1e-6) {
    out.ox = 0;
    out.oy = 0;
    out.w = 0;
    return;
  }
  const g = Math.exp(-r2 / twoSigma2);
  const r = Math.sqrt(r2);
  let m = amp * r * g;
  const cap = 0.35 * r; // dead zone: lines relax near the pointer, never cross it
  if (m > cap) m = cap;
  m *= amt;
  const inv = m / r;
  out.ox = dx * inv;
  out.oy = dy * inv;
  out.w = g * amt;
}

export function WarpLattice({
  labels = DEFAULT_LABELS,
  cell = 32,
  sampleStep = 8,
  sigma = 140,
  peakBend = 22,
  cursorLerp = 0.14,
  className = "min-h-[520px]",
  "aria-label": ariaLabel = "Card grid on a cursor-warped lattice",
}: {
  /** mono label per card (3x2 grid by default) */
  labels?: string[];
  /** lattice cell size in px */
  cell?: number;
  /** sampling interval along each line in px */
  sampleStep?: number;
  /** gaussian falloff radius of the field in px */
  sigma?: number;
  /** maximum line bend in px (peaks at r = sigma) */
  peakBend?: number;
  /** smoothed-cursor lerp per frame — flicks lag, the sheet relaxes behind them */
  cursorLerp?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const grid = gridRef.current;
    if (!root || !canvas || !grid) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const items = Array.from(grid.children) as HTMLElement[];
    const n = items.length;

    // A tuned so the peak bend (at r = sigma) equals peakBend px:
    // max of r * exp(-r^2 / (2 sigma^2)) is sigma * exp(-0.5)
    const amp = (peakBend * Math.exp(0.5)) / sigma;
    const twoSigma2 = 2 * sigma * sigma;

    // hot-path state — locals only, never React state
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let tx = 0; // raw pointer (root space)
    let ty = 0;
    let sx = 0; // smoothed pointer — lags flicks, sheet visibly relaxes behind
    let sy = 0;
    let amt = 0; // field strength, eases 0 <-> 1 with the same lerp
    let hovering = false;
    let litIdx = -1; // card carrying the accent border
    let visible = true; // IntersectionObserver — pause the loop offscreen
    let lineRGB = "46,46,46"; // overwritten by readLineColor() before first draw
    const centerX = new Float32Array(n);
    const centerY = new Float32Array(n);
    const scaleCur = new Float32Array(n).fill(1);
    const prevTx = new Float32Array(n);
    const prevTy = new Float32Array(n);
    const out: FieldSample = { ox: 0, oy: 0, w: 0 };

    // Line color tracks the theme's border token — read once at mount and
    // re-read whenever the root's class list flips (dark <-> light), so
    // contrast stays correct in both instead of a color coincidentally
    // tuned for dark mode.
    const readLineColor = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--border")
        .trim();
      lineRGB = hexToRgbString(raw) ?? lineRGB;
    };
    readLineColor();

    const measure = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      // untransformed offsets (offsetLeft/Top ignore transforms — no feedback)
      const gx = grid.offsetLeft;
      const gy = grid.offsetTop;
      items.forEach((el, i) => {
        centerX[i] = gx + el.offsetLeft + el.offsetWidth / 2;
        centerY[i] = gy + el.offsetTop + el.offsetHeight / 2;
      });
    };
    measure();

    // Lattice pass: every line sampled every `sampleStep` px, each segment
    // bucketed by field influence so strokes batch into 6 alpha levels —
    // the theme's --border color rising 0.25 -> 0.6 inside the field.
    const NB = 6;
    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      const paths: Path2D[] = [];
      const counts: number[] = [];
      for (let b = 0; b < NB; b++) {
        paths.push(new Path2D());
        counts.push(0);
      }
      const seg = (
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        influence: number
      ) => {
        const b = Math.min(NB - 1, Math.floor(influence * NB));
        const p = paths[b];
        if (!p) return;
        p.moveTo(x0, y0);
        p.lineTo(x1, y1);
        counts[b] = (counts[b] ?? 0) + 1;
      };

      // vertical lines
      const vSteps = Math.ceil(h / sampleStep);
      for (let x = 0; x <= w; x += cell) {
        let px = 0;
        let py = 0;
        let pw = 0;
        for (let s = 0; s <= vSteps; s++) {
          const y = Math.min(h, s * sampleStep);
          sampleField(x, y, sx, sy, amp, twoSigma2, amt, out);
          const dx = x + out.ox;
          const dy = y + out.oy;
          if (s > 0) seg(px, py, dx, dy, (pw + out.w) / 2);
          px = dx;
          py = dy;
          pw = out.w;
        }
      }
      // horizontal lines
      const hSteps = Math.ceil(w / sampleStep);
      for (let y = 0; y <= h; y += cell) {
        let px = 0;
        let py = 0;
        let pw = 0;
        for (let s = 0; s <= hSteps; s++) {
          const x = Math.min(w, s * sampleStep);
          sampleField(x, y, sx, sy, amp, twoSigma2, amt, out);
          const dx = x + out.ox;
          const dy = y + out.oy;
          if (s > 0) seg(px, py, dx, dy, (pw + out.w) / 2);
          px = dx;
          py = dy;
          pw = out.w;
        }
      }
      for (let b = 0; b < NB; b++) {
        if ((counts[b] ?? 0) === 0) continue;
        const a = 0.25 + (0.35 * b) / (NB - 1);
        const p = paths[b];
        if (!p) continue;
        ctx.strokeStyle = `rgba(${lineRGB},${a})`;
        ctx.stroke(p);
      }
    };
    draw(); // initial flat lattice

    if (reduced) {
      // static fallback: flat lattice, static cards — hover highlight is
      // handled in CSS via the motion-reduce variant on each card
      const ro = new ResizeObserver(() => {
        measure();
        draw();
      });
      ro.observe(root);
      const mo = new MutationObserver(() => {
        readLineColor();
        draw();
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => {
        ro.disconnect();
        mo.disconnect();
      };
    }

    const loop = (now: number) => {
      // resting state drifts a slow lissajous orbit through the field at low
      // amplitude — ambient motion is the default look, not an extra that
      // only appears on hover
      let targetX: number;
      let targetY: number;
      let amtTarget: number;
      if (hovering) {
        targetX = tx;
        targetY = ty;
        amtTarget = 1;
      } else {
        const ang = now * IDLE_ANGULAR_SPEED;
        targetX = w / 2 + Math.cos(ang) * w * 0.22;
        targetY = h / 2 + Math.sin(ang * 1.3) * h * 0.22;
        amtTarget = IDLE_AMT;
      }
      // smoothed cursor: lerp per frame, flicks lag and the sheet relaxes
      sx += (targetX - sx) * cursorLerp;
      sy += (targetY - sy) * cursorLerp;
      amt += (amtTarget - amt) * cursorLerp;

      // nearest card = the focused one — accent border, the only accent
      let nearest = -1;
      if (hovering) {
        let best = Infinity;
        for (let i = 0; i < n; i++) {
          const dx = (centerX[i] ?? 0) - sx;
          const dy = (centerY[i] ?? 0) - sy;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) {
            best = d2;
            nearest = i;
          }
        }
      }
      if (nearest !== litIdx) {
        const prev = items[litIdx];
        if (prev) prev.style.borderColor = "";
        const next = items[nearest];
        if (next) next.style.borderColor = "var(--accent)";
        litIdx = nearest;
      }

      draw();

      // cards sample the same field: translate field(center) * 0.35,
      // nearest gets 0.6x plus scale 1.02 (dock-cursor-magnify pull)
      let maxDelta = 0;
      items.forEach((el, i) => {
        sampleField(
          centerX[i] ?? 0,
          centerY[i] ?? 0,
          sx,
          sy,
          amp,
          twoSigma2,
          amt,
          out
        );
        const gain = i === nearest ? 0.6 : 0.35;
        const cx = out.ox * gain;
        const cy = out.oy * gain;
        const targetS = i === nearest ? 1.02 : 1;
        const s = (scaleCur[i] ?? 1) + (targetS - (scaleCur[i] ?? 1)) * cursorLerp;
        scaleCur[i] = s;
        const dx = Math.abs(cx - (prevTx[i] ?? 0));
        const dy = Math.abs(cy - (prevTy[i] ?? 0));
        const ds = Math.abs(targetS - s) * 100;
        if (dx > maxDelta) maxDelta = dx;
        if (dy > maxDelta) maxDelta = dy;
        if (ds > maxDelta) maxDelta = ds;
        prevTx[i] = cx;
        prevTy[i] = cy;
        el.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(${s})`;
      });

      // sleep when everything has settled — pointer events wake the loop.
      // While at rest the idle target itself keeps drifting, so this only
      // fires once a steady hover position has fully caught up.
      const cursorErr = Math.abs(targetX - sx) + Math.abs(targetY - sy);
      const settled =
        cursorErr < 0.05 &&
        Math.abs(amtTarget - amt) < 0.001 &&
        maxDelta < 0.02;
      if (settled && amtTarget === 0) {
        amt = 0;
        items.forEach((el) => {
          el.style.transform = "";
        });
        draw();
      }
      raf = settled ? 0 : requestAnimationFrame(loop);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      tx = e.clientX - rect.left;
      ty = e.clientY - rect.top;
      if (!hovering && amt < 0.01) {
        // field is asleep — snap the smoothed cursor so the sheet does not
        // swing in from a stale position
        sx = tx;
        sy = ty;
      }
      hovering = true;
      wake();
    };
    const onLeave = () => {
      // eases everything home with the same lerp — interruptible by re-entry
      hovering = false;
      wake();
    };

    const ro = new ResizeObserver(() => {
      measure();
      draw();
    });
    ro.observe(root);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onMove);
    root.addEventListener("pointerleave", onLeave);

    // idle ambient motion only costs cycles while the lattice is on screen
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (visible) {
          wake();
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    // re-derive the line color from the theme token whenever dark/light
    // toggles the root's class list
    const mo = new MutationObserver(() => {
      readLineColor();
      draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    if (visible) wake(); // start the ambient orbit immediately, not on first pointer event

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [labels, cell, sampleStep, sigma, peakBend, cursorLerp]);

  return (
    <div
      ref={rootRef}
      aria-label={ariaLabel}
      className={`relative w-full overflow-hidden bg-background ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute inset-0 h-full w-full"
      />
      <div
        ref={gridRef}
        className="relative grid h-full grid-cols-2 gap-4 p-6 sm:grid-cols-3 sm:gap-6 sm:p-10"
      >
        {labels.map((label) => (
          <div
            key={label}
            className="flex min-h-28 items-end rounded-md border border-border bg-surface p-4 transition-colors duration-300 will-change-transform motion-reduce:hover:border-accent"
          >
            <span className="font-mono text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
