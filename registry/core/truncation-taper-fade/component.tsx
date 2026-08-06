"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// Truncation without the ellipsis. Instead of a hard overflow:hidden cut (or
// a hidden dependency on a wdth-axis font Geist Sans doesn't ship — checked:
// its fvar table has only `wght`, no `wdth`), the trailing run of characters
// nearest the clip edge crowds itself: negative letter-spacing pulls them
// together (this is the part that actually reclaims layout width — the same
// job font-stretch/wdth would do on a font that had the axis), a matching
// horizontal scaleX squeeze reinforces the narrowing by eye, and a
// mask-image fade dissolves the final few characters toward transparent —
// alpha, not a background-colored overlay, so it's correct against any
// surface without needing to sample one. font-stretch is still set
// alongside letter-spacing (harmless no-op today, forward-compatible if a
// variable font with a real width axis is swapped in later).
//
// The compaction is heavier the more text is actually hidden: `hiddenRatio`
// (overflow px / container width) drives how far letter-spacing, scaleX and
// font-stretch travel, so a lightly-clipped cell barely tapers and a badly
// clipped one visibly crushes at its edge — the still frame communicates
// overflow magnitude, not just its existence.
//
// Full text is always real DOM text (never aria-hidden decoration standing
// in for a label) — mask and width axis are paint-only, so a screen reader
// reads the complete string regardless of visual state. The element also
// carries `title` and is a tab stop; focus (and hover) spring the tapered
// run back to full width, and — only if the line still doesn't fit even
// fully expanded — glide the whole line left to peek the tail, hold, then
// return. The admitted cost: a keyboard user has to focus each cell to read
// a tail, exactly the cost of native ellipsis + a tooltip.

const SPRING_MS = 220;
const PEEK_HOLD_MS = 900;
const PEEK_TRAVEL_MS = 650;
const MAX_TAIL_CHARS = 12;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

interface Metrics {
  isOverflowing: boolean;
  overflowPx: number;
  hiddenRatio: number;
  tailStart: number;
  lastVisibleIndex: number;
}

const REST_METRICS: Metrics = {
  isOverflowing: false,
  overflowPx: 0,
  hiddenRatio: 0,
  tailStart: 0,
  lastVisibleIndex: 0,
};

