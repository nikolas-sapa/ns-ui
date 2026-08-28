"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// WeltChannelClose — a full-width section divider modeled on Goodyear-welted
// shoe construction. A channel is skived into the insole rib to expose it; a
// curved awl and needle lockstitch a welt to the upper and insole rib through
// that open channel; immediately behind the working point, the lifted channel
// flap that exposed the rib is folded back down and pressed flush, PERMANENTLY
// CONCEALING the just-completed stitching under the insole surface. The
// outer edge only ever shows a plain seam — the lockstitch itself is hidden
// the moment it is finished.
//
// This is deliberately NOT a restyle of bobbin-lace-pricking (pin-pull):
// that component draws every crossing thread and removes a placed PIN once
// its crossing has secured, on canvas. This component never draws a thread
// crossing at all — the lockstitch is conceptually always hidden inside the
// channel — and what the viewer actually sees is a real DOM/CSS 3D hinge
// transform (rotateX) folding a physical FLAP shut over the seam, plus a
// needle that pokes and withdraws at a single working point. Different
// mechanic (fold-and-conceal vs. pin-pull), different visible event (a
// hinge closing vs. a thread crossing + pin sliding out), different
// rendering technique (real DOM elements + CSS custom properties vs.
// canvas 2D draw calls).
//
// TIMELINE — one continuous clock, no per-stitch React state:
//   currentStitchFloat = elapsedMs / STITCH_INTERVAL_MS   (smooth fractional
//                                                           stitch depth)
//   currentIndex        = floor(currentStitchFloat)         (stitch the
//                                                           needle is
//                                                           actively locking)
//   feedDistance         = currentStitchFloat * CELL_SPACING (px the whole
//                                                           strip has fed
//                                                           left, in lockstep
//                                                           with the stitch
//                                                           count so the
//                                                           working point
//                                                           never drifts more
//                                                           than one cell)
//
// Every stitch position i is classified purely by ageMs = elapsedMs -
// i * STITCH_INTERVAL_MS (can be negative — a stitch not yet reached):
//   ageMs < FLAP_LAG_MS            flap open (channel skived, not yet
//                                   worked, or just locked and still
//                                   waiting its FLAP_LAG turn) — lift = 1
//   FLAP_LAG_MS <= ageMs < +FOLD_MS   the fold itself: an eased rotateX
//                                   hinge from lift=1 to lift=0 over
//                                   FOLD_MS, transform-origin on the
//                                   trailing (already-closed) edge
//   ageMs >= FLAP_LAG_MS + FOLD_MS  flush — folded flat, permanently
//                                   closed, drawn only as part of the single
//                                   continuous seam hairline behind it
//
// Because ageMs is linear in i, the boundary between "still open" and
// "already flush" trails the working point by a FIXED number of stitches
// ((FLAP_LAG_MS + FOLD_MS) / STITCH_INTERVAL_MS), so the flush seam's
// length is a single constant offset from the working point's screen
// position — computed once per frame, not accumulated or re-measured.
// ---------------------------------------------------------------------------

const CELL_SPACING = 14; // px per stitch — ~6-7 stitches/inch welt gauge at card DPI
const STITCH_INTERVAL_MS = 1050; // one lockstitch, comfortably above the 1s legibility floor
const FLAP_LAG_STITCHES = 3; // a flap stays open until its stitch is this many positions old
const FLAP_LAG_MS = FLAP_LAG_STITCHES * STITCH_INTERVAL_MS;
const FOLD_MS = 260; // fold transition duration — explicit hinge, never a blink
const NEEDLE_MS = 420; // needle in -> lock -> out, timed inside each stitch's own interval
const WORKING_X_FRAC = 0.45; // working point's fixed screen fraction across the strip
const POOL_SIZE = 200; // generous fixed DOM pool; covers dividers well past 2000px wide
const STATIC_STITCH_INDEX = 8; // reduced-motion: which stitch's crossing to freeze mid-lock
const STATIC_T_MS = STATIC_STITCH_INDEX * STITCH_INTERVAL_MS + NEEDLE_MS / 2; // MID_LOCK

function easeOutCubic(x: number): number {
  const t = 1 - x;
  return 1 - t * t * t;
}

export interface WeltChannelCloseProps {
  /** band height in px. Flap/needle size derive from this, the strip's own smaller dimension. Default 44. */
  height?: number;
  className?: string;
}

