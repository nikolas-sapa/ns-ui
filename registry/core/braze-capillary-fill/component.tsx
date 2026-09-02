"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// BrazeCapillaryFill — a progress/validation-fill indicator rendered as
// torch brazing: molten filler wicked sideways along a hairline joint gap
// by capillary action, not gravity or pressure.
//
// SOURCE: torch brazing (AWS Brazing Handbook). Filler at the joint mouth
// is drawn INTO a closely-fitted gap by capillary action — flow runs toward
// the hottest, narrowest part of the gap, not downhill — and a fillet only
// forms once filler reaches the far end and pools under surface tension.
// A well-fitted gap wicks fast and completely; a loose one just puddles.
//
// The front sweeps the gap once per loop, unforced, on its own internal
// clock — this is a resting ambient loop, not a press-driven animation; an
// optional `progress` prop can pin the front to real external state instead
// (see props), but the demo loop below runs with zero input regardless.
//
// Monochrome: every value is fg alpha over the bg backdrop, never a
// literal colour. "Molten" reads as the brightest (highest-alpha, freshest)
// point on the track; solidified fill settles to a lower, steady alpha;
// the unfilled gap ahead is un-painted (background) with only the border-
// toned sheet edges either side of it.
// ---------------------------------------------------------------------------

const FRONT_S = 6.3; // capillary front sweeps the full gap length, 0->1
const MENISCUS_S = 0.9; // fillet bulge grows once the front reaches the far end
const FILL_S = 9.4; // total "fill" era — front + meniscus + a quiet settle tail
const HOLD_S = 2.1; // full fillet holds
const FADE_S = 1.2; // fades back to an empty gap (a fresh joint, never a reverse wipe)
const LOOP_S = FILL_S + HOLD_S + FADE_S; // 12.7s

const FREEZE_PROGRESS = 0.62; // reduced-motion freeze: front mid-gap, wetted trail
// behind it and unfilled gap ahead both visible in the same frame — neither the
// empty t0 frame nor the full-fillet hold shows both halves of the mechanic at once.
const FREEZE_T = FREEZE_PROGRESS * FRONT_S;

const INSET_FRAC = 0.06; // seam starts/ends this fraction of width in from each edge
const SOLID_ALPHA = 0.68; // settled/solidified fill
const MOLTEN_ALPHA = 1; // brightest — the front itself and a fresh fillet
const GLOW_FRAC = 0.32; // fraction of the seam span the molten glow trails behind the front
const GLOW_WOBBLE_HZ = 0.08; // standing for local gap-width variance along the seam
const GLOW_WOBBLE_AMOUNT = 0.2;

function frontProgress(t: number): number {
  return Math.min(1, t / FRONT_S);
}

function meniscusProgress(t: number): number {
  return Math.min(1, Math.max(0, (t - FRONT_S) / MENISCUS_S));
}

export interface BrazeCapillaryFillProps {
  /** Accessible label for the reading, e.g. "Import progress". */
  label?: string;
  /** Canvas panel height in px. Default 96. */
  height?: number;
  /**
   * Pin the front to real external progress (0-1) instead of the ambient
   * demo loop. When omitted, the component runs its own unforced fill/
   * hold/fade cycle continuously — this is the default and what the
   * catalog card shows.
   */
  progress?: number;
  className?: string;
}

