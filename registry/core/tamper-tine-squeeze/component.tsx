"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// TamperTineSqueeze — an indeterminate "still working" loader (asset
// optimization, DB vacuum/compaction) modeled on mechanised ballast tamping
// (Plasser & Theurer-class units): a satellite plunges a paired tine either
// side of a rail sleeper, squeezes the pair together under vibration to pack
// the ballast beneath it, lifts, and steps to the next sleeper. Real tine
// vibration is ~35Hz — well above the ~60Hz paint rate this repaints at, so
// per the round-9 decoupling rule it is never animated 1:1. It is rendered
// as a slow, legible squeeze (a smooth close over 250ms) held for 250ms with
// a low-amplitude jitter CAPPED at 6Hz layered on top only during that hold,
// 10x below paint-rate alias risk, to suggest vibration texture without
// strobing. Real per-sleeper machine advance (~2-3 sleepers/minute) is far
// too slow for a legible UI loop, so the rendered cadence is compressed to
// one plunge->squeeze->lift->shift cycle every 1.6s and documented as a
// compression, not a literal rate.
//
// The row is an infinite treadmill, not a bounded loop that resets: the
// satellite always renders at a fixed screen x, and the sleeper row scrolls
// left under it during the 500ms "shift" sub-phase. A monotonically
// increasing cycle index (wall-clock time / 1.6s, floored) drives which
// sleeper is "current" — it never wraps, so the row is materially further
// along at every later timestamp with zero input, satisfying the resting
// -loop rule without a synthetic reset. Sleeper ballast is drawn as two
// crossfading dot clusters per slot: a sparse, fully-random scatter in
// --ns-muted for not-yet-tamped stone, and a denser, jittered-grid cluster
// in --foreground for packed stone — count and layout carry the
// loose-vs-packed read, never color alone, so the distinction survives
// light theme where --ns-muted sits close to --background.
//
// A `progress` prop switches the component into a determinate mode: the
// satellite's position maps directly to percent-complete along a fixed-
// length row and the loop STOPS — it only advances (playing one real
// plunge->squeeze->lift->shift pass) when `progress` itself changes, and
// otherwise sits in a static settled frame. This is the only way the
// component is allowed to stop looping: an indeterminate ambient loop must
// never be dressed up to look like it is reporting a percentage it doesn't
// have, and a real percentage must never keep animating on its own clock
// once it's caught up.
// ---------------------------------------------------------------------------

export interface TamperTineSqueezeProps {
  /**
   * 0-100 real progress value. When provided, the satellite's position maps
   * directly to percent-complete along a fixed `totalSleepers`-long row and
   * the component stops looping — it only advances, once, on a `progress`
   * change. When omitted, runs an ambient, unbounded indeterminate loop.
   */
  progress?: number;
  /** row length the `progress` prop is mapped across. Default 24. */
  totalSleepers?: number;
  /** accessible label for the loader/progress region */
  ariaLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const SLOT_COUNT = 8; // pooled DOM slots covering the visible window
const VISIBLE_BEHIND = 1; // sleepers rendered left of the satellite's fixed x

const PLUNGE_MS = 300;
const SQUEEZE_CLOSE_MS = 250;
const SQUEEZE_HOLD_MS = 250;
const SQUEEZE_MS = SQUEEZE_CLOSE_MS + SQUEEZE_HOLD_MS; // 500 — "close-and-hold ~500ms" per spec
const LIFT_MS = 300;
const SHIFT_MS = 500;
const CYCLE_MS = PLUNGE_MS + SQUEEZE_MS + LIFT_MS + SHIFT_MS; // 1600ms per sleeper

const T_PLUNGE_END = PLUNGE_MS; // 300
const T_SQUEEZE_CLOSE_END = T_PLUNGE_END + SQUEEZE_CLOSE_MS; // 550
const T_SQUEEZE_END = T_PLUNGE_END + SQUEEZE_MS; // 800
const T_LIFT_END = T_SQUEEZE_END + LIFT_MS; // 1100
// T_SHIFT_END === CYCLE_MS (1600)

// rendered jitter is capped well below the real ~35Hz tine vibration and
// well below the ~60Hz paint rate it repaints against (round-9 decoupling
// rule) — documented as a compression, never animated 1:1.
const JITTER_HZ_CAP = 6;

// geometry scaled off the container's SMALLER dimension (binding rule) so
// the squeeze motion reads at card scale rather than shrinking away.
const SCALE_REFERENCE_DIM = 200;
const MIN_SCALE = 0.65;
const MAX_SCALE = 2;

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(index: number, salt: number): number {
  return (Math.imul(index + salt, 2654435761) ^ (index * 40503)) >>> 0;
}

/** sparse, not-yet-tamped ballast: a plain random scatter — loose stone,
 * no structure. Rebuilt only when a pool slot changes which sleeper index
 * it represents, never per animation frame. */
function buildScatterDots(cx: number, top: number, bottom: number, halfWidth: number, count: number, seed: number, size: number): string {
  const rand = mulberry32(seed);
  let d = "";
  for (let i = 0; i < count; i++) {
    const x = cx + (rand() - 0.5) * 2 * halfWidth;
    const y = top + rand() * (bottom - top);
    d += `M${(x - size / 2).toFixed(1)} ${(y - size / 2).toFixed(1)}h${size.toFixed(1)}v${size.toFixed(1)}h${(-size).toFixed(1)}Z`;
  }
  return d;
}

/** dense, packed ballast: a jittered grid — consolidated stone filling the
 * band uniformly. Density (structure + count), not colour, carries the
 * packed read, so it survives light theme where --ns-muted sits close to
 * --background. */
function buildPackedDots(cx: number, top: number, bottom: number, halfWidth: number, cols: number, rows: number, seed: number, size: number): string {
  const rand = mulberry32(seed);
  const cw = (halfWidth * 2) / cols;
  const ch = (bottom - top) / rows;
  let d = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cx - halfWidth + (c + 0.5) * cw + (rand() - 0.5) * 0.4 * cw;
      const y = top + (r + 0.5) * ch + (rand() - 0.5) * 0.4 * ch;
      d += `M${(x - size / 2).toFixed(1)} ${(y - size / 2).toFixed(1)}h${size.toFixed(1)}v${size.toFixed(1)}h${(-size).toFixed(1)}Z`;
    }
  }
  return d;
}

