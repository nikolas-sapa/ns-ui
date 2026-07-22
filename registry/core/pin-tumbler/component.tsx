"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// PinTumbler — a vertical radio group whose single choice is embodied by
// exactly one indicator: a short --foreground line sitting beside the
// checked option. Re-selecting slides that line to the new row, stretching
// toward it while it travels and settling back to its resting length once
// it arrives — a directional grow-then-settle, never a spring past the
// target. Distance traveled reads as how far apart the options are in the
// list — reorder the options and the trip's duration changes with them.
//
// MECHANISM: the line is one absolutely-positioned element whose `top` and
// `height` (not a scale transform) are driven via the Web Animations API
// against measured row centers (a ResizeObserver keeps those centers
// correct across re-layout): its leading edge eases straight to the new
// row's center while its trailing edge stays put, so the line visibly
// elongates across whatever sits between old and new; then, in a second
// phase, the trailing edge eases up to meet it, shrinking the line back to
// its resting length exactly where it stopped. Both phases use a single
// no-overshoot ease-out curve (control points never exceed the endpoint) —
// the line's edges move monotonically toward their targets and stop, they
// never overshoot past the destination and bounce back. Passing an
// intermediate notch schedules a brief opacity/scale "tick" on that notch,
// timed proportionally to where the line's leading edge is along the
// travel phase.
//
// STRUCTURE: real native `<input type="radio">` per row, visually hidden
// but present and focusable — roving arrow keys, form participation, and
// checked-state announcements all come free from the browser, nothing is
// reimplemented. aria-checked is inherent to `<input type=radio>` and
// flips the instant the browser commits the change; the line animation is
// a trailing, aria-hidden visual layer on top of that, never a gate on it.
// Each row is a full-width `<label>` (min 44px tall) so the hit area
// covers the whole row, not just the hidden input.
//
// Reduced motion: the line's position and length update with no animation —
// straight teleport to the new row, still fully legible and functional.
//
// Pure DOM/CSS, no canvas. Ink is token-relative only: --foreground for
// the line, --border for notches and the rail, --muted for resting label
// text, --accent solely for the keyboard focus ring.
//
// Distinct from fling-segment: fling-segment is a horizontal segmented
// control with a draggable, flingable pill and release-velocity physics.
// PinTumbler is a stacked vertical radio *list* — no dragging, selection
// only ever changes via click or native radio keyboard roving — whose
// indicator visibly commutes between the old and new row along a fixed
// rail, so the trip itself communicates list distance.
// ---------------------------------------------------------------------------

// Single no-overshoot ease-out: both control points' y stays at the 1.0
// endpoint, so the curve decelerates hard into its target and never swings
// past it — no spring, no bounce, on either the line's position or length.
const TRAVEL_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const PER_ROW_MS = 65;
const MIN_TRAVEL_MS = 90;
const SETTLE_MS = 160;
const TICK_MS = 220;

const PIN_W = 3;
const PIN_H = 16;
const RAIL_COL = 28;

export interface PinTumblerOption {
  /** Stable identifier, used as the native radio's value. */
  value: string;
  label: string;
  /** Optional secondary line, e.g. price or latency. */
  description?: string;
}

export interface PinTumblerProps {
  /** Accessible name for the radiogroup, e.g. "Shipping speed". */
  label: string;
  options: PinTumblerOption[];
  /** Controlled selected value. */
  value?: string;
  /** Initial value when uncontrolled. @default options[0]?.value */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shared `name` for the native radios. @default a generated id */
  name?: string;
  className?: string;
}

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

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

