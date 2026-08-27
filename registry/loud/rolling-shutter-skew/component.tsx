"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// RollingShutterSkew — a full-bleed ambient background modeling CMOS rolling
// shutter, the "jello effect" from a sensor that scans photosite rows
// top-to-bottom over a readout period instead of capturing every row at
// once. A vertical rule grid never sits straight: each of N virtual sensor
// rows samples a shared pan-velocity function at its own capture time
// (earlier rows are captured earlier than lower rows, by up to one full
// readout period), so a straight line bends into a piecewise parallelogram
// that keeps reshaping as the simulated pan oscillates. Skew is a pure,
// continuous function of elapsed time — no accumulated simulation state, no
// discrete steps, so "alive at rest" falls out of the formula itself rather
// than a stepped automaton.
//
// EXPLICITLY NOT flyback-tear (registry/loud/flyback-tear, cut on owner
// review — CRT family): flyback is a DISPLAY-side sync failure, a
// discontinuous tear/roll where the beam loses lock. This is CAPTURE-side
// and continuous by construction — every row is adjacent to its neighbor in
// both space and capture time, so the grid always bends smoothly, it never
// jumps or tears. If a build ever introduces a discontinuity here, that is
// the CRT-family bug this component exists specifically to avoid.
//
// EXPLICITLY NOT grid-magnetic-lattice (registry/core/grid-magnetic-lattice):
// that lattice bends toward the CURSOR via a gaussian pull field, an
// interactive tool grid. This grid bends from a self-running pan-velocity
// function that has nothing to do with cursor position; the optional
// pointer kick (below) perturbs the shared velocity term, it never creates
// a positional attractor.
//
// PHYSICS: pan velocity v(t) = 820*sin(2pi*t/5.8) + 140*sin(2pi*t/0.9) px/s
// — a slow base pan plus a faster handshake wobble, periods deliberately
// non-round so the combined phase doesn't visibly repeat on any short
// human-noticeable cycle. (The literal capture-side deceleration a real
// handheld rolling-shutter pan produces is only a few px of skew at 1/60s
// readout; velocity is scaled up roughly 6x from that literal figure so the
// bend reads clearly at showpiece scale — the Washburn-style capture-time
// formula itself, and the readout period, are the real physical numbers,
// only the pan amplitude is a showpiece exaggeration, same latitude
// weld-pool takes with specular structure.) Each of N_ROWS virtual sensor
// rows captures at captureTime(row) = t - (row/N)*T_RO, T_RO = 16.7ms (a
// 1/60s progressive CMOS readout), and its horizontal displacement is
// skew(row) = v(captureTime(row)) * (row/N) * T_RO — later rows accumulate
// more elapsed readout time and therefore more displacement, which is what
// bends a straight vertical rule into a parallelogram instead of just
// sliding it sideways.
//
// TOKENS: --foreground is the only ink color, drawn at fixed low alpha; no
// fill gradient, no --ns-accent anywhere — this is a resting ambient
// surface, and the optional pointer kick moves the SAME velocity term the
// ambient pan already uses, never a separate accent-tinted highlight.
// --background clears the canvas every frame. Both read via
// getComputedStyle(document.documentElement) only after document.fonts.ready
// resolves, before the first paint, and re-read on a MutationObserver
// watching documentElement's class; every path that could draw before that
// first read (ResizeObserver, IntersectionObserver, the reduced-motion
// branch) is gated behind a `ready` flag.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2;

const N_ROWS = 48; // virtual sensor rows sampled across the frame height
const T_RO = 0.0167; // s, CMOS progressive readout period (1/60s)
const PAN_PERIOD = 5.8; // s, slow base pan, deliberately non-round
const PAN_AMP = 820; // px/s
const WOBBLE_PERIOD = 0.9; // s, faster handshake component
const WOBBLE_AMP = 140; // px/s
const KICK_GAIN = 0.55; // px/s of extra velocity per px/s of pointer speed
const KICK_MAX = 420; // px/s, clamp on the pointer kick term
const KICK_TAU = 0.12; // s, exponential decay of the kick — back under 5% within ~400ms
const STATIC_TIME = 1.45; // reduced-motion freeze: quarter into the base pan, near peak velocity
const LINE_ALPHA = 0.35;
const LINE_WIDTH = 1; // css px at dpr 1

