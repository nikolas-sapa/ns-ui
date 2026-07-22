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
// exactly one pin: a small --foreground bar seated in the checked option's
// notch. Re-selecting lifts the pin out of its notch, carries it along a
// hairline rail past every intermediate option (ticking each notch as it
// passes), and drops it into the new notch with a short seat-and-settle
// overshoot. Distance traveled reads as how far apart the options are in
// the list — reorder the options and the pin's trip changes with them.
//
// MECHANISM: the pin is one absolutely-positioned element, driven in three
// phases via the Web Animations API against measured row centers (a
// ResizeObserver keeps those centers correct across re-layout): lift
// (4px translateX off the rail), travel (translateY eased through the
// distance, duration scales with how many rows are crossed), seat (drop
// back onto the rail with an 8%-of-distance overshoot past the target
// before settling). Passing an intermediate notch schedules a brief
// opacity/scale "tick" on that notch, timed proportionally to where the
// pin is along the travel phase. All transforms — no layout thrash, and
// nothing here fights the underlying DOM state.
//
// STRUCTURE: real native `<input type="radio">` per row, visually hidden
// but present and focusable — roving arrow keys, form participation, and
// checked-state announcements all come free from the browser, nothing is
// reimplemented. aria-checked is inherent to `<input type=radio>` and
// flips the instant the browser commits the change; the pin animation is
// a trailing, aria-hidden visual layer on top of that, never a gate on it.
// Each row is a full-width `<label>` (min 44px tall) so the hit area
// covers the whole row, not just the hidden input.
//
// Reduced motion: the pin's position updates with no animation — straight
// teleport to the new notch, still fully legible and functional.
//
// Pure DOM/CSS, no canvas. Ink is token-relative only: --foreground for
// the pin, --border for notches and the rail, --muted for resting label
// text, --accent solely for the keyboard focus ring.
//
// Distinct from fling-segment: fling-segment is a horizontal segmented
// control with a draggable, flingable pill and release-velocity physics.
// PinTumbler is a stacked vertical radio *list* — no dragging, selection
// only ever changes via click or native radio keyboard roving — whose
// indicator visibly commutes between the old and new row along a fixed
// rail, so the trip itself communicates list distance.
// ---------------------------------------------------------------------------

const LIFT_MS = 90;
const PER_ROW_MS = 65;
const MIN_TRAVEL_MS = 90;
const SEAT_MS = 200;
const TICK_MS = 220;
const OVERSHOOT_FRACTION = 0.08;

const PIN_W = 14;
const PIN_H = 6;
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
  const prevIndexRef = useRef(committedIndex);
  const [restIndex, setRestIndex] = useState(committedIndex);
  const animRef = useRef<Animation | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const [tickSet, setTickSet] = useState<Set<number>>(() => new Set());

  useLayoutEffect(() => {
    const prev = prevIndexRef.current;
    if (committedIndex === prev) return;
    prevIndexRef.current = committedIndex;

    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
    animRef.current?.cancel();
    animRef.current = null;
    setTickSet(new Set());

    const pin = pinRef.current;
    const fromY = rowOffsets[prev];
    const toY = rowOffsets[committedIndex];

    if (
      reducedMotion ||
      !pin ||
      typeof pin.animate !== "function" ||
      fromY === undefined ||
      toY === undefined
    ) {
      setRestIndex(committedIndex);
      return;
    }

    const dist = Math.abs(committedIndex - prev);
    const travelMs = Math.max(MIN_TRAVEL_MS, dist * PER_ROW_MS);
    const total = LIFT_MS + travelMs + SEAT_MS;
    const dy = toY - fromY;
    const overshootY = toY + dy * OVERSHOOT_FRACTION;

    const liftAt = LIFT_MS / total;
    const arriveAt = (LIFT_MS + travelMs) / total;
    const overshootAt = (LIFT_MS + travelMs + SEAT_MS * 0.65) / total;

    const anim = pin.animate(
      [
        {
          transform: `translate3d(0px, ${fromY}px, 0)`,
          offset: 0,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        },
        {
          transform: `translate3d(4px, ${fromY}px, 0)`,
          offset: liftAt,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        },
        {
          transform: `translate3d(4px, ${toY}px, 0)`,
          offset: arriveAt,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
        {
          transform: `translate3d(0px, ${overshootY.toFixed(2)}px, 0)`,
          offset: overshootAt,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
        { transform: `translate3d(0px, ${toY}px, 0)`, offset: 1 },
      ],
      { duration: total, fill: "forwards" }
    );
    animRef.current = anim;
    anim.onfinish = () => {
      setRestIndex(committedIndex);
      animRef.current?.cancel();
      animRef.current = null;
    };

    const dir = committedIndex > prev ? 1 : -1;
    for (let idx = prev + dir; idx !== committedIndex; idx += dir) {
      const frac = Math.abs(idx - prev) / dist;
      const t = LIFT_MS + frac * travelMs;
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
  }, [committedIndex, reducedMotion, rowOffsets]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      animRef.current?.cancel();
    };
  }, []);

  const measured = rowOffsets.length === options.length && options.length > 0;
  const railTop = measured ? rowOffsets[0] : 0;
  const railHeight = measured ? rowOffsets[rowOffsets.length - 1] - railTop : 0;
  const pinY = rowOffsets[restIndex] ?? 0;

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
            "--pt-pin-h": `${PIN_H}px`,
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
            transform: `translate3d(0px, ${pinY}px, 0)`,
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
          top: calc(-1 * var(--pt-pin-h) / 2);
          left: calc(var(--pt-rail-col) / 2 - var(--pt-pin-w) / 2);
          width: var(--pt-pin-w);
          height: var(--pt-pin-h);
          border-radius: 3px;
          background: var(--foreground);
          pointer-events: none;
          will-change: transform;
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
