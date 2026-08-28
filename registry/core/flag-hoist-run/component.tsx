"use client";

// FlagHoistRun — an ambient in-flight/queue-depth status card modelled on a
// mechanical flag hoist / signal halyard (the Popham flag code, 1803, and
// the same rig still used decoratively for dressing ship): a flag is bent
// onto a halyard, run up the mast to the yard, breaks out (unfurls) once at
// the top so it can be read, then is struck (hauled down fast) to clear the
// line for the next hoist.
//
// Pure SVG/DOM, no canvas. A single vertical halyard runs from the deck
// (92% of card height) to the yard (8%). Flag "chips" are small rectangles
// pivoting from their left edge, which sits on the halyard. Climbing, a
// chip is rotated -90deg around that pivot so it reads edge-on — a narrow
// vertical sliver flush against the line, exactly as a furled flag hugs a
// halyard on its way up. At the yard it breaks out: a 300ms rotation from
// -90deg to 0deg swings it out to a full horizontal rectangle, the one
// moment that has to read as a distinct "arrival", not a continuation of
// the climb. It flies at 0deg, full silhouette, for 1.1s, then is struck —
// hauled straight down and out through the card's clipped bottom edge in
// 400ms, deliberately faster than the 2.4s climb so striking reads as a
// quick, separate action from the steady work of hoisting.
//
// A new chip starts climbing from the deck every 1.3s, independent of any
// other chip's phase, so 1-2 chips are climbing at once while at most one
// flies at the yard — queue depth is legible as "how many chips are on the
// line right now." A small fixed pool of chip elements is mutated directly
// every animation frame (transform + visibility only) rather than driving
// them through React state, so the 30+ hoists a minute this produces never
// trigger a re-render.
//
// Colors are CSS custom properties only, read straight off the cascade via
// `var(--foreground)` in inline styles (pure DOM/SVG, no canvas — no
// getComputedStyle/MutationObserver token dance is needed here). Flags are
// a solid --foreground fill; the halyard and yard are --foreground at a
// fixed 30% opacity — visibly a taut line at any theme, never --border,
// which would fall below separator contrast in light theme and disappear.

import { useEffect, useRef } from "react";

