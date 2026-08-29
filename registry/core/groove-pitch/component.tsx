"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// GroovePitch — an ambient, indeterminate loader modeling a real mastering-
// lathe artifact: variable groove pitch. A cutting lathe varies the radial
// spacing between adjacent spiral turns in real time, based on program
// level, so loud/bassy passages get pulled wider (fewer grooves per inch,
// avoiding wall-to-wall breakthrough) and quiet passages get packed tight.
// The spiral here grows outward from a small lead-in at the center, its own
// turn spacing continuously widening and narrowing on a baked envelope, and
// a bright cutting-point marker rides its leading edge.
//
// Real vs. rendered rates are deliberately decoupled (round-9 legibility
// rule): real lathe rotation is 33 1/3 RPM and real pitch varies ~2x across
// ~40 grooves/mm — both documented below, neither animated 1:1. The
// rendered sweep is slowed to something a viewer can actually track: one
// revolution per 3s, one full "side" (lead-in to outer edge) over 42s, and
// a pitch-band transition roughly every 4s.
//
// Zero colour literals: --foreground is read via getComputedStyle at mount
// and re-read on a MutationObserver watching documentElement's class, with
// no paint before that first read. Canvas is DPR-capped, resized via
// ResizeObserver, paused via IntersectionObserver + visibilitychange.
// prefers-reduced-motion freezes on one drawn frame at 35% traversal,
// parked right where the pitch is visibly mid-transition.
// ---------------------------------------------------------------------------

const ANGULAR_RATE = (Math.PI * 2) / 3; // rad/s — 1 rendered rev / 3s (real: 33 1/3 RPM, documented only)
const TRAVERSAL_S = 42; // s — one full lead-in-to-edge sweep before reset
const PITCH_PERIOD_S = 8; // s — one wide/narrow modulation cycle (transition every ~4s)
const PITCH_RATIO = 5.8 / 2.2; // reference contrast at typical card scale, preserved at any size
const LEAD_IN_FRAC = 0.055; // inner radius as a fraction of the max drawn radius
const STATIC_PROGRESS = 0.35; // reduced-motion freeze: traversal fraction, mid pitch-transition

function parseHex(raw: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Radial gain per revolution at traversal-time t, oscillating between the
 * ratio's two poles around a mid pitch sized so the spiral's outer edge is
 * reached almost exactly at TRAVERSAL_S regardless of container size. */
function pitchAt(t: number, midPitch: number): number {
  const amp = (midPitch * (PITCH_RATIO - 1)) / (PITCH_RATIO + 1);
  return midPitch + amp * Math.sin((Math.PI * 2 * t) / PITCH_PERIOD_S);
}

/** Sample the spiral's polyline points, its own leading-edge angle/radius,
 * and the total revolutions swept, from t = 0 up to `tEnd` (traversal
 * seconds). Deterministic integration — same result every call for the same
 * tEnd, which is what lets the reduced-motion path just call it once. */
function buildSpiral(tEnd: number, maxR: number, r0: number, midPitch: number) {
  const dt = 1 / 60; // integration step, independent of the caller's paint rate
  let t = 0;
  let theta = 0;
  let r = r0;
  const pts: { x: number; y: number }[] = [];
  pts.push({ x: r, y: 0 });
  while (t < tEnd && r < maxR) {
    const dTheta = ANGULAR_RATE * dt;
    const pitch = pitchAt(t, midPitch);
    r += (pitch / (Math.PI * 2)) * dTheta;
    theta += dTheta;
    t += dt;
    pts.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
  }
  return { pts, theta, r: Math.min(r, maxR) };
}

export interface GroovePitchProps {
  /** accessible label for the loading status. @default "Loading" */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function GroovePitch({ label = "Loading", className = "" }: GroovePitchProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let dpr = 1;
    let w = 0;
    let h = 0;
    let intersecting = true;
    let pageVisible = document.visibilityState === "visible";
    let visible = intersecting && pageVisible;
    let startedAt = 0;

    let fg: [number, number, number] = [23, 23, 23];

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      fg = parseHex(cs.getPropertyValue("--foreground").trim()) ?? fg;
    };
    readTokens();

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      const elapsed = startedAt === 0 ? 0 : performance.now() / 1000 - startedAt;
      draw(reduced ? STATIC_PROGRESS * TRAVERSAL_S : elapsed);
    };

    // geometry keyed off the container's SMALLER dimension, so this reads
    // at card scale rather than only at full-bleed
    const geom = () => {
      const minDim = Math.min(w, h);
      const maxR = minDim * 0.425; // spiral fits inside 0.85 * minDim diameter
      const r0 = maxR * LEAD_IN_FRAC;
      const midPitch = (maxR - r0) / ((TRAVERSAL_S * ANGULAR_RATE) / (Math.PI * 2));
      return { maxR, r0, midPitch };
    };

    const draw = (tSeconds: number) => {
      if (w <= 0 || h <= 0) return;
      const { maxR, r0, midPitch } = geom();
      const t = Math.max(0, Math.min(TRAVERSAL_S, tSeconds % TRAVERSAL_S));
      const { pts } = buildSpiral(t, maxR, r0, midPitch);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h / 2);

      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},0.85)`;
      ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.006);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      // the cutting-point marker riding the spiral's leading edge — the one
      // thing a viewer should follow
      const tip = pts[pts.length - 1];
      if (tip) {
        ctx.beginPath();
        ctx.arc(tip.x, tip.y, Math.max(2, Math.min(w, h) * 0.018), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${fg[0]},${fg[1]},${fg[2]},1)`;
        ctx.fill();
      }

      ctx.restore();
    };

    const loop = (now: number) => {
      if (!visible || reduced) {
        raf = 0;
        return;
      }
      if (startedAt === 0) startedAt = now / 1000;
      draw(now / 1000 - startedAt);
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (raf === 0 && !reduced && visible) raf = requestAnimationFrame(loop);
    };

    resize();
    if (reduced) draw(STATIC_PROGRESS * TRAVERSAL_S);
    else wake();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const mo = new MutationObserver(() => {
      readTokens();
      const elapsed = startedAt === 0 ? 0 : performance.now() / 1000 - startedAt;
      draw(reduced ? STATIC_PROGRESS * TRAVERSAL_S : elapsed);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver(
      (entries) => {
        intersecting = entries[0]?.isIntersecting ?? true;
        visible = intersecting && pageVisible;
        if (visible) wake();
        else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(root);

    const onVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      visible = intersecting && pageVisible;
      if (visible) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        draw(STATIC_PROGRESS * TRAVERSAL_S);
      } else {
        startedAt = 0;
        wake();
      }
    };
    mq.addEventListener("change", onReducedChange);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      role="status"
      aria-label={label}
      data-groove-pitch
      className={`relative aspect-square w-full max-w-[220px] ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
