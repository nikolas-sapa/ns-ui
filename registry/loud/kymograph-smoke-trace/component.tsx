"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// KymographSmokeTrace — a full-bleed hero built on a subtractive recording
// mechanic: a soot-coated drum turns beneath a fixed stylus that scratches a
// bright, permanent trace through the dark coating. The drum's circumference
// is wider than the visible window, so a hidden arc carries the trace off
// past the LEFT edge before it can reappear at the WRITE point on the right
// — a resmoking brush lives at the left edge and repaints that outgoing soot
// back to full density just before it exits view, which is what lets the
// drum recirculate forever without ever hard-resetting the canvas.
//
// Everything is drawn into one persistent offscreen buffer (the "drum"); the
// visible canvas each frame is just a window blitted out of that buffer, so
// the scratch trace is genuinely permanent ink, not a redrawn sample array.
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

// -- real numbers (documented in the spec, not exposed as props: this
// specific mechanical character IS the component) --------------------------
const SPEED_PX_S = 40; // drum surface speed
const REVOLUTION_FACTOR = 1.8; // drum circumference = container width * this
const WRITE_INSET = 26; // px from the right edge — the fixed stylus point
const BRUSH_INSET = 26; // px from the left edge — the fixed resmoke point
const TWITCH_INTERVAL_S = 3.2; // mean seconds between twitch events
const TWITCH_JITTER_S = 0.5; // +/- randomization on that interval
const TWITCH_RISE_S = 0.12;
const TWITCH_DECAY_S = 0.6;
const TWITCH_MIN_AMP = 18;
const TWITCH_MAX_AMP = 30;
const BASELINE_JITTER_AMP = 1.5;
const SCRATCH_WIDTH = 2;
const STATIC_TIME_S = 9.8; // reduced-motion freeze frame, deliberately non-t0
const DPR_CAP = 1.5;

// small deterministic PRNG so the reduced-motion freeze frame is built the
// same way the live loop would build it, just run once and stopped.
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

export interface KymographSmokeTraceProps {
  /** content rendered on top of the drum, e.g. a headline + CTA */
  children?: React.ReactNode;
  className?: string;
}

