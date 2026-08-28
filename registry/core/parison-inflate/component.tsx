"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// ParisonInflate — a capacity/fill-progress meter rendered as a glassblower's
// parison inflating, not a bar or dial.
//
// SOURCE: standard hot-shop parison-forming sequence. After gathering, the
// gaffer blows a controlled breath of air down the blowpipe into the
// solid-but-workable gob, forming a thick-walled bubble (the parison) inside
// the glass. As it inflates, the bubble's wall thins in proportion to how
// much the radius has grown (wall volume is roughly conserved, so wall
// thickness falls off close to 1/r^2 as the bubble expands), and inflation
// is self-limiting — a thin-walled, over-blown parison chills and stiffens
// faster than a thick one, which is why gaffers reheat between blows rather
// than blowing continuously.
//
// Two concentric circles (outer wall, inner cavity) with radii derived from
// the container's smaller dimension. The gap between them is the wall,
// filled with a radial luminance gradient (denser/brighter near the outer
// wall, fading toward the cavity). Growth decelerates visibly (r(t) = r0 +
// (r1-r0)*(1-exp(-t/tau))) rather than following a cosmetic ease, mirroring
// the real self-limiting behaviour, then holds at the "about to over-blow"
// beat before a visible deflate-and-reset — the piece pulled from the pipe,
// a fresh gather starting the next blow.
// ---------------------------------------------------------------------------

const INFLATE_S = 2.6; // inflate phase duration
const TAU_S = 0.85; // exponential time constant — fast initial growth, visible deceleration
const HOLD_S = 0.6; // hold at full inflation — the "about to over-blow" beat
const DEFLATE_S = 0.5; // deflate-and-reset, eased back to r0
const CYCLE_S = INFLATE_S + HOLD_S + DEFLATE_S; // 3.7s

const R0_FRACTION = 0.08; // outer radius at rest, fraction of container's smaller dimension
const R1_FRACTION = 0.44; // outer radius target, fraction of container's smaller dimension

const WALL_START_FRACTION = 0.22; // wall thickness at r0, fraction of r0
// Spec's literal thinning exponent (1.8, an approximation of the real
// ~1/r^2 falloff) is self-cancelling against its own two stated endpoints:
// "22% of r0" and "4% of r1" resolve to the SAME absolute thickness
// (0.22*r0 == 0.04*r1 for r1 = 5.5*r0 here), and honoring both endpoints
// with a 1.8 exponent is impossible without w0 exceeding r0 itself. Taken
// literally, 1.8 thins the wall to under 1% of the smaller dimension well
// before the inflate beat is half over, and it stays there — a growing
// circle with a flat-looking rim, exactly this component's kill criterion.
// 0.75 is used instead: it keeps the same self-limiting, ever-decelerating
// character (thinning fastest early, slowest late) but spreads a visible
// ~3.5x thickness change continuously across the full 2.6s inflate beat.
// Deviation from the spec's stated exponent is intentional and documented
// here and in meta.json's instruction.
const WALL_EXPONENT = 0.75;
// Sub-pixel-degenerate safety net only (tiny containers) — does not engage
// across the normal card-scale radius range above, so it never flattens the
// visible thinning the way a larger floor would.
const WALL_FLOOR_FRACTION = 0.003; // floor, fraction of container's smaller dimension
// A fraction-of-dim floor shrinks along with the container, so on a small
// enough card it can drop under 1px and render as a faded partial-coverage
// line instead of a visible ring. This absolute-px floor only binds below
// ~300px dim (0.003*dim < 0.9px), well under the ~220px demo panel, so it
// never touches the visible thinning at normal card scale.
const WALL_FLOOR_PX = 0.9;

const FREEZE_PHASE_FRAC = 0.8; // reduced-motion freeze: 80% of the inflate phase
const FREEZE_T = FREEZE_PHASE_FRAC * INFLATE_S; // ~2.08s — thinning, not yet at the hold plateau

