"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FloatRibbonDraw — a multi-stage pipeline/job-status bar modeled on the
// float-glass process (the Pilkington process, the method that produces
// essentially all flat glass made today): molten glass flows continuously
// onto a bath of molten tin, floats and spreads to its natural equilibrium
// thickness, and is drawn forward by top rollers at a constant line speed
// while it cools along the bath's length, entering molten (~1,000C) and
// exiting set (~600C). That process has no start/stop within a run — it is
// a single continuous draw — which is exactly the shape most "job status"
// widgets get wrong by pausing their idle animation while "waiting."
//
// TWO SEPARATE THINGS, deliberately not conflated:
//  - The THERMAL GRADIENT (bright/dense "molten" -> dim "set", left to
//    right) is a FIXED function of position along the bar. It represents
//    the pipeline's stages, and never itself animates — pausing it would
//    misrepresent a process stage as somehow reversible.
//  - The RIPPLE (a faint sine wobble riding the top edge, confined to the
//    still-molten first third and damped out by where the gradient has
//    mostly set) is what SCROLLS continuously at a constant rate. It is the
//    "alive at rest" signal: material is actively moving through the
//    pipeline right now, regardless of which stage is highlighted.
//
// Colour is luminance-only: every fill is a lerp between --ns-muted (t=0,
// "set") and --foreground (t=1, "molten") — never a literal orange/red heat
// colour. That mapping holds in both themes because --foreground is already
// the theme's highest-density ink (near-white in dark, near-black in
// light), so "hot" reads as "densest" in both, not as a hue.
//
// Optional `stages`/`activeStage` overlay fixed pipeline-stage tick marks
// (queued/processing/done, etc.) at even x-fractions along the bar — the
// ribbon's own gradient/ripple keeps running unconditionally underneath
// regardless of which stage is active, per the real process never stopping
// mid-draw.
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];