export function KymographSmokeTrace({
  children,
  className = "",
}: KymographSmokeTraceProps) {
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
    let mu: Vec3 = [110, 110, 110];
    const derive = () => {
      const cs = getComputedStyle(document.documentElement);
      bg = parseColor(cs.getPropertyValue("--background")) ?? bg;
      fg = parseColor(cs.getPropertyValue("--foreground")) ?? fg;
      mu = parseColor(cs.getPropertyValue("--ns-muted")) ?? mu;
    };
    derive();

    // -- hot-path state: locals only, never React state ---------------------
    let w = 0;
    let h = 0;
    let dpr = 1;
    let bufW = 0; // drum circumference, device px
    let buf: HTMLCanvasElement | null = null;
    let bctx: CanvasRenderingContext2D | null = null;
    let raf = 0;
    let last = 0;
    let paused = false;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let scrollOffset = 0; // world px, wraps at bufW (CSS px, not device)
    let prevWriteWorldX = 0;
    let prevStylusY = 0;
    let stylusY = 0; // css px, relative to h
    let nextTwitchAt = 0;
    let twitchStart = -Infinity;
    let twitchAmp = 0;
    let simTime = 0;
    let rand = Math.random;

    // -- soot texture: a muted fill biased toward the background so the
    // scratch trace (drawn at full foreground contrast) always reads as the
    // far end of the ramp from it in both themes -----------------------------
    const sootRGBA = (alpha: number) =>
      `rgba(${Math.round((mu[0] + bg[0]) / 2)},${Math.round(
        (mu[1] + bg[1]) / 2
      )},${Math.round((mu[2] + bg[2]) / 2)},${alpha})`;

    const paintSoot = (x0: number, width: number) => {
      if (!bctx || !buf || width <= 0) return;
      // a few overlapping rects at slightly varying alpha reads as a
      // textured coating rather than a flat fill
      bctx.fillStyle = sootRGBA(1);
      bctx.fillRect(x0, 0, width, buf.height);
      const grain = Math.max(2, Math.round(width / 6));
      for (let i = 0; i < grain; i++) {
        const gx = x0 + rand() * width;
        const gy = rand() * buf.height;
        const gw = 1 + rand() * 3;
        const gh = 1 + rand() * 3;
        bctx.fillStyle = sootRGBA(0.35 + rand() * 0.25);
        bctx.fillRect(gx, gy, gw, gh);
      }
    };

    const twitchOffset = (t: number) => {
      const dt = t - twitchStart;
      if (dt < 0) return 0;
      const rise = Math.min(1, dt / TWITCH_RISE_S);
      const decay = Math.exp(-dt / TWITCH_DECAY_S);
      const ring = Math.sin((dt / TWITCH_DECAY_S) * Math.PI * 2.4);
      return twitchAmp * rise * decay * ring;
    };

    const scheduleTwitch = (t: number) => {
      nextTwitchAt =
        t + TWITCH_INTERVAL_S + (rand() * 2 - 1) * TWITCH_JITTER_S;
      twitchAmp = TWITCH_MIN_AMP + rand() * (TWITCH_MAX_AMP - TWITCH_MIN_AMP);
    };

    const stylusYAt = (t: number) => {
      const jitter = Math.sin(t * 5.3) * BASELINE_JITTER_AMP * 0.6 +
        Math.sin(t * 11.7 + 1.4) * BASELINE_JITTER_AMP * 0.4;
      return h / 2 + jitter + twitchOffset(t);
    };

    // one simulation step: advances scrollOffset, scratches the buffer at
    // the write point, and resmokes the buffer at the brush point.
    const step = (dt: number) => {
      simTime += dt;
      if (simTime >= nextTwitchAt) {
        twitchStart = simTime;
        scheduleTwitch(simTime);
      }
      const prevOffset = scrollOffset;
      scrollOffset = (scrollOffset + SPEED_PX_S * dt) % (bufW / dpr);
      stylusY = stylusYAt(simTime);

      if (!bctx || !buf) return;
      const bufWCss = bufW / dpr;
      const writeWorldX = (scrollOffset + WRITE_INSET) % bufWCss;
      const wrapped = writeWorldX < prevWriteWorldX - 1; // crossed the seam
      bctx.strokeStyle = `rgb(${fg[0]},${fg[1]},${fg[2]})`;
      bctx.lineWidth = SCRATCH_WIDTH;
      bctx.lineCap = "round";
      if (!wrapped) {
        bctx.beginPath();
        bctx.moveTo(prevWriteWorldX * dpr, prevStylusY * dpr);
        bctx.lineTo(writeWorldX * dpr, stylusY * dpr);
        bctx.stroke();
      }
      prevWriteWorldX = writeWorldX;
      prevStylusY = stylusY;

      // resmoke: a fixed screen point (BRUSH_INSET from the left) that
      // continuously repaints whatever world column is currently passing
      // beneath it back to fresh soot, right before that column scrolls
      // off the visible window for good.
      const advance = Math.max(1, Math.ceil((scrollOffset - prevOffset + bufWCss) % bufWCss * dpr));
      const brushWorldX = ((scrollOffset + BRUSH_INSET) % bufWCss) * dpr;
      paintSoot(brushWorldX - advance, advance + 1);
    };

    const blit = () => {
      if (!buf) return;
      const bufWCss = bufW / dpr;
      const srcX = (scrollOffset % bufWCss) * dpr;
      const destWpx = Math.round(w * dpr);
      const hpx = Math.round(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, destWpx, hpx);
      const firstChunk = Math.min(destWpx, buf.width - srcX);
      ctx.drawImage(buf, srcX, 0, firstChunk, hpx, 0, 0, firstChunk, hpx);
      if (firstChunk < destWpx) {
        const remaining = destWpx - firstChunk;
        ctx.drawImage(buf, 0, 0, remaining, hpx, firstChunk, 0, remaining, hpx);
      }
    };

    const initBuffer = () => {
      const bufWCss = Math.max(w, 480) * REVOLUTION_FACTOR;
      bufW = Math.max(1, Math.round(bufWCss * dpr));
      const bh = Math.max(1, Math.round(h * dpr));
      buf = document.createElement("canvas");
      buf.width = bufW;
      buf.height = bh;
      bctx = buf.getContext("2d");
      scrollOffset = 0;
      prevWriteWorldX = WRITE_INSET;
      prevStylusY = h / 2;
      simTime = 0;
      nextTwitchAt = TWITCH_INTERVAL_S * 0.4;
      twitchStart = -Infinity;
      if (bctx) paintSoot(0, bufW);
    };

    const renderStatic = () => {
      // deterministic replay up to STATIC_TIME_S, then stop — the frame
      // never changes again, satisfying the reduced-motion byte-stability
      // check.
      rand = mulberry32(20260827);
      initBuffer();
      const stepDt = 1 / 60;
      let t = 0;
      while (t < STATIC_TIME_S) {
        const d = Math.min(stepDt, STATIC_TIME_S - t);
        step(d);
        t += d;
      }
      blit();
    };

    const draw = (now: number) => {
      const dt = Math.min(0.05, last === 0 ? 1 / 60 : (now - last) / 1000);
      last = now;
      step(dt);
      blit();
    };

    const rafLoop = (now: number) => {
      draw(now);
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
      raf = requestAnimationFrame(rafLoop);
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      initBuffer();
      startLoop();
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const onThemeChange = () => {
      derive();
      // soot already painted with the old tokens keeps its shape; only the
      // colour of future paints changes, matching how a MutationObserver
      // re-derive is expected to behave without a hard reset.
    };
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
