"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

// ---------------------------------------------------------------------------
// BourseTape — a horizontal ticker tape with mechanical feed physics. Quote
// chips sit in a single flex row (natural DOM widths, no fixed-width guess);
// one requestAnimationFrame loop writes `transform: translateX(-offset)` on
// the row directly (never React state on that hot path), incrementing offset
// by currentSpeed * dt every frame. currentSpeed itself eases toward a target
// (0 while hovered / focused-within / user-paused, else the base speed) with
// simple exponential smoothing — that lerp is what gives braking and resuming
// their inertia instead of an instant stop/start.
//
// New quotes are appended to the caller's `quotes` array; the component
// diffs against the previous length each render, adopts newly appended items
// into its own internally-tracked chip list, and marks the first adopted
// item with a 1px splice mark rendered as part of that same chip's DOM node
// (so it travels with the strip for free, no extra positioning logic).
// Chips that have fully scrolled past the left edge are pruned from state,
// with the same width subtracted from the running offset in the same frame
// so the prune is invisible.
//
// Each chip is a real, individually focusable, named element (a list of
// listitems, roving tabindex) — arrow keys move focus between them, and
// having focus inside the tape pauses the feed the same way hover does.
// prefers-reduced-motion drops the scroll entirely: the tape sits static,
// capped to the most recent N quotes, and a newly appended quote cross-fades
// into place instead of sliding in.
// ---------------------------------------------------------------------------

export interface Quote {
  id: string;
  symbol: string;
  price: number;
  changePct: number;
}

export interface BourseTapeProps {
  quotes: Quote[];
  /** Base feed speed in px/s. Default 46. */
  speed?: number;
  /** External pause control. Omit for internal state. */
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  className?: string;
}

const MAX_VISIBLE_REDUCED = 8;
const PRUNE_MARGIN = 40;
const EASE = 0.06;

function formatPrice(v: number) {
  return `$${v.toFixed(2)}`;
}

function formatPct(v: number) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function quoteLabel(q: Quote) {
  const dir = q.changePct >= 0 ? "up" : "down";
  return `${q.symbol} ${formatPrice(q.price)}, ${dir} ${Math.abs(q.changePct).toFixed(1)} percent`;
}

interface Chip extends Quote {
  chipId: string;
  spliced: boolean;
}

