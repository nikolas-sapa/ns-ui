"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// NibCheck — a checkbox (and tri-state parent) whose mark is inked on by a
// variable-width calligraphic stroke: thin entry, a thick corner flick, and a
// hair of overshoot past the natural tip. The three states — unchecked,
// checked, indeterminate — read as three distinct pen gestures rather than a
// check, a smaller check, and a minus.
//
// GEOMETRY: the check is one filled ribbon path built once at module scope by
// offsetting a hand-placed spine polyline with a per-point half-width (thin
// at the entry, widest right at the corner, tapering through the flick to a
// hairline overshoot tip) — see buildRibbon. Interior normals average their
// two adjacent segment normals, so the sharp direction change at the corner
// naturally bulges on the convex side and pinches on the concave one, like
// ink pooling as a pen changes direction. Indeterminate draws a separate,
// simpler fat rounded dash — not a shrunk-down check.
//
// REVEAL: both ink shapes sit under a left-anchored CSS clip-path (inset,
// fill-box) that transitions from fully clipped to fully revealed over
// ~220ms ease-out-expo, reading as ink drawn left-to-right: entry, corner,
// tip. Unchecking reverses the same clip back toward the entry edge — ink
// retracts — and a small dot at the entry point pops in and fades once
// retraction finishes. The box's own corner radius relaxes 2px on check, with
// a small imperative class-toggle "pop" (restarted without remounting, so
// focus never moves) standing in for the flick's ~4% overshoot.
//
// A11Y: a real input[type=checkbox] carries checked/indeterminate/disabled
// and all native keyboard + AT semantics; it is visually hidden (opacity: 0,
// sized to cover the box) but stays in the tab order and keeps focus — never
// aria-hidden. The SVG ink is aria-hidden. Colors: ink is --foreground, the
// box border is --border; --ns-accent appears only in the focus ring.
// prefers-reduced-motion disables every transition/animation here, so the
// final ink for the current state is simply present or absent, instantly.
// ---------------------------------------------------------------------------

type Pt = readonly [number, number];

function normalize(v: Pt): Pt {
  const len = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / len, v[1] / len];
}

// rotate a direction vector 90 degrees (SVG's y-down space)
function perp(v: Pt): Pt {
  return [-v[1], v[0]];
}

/**
 * Offsets a spine polyline by a per-point half-width to build a closed,
 * filled ribbon outline — the calligraphic nib's variable-width stroke.
 */
function buildRibbon(spine: Pt[], halfWidth: number[]): string {
  const n = spine.length;
  const segNormals: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = spine[i + 1]![0] - spine[i]![0];
    const dy = spine[i + 1]![1] - spine[i]![1];
    segNormals.push(normalize(perp([dx, dy])));
  }
  const ptNormals: Pt[] = spine.map((_, i) => {
    if (i === 0) return segNormals[0]!;
    if (i === n - 1) return segNormals[n - 2]!;
    const a = segNormals[i - 1]!;
    const b = segNormals[i]!;
    return normalize([a[0] + b[0], a[1] + b[1]]);
  });

  const left = spine.map((p, i) => [
    p[0] + ptNormals[i]![0] * halfWidth[i]!,
    p[1] + ptNormals[i]![1] * halfWidth[i]!,
  ]);
  const right = spine.map((p, i) => [
    p[0] - ptNormals[i]![0] * halfWidth[i]!,
    p[1] - ptNormals[i]![1] * halfWidth[i]!,
  ]);

  const fmt = (p: number[]) => `${p[0]!.toFixed(2)},${p[1]!.toFixed(2)}`;
  let d = `M${fmt(left[0]!)}`;
  for (let i = 1; i < n; i++) d += ` L${fmt(left[i]!)}`;
  for (let i = n - 1; i >= 0; i--) d += ` L${fmt(right[i]!)}`;
  return `${d} Z`;
}

// spine: entry (bottom-left, thin) -> corner (thick flick) -> tip, with a
// small overshoot past the corner's natural stopping point at the very end
const SPINE: Pt[] = [
  [4, 12.4],
  [7.6, 15.6],
  [9.7, 18],
  [12.3, 15.1],
  [15.2, 11.5],
  [18.1, 8],
  [19.7, 6.1],
];
const HALF_WIDTH = [0.55, 1.05, 1.7, 1.55, 1.15, 0.7, 0.35];
const CHECK_PATH = buildRibbon(SPINE, HALF_WIDTH);
const ENTRY: Pt = SPINE[0]!;

// indeterminate: a single fat rounded dash, not a shrunk checkmark
const DASH = { x: 6, y: 10.6, width: 12, height: 2.8, rx: 1.4 };

export type NibCheckValue = boolean | "indeterminate";

