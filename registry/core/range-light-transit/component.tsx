"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// RangeLightTransit — an ambient convergence indicator modelled on maritime
// range lights (leading lights): a pair of navigation marks at different
// distances/heights that a pilot keeps vertically stacked ("in transit") to
// hold a safe channel course. Off the line the lights visibly separate; back
// on it, they read as one aligned pair (USCG / Trinity House leading-line
// marks). Used here for a status moment where two independent, slowly
// varying states are converging and briefly agreeing — distinct from a
// determinate progress bar or a binary connected/disconnected dot.
//
// The front (lower, closer) and rear (higher, farther) light each drift
// horizontally on their own sine, incommensurate periods (6.2s / 9.7s) so
// alignment is never on a fixed beat. A thin line always connects the two
// disc centres — vertical exactly when they share an X, visibly tilted
// otherwise — so the tilt straightening out IS the converging read. Its
// opacity has two components: a continuous "how close" glow that climbs as
// the horizontal gap shrinks, plus a 250ms brighten-in that only completes
// if the gap stays under the 3%-of-width alignment threshold continuously
// for that long. The arrival cue (both discs grow and gain a soft --foreground
// drop-shadow — a halo in dark theme, a deepening shadow in light theme, so
// it reads correctly off the same token in both directions with no per-theme
// branch) is GATED on that same 250ms dwell, then fires once, at the true
// local minimum of the gap inside the dwell, held 300ms then eased back over
// 600ms — never a single-frame flash. The dwell gate matters on both cues:
// two independent sines cross within the threshold constantly (every
// ~1.5-4s) just passing through, but only stay inside it for 250ms+ on a
// real transit crossing (roughly every 1.5-11s at these periods) — without
// the gate, the pulse would fire on every passing crossing and read as
// generic blinking, not converging. Pure DOM/SVG, refs-only hot path, no
// React state, no canvas.
// ---------------------------------------------------------------------------

const FRONT_AMP_FRAC = 0.18; // front light drift amplitude, fraction of card width
const FRONT_PERIOD_S = 6.2;
const FRONT_PHASE = 1.9; // rad, arbitrary — chosen so t0 sits at a nonzero offset
const REAR_AMP_FRAC = 0.14; // rear light drift amplitude, fraction of card width
const REAR_PERIOD_S = 9.7;
const REAR_PHASE = 4.3; // rad
const ALIGN_THRESHOLD_FRAC = 0.03; // "in transit" gap, fraction of card width
const APPROACH_WINDOW_FRAC = ALIGN_THRESHOLD_FRAC * 3; // where the continuous glow begins
const GUIDE_FLOOR_OPACITY = 0.12; // guideline is faint, never fully absent — see note below
const GUIDE_RAMP_MS = 250; // continuous dwell inside threshold before the line reads fully "in transit"
const PULSE_HOLD_MS = 300; // arrival cue held at full luminance
const PULSE_DECAY_MS = 600; // then eased back to baseline
const PULSE_GROW = 0.15; // disc radius growth at peak, fraction of base radius
const PULSE_SHADOW_MAX = 6; // drop-shadow blur radius (px) at peak
const FRONT_Y_FRAC = 0.78; // lower in the card (nearer light)
const REAR_Y_FRAC = 0.24; // higher in the card (farther light)
const MIN_DISC_R = 3;
const MAX_DISC_R = 7;
const DISC_R_FRAC = 0.05; // of min(w, h)
const REAR_R_SCALE = 0.75; // farther light reads visibly smaller

