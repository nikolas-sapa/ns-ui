"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// ChopPress — a rating / level input rendered as a row of seal impressions.
// Chosen levels are stamped solid with a short physical "thud" (scale
// 1.15 -> 1.0, ease-out-expo) while a single concentric ring in --border
// expands and fades outward, reading as paper taking the impression.
// Unfilled levels wait as faint --ns-muted outlines. Lowering the value drains
// marks right-to-left with a 30ms stagger, as if the ink is lifting off in
// sequence. Hovering (or focusing) a level dashes the outline of whichever
// marks would change if you committed there, without committing anything.
//
// Real ARIA radiogroup semantics underneath: one role="radio" per level,
// only the committed level's radio is aria-checked, roving tabindex, arrow
// keys move AND commit (Home/End jump to the ends), and each radio's
// accessible name reads "N of M" plus an optional word ("3 of 5 - High").
// The stamp is a purely visual layer on top — nothing here depends on a
// screen reader ever seeing the seal glyph. Reduced motion: stamps land and
// drain instantly, no scale/ring/stagger.
//
// Pure DOM/SVG/CSS — no canvas. All ink is token-relative: --foreground for
// the stamp body, --ns-muted for resting outlines, --border for the impression
// ring, --ns-accent only for the keyboard focus ring.
// ---------------------------------------------------------------------------

const PRESS_MS = 140; // press-landing scale, ease-out-expo
const RING_MS = 380; // impression ring expand + fade
const PRESS_FILL_MS = 90; // ink appears fast — a thud, not a fade-in
const DRAIN_FILL_MS = 170; // ink lifts gradually
const STAGGER_MS = 30; // per-mark delay, both directions

const SIZE_PX = { sm: 26, md: 34, lg: 42 } as const;

type Kind = "press" | "drain";

export interface ChopPressProps {
  /** Accessible name for the radiogroup, e.g. "Priority". */
  label: string;
  /** Number of levels. @default 5 */
  max?: number;
  /** Controlled value, 0..max. 0 = nothing stamped yet. */
  value?: number;
  /** Initial value when uncontrolled. @default 0 */
  defaultValue?: number;
  /** Fires on commit — click, or an arrow/Home/End key move. Never on hover. */
  onValueChange?: (value: number) => void;
  /**
   * Optional word per level (index 0 = level 1), appended to that level's
   * accessible name — e.g. `["Low", "", "", "", "Critical"]` reads level 5
   * as "5 of 5 - Critical". Sparse arrays are fine, empty entries are
   * skipped.
   */
  levelNames?: string[];
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

function clampLevel(v: number, max: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(max, Math.max(0, Math.round(v)));
}

// Deterministic per-index variation (rotation + corner radius) so seals read
// as individually struck rather than one glyph rubber-stamped M times.
// Seeded off the index only — identical across renders and between the two
// themes.
function sealVariant(i: number) {
  const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  const frac = s - Math.floor(s);
  return {
    rotate: (frac - 0.5) * 5, // -2.5..2.5deg
    rx: 3.2 + frac * 1.8, // 3.2..5 corner radius, viewBox units
  };
}

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

export function ChopPress({
  label,
  max = 5,
  value,
  defaultValue = 0,
  onValueChange,
  levelNames,
  size = "md",
  className = "",
}: ChopPressProps) {
  const M = Math.max(1, Math.floor(max));
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => clampLevel(defaultValue, M));
  const committed = clampLevel(isControlled ? (value as number) : internal, M);

  const reducedMotion = useReducedMotion();
  const prevRef = useRef(committed);
  const [batch, setBatch] = useState(0);
  const [transitions, setTransitions] = useState<
    Map<number, { kind: Kind; delay: number }>
  >(new Map());
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const groupId = useId();

  // Runs before paint whenever the committed value changes, whichever path
  // caused it (click, arrow key, or a controlled prop update from outside).
  // Building the transition map here — not inside the click handler — means
  // both paths animate identically and there's no one-frame flash of the
  // final state before the animation classes attach.
  useLayoutEffect(() => {
    const prev = prevRef.current;
    if (committed !== prev) {
      if (reducedMotion) {
        setTransitions(new Map());
      } else {
        const map = new Map<number, { kind: Kind; delay: number }>();
        if (committed > prev) {
          for (let i = prev; i < committed; i++) {
            map.set(i, { kind: "press", delay: (i - prev) * STAGGER_MS });
          }
        } else {
          for (let i = committed; i < prev; i++) {
            // right-to-left: the highest index (rightmost) drains first.
            map.set(i, { kind: "drain", delay: (prev - 1 - i) * STAGGER_MS });
          }
        }
        setTransitions(map);
        setBatch((b) => b + 1);
      }
      prevRef.current = committed;
    }
  }, [committed, reducedMotion]);