export interface NibCheckProps {
  /** controlled value; omit for uncontrolled. "indeterminate" is visual/AT only — the underlying value is boolean */
  checked?: NibCheckValue;
  /** initial value when uncontrolled. Default false. */
  defaultChecked?: NibCheckValue;
  /** called with the resolved boolean after a toggle; never fires "indeterminate" */
  onCheckedChange?: (checked: boolean) => void;
  /** blocks the input and mutes the box; the label cursor becomes not-allowed */
  disabled?: boolean;
  /** visible label; also becomes the accessible name via native label association */
  label?: ReactNode;
  /** id for the underlying `<input type="checkbox">`. Auto-generated when omitted. */
  id?: string;
  /** name for the underlying `<input>`, for native form submission */
  name?: string;
  /** value for the underlying `<input>`, for native form submission */
  value?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
  /** accessible name for the input, used only when `label` is omitted */
  "aria-label"?: string;
}

export function NibCheck({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  label,
  id,
  name,
  value,
  className = "",
  "aria-label": ariaLabel,
}: NibCheckProps) {
  const autoId = useId();
  const inputId = id ?? `checkbox-ink-stroke-${autoId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLSpanElement>(null);
  const reducedRef = useRef(false);

  const isControlled = checked !== undefined;
  const [internal, setInternal] = useState<NibCheckValue>(defaultChecked);
  const current = isControlled ? checked! : internal;
  const state: "checked" | "unchecked" | "indeterminate" =
    current === "indeterminate" ? "indeterminate" : current ? "checked" : "unchecked";

  const [dotTick, setDotTick] = useState(0);
  const [showDot, setShowDot] = useState(false);
  const prevStateRef = useRef(state);

  useEffect(() => {
    reducedRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  // native indeterminate is a DOM property, not an attribute
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = state === "indeterminate";
  }, [state]);

  // fading entry dot only when ink actually retracts (checked/indeterminate -> unchecked)
  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev !== "unchecked" && state === "unchecked" && !reducedRef.current) {
      setDotTick((t) => t + 1);
      setShowDot(true);
    }
    prevStateRef.current = state;
  }, [state]);

  // restart the box's small settle-pop each time the check lands — an
  // imperative class-toggle restart, not a remount, so the input never loses focus
  useEffect(() => {
    const el = boxRef.current;
    if (!el || reducedRef.current || state !== "checked") return;
    el.classList.remove("ns-nib-pop");
    void el.offsetWidth;
    el.classList.add("ns-nib-pop");
  }, [state]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.checked;
    if (!isControlled) setInternal(next);
    onCheckedChange?.(next);
  };

  return (
    <label
      htmlFor={label ? inputId : undefined}
      className={`inline-flex items-center gap-2.5 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      <style>{`
        .ns-nib-box {
          transition: border-radius 200ms cubic-bezier(.16,1,.3,1), border-color 150ms cubic-bezier(.16,1,.3,1);
        }
        .ns-nib-ink {
          clip-path: inset(0 100% 0 0) fill-box;
          transition: clip-path 220ms cubic-bezier(.16,1,.3,1);
        }
        [data-state="checked"] .ns-nib-ink-check,
        [data-state="indeterminate"] .ns-nib-ink-dash {
          clip-path: inset(0 0 0 0) fill-box;
        }
        [data-state="checked"] .ns-nib-box {
          border-radius: 6px;
        }
        .ns-nib-dot {
          animation: ns-nib-dot-fade 320ms cubic-bezier(.16,1,.3,1) forwards;
        }
        @keyframes ns-nib-dot-fade {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        .ns-nib-pop {
          animation: ns-nib-pop-settle 220ms cubic-bezier(.34,1.4,.64,1);
        }
        @keyframes ns-nib-pop-settle {
          0% { transform: scale(1); }
          55% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ns-nib-box, .ns-nib-ink { transition: none !important; }
          .ns-nib-dot, .ns-nib-pop { animation: none !important; }
        }
      `}</style>
      <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
        <input
          ref={inputRef}
          type="checkbox"
          id={inputId}
          name={name}
          value={value}
          checked={current === true}
          disabled={disabled}
          onChange={handleChange}
          aria-label={label ? undefined : ariaLabel ?? "Checkbox"}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
        />
        <span
          ref={boxRef}
          data-state={state}
          aria-hidden
          className={`ns-nib-box pointer-events-none absolute inset-0 rounded-[4px] border border-border peer-hover:border-foreground/30 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ns-accent ${
            disabled ? "opacity-40" : ""
          }`}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="pointer-events-none absolute inset-0 h-full w-full text-foreground"
          >
            <path
              d={CHECK_PATH}
              data-nib-ink="check"
              className="ns-nib-ink ns-nib-ink-check fill-current"
            />
            <rect
              x={DASH.x}
              y={DASH.y}
              width={DASH.width}
              height={DASH.height}
              rx={DASH.rx}
              data-nib-ink="dash"
              className="ns-nib-ink ns-nib-ink-dash fill-current"
            />
            {showDot && (
              <circle
                key={dotTick}
                cx={ENTRY[0]}
                cy={ENTRY[1]}
                r={1.15}
                className="ns-nib-dot fill-current"
                onAnimationEnd={() => setShowDot(false)}
              />
            )}
          </svg>
        </span>
      </span>
      {label && (
        <span className={`text-sm text-foreground ${disabled ? "opacity-40" : ""}`}>
          {label}
        </span>
      )}
    </label>
  );
}
