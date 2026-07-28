"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ---------------------------------------------------------------------------
// SprocketScrub — a media scrubber rendered as a physical film strip. Sprocket
// holes (SVG pattern) run both edges of a horizontal track; the track body is
// divided into one cell per second ("perforation") via a percentage-sized
// repeating background so the grid always lines up regardless of width.
// Buffered range renders as faintly noise-filled exposed frames; unbuffered
// range is blank stock.
//
// The playhead is a gate claw. Its motion has two distinct regimes, and
// which one is active is decided per pointer-drag sample from the raw pixel
// speed of the drag itself (not from how the `value` prop happens to change
// externally, which always just glides smoothly — see the "not dragging"
// effect below):
//   - slow drag: the claw disengages and re-engages one perforation at a
//     time. Each time the dragged position crosses into a new whole second
//     it plays a short "pull-in" spring settle to that tooth and commits an
//     integer value.
//   - fast drag: the claw releases — position tracks the pointer 1:1, no
//     rounding, no transition, continuous glide.
// Both are computed from direct-DOM transform writes on refs; no React state
// on the pointermove hot path.
//
// Hovering anywhere on the track (independent of dragging) rises a small
// frame-preview tick above the cursor: a mono timestamp plus a shaded swatch
// standing in for that frame's cell.
//
// Accessibility: the track itself is role="slider" with aria-valuemin/max/now
// and a formatted aria-valuetext, arrow keys step one perforation, PageUp/
// PageDown step ten, Home/End jump to the ends — standard slider semantics,
// which is also why no extra live region is needed: AT already announces
// value changes through the slider's own value text on interaction.
//
// prefers-reduced-motion drops the discrete-step regime entirely: dragging
// always behaves like the fast/glide path, so there is continuous motion
// only, never snap theater.
// ---------------------------------------------------------------------------

export interface SprocketScrubProps {
  /** Controlled position in seconds. Omit for uncontrolled (see defaultValue). */
  value?: number;
  /** Initial position in seconds when uncontrolled. Default 0. */
  defaultValue?: number;
  /** Total duration in seconds. */
  duration: number;
  /** Buffered range from 0, in seconds. Default 0. */
  buffered?: number;
  /** Fires on every committed position change (drag, keyboard). */
  onValueChange?: (value: number) => void;
  /** Accessible name for the slider. Default "Scrub position". */
  label?: string;
  className?: string;
}

const SLOW_PX_MS = 0.5; // below this instantaneous drag speed -> discrete regime
const SNAP_MS = 120;
const SNAP_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // slight overshoot, the "pull-in"
const GLIDE_MS = 220;
const GLIDE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function writeClaw(el: HTMLDivElement | null, px: number, ms: number, ease: string) {
  if (!el) return;
  el.style.transition = ms > 0 ? `transform ${ms}ms ${ease}` : "none";
  el.style.transform = `translateX(${px}px)`;
}

function writePreview(el: HTMLDivElement | null, px: number) {
  if (!el) return;
  el.style.transform = `translateX(${px}px)`;
}

