"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// SealRoll — a single-quote testimonial rotator built as a Mesopotamian
// cylinder seal. A small barrel (an SVG group: a pill-shaped body carrying
// faint mirrored glyph strokes clipped to its outline, at ~20% opacity)
// translates across the card over ~4s while rotating at angle = distance /
// radius, so it visibly rolls rather than slides or spins independently of
// its travel. The quote is pre-laid-out as one <span> per word; a single
// rAF loop compares each word's measured position (unwrapped into one
// continuous coordinate — offsetTop * trackWidth + offsetLeft, so a
// multi-line quote still reveals in one unbroken left-to-right sweep) to
// the barrel's own travelled distance for that frame, and flips a
// data-revealed attribute directly on the span (no React re-render on the
// hot path). Arrival adds a data-revealed attribute whose CSS rule runs a
// 400ms "press" keyframe (--foreground ink over a --ns-muted underlayer
// with a 1px --background text-shadow for the debossed read) that itself
// relaxes to plain --foreground ink at 100% via animation-fill-mode: both —
// no JS-timed class removal to keep in sync.
//
// On arrival the barrel lifts (a discrete CSS-transitioned translateY+fade,
// not part of the per-frame loop) and the attribution stamps in below. After
// a dwell (paused by hover, focus, or the explicit pause control) the
// impression blurs and fades out over 800ms while the barrel drops back in
// and rolls the return trip — that return trip IS the transition into the
// next testimonial, not a separate crossfade. Real prev/next and a pause
// toggle sit below; prefers-reduced-motion swaps quotes instantly on the
// same dwell interval with no roll, no lift, no blur.
//
// Distinct from signet-drop / rating-stamp / drift-stamp (single percussive
// impressions, nothing travels) and from contact-form-teletype (per-
// character typing of a validation log, not a word-scale rolling carousel).
// Pure DOM/SVG/CSS — no canvas. All ink from --background --foreground
// --ns-muted --border; --ns-accent is focus-ring only.
// ---------------------------------------------------------------------------

export interface SealRollTestimonial {
  quote: string;
  author: string;
  role?: string;
}

export interface SealRollProps {
  items?: SealRollTestimonial[];
  /** ms the barrel spends rolling across the card, revealing words. @default 4000 */
  rollMs?: number;
  /** ms the fully-stamped quote holds before the return trip begins. @default 2200 */
  dwellMs?: number;
  className?: string;
  /** accessible name for the whole rotator region. @default "Testimonials" */
  "aria-label"?: string;
}

const DEFAULT_ITEMS: SealRollTestimonial[] = [
  {
    quote:
      "We moved our whole onboarding flow over in a week. The thing that convinced the team was how little custom CSS it took to make it feel like ours.",
    author: "Priya Nair",
    role: "VP Engineering, Fathom",
  },
  {
    quote: "Shipped a working demo before lunch. That never happens.",
    author: "Marcus Ohl",
    role: "Founder, Driftwood",
  },
  {
    quote:
      "Every component reads its own theme tokens, so dark mode just worked the day we flipped the switch. No follow-up ticket, which is rare enough that I remember it.",
    author: "Elena Voss",
    role: "Design Lead, Northbound",
  },
  {
    quote: "Fast, honest docs, and the demos actually match the shipped behavior.",
    author: "Aiyana Redcloud",
    role: "Product, Kestrel",
  },
];

const BARREL_W = 76; // px, viewBox-matched
const BARREL_H = 46;
const RADIUS = BARREL_H / 2; // rolling radius: angle = distance / radius
const LIFT_MS = 260;
const LIFT_Y = 12; // px the barrel rises on arrival
const CLEAR_MS = 800; // return trip + blur-out duration
const DROP_FRACTION = 0.22; // portion of the return trip spent dropping back in

function clamp01(t: number) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function radToDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// deterministic per-cycle rotation seed for the mirrored glyph texture, so
// the barrel's carved strokes read as struck-in rather than re-drawn per cycle
function glyphSeed(i: number) {
  const s = Math.sin(i * 12.9898 + 7.233) * 43758.5453;
  return s - Math.floor(s);
}

function SealBarrelGlyphs({ seed, clipId }: { seed: number; clipId: string }) {
  const rows = 4;
  const cols = 6;
  const cellW = BARREL_W / cols;
  const cellH = BARREL_H / rows;
  const marks: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const mirrored = r % 2 === 1;
    for (let c = 0; c < cols; c++) {
      const f = glyphSeed(r * cols + c + seed * 97);
      const w = cellW * (0.35 + f * 0.4);
      const x = c * cellW + (cellW - w) / (mirrored ? 1.6 : 2.2);
      const y = r * cellH + cellH * 0.28;
      marks.push(
        <rect
          key={`${r}-${c}`}
          x={mirrored ? BARREL_W - x - w : x}
          y={y}
          width={w}
          height={Math.max(1.4, cellH * 0.3)}
          rx={0.8}
          fill="var(--foreground)"
        />
      );
    }
  }
  return (
    <g clipPath={`url(#${clipId})`} opacity={0.2}>
      {marks}
    </g>
  );
}