export interface VanishTaperProps {
  /** Full string — always rendered as real text, in full, regardless of visual clipping. */
  text: string;
  /** How many trailing characters can taper at most. Default 12. */
  maxTailChars?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function VanishTaper({ text, maxTailChars = MAX_TAIL_CHARS, className = "" }: VanishTaperProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const measurerRef = useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = useState<Metrics>(REST_METRICS);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [peeking, setPeeking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const active = hovered || focused;
  const chars = useMemo(() => Array.from(text), [text]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Measure natural (untapered) width via a hidden sibling clone, compare to
  // the container's clipped width, and estimate where the visible boundary
  // falls so the taper zone sits near the actual clip edge rather than
  // always at the literal end of a string many times longer than the box.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const measurer = measurerRef.current;
    if (!container || !measurer) return;

    const measure = () => {
      const containerWidth = container.clientWidth;
      const naturalWidth = measurer.scrollWidth;
      if (containerWidth <= 0 || chars.length === 0) {
        setMetrics(REST_METRICS);
        return;
      }
      const isOverflowing = naturalWidth > containerWidth + 0.5;
      const overflowPx = Math.max(0, naturalWidth - containerWidth);
      const hiddenRatio = Math.min(1, Math.max(0, overflowPx / Math.max(containerWidth, 1)));
      let tailStart = chars.length;
      let lastVisibleIndex = chars.length - 1;
      if (isOverflowing) {
        const avgCharWidth = naturalWidth / chars.length;
        const visibleEstimate = Math.max(1, Math.floor(containerWidth / Math.max(avgCharWidth, 0.01)));
        lastVisibleIndex = Math.min(chars.length - 1, visibleEstimate - 1);
        const tailCount = Math.min(maxTailChars, chars.length);
        tailStart = Math.max(0, lastVisibleIndex - tailCount + 1);
      }
      setMetrics({ isOverflowing, overflowPx, hiddenRatio, tailStart, lastVisibleIndex });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    let cancelled = false;
    document.fonts?.ready
      ?.then(() => {
        if (!cancelled) measure();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [chars, maxTailChars]);

  // Decompress choreography: spring open immediately, then — only if the
  // line still doesn't fit even at full width — glide left to reveal the
  // tail, hold, and glide back while focus/hover is still held.
  useEffect(() => {
    if (!active || !metrics.isOverflowing) {
      setPeeking(false);
      return;
    }
    if (reducedMotion) {
      setPeeking(true);
      return;
    }
    const openTimer = window.setTimeout(() => setPeeking(true), SPRING_MS);
    const closeTimer = window.setTimeout(() => setPeeking(false), SPRING_MS + PEEK_HOLD_MS);
    return () => {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
    };
  }, [active, metrics.isOverflowing, reducedMotion]);

  const { isOverflowing, overflowPx, hiddenRatio, tailStart, lastVisibleIndex } = metrics;
  const headStr = chars.slice(0, tailStart).join("");
  const tailChars = chars.slice(tailStart);
  const minLetterSpacing = -0.02 - hiddenRatio * 0.16; // -0.02em .. -0.18em
  const minStretch = 100 - hiddenRatio * 38; // 100% .. 62%
  const minScale = 1 - hiddenRatio * 0.16; // 1 .. 0.84
  const denom = Math.max(1, lastVisibleIndex - tailStart);

  const maskImage = isOverflowing
    ? "linear-gradient(to right, black, black calc(100% - 3ch), transparent 100%)"
    : undefined;

  return (
    <span
      ref={containerRef}
      tabIndex={0}
      title={text}
      data-vt-active={active ? "true" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`ns-vt relative block cursor-default overflow-hidden whitespace-nowrap outline-none ${className}`}
      style={{
        maskImage,
        WebkitMaskImage: maskImage,
        transition: "-webkit-mask-image 260ms ease, mask-image 260ms ease",
      }}
    >
      <style>{`
        /* An outline paints outside the border box, but this element clips
           its own overflow — an outline here would itself get clipped away.
           An inset box-shadow paints inside instead, so it always shows. */
        .ns-vt:focus-visible {
          box-shadow: inset 0 0 0 2px var(--ns-accent);
        }
        .ns-vt[data-vt-active="true"] {
          -webkit-mask-image: none !important;
          mask-image: none !important;
        }
        .ns-vt-tail-char {
          display: inline-block;
          transition:
            letter-spacing 220ms cubic-bezier(.16,1,.3,1),
            font-stretch 220ms cubic-bezier(.16,1,.3,1),
            transform 220ms cubic-bezier(.16,1,.3,1);
        }
        .ns-vt-line {
          display: inline-block;
          transition: transform ${PEEK_TRAVEL_MS}ms cubic-bezier(.65,0,.35,1);
        }
        [data-vt-active="true"] .ns-vt-tail-char {
          letter-spacing: 0 !important;
          font-stretch: 100% !important;
          transform: scaleX(1) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-vt-tail-char, .ns-vt-line, .ns-vt {
            transition: none !important;
          }
        }
      `}</style>

      {/* Hidden measurer: same text, no taper styling — gives the natural,
          untapered width used to detect overflow and estimate the visible
          boundary. Visually inert, never read by AT (real text lives below). */}
      <span
        ref={measurerRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap"
        style={{ visibility: "hidden" }}
      >
        {text}
      </span>

      <span
        className="ns-vt-line"
        style={{ transform: `translateX(${peeking ? -overflowPx : 0}px)` }}
      >
        {headStr}
        {tailChars.map((ch, j) => {
          const idx = tailStart + j;
          const t = Math.min(1, (idx - tailStart) / denom);
          const eased = Math.pow(t, 1.6);
          const letterSpacing = lerp(-0.004, minLetterSpacing, eased);
          const stretch = lerp(100, minStretch, eased);
          const scale = lerp(1, minScale, eased);
          return (
            <span
              key={idx}
              className="ns-vt-tail-char"
              style={{
                letterSpacing: `${letterSpacing.toFixed(3)}em`,
                fontStretch: `${stretch.toFixed(1)}%`,
                transform: `scaleX(${scale.toFixed(3)})`,
                transformOrigin: "right",
              }}
            >
              {ch}
            </span>
          );
        })}
      </span>
    </span>
  );
}
