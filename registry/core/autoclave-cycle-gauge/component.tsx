"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// AutoclaveCycleGauge — a card-scale status widget modelled on the combined
// pressure/temperature gauge of a steam sterilizer: a needle sweeps a slow
// come-up ramp, sits through a timed hold with regulator chatter, then drops
// fast through an exhaust vent — three phases that read apart from needle
// SPEED alone, never from a printed number. A horizontal trace strip beneath
// the dial scrolls the same cycle's chamber-temperature profile as a ridge,
// confirming what the needle already showed.
//
// Real cycle: 0->15psi/121C come-up (real 8-20min, compressed ~40-60x into
// 12s), a 15psi/121C hold (real 15-20min, compressed into 15s) with +/-0.5deg
// continuous needle chatter (floored to ~1.6px of tip travel so it stays
// perceptible on small cards), then a 15->0psi vent (5s) — deliberately faster
// than the ramp, matching a real fast-exhaust cycle. Full loop 32s, repeats
// unbounded. The needle sweeps a fixed 270deg arc over a 0-20psi scale (the
// real 15psi max never pins it), so the SAME arc always reads ramp-slow,
// hold-still-with-tremor, vent-fast without any digit ever being drawn.
//
// Geometry is derived entirely from the container's smaller dimension: dial
// radius = 0.30x minDim, needle length = 0.36x minDim (the spec's governing
// ratio), so the whole thing rescales cleanly at card size. Colour is read
// once via getComputedStyle(document.documentElement) with no literal
// fallback of any kind and re-read on every documentElement class flip; the
// mount loop retries on the next rAF until both --foreground and
// --background resolve, and paints nothing before that.
// ---------------------------------------------------------------------------

const RAMP_S = 12; // 0 -> 15psi come-up
const HOLD_S = 15; // 15psi sustained
const VENT_S = 5; // 15 -> 0psi exhaust
const CYCLE_S = RAMP_S + HOLD_S + VENT_S; // 32s, unbounded repeat
const MAX_PSI = 15; // real sterilize set point (chamber temp climbs to 121C alongside it)
const SCALE_MAX = 20; // dial scale headroom — 15psi never pins the needle
const TREMOR_DEG = 0.5; // regulator chatter amplitude during hold
const TREMOR_HZ = 1.7; // continuous, not synced to any phase boundary
const SWEEP_DEG = 270; // total needle arc
const START_DEG = -135; // arc start, measured clockwise from straight up
const SCROLL_PX_S = 8; // temperature trace scroll rate
const STATIC_CYCLE_T = 18; // reduced-motion freeze: hold-phase midpoint
const TREMOR_PX_FLOOR = 1.6; // minimum needle-tip travel from tremor, in px

interface Sample {
  /** seconds into the current 32s cycle this sample was taken */
  cycleT: number;
  /** 0..1 fraction of MAX_PSI/MAX_TEMP_C */
  frac: number;
}

interface Tokens {
  fg: string;
  bg: string;
}

function readTokens(): Tokens | null {
  if (typeof document === "undefined") return null;
  const cs = getComputedStyle(document.documentElement);
  const fg = cs.getPropertyValue("--foreground").trim();
  const bg = cs.getPropertyValue("--background").trim();
  if (!fg || !bg) return null; // stylesheet not applied yet — paint nothing
  return { fg, bg };
}

/** psi/temp fraction (0..1) and phase for a given position inside one 32s cycle. */
function cycleState(cycleT: number): { frac: number; phase: "ramp" | "hold" | "vent" } {
  if (cycleT < RAMP_S) {
    return { frac: (cycleT / RAMP_S) * (MAX_PSI / SCALE_MAX), phase: "ramp" };
  }
  if (cycleT < RAMP_S + HOLD_S) {
    return { frac: MAX_PSI / SCALE_MAX, phase: "hold" };
  }
  const t = cycleT - RAMP_S - HOLD_S;
  const frac = (1 - t / VENT_S) * (MAX_PSI / SCALE_MAX);
  return { frac: Math.max(0, frac), phase: "vent" };
}

function angleForFrac(frac: number): number {
  const deg = START_DEG + frac * SWEEP_DEG;
  return (deg - 90) * (Math.PI / 180);
}