  const commit = useCallback(
    (next: number) => {
      const clamped = clampLevel(next, M);
      if (!isControlled) setInternal(clamped);
      if (clamped !== committed) onValueChange?.(clamped);
    },
    [M, isControlled, committed, onValueChange]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      next = Math.min(M, Math.max(1, committed + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      next = Math.max(1, committed - 1);
    } else if (e.key === "Home") {
      next = 1;
    } else if (e.key === "End") {
      next = M;
    } else {
      return;
    }
    e.preventDefault();
    commit(next);
    btnRefs.current[next - 1]?.focus();
  };

  const levels = useMemo(() => Array.from({ length: M }, (_, i) => i), [M]);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      data-reduced={reducedMotion || undefined}
      className={`ns-cp-group ${className}`}
      style={{ ["--cp-size"]: `${SIZE_PX[size]}px` } as Vars}
    >
      {levels.map((i) => {
        const filled = i < committed;
        const previewTarget = hoverIndex !== null ? i <= hoverIndex : filled;
        const previewing = hoverIndex !== null && previewTarget !== filled;
        const checked = i === committed - 1;
        const t = transitions.get(i);
        const variant = sealVariant(i);
        const level = i + 1;
        const name = levelNames?.[i];
        const ariaLabel = `${level} of ${M}${name ? ` - ${name}` : ""}`;
        const tabbable = committed === 0 ? i === 0 : i === committed - 1;
        const fillMs = t?.kind === "drain" ? DRAIN_FILL_MS : PRESS_FILL_MS;

        return (
          <button
            key={i}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={ariaLabel}
            id={`${groupId}-${i}`}
            tabIndex={tabbable ? 0 : -1}
            data-transition={t?.kind}
            className="ns-cp-seal"
            style={
              {
                "--cp-delay": `${t?.delay ?? 0}ms`,
                "--cp-fill-ms": `${fillMs}ms`,
              } as Vars
            }
            onClick={() => commit(level)}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex((h) => (h === i ? null : h))}
            onFocus={() => setHoverIndex(i)}
            onBlur={() => setHoverIndex((h) => (h === i ? null : h))}
          >
            <svg
              viewBox="0 0 32 32"
              aria-hidden="true"
              focusable="false"
              className="ns-cp-glyph"
              style={{ transform: `rotate(${variant.rotate.toFixed(2)}deg)` }}
            >
              <rect
                x={3}
                y={3}
                width={26}
                height={26}
                rx={variant.rx}
                className="ns-cp-base"
                data-filled={filled || undefined}
                data-preview={previewing || undefined}
              />
              <path
                d={`M 6 ${(6 + variant.rx).toFixed(1)} L 6 6 L ${(6 + variant.rx).toFixed(1)} 6`}
                className="ns-cp-edge-hi"
                data-filled={filled || undefined}
              />
              <path
                d={`M ${(26 - variant.rx).toFixed(1)} 26 L 26 26 L 26 ${(26 - variant.rx).toFixed(1)}`}
                className="ns-cp-edge-lo"
                data-filled={filled || undefined}
              />
            </svg>
            {t?.kind === "press" && (
              <span key={`ring-${batch}-${i}`} className="ns-cp-ring" aria-hidden="true" />
            )}
          </button>
        );
      })}

      <style>{`
        .ns-cp-group {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .ns-cp-seal {
          position: relative;
          width: var(--cp-size, 34px);
          height: var(--cp-size, 34px);
          padding: 0;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: inherit;
          cursor: pointer;
          display: grid;
          place-items: center;
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }
        .ns-cp-seal:hover {
          background: color-mix(in oklab, var(--foreground) 4%, transparent);
        }
        .ns-cp-seal:focus-visible {
          outline: 2px solid var(--ns-accent);
          outline-offset: 2px;
        }
        .ns-cp-glyph {
          width: 68%;
          height: 68%;
          overflow: visible;
        }
        .ns-cp-base {
          /* fill is always --foreground; only fill-opacity animates. a
             color <-> "none" transition is a discrete 50% flip in every
             engine, not an interpolation — fill-opacity is a plain number
             and always interpolates smoothly. */
          fill: var(--foreground);
          fill-opacity: 0;
          stroke: var(--ns-muted);
          stroke-width: 1.5px;
          transition:
            fill-opacity var(--cp-fill-ms, 140ms) ease var(--cp-delay, 0ms),
            stroke 140ms ease var(--cp-delay, 0ms),
            stroke-dasharray 120ms ease;
        }
        .ns-cp-base[data-filled] {
          fill-opacity: 1;
          stroke-opacity: 0.4;
        }
        .ns-cp-base[data-preview] {
          stroke-dasharray: 3 2.5;
          stroke: color-mix(in oklab, var(--foreground) 55%, var(--ns-muted));
        }
        .ns-cp-edge-hi,
        .ns-cp-edge-lo {
          fill: none;
          stroke-width: 1px;
          opacity: 0;
          transition: opacity var(--cp-fill-ms, 140ms) ease var(--cp-delay, 0ms);
        }
        .ns-cp-edge-hi[data-filled],
        .ns-cp-edge-lo[data-filled] {
          opacity: 1;
        }
        .ns-cp-edge-hi {
          stroke: color-mix(in oklab, var(--background) 45%, transparent);
        }
        .ns-cp-edge-lo {
          stroke: var(--border);
        }

        .ns-cp-seal[data-transition="press"] {
          animation: ns-cp-press ${PRESS_MS}ms cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: var(--cp-delay, 0ms);
        }

        .ns-cp-ring {
          position: absolute;
          inset: 2px;
          border-radius: 6px;
          border: 1px solid var(--border);
          pointer-events: none;
          opacity: 0.9;
          transform: scale(0.85);
          animation: ns-cp-ring ${RING_MS}ms ease-out both;
          animation-delay: var(--cp-delay, 0ms);
        }

        @keyframes ns-cp-press {
          from { transform: scale(1.15); }
          to { transform: scale(1); }
        }
        @keyframes ns-cp-ring {
          from { opacity: 0.9; transform: scale(0.9); }
          to { opacity: 0; transform: scale(1.6); }
        }

        .ns-cp-group[data-reduced] .ns-cp-base,
        .ns-cp-group[data-reduced] .ns-cp-edge-hi,
        .ns-cp-group[data-reduced] .ns-cp-edge-lo {
          transition: none;
        }
        .ns-cp-group[data-reduced] .ns-cp-seal[data-transition],
        .ns-cp-group[data-reduced] .ns-cp-ring {
          animation: none;
          display: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .ns-cp-base,
          .ns-cp-edge-hi,
          .ns-cp-edge-lo {
            transition: none;
          }
          .ns-cp-seal[data-transition],
          .ns-cp-ring {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