// FREEZE FRAME: reduced-motion renders a single frame at t = 1.753s via a
// fresh call to render() (no accumulated dwell state), so the dwell ramp
// term is always 0 there and the guideline shows the continuous glow term
// alone. At this instant gap = 1.32% of card width (inside the 3% threshold,
// still closing — a real approach, not an incidental touch) which puts that
// glow term at ~0.43 opacity: both discs visibly offset, the line visibly
// present but not fully bright, no arrival cue active. The full-alignment
// frame is deliberately avoided (the pulse would read as blown-out on a
// static frame) and so is a maximum-offset frame (the line is fully
// resting at its GUIDE_FLOOR_OPACITY there, the least structured option).
const FREEZE_T_S = 1.753;

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export interface RangeLightTransitProps {
  /** label above the reading */
  label?: string;
  /** card height in px */
  height?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function RangeLightTransit({
  label = "Sync transit",
  height = 200,
  className = "",
}: RangeLightTransitProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const guideRef = useRef<SVGLineElement>(null);
  const frontRef = useRef<SVGCircleElement>(null);
  const rearRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const guide = guideRef.current;
    const front = frontRef.current;
    const rear = rearRef.current;
    if (!svg || !guide || !front || !rear) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // fallbacks are CSS keywords, never literal colour values
    let fg = "currentColor";
    const readTokens = () => {
      const root = getComputedStyle(document.documentElement);
      fg = root.getPropertyValue("--foreground").trim() || "currentColor";
      front.style.fill = fg;
      rear.style.fill = fg;
      guide.style.stroke = fg;
    };

    let w = 0;
    let h = 0;
    let sized = false;

    const measure = () => {
      const rect = svg.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        sized = false;
        return;
      }
      w = rect.width;
      h = rect.height;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      sized = true;
    };

    // -- per-frame gap state, refs only, never React state ------------------
    let insideSince: number | null = null;
    let prevDiff = Infinity;
    let approaching = false;
    let pulseFiredThisDwell = false;
    let pulseStartMs: number | null = null;

    const render = (tMs: number) => {
      if (!sized) return;
      const tS = tMs / 1000;
      const fx = FRONT_AMP_FRAC * Math.sin((2 * Math.PI * tS) / FRONT_PERIOD_S + FRONT_PHASE);
      const rx = REAR_AMP_FRAC * Math.sin((2 * Math.PI * tS) / REAR_PERIOD_S + REAR_PHASE);
      const diff = Math.abs(fx - rx);
      const within = diff < ALIGN_THRESHOLD_FRAC;

      if (within) {
        if (insideSince === null) insideSince = tMs;
      } else {
        insideSince = null;
        pulseFiredThisDwell = false;
        approaching = false;
      }
      const rampT = within && insideSince !== null ? Math.min(1, (tMs - insideSince) / GUIDE_RAMP_MS) : 0;

      // arrival cue fires once, at the true local minimum of the gap, but
      // only once the gap has genuinely dwelled inside the threshold for the
      // same 250ms the guideline needs — this is what keeps the cue off the
      // many fast, glancing crossings and reserves it for a real transit.
      const dwelledEnough = insideSince !== null && tMs - insideSince >= GUIDE_RAMP_MS;
      if (within) {
        if (diff < prevDiff) {
          approaching = true;
        } else if (approaching && !pulseFiredThisDwell && dwelledEnough) {
          pulseFiredThisDwell = true;
          pulseStartMs = tMs;
          approaching = false;
        }
      }
      prevDiff = diff;

      // max amplitude difference (18%+14%) means the raw gap spends over
      // half of any long window beyond the approach window entirely — a
      // pure closeness^2 term would leave the connecting line fully absent
      // more often than not, which reads as two unconnected drifting dots
      // rather than a pair converging. A small resting floor keeps the
      // reference line always faintly present (spec allows "dim or absent").
      const closeness = Math.max(0, Math.min(1, 1 - diff / APPROACH_WINDOW_FRAC));
      const approachOpacity = GUIDE_FLOOR_OPACITY + (0.55 - GUIDE_FLOOR_OPACITY) * closeness * closeness;
      const guideOpacity = within ? approachOpacity + (1 - approachOpacity) * easeOutCubic(rampT) : approachOpacity;

      let pulseFactor = 0;
      if (pulseStartMs !== null) {
        const since = tMs - pulseStartMs;
        if (since <= PULSE_HOLD_MS) pulseFactor = 1;
        else if (since <= PULSE_HOLD_MS + PULSE_DECAY_MS) {
          pulseFactor = 1 - (since - PULSE_HOLD_MS) / PULSE_DECAY_MS;
        } else {
          pulseFactor = 0;
          pulseStartMs = null;
        }
      }

      const side = Math.min(w, h);
      const baseR = Math.min(MAX_DISC_R, Math.max(MIN_DISC_R, side * DISC_R_FRAC));
      const discR = baseR * (1 + PULSE_GROW * pulseFactor);
      const rearR = discR * REAR_R_SCALE;
      const cx = w / 2;
      const frontX = cx + fx * w;
      const frontY = h * FRONT_Y_FRAC;
      const rearX = cx + rx * w;
      const rearY = h * REAR_Y_FRAC;

      front.setAttribute("cx", frontX.toFixed(2));
      front.setAttribute("cy", frontY.toFixed(2));
      front.setAttribute("r", discR.toFixed(2));
      rear.setAttribute("cx", rearX.toFixed(2));
      rear.setAttribute("cy", rearY.toFixed(2));
      rear.setAttribute("r", rearR.toFixed(2));

      guide.setAttribute("x1", frontX.toFixed(2));
      guide.setAttribute("y1", frontY.toFixed(2));
      guide.setAttribute("x2", rearX.toFixed(2));
      guide.setAttribute("y2", rearY.toFixed(2));
      guide.style.opacity = guideOpacity.toFixed(3);

      // One formula for both themes, no isDark branch: a --foreground
      // drop-shadow plus a small radius grow. Because fg is already the
      // token that flips per theme, this reads as a soft light-coloured
      // halo blooming around the disc in dark theme, and as a deepening
      // dark shadow around it in light theme — a literal brightness()
      // filter was tried here and clamped to a barely-visible +7.6% swing
      // against near-white --foreground in dark theme, so the cue is
      // carried by shadow + size instead of a filter that can clip.
      if (pulseFactor > 0) {
        const f = `drop-shadow(0 0 ${(PULSE_SHADOW_MAX * pulseFactor).toFixed(2)}px ${fg})`;
        front.style.filter = f;
        rear.style.filter = f;
      } else {
        front.style.filter = "none";
        rear.style.filter = "none";
      }
    };

    let raf = 0;
    let last = 0;
    let globalTMs = 0;
    let visible = true;

    const loop = (now: number) => {
      if (last === 0) last = now;
      globalTMs += Math.min(100, now - last);
      last = now;
      render(globalTMs);
      if (visible && !reduced) raf = requestAnimationFrame(loop);
      else raf = 0;
    };

    const mo = new MutationObserver(() => {
      readTokens();
      render(reduced ? FREEZE_T_S * 1000 : globalTMs);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        measure();
        render(reduced ? FREEZE_T_S * 1000 : globalTMs);
      }, 120);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(svg);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && !reduced && sized && !raf) {
          last = 0;
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 }
    );
    io.observe(svg);

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!reduced && sized && visible && !raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // no paint before the first token read
    readTokens();
    measure();

    if (reduced) {
      render(FREEZE_T_S * 1000);
    } else if (sized) {
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
  }, []);

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] tracking-wide text-ns-muted">
          {label.toUpperCase()}
        </span>
        <span className="font-mono text-[11px] tracking-wide text-ns-muted">RANGE LIGHTS</span>
      </div>
      <div
        role="img"
        aria-label={`${label}: two lights drifting independently, briefly aligning as they converge`}
        className="mt-2"
      >
        <svg ref={svgRef} aria-hidden="true" className="block w-full" style={{ height }}>
          <line ref={guideRef} strokeWidth={1.25} strokeLinecap="round" />
          <circle ref={rearRef} />
          <circle ref={frontRef} />
        </svg>
      </div>
      <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-ns-muted">
        <span>FRONT {FRONT_PERIOD_S.toFixed(1)}s</span>
        <span>REAR {REAR_PERIOD_S.toFixed(1)}s</span>
      </div>
    </div>
  );
}