function SealBarrelSvg({ seed }: { seed: number }) {
  const clipId = useId();
  return (
    <svg
      width={BARREL_W}
      height={BARREL_H}
      viewBox={`0 0 ${BARREL_W} ${BARREL_H}`}
      className="ns-seal-barrel-svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={1} y={1} width={BARREL_W - 2} height={BARREL_H - 2} rx={BARREL_H / 2 - 1} />
        </clipPath>
      </defs>
      <rect
        x={1}
        y={1}
        width={BARREL_W - 2}
        height={BARREL_H - 2}
        rx={BARREL_H / 2 - 1}
        fill="var(--background)"
        stroke="var(--border)"
        strokeWidth={1.5}
      />
      <SealBarrelGlyphs seed={seed} clipId={clipId} />
      <line
        x1={BARREL_W / 2}
        y1={3}
        x2={BARREL_W / 2}
        y2={BARREL_H - 3}
        stroke="var(--ns-muted)"
        strokeWidth={1}
        opacity={0.5}
      />
    </svg>
  );
}

type Phase = "rolling" | "stamped" | "clearing";

export function SealRoll({
  items = DEFAULT_ITEMS,
  rollMs = 4000,
  dwellMs = 2200,
  className = "",
  "aria-label": ariaLabel = "Testimonials",
}: SealRollProps) {
  const count = Math.max(1, items.length);
  const reducedMotion = useReducedMotion();

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("rolling");
  const [manualPaused, setManualPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = manualPaused || hovered || focused;

  const item = items[index % count] ?? DEFAULT_ITEMS[0];
  const words = useMemo(() => item.quote.trim().split(/\s+/), [item.quote]);

  const stageRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLQuoteElement>(null);
  const barrelWrapRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // set by the rolling effect while a roll is in flight; lets the pause
  // control snap straight to the fully-stamped read instead of pausing mid-
  // reveal, which would otherwise hold on a half-struck quote.
  const finishRollRef = useRef<(() => void) | null>(null);

  const goTo = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
    },
    [count]
  );
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);
  const togglePause = useCallback(() => {
    const next = !manualPaused;
    if (next && phase === "rolling" && finishRollRef.current) {
      finishRollRef.current();
    }
    setManualPaused(next);
  }, [manualPaused, phase]);

  const range = useCallback(() => {
    const w = stageRef.current?.clientWidth ?? 320;
    return { x0: -BARREL_W, x1: Math.max(0, w - BARREL_W) };
  }, []);

  // Drives the forward roll for the current index: measures word positions
  // (unwrapped into one continuous coordinate so multi-line quotes still
  // read as a single sweep), then one rAF loop moves+rotates the barrel and
  // flips each word's data-revealed attribute the instant the barrel's
  // travelled distance passes that word's position. Reduced motion skips
  // straight to the fully-stamped resting frame.
  useLayoutEffect(() => {
    let raf = 0;
    // `stopped` halts the rAF recursion (set on natural arrival OR a forced
    // finish via pause) — distinct from `unmounted`, which only guards the
    // arrival setTimeout from touching state after the effect itself has
    // been cleaned up (unmount, or a new index starting a fresh cycle).
    let stopped = false;
    let unmounted = false;

    if (reducedMotion) {
      wordRefs.current.forEach((el) => el?.setAttribute("data-revealed", "true"));
      setPhase("stamped");
      return () => {
        unmounted = true;
      };
    }

    setPhase("rolling");
    const { x0, x1 } = range();
    const wrap = barrelWrapRef.current;
    if (wrap) {
      wrap.style.transition = "none";
      wrap.style.opacity = "1";
      wrap.style.transform = `translateX(${x0}px) translateY(0px) rotate(0deg)`;
    }

    const trackWidth = quoteRef.current?.clientWidth || stageRef.current?.clientWidth || 320;
    const offsets = wordRefs.current.map((el) =>
      el ? el.offsetTop * trackWidth + el.offsetLeft : 0
    );
    const totalPseudo = wordRefs.current.reduce((max, el) => {
      if (!el) return max;
      return Math.max(max, el.offsetTop * trackWidth + el.offsetLeft + el.offsetWidth);
    }, 1);

    // lands the barrel at x1, marks every word revealed, and lifts —
    // shared by the natural end-of-roll arrival and by a forced finish
    // (pause clicked mid-roll)
    const arrive = (x: number, angle: number) => {
      wordRefs.current.forEach((el) => el?.setAttribute("data-revealed", "true"));
      if (wrap) {
        wrap.style.transition = `transform ${LIFT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${LIFT_MS}ms ease`;
        wrap.style.transform = `translateX(${x}px) translateY(${-LIFT_Y}px) rotate(${angle}deg)`;
        wrap.style.opacity = "0";
      }
      window.setTimeout(() => {
        if (!unmounted) setPhase("stamped");
      }, LIFT_MS);
    };

    finishRollRef.current = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
      arrive(x1, radToDeg(x1 / RADIUS));
    };

    const t0 = performance.now();
    const loop = (now: number) => {
      if (stopped) return;
      const progress = clamp01((now - t0) / rollMs);
      const eased = easeInOutCubic(progress);
      const x = lerp(x0, x1, eased);
      const angle = radToDeg(x / RADIUS);
      if (wrap) {
        wrap.style.transform = `translateX(${x}px) translateY(0px) rotate(${angle}deg)`;
      }
      const barrelPseudoX = eased * totalPseudo;
      offsets.forEach((off, i) => {
        if (off <= barrelPseudoX) {
          const el = wordRefs.current[i];
          if (el && !el.hasAttribute("data-revealed")) el.setAttribute("data-revealed", "true");
        }
      });
      if (progress < 1) {
        raf = requestAnimationFrame(loop);
      } else {
        stopped = true;
        arrive(x, angle);
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      unmounted = true;
      stopped = true;
      cancelAnimationFrame(raf);
      finishRollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, reducedMotion]);

  // Stamped -> clearing: the auto-advance gate. Hover, focus, or the
  // explicit pause control holds the quote here indefinitely; nothing else
  // pauses (the roll-in itself is short and always finishes).
  useEffect(() => {
    if (phase !== "stamped" || paused) return;
    const t = window.setTimeout(() => setPhase("clearing"), dwellMs);
    return () => window.clearTimeout(t);
  }, [phase, paused, dwellMs]);

  // Clearing: the barrel drops back in and rolls the return trip while the
  // impression blurs out (CSS, driven off data-phase) — the return trip
  // itself is the transition into the next testimonial.
  useEffect(() => {
    if (phase !== "clearing") return;
    if (reducedMotion) {
      const t = window.setTimeout(() => goTo(index + 1), 0);
      return () => window.clearTimeout(t);
    }
    let raf = 0;
    let cancelled = false;
    const { x0, x1 } = range();
    const wrap = barrelWrapRef.current;
    const t0 = performance.now();
    const loop = (now: number) => {
      if (cancelled) return;
      const progress = clamp01((now - t0) / CLEAR_MS);
      const eased = easeInOutCubic(progress);
      const x = lerp(x1, x0, eased);
      const angle = radToDeg(x / RADIUS);
      const drop = clamp01(progress / DROP_FRACTION);
      if (wrap) {
        wrap.style.transition = "none";
        wrap.style.opacity = String(lerp(0, 1, drop));
        wrap.style.transform = `translateX(${x}px) translateY(${lerp(-LIFT_Y, 0, drop)}px) rotate(${angle}deg)`;
      }
      if (progress < 1) {
        raf = requestAnimationFrame(loop);
      } else {
        goTo(index + 1);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reducedMotion]);

  return (
    <div
      className={`ns-seal-root ${className}`}
      data-reduced={reducedMotion || undefined}
      role="region"
      aria-label={ariaLabel}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <style>{CSS}</style>
      <div className="ns-seal-card">
        <div className="ns-seal-stage" ref={stageRef}>
          {!reducedMotion && (
            <div className="ns-seal-barrel-wrap" ref={barrelWrapRef} aria-hidden="true">
              <SealBarrelSvg seed={glyphSeed(index)} />
            </div>
          )}
          <blockquote className="ns-seal-quote" ref={quoteRef} data-phase={phase}>
            {words.map((w, i) => (
              <Fragment key={`${index}-${i}`}>
                <span
                  ref={(el) => {
                    wordRefs.current[i] = el;
                  }}
                  className="ns-seal-word"
                >
                  {w}
                </span>
                {i < words.length - 1 ? " " : ""}
              </Fragment>
            ))}
          </blockquote>
        </div>
        <footer className="ns-seal-impression" data-phase={phase} data-seal-attribution="">
          <cite className="ns-seal-cite">{item.author}</cite>
          {item.role ? <span className="ns-seal-role">, {item.role}</span> : null}
        </footer>
      </div>
      <div className="ns-seal-controls">
        <button type="button" className="ns-seal-btn" onClick={goPrev} aria-label="Previous testimonial">
          Prev
        </button>
        <button type="button" className="ns-seal-btn" onClick={goNext} aria-label="Next testimonial">
          Next
        </button>
        <button
          type="button"
          className="ns-seal-btn"
          onClick={togglePause}
          aria-pressed={manualPaused}
          aria-label={manualPaused ? "Resume testimonial rotation" : "Pause testimonial rotation"}
          data-seal-pause=""
        >
          {manualPaused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}

const CSS = `
.ns-seal-root {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 560px;
  font-family: var(--font-sans, ui-sans-serif, system-ui);
  color: var(--foreground);
}
.ns-seal-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--background);
  padding: 28px 24px 20px;
}
.ns-seal-stage {
  position: relative;
  overflow: hidden;
  padding-top: 40px;
  min-height: 96px;
}
.ns-seal-barrel-wrap {
  position: absolute;
  top: 0;
  left: 0;
  width: ${BARREL_W}px;
  height: ${BARREL_H}px;
  pointer-events: none;
  will-change: transform;
}
.ns-seal-barrel-svg {
  display: block;
}
.ns-seal-quote {
  margin: 0;
  padding: 0;
  border: none;
  position: relative;
  font-size: 1.05rem;
  line-height: 1.55;
  font-weight: 500;
}
.ns-seal-word {
  display: inline-block;
  opacity: 0;
  color: var(--foreground);
  border-radius: 3px;
  padding: 0 1px;
}
.ns-seal-word[data-revealed] {
  opacity: 1;
  animation: ns-seal-press 400ms ease-out both;
}
.ns-seal-quote[data-phase="clearing"] {
  filter: blur(6px);
  opacity: 0;
  transition: filter ${CLEAR_MS}ms ease-in, opacity ${CLEAR_MS}ms ease-in;
}
@keyframes ns-seal-press {
  0% {
    text-shadow: 0 1px 0 var(--background);
    background-color: color-mix(in oklab, var(--ns-muted) 45%, transparent);
  }
  100% {
    text-shadow: none;
    background-color: transparent;
  }
}
.ns-seal-impression {
  margin-top: 16px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.8rem;
  color: var(--ns-muted);
}
.ns-seal-cite {
  font-style: normal;
  color: var(--foreground);
  opacity: 0;
  transform: translateY(4px);
  display: inline-block;
  transition: opacity 300ms ease, transform 300ms ease;
}
.ns-seal-role {
  opacity: 0;
  transition: opacity 300ms ease;
}
.ns-seal-impression[data-phase="stamped"] .ns-seal-cite,
.ns-seal-impression[data-phase="clearing"] .ns-seal-cite {
  opacity: 1;
  transform: translateY(0);
}
.ns-seal-impression[data-phase="stamped"] .ns-seal-role,
.ns-seal-impression[data-phase="clearing"] .ns-seal-role {
  opacity: 1;
}
.ns-seal-impression[data-phase="clearing"] {
  filter: blur(6px);
  opacity: 0;
  transition: filter ${CLEAR_MS}ms ease-in, opacity ${CLEAR_MS}ms ease-in;
}
.ns-seal-impression[data-phase="clearing"] .ns-seal-cite,
.ns-seal-impression[data-phase="clearing"] .ns-seal-role {
  transition: none;
}
.ns-seal-controls {
  display: flex;
  gap: 8px;
}
.ns-seal-btn {
  border: 1px solid var(--border);
  background: var(--background);
  color: var(--foreground);
  border-radius: 6px;
  padding: 6px 12px;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.78rem;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease;
  outline: none;
}
.ns-seal-btn:hover {
  border-color: var(--ns-muted);
  background: color-mix(in oklab, var(--foreground) 4%, transparent);
}
.ns-seal-btn:focus-visible {
  outline: 2px solid var(--ns-accent);
  outline-offset: 2px;
}
.ns-seal-btn[aria-pressed="true"] {
  border-color: var(--foreground);
}

.ns-seal-root[data-reduced] .ns-seal-word {
  animation: none !important;
  transition: none !important;
}
.ns-seal-root[data-reduced] .ns-seal-quote,
.ns-seal-root[data-reduced] .ns-seal-impression,
.ns-seal-root[data-reduced] .ns-seal-cite,
.ns-seal-root[data-reduced] .ns-seal-role {
  transition: none !important;
  filter: none !important;
}

@media (prefers-reduced-motion: reduce) {
  .ns-seal-word {
    animation: none !important;
  }
  .ns-seal-quote,
  .ns-seal-impression,
  .ns-seal-cite,
  .ns-seal-role,
  .ns-seal-btn {
    transition: none !important;
    filter: none !important;
  }
}
`;
