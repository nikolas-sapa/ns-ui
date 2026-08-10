"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// LenticuleSwing — a hero H1 lockup that holds two complete messages behind
// one printed surface, the way a lenticular card holds two images behind a
// ridged plastic sheet. The headline is laid down twice (message A, the
// problem statement; message B, the product promise) into a shared stage cut
// into N thin vertical strips (~pitch px each, measured live off the stage's
// own width via ResizeObserver). Each strip is its own overflow:hidden
// "peephole" div containing two oversized copies of the full headline
// (window-B underneath, window-A on top), offset left by exactly that
// strip's index so the sliver visible through the peephole lines up with
// every other strip's sliver to read as one continuous line. A single custom
// property, --lens-angle (a signed degree value, no CSS unit — used only in
// calc()), drives two things per strip at once: window-A's opacity swings
// from 0 (message B fully wins that strip) to 1 (message A fully wins it)
// around a per-strip jitter offset baked in at mount from a deterministic
// hash of the strip's index — so as the whole headline crosses from "mostly
// A" to "mostly B" a small handful of strips (the ones whose jitter sits
// furthest from the pack) lag behind and keep interlacing after the rest
// have committed, the residual seam a real lenticular print never fully
// resolves. Second, both windows translateX by angle * that strip's centered
// index * a tiny coefficient — a few tenths of a pixel of parallax shimmer
// per strip, the same "look at it from a different angle" cue a ridged sheet
// gives for free.
//
// --lens-angle has exactly one writer: a single rAF loop that measures the
// stage's own getBoundingClientRect() every frame (viewport-relative, so it
// tracks correctly whether the page itself scrolls or the stage sits inside
// a nested overflow-y:auto ancestor — no scroll-event listener, no coupling
// to a particular scroller). At rest (progress 0) a damped spring bounces
// the angle between +-3deg on a 4s half-period (an 8s full swing), so the
// two messages shimmer against each other and neither ever fully resolves —
// the ambiguous in-between IS the resting frame. Once the stage starts
// scrolling out of view, an eased scroll term (easeOutCubic) ramps the angle
// toward a full +9deg commit to message B by `snapAt` (default 40%) of the
// stage's own height, fading the idle spring's weight to 0 over the same
// span so the two drivers never fight — past snapAt the angle holds at its
// resolved value, "snapping cleanly" rather than continuing to creep.
// prefers-reduced-motion skips the spring and the easing entirely: the angle
// is pinned to full message A until progress crosses snapAt, then flips once
// to full message B with no interpolation, no oscillation.
//
// The real <h1> is a visually-hidden element containing message A followed
// by message B as plain text, read once, unconditionally — the strip
// apparatus is aria-hidden and purely decorative. Zero interactive controls;
// this replaces a headline+subhead, not a widget. DOM + CSS only.
// ---------------------------------------------------------------------------

export interface LenticuleSwingProps {
  /** the problem statement — dominates the strip apparatus at rest / low angle */
  messageA: string;
  /** the product promise — the scroll target; strips resolve to this by snapAt */
  messageB: string;
  /** fraction (0-1) of the stage's own height scrolled before the angle snaps fully to messageB */
  snapAt?: number;
  /** target strip width in px; actual strip count is derived from live stage width */
  pitch?: number;
  className?: string;
}

