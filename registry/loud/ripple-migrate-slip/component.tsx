"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// RippleMigrateSlip — a full-bleed hero built on a real granular-bedform
// mechanic: aeolian sand-ripple migration. Wind-blown grains move by
// saltation and reptation; reptating grains preferentially pile up on a
// ripple's gentle STOSS (windward) face because a grain landing on an
// existing slope is more likely to be trapped there than one landing on
// flat ground — the positive feedback that grows and sustains a ripple
// rather than smoothing it flat. Once the stoss pile's local slope exceeds
// the angle of repose, the steep LEE (downwind) face avalanches — a small
// grain-flow slip that resets the face to a stable angle and kicks the
// ripple crest one step further downwind. Many ripples doing this on
// independent, staggered clocks is what makes the whole train visibly
// creep downwind at rest, with no two ripples slipping in sync.
//
// EACH RIPPLE IS ONE OBJECT, NOT A PARTICLE FIELD. amp is the current
// stoss-pile height; it grows continuously (modulated by a slow global
// gust sine) until it crosses the repose threshold, at which point a
// 260ms avalanche interpolates amp down to a stable residual and the
// crest forward by a few pixels — the interpolation IS the migration
// step, not a separate transform. The whole silhouette is an exact
// piecewise-linear polygon through each ripple's crest and post-lee
// trough, not a sampled heightfield, so there is no aliasing between the
// physics and what gets drawn.
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];

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

function relLuminance([r, g, b]: Vec3): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function mixColor(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// -- real numbers (documented in docs/specs/r12/ripple-migrate-slip.md) -----
// Spatial constants below are in "visual" canvas px: the spec's real-world
// figures (28-42px wavelength, 34deg repose on a 9px lee run) describe a
// sand ripple's own scale, which is far too small to read at full-bleed
// hero size — every spatial constant here is that same geometry scaled up
// ~5x for legibility (VISUAL_SCALE), while every RATE and TIMING constant
// (accretion rate target, avalanche duration, gust/migration cadence)
// stays tuned directly to the spec's stated cadences, since those are what
// the round 9 legibility rule actually governs.
const WAVELENGTH_MIN = 150; // px between a ripple and the next
const WAVELENGTH_MAX = 210;
const LEE_RUN = 40; // px: fixed run length of the steep lee face
const REPOSE_DEG = 34; // angle of repose: avalanche trigger
const STABLE_DEG = 20; // post-slip stable angle: leaves room to regrow
const THRESHOLD_AMP = LEE_RUN * Math.tan((REPOSE_DEG * Math.PI) / 180); // ~27
const STABLE_AMP = LEE_RUN * Math.tan((STABLE_DEG * Math.PI) / 180); // ~14.6
// Growth tuned so a ripple crosses threshold roughly every 9-12s (spec's
// "roughly one avalanche per ripple every ~9-12s"), and at ~9-14 ripples
// visible across a typical full-bleed width, the field-wide avalanche rate
// lands close to the spec's "~1 avalanche event per 1.1-1.6s somewhere in
// the visible field".
const STOSS_RATE_BASE = (THRESHOLD_AMP - STABLE_AMP) / 10; // px/s baseline
const GUST_PERIOD_S = 11;
const GUST_AMP_FRAC = 0.25;
const AVALANCHE_DURATION_S = 0.26;
const MIGRATE_MIN = 6; // px the crest advances per avalanche
const MIGRATE_MAX = 10;
const AMP_DISPLAY_SCALE = 4; // amp -> rendered ridge height
const DPR_CAP = 1.5;
// Reduced-motion freeze: run a deterministic 14s of settling (several
// ripples through at least one full cycle, asymmetric profile clearly
// established), then force the field's centre ripple into a mid-avalanche
// pose (t=0.5) so the frozen frame shows both the pre-slip overhang and
// the post-slip stable line at once — the single most structured moment
// per the spec.
const STATIC_TIME_S = 14;
const STATIC_SEED = 20260828;

interface Stipple {
  u: number; // 0..1 along the stoss segment, trough to crest
  dy: number; // px scatter off the slope line
  r: number; // dot radius
}

interface Ripple {
  x: number;
  amp: number;
  rateMul: number;
  avalanche: { t: number; fromAmp: number; toAmp: number; fromX: number; toX: number } | null;
  stipple: Stipple[];
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStipple(rand: () => number): Stipple[] {
  const count = 4 + Math.floor(rand() * 3); // 4-6
  const out: Stipple[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      u: 0.2 + rand() * 0.65,
      dy: (rand() - 0.5) * 10,
      r: 0.8 + rand() * 0.9,
    });
  }
  return out;
}