export interface AutoclaveCycleGaugeProps {
  /** small mono label above the dial */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function AutoclaveCycleGauge({
  label = "In progress",
  className = "",
}: AutoclaveCycleGaugeProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let tokens: Tokens | null = null;
    let dpr = 1;
    let w = 0;
    let h = 0;
    let sized = false;
    let visible = true;

    let start = 0; // performance.now() of cycle-relative t=0
    const samples: Sample[] = [];
    let staticFrame: { cycleT: number; samples: Sample[] } | null = null;

    let raf = 0;
    let tokenWaitRaf = 0;

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // -- layout: dial occupies the upper ~68% of the card, the temperature
    // trace strip the lower band, geometry always off minDim. -------------
    const layout = () => {
      const minDim = Math.min(w, h);
      const cx = w / 2;
      const cy = h * 0.4;
      const radius = minDim * 0.3;
      const needleLen = minDim * 0.36;
      const stripTop = h * 0.76;
      const stripBottom = h * 0.98;
      const stripLeft = w * 0.06;
      const stripRight = w * 0.94;
      return { cx, cy, radius, needleLen, stripTop, stripBottom, stripLeft, stripRight, minDim };
    };

    const draw = (cycleT: number, frameSamples: Sample[], freezeTremor = false) => {
      if (!tokens || !sized) return;
      const t = tokens;
      const { cx, cy, radius, needleLen, stripTop, stripBottom, stripLeft, stripRight, minDim } = layout();
      ctx.clearRect(0, 0, w, h);

      const { frac, phase } = cycleState(cycleT);
      // tremor amplitude stays TREMOR_DEG by default, but is floored to a
      // minimum tip-displacement in px (not degrees) so it stays perceptible
      // on small cards where 0.5deg would otherwise be sub-pixel — same
      // species as the needle's own 1.5px stroke-width floor.
      let tremorAmpRad = (TREMOR_DEG * Math.PI) / 180;
      const tremorPx = needleLen * Math.sin(tremorAmpRad);
      if (tremorPx < TREMOR_PX_FLOOR && needleLen > 0) {
        tremorAmpRad = Math.asin(Math.min(1, TREMOR_PX_FLOOR / needleLen));
      }
      const tremor =
        phase === "hold" && !freezeTremor
          ? Math.sin(cycleT * TREMOR_HZ * Math.PI * 2) * tremorAmpRad
          : 0;

      // -- dial rim + minor ticks, no numerals, no bezel: a faint arc and a
      // handful of short marks are enough to read "gauge" without reading
      // as an instrument panel. --------------------------------------------
      ctx.strokeStyle = t.fg;
      ctx.lineWidth = Math.max(1, minDim * 0.004);
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, angleForFrac(0), angleForFrac(1));
      ctx.stroke();

      ctx.globalAlpha = 0.28;
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        const a = angleForFrac(f);
        const x0 = cx + Math.cos(a) * radius * 0.86;
        const y0 = cy + Math.sin(a) * radius * 0.86;
        const x1 = cx + Math.cos(a) * radius;
        const y1 = cy + Math.sin(a) * radius;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }

      // -- needle: 1.5px floor so it stays visible against a light dial
      // face specifically. ---------------------------------------------
      const needleAngle = angleForFrac(frac) + tremor;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = t.fg;
      ctx.lineWidth = Math.max(1.5, minDim * 0.012);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(needleAngle) * needleLen, cy + Math.sin(needleAngle) * needleLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, minDim * 0.02), 0, Math.PI * 2);
      ctx.fillStyle = t.fg;
      ctx.fill();

      // -- temperature trace strip: baseline + scrolling ridge built from
      // the sample history, newest sample pinned to the strip's right edge
      // and older ones scrolled left at SCROLL_PX_S. ----------------------
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(stripLeft, stripBottom);
      ctx.lineTo(stripRight, stripBottom);
      ctx.stroke();

      if (frameSamples.length > 1) {
        const stripH = stripBottom - stripTop;
        const pts = frameSamples.map((s) => ({
          x: stripRight - (cycleT - s.cycleT) * SCROLL_PX_S,
          y: stripBottom - s.frac * stripH,
        }));
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = t.fg;
        ctx.beginPath();
        ctx.moveTo(pts[0]!.x, stripBottom);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.lineTo(pts[pts.length - 1]!.x, stripBottom);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = t.fg;
        ctx.lineWidth = Math.max(1, minDim * 0.006);
        ctx.lineJoin = "round";
        ctx.beginPath();
        pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      fitCanvas();
      sized = true;
    };

    const buildStaticSamples = (): Sample[] => {
      const out: Sample[] = [];
      const steps = 200;
      for (let i = 0; i <= steps; i++) {
        const cycleT = (i / steps) * STATIC_CYCLE_T;
        out.push({ cycleT, frac: cycleState(cycleT).frac });
      }
      return out;
    };

    const loop = (now: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // re-armed by the IntersectionObserver on re-entry
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      if (start === 0) start = now;
      const elapsedS = (now - start) / 1000;
      const cycleT = elapsedS % CYCLE_S;

      // new cycle began — clear the trace so the ridge always shows the
      // CURRENT cycle's profile, never a stitched-together previous one.
      const last = samples[samples.length - 1];
      if (last && cycleT < last.cycleT) samples.length = 0;

      const { frac } = cycleState(cycleT);
      samples.push({ cycleT, frac });
      // drop samples once they have scrolled fully off the left edge
      const maxAge = (w * 0.94 - w * 0.06 + 40) / SCROLL_PX_S;
      while (samples.length && cycleT - samples[0]!.cycleT > maxAge) samples.shift();

      draw(cycleT, samples);
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        staticFrame = { cycleT: STATIC_CYCLE_T, samples: buildStaticSamples() };
        draw(staticFrame.cycleT, staticFrame.samples, true);
        return; // no rAF loop, no timers, no observers driving motion
      }
      raf = requestAnimationFrame(loop);
    };

    const boot = () => {
      if (disposed) return;
      tokens = readTokens();
      if (!tokens) {
        tokenWaitRaf = requestAnimationFrame(boot);
        return;
      }
      resize();
      kick();
    };

    const ro = new ResizeObserver(() => {
      if (!tokens) return;
      resize();
      if (reduced && staticFrame) draw(staticFrame.cycleT, staticFrame.samples, true);
      kick();
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      tokens = readTokens();
      if (!tokens) return;
      if (reduced && staticFrame) {
        draw(staticFrame.cycleT, staticFrame.samples, true);
      } else if (sized) {
        draw((samples[samples.length - 1]?.cycleT ?? 0) % CYCLE_S, samples);
      }
      kick();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && tokens && !raf) {
        tokens = readTokens() ?? tokens; // pick up a theme flip that happened while hidden
        resize();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(wrap);

    boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(tokenWaitRaf);
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <p className="mb-3 font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
      <div className="relative w-full" style={{ aspectRatio: "4 / 3" }}>
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>
    </div>
  );
}