function panVelocity(t: number): number {
  return PAN_AMP * Math.sin((TAU * t) / PAN_PERIOD) + WOBBLE_AMP * Math.sin((TAU * t) / WOBBLE_PERIOD);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export interface RollingShutterSkewProps {
  /** grid spacing as a fraction of the container's smaller dimension. @default 1/24 */
  gridSpacingRatio?: number;
  /** freeze the field at its reduced-motion frame. @default false */
  paused?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function RollingShutterSkew({
  gridSpacingRatio = 1 / 24,
  paused = false,
  children,
  className = "",
  style,
}: RollingShutterSkewProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // token fields start empty and are assigned unconditionally from
    // getComputedStyle before any draw path can run — no literal fallback.
    let line = "";
    let bg = "";
    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      line = cs.getPropertyValue("--foreground").trim();
      bg = cs.getPropertyValue("--background").trim();
    };

    let dpr = 1;
    let width = 0;
    let height = 0;
    let sized = false;
    let ready = false;
    let disposed = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let simTime = 0;
    let kickVel = 0;

    let havePointer = false;
    let lastPointerX = 0;
    let lastPointerT = 0;

    const onPointerMove = (e: PointerEvent) => {
      if (reduced || paused) return;
      const now = performance.now();
      if (havePointer) {
        const dt = Math.max(0.001, (now - lastPointerT) / 1000);
        const vx = (e.clientX - lastPointerX) / dt;
        kickVel = clamp(kickVel + vx * KICK_GAIN, -KICK_MAX, KICK_MAX);
      }
      lastPointerX = e.clientX;
      lastPointerT = now;
      havePointer = true;
    };
    const onPointerLeave = () => {
      havePointer = false;
    };
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerleave", onPointerLeave);

    const draw = () => {
      if (!sized || !ready) return;

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const t = reduced ? STATIC_TIME : simTime;
      const kick = reduced ? 0 : kickVel;

      const spacing = Math.max(18, Math.min(width, height) * gridSpacingRatio);
      const count = Math.ceil(width / spacing) + 2;
      const rowH = height / N_ROWS;

      ctx.strokeStyle = line;
      ctx.globalAlpha = LINE_ALPHA;
      ctx.lineWidth = LINE_WIDTH;
      ctx.lineJoin = "round";
      ctx.beginPath();

      for (let li = -1; li < count; li++) {
        const baseX = li * spacing;
        for (let row = 0; row <= N_ROWS; row++) {
          const frac = row / N_ROWS;
          const captureTime = t - frac * T_RO;
          const v = panVelocity(captureTime) + kick;
          const skew = v * frac * T_RO;
          const x = baseX + skew;
          const y = row * rowH;
          if (row === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };

    const loop = (now: number) => {
      if (!visible) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      simTime += dt;
      kickVel *= Math.exp(-dt / KICK_TAU);
      draw();
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (!sized) return;
        draw();
        if (!reduced && !paused && visible && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      }, 150);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && ready && !reduced && !paused) {
          last = 0;
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (visible && ready && !reduced && !paused) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced || paused) draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.fonts.ready.then(() => {
      if (disposed) return;
      readTokens();
      resize();
      if (!sized) {
        ready = true;
        return;
      }
      ready = true;
      draw();
      if (!reduced && !paused) {
        raf = requestAnimationFrame(loop);
      }
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [gridSpacingRatio, paused]);

  return (
    <div
      ref={rootRef}
      className={`relative isolate h-full w-full overflow-hidden bg-background ${className}`}
      style={style}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
      {children ? <div className="relative z-[1] h-full w-full">{children}</div> : null}
    </div>
  );
}

RollingShutterSkew.displayName = "RollingShutterSkew";