export function WeltChannelClose({ height = 44, className = "" }: WeltChannelCloseProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const seamRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<HTMLDivElement>(null);
  const flapRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const seam = seamRef.current;
    const needle = needleRef.current;
    if (!wrap || !seam || !needle) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let sized = false;
    let visible = true;
    let raf = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = rect.width;
      sized = width >= 2;
    };

    // -- render is a pure function of elapsedMs: nothing here is persisted
    // per-stitch state, so re-indexing which pool slot represents which
    // stitch (as the visible window slides) never loses or restarts an
    // in-flight fold. ------------------------------------------------------
    const render = (elapsedMs: number) => {
      if (!sized) return;

      const currentStitchFloat = elapsedMs / STITCH_INTERVAL_MS;
      const currentIndex = Math.floor(currentStitchFloat);
      const feedDistance = currentStitchFloat * CELL_SPACING;
      const workingX = width * WORKING_X_FRAC;

      const iMin = Math.floor((feedDistance - workingX) / CELL_SPACING) - 1;
      const iMax = Math.ceil((feedDistance + (width - workingX)) / CELL_SPACING) + 1;
      const visibleCount = Math.min(POOL_SIZE, Math.max(0, iMax - iMin + 1));

      for (let p = 0; p < POOL_SIZE; p++) {
        const el = flapRefs.current[p];
        if (!el) continue;
        if (p >= visibleCount) {
          el.style.display = "none";
          continue;
        }
        const i = iMin + p;
        const screenX = workingX + i * CELL_SPACING - feedDistance;
        const ageMs = elapsedMs - i * STITCH_INTERVAL_MS;

        let lift: number;
        if (ageMs < FLAP_LAG_MS) {
          lift = 1;
        } else if (ageMs < FLAP_LAG_MS + FOLD_MS) {
          const foldProgress = (ageMs - FLAP_LAG_MS) / FOLD_MS;
          lift = 1 - easeOutCubic(foldProgress);
        } else {
          lift = 0;
        }

        el.style.display = "block";
        el.style.transform = `translateX(${screenX.toFixed(2)}px)`;
        el.style.setProperty("--lift", lift.toFixed(4));
      }

      // flush seam: constant lag behind the working point (derived in the
      // header comment), so its length needs no per-stitch loop at all.
      const boundaryOffset = (CELL_SPACING * (FLAP_LAG_MS + FOLD_MS)) / STITCH_INTERVAL_MS;
      const seamWidth = Math.max(0, workingX - boundaryOffset);
      seam.style.width = `${seamWidth.toFixed(2)}px`;

      // needle: only present during its own stitch's 420ms crossing window,
      // drifting with the feed the same as every other stitch position.
      const needleLocalMs = elapsedMs - currentIndex * STITCH_INTERVAL_MS;
      const needleActive = needleLocalMs <= NEEDLE_MS;
      const needleX = workingX + currentIndex * CELL_SPACING - feedDistance;
      const depth = needleActive ? Math.sin((Math.min(1, needleLocalMs / NEEDLE_MS)) * Math.PI) : 0;
      needle.style.transform = `translateX(${needleX.toFixed(2)}px) scaleY(${(0.25 + 0.75 * depth).toFixed(3)})`;
      needle.style.opacity = needleActive ? "1" : "0";
    };

    let startTime = 0;
    const loop = (now: number) => {
      if (!startTime) startTime = now;
      render(now - startTime);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (reduced) {
        render(STATIC_T_MS);
        return;
      }
      startTime = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
        if (reduced) render(STATIC_T_MS);
      }, 120);
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(wrap);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible && !document.hidden && !reduced) {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(loop);
        }
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && visible && !reduced) raf = requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", onVis);

    resize();
    start();

    return () => {
      cancelAnimationFrame(raf);
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const flapSize = Math.max(10, height * 0.5);

  return (
    <div
      ref={wrapRef}
      role="separator"
      aria-orientation="horizontal"
      className={`ns-wcc relative w-full overflow-hidden ${className}`}
      style={{ height, perspective: 260 }}
    >
      <style>{`
        .ns-wcc-flap {
          position: absolute;
          top: 50%;
          width: ${CELL_SPACING}px;
          height: ${flapSize}px;
          margin-top: ${-flapSize / 2}px;
          transform-style: preserve-3d;
          transform-origin: right center;
          border-right: 1px solid var(--border);
          background-color: color-mix(in srgb, var(--background), var(--foreground) calc(var(--lift, 0) * 5%));
          box-shadow: 0 calc(var(--lift, 0) * 2px) calc(var(--lift, 0) * 6px)
            color-mix(in srgb, var(--foreground) calc(var(--lift, 0) * 24%), transparent);
          transform: translateX(0) perspective(260px) rotateX(calc(var(--lift, 0) * -32deg));
          will-change: transform;
        }
      `}</style>

      <div className="ns-wcc-seam absolute left-0 top-1/2 -translate-y-1/2 bg-foreground" ref={seamRef} style={{ height: 1, width: 0 }} />

      {Array.from({ length: POOL_SIZE }).map((_, p) => (
        <div
          key={p}
          ref={(el) => {
            flapRefs.current[p] = el;
          }}
          className="ns-wcc-flap"
          style={{ display: "none" }}
        />
      ))}

      <div
        ref={needleRef}
        aria-hidden="true"
        className="absolute left-0 top-1/2 bg-foreground"
        style={{ width: 1, height: flapSize * 0.7, marginTop: -(flapSize * 0.35), opacity: 0 }}
      />
    </div>
  );
}
