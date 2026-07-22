"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// PressureFront — a hero background of isobar-like closed contour lines that
// bunch tightly around the primary CTA, so the composition physically leans
// toward the one action that matters. Pure SVG: every ring is a <path> whose
// `d` is recomputed directly (no canvas, no interpolation) on a throttled
// rAF loop, so `stroke` can reference --border/--muted/--foreground natively
// and both themes repaint for free — no getComputedStyle color parsing at
// all. Line DENSITY (radial spacing that compresses near the CTA) is the
// hierarchy device, not color or a gradient fill.
//
// The field is genuinely alive at rest, not just on interaction: a
// continuous drift rotates the wobble, an independent faster breathing
// pulse swells/contracts the low-pressure centre, and it leans toward the
// pointer wherever it roams over the hero (not only when hovering the CTA).
// All three are additive perturbations on top of the same closed-form
// radius, never a point-attractor toward absolute coordinates — that keeps
// ~30 nested closed curves from ever converging into each other.
// ---------------------------------------------------------------------------

const RINGS = 30;
const ANGLES = 56; // vertices per ring — smooth at 1px stroke, cheap to redraw
const COMPRESSION = 2.15; // >1 bunches inner rings tightly, spreads outer ones
const ELLIPSE_X = 1.28; // rings are gently wide, matching a landscape hero
const PULL_PX = 8; // max inward pull on CTA hover/focus (deepening low)
const FRAME_INTERVAL = 1000 / 20; // throttled redraw rate — isobars drift slow, but smooth enough to read the pointer lean
const SPRING_K = 90;
const SPRING_ZETA = 0.8;
const BREATH_MS = 7000; // independent, faster period so the low visibly pulses instead of only slowly rotating
const BREATH_FRAC = 0.22; // +/- fraction minR itself swells by — a single global scalar, see drawRings for why
const POINTER_PULL_PX = 30; // max outward lean toward the pointer — stronger than the CTA's isotropic pull
const POINTER_GAP_CLAMP = 0.5; // never lean a ring past this fraction of its gap to the next ring; kept well under 1 because the existing wobble term already consumes part of that gap on its own

// Deterministic low-frequency harmonic sum standing in for 2D noise: it's
// exactly periodic in theta so every ring closes without a seam at 0/2π,
// which a sampled value-noise field can't guarantee without extra stitching.
function ringWobble(theta: number, phase: number, seed: number) {
  return (
    0.5 * Math.sin(3 * theta + phase + seed * 0.7) +
    0.3 * Math.sin(5 * theta - phase * 1.3 + seed * 1.3 + 1.7) +
    0.2 * Math.sin(8 * theta + phase * 0.6 + seed * 2.1 + 4.1)
  );
}

// Ring color steps toward the CTA — discrete steps, never a gradient. Colors
// are CSS custom properties resolved natively by the browser (no JS parsing).
function ringColor(i: number) {
  if (i < 2) return "color-mix(in srgb, var(--foreground) 25%, transparent)";
  if (i < 5) return "var(--muted)";
  return "var(--border)";
}