// Same parse+lerp idiom used elsewhere in this registry (house convention,
// duplicated per component rather than shared).
function parseColor(raw: string): Vec3 | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0], 16);
      const g = parseInt(hex[1]! + hex[1], 16);
      const b = parseInt(hex[2]! + hex[2], 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return Number.isNaN(r + g + b) ? null : [r, g, b];
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function lerpColor(a: Vec3, b: Vec3, t: number): Vec3 {
  const c = Math.min(1, Math.max(0, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * c),
    Math.round(a[1] + (b[1] - a[1]) * c),
    Math.round(a[2] + (b[2] - a[2]) * c),
  ];
}

function rgbStr(v: Vec3, alpha = 1): string {
  return alpha >= 1 ? `rgb(${v[0]},${v[1]},${v[2]})` : `rgba(${v[0]},${v[1]},${v[2]},${alpha})`;
}

const SAMPLES = 64; // 1D luminance/ripple lookup across the ribbon's length
const LAMBDA = 0.35; // exp decay constant, in ribbon-lengths — how fast "hot" gives way to "set"
const T_FLOOR = 0.08; // luminance never fully bottoms out to pure --ns-muted
const RIBBON_FRAC = 0.28; // ribbon band height as a fraction of container height
const SCROLL_FRAC_PER_S = 0.08; // ripple scroll speed, fraction of container width per second
const RIPPLE_WAVELEN_FRAC = 0.18; // ripple wavelength, fraction of container width
const RIPPLE_AMP_FRAC = 0.09; // ripple amplitude, fraction of ribbon height
const MOLTEN_ZONE = 0.34; // ripple envelope is ~0 past this fraction along the ribbon

function luminanceAt(xFrac: number): number {
  return T_FLOOR + (1 - T_FLOOR) * Math.exp(-xFrac / LAMBDA);
}

// ripple envelope: full amplitude near the molten (left) edge, damped to 0
// by MOLTEN_ZONE — a raised-cosine falloff, not a hard cutoff.
function rippleEnvelope(xFrac: number): number {
  if (xFrac >= MOLTEN_ZONE) return 0;
  const t = xFrac / MOLTEN_ZONE;
  return 0.5 * (1 + Math.cos(t * Math.PI));
}

export interface FloatRibbonDrawProps {
  /** total component height in px; the ribbon band derives as 28% of this. Default 88. */
  height?: number;
  /** optional ordered pipeline stage labels, drawn as fixed ticks along the bar */
  stages?: string[];
  /** index into `stages` that is currently active/lit. Omit for a purely ambient ribbon with no stage semantics. */
  activeStage?: number;
  /** accessible label for the status region. Default "Processing pipeline" */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function FloatRibbonDraw({
  height = 88,
  stages,
  activeStage,
  label = "Processing pipeline",
  className = "",
}: FloatRibbonDrawProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [announce, setAnnounce] = useState("");
  const lastAnnouncedRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!stages || activeStage === undefined) return;
    if (lastAnnouncedRef.current === activeStage) return;
    lastAnnouncedRef.current = activeStage;
    const s = stages[activeStage];
    if (s) setAnnounce(`Stage: ${s}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStage, stages?.join("|")]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let muted: Vec3 = [128, 128, 128];
    let fg: Vec3 = [0, 0, 0];
    let border: Vec3 = [128, 128, 128];
    let borderAlpha = 1;

    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      muted = parseColor(root.getPropertyValue("--ns-muted")) ?? muted;
      fg = parseColor(root.getPropertyValue("--foreground")) ?? fg;
      border = parseColor(root.getPropertyValue("--border")) ?? border;
      // --border ships at low alpha via its own token in some themes; if the
      // computed value carries no alpha channel, keep full opacity and let
      // the token's own colour do the (deliberately faint) work.
      const m = root.getPropertyValue("--border").match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/);
      borderAlpha = m ? Number(m[1]) : 1;
    };

    let width = 0;
    let sized = false;
    let ribbonH = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      width = rect.width;
      ribbonH = Math.max(4, height * RIBBON_FRAC);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };

    // scrollPx: how far the ripple texture has travelled, in css px. Never
    // resets — the draw is a single continuous run.
    let scrollPx = 0;

    const draw = () => {
      if (!sized) return;
      const rect = canvas.getBoundingClientRect();
      const h = rect.height;
      const top = (h - ribbonH) / 2;
      ctx.clearRect(0, 0, rect.width, h);

      // 1D sample lookup across the ribbon's length: luminance (fixed, a
      // function of x only) and ripple y-offset (a function of x and the
      // scroll phase), bilinearly interpolated between the SAMPLES points.
      const lum = new Float32Array(SAMPLES);
      const rip = new Float32Array(SAMPLES);
      const wavelenPx = Math.max(1, width * RIPPLE_WAVELEN_FRAC);
      const ampPx = ribbonH * RIPPLE_AMP_FRAC;
      for (let i = 0; i < SAMPLES; i++) {
        const xFrac = i / (SAMPLES - 1);
        lum[i] = luminanceAt(xFrac);
        const env = rippleEnvelope(xFrac);
        const xPx = xFrac * width;
        rip[i] = env * ampPx * Math.sin(((xPx + scrollPx) / wavelenPx) * Math.PI * 2);
      }

      const sampleAt = (arr: Float32Array, xFrac: number): number => {
        const pos = Math.min(SAMPLES - 1, Math.max(0, xFrac * (SAMPLES - 1)));
        const i0 = Math.floor(pos);
        const i1 = Math.min(SAMPLES - 1, i0 + 1);
        const f = pos - i0;
        const a = arr[i0] ?? 0;
        const b = arr[i1] ?? 0;
        return a + (b - a) * f;
      };

      // gradient fill along the ribbon's length, stopped at 12 points from
      // the pre-sampled luminance curve (the curve is exponential, not
      // linear, so a 2-stop canvas gradient would misrepresent it).
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      const STOPS = 12;
      for (let s = 0; s <= STOPS; s++) {
        const xFrac = s / STOPS;
        const t = sampleAt(lum, xFrac);
        grad.addColorStop(xFrac, rgbStr(lerpColor(muted, fg, t)));
      }

      ctx.beginPath();
      ctx.moveTo(0, top + sampleAt(rip, 0));
      const STEP = 2; // px, top-edge ripple polyline resolution
      for (let x = 0; x <= width; x += STEP) {
        const xFrac = x / width;
        ctx.lineTo(x, top + sampleAt(rip, xFrac));
      }
      ctx.lineTo(width, top + ribbonH);
      ctx.lineTo(0, top + ribbonH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // a thin --border rule under the full ribbon length, keeping the
      // "set" (right, low-luminance) end from disappearing into --surface
      // in light theme.
      ctx.beginPath();
      ctx.moveTo(0, top + ribbonH + 0.5);
      ctx.lineTo(width, top + ribbonH + 0.5);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgbStr(border, borderAlpha);
      ctx.stroke();

      // fixed pipeline-stage ticks, if provided — luminance only, never
      // accent, drawn on top of the ribbon at even x-fractions.
      if (stages && stages.length > 0) {
        for (let i = 0; i < stages.length; i++) {
          const xFrac = stages.length > 1 ? i / (stages.length - 1) : 0.5;
          const x = xFrac * width;
          const active = activeStage === i;
          ctx.fillStyle = rgbStr(active ? fg : muted, active ? 0.9 : 0.55);
          const tickH = active ? ribbonH * 0.55 : ribbonH * 0.35;
          ctx.fillRect(Math.round(x - 0.5), top + (ribbonH - tickH) / 2, 1, tickH);
        }
      }
    };

    let raf = 0;
    let last = 0;
    let visible = true;

    const loop = (now: number) => {
      if (!visible || document.hidden) {
        raf = 0;
        return;
      }
      const dtMs = last ? Math.min(250, now - last) : 1000 / 60;
      last = now;
      scrollPx += width * SCROLL_FRAC_PER_S * (dtMs / 1000);
      draw();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf || reduced) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        readTokens();
        resize();
        draw();
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start();
        else stop();
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      if (document.hidden) stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVis);

    // no paint before the first token read
    readTokens();
    resize();

    if (reduced) {
      // freeze at scroll-phase 0 — the ripple's most evenly-spread crest
      // layout across the molten zone, not an arbitrary mid-scroll moment.
      scrollPx = 0;
      draw();
    } else {
      draw();
      start();
    }

    return () => {
      stop();
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, stages?.join("|"), activeStage]);

  return (
    <div role="group" aria-label={label} className={`relative w-full ${className}`} style={{ height }}>
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full w-full" />
      {stages && stages.length > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 left-0 flex w-full justify-between px-0.5"
        >
          {stages.map((s, i) => (
            <span
              key={s}
              className="font-mono text-[9px] uppercase tracking-[0.1em]"
              style={{ color: activeStage === i ? "var(--foreground)" : "var(--ns-muted)" }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
