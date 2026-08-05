"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// UmbraToggle — a binary switch drawn as an eclipse. A small bright "sun"
// disc sits fixed inside a 56x28 track; a dark "occluder" disc slides across
// it. The overlap between the two circles is pure geometry — the occluder is
// just a second circle in the same SVG, painted with the track's own
// background color so it visually "cuts into" the sun rather than needing a
// mask, and at full occlusion a thin corona (a 1px --foreground ring plus a
// soft blur glow) appears around the sun's rim. Occlusion fraction (0 = off,
// 1 = on) is the single driver: it positions the occluder, interpolates the
// track's ambient tint, and fades the corona in near fraction=1. Everything
// per-frame during a drag is written straight to refs (no React state), and
// discrete transitions (click, keyboard) run the same writer on a short CSS
// transition instead of a rAF loop.
// ---------------------------------------------------------------------------

export interface UmbraToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** accessible name; falls back to the visible Light/Dark label pair */
  "aria-label"?: string;
  className?: string;
}

const TRACK_W = 56;
const TRACK_H = 28;
const SUN_R = 8;
const OCCLUDER_R = 9;
const INSET = 6; // sun center offset from each edge at rest
const TRAVEL = TRACK_W - INSET * 2; // distance the occluder center travels
const TRANSITION_MS = 220;
const BREATHE_MS = 900;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function applyFrame(
  occluderEl: SVGCircleElement | null,
  trackEl: HTMLButtonElement | null,
  coronaEl: SVGCircleElement | null,
  fraction: number,
  transition: boolean
) {
  if (occluderEl) {
    // rests clear of the sun when off (fraction 0) and slides fully onto
    // it — same center, larger radius — when on (fraction 1), so "off"
    // shows the bare sun and "on" is a total eclipse with the corona
    const cx = lerp(INSET + TRAVEL, INSET, fraction);
    occluderEl.style.transition = transition
      ? `cx ${TRANSITION_MS}ms cubic-bezier(0.16,1,0.3,1), fill ${TRANSITION_MS}ms linear`
      : "none";
    occluderEl.setAttribute("cx", String(cx));
  }
  if (trackEl) {
    // ambient tint darkens smoothly with occlusion — interpolate toward a
    // darker mix of the track's own border token rather than a hardcoded
    // color. The occluder disc's fill reads this same custom property (it
    // inherits down through the SVG), so it always matches the track's
    // current backing color exactly and reads as "cutting into" the sun via
    // plain paint order rather than a mask.
    const tint = `color-mix(in srgb, var(--border) ${100 - fraction * 55}%, #000 ${fraction * 55}%)`;
    trackEl.style.transition = transition
      ? `background-color ${TRANSITION_MS}ms linear, border-color ${TRANSITION_MS}ms linear`
      : "none";
    trackEl.style.backgroundColor = tint;
    trackEl.style.setProperty("--umbra-tint", tint);
    // Near full occlusion (the same fade window the corona uses) the
    // occluder is otherwise painted in the exact tint the track background
    // was just set to, so the "moon" reads as a hole rather than a disc —
    // in light theme especially, where the tint never gets dark enough for
    // the blurred corona ring alone to read against it. Mix a sliver of the
    // themed --umbra-bright token (always the *light* token for the current
    // theme, same trick the corona stroke already uses) into the occluder's
    // own fill so it stays a legible disc instead of disappearing into the
    // background it's built from. At fraction <= 0.72 this is a 0% mix, i.e.
    // exactly `tint` — unchanged from before.
    const moonMix = Math.max(0, (fraction - 0.72) / 0.28) * 22;
    const moon =
      moonMix > 0 ? `color-mix(in srgb, ${tint} ${100 - moonMix}%, var(--umbra-bright) ${moonMix}%)` : tint;
    trackEl.style.setProperty("--umbra-moon", moon);
  }
  if (coronaEl) {
    // A running `breathe` keyframe animation outranks this opacity write in
    // the cascade (animations win over the specified/inline value for the
    // property they animate) — without cancelling it first, a toggle that
    // lands mid-breathe keeps the corona visibly pulsing on the "off" sun
    // for the rest of the 900ms, instead of fading out immediately.
    coronaEl.style.animation = "none";
    const coronaOpacity = Math.max(0, (fraction - 0.72) / 0.28);
    coronaEl.style.transition = transition ? `opacity ${TRANSITION_MS}ms linear` : "none";
    coronaEl.style.opacity = String(coronaOpacity);
  }
}