export function PinTumbler({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  className = "",
}: PinTumblerProps) {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(
    () => defaultValue ?? options[0]?.value ?? ""
  );
  const committed = isControlled ? (value as string) : internal;
  const committedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === committed)
  );

  const reducedMotion = useReducedMotion();

  const groupRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLLabelElement | null)[]>([]);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const [rowOffsets, setRowOffsets] = useState<number[]>([]);

  const measure = useCallback(() => {
    const group = groupRef.current;
    if (!group) return;
    const groupTop = group.getBoundingClientRect().top;
    const offsets = rowRefs.current.map((el) => {
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return r.top - groupTop + r.height / 2;
    });
    setRowOffsets(offsets);
  }, []);

  useLayoutEffect(() => {
    measure();
    // options.length affects row count; re-measure when it changes.
  }, [measure, options.length]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(group);
    return () => ro.disconnect();
  }, [measure]);

  const commit = useCallback(
    (v: string) => {
      if (!isControlled) setInternal(v);
      if (v !== committed) onValueChange?.(v);
    },
    [isControlled, committed, onValueChange]
  );

  // --- pin animation ---------------------------------------------------
  // `restIndex` is the single source of truth for "where the pin is
  // actually rendered right now" — it only ever advances in `onfinish`,
  // i.e. once a travel has genuinely completed. Deriving `prev` from it
  // (rather than a separately-tracked ref updated eagerly at effect start)
  // matters the moment a row is re-selected before the in-flight travel
  // finishes: cancelling the live Animation reverts the element to its
  // underlying inline style, which is exactly `rowOffsets[restIndex]` —
  // so the next leg's start keyframe is guaranteed to match what's on
  // screen at that instant. An eagerly-updated ref would already point at
  // the (unfinished) target, so the new leg would start its first
  // keyframe from a row the pin never actually reached, and the browser
  // renders that as an instant teleport before reversing back toward the
  // real new target — visible as a jarring step mid-glide on fast
  // re-selection (rapid clicks or held arrow-key roving).
  const [restIndex, setRestIndex] = useState(committedIndex);
  const animRef = useRef<Animation | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const [tickSet, setTickSet] = useState<Set<number>>(() => new Set());

  useLayoutEffect(() => {
    const prev = restIndex;
    if (committedIndex === prev) return;

    const pin = pinRef.current;
    const fromCenterY = rowOffsets[prev];
    const toCenterY = rowOffsets[committedIndex];

    // Start the new leg from the line's LIVE on-screen box — read its
    // computed `top`/`height` *before* cancelling the in-flight animation.
    // cancel() reverts the element to its inline style (rowOffsets[restIndex]
    // at the resting PIN_H), but restIndex still points at the row this
    // travel started from (it only advances in onfinish), so seeding the new
    // leg from rowOffsets[prev]'s resting box on every re-selection would
    // snap the line back to fully-rested even mid-stretch — a visible jump.
    // Reading getComputedStyle first lets the interrupt leg begin from
    // whatever box the line actually is right now, mid-stretch or at rest.
    let fromTop =
      fromCenterY !== undefined ? fromCenterY - PIN_H / 2 : undefined;
    let fromHeight = PIN_H;
    if (pin && animRef.current) {
      const cs = getComputedStyle(pin);
      const liveTop = parseFloat(cs.top);
      const liveHeight = parseFloat(cs.height);
      if (!Number.isNaN(liveTop) && !Number.isNaN(liveHeight)) {
        fromTop = liveTop;
        fromHeight = liveHeight;
      }
    }

    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
    animRef.current?.cancel();
    animRef.current = null;
    setTickSet(new Set());

    if (
      reducedMotion ||
      !pin ||
      typeof pin.animate !== "function" ||
      fromTop === undefined ||
      fromCenterY === undefined ||
      toCenterY === undefined
    ) {
      setRestIndex(committedIndex);
      return;
    }

    const toTop = toCenterY - PIN_H / 2;
    // The line's leading edge reaches the destination first; its trailing
    // edge stays anchored at the far end of [fromCenterY, toCenterY] until
    // the settle phase catches it up. That single box — spanning exactly the
    // two row centers plus the line's own half-caps — is what "the line
    // stretches toward where it's going" means geometrically. No keyframe
    // here ever positions an edge past its own destination, so there is
    // nothing to bounce back from.
    const bridgeTop = Math.min(fromCenterY, toCenterY) - PIN_H / 2;
    const bridgeHeight = Math.abs(toCenterY - fromCenterY) + PIN_H;

    const dist = Math.abs(committedIndex - prev);
    const travelMs = Math.max(MIN_TRAVEL_MS, dist * PER_ROW_MS);
    const total = travelMs + SETTLE_MS;
    const arriveAt = travelMs / total;

    const anim = pin.animate(
      [
        {
          top: `${fromTop}px`,
          height: `${fromHeight}px`,
          offset: 0,
          easing: TRAVEL_EASE,
        },
        {
          top: `${bridgeTop}px`,
          height: `${bridgeHeight}px`,
          offset: arriveAt,
          easing: TRAVEL_EASE,
        },
        { top: `${toTop}px`, height: `${PIN_H}px`, offset: 1 },
      ],
      { duration: total, fill: "forwards" }
    );
    animRef.current = anim;
    anim.onfinish = () => {
      // Deliberately not cancelling here: the animation's `fill: "forwards"`
      // holds the exact final keyframe (the resting box at `toTop`/`PIN_H`),
      // which is the same value `restIndex` now resolves to via the resting
      // inline style. Cancelling immediately would strip the animation's
      // held effect before this `setRestIndex` has actually re-rendered,
      // snapping the element back to the *previous* underlying style for one
      // frame — a visible flash/step right at the end of every single
      // travel. Leaving the finished animation in place keeps the on-screen
      // value continuous; it's reclaimed for free by the
      // `animRef.current?.cancel()` at the top of this effect the next time
      // a travel actually starts.
      setRestIndex(committedIndex);
    };

    const dir = committedIndex > prev ? 1 : -1;
    for (let idx = prev + dir; idx !== committedIndex; idx += dir) {
      const frac = Math.abs(idx - prev) / dist;
      const t = frac * travelMs;
      const onId = window.setTimeout(() => {
        setTickSet((s) => new Set(s).add(idx));
      }, t);
      const offId = window.setTimeout(() => {
        setTickSet((s) => {
          if (!s.has(idx)) return s;
          const next = new Set(s);
          next.delete(idx);
          return next;
        });
      }, t + TICK_MS);
      timeoutsRef.current.push(onId, offId);
    }
    // `restIndex` is read (as `prev`) above; adding it here is safe — once
    // `onfinish` advances it to `committedIndex`, this effect reruns, sees
    // `committedIndex === prev`, and bails on the very first line.
  }, [committedIndex, reducedMotion, rowOffsets, restIndex]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      animRef.current?.cancel();
    };
  }, []);

  const measured = rowOffsets.length === options.length && options.length > 0;
  const railTop = measured ? rowOffsets[0] : 0;
  const railHeight = measured ? rowOffsets[rowOffsets.length - 1] - railTop : 0;
  const pinTop = (rowOffsets[restIndex] ?? 0) - PIN_H / 2;

  return (
    <div className={`ns-pt-wrap ${className}`}>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={label}
        data-reduced={reducedMotion || undefined}
        className="ns-pt-group"
        style={
          {
            "--pt-rail-col": `${RAIL_COL}px`,
            "--pt-pin-w": `${PIN_W}px`,
          } as Vars
        }
      >
        {options.length > 1 && (
          <div
            aria-hidden="true"
            className="ns-pt-rail"
            style={{
              top: railTop,
              height: Math.max(0, railHeight),
              opacity: measured ? 1 : 0,
            }}
          />
        )}

        {options.map((opt, i) => (
          <label
            key={opt.value}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            className="ns-pt-row"
          >
            <input
              type="radio"
              className="ns-pt-input"
              name={groupName}
              value={opt.value}
              checked={i === committedIndex}
              onChange={() => commit(opt.value)}
            />
            <span className="ns-pt-visual">
              <span className="ns-pt-rail-col">
                <span
                  className="ns-pt-notch"
                  data-ticking={tickSet.has(i) || undefined}
                />
              </span>
              <span className="ns-pt-text">
                <span className="ns-pt-label-text" data-checked={i === committedIndex || undefined}>
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="ns-pt-desc">{opt.description}</span>
                )}
              </span>
            </span>
          </label>
        ))}

        <div
          ref={pinRef}
          aria-hidden="true"
          className="ns-pt-pin"
          style={{
            top: pinTop,
            height: PIN_H,
            opacity: measured ? 1 : 0,
          }}
        />
      </div>

      <style>{`
        .ns-pt-wrap {
          display: block;
        }
        .ns-pt-group {
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .ns-pt-rail {
          position: absolute;
          left: calc(var(--pt-rail-col) / 2 - 0.5px);
          width: 1px;
          background: var(--border);
          pointer-events: none;
        }
        .ns-pt-row {
          position: relative;
          display: block;
          min-height: 44px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .ns-pt-input {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
          outline: none;
        }
        .ns-pt-visual {
          display: flex;
          align-items: center;
          gap: 4px;
          min-height: 44px;
          padding: 6px 12px 6px 0;
          border-radius: 8px;
          transition: background-color 140ms ease;
        }
        .ns-pt-row:hover .ns-pt-visual {
          background: color-mix(in oklab, var(--foreground) 4%, transparent);
        }
        .ns-pt-input:focus-visible + .ns-pt-visual {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .ns-pt-rail-col {
          flex: 0 0 var(--pt-rail-col);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ns-pt-notch {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          border: 1px solid var(--border);
          box-sizing: border-box;
          transform: scale(1);
          transition: transform 160ms ease, border-color 160ms ease;
        }
        .ns-pt-notch[data-ticking] {
          border-color: var(--foreground);
          transform: scale(1.35);
        }
        .ns-pt-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }
        .ns-pt-label-text {
          font-size: 0.875rem;
          color: var(--muted);
          transition: color 160ms ease;
        }
        .ns-pt-label-text[data-checked] {
          color: var(--foreground);
          font-weight: 500;
        }
        .ns-pt-desc {
          font-size: 0.75rem;
          color: var(--muted);
        }
        .ns-pt-pin {
          position: absolute;
          left: calc(var(--pt-rail-col) / 2 - var(--pt-pin-w) / 2);
          width: var(--pt-pin-w);
          border-radius: 9999px;
          background: var(--foreground);
          pointer-events: none;
        }

        .ns-pt-group[data-reduced] .ns-pt-notch,
        .ns-pt-group[data-reduced] .ns-pt-label-text {
          transition: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .ns-pt-notch,
          .ns-pt-label-text,
          .ns-pt-visual {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
