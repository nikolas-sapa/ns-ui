"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// BackgroundHalftoneRosette — a full-bleed ambient background: two halftone
// dot screens of the SAME ink, each drifting at its own continuous angle,
// the way duotone/double-hit offset printing lays one ink down twice at two
// screen angles. The rosette is genuine dot-overlap moiré between two
// same-ink coverage fields, not a color trick — both screens are painted in
// --foreground on --background.
//
// Two screens, one Δθ. Real halftone practice cites a trio/quad of absolute
// screen angles (15/45/75...) for MULTI-ink separations; with only two
// screens here the meaningful parameter is the angular SEPARATION between
// them, not an absolute angle. Resting separation is ~30° (a standard
// print two-color offset); at rest each screen sits at ±15° so the visual
// centerline stays put. Once running, screen A spins at +0.6deg/s and
// screen B at -0.9deg/s — independent, non-commensurate rates, so Δθ drifts
// forever and the beat pattern (wavelength ~ pitch / (2 sin(Δθ/2))) never
// settles into a repeating state.
//
// Same-ink moiré peaks near 50% combined coverage and nearly vanishes near
// the extremes, so a uniform-coverage field would wash the whole frame to
// unreadable mid-grey — a bad backdrop for type. A third layer expresses a
// coverage gradient instead: near-transparent at the visual center (full
// dot contrast, the rosette is the point) diluting toward a background-
// tinted scrim at the frame edges (~8% effective coverage, a readable zone
// for headline/CTA content sitting over the corners).
//
// Blend mode is chosen FROM THE THEME, never hardcoded. The invariant that
// must hold in both themes: overlap value moves monotonically AWAY from
// --background and TOWARD --foreground as coverage increases. `multiply`
// darkens overlaps toward black — correct when ink is dark-on-light (light
// theme), backward when ink is light-on-dark (multiplying two light layers
// against a dark ground pulls overlaps toward the dark ground instead of
// toward the ink). `screen` lightens overlaps toward white — the mirror
// case, correct in dark theme. Which one applies is decided at mount (and
// re-decided on every theme flip) by comparing --foreground's luminance
// against --background's, read via getComputedStyle(document.documentElement)
// and re-read on a MutationObserver watching documentElement's class.
//
// Substrate is pure CSS: two oversized (150%, negative-offset so a rotated
// square still fully covers the container at any angle) tiled radial-
// gradient dot layers, each under its own infinite CSS rotation keyframe,
// blended per the rule above, plus the coverage-gradient scrim layer on
// top. Zero rAF. prefers-reduced-motion (and the `paused` prop) freeze both
// screens at the ~30° resting separation instead of an arbitrary mid-drift
// crest — the print-safe, minimal-rosette state.
// ---------------------------------------------------------------------------

export interface BackgroundHalftoneRosetteProps {
  /** halftone screen pitch (dot-grid cell size), in px. @default 8 */
  dotPitch?: number;
  /** screen A's continuous rotation rate, degrees/second. @default 0.6 */
  rateA?: number;
  /** screen B's continuous rotation rate, degrees/second. @default -0.9 */
  rateB?: number;
  /** freeze both screens at their resting ~30deg separation. @default false */
  paused?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** inline styles merged onto the root element */
  style?: CSSProperties;
}

type RGB = [number, number, number];

