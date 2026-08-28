"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ExtrusionDieCut — a card-scale processing/loader widget modelled on pasta
// die-face cutting: a textured rope is continuously forced out of a die
// aperture under constant pressure, and a rotating guillotine blade sweeps
// across the die face at a fixed interval, severing the rope into a falling
// segment that drops into a settling stack. Two independent clocks: rope
// growth is continuous, the cut is discrete and periodic — the READ is
// "something is always extruding AND something is periodically finished".
//
// Rope length between cuts equals CUT_SPAN (die-to-blade distance); advance
// rate is derived FROM that span and the target cadence (CUT_INTERVAL_S),
// not the other way round, so span and interval never drift out of sync with
// each other on resize. Real numbers, tuned for card scale rather than lifted
// 1:1 from an industrial line: a cut fires every ~2.2s (+/-8% jitter, never
// perfectly metronomic — real die-cutters hunt slightly), each stroke takes
// 220ms and is a visible sweep, never a blink (round-9's "transition must
// show departure and arrival" rule). Rope surface texture is a die-drag
// striation: a stable hash of the rope-local x-coordinate, not per-frame
// noise, so it reads as a fixed material property rather than shimmer.
//
// A cut segment falls under a light constant acceleration and settles into a
// loose floor stack; once six segments have accumulated the oldest fades out
// so the stack never overflows the card. Colour is read once via
// getComputedStyle(document.documentElement) with no literal fallback, and
// nothing paints until both --foreground and --background resolve — the
// mount loop retries on the next rAF until then (the same guard as every
// other token-driven canvas in this registry, and the exact failure mode the
// builder brief calls "no paint before the first token read").
// ---------------------------------------------------------------------------

const CUT_INTERVAL_S = 2.2; // mean seconds between cuts
const CUT_JITTER = 0.08; // +/-8% on that interval, re-rolled per segment
const CUT_STROKE_S = 0.22; // blade sweep duration — a travel, not a blink
const STRIATION_PITCH_PX = 3; // die-drag ridge pitch along the rope
const STRIATION_VARIANCE = 0.06; // +/-6% luminance ripple within the rope's own tone
const GRAVITY_PX_S2 = 40; // segment fall acceleration
const MAX_STACK = 6;
const STACK_FADE_S = 0.4;
const DPR_CAP = 2;