export function BrazeCapillaryFill({
  label = "Fill progress",
  height = 96,
  progress,
  className = "",
}: BrazeCapillaryFillProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let fg = "";
    let bg = "";
    let border = "";

    // fallbacks are CSS keywords, never literal colour values
    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      fg = root.getPropertyValue("--foreground").trim() || "currentColor";
      bg = root.getPropertyValue("--background").trim() || "Canvas";
      border = root.getPropertyValue("--border").trim() || "currentColor";
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
      if (!sized) return;
      ctx.clearRect(0, 0, w, h);

      const cy = h / 2;
      const gapHalf = Math.max(2, Math.min(h, w) * 0.03);
      const startX = w * INSET_FRAC;
      const endX = w * (1 - INSET_FRAC);
      const span = endX - startX;

      // sheet edges either side of the joint — separator lines, --border only.
      // Left edge sits flush at startX (the joint mouth, where the front must
      // visibly begin) — only the exit side overhangs, giving the fillet
      // meniscus room to bulge past endX.
      ctx.strokeStyle = border;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(startX, cy - gapHalf);
      ctx.lineTo(endX + h * 0.3, cy - gapHalf);
      ctx.moveTo(startX, cy + gapHalf);
      ctx.lineTo(endX + h * 0.3, cy + gapHalf);
      ctx.stroke();

      // -- phase resolution ---------------------------------------------
      const pinned = progressRef.current;
      let fillP: number;
      let meniscusP: number;
      let cycleAlpha = 1; // global fade multiplier for the fade-out phase
      let molten = MOLTEN_ALPHA;

      if (typeof pinned === "number") {
        fillP = Math.min(1, Math.max(0, pinned));
        meniscusP = fillP >= 1 ? 1 : 0;
      } else {
        const cycleT = t % LOOP_S;
        if (cycleT < FILL_S) {
          fillP = frontProgress(cycleT);
          meniscusP = meniscusProgress(cycleT);
        } else if (cycleT < FILL_S + HOLD_S) {
          fillP = 1;
          meniscusP = 1;
          // the fillet cools across the hold — molten brightness eases down
          // to the settled alpha rather than sitting at peak the whole time
          const holdT = (cycleT - FILL_S) / HOLD_S;
          molten = MOLTEN_ALPHA - (MOLTEN_ALPHA - SOLID_ALPHA) * Math.min(1, holdT * 1.6);
        } else {
          fillP = 1;
          meniscusP = 1;
          const fadeT = (cycleT - FILL_S - HOLD_S) / FADE_S;
          cycleAlpha = Math.max(0, 1 - fadeT);
          molten = SOLID_ALPHA;
        }
      }

      const frontX = startX + fillP * span;

      // -- solidified track (behind the front) ---------------------------
      if (fillP > 0) {
        ctx.globalAlpha = SOLID_ALPHA * cycleAlpha;
        ctx.fillStyle = fg;
        ctx.fillRect(startX, cy - gapHalf, frontX - startX, gapHalf * 2);
      }

      // -- molten glow trailing the front ---------------------------------
      if (fillP > 0 && fillP < 1) {
        const wobble = 1 + GLOW_WOBBLE_AMOUNT * Math.sin(2 * Math.PI * GLOW_WOBBLE_HZ * t);
        const glowLen = Math.max(4, GLOW_FRAC * span * wobble);
        const glowStart = Math.max(startX, frontX - glowLen);
        const grad = ctx.createLinearGradient(glowStart, 0, frontX, 0);
        grad.addColorStop(0, hexWithAlpha(fg, SOLID_ALPHA * cycleAlpha));
        grad.addColorStop(1, hexWithAlpha(fg, molten * cycleAlpha));
        ctx.fillStyle = grad;
        ctx.globalAlpha = 1;
        ctx.fillRect(glowStart, cy - gapHalf, frontX - glowStart, gapHalf * 2);
      }

      // -- fillet meniscus at the exit, once the front has arrived --------
      if (meniscusP > 0) {
        const maxR = gapHalf * 2.6;
        const r = maxR * easeOutBack(meniscusP);
        ctx.globalAlpha = molten * cycleAlpha;
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.ellipse(endX, cy, r * 0.55, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    // -- loop ------------------------------------------------------------
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

    const mo = new MutationObserver(() => {
      readTokens();
      draw(reduced ? FREEZE_T : globalT);
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
        draw(reduced ? FREEZE_T : globalT);
      }, 150);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting;
        if (visible && !reduced && sized) {
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
      if (!document.hidden && !reduced && sized) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // no paint before the first token read
    readTokens();
    resize();

    if (reduced) {
      draw(FREEZE_T);
    } else {
      draw(0);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      mo.disconnect();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [height]);

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] tracking-wide text-ns-muted">
          {label.toUpperCase()}
        </span>
        <span className="font-mono text-[11px] tracking-wide text-ns-muted">CAPILLARY FILL</span>
      </div>
      <div
        role="img"
        aria-label={`${label}: molten filler wicking along a joint gap, filling it and forming a fillet at the far end`}
        className="mt-2"
      >
        <canvas ref={canvasRef} aria-hidden="true" className="block w-full" style={{ height }} />
      </div>
    </div>
  );
}

/** Cubic ease-out with a slight overshoot then settle — a meniscus builds
 * past its resting bulge before easing back, not a flat asymptotic grow. */
function easeOutBack(x: number): number {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** #rrggbb -> rgba(...) string at the given alpha. Arithmetic on the token's
 * own channels only — never a new literal hue. */
function hexWithAlpha(hex: string, alpha: number): string {
  // Expand 3-digit shorthand first: this project's light --background is "#fff",
  // and returning it unchanged silently dropped the alpha, turning every fade
  // opaque in light theme while dark theme (6-digit tokens) looked correct.
  let clean = hex.trim().replace("#", "");
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