export interface FlagHoistRunProps {
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const CLIMB_MS = 2400;
const BREAKOUT_MS = 300;
const FLY_MS = 1100;
const STRIKE_MS = 400;
const CYCLE_MS = CLIMB_MS + BREAKOUT_MS + FLY_MS + STRIKE_MS; // 4200
const SPAWN_INTERVAL_MS = 1300;
const MAX_CHIPS = 4; // fixed pool: comfortably covers 4200 / 1300 concurrent hoists

const DECK_FRAC = 0.92;
const YARD_FRAC = 0.08;
const STRUCK_FRAC = 1.18; // below the card's clipped bottom edge

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

function easeInCubic(t: number): number {
  return t * t * t;
}

/** Given a chip's age (ms since it started climbing), returns its current
 * y-fraction (0 = top/yard, 1 = deck) and rotation in degrees (-90 folded,
 * 0 flying), or null once its full cycle has finished. */
function chipState(ageMs: number): { yFrac: number; rotationDeg: number } | null {
  if (ageMs < 0) return null;
  if (ageMs < CLIMB_MS) {
    const t = ageMs / CLIMB_MS; // constant velocity
    return { yFrac: DECK_FRAC + (YARD_FRAC - DECK_FRAC) * t, rotationDeg: -90 };
  }
  let t = ageMs - CLIMB_MS;
  if (t < BREAKOUT_MS) {
    const p = easeOutCubic(t / BREAKOUT_MS);
    return { yFrac: YARD_FRAC, rotationDeg: -90 + 90 * p };
  }
  t -= BREAKOUT_MS;
  if (t < FLY_MS) {
    return { yFrac: YARD_FRAC, rotationDeg: 0 };
  }
  t -= FLY_MS;
  if (t < STRIKE_MS) {
    const p = easeInCubic(t / STRIKE_MS);
    return { yFrac: YARD_FRAC + (STRUCK_FRAC - YARD_FRAC) * p, rotationDeg: 0 };
  }
  return null;
}

export function FlagHoistRun({ className = "" }: FlagHoistRunProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let visible = true;
    let raf = 0;
    let size = { w: 0, h: 0 };

    const minDim = () => Math.min(size.w, size.h);

    // -- apply one chip's geometry to its element. shared by both the live
    // loop and the reduced-motion static frame. --------------------------
    const applyChip = (
      el: HTMLDivElement,
      yFrac: number,
      rotationDeg: number,
      halyardX: number,
      flagW: number,
      flagH: number
    ) => {
      el.style.display = "block";
      el.style.left = `${halyardX}px`;
      el.style.top = `${yFrac * size.h}px`;
      el.style.width = `${flagW}px`;
      el.style.height = `${flagH}px`;
      el.style.transform = `translateY(-50%) rotate(${rotationDeg}deg)`;
    };

    const spawnBase = performance.now() - Math.random() * SPAWN_INTERVAL_MS;

    const renderFrame = (now: number) => {
      if (size.w < 2 || size.h < 2) return;
      const halyardX = size.w * 0.5;
      const md = minDim();
      const flagW = md * 0.24;
      const flagH = md * 0.11;

      for (let i = 0; i < MAX_CHIPS; i++) {
        const el = chipRefs.current[i];
        if (!el) continue;
        const chipSpawn = spawnBase + i * SPAWN_INTERVAL_MS;
        const cyclesElapsed = Math.floor((now - chipSpawn) / (SPAWN_INTERVAL_MS * MAX_CHIPS));
        const thisSpawn = chipSpawn + cyclesElapsed * SPAWN_INTERVAL_MS * MAX_CHIPS;
        const age = now - thisSpawn;
        const state = age >= 0 ? chipState(age) : null;
        if (!state) {
          el.style.display = "none";
          continue;
        }
        applyChip(el, state.yFrac, state.rotationDeg, halyardX, flagW, flagH);
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible || disposed) return;
      renderFrame(now);
      raf = requestAnimationFrame(loop);
    };

    const renderReducedFrame = () => {
      if (size.w < 2 || size.h < 2) return;
      const halyardX = size.w * 0.5;
      const md = minDim();
      const flagW = md * 0.24;
      const flagH = md * 0.11;
      // the most structured single frame: one chip mid-climb (~50% up the
      // mast) alongside one chip flying at the yard, both states visible
      // at once.
      const midClimb = chipRefs.current[0];
      const flying = chipRefs.current[1];
      for (let i = 2; i < MAX_CHIPS; i++) {
        const el = chipRefs.current[i];
        if (el) el.style.display = "none";
      }
      if (midClimb) {
        applyChip(midClimb, DECK_FRAC + (YARD_FRAC - DECK_FRAC) * 0.5, -90, halyardX, flagW, flagH);
      }
      if (flying) {
        applyChip(flying, YARD_FRAC, 0, halyardX, flagW, flagH);
      }
    };

    const start = () => {
      const rect = container.getBoundingClientRect();
      size = { w: rect.width, h: rect.height };
      if (size.w < 2 || size.h < 2) return;
      if (reduced) {
        renderReducedFrame();
        return;
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      size = { w: rect.width, h: rect.height };
      if (reduced) {
        renderReducedFrame();
      } else if (size.w >= 2 && size.h >= 2 && !raf && visible) {
        raf = requestAnimationFrame(loop);
      }
    });
    ro.observe(container);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && !raf && size.w >= 2 && size.h >= 2) {
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(container);

    start();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative aspect-[4/3] w-full max-w-xs overflow-hidden rounded-md border border-border bg-surface ${className}`}
    >
      {/* halyard: a taut vertical line from deck to yard */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: `${YARD_FRAC * 100}%`,
          bottom: `${(1 - DECK_FRAC) * 100}%`,
          width: "1.5px",
          backgroundColor: "var(--foreground)",
          opacity: 0.3,
        }}
      />
      {/* yard: the crossbar flags break out onto at the top of the mast */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: `${YARD_FRAC * 100}%`,
          width: "34%",
          height: "1.5px",
          backgroundColor: "var(--foreground)",
          opacity: 0.3,
        }}
      />
      {Array.from({ length: MAX_CHIPS }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          ref={(el) => {
            chipRefs.current[i] = el;
          }}
          className="absolute"
          style={{
            display: "none",
            backgroundColor: "var(--foreground)",
            transformOrigin: "left center",
          }}
        />
      ))}
    </div>
  );
}