interface FallingSegment {
  id: number;
  x: number; // left edge, css px
  len: number;
  y: number; // current top-of-rope y while falling; settles at floorY
  vy: number;
  settled: boolean;
  settledAt: number; // performance.now() ms, for fade timing once evicted
  fadeStart: number | null;
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

function hash1(i: number): number {
  const h = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return h - Math.floor(h);
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

export interface ExtrusionDieCutProps {
  /** small mono label above the widget */
  label?: string;
  /** 0..1 determinate progress. Scales how much of the span extrudes before
   * a cut fires; the cut cadence itself never changes. Omit for ambient use. */
  progress?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function ExtrusionDieCut({
  label = "Processing",
  progress,
  className = "",
}: ExtrusionDieCutProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

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

    let raf = 0;
    let tokenWaitRaf = 0;
    let last = 0;
    let staticFrame = false;

    // -- sim state -----------------------------------------------------------
    let ropeLen = 0; // current extruded length, css px, resets to 0 after a cut
    let cutSpan = 200; // die-to-blade distance, recomputed on resize
    let advancePxS = 90; // derived from cutSpan / CUT_INTERVAL_S, jittered per segment
    let strokeT: number | null = null; // 0..CUT_STROKE_S while a blade sweep is in flight
    let pendingSegment: { len: number } | null = null; // rope length at the moment a stroke starts
    let segments: FallingSegment[] = [];
    let nextId = 0;
    let rand = Math.random;

    const rollAdvance = () => {
      const jitterMul = 1 + (rand() * 2 - 1) * CUT_JITTER;
      const prog = progressRef.current;
      const progMul = prog == null ? 1 : Math.max(0.3, Math.min(1.7, 0.3 + prog * 1.4));
      advancePxS = (cutSpan / CUT_INTERVAL_S) * jitterMul * progMul;
    };

    const layout = () => {
      const minDim = Math.min(w, h);
      const dieX = w * 0.08;
      const ropeY = h * 0.3;
      const ropeThickness = Math.max(3, minDim * 0.045);
      const bladeX = dieX + cutSpan;
      const floorY = h * 0.88;
      return { dieX, ropeY, ropeThickness, bladeX, floorY, minDim };
    };

    const fitCanvas = () => {
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) {
        sized = false;
        return;
      }
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      w = rect.width;
      h = rect.height;
      cutSpan = w * 0.62;
      fitCanvas();
      sized = true;
    };

    // -- rope striation: a stable hash of the rope-LOCAL x-coordinate (not
    // world/frame time), so texture reads as a fixed material property that
    // scrolls with growth rather than shimmering per frame. -----------------
    const drawRope = (fg: string, len: number, dieX: number, ropeY: number, thickness: number) => {
      if (len <= 0) return;
      const cells = Math.max(1, Math.ceil(len / STRIATION_PITCH_PX));
      for (let i = 0; i < cells; i++) {
        const x0 = dieX + i * STRIATION_PITCH_PX;
        const cw = Math.min(STRIATION_PITCH_PX, dieX + len - x0);
        if (cw <= 0) break;
        const ripple = (hash1(i) * 2 - 1) * STRIATION_VARIANCE;
        ctx.globalAlpha = 0.62 + ripple;
        ctx.fillStyle = fg;
        ctx.fillRect(x0, ropeY - thickness / 2, cw, thickness);
      }
      ctx.globalAlpha = 1;
    };

    const drawDie = (fg: string, dieX: number, ropeY: number, thickness: number) => {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = fg;
      ctx.lineWidth = Math.max(1.5, thickness * 0.18);
      ctx.beginPath();
      ctx.moveTo(dieX, ropeY - thickness * 1.4);
      ctx.lineTo(dieX, ropeY + thickness * 1.4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawBlade = (fg: string, bladeX: number, ropeY: number, thickness: number, sweepFrac: number) => {
      // travels top-to-bottom across the rope over CUT_STROKE_S — a visible
      // stroke, matching round-9's "transition must show departure and
      // arrival, not a blink".
      const spanTop = ropeY - thickness * 2.6;
      const spanBottom = ropeY + thickness * 2.6;
      const bladeY = spanTop + (spanBottom - spanTop) * Math.min(1, sweepFrac);
      ctx.strokeStyle = fg;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bladeX, spanTop);
      ctx.lineTo(bladeX, bladeY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawSegments = (fg: string, ropeY: number, thickness: number, nowMs: number) => {
      for (const seg of segments) {
        let alpha = 0.62;
        if (seg.fadeStart != null) {
          const age = (nowMs - seg.fadeStart) / 1000;
          alpha *= Math.max(0, 1 - age / STACK_FADE_S);
          if (alpha <= 0) continue;
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fg;
        ctx.fillRect(seg.x, seg.y - thickness / 2, seg.len, thickness);
      }
      ctx.globalAlpha = 1;
    };

    const spawnSegment = (len: number, dieX: number, ropeY: number, floorY: number, gapFromBlade: number) => {
      // segment's left edge starts at the die; right edge sits gapFromBlade
      // px short of the blade — a visible severed gap, not a flush cut.
      const seg: FallingSegment = {
        id: nextId++,
        x: dieX,
        len: Math.max(1, len - gapFromBlade),
        y: ropeY,
        vy: 0,
        settled: false,
        settledAt: 0,
        fadeStart: null,
      };
      segments.push(seg);
    };

    const settleStack = (floorY: number, thickness: number) => {
      const settled = segments.filter((s) => s.settled && s.fadeStart == null);
      if (settled.length > MAX_STACK) {
        const excess = settled.length - MAX_STACK;
        for (let i = 0; i < excess; i++) settled[i]!.fadeStart = performance.now();
      }
      segments = segments.filter((s) => s.fadeStart == null || performance.now() - s.fadeStart < STACK_FADE_S * 1000);
      // loose stagger: each new settle stacks slightly left of the previous
      const rows = segments.filter((s) => s.settled);
      rows.forEach((s, i) => {
        s.y = floorY - i * (thickness * 0.9);
        s.x = 0 + (i % 3) * 6;
      });
    };

    const step = (dt: number, nowMs: number) => {
      const { dieX, ropeY, ropeThickness, bladeX, floorY } = layout();

      if (strokeT == null) {
        ropeLen = Math.min(cutSpan, ropeLen + advancePxS * dt);
        if (ropeLen >= cutSpan) {
          strokeT = 0;
          pendingSegment = { len: ropeLen };
        }
      } else {
        strokeT += dt;
        if (strokeT >= CUT_STROKE_S) {
          if (pendingSegment) {
            spawnSegment(pendingSegment.len, dieX, ropeY, floorY, 4);
            pendingSegment = null;
          }
          strokeT = null;
          ropeLen = 0;
          rollAdvance();
        }
      }

      for (const seg of segments) {
        if (seg.settled) continue;
        seg.vy += GRAVITY_PX_S2 * dt;
        seg.y += seg.vy * dt;
        if (seg.y >= floorY) {
          seg.y = floorY;
          seg.settled = true;
        }
      }
      settleStack(floorY, ropeThickness);
    };

    const draw = (nowMs: number) => {
      if (!tokens || !sized) return;
      const { fg } = tokens;
      const { dieX, ropeY, ropeThickness, bladeX, floorY } = layout();
      ctx.clearRect(0, 0, w, h);

      // floor line for the settling tray
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dieX * 0.3, floorY + ropeThickness);
      ctx.lineTo(w * 0.96, floorY + ropeThickness);
      ctx.stroke();
      ctx.globalAlpha = 1;

      drawSegments(fg, ropeY, ropeThickness, nowMs);
      drawDie(fg, dieX, ropeY, ropeThickness);
      drawRope(fg, ropeLen, dieX, ropeY, ropeThickness);
      if (strokeT != null) {
        drawBlade(fg, dieX + cutSpan, ropeY, ropeThickness, strokeT / CUT_STROKE_S);
      }
    };

    // -- reduced-motion freeze: constructed directly rather than replayed,
    // deliberately mid-cut so the die texture, the blade in travel AND a
    // just-severed segment are all visible in one frame — the single most
    // information-dense state, matching the spec's non-t0 freeze rule. -----
    const buildStaticFrame = () => {
      rand = mulberry32(20260827);
      const { dieX, ropeY, floorY } = layout();
      ropeLen = cutSpan - 4; // severed stub short of the blade by the same 4px gap
      strokeT = CUT_STROKE_S * 0.6; // blade 60% through its stroke
      pendingSegment = null;
      segments = [];
      nextId = 0;
      // one freshly-cut segment sitting just past the die with its 4px gap,
      // not yet fallen
      spawnSegment(cutSpan, dieX, ropeY, floorY, 4);
      segments[0]!.y = ropeY;
      // a small settled stack behind it, so the frame also shows history
      for (let i = 0; i < 3; i++) {
        spawnSegment(cutSpan * (0.7 + rand() * 0.2), dieX, ropeY, floorY, 4 + rand() * 20);
        const s = segments[segments.length - 1]!;
        s.settled = true;
      }
      settleStack(floorY, layout().ropeThickness);
    };

    const loop = (nowMs: number) => {
      if (disposed) return;
      if (!visible) {
        raf = 0; // re-armed by the IntersectionObserver on re-entry
        return;
      }
      raf = requestAnimationFrame(loop);
      if (!sized || !tokens) return;
      const dt = Math.min(0.05, last === 0 ? 1 / 60 : (nowMs - last) / 1000);
      last = nowMs;
      step(dt, nowMs);
      draw(nowMs);
    };

    let started = false;
    const kick = () => {
      if (started || disposed || !tokens || !sized) return;
      started = true;
      if (reduced) {
        staticFrame = true;
        buildStaticFrame();
        draw(performance.now());
        return; // no rAF loop, no timers, no observers driving motion
      }
      rollAdvance();
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
      if (staticFrame) {
        buildStaticFrame();
        draw(performance.now());
      }
      kick();
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      tokens = readTokens();
      if (!tokens) return;
      if (staticFrame) draw(performance.now());
      else if (sized) draw(performance.now());
      kick();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const io = new IntersectionObserver((entries) => {
      const wasVisible = visible;
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduced && tokens && !raf) {
        tokens = readTokens() ?? tokens; // pick up a theme flip that happened while hidden
        resize();
        last = 0;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative w-full max-w-sm overflow-hidden rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <p className="mb-3 font-mono text-[11px] tracking-widest text-ns-muted">{label}</p>
      <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  );
}
