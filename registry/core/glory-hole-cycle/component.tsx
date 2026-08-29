"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// GloryHoleCycle — a "still actively processing" status chip modeled on a
// glassblower's glory-hole reheat cycle, not a generic pulsing dot. Real hot
// glass cools the instant it leaves the furnace mouth, so a gaffer plunges
// the piece back in on a steady beat to bring it back to working heat, then
// pulls it out to work it while hot — repeat for as long as the piece is
// still being formed. The chip's small circular canvas plays that exact
// rhythm: a fast reheat ramp (cubic ease-out, 0.7s) up to peak "hot" then a
// slow radiative cool (exponential decay, tau=1.1s) back down, on a fixed,
// non-negotiable 4.0s beat for as long as the process is active. Both ends
// of the sweep interpolate luminance ONLY — the disc's colour is a straight
// RGB lerp between the live var(--ns-muted) and var(--foreground) values (no
// hue, ever, and never var(--ns-accent), which is interaction chrome only).
// A subtle 1px inner ring pulses opacity in lockstep with the same
// rise/decay curve, reading as a discrete "reinsertion" event on every beat
// rather than a continuous shimmer.
//
// Tokens are read once via getComputedStyle(document.documentElement) before
// any paint, and re-read on every class-attribute mutation of <html> (a
// MutationObserver) so a live theme toggle repaints the next frame with the
// new muted/foreground pair — no literal colour anywhere, including the
// gradient's alpha fallback stops. The canvas is a fixed 36x36 CSS-px circle
// (DPR-scaled on mount and on resize, since that's the one thing that can
// change this chip's device pixel ratio without remounting it) — the spec
// for this exact mechanic hard-codes that size rather than deriving it from
// a container, since the chip is always rendered at this one physical scale
// next to a text label, never stretched to fill a card.
//
// The animation loop pauses via IntersectionObserver when the chip scrolls
// off-screen and resumes on a fresh cycle boundary, and is cancelled outright
// on unmount along with both observers — no leaked rAF, no leaked observer.
// prefers-reduced-motion skips the loop entirely and paints one frozen frame
// at t=0.7s into the cycle (L=Lmax, ring=0.4) — the peak of the reheat ramp,
// the single frame that most clearly reads "hot" rather than an ambiguous
// mid-decay grey.
// ---------------------------------------------------------------------------

const CYCLE_MS = 4000; // fixed, non-negotiable cadence
const RAMP_MS = 700; // reheat ramp: cubic ease-out, Lmin -> Lmax
const DECAY_TAU_MS = 1100; // cool decay: exponential, tau = 1.1s
const L_MIN = 0.18; // near --ns-muted
const L_MAX = 0.92; // near --foreground
const RING_MIN = 0.15;
const RING_MAX = 0.4;
const CANVAS_CSS = 36; // fixed 36x36 CSS px, per spec

type Rgb = [number, number, number];

function parseColor(input: string): Rgb {
  const trimmed = input.trim();
  const fn = trimmed.match(/rgba?\(([^)]+)\)/i);
  if (fn) {
    const parts = fn[1]!.split(",").map((s) => parseFloat(s.trim()));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  }
  const hex = trimmed.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  const num = parseInt(full || "808080", 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// cubic ease-out, 0..1 -> 0..1
function easeOutCubic(t: number): number {
  const p = 1 - t;
  return 1 - p * p * p;
}

interface GlowState {
  L: number;
  ring: number;
}

// where the cycle is at msInCycle: fast eased rise for the reheat ramp, then
// an exponential radiative decay for the rest of the 4.0s beat. The ring
// opacity rides the identical curve mapped onto its own 0.15-0.4 range, so
// the two read as one discrete "reinsertion" pulse rather than two loops.
function stateAt(msInCycle: number): GlowState {
  if (msInCycle < RAMP_MS) {
    const p = easeOutCubic(msInCycle / RAMP_MS);
    return { L: lerp(L_MIN, L_MAX, p), ring: lerp(RING_MIN, RING_MAX, p) };
  }
  const k = Math.exp(-(msInCycle - RAMP_MS) / DECAY_TAU_MS);
  return {
    L: L_MIN + (L_MAX - L_MIN) * k,
    ring: RING_MIN + (RING_MAX - RING_MIN) * k,
  };
}

export interface GloryHoleCycleProps {
  /** status text rendered beside the glow and announced on the live region. default "Processing". */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function GloryHoleCycle({
  label = "Processing",
  className = "",
}: GloryHoleCycleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const mutedRgb = useRef<Rgb>([128, 128, 128]);
  const fgRgb = useRef<Rgb>([0, 0, 0]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ring = ringRef.current;
    if (!canvas || !ring) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const readTokens = () => {
      const cs = getComputedStyle(document.documentElement);
      mutedRgb.current = parseColor(cs.getPropertyValue("--ns-muted") || "#808080");
      fgRgb.current = parseColor(cs.getPropertyValue("--foreground") || "#000000");
    };

    // no paint before the first token read
    readTokens();

    let dpr = Math.max(1, window.devicePixelRatio || 1);

    const sizeCanvas = () => {
      dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(CANVAS_CSS * dpr);
      canvas.height = Math.round(CANVAS_CSS * dpr);
      canvas.style.width = `${CANVAS_CSS}px`;
      canvas.style.height = `${CANVAS_CSS}px`;
    };
    sizeCanvas();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const paint = ({ L, ring: ringOpacity }: GlowState) => {
      const t = (L - L_MIN) / (L_MAX - L_MIN);
      const [mr, mg, mb] = mutedRgb.current;
      const [fr, fg, fb] = fgRgb.current;
      const r = Math.round(lerp(mr, fr, t));
      const g = Math.round(lerp(mg, fg, t));
      const b = Math.round(lerp(mb, fb, t));

      const cx = CANVAS_CSS / 2;
      const cy = CANVAS_CSS / 2;
      const radius = Math.min(CANVAS_CSS, CANVAS_CSS) * 0.6;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, CANVAS_CSS, CANVAS_CSS);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
      grad.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.55)`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ring.style.opacity = ringOpacity.toFixed(3);
      ring.style.borderColor = `rgb(${fr}, ${fg}, ${fb})`;
    };

    let raf = 0;
    let startTime = 0;

    const loop = (now: number) => {
      if (startTime === 0) startTime = now;
      const msInCycle = (now - startTime) % CYCLE_MS;
      paint(stateAt(msInCycle));
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      paint(stateAt(RAMP_MS)); // frozen at the peak of the reheat ramp
    } else {
      raf = requestAnimationFrame(loop);
    }

    const mo = new MutationObserver(() => {
      readTokens();
      if (reduced) paint(stateAt(RAMP_MS));
      // animated path just picks the fresh tokens up on its next rAF frame
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    let io: IntersectionObserver | null = null;
    if (!reduced) {
      io = new IntersectionObserver((entries) => {
        const visible = entries[0]?.isIntersecting ?? true;
        if (visible && !raf) {
          startTime = 0; // resume clean on a fresh cycle boundary
          raf = requestAnimationFrame(loop);
        } else if (!visible && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      });
      io.observe(canvas);
    }

    const onResize = () => sizeCanvas();
    window.addEventListener("resize", onResize);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      mo.disconnect();
      io?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 ${className}`}
    >
      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
        <canvas ref={canvasRef} aria-hidden="true" className="block" />
        <span
          ref={ringRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-[3px] rounded-full"
          style={{ borderWidth: 1, borderStyle: "solid", opacity: RING_MIN }}
        />
      </span>
      <span className="text-sm text-foreground">{label}</span>
    </span>
  );
}
