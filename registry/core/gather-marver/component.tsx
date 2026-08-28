"use client";

// GatherMarver — a file-upload / processing indicator sourced from the real
// gather-and-marver sequence in hot-glass work. A gaffer gathers a molten
// gob on the end of a blowpipe — it comes off the furnace lopsided — then
// rolls it back and forth on the marver, a flat steel table, to centre its
// mass around the pipe's axis and skin its surface before any blowing
// starts. That correction is the whole mechanic: an irregular, off-centre
// blob rolls across a flat baseline, visibly losing its lumps the longer it
// runs, while the pipe keeps spinning underneath it the entire time.
//
// The blob outline is a closed Catmull-Rom spline over 12 control points.
// Each point carries a fixed noise offset (up to ±35% of the base radius,
// seeded once per mount) representing the gob's initial lopsidedness. That
// offset is scaled every frame by 0.82 raised to the number of roll passes
// elapsed (continuous, not stepped, so the shrink itself reads smooth
// rather than snapping once per pass) — one roll pass being one full
// left-travel-then-right-travel cycle, 1.8s. Horizontal travel swings the
// blob's centre ±28% of the container's width around the marver's centre
// on that same 1.8s period. Independent of both the correction decay and
// the travel, the blob spins continuously at 24°/s — the pipe rotating
// under the gaffer's hand — which is what keeps the loop alive forever
// even after the gob reads as fully round: a perfectly centred disc still
// visibly turns.
//
// Two modes read off the same real-time clock. Indeterminate (no `progress`
// prop): the correction decay runs off genuine elapsed time and never
// stops, asymptotically approaching a round disc and staying there,
// spinning, for as long as the component is mounted. Determinate (a
// `progress` 0-100 prop supplied): the correction decay is driven by
// `progress` instead of elapsed time — 0.82^(progress/100 * 18), a
// mapping calibrated so progress=100 lands under 3% residual deviation,
// i.e. a settled, fully-round disc — while travel and spin keep running
// off the real clock regardless, so a HELD progress value still visibly
// rolls and turns rather than idling. Completion is never marked with
// --ns-accent: the finished state is just an evenly-lit --foreground disc.
import { useEffect, useLayoutEffect, useRef } from "react";

const CONTROL_POINTS = 12;
const RADIUS_FRAC = 0.42; // base blob radius, fraction of the container's SMALLER dimension
const MAX_LOPSIDE = 0.35; // initial control-point deviation, fraction of base radius
const DECAY_PER_PASS = 0.82; // deviation multiplier per roll pass (continuous exponent)
const PASS_PERIOD_MS = 1800; // one full left+right travel cycle
const TRAVEL_FRAC = 0.28; // horizontal travel amplitude, fraction of container width
const SPIN_DEG_PER_SEC = 24; // continuous pipe rotation, independent of travel/correction
const DETERMINATE_MAX_PASSES = 18; // progress=100 -> 0.82^18 ≈ 2.8% residual deviation

const STATIC_PASS = 5; // reduced-motion freeze: mid-correction, ~37% of starting deviation

interface Tokens {
  fg: string;
  muted: string;
  border: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    fg: get("--foreground", "#171717"),
    muted: get("--ns-muted", "#6b6b6b"),
    border: get("--border", "#e5e5e5"),
  };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform Catmull-Rom through a closed loop of points, drawn as cubic
 * beziers (tension 1) — a real spline, not a polygon smoothed by rounding
 * canvas joins. */
function tracePath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    if (i === 0) ctx.moveTo(p1.x, p1.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  ctx.closePath();
}

export interface GatherMarverProps {
  /** controlled progress, 0-100 — maps onto the correction decay instead of
   * elapsed time; travel and spin keep running off the real clock regardless.
   * Omit for the default indeterminate, self-driving loop. */
  progress?: number;
  /** accessible label. */
  "aria-label"?: string;
  /** extra classes merged onto the rendered root element — size it here; the canvas fills whatever box it's given */
  className?: string;
}