function buildRipples(w: number, rand: () => number): Ripple[] {
  const ripples: Ripple[] = [];
  let x = -WAVELENGTH_MAX;
  while (x < w + WAVELENGTH_MAX) {
    ripples.push({
      x,
      amp: rand() * THRESHOLD_AMP * 0.85,
      rateMul: 0.85 + rand() * 0.3,
      avalanche: null,
      stipple: buildStipple(rand),
    });
    x += WAVELENGTH_MIN + rand() * (WAVELENGTH_MAX - WAVELENGTH_MIN);
  }
  return ripples;
}

export interface RippleMigrateSlipProps {
  /** content rendered over the field, e.g. a headline + CTA */
  children?: React.ReactNode;
  className?: string;
}

export function RippleMigrateSlip({ children, className = "" }: RippleMigrateSlipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // -- token-derived ink, read at mount and re-derived on theme flip ------
    let bg: Vec3 = [10, 10, 10];
    let fg: Vec3 = [237, 237, 237];
    let ridgeFill = "rgb(120,120,120)";
    let stippleFill = "rgb(150,150,150)";
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      const light = relLuminance(bg) > 0.5;
      const ridgeMix = mixColor(bg, fg, 0.55);
      // Light theme is the harder case for the stipple to hold contrast
      // against the ridge fill, so its delta is widened rather than the
      // dark-theme value reused.
      const stippleDelta = light ? 0.22 : 0.12;
      const stippleMix = mixColor(bg, fg, Math.min(1, 0.55 + stippleDelta));
      ridgeFill = `rgb(${ridgeMix[0] | 0},${ridgeMix[1] | 0},${ridgeMix[2] | 0})`;
      stippleFill = `rgb(${stippleMix[0] | 0},${stippleMix[1] | 0},${stippleMix[2] | 0})`;
    };
    derive();

    // -- hot-path state: locals only, never React state ---------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let paused = false;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let simTime = 0;
    let ripples: Ripple[] = [];
    let rand = Math.random;

    const stepRipple = (r: Ripple, dt: number) => {
      if (r.avalanche) {
        const av = r.avalanche;
        av.t += dt / AVALANCHE_DURATION_S;
        if (av.t >= 1) {
          r.amp = av.toAmp;
          r.x = av.toX;
          r.avalanche = null;
        } else {
          const e = easeOutCubic(av.t);
          r.amp = lerp(av.fromAmp, av.toAmp, e);
          r.x = lerp(av.fromX, av.toX, e);
        }
        return;
      }
      const gust = 1 + GUST_AMP_FRAC * Math.sin((simTime / GUST_PERIOD_S) * Math.PI * 2);
      r.amp += STOSS_RATE_BASE * r.rateMul * Math.max(0.2, gust) * dt;
      if (r.amp >= THRESHOLD_AMP) {
        const migrate = MIGRATE_MIN + rand() * (MIGRATE_MAX - MIGRATE_MIN);
        r.avalanche = { t: 0, fromAmp: r.amp, toAmp: STABLE_AMP, fromX: r.x, toX: r.x + migrate };
      }
    };

    const step = (dt: number) => {
      simTime += dt;
      for (const r of ripples) stepRipple(r, dt);
    };

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (ripples.length < 2) return;
      const y0 = h * 0.68;

      // exact piecewise-linear ridge silhouette through each ripple's crest
      // and post-lee trough — no heightfield sampling, so it can't alias
      // against the physics driving it.
      ctx.beginPath();
      ctx.moveTo(ripples[0]!.x - 40, h);
      ctx.lineTo(ripples[0]!.x - 40, y0);
      for (let i = 0; i < ripples.length; i++) {
        const r = ripples[i]!;
        const next = ripples[i + 1];
        const gap = next ? next.x - r.x : LEE_RUN * 2;
        const troughX = r.x + Math.min(LEE_RUN, gap);
        ctx.lineTo(r.x, y0 - r.amp * AMP_DISPLAY_SCALE);
        ctx.lineTo(troughX, y0);
      }
      const lastR = ripples[ripples.length - 1]!;
      ctx.lineTo(lastR.x + LEE_RUN + 40, y0);
      ctx.lineTo(lastR.x + LEE_RUN + 40, h);
      ctx.closePath();
      ctx.fillStyle = ridgeFill;
      ctx.fill();

      // stoss-face stipple: a handful of fixed dots per ripple, riding the
      // stoss segment between the previous ripple's trough and this
      // ripple's crest, cheap and never per-pixel.
      ctx.fillStyle = stippleFill;
      for (let i = 1; i < ripples.length; i++) {
        const r = ripples[i]!;
        const prev = ripples[i - 1]!;
        const gap = r.x - prev.x;
        const prevTroughX = prev.x + Math.min(LEE_RUN, gap);
        const crestY = y0 - r.amp * AMP_DISPLAY_SCALE;
        for (const s of r.stipple) {
          const px = prevTroughX + (r.x - prevTroughX) * s.u;
          const py = y0 + (crestY - y0) * s.u + s.dy;
          ctx.beginPath();
          ctx.arc(px, py, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const renderStatic = () => {
      rand = mulberry32(STATIC_SEED);
      simTime = 0;
      ripples = buildRipples(w, rand);
      const stepDt = 1 / 60;
      let t = 0;
      while (t < STATIC_TIME_S) {
        const d = Math.min(stepDt, STATIC_TIME_S - t);
        step(d);
        t += d;
      }
      // Force the mechanic's signature mid-slip pose onto the field's
      // centre ripple so the frozen frame always shows the overhang.
      const target = ripples[Math.floor(ripples.length / 2)];
      if (target) {
        const origX = target.x;
        const migrate = MIGRATE_MIN + rand() * (MIGRATE_MAX - MIGRATE_MIN);
        const e = easeOutCubic(0.5);
        target.avalanche = null;
        target.amp = lerp(THRESHOLD_AMP, STABLE_AMP, e);
        target.x = lerp(origX, origX + migrate, e);
      }
      draw();
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, last === 0 ? 1 / 60 : (now - last) / 1000);
      last = now;
      step(dt);
      draw();
    };

    const rafLoop = (now: number) => {
      frame(now);
      if (!paused) raf = requestAnimationFrame(rafLoop);
    };

    const stopLoop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };

    const startLoop = () => {
      stopLoop();
      if (paused) return;
      if (reduced) {
        renderStatic();
        return;
      }
      rand = Math.random;
      simTime = 0;
      ripples = buildRipples(w, rand);
      raf = requestAnimationFrame(rafLoop);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      startLoop();
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const onThemeChange = () => derive();
    const mo = new MutationObserver(onThemeChange);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", onThemeChange);

    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedChange = () => {
      reduced = reducedMq.matches;
      startLoop();
    };
    reducedMq.addEventListener("change", onReducedChange);

    const onVisibility = () => {
      paused = document.hidden;
      if (paused) stopLoop();
      else startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let io: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        paused = !entry.isIntersecting || document.hidden;
        if (paused) stopLoop();
        else startLoop();
      });
      io.observe(root);
    }

    return () => {
      stopLoop();
      ro.disconnect();
      mo.disconnect();
      colorScheme.removeEventListener("change", onThemeChange);
      reducedMq.removeEventListener("change", onReducedChange);
      document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full overflow-hidden bg-background ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      {children}
    </div>
  );
}