// deg, idle spring bounce amplitude. Deliberately small: the resting frame is
// the one the catalog screenshots and the owner judges, and message A has to
// stay legible there. At +/-0.6deg the A-window's opacity only modulates
// between ~0.90 and 1.0, which reads as a shimmer over ONE readable headline.
// At the original +/-3deg it swung down to ~0.63, so message B showed through
// at ~37% and the two copies composited into unreadable garble.
const ANGLE_IDLE = 0.6;
const ANGLE_RESOLVE = 9; // deg magnitude that fully commits a strip to one message
const HALF_PERIOD = 4000; // ms between idle spring target flips (8s full cycle)
const SPRING_K = 34; // s^-2
const SPRING_ZETA = 0.55; // <1 = visible settle wobble, the "spring-flavored" part
const MIN_STRIPS = 22;
const MAX_STRIPS = 64;
const PARALLAX_COEFF = 0.05; // px of shimmer per deg per centered-strip-index
// Per-strip crossover angle (deg) at which THAT strip's window-A opacity
// passes 0.5, spread across [CROSSOVER_LO, CROSSOVER_HI] by the strip's own
// jitter. CROSSOVER_BAND is how many degrees wide each strip's own fade is.
// Kept narrow on purpose: a strip should snap from ~1 to ~0 quickly, at ITS
// OWN angle, not crossfade in lockstep with every other strip. Without a
// spread wide enough (an earlier version leaned on --j for only a +/-0.06
// opacity nudge, ~6% of the range) almost every strip crossed 50% within the
// same handful of degrees, so mid-scroll the entire headline sat at ~50%
// opacity for both messages at once — two bold headlines double-exposed and
// neither legible, the actual bug a scrolling visitor hits. With the spread
// wide relative to the band, at any given angle during the scroll ramp most
// strips have already fully resolved one way or the other and only a
// narrow subset are actively blending — the "wipe" a real lenticular sheet
// gives, not a uniform dissolve. CROSSOVER_LO sits far enough above the idle
// spring's max excursion that resting message A stays fully opaque; the gap
// between CROSSOVER_HI and ANGLE_RESOLVE is what leaves the "small handful
// of strips lag behind" residual seam in the resolved frame.
const CROSSOVER_LO = 1.5;
const CROSSOVER_HI = 8.1;
const CROSSOVER_MID = (CROSSOVER_LO + CROSSOVER_HI) / 2;
const CROSSOVER_SPREAD = (CROSSOVER_HI - CROSSOVER_LO) / 2;
const CROSSOVER_BAND = 1.2;

function hash01(i: number) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

interface Spring {
  x: number;
  v: number;
  t: number;
}
function stepSpring(s: Spring, k: number, zeta: number, dt: number) {
  const c = 2 * zeta * Math.sqrt(k);
  s.v += (k * (s.t - s.x) - c * s.v) * dt;
  s.x += s.v * dt;
}