export function BourseTape({ quotes, speed = 46, paused: pausedProp, onPausedChange, className = "" }: BourseTapeProps) {
  const uid = useId().replace(/:/g, "");
  const trackRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const chipElRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const reducedRef = useRef(false);
  const hoveringRef = useRef(false);
  const focusedRef = useRef(false);
  const offsetRef = useRef(0);
  const currentSpeedRef = useRef(0);
  const lastTRef = useRef<number | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);

  const [chips, setChips] = useState<Chip[]>([]);
  const [internalPaused, setInternalPaused] = useState(false);
  const paused = pausedProp ?? internalPaused;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const prevLenRef = useRef(0);
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedRef.current = mq.matches;
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Adopt newly appended quotes into the internal chip list.
  useEffect(() => {
    if (quotes.length > prevLenRef.current) {
      const added = quotes.slice(prevLenRef.current);
      setChips((prev) => {
        const next: Chip[] = [
          ...prev,
          ...added.map((q, i) => ({ ...q, chipId: `${q.id}-${uid}`, spliced: i === 0 })),
        ];
        return reducedRef.current ? next.slice(-MAX_VISIBLE_REDUCED) : next;
      });
    }
    prevLenRef.current = quotes.length;
  }, [quotes, uid]);

  const setPaused = useCallback(
    (next: boolean) => {
      onPausedChange?.(next);
      if (pausedProp === undefined) setInternalPaused(next);
    },
    [onPausedChange, pausedProp]
  );

  // Main feed loop: eases current speed toward the active target, writes the
  // strip's transform directly, and prunes chips that have scrolled fully
  // off the left edge.
  useEffect(() => {
    if (reducedRef.current) return;

    const loop = (t: number) => {
      const dt = lastTRef.current === undefined ? 16 : Math.min(48, t - lastTRef.current);
      lastTRef.current = t;

      const stopped = pausedRef.current || hoveringRef.current || focusedRef.current;
      const target = stopped ? 0 : speed;
      currentSpeedRef.current += (target - currentSpeedRef.current) * EASE;
      if (Math.abs(currentSpeedRef.current) < 0.01 && target === 0) currentSpeedRef.current = 0;

      offsetRef.current += (currentSpeedRef.current * dt) / 1000;
      if (stripRef.current) stripRef.current.style.transform = `translateX(${-offsetRef.current}px)`;

      const track = trackRef.current;
      const first = chips[0];
      if (track && first) {
        const el = chipElRefs.current.get(first.chipId);
        if (el) {
          const trackRect = track.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          if (elRect.right < trackRect.left - PRUNE_MARGIN) {
            const width = elRect.width;
            offsetRef.current -= width;
            chipElRefs.current.delete(first.chipId);
            setChips((prev) => prev.slice(1));
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
      lastTRef.current = undefined;
    };
  }, [chips, speed]);

  // Focus is only ever moved as a direct, synchronous response to a real
  // keydown — never via an effect reacting to chips/focusIndex, which would
  // steal page focus the instant a new quote streams in.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (chips.length === 0) return;
    let next = focusIndex;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next = Math.min(chips.length - 1, focusIndex + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      next = Math.max(0, focusIndex - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      next = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      next = chips.length - 1;
    } else {
      return;
    }
    setFocusIndex(next);
    const chip = chips[next];
    if (chip) chipElRefs.current.get(chip.chipId)?.focus();
  };

  // Keep the roving index in bounds after a prune — a state update only,
  // never a focus call, so this can never steal focus on its own.
  useEffect(() => {
    setFocusIndex((i) => Math.min(i, Math.max(0, chips.length - 1)));
  }, [chips.length]);

  return (
    <div className={`relative ${className}`}>
      <style>{CSS}</style>
      <div className="flex items-center gap-3 rounded-[12px] border border-border bg-background p-2">
        <button
          type="button"
          aria-label={paused ? "Resume feed" : "Pause feed"}
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-border text-foreground hover:bg-border/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          {paused ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M1 0.5 L9 5 L1 9.5 Z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1" y="0.5" width="3" height="9" fill="currentColor" />
              <rect x="6" y="0.5" width="3" height="9" fill="currentColor" />
            </svg>
          )}
        </button>

        <div
          ref={trackRef}
          role="list"
          aria-label="Live quote feed"
          className="ns-tape-track relative h-9 flex-1 overflow-hidden"
          onPointerEnter={() => {
            hoveringRef.current = true;
          }}
          onPointerLeave={() => {
            hoveringRef.current = false;
          }}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) focusedRef.current = false;
          }}
          onKeyDown={onKeyDown}
        >
          <div ref={stripRef} className="ns-tape-strip flex h-full items-stretch" style={{ transform: "translateX(0px)" }}>
            {chips.map((chip, i) => (
              <div
                key={chip.chipId}
                ref={(el) => {
                  if (el) chipElRefs.current.set(chip.chipId, el);
                  else chipElRefs.current.delete(chip.chipId);
                }}
                role="listitem"
                tabIndex={i === focusIndex ? 0 : -1}
                aria-label={quoteLabel(chip)}
                className={`ns-tape-chip flex shrink-0 items-center gap-2 whitespace-nowrap border-r border-border px-3 font-mono text-xs ${
                  chip.spliced ? "ns-tape-spliced" : ""
                }`}
              >
                <span className="text-foreground">{chip.symbol}</span>
                <span className="tabular-nums text-ns-muted">{formatPrice(chip.price)}</span>
                <span
                  className="flex items-center gap-0.5 tabular-nums"
                  style={{ color: chip.changePct >= 0 ? "var(--success)" : "var(--error)" }}
                >
                  {chip.changePct >= 0 ? "▲" : "▼"}
                  {formatPct(chip.changePct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.ns-tape-strip{will-change:transform;}
.ns-tape-spliced{position:relative;}
.ns-tape-spliced::before{content:"";position:absolute;left:0;top:0;bottom:0;width:1px;background:var(--ns-accent);}
.ns-tape-chip{animation:none;}
@media (prefers-reduced-motion: reduce){
  .ns-tape-chip{animation:ns-tape-fade-in 260ms ease-out;}
}
@keyframes ns-tape-fade-in{from{opacity:0;}to{opacity:1;}}
`;