export function GatherMarver({
  progress,
  "aria-label": ariaLabel = "Processing",
  className = "",
}: GatherMarverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokensRef = useRef<Tokens>({ fg: "", muted: "", border: "" });
  const progressRef = useRef(progress);

  // token derive — synchronous, before first paint, so nothing can ever
  // draw with an empty/default ink colour
  useLayoutEffect(() => {
    tokensRef.current = readTokens();
  }, []);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = mulberry32(0x6a2b1f);
    const lopside: number[] = Array.from({ length: CONTROL_POINTS }, () => (rand() * 2 - 1) * MAX_LOPSIDE);
    const baseAngles = Array.from({ length: CONTROL_POINTS }, (_, i) => (i / CONTROL_POINTS) * Math.PI * 2);

    let width = 0;
    let height = 0;
    let visible = true;
    let raf = 0;
    let clockMs = 0; // accumulated visible elapsed time — drives the indeterminate decay + travel + spin
    let last = 0;

    const computeGeometry = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduced) {
        drawFrame(true);
      } else {
        draw();
      }
    };

    const draw = () => drawFrame(false);

    const drawFrame = (staticFrame: boolean) => {
      if (width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);
      const { fg, muted, border } = tokensRef.current;

      const baseRadius = RADIUS_FRAC * Math.min(width, height);
      const baselineY = height * 0.66;
      const cx0 = width / 2;

      let travelFrac: number;
      let spinRad: number;
      let devFactor: number;

      if (staticFrame) {
        travelFrac = 0; // centred — the structured, legible freeze frame
        spinRad = 0;
        devFactor = Math.pow(DECAY_PER_PASS, STATIC_PASS);
      } else {
        const p = clockMs / PASS_PERIOD_MS;
        travelFrac = TRAVEL_FRAC * Math.sin(p * Math.PI * 2 - Math.PI / 2);
        spinRad = ((clockMs / 1000) * SPIN_DEG_PER_SEC * Math.PI) / 180;
        const heldProgress = progressRef.current;
        if (typeof heldProgress === "number") {
          const passesEq = (Math.max(0, Math.min(100, heldProgress)) / 100) * DETERMINATE_MAX_PASSES;
          devFactor = Math.pow(DECAY_PER_PASS, passesEq);
        } else {
          devFactor = Math.pow(DECAY_PER_PASS, p);
        }
      }

      const centerX = cx0 + travelFrac * width;
      const centerY = baselineY - baseRadius;

      // marver line — a static 1px separator the blob rolls along, never a
      // fill or stroke of the blob itself
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baselineY + 0.5);
      ctx.lineTo(width, baselineY + 0.5);
      ctx.stroke();

      const pts = baseAngles.map((angle, i) => {
        const r = baseRadius * (1 + lopside[i]! * devFactor);
        const a = angle + spinRad;
        return { x: centerX + r * Math.cos(a), y: centerY + r * Math.sin(a) };
      });

      tracePath(ctx, pts);
      const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * (1 + MAX_LOPSIDE));
      grad.addColorStop(0, fg);
      grad.addColorStop(1, muted);
      ctx.fillStyle = grad;
      ctx.fill();
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return; // paused: no reschedule, resume path restarts it
      if (last === 0) last = now;
      clockMs += Math.min(100, now - last);
      last = now;
      draw();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf || reduced) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(computeGeometry);
    ro.observe(container);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start();
      },
      { threshold: 0 }
    );
    io.observe(container);

    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReducedChange = () => {
      reduced = mq.matches;
      if (reduced) {
        cancelAnimationFrame(raf);
        raf = 0;
        drawFrame(true);
      } else {
        start();
      }
    };
    mq.addEventListener("change", onReducedChange);

    const mo = new MutationObserver(() => {
      tokensRef.current = readTokens();
      if (reduced) drawFrame(true);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });

    computeGeometry();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mq.removeEventListener("change", onReducedChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasProgress = typeof progress === "number";
  const clamped = hasProgress ? Math.max(0, Math.min(100, progress as number)) : undefined;

  return (
    <div
      ref={containerRef}
      role={hasProgress ? "progressbar" : "img"}
      aria-valuemin={hasProgress ? 0 : undefined}
      aria-valuemax={hasProgress ? 100 : undefined}
      aria-valuenow={hasProgress ? Math.round(clamped as number) : undefined}
      aria-label={ariaLabel}
      className={`relative block overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
    </div>
  );
}
