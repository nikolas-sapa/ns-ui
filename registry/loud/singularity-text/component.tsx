"use client";

import { useEffect, useRef } from "react";

// Headline as a monochrome particle cloud; the cursor is a gravity well that
// pulls letters into an orbital accretion ring, then springs them back into
// typeset. Single DPR-aware Canvas 2D over a visually hidden real <h1>.
// Direct-DOM rAF loop, no React state on the hot path, sleeps when settled.

const FLOATS = 6; // x, y, vx, vy, hx, hy
const MAX_PARTICLES = 5000;
const SAMPLE_STRIDE = 3; // px between alpha samples
const RING_RADIUS = 48; // px — inside this band particles render as streaks
const GUIDE_RADIUS = 36; // px — faint circle under the accretion band
const SOFTENING = 24 * 24; // d² floor so accel never blows up at the center
const DRAG = 0.92; // per-frame velocity drag
const DT_MAX = 0.032; // s — clamp tab-switch jumps

export function SingularityText({
  text = "SINGULARITY",
  gravity = 4_000_000,
  captureRadius = 180,
  springK = 90,
  damping = 0.55,
  className = "",
}: {
  text?: string;
  /** well strength G in px³/s²; accel a = G / max(d², 24²) */
  gravity?: number;
  /** px — pointer distance inside which the well owns a particle */
  captureRadius?: number;
  /** spring stiffness k in s⁻² for the return-home phase */
  springK?: number;
  /** damping ratio ζ; < 1 gives visible overshoot as letters reform */
  damping?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const heading = headingRef.current;
    if (!container || !canvas || !heading) return;
    // reduced motion: canvas stays hidden (CSS), real h1 stays visible — no loop
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dampC = 2 * damping * Math.sqrt(springK); // critical-damping fraction, s⁻¹

    let particles = new Float32Array(0);
    let count = 0;
    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerActive = false;
    let disposed = false;

    const init = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w < 2 || h < 2) return;
      width = w;
      height = h;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // rasterize the real heading's typography to an offscreen canvas
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d", { willReadFrequently: true });
      if (!octx) return;
      const cs = getComputedStyle(heading);
      octx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.fillStyle = "#ffffff";
      octx.fillText(text, w / 2, h / 2);
      const alpha = octx.getImageData(0, 0, w, h).data;

      // alpha > 128 on a 3px stride → home positions
      const homes: number[] = [];
      for (let y = 1; y < h; y += SAMPLE_STRIDE) {
        const row = y * w;
        for (let x = 1; x < w; x += SAMPLE_STRIDE) {
          if (alpha[(row + x) * 4 + 3] > 128) homes.push(x, y);
        }
      }
      const total = homes.length / 2;
      const keepEvery = Math.max(1, Math.ceil(total / MAX_PARTICLES));
      particles = new Float32Array(Math.ceil(total / keepEvery) * FLOATS);
      count = 0;
      for (let i = 0; i < total; i += keepEvery) {
        const o = count * FLOATS;
        const hx = homes[i * 2];
        const hy = homes[i * 2 + 1];
        particles[o] = hx;
        particles[o + 1] = hy;
        particles[o + 2] = 0;
        particles[o + 3] = 0;
        particles[o + 4] = hx;
        particles[o + 5] = hy;
        count++;
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(Math.max((now - last) / 1000, 0), DT_MAX);
      last = now;

      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineWidth = 2;

      // guide circle under the accretion band
      if (pointerActive) {
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = "#8f8f8f";
        ctx.beginPath();
        ctx.arc(pointerX, pointerY, GUIDE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = "#ededed";
      ctx.strokeStyle = "#ffffff"; // 1.6x brighter than #ededed clamps to white
      let settled = true;

      for (let i = 0; i < count; i++) {
        const o = i * FLOATS;
        let x = particles[o];
        let y = particles[o + 1];
        let vx = particles[o + 2];
        let vy = particles[o + 3];
        const hx = particles[o + 4];
        const hy = particles[o + 5];

        let ax: number;
        let ay: number;
        let inWell = false;
        let d = 0;
        if (pointerActive) {
          const dxp = pointerX - x;
          const dyp = pointerY - y;
          const d2 = dxp * dxp + dyp * dyp;
          d = Math.sqrt(d2);
          if (d < captureRadius) {
            inWell = true;
            // radial pull + 0.6x tangential so particles spiral, not beeline
            const a = gravity / Math.max(d2, SOFTENING);
            const inv = 1 / Math.max(d, 1e-4);
            const ux = dxp * inv;
            const uy = dyp * inv;
            ax = a * ux - a * 0.6 * uy;
            ay = a * uy + a * 0.6 * ux;
          } else {
            ax = springK * (hx - x) - dampC * vx;
            ay = springK * (hy - y) - dampC * vy;
          }
        } else {
          ax = springK * (hx - x) - dampC * vx;
          ay = springK * (hy - y) - dampC * vy;
        }

        vx = (vx + ax * dt) * DRAG;
        vy = (vy + ay * dt) * DRAG;
        x += vx * dt;
        y += vy * dt;

        particles[o] = x;
        particles[o + 1] = y;
        particles[o + 2] = vx;
        particles[o + 3] = vy;

        if (
          Math.abs(x - hx) > 0.5 ||
          Math.abs(y - hy) > 0.5 ||
          Math.abs(vx) > 2 ||
          Math.abs(vy) > 2
        ) {
          settled = false;
        }

        const speed = Math.hypot(vx, vy);
        const base = 0.5 + 0.5 * Math.min(1, speed / 500);
        if (inWell && d < RING_RADIUS) {
          // accretion band: brighter velocity-aligned streaks
          ctx.globalAlpha = Math.min(1, base * 1.6);
          if (speed > 1) {
            const len = Math.min(4, Math.max(2, speed * 0.008));
            const half = len / (2 * speed);
            ctx.beginPath();
            ctx.moveTo(x - vx * half, y - vy * half);
            ctx.lineTo(x + vx * half, y + vy * half);
            ctx.stroke();
          } else {
            ctx.fillRect(x - 1, y - 1, 2, 2);
          }
        } else {
          ctx.globalAlpha = base;
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }
      ctx.globalAlpha = 1;

      // sleep when everything is home and the cursor is gone
      raf = settled && !pointerActive ? 0 : requestAnimationFrame(loop);
    };

    const wake = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointerX = e.clientX - rect.left;
      pointerY = e.clientY - rect.top;
      pointerActive = true;
      wake();
    };
    const onLeave = () => {
      pointerActive = false;
      wake();
    };

    let ro: ResizeObserver | undefined;
    // sample only after Geist has loaded — a fallback-font raster is wrong
    document.fonts.ready.then(() => {
      if (disposed) return;
      init();
      wake();
      ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const w = Math.round(entry.contentRect.width);
        const h = Math.round(entry.contentRect.height);
        if (w !== width || h !== height) {
          init();
          wake();
        }
      });
      ro.observe(container);
    });

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro?.disconnect();
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
    };
  }, [text, gravity, captureRadius, springK, damping]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full cursor-crosshair select-none px-4 py-24 ${className}`}
    >
      {/* real heading: keeps semantics/a11y; visible static under reduced motion */}
      <h1
        ref={headingRef}
        className="whitespace-nowrap text-center font-semibold text-foreground opacity-0 motion-reduce:opacity-100"
        style={{ fontSize: "clamp(3rem, 9vw, 7rem)", lineHeight: 1.1 }}
      >
        {text}
      </h1>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full motion-reduce:hidden"
      />
    </div>
  );
}