export function UmbraToggle({
  checked,
  defaultChecked = false,
  onCheckedChange,
  "aria-label": ariaLabel,
  className = "",
}: UmbraToggleProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultChecked);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : uncontrolled;

  const trackRef = useRef<HTMLButtonElement | null>(null);
  const occluderRef = useRef<SVGCircleElement | null>(null);
  const coronaRef = useRef<SVGCircleElement | null>(null);

  const reducedRef = useRef(false);
  const dragFractionRef = useRef(value ? 1 : 0);
  const pointerDownRef = useRef(false);
  const movedRef = useRef(false);
  const startXRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // reflect `value` whenever it changes and we're not mid-drag
  useEffect(() => {
    if (pointerDownRef.current) return;
    dragFractionRef.current = value ? 1 : 0;
    applyFrame(occluderRef.current, trackRef.current, coronaRef.current, dragFractionRef.current, !reducedRef.current);
  }, [value]);

  const commit = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolled(next);
      onCheckedChange?.(next);
    },
    [isControlled, onCheckedChange]
  );

  const toggle = useCallback(() => {
    commit(!value);
  }, [commit, value]);

  // Pointer down always arms; only real movement past a small threshold
  // (movedRef) counts as a drag. A plain click/tap (no movement) just flips
  // the current value — a drag instead snaps to whichever side the pointer
  // ended up closer to, so click and drag are two coherent gestures rather
  // than one continuous-position model fighting a discrete toggle.
  const updateFromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    // the occluder tracks the pointer directly (1:1) rather than the pointer
    // driving `fraction` straight — fraction is ON-ness (1 = occluder at
    // INSET, over the sun), which is the *opposite* end of the track from
    // where the occluder rests when off, so deriving fraction from a plain
    // left-to-right t would move the disc backwards relative to the pointer
    const cx = Math.min(INSET + TRAVEL, Math.max(INSET, clientX - rect.left));
    const fraction = 1 - (cx - INSET) / TRAVEL;
    dragFractionRef.current = fraction;
    applyFrame(occluderRef.current, trackRef.current, coronaRef.current, fraction, false);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const track = trackRef.current;
    if (!track) return;
    pointerDownRef.current = true;
    movedRef.current = false;
    startXRef.current = e.clientX;
    track.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDownRef.current) return;
    if (!movedRef.current && Math.abs(e.clientX - startXRef.current) > 3) {
      movedRef.current = true;
    }
    if (movedRef.current) updateFromPointer(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDownRef.current) return;
    pointerDownRef.current = false;
    trackRef.current?.releasePointerCapture(e.pointerId);
    const next = movedRef.current ? dragFractionRef.current >= 0.5 : !value;
    // Only paint the guessed `next` state when it's actually going to become
    // `value` — a controlled parent can ignore `onCheckedChange` and leave
    // `value` unchanged, and painting the guess anyway would desync the
    // visible disc from aria-checked. When `next` isn't adopted (or a drag
    // released back on the side it started from, so `[value]` never refires),
    // settle back to the real current value instead.
    if (next !== value) commit(next);
    else applyFrame(occluderRef.current, trackRef.current, coronaRef.current, value ? 1 : 0, !reducedRef.current);
  };

  // A cancelled gesture (browser-initiated scroll takeover, stylus lift,
  // system interruption) is not a release — nothing was decided, so it must
  // never commit. Just disarm and repaint from the real value.
  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDownRef.current) return;
    pointerDownRef.current = false;
    trackRef.current?.releasePointerCapture(e.pointerId);
    applyFrame(occluderRef.current, trackRef.current, coronaRef.current, value ? 1 : 0, !reducedRef.current);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.repeat) return; // holding the key shouldn't machine-gun the toggle
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  const breathe = () => {
    const el = coronaRef.current;
    if (!el || reducedRef.current || !value) return;
    el.style.animation = "none";
    el.getBoundingClientRect(); // force reflow so re-adding the animation restarts it
    el.style.animation = `ns-umbra-breathe ${BREATHE_MS}ms ease-in-out`;
  };

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <style>{CSS}</style>
      <span
        aria-hidden="true"
        className={`font-mono text-xs uppercase tracking-wide transition-colors ${
          !value ? "text-foreground" : "text-ns-muted"
        }`}
      >
        Light
      </span>

      <button
        ref={trackRef}
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={ariaLabel ?? "Toggle light and dark"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        onMouseEnter={breathe}
        className="ns-umbra-track relative shrink-0 overflow-hidden rounded-full border border-border transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        style={{
          width: TRACK_W,
          height: TRACK_H,
          touchAction: "none",
        }}
      >
        <svg
          width={TRACK_W}
          height={TRACK_H}
          viewBox={`0 0 ${TRACK_W} ${TRACK_H}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          {/* corona halo, behind the sun. Stroke color is themed via CSS
              (.ns-umbra-corona below) rather than a bare var(--foreground)
              attribute: --foreground flips polarity between themes while the
              occluder's ambient tint always darkens toward black, so a
              foreground-stroked ring is bright-on-dark (high contrast) in
              dark theme but dark-on-mid-gray (low contrast) in light theme.
              The attribute here is just the dark-theme value as a fallback. */}
          <circle
            ref={coronaRef}
            className="ns-umbra-corona"
            cx={INSET}
            cy={TRACK_H / 2}
            r={SUN_R + 3}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={1}
            opacity={0}
            style={{ filter: "blur(1.5px)" }}
          />
          {/* sun — fixed */}
          <circle cx={INSET} cy={TRACK_H / 2} r={SUN_R} fill="var(--foreground)" />
          {/* occluder — slides across, painted in the track's own resting
              color so it reads as "cutting into" the sun via plain paint
              order rather than a mask. Near full occlusion --umbra-moon
              (set in applyFrame) blends in a themed highlight so the
              eclipsed disc stays legible instead of vanishing into the tint
              it's otherwise identical to. */}
          <circle
            ref={occluderRef}
            cx={value ? INSET : INSET + TRAVEL}
            cy={TRACK_H / 2}
            r={OCCLUDER_R}
            fill="var(--umbra-moon, var(--umbra-tint, var(--border)))"
          />
        </svg>
      </button>

      <span
        aria-hidden="true"
        className={`font-mono text-xs uppercase tracking-wide transition-colors ${
          value ? "text-foreground" : "text-ns-muted"
        }`}
      >
        Dark
      </span>
    </span>
  );
}

const CSS = `
@keyframes ns-umbra-breathe {
  0% { opacity: 1; }
  40% { opacity: 0.35; }
  100% { opacity: 1; }
}
/* Corona stroke: var(--background) in light theme (white, the brightest
   token available, against the mid-gray tint the occluder darkens toward)
   and var(--foreground) in dark theme (unchanged from before — already
   high-contrast against the near-black tint there). */
.ns-umbra-track .ns-umbra-corona { stroke: var(--background); }
.dark .ns-umbra-track .ns-umbra-corona { stroke: var(--foreground); }
/* Same "always the bright token for this theme" trick, exposed as a custom
   property the occluder's near-full-occlusion highlight (--umbra-moon,
   set in applyFrame) mixes into its own fill. */
.ns-umbra-track { --umbra-bright: var(--background); }
.dark .ns-umbra-track { --umbra-bright: var(--foreground); }
@media (prefers-reduced-motion: reduce) {
  button.ns-umbra-track svg circle { transition: none !important; animation: none !important; }
}
`;
