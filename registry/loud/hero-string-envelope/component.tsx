"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// StringEnvelope — a hero whose backdrop is pure string art. A few hundred
// STRAIGHT chords are drawn across a circle under the map i -> k*i; nothing
// ever plots a curve, yet the chords bunch along an epicycloid with (k - 1)
// cusps and that caustic is the only bright thing in the frame. k = 3 is the
// nephroid (two cusps), k = 2 the cardioid, k = 5 four cusps.
//
// k is a REAL number here, not the integer of the classic modular-multiplication
// string art (no mod, no rounding), so the family morphs continuously: the
// pointer's horizontal position drives k through a damped spring and the cusps
// visibly split and travel around the circle. Vertical position skews the
// generating circle's aspect, tilting the caustic.
//
// Plain SVG on purpose. Every stroke is a presentation attribute reading a
// custom property directly (stroke="var(--foreground)"), so both themes repaint
// through the cascade with NO getComputedStyle and NO MutationObserver — the
// correct strategy when the primitive is a DOM element rather than a canvas.
// Geometry is written straight onto the existing <line> nodes via refs on a
// throttled rAF accumulator: never React state on the hot path, never a
// re-mount of the node list.
// ---------------------------------------------------------------------------

const POINTS = 240; // nodes on the circle == chords drawn
const RADIUS_FRAC = 0.42; // R = 0.42 * min(w, h)
const CHORD_OPACITY = 0.26; // 1px hairlines; density alone makes the envelope bright
const FRAME_INTERVAL = 1000 / 24; // ~24fps redraw — 240 closed-form sin/cos pairs is trivial

const K_CENTER = 3; // nephroid at rest
const K_BREATH_A = 0.35; // slow calm breathing amplitude
const K_BREATH_MS_A = 18000;
const K_BREATH_B = 0.08; // small incommensurate jitter so cusps never hold a dead pose
const K_BREATH_MS_B = 6700;
const K_POINTER_RANGE = 1.1; // +/- k swing across the hero's width

const ASPECT_A = 0.06; // ambient y-squash of the generating circle
const ASPECT_MS = 25000;
const ASPECT_POINTER = 0.18; // extra tilt from pointer height

const SPRING_K = 90;
const SPRING_ZETA = 0.85;

export interface StringEnvelopeCta {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface StringEnvelopeProps {
  eyebrow?: string;
  headline?: string | string[];
  subcopy?: string;
  primaryCta: StringEnvelopeCta;
  secondaryCta?: StringEnvelopeCta;
  /** number of nodes on the circle, one chord each. default 240 */
  points?: number;
  /** resting multiplier the ambient breathing is centered on. default 3 (nephroid) */
  multiplier?: number;
  className?: string;
}

export function StringEnvelope({
  eyebrow,
  headline = "Straight lines only",
  subcopy,
  primaryCta,
  secondaryCta,
  points = POINTS,
  multiplier = K_CENTER,
  className = "",
}: StringEnvelopeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ringRef = useRef<SVGEllipseElement>(null);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const dimsRef = useRef({ w: 0, h: 0 });

  const headlineLines = Array.isArray(headline) ? headline : [headline];

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const measure = () => {
      const rect = root.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      dimsRef.current = { w, h };
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    };
    measure();

    // -- geometry ---------------------------------------------------------
    // Node i sits at theta_i = 2*pi*i/N on a circle of radius R (squashed by
    // `aspect` on y). Chord i is the straight segment theta_i -> k*theta_i.
    // That is the whole construction; the epicycloid is never computed.
    const draw = (k: number, aspect: number) => {
      const { w, h } = dimsRef.current;
      const cx = w / 2;
      const cy = h / 2;
      const R = RADIUS_FRAC * Math.min(w, h);
      const ry = R * aspect;

      const ring = ringRef.current;
      if (ring) {
        ring.setAttribute("cx", cx.toFixed(1));
        ring.setAttribute("cy", cy.toFixed(1));
        ring.setAttribute("rx", R.toFixed(1));
        ring.setAttribute("ry", ry.toFixed(1));
      }

      const step = (Math.PI * 2) / points;
      for (let i = 0; i < points; i++) {
        const el = lineRefs.current[i];
        if (!el) continue;
        const t0 = i * step;
        const t1 = k * t0;
        el.setAttribute("x1", (cx + R * Math.cos(t0)).toFixed(1));
        el.setAttribute("y1", (cy + ry * Math.sin(t0)).toFixed(1));
        el.setAttribute("x2", (cx + R * Math.cos(t1)).toFixed(1));
        el.setAttribute("y2", (cy + ry * Math.sin(t1)).toFixed(1));
      }
    };

    if (reduced) {
      // One frozen frame at t = 0, k = multiplier, aspect = 1. No rAF loop and
      // no pointer tracking at all — the caustic alone still carries the hero,
      // because the structure is geometric, not animated.
      draw(multiplier, 1);
      const ro = new ResizeObserver(() => {
        measure();
        draw(multiplier, 1);
      });
      ro.observe(root);
      return () => ro.disconnect();
    }

    // -- loop -------------------------------------------------------------
    let raf = 0;
    let elVisible = true;
    let pageVisible = document.visibilityState === "visible";
    let visible = elVisible && pageVisible;
    let startTime = 0;
    let lastTick = 0;
    let lastDraw = 0;

    let k = multiplier;
    let kVel = 0;
    let aspect = 1;
    let aspectVel = 0;

    let pointerActive = false;
    let normX = 0.5;
    let normY = 0.5;

    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const dt = lastTick ? Math.min(0.05, (now - lastTick) / 1000) : 1 / 60;
      lastTick = now;
      const el = now - startTime;

      // Calm resting pulse around the nephroid, plus a small incommensurate
      // jitter term so cusps sharpen and soften instead of holding a pose.
      const kBase =
        multiplier +
        K_BREATH_A * Math.sin((el / K_BREATH_MS_A) * Math.PI * 2) +
        K_BREATH_B * Math.sin((el / K_BREATH_MS_B) * Math.PI * 2);
      const aspectBase = 1 + ASPECT_A * Math.sin((el / ASPECT_MS) * Math.PI * 2);

      const kTarget = pointerActive
        ? kBase + K_POINTER_RANGE * (2 * normX - 1)
        : kBase;
      const aspectTarget = pointerActive
        ? aspectBase + ASPECT_POINTER * (2 * normY - 1)
        : aspectBase;

      const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      kVel += (-SPRING_K * (k - kTarget) - c * kVel) * dt;
      k += kVel * dt;
      aspectVel += (-SPRING_K * (aspect - aspectTarget) - c * aspectVel) * dt;
      aspect += aspectVel * dt;

      if (now - lastDraw >= FRAME_INTERVAL) {
        lastDraw = now;
        draw(k, aspect);
      }
      raf = visible ? requestAnimationFrame(tick) : 0;
    };