export interface PressureFrontCta {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface PressureFrontProps {
  eyebrow?: string;
  headline?: string | string[];
  subcopy?: string;
  primaryCta: PressureFrontCta;
  secondaryCta?: PressureFrontCta;
  /** number of contour rings. default 30 */
  rings?: number;
  /** ms for one full drift loop of the noise phase. default 20000 */
  driftMs?: number;
  className?: string;
}

export function PressureFront({
  eyebrow,
  headline = "Ship the thing",
  subcopy,
  primaryCta,
  secondaryCta,
  rings = RINGS,
  driftMs = 20000,
  className = "",
}: PressureFrontProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ctaRef = useRef<HTMLElement | null>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const dimsRef = useRef({ w: 0, h: 0 });
  const ctaCenterRef = useRef({ x: 0, y: 0 });

  const headlineLines = Array.isArray(headline) ? headline : [headline];

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    const cta = ctaRef.current;
    if (!root || !svg || !cta) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // -- measurement: CTA position re-derived on every resize --------------
    const measure = () => {
      const rootRect = root.getBoundingClientRect();
      const w = rootRect.width;
      const h = rootRect.height;
      dimsRef.current = { w, h };
      svg.setAttribute("viewBox", `0 0 ${Math.max(1, w)} ${Math.max(1, h)}`);
      const ctaRect = cta.getBoundingClientRect();
      ctaCenterRef.current = {
        x: ctaRect.left - rootRect.left + ctaRect.width / 2,
        y: ctaRect.top - rootRect.top + ctaRect.height / 2,
      };
    };
    measure();

    // -- geometry: recomputed and written directly to each <path d> --------
    // `breathPhase` runs on its own faster clock so the low-pressure centre
    // visibly pulses instead of only slowly rotating with the drift. Pointer
    // deformation is deliberately RADIAL and per-ring (never "toward a fixed
    // point in screen space"): each ring only ever swells along its own
    // center-relative radius, one-sided toward the cursor's bearing, clamped
    // to a fraction of its actual gap to the next ring. That keeps neighbor
    // rings moving in parallel — a point-attractor on ~30 nested closed
    // curves would make rings near the cursor's radius converge and cross.
    const drawRings = (
      phase: number,
      pullPx: number,
      breathPhase: number,
      pointerX: number,
      pointerY: number,
      pointerStrength: number
    ) => {
      const { w, h } = dimsRef.current;
      if (w < 1 || h < 1) return;
      const { x: ctaX, y: ctaY } = ctaCenterRef.current;
      const maxR = Math.max(w, h) * 0.92;
      const minR = Math.min(28, maxR * 0.05);

      // Breathing modulates minR as ONE global scalar, not a per-ring term —
      // deliberately, because the innermost rings are already packed within
      // a fraction of a px of each other (t^2.15 is nearly flat near t=0), so
      // any independent per-ring perturbation there risks flipping their
      // order. Folding the pulse into minR instead keeps every ring's radius
      // exactly (maxR - minRBreath) * t^COMPRESSION + minRBreath: the gap
      // between any two rings is (maxR - minRBreath) * (t_i^C - t_(i-1)^C),
      // always positive since maxR always exceeds minRBreath by construction
      // (BREATH_FRAC is a small fraction) — so the pulse can never cross
      // rings, only grow/shrink the whole low in lockstep, tapering to zero
      // at the outer edge for free via the same (1 - t^C) the compression
      // curve already has.
      const minRBreath = minR * (1 + BREATH_FRAC * Math.sin(breathPhase));

      // Pass 1: centers + base radii for every ring, so pass 2 can clamp the
      // pointer lean against each ring's *real* (post-breathing) neighbor gap.
      const centers: { x: number; y: number }[] = new Array(rings);
      const baseRs: number[] = new Array(rings);
      for (let i = 0; i < rings; i++) {
        const t = i / (rings - 1);
        const driftR = minR * 0.9;
        centers[i] = {
          x: ctaX + driftR * Math.cos(phase * 0.5 + i * 0.05),
          y: ctaY + driftR * 0.6 * Math.sin(phase * 0.5 + i * 0.05),
        };
        baseRs[i] = minRBreath + (maxR - minRBreath) * Math.pow(t, COMPRESSION);
      }

      for (let i = 0; i < rings; i++) {
        const el = pathRefs.current[i];
        if (!el) continue;
        const t = i / (rings - 1);
        const { x: cx, y: cy } = centers[i];
        const baseR = baseRs[i];
        const amp = (maxR - minR) * 0.045 * (0.35 + 0.65 * t);
        const seed = i * 0.53;
        const ringPhase = phase + i * 0.045;
        const pullHere = pullPx * (1 - t);

        // How much (and toward what bearing) this ring leans toward the
        // pointer: gaussian in RADIUS-space (how close the pointer's distance
        // from this ring's own center is to this ring's own radius), not
        // screen-space distance to a point — so the lean is inherently a
        // per-ring radial swell, not a convergent pull.
        let pointerAmp = 0;
        let pointerAngle = 0;
        if (pointerStrength > 0.001) {
          const dxp = pointerX - cx;
          const dyp = pointerY - cy;
          const distToCenter = Math.hypot(dxp, dyp);
          pointerAngle = Math.atan2(dyp, dxp);
          const distToRing = distToCenter - baseR;
          const sigma = Math.max(24, (maxR - minR) * 0.09);
          const ringFalloff = Math.exp(-(distToRing * distToRing) / (2 * sigma * sigma));
          const gapPrev = i > 0 ? Math.abs((baseRs[i] ?? baseR) - (baseRs[i - 1] ?? baseR)) : Math.abs((baseRs[1] ?? baseR) - (baseRs[0] ?? baseR));
          const gapNext = i < rings - 1 ? Math.abs((baseRs[i + 1] ?? baseR) - (baseRs[i] ?? baseR)) : gapPrev;
          const localGap = Math.min(gapPrev, gapNext);
          pointerAmp = Math.min(POINTER_PULL_PX, localGap * POINTER_GAP_CLAMP) * pointerStrength * ringFalloff;
        }

        let d = "";
        for (let k = 0; k < ANGLES; k++) {
          const theta = (k / ANGLES) * Math.PI * 2;
          const wob = amp * ringWobble(theta, ringPhase, seed);
          let r = baseR + wob - pullHere;
          if (pointerAmp > 0.01) {
            const align = Math.max(0, Math.cos(theta - pointerAngle));
            r += pointerAmp * align * align; // one-sided swell on the cursor-facing arc only
          }
          r = Math.max(4, r);
          const x = cx + r * Math.cos(theta) * ELLIPSE_X;
          const y = cy + r * Math.sin(theta);
          d += k === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`;
        }
        d += "Z";
        el.setAttribute("d", d);
      }
    };

    if (reduced) {
      // Static density gradient only: no phase drift, no continuous spring —
      // this is the strongest reduced-motion story in the set, since the
      // hierarchy is encoded structurally (ring spacing), not by motion.
      // No root-wide pointer tracking here on purpose — a redraw on every
      // pointermove is exactly the continuous motion prefers-reduced-motion
      // opts out of. Only the CTA's own enter/leave/focus/blur still toggles
      // a single static redraw, same as before.
      let staticPull = 0;
      drawRings(0, 0, 0, 0, 0, 0);
      const onEnter = () => {
        staticPull = PULL_PX;
        drawRings(0, staticPull, 0, 0, 0, 0);
      };
      const onLeave = () => {
        staticPull = 0;
        drawRings(0, staticPull, 0, 0, 0, 0);
      };
      cta.addEventListener("pointerenter", onEnter);
      cta.addEventListener("pointerleave", onLeave);
      cta.addEventListener("focus", onEnter);
      cta.addEventListener("blur", onLeave);
      const ro = new ResizeObserver(() => {
        measure();
        drawRings(0, staticPull, 0, 0, 0, 0);
      });
      ro.observe(root);
      const ctaRo = new ResizeObserver(() => {
        measure();
        drawRings(0, staticPull, 0, 0, 0, 0);
      });
      ctaRo.observe(cta);
      return () => {
        ro.disconnect();
        ctaRo.disconnect();
        cta.removeEventListener("pointerenter", onEnter);
        cta.removeEventListener("pointerleave", onLeave);
        cta.removeEventListener("focus", onEnter);
        cta.removeEventListener("blur", onLeave);
      };
    }

    // -- full loop: ambient drift + breathing + damped-spring hover pull +
    // pointer-follow lean -----------------------------------------------
    let raf = 0;
    let elVisible = true;
    let pageVisible = document.visibilityState === "visible";
    let visible = elVisible && pageVisible;
    let hoverOn = false;
    let startTime = 0;
    let lastTick = 0;
    let lastDraw = 0;
    let pull = 0;
    let pullVel = 0;

    // Pointer follow: raw target from the event, a smoothed trailing
    // position (framerate-normalized lerp, same idiom as signal-terrain),
    // and a spring-eased 0..1 strength so entering/leaving ramps rather than
    // snaps. Snaps straight to the raw position on the frame pointer
    // tracking (re)starts, so it doesn't sweep in from wherever it last was.
    let pointerRawX = 0;
    let pointerRawY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerActive = false;
    let pointerTracking = false;
    let pointerStrength = 0;
    let pointerStrengthVel = 0;

    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const dt = lastTick ? Math.min(0.05, (now - lastTick) / 1000) : 1 / 60;
      lastTick = now;

      const target = hoverOn ? PULL_PX : 0;
      const c = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      const accel = -SPRING_K * (pull - target) - c * pullVel;
      pullVel += accel * dt;
      pull += pullVel * dt;
      if (Math.abs(pull - target) < 0.02 && Math.abs(pullVel) < 0.02) {
        pull = target;
        pullVel = 0;
      }

      if (pointerActive) {
        if (!pointerTracking) {
          pointerX = pointerRawX;
          pointerY = pointerRawY;
          pointerTracking = true;
        } else {
          const k = 1 - Math.pow(0.88, dt * 60);
          pointerX += (pointerRawX - pointerX) * k;
          pointerY += (pointerRawY - pointerY) * k;
        }
      } else {
        pointerTracking = false;
      }
      const pointerTarget = pointerActive ? 1 : 0;
      const cp = 2 * SPRING_ZETA * Math.sqrt(SPRING_K);
      const accelP = -SPRING_K * (pointerStrength - pointerTarget) - cp * pointerStrengthVel;
      pointerStrengthVel += accelP * dt;
      pointerStrength += pointerStrengthVel * dt;
      if (Math.abs(pointerStrength - pointerTarget) < 0.002 && Math.abs(pointerStrengthVel) < 0.002) {
        pointerStrength = pointerTarget;
        pointerStrengthVel = 0;
      }

      if (now - lastDraw >= FRAME_INTERVAL) {
        lastDraw = now;
        const phase = ((now - startTime) / driftMs) * Math.PI * 2;
        const breathPhase = ((now - startTime) / BREATH_MS) * Math.PI * 2;
        drawRings(phase, pull, breathPhase, pointerX, pointerY, pointerStrength);
      }
      raf = visible ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (!raf && visible) raf = requestAnimationFrame(tick);
    };

    const onCtaOn = () => {
      hoverOn = true;
      wake();
    };
    const onCtaOff = () => {
      hoverOn = false;
      wake();
    };
    cta.addEventListener("pointerenter", onCtaOn);
    cta.addEventListener("pointerleave", onCtaOff);
    cta.addEventListener("focus", onCtaOn);
    cta.addEventListener("blur", onCtaOff);

    // Whole-hero pointer tracking — the field leans toward the cursor
    // wherever it is, not just when hovering the CTA. Mouse/pen only: touch
    // has no hover state and pointermove-during-scroll would read as jitter.
    // rect is re-measured on every move (matching signal-terrain's idiom)
    // rather than cached, so page scroll never throws the coordinates off.
    const onRootMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rect = root.getBoundingClientRect();
      pointerRawX = e.clientX - rect.left;
      pointerRawY = e.clientY - rect.top;
      pointerActive = true;
      wake();
    };
    const onRootLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointerActive = false;
      wake();
    };
    root.addEventListener("pointermove", onRootMove);
    root.addEventListener("pointerleave", onRootLeave);

    const ro = new ResizeObserver(measure);
    ro.observe(root);
    const ctaRo = new ResizeObserver(measure);
    ctaRo.observe(cta);

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

    wake();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ctaRo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cta.removeEventListener("pointerenter", onCtaOn);
      cta.removeEventListener("pointerleave", onCtaOff);
      cta.removeEventListener("focus", onCtaOn);
      cta.removeEventListener("blur", onCtaOff);
      root.removeEventListener("pointermove", onRootMove);
      root.removeEventListener("pointerleave", onRootLeave);
    };
  }, [rings, driftMs]);

  const ctaFocusRing =
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
        {Array.from({ length: rings }).map((_, i) => (
          <path
            key={i}
            ref={(el) => {
              pathRefs.current[i] = el;
            }}
            fill="none"
            style={{ stroke: ringColor(i), strokeWidth: 1 }}
          />
        ))}
      </svg>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-6 pb-16 pt-24 text-center sm:pb-24 sm:pt-32">
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
              ref={(el) => {
                ctaRef.current = el;
              }}
              href={primaryCta.href}
              data-cta="primary"
              onClick={primaryCta.onClick}
              className={`rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity duration-200 hover:opacity-90 ${ctaFocusRing}`}
            >
              {primaryCta.label}
            </a>
          ) : (
            <button
              ref={(el) => {
                ctaRef.current = el;
              }}
              type="button"
              data-cta="primary"
              onClick={primaryCta.onClick}
              className={`rounded-sm bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity duration-200 hover:opacity-90 ${ctaFocusRing}`}
            >
              {primaryCta.label}
            </button>
          )}
          {secondaryCta ? (
            secondaryCta.href ? (
              <a
                href={secondaryCta.href}
                onClick={secondaryCta.onClick}
                className={`rounded-sm border border-border px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground ${ctaFocusRing}`}
              >
                {secondaryCta.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={secondaryCta.onClick}
                className={`rounded-sm border border-border px-5 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground ${ctaFocusRing}`}
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