interface DotCache {
  sparse: string;
  packed: string;
}

export function TamperTineSqueeze({
  progress,
  totalSleepers = 24,
  ariaLabel = "Optimizing",
  className = "",
}: TamperTineSqueezeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const railTopRef = useRef<SVGLineElement>(null);
  const railBottomRef = useRef<SVGLineElement>(null);
  const tineLeftRef = useRef<SVGLineElement>(null);
  const tineRightRef = useRef<SVGLineElement>(null);
  const sleeperRefs = useRef<(SVGRectElement | null)[]>([]);
  const sparseRefs = useRef<(SVGPathElement | null)[]>([]);
  const packedRefs = useRef<(SVGPathElement | null)[]>([]);
  const [ready, setReady] = useState(false);
  const isControlled = typeof progress === "number";
  const controlledRef = useRef(progress);
  controlledRef.current = progress;
  // persists the last SETTLED sleeper index across effect re-runs (a new
  // `progress` value re-runs the effect below) — without this the "did the
  // target change" check compares a value against itself every time and the
  // controlled pass never fires.
  const lastRenderedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let visible = true;
    let raf = 0;
    let w = 0;
    let h = 0;
    let sized = false;

    let scale = 1;
    let spacing = 40;
    let fixedX = 0;
    let groundY = 0;
    let sleeperW = 4;
    let sleeperH = 24;
    let railY1 = 0;
    let railY2 = 0;
    let ballastTop = 0;
    let ballastBottom = 0;
    let clusterHalfW = 16;
    let dotSize = 2;
    let tineTopY = 0;
    let tineBottomFull = 0;
    let gapOpen = 10;
    let gapClosed = 3;
    let jitterAmp = 1;

    const dotCache = new Map<number, DotCache>();

    const clampTotal = Math.max(2, Math.floor(totalSleepers));

    const dotsFor = (index: number): DotCache => {
      let entry = dotCache.get(index);
      if (!entry) {
        entry = {
          sparse: buildScatterDots(0, ballastTop, ballastBottom, clusterHalfW, 7, hashSeed(index, 17), dotSize),
          packed: buildPackedDots(0, ballastTop, ballastBottom, clusterHalfW, 4, 5, hashSeed(index, 91), dotSize * 0.92),
        };
        dotCache.set(index, entry);
      }
      return entry;
    };

    const pruneCache = (currentIndex: number) => {
      for (const key of dotCache.keys()) {
        if (key < currentIndex - 2) dotCache.delete(key);
      }
    };

    const layout = () => {
      const rect = root.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w < 2 || h < 2) {
        sized = false;
        return;
      }
      sized = true;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

      const minDim = Math.min(w, h);
      scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, minDim / SCALE_REFERENCE_DIM));

      spacing = Math.max(28 * scale, w / 6.2);
      fixedX = w * 0.3;
      groundY = h * 0.42;
      sleeperW = 5 * scale;
      sleeperH = 30 * scale;
      railY1 = groundY - sleeperH / 2 - 3 * scale;
      railY2 = groundY - sleeperH / 2 - 7 * scale;
      ballastTop = groundY + sleeperH / 2 - 2 * scale;
      ballastBottom = Math.min(h - 6 * scale, ballastTop + 46 * scale);
      clusterHalfW = spacing * 0.3;
      dotSize = 2.1 * scale;
      tineTopY = railY2 - 8 * scale;
      tineBottomFull = ballastBottom - 4 * scale;
      gapOpen = sleeperW / 2 + 16 * scale;
      gapClosed = sleeperW / 2 + 3 * scale;
      jitterAmp = 1.3 * scale;

      dotCache.clear();

      railTopRef.current?.setAttribute("x1", "0");
      railTopRef.current?.setAttribute("x2", String(w));
      railTopRef.current?.setAttribute("y1", String(railY1));
      railTopRef.current?.setAttribute("y2", String(railY1));
      railBottomRef.current?.setAttribute("x1", "0");
      railBottomRef.current?.setAttribute("x2", String(w));
      railBottomRef.current?.setAttribute("y1", String(railY2));
      railBottomRef.current?.setAttribute("y2", String(railY2));

      setReady(true);
    };

    // -- writes one full frame given: the sleeper index sitting at fixedX
    // ("current"), a 0..1 shift offset (row scroll toward the NEXT index,
    // zero outside the shift sub-phase), and the tine state (depth 0..1,
    // half-gap in px, jitter offset in px, opacity 0..1). Ambient loop,
    // controlled one-shot pass, reduced-motion static frame and the
    // controlled idle frame all funnel through this one function. ---------
    const applyFrame = (
      currentIndex: number,
      shiftT: number,
      tineDepth: number,
      tineGapHalf: number,
      tineJitter: number,
      tineOpacity: number
    ) => {
      pruneCache(currentIndex);
      const offsetPx = shiftT * spacing;
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const index = currentIndex - VISIBLE_BEHIND + slot;
        const cx = fixedX + (index - currentIndex) * spacing - offsetPx;
        const sleeper = sleeperRefs.current[slot];
        const sparse = sparseRefs.current[slot];
        const packed = packedRefs.current[slot];
        if (sleeper) {
          sleeper.setAttribute("x", String(cx - sleeperW / 2));
          sleeper.setAttribute("y", String(groundY - sleeperH / 2));
          sleeper.setAttribute("width", String(sleeperW));
          sleeper.setAttribute("height", String(sleeperH));
        }
        const dots = dotsFor(index);
        let packFrac: number;
        if (index < currentIndex) packFrac = 1;
        else if (index > currentIndex) packFrac = 0;
        else packFrac = clamp01(tineDepth <= 0 ? 0 : (tineGapHalf <= gapClosed + 0.01 ? 1 : (gapOpen - tineGapHalf) / (gapOpen - gapClosed)));
        if (sparse) {
          sparse.setAttribute("d", dots.sparse);
          sparse.setAttribute("transform", `translate(${cx.toFixed(1)} 0)`);
          sparse.style.opacity = String(1 - packFrac);
        }
        if (packed) {
          packed.setAttribute("d", dots.packed);
          packed.setAttribute("transform", `translate(${cx.toFixed(1)} 0)`);
          packed.style.opacity = String(packFrac);
        }
      }

      const tl = tineLeftRef.current;
      const tr = tineRightRef.current;
      const bottomY = lerp(tineTopY, tineBottomFull, tineDepth);
      const jx = tineJitter;
      if (tl) {
        tl.setAttribute("x1", String(fixedX - tineGapHalf + jx));
        tl.setAttribute("x2", String(fixedX - tineGapHalf + jx));
        tl.setAttribute("y1", String(tineTopY));
        tl.setAttribute("y2", String(bottomY));
        tl.style.opacity = String(tineOpacity);
      }
      if (tr) {
        tr.setAttribute("x1", String(fixedX + tineGapHalf - jx));
        tr.setAttribute("x2", String(fixedX + tineGapHalf - jx));
        tr.setAttribute("y1", String(tineTopY));
        tr.setAttribute("y2", String(bottomY));
        tr.style.opacity = String(tineOpacity);
      }
    };

    // -- one sleeper's plunge->squeeze->lift tine state at local time t
    // (0..T_LIFT_END). Shift (t beyond T_LIFT_END) is handled by the
    // caller, which also owns which two indices are being crossed. --------
    const tineStateAt = (t: number) => {
      if (t < T_PLUNGE_END) {
        const p = clamp01(t / PLUNGE_MS);
        const depth = easeOutQuad(p);
        const opacity = clamp01(t / 90);
        return { depth, gapHalf: gapOpen, jitter: 0, opacity };
      }
      if (t < T_SQUEEZE_CLOSE_END) {
        const p = clamp01((t - T_PLUNGE_END) / SQUEEZE_CLOSE_MS);
        const gapHalf = lerp(gapOpen, gapClosed, easeOutQuad(p));
        return { depth: 1, gapHalf, jitter: 0, opacity: 1 };
      }
      if (t < T_SQUEEZE_END) {
        const holdT = (t - T_SQUEEZE_CLOSE_END) / 1000; // seconds into the hold
        // envelope so the ~6Hz jitter fades in/out at the hold's edges
        // instead of switching on/off abruptly
        const holdP = clamp01((t - T_SQUEEZE_CLOSE_END) / SQUEEZE_HOLD_MS);
        const envelope = Math.sin(holdP * Math.PI);
        const jitter = Math.sin(holdT * 2 * Math.PI * JITTER_HZ_CAP) * jitterAmp * envelope;
        return { depth: 1, gapHalf: gapClosed, jitter, opacity: 1 };
      }
      if (t < T_LIFT_END) {
        const p = clamp01((t - T_SQUEEZE_END) / LIFT_MS);
        const depth = 1 - easeOutQuad(p);
        const opacity = 1 - clamp01((p - 0.7) / 0.3);
        return { depth, gapHalf: gapClosed, jitter: 0, opacity };
      }
      return { depth: 0, gapHalf: gapOpen, jitter: 0, opacity: 0 };
    };

    // ---- ambient (uncontrolled) mode: a monotonically increasing cycle
    // index driven off wall-clock time — an infinite treadmill, never a
    // bounded loop that resets. -------------------------------------------
    let ambientStart = 0;

    const ambientLoop = (now: number) => {
      raf = 0;
      if (!visible || !sized) return;
      if (ambientStart === 0) ambientStart = now;
      const totalT = now - ambientStart;
      const cycleIndex = Math.floor(totalT / CYCLE_MS);
      const localT = totalT - cycleIndex * CYCLE_MS;
      if (localT < T_LIFT_END) {
        const { depth, gapHalf, jitter, opacity } = tineStateAt(localT);
        applyFrame(cycleIndex, 0, depth, gapHalf, jitter, opacity);
      } else {
        const shiftT = easeOutQuad(clamp01((localT - T_LIFT_END) / SHIFT_MS));
        applyFrame(cycleIndex, shiftT, 0, gapOpen, 0, 0);
      }
      raf = requestAnimationFrame(ambientLoop);
    };

    // ---- reduced motion: freeze on the squeeze-closed, mid-hold frame —
    // one sleeper already packed to the left, the current sleeper's tines
    // fully shut and holding (no jitter — this is a frozen frame), the
    // rest of the row still loose ahead. ------------------------------
    const renderReducedFrame = () => {
      applyFrame(1, 0, 1, gapClosed, 0, 1);
    };

    // ---- controlled (progress) mode: settle instantly to the frame
    // matching `progress`, no animation, no timers. ------------------
    const settleControlled = (index: number) => {
      applyFrame(index, 0, 0, gapOpen, 0, 0);
    };

    // ---- controlled (progress) mode: play exactly one real
    // plunge->squeeze->lift->shift pass from `fromIndex` to `toIndex`,
    // then stop and settle — it never keeps animating once caught up. ----
    let controlledStart = 0;
    let controlledFrom = 0;
    let controlledTo = 0;

    const controlledLoop = (now: number) => {
      raf = 0;
      if (!visible || !sized) return;
      if (controlledStart === 0) controlledStart = now;
      const t = now - controlledStart;
      if (t < T_LIFT_END) {
        const { depth, gapHalf, jitter, opacity } = tineStateAt(t);
        applyFrame(controlledFrom, 0, depth, gapHalf, jitter, opacity);
        raf = requestAnimationFrame(controlledLoop);
        return;
      }
      if (t < CYCLE_MS) {
        const shiftT = easeOutQuad(clamp01((t - T_LIFT_END) / SHIFT_MS));
        // a jump of more than one sleeper still crosses in this single
        // 500ms shift window, scaled by the actual distance travelled.
        const dist = controlledTo - controlledFrom;
        applyFrame(controlledFrom, shiftT * dist, 0, gapOpen, 0, 0);
        raf = requestAnimationFrame(controlledLoop);
        return;
      }
      controlledStart = 0;
      settleControlled(controlledTo);
    };

    const startControlledCycle = (fromIndex: number, toIndex: number) => {
      if (raf) cancelAnimationFrame(raf);
      controlledFrom = fromIndex;
      controlledTo = toIndex;
      controlledStart = 0;
      raf = requestAnimationFrame(controlledLoop);
    };

    layout();

    // `lastRenderedIndexRef` persists across this effect's re-runs (it re-
    // runs on every `progress`/`totalSleepers` change) — the whole point is
    // to tell "first mount, nothing to animate from" apart from "a real
    // change just arrived, play the one-shot pass."
    if (isControlled) {
      const target = Math.round(clamp01((controlledRef.current ?? 0) / 100) * clampTotal);
      const previous = lastRenderedIndexRef.current;
      if (previous === null) {
        // first mount: settle instantly, nothing to animate from.
        lastRenderedIndexRef.current = target;
        if (reduced) applyFrame(target, 0, 1, gapClosed, 0, 1);
        else settleControlled(target);
      } else if (target !== previous) {
        lastRenderedIndexRef.current = target;
        if (reduced) applyFrame(target, 0, 1, gapClosed, 0, 1);
        else startControlledCycle(previous, target);
      } else if (reduced) {
        applyFrame(target, 0, 1, gapClosed, 0, 1);
      } else {
        settleControlled(target);
      }
    } else if (reduced) {
      renderReducedFrame();
    } else if (sized) {
      raf = requestAnimationFrame(ambientLoop);
    }

    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (disposed) return;
        layout();
        if (isControlled) {
          const target = lastRenderedIndexRef.current ?? 0;
          if (reduced) applyFrame(target, 0, 1, gapClosed, 0, 1);
          else settleControlled(target);
        } else if (reduced) {
          renderReducedFrame();
        } else if (sized && !raf) {
          ambientStart = 0;
          raf = requestAnimationFrame(ambientLoop);
        }
      }, 100);
    });
    ro.observe(root);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible && !reduced && sized && !raf) {
        if (isControlled) {
          if (controlledStart !== 0 || controlledFrom !== controlledTo) {
            raf = requestAnimationFrame(controlledLoop);
          }
        } else {
          ambientStart = 0;
          raf = requestAnimationFrame(ambientLoop);
        }
      }
    });
    io.observe(root);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      window.clearTimeout(resizeTimer);
      ro.disconnect();
      io.disconnect();
    };
    // progress drives a dedicated one-shot pass on change (see the
    // isControlled block above); totalSleepers reshapes the controlled
    // mapping and both are intentionally in the dependency array so a
    // change re-runs this effect rather than being read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, totalSleepers, isControlled]);

  return (
    <div
      ref={rootRef}
      data-tamper-tine-squeeze
      role={isControlled ? "progressbar" : "status"}
      aria-label={ariaLabel}
      aria-valuenow={isControlled ? Math.round(progress ?? 0) : undefined}
      aria-valuemin={isControlled ? 0 : undefined}
      aria-valuemax={isControlled ? 100 : undefined}
      className={`relative aspect-[16/9] w-full overflow-hidden rounded-md border border-border bg-background transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"} ${className}`}
    >
      <svg ref={svgRef} aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 h-full w-full">
        <line ref={railTopRef} stroke="var(--ns-muted)" strokeOpacity={0.5} strokeWidth={1} />
        <line ref={railBottomRef} stroke="var(--ns-muted)" strokeOpacity={0.5} strokeWidth={1} />
        {Array.from({ length: SLOT_COUNT }).map((_, i) => (
          <path
            key={`sparse-${i}`}
            ref={(el) => {
              sparseRefs.current[i] = el;
            }}
            d=""
            fill="var(--ns-muted)"
          />
        ))}
        {Array.from({ length: SLOT_COUNT }).map((_, i) => (
          <path
            key={`packed-${i}`}
            ref={(el) => {
              packedRefs.current[i] = el;
            }}
            d=""
            fill="var(--foreground)"
          />
        ))}
        {Array.from({ length: SLOT_COUNT }).map((_, i) => (
          <rect
            key={`sleeper-${i}`}
            ref={(el) => {
              sleeperRefs.current[i] = el;
            }}
            fill="var(--foreground)"
          />
        ))}
        <line ref={tineLeftRef} stroke="var(--foreground)" strokeWidth={2} strokeLinecap="round" />
        <line ref={tineRightRef} stroke="var(--foreground)" strokeWidth={2} strokeLinecap="round" />
      </svg>
    </div>
  );
}