function parseHex(raw: string): RGB | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// resolved at mount + on every theme flip: "multiply" when --foreground is
// darker than --background (light theme, dark ink on light paper), "screen"
// when --foreground is lighter (dark theme, light ink on a dark ground).
function resolveBlendMode(): "multiply" | "screen" {
  if (typeof document === "undefined") return "multiply";
  const cs = getComputedStyle(document.documentElement);
  const bg = parseHex(cs.getPropertyValue("--background")) ?? [1, 1, 1];
  const fg = parseHex(cs.getPropertyValue("--foreground")) ?? [0.09, 0.09, 0.09];
  return luminance(fg) < luminance(bg) ? "multiply" : "screen";
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const REST_SEPARATION = 15; // each screen sits at +/-15deg -> 30deg apart at rest

export function BackgroundHalftoneRosette({
  dotPitch = 8,
  rateA = 0.6,
  rateB = -0.9,
  paused = false,
  className = "",
  style,
}: BackgroundHalftoneRosetteProps) {
  const [blendMode, setBlendMode] = useState<"multiply" | "screen">("multiply");
  const reducedMotion = useReducedMotion();
  const isStatic = paused || reducedMotion;

  useEffect(() => {
    setBlendMode(resolveBlendMode());
    const observer = new MutationObserver(() => setBlendMode(resolveBlendMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const dotRadius = dotPitch * 0.3; // ~28% raw coverage per screen alone, feathered ~0.4px to
  // avoid rasterizer aliasing manufacturing false beat structure under continuous rotation
  const durA = 360 / Math.max(0.001, Math.abs(rateA));
  const durB = 360 / Math.max(0.001, Math.abs(rateB));
  const dirA: "normal" | "reverse" = rateA < 0 ? "reverse" : "normal";
  const dirB: "normal" | "reverse" = rateB < 0 ? "reverse" : "normal";
  // negative animation-delay seeks each layer straight to the +/-15deg resting
  // separation at t=0, instead of both starting at 0deg (Deltatheta=0, no rosette
  // until the drift has had time to open up). For a "reverse" direction, p=0
  // renders the keyframe's END (360deg), so the seek fraction is identical.
  const delayA = -(REST_SEPARATION / 360) * durA;
  const delayB = -(REST_SEPARATION / 360) * durB;

  // sized off the larger container dimension via container queries, so the
  // oversized square's half-diagonal covers the container's half-diagonal at
  // every rotation angle regardless of aspect ratio (150% of the *smaller*
  // axis alone can leave bare background strips sweeping in near 90/270deg).
  const screenBase: CSSProperties = {
    position: "absolute",
    top: "calc(50% - 75cqmax)",
    left: "calc(50% - 75cqmax)",
    width: "150cqmax",
    height: "150cqmax",
    backgroundImage: `radial-gradient(circle, var(--foreground) 0px, var(--foreground) ${dotRadius}px, transparent ${dotRadius + 0.4}px)`,
    backgroundSize: `${dotPitch}px ${dotPitch}px`,
    backgroundRepeat: "repeat",
  };

  const layerAStyle: CSSProperties = isStatic
    ? { ...screenBase, transform: `rotate(${REST_SEPARATION}deg)` }
    : {
        ...screenBase,
        animationName: "ns-halftone-rot",
        animationDuration: `${durA}s`,
        animationDelay: `${delayA}s`,
        animationDirection: dirA,
        animationTimingFunction: "linear",
        animationIterationCount: "infinite",
      };

  const layerBStyle: CSSProperties = isStatic
    ? { ...screenBase, transform: `rotate(${-REST_SEPARATION}deg)`, mixBlendMode: blendMode }
    : {
        ...screenBase,
        mixBlendMode: blendMode,
        animationName: "ns-halftone-rot",
        animationDuration: `${durB}s`,
        animationDelay: `${delayB}s`,
        animationDirection: dirB,
        animationTimingFunction: "linear",
        animationIterationCount: "infinite",
      };

  return (
    <div
      aria-hidden="true"
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ backgroundColor: "var(--background)", isolation: "isolate", containerType: "size", ...style }}
    >
      <div style={layerAStyle} />
      <div style={layerBStyle} />
      {/* coverage-gradient scrim: ~transparent at the visual center (full
          dot contrast, rosette is the point) diluting toward a
          background-tinted edge (~8% effective coverage, a readable zone
          for headline/CTA content). "ellipse closest-side" (not the
          default farthest-corner circle) so all four edges — not just the
          corners — reach the dilute stop. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(ellipse closest-side at 50% 50%,
            transparent 0%,
            transparent 38%,
            color-mix(in srgb, var(--background) 60%, transparent) 70%,
            color-mix(in srgb, var(--background) 88%, transparent) 100%)`,
        }}
      />
      <style>{`
@keyframes ns-halftone-rot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`}</style>
    </div>
  );
}

BackgroundHalftoneRosette.displayName = "BackgroundHalftoneRosette";