export function LenticuleSwing({
  messageA,
  messageB,
  snapAt = 0.4,
  pitch = 10,
  className = "",
}: LenticuleSwingProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stripCount, setStripCount] = useState(MIN_STRIPS);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = (width: number) => {
      if (width <= 0) return;
      const n = Math.round(width / pitch);
      setStripCount(Math.min(MAX_STRIPS, Math.max(MIN_STRIPS, n)));
    };
    measure(stage.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) measure(w);
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [pitch]);

  const strips = useMemo(
    () =>
      Array.from({ length: stripCount }, (_, i) => ({
        i,
        centered: i - (stripCount - 1) / 2,
        jitter: hash01(i) * 2 - 1, // -1..1, deterministic per index
      })),
    [stripCount]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = mq.matches;
    const onMqChange = () => {
      reduced = mq.matches;
    };
    mq.addEventListener("change", onMqChange);

    let raf = 0;
    let last = performance.now();
    let hidden = false;
    const idle: Spring = { x: -ANGLE_IDLE, v: 0, t: -ANGLE_IDLE };
    let flipAt = last + HALF_PERIOD;
    let lastWritten = Number.NaN;
    let lastCommitted: boolean | null = null;

    const setAngle = (deg: number) => {
      if (deg === lastWritten) return;
      lastWritten = deg;
      root.style.setProperty("--lens-angle", String(deg));
    };

    const progress = () => {
      const rect = root.getBoundingClientRect();
      if (rect.height <= 0) return 0;
      return Math.min(1, Math.max(0, -rect.top / rect.height));
    };

    const onVisibility = () => {
      hidden = document.hidden;
      if (!hidden) last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = progress();

      if (reduced) {
        const committed = p >= snapAt;
        if (committed !== lastCommitted) {
          lastCommitted = committed;
          setAngle(committed ? ANGLE_RESOLVE : -ANGLE_RESOLVE);
        }
        return;
      }

      if (now >= flipAt) {
        idle.t = idle.t > 0 ? -ANGLE_IDLE : ANGLE_IDLE;
        flipAt = now + HALF_PERIOD;
      }
      stepSpring(idle, SPRING_K, SPRING_ZETA, dt);

      const pn = Math.min(1, p / snapAt);
      const scrollAngle = easeOutCubic(pn) * ANGLE_RESOLVE;
      const idleWeight = 1 - pn;
      setAngle(Number((scrollAngle + idle.x * idleWeight).toFixed(3)));
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onMqChange);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [snapAt]);

  return (
    <div
      ref={rootRef}
      className={`ns-lens-root ${className}`}
      style={{ ["--lens-angle" as string]: "-9" }}
    >
      <style>{CSS}</style>
      <h1 className="sr-only">
        {messageA} {messageB}
      </h1>
      <div ref={stageRef} className="ns-lens-stage" aria-hidden="true">
        {strips.map((s) => {
          const stripStyle = {
            left: `${(s.i / stripCount) * 100}%`,
            width: `${100 / stripCount}%`,
            ["--i" as string]: String(s.centered),
            ["--j" as string]: s.jitter.toFixed(3),
          };
          const windowStyle = {
            left: `${-s.i * 100}%`,
            width: `${stripCount * 100}%`,
          };
          return (
            <div key={s.i} className="ns-lens-strip" style={stripStyle}>
              <div className="ns-lens-window ns-lens-b" style={windowStyle}>
                {messageB}
              </div>
              <div className="ns-lens-window ns-lens-a" style={windowStyle}>
                {messageA}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
.ns-lens-root{position:relative;width:100%;}
.ns-lens-stage{
  position:relative;
  width:100%;
  height:1.15em;
  font-family:var(--font-sans,inherit);
  font-size:clamp(28px,6vw,64px);
  font-weight:700;
  line-height:1.15;
  letter-spacing:-0.02em;
  color:var(--foreground);
  overflow:hidden;
  user-select:none;
}
.ns-lens-strip{
  position:absolute;
  top:0;
  height:100%;
  overflow:hidden;
}
.ns-lens-window{
  position:absolute;
  top:0;
  height:100%;
  display:flex;
  align-items:center;
  white-space:nowrap;
  will-change:transform,opacity;
  transform:translateX(calc(var(--lens-angle) * var(--i) * ${PARALLAX_COEFF}px));
}
/*
  Both windows paint an opaque --background. Without it the crossfade cannot
  work at all: text has a transparent background, so message B stayed fully
  visible through the gaps in and between message A's glyphs no matter what
  opacity A carried, and the two copies composited into permanently unreadable
  garble. Measured A at opacity 1 and B still showing through. With an opaque
  fill, A genuinely occludes B, and fading A is what reveals B — which is also
  what makes the per-strip flip read as a lenticular card instead of a blend.
*/
.ns-lens-window{
  background:var(--background);
}
.ns-lens-b{
  opacity:1;
  z-index:1;
}
.ns-lens-a{
  z-index:2;
  /*
    Each strip fades from fully opaque to fully transparent over a narrow
    CROSSOVER_BAND-wide window centered on ITS OWN crossover angle (spread
    across [CROSSOVER_LO, CROSSOVER_HI] by --j). That keeps most strips
    fully committed to one message at any given angle, so the mid-scroll
    frame reads as a wipe between two legible headlines instead of both
    superimposed at ~50%.
  */
  opacity:clamp(0, calc(0.5 - (var(--lens-angle) - (${CROSSOVER_MID} + var(--j) * ${CROSSOVER_SPREAD})) / ${CROSSOVER_BAND}), 1);
}
@media (prefers-reduced-motion: reduce){
  .ns-lens-window{transition:none;}
}
`;