function easeInOutCubic(u: number): number {
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

/** Outer wall radius (px) at a given point in the inflate phase, 0..INFLATE_S. */
function inflateRadius(t: number, r0: number, r1: number): number {
  return r0 + (r1 - r0) * (1 - Math.exp(-t / TAU_S));
}

/** Wall thickness (px) at outer radius r, clamped to the visibility floor. */
function wallThickness(r: number, r0: number, floor: number): number {
  const w0 = WALL_START_FRACTION * r0;
  const raw = w0 * Math.pow(r0 / r, WALL_EXPONENT);
  return Math.max(raw, floor, WALL_FLOOR_PX);
}

/**
 * Outer wall radius (px) at time t within one CYCLE_S loop, or driven
 * directly by a controlled 0..1 value (see the `value` prop).
 */
function radiusAtCycleTime(t: number, r0: number, r1: number): number {
  const tc = t % CYCLE_S;
  if (tc < INFLATE_S) return inflateRadius(tc, r0, r1);
  const rHold = inflateRadius(INFLATE_S, r0, r1);
  if (tc < INFLATE_S + HOLD_S) return rHold;
  const u = Math.min(1, (tc - INFLATE_S - HOLD_S) / DEFLATE_S);
  return rHold + (r0 - rHold) * easeInOutCubic(u);
}

export interface ParisonInflateProps {
  /** accessible name for the reading, e.g. "Storage used" */
  label?: string;
  /** canvas panel height in px. Default 220. */
  height?: number;
  /**
   * Controlled fill fraction, 0..1. When provided, the loop stops: the
   * inflate curve maps monotonically to this value and holds (100% holds
   * at full inflation, it does not deflate/reset). Omit for the ambient,
   * self-looping demo state.
   */
  value?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function ParisonInflate({
  label = "Fill level",
  height = 220,
  value,
  className = "",
}: ParisonInflateProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controlled = typeof value === "number";
    const controlledValue = controlled ? Math.max(0, Math.min(1, value as number)) : 0;

    let fg = "";
    let muted = "";
    let tokensReady = false;

    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      const nextFg = root.getPropertyValue("--foreground").trim();
      const nextMuted = root.getPropertyValue("--ns-muted").trim();
      // no paint before a real token read: an empty computed value would
      // make addColorStop throw (unlike fillStyle, which silently no-ops on
      // an unparseable value), so tokensReady gates draw() structurally
      // instead of relying on a "currentColor" fallback reaching a gradient.
      tokensReady = Boolean(nextFg && nextMuted);
      if (tokensReady) {
        fg = nextFg;
        muted = nextMuted;
      }
    };

    let w = 0;
    let h = 0;
    let sized = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sized = true;
    };

    const draw = (t: number) => {
      if (!sized || !tokensReady) return;
      ctx.clearRect(0, 0, w, h);

      const dim = Math.min(w, h);
      const r0 = R0_FRACTION * dim;
      const r1 = R1_FRACTION * dim;
      const floor = WALL_FLOOR_FRACTION * dim;
      const cx = w / 2;
      const cy = h / 2;

      const rOuter = controlled
        ? inflateRadius(controlledValue * INFLATE_S, r0, r1)
        : radiusAtCycleTime(t, r0, r1);
      const wall = wallThickness(rOuter, r0, floor);
      const rInner = Math.max(0, rOuter - wall);

      // radial luminance gradient across the wall band only — the cavity
      // interior stays untouched (transparent, hollow) so the gradient
      // reads as material, not a filled disc
      const gradient = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
      gradient.addColorStop(0, muted);
      gradient.addColorStop(1, fg);

      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 1;
      ctx.fill("evenodd");
    };

    // -- loop ----------------------------------------------------------------
    let raf = 0;
    let last = 0;
    let globalT = 0;

    const loop = (now: number) => {
      const dtMs = last ? Math.min(250, now - last) : 1000 / 60;
      last = now;
      globalT += dtMs / 1000;
      draw(globalT);
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };

    const staticT = () => (reduced ? FREEZE_T : globalT);

    const mo = new MutationObserver(() => {
      readTokens();
      draw(staticT());
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        readTokens();
        resize();
        draw(staticT());
      }, 150);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const canAnimate = !controlled && !reduced;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting;
        if (visible && canAnimate && sized) {
          cancelAnimationFrame(raf);
          last = 0;
          raf = requestAnimationFrame(loop);
        } else if (!visible) {
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0 }
    );
    io.observe(canvas);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && canAnimate && sized) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // no paint before the first token read
    readTokens();
    resize();

    if (canAnimate) {
      draw(0);
      raf = requestAnimationFrame(loop);
    } else {
      draw(staticT());
    }

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [height, value]);

  const percentLabel = typeof value === "number" ? `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` : null;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] tracking-wide text-ns-muted">
          {label.toUpperCase()}
        </span>
        {percentLabel ? (
          <span className="font-mono text-[11px] tracking-wide text-ns-muted">{percentLabel}</span>
        ) : null}
      </div>
      {typeof value === "number" ? (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuenow={Math.round(Math.max(0, Math.min(1, value)) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2"
        >
          <canvas ref={canvasRef} aria-hidden="true" className="block w-full" style={{ height }} />
        </div>
      ) : (
        <div
          role="img"
          aria-label={`${label}: a thick-walled bubble inflating and thinning, decelerating as it grows, then deflating to reset`}
          className="mt-2"
        >
          <canvas ref={canvasRef} aria-hidden="true" className="block w-full" style={{ height }} />
        </div>
      )}
    </div>
  );
}