    const wake = () => {
      if (!raf && visible) raf = requestAnimationFrame(tick);
    };

    // Pointer is bound to the hero section, mouse/pen only — touch has no
    // hover state and a move-during-scroll would read as a jump in k.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rect = root.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      normX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      normY = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      pointerActive = true;
      wake();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointerActive = false;
      wake();
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(() => {
      measure();
      draw(k, aspect);
    });
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      elVisible = entries[0]?.isIntersecting ?? true;
      visible = elVisible && pageVisible;
      wake();
    });
    io.observe(root);

    const onVisibility = () => {
      pageVisible = document.visibilityState === "visible";
      visible = elVisible && pageVisible;
      wake();
    };
    document.addEventListener("visibilitychange", onVisibility);

    draw(k, aspect);
    wake();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [points, multiplier]);

  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <section
      ref={rootRef}
      className={`relative isolate overflow-hidden bg-background ${className}`}
    >
      <svg
        ref={svgRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <ellipse fill="none" ref={ringRef} stroke="var(--border)" strokeOpacity={0.5} strokeWidth={1} />
        {Array.from({ length: points }).map((_, i) => (
          <line
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            stroke="var(--foreground)"
            strokeOpacity={CHORD_OPACITY}
            strokeWidth={1}
          />
        ))}
      </svg>

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 pb-16 pt-24 text-center sm:pb-24 sm:pt-32">
        {eyebrow ? (
          <p className="mb-6 font-mono text-[11px] tracking-widest text-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className="font-semibold text-foreground"
          style={{
            fontSize: "clamp(2.5rem, 6.5vw, 4.5rem)",
            lineHeight: 1.06,
            letterSpacing: "-0.03em",
          }}
        >
          {headlineLines.map((line, i) => (
            <span key={i} className="block">
              {line}
            </span>
          ))}
        </h1>
        {subcopy ? (
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">
            {subcopy}
          </p>
        ) : null}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {primaryCta.href ? (
            <a
              href={primaryCta.href}
              data-cta="primary"
              onClick={primaryCta.onClick}
              className={`rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity duration-200 hover:opacity-90 ${focusRing}`}
            >
              {primaryCta.label}
            </a>
          ) : (
            <button
              type="button"
              data-cta="primary"
              onClick={primaryCta.onClick}
              className={`rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity duration-200 hover:opacity-90 ${focusRing}`}
            >
              {primaryCta.label}
            </button>
          )}
          {secondaryCta ? (
            secondaryCta.href ? (
              <a
                href={secondaryCta.href}
                onClick={secondaryCta.onClick}
                className={`rounded-sm border border-border bg-background px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground ${focusRing}`}
              >
                {secondaryCta.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={secondaryCta.onClick}
                className={`rounded-sm border border-border bg-background px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground ${focusRing}`}
              >
                {secondaryCta.label}
              </button>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}