export function SprocketScrub({
  value: controlledValue,
  defaultValue = 0,
  duration,
  buffered = 0,
  onValueChange,
  label = "Scrub position",
  className = "",
}: SprocketScrubProps) {
  const uid = useId().replace(/:/g, "");
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue ?? internalValue;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const clawRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const reducedRef = useRef(false);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastTRef = useRef(0);
  const lastQuantRef = useRef(Math.round(value));
  const trackWidthRef = useRef(0);

  const [hovering, setHovering] = useState(false);
  const [previewValue, setPreviewValue] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const commit = useCallback(
    (v: number) => {
      onValueChange?.(v);
      if (controlledValue === undefined) setInternalValue(v);
    },
    [controlledValue, onValueChange]
  );

  const pxForValue = useCallback(
    (v: number) => (duration > 0 ? (v / duration) * trackWidthRef.current : 0),
    [duration]
  );

  // Programmatic position changes (playback advancing, keyboard steps, or any
  // update while not actively dragging) always glide smoothly — the two-
  // regime split belongs to live drag speed only, never to how the value
  // prop itself happens to change.
  useEffect(() => {
    if (draggingRef.current) return;
    const w = trackRef.current?.getBoundingClientRect().width ?? 0;
    trackWidthRef.current = w;
    lastQuantRef.current = Math.round(value);
    writeClaw(clawRef.current, pxForValue(value), reducedRef.current ? 0 : GLIDE_MS, GLIDE_EASE);
  }, [value, duration, pxForValue]);

  const step = useCallback(
    (delta: number) => {
      commit(clamp(Math.round(value) + delta, 0, duration));
    },
    [commit, value, duration]
  );

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        step(-1);
        break;
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        step(1);
        break;
      case "PageDown":
        e.preventDefault();
        step(-10);
        break;
      case "PageUp":
        e.preventDefault();
        step(10);
        break;
      case "Home":
        e.preventDefault();
        commit(0);
        break;
      case "End":
        e.preventDefault();
        commit(duration);
        break;
      default:
        break;
    }
  };

  const rawValueAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return value;
    const x = clamp(clientX - rect.left, 0, rect.width);
    trackWidthRef.current = rect.width;
    return (x / rect.width) * duration;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    trackRef.current?.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    lastXRef.current = e.clientX;
    lastTRef.current = performance.now();
    lastQuantRef.current = Math.round(value);
    const raw = rawValueAt(e.clientX);
    writeClaw(clawRef.current, pxForValue(raw), 0, GLIDE_EASE);
    commit(reducedRef.current ? raw : Math.round(raw));
  };

  const onPointerMoveTrack = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      const x = clamp(e.clientX - rect.left, 0, rect.width);
      writePreview(previewRef.current, x);
      setPreviewValue((x / rect.width) * duration);
    }

    if (!draggingRef.current) return;

    const now = performance.now();
    const dt = Math.max(1, now - lastTRef.current);
    const dx = Math.abs(e.clientX - lastXRef.current);
    const speed = dx / dt;
    lastXRef.current = e.clientX;
    lastTRef.current = now;

    const raw = rawValueAt(e.clientX);

    if (!reducedRef.current && speed < SLOW_PX_MS) {
      const quant = clamp(Math.round(raw), 0, duration);
      if (quant !== lastQuantRef.current) {
        lastQuantRef.current = quant;
        writeClaw(clawRef.current, pxForValue(quant), SNAP_MS, SNAP_EASE);
        commit(quant);
      }
    } else {
      lastQuantRef.current = Math.round(raw);
      writeClaw(clawRef.current, pxForValue(raw), 0, GLIDE_EASE);
      commit(raw);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    trackRef.current?.releasePointerCapture(e.pointerId);
    const snapped = clamp(Math.round(value), 0, duration);
    commit(snapped);
    writeClaw(clawRef.current, pxForValue(snapped), reducedRef.current ? 0 : SNAP_MS, SNAP_EASE);
  };

  const bufferedPct = duration > 0 ? clamp((buffered / duration) * 100, 0, 100) : 0;
  const cellPct = duration > 0 ? 100 / duration : 100;
  const holePatternId = `ns-sprocket-holes-${uid}`;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <style>{CSS}</style>
      <div
        ref={trackRef}
        data-sprocket-track=""
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(value)}
        aria-valuetext={formatTime(value)}
        className="ns-sprocket-track relative h-16 w-full select-none overflow-hidden rounded-[12px] border border-border bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMoveTrack}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onKeyDown={onKeyDown}
      >
        <svg className="absolute inset-x-0 top-0 h-2 w-full" aria-hidden="true">
          <defs>
            <pattern id={holePatternId} width="12" height="8" patternUnits="userSpaceOnUse">
              <circle cx="6" cy="4" r="1.5" fill="var(--border)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${holePatternId})`} />
        </svg>

        <div className="absolute inset-x-0 top-2 bottom-2 overflow-hidden">
          {/* blank stock */}
          <div className="absolute inset-0" style={{ backgroundColor: "var(--border)", opacity: 0.12 }} />
          {/* exposed / buffered frames: faint noise fill */}
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${bufferedPct}%`,
              backgroundColor: "var(--foreground)",
              opacity: 0.05,
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--foreground) 0px, var(--foreground) 1px, transparent 1px, transparent 3px)",
            }}
          />
          {/* frame cell dividers */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px)",
              backgroundSize: `${cellPct}% 100%`,
              opacity: 0.7,
            }}
          />
          {/* gate claw / playhead */}
          <div ref={clawRef} className="ns-sprocket-claw absolute inset-y-0 left-0" style={{ transform: "translateX(0px)" }}>
            <span
              aria-hidden="true"
              className="absolute -top-[7px] left-0 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderTop: "6px solid var(--foreground)",
              }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 -translate-x-1/2"
              style={{ width: 2, backgroundColor: "var(--foreground)" }}
            />
          </div>
        </div>

        <svg className="absolute inset-x-0 bottom-0 h-2 w-full" aria-hidden="true">
          <rect width="100%" height="100%" fill={`url(#${holePatternId})`} />
        </svg>
      </div>

      {hovering && (
        <div
          ref={previewRef}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 -translate-x-1/2 rounded-[6px] border border-border bg-background px-1.5 py-1 shadow-sm"
        >
          <div className="mb-1 h-3 w-6 rounded-[2px]" style={{ backgroundColor: "var(--muted)", opacity: 0.3 }} />
          <div className="font-mono text-[10px] tabular-nums text-foreground">{formatTime(previewValue)}</div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.ns-sprocket-claw{will-change:transform;}
@media (prefers-reduced-motion: reduce){
  .ns-sprocket-claw{transition:none !important;}
}
`;
