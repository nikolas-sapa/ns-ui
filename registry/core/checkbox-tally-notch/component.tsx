"use client";

import { useMemo, useRef, useState } from "react";

// Checkbox group rendered as a carpenter's tally: each check carves a notch
// stroke into the row and adds a stroke to an aggregate tally cluster, where
// every fifth stroke slashes diagonally across its group of four. Strokes
// draw on with a dashoffset sweep and retract on uncheck; per-stroke jitter
// is seeded by index so the carving looks hand-cut but renders identically
// every mount. Pure DOM+SVG, tokens only, reduced-motion snaps instantly.

export interface TallyNotchItem {
  id: string;
  label: string;
  hint?: string;
}

export interface TallyNotchProps {
  items: TallyNotchItem[];
  defaultChecked?: string[];
  onChange?: (checkedIds: string[]) => void;
  /** heading shown above the group; also the group's accessible name */
  label?: string;
  className?: string;
}

// deterministic per-index jitter — mulberry32, so screenshots are stable
function jitter(i: number) {
  let t = (i + 1) * 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return r * 2 - 1; // -1..1
}

// delay folded into the shorthand itself, not a separate transitionDelay
// longhand — mixing transition (shorthand) and transitionDelay (longhand)
// for the same property gives React two owners for one CSS value and it
// warns (and can genuinely race) on rerender.
const STROKE_STYLE = (drawn: boolean, reduced: boolean, delayMs = 0) =>
  ({
    strokeDasharray: 1,
    strokeDashoffset: drawn ? 0 : 1,
    transition: reduced
      ? "none"
      : `stroke-dashoffset 260ms ${drawn ? "cubic-bezier(0.22, 1, 0.36, 1)" : "cubic-bezier(0.55, 0, 0.55, 0.2)"} ${delayMs}ms`,
  }) as const;

function TallyCluster({
  count,
  max,
  reduced,
}: {
  count: number;
  max: number;
  reduced: boolean;
}) {
  const groups = Math.ceil(max / 5);
  const GW = 30; // group width
  const H = 26;
  const paths = useMemo(() => {
    const out: { d: string; idx: number }[] = [];
    for (let i = 0; i < max; i++) {
      const g = Math.floor(i / 5);
      const k = i % 5;
      const gx = g * (GW + 10);
      if (k < 4) {
        // vertical stroke with seeded lean and length variance
        const x = gx + 4 + k * 6 + jitter(i) * 1.2;
        const lean = jitter(i * 7 + 3) * 1.8;
        const top = 3 + jitter(i * 13 + 5) * 1.4;
        out.push({ d: `M ${x + lean} ${top} L ${x - lean} ${H - 3}`, idx: i });
      } else {
        // the fifth: a diagonal slash across the group of four
        const y1 = 6 + jitter(i) * 1.5;
        const y2 = H - 6 + jitter(i * 3) * 1.5;
        out.push({ d: `M ${gx - 1} ${y1} L ${gx + 23} ${y2}`, idx: i });
      }
    }
    return out;
  }, [max]);

  return (
    <svg
      aria-hidden
      width={groups * (GW + 10) - 10}
      height={H}
      viewBox={`0 0 ${groups * (GW + 10) - 10} ${H}`}
      className="overflow-visible"
    >
      {paths.map((p) => (
        <path
          key={p.idx}
          d={p.d}
          pathLength={1}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={p.idx % 5 === 4 ? 2 : 1.75}
          strokeLinecap="round"
          // later strokes draw a beat after earlier ones when several
          // arrive at once (e.g. defaultChecked mount)
          style={STROKE_STYLE(p.idx < count, reduced, reduced ? 0 : (p.idx % 5) * 30)}
        />
      ))}
    </svg>
  );
}

function NotchMark({ checked, reduced }: { checked: boolean; reduced: boolean }) {
  return (
    <svg aria-hidden width={20} height={20} viewBox="0 0 20 20" className="shrink-0">
      <rect
        x={1.5}
        y={1.5}
        width={17}
        height={17}
        rx={4}
        fill="none"
        stroke={checked ? "var(--foreground)" : "var(--border)"}
        strokeWidth={1.5}
        style={{ transition: reduced ? "none" : "stroke 200ms ease" }}
      />
      {/* two-cut carved notch: down-stroke lands, then the long up-stroke */}
      <path
        d="M 5.5 10.5 L 8.5 13.8"
        pathLength={1}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={2}
        strokeLinecap="round"
        style={STROKE_STYLE(checked, reduced)}
      />
      <path
        d="M 8.5 13.8 L 14.5 5.8"
        pathLength={1}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth={2}
        strokeLinecap="round"
        style={STROKE_STYLE(checked, reduced, reduced ? 0 : checked ? 120 : 0)}
      />
    </svg>
  );
}

export function TallyNotch({
  items,
  defaultChecked = [],
  onChange,
  label = "Tally",
  className = "",
}: TallyNotchProps) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(defaultChecked));
  const reduced = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange?.(items.filter((it) => next.has(it.id)).map((it) => it.id));
      return next;
    });
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={["w-full rounded-md border border-border bg-surface", className].join(" ")}
    >
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <span className="font-mono text-xs tracking-widest text-ns-muted uppercase">{label}</span>
        <div className="flex items-center gap-3">
          <TallyCluster count={checked.size} max={items.length} reduced={reduced} />
          <span
            aria-live="polite"
            className="min-w-[3ch] text-right font-mono text-xs tabular-nums text-ns-muted"
          >
            {checked.size}/{items.length}
          </span>
        </div>
      </header>
      <div className="flex flex-col">
        {items.map((it) => {
          const isChecked = checked.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              onClick={() => toggle(it.id)}
              className={[
                "group flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0",
                "transition-colors duration-150 hover:bg-border/40",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent",
              ].join(" ")}
            >
              <NotchMark checked={isChecked} reduced={reduced} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={[
                    "truncate text-sm transition-colors duration-200",
                    isChecked ? "text-ns-muted" : "text-foreground",
                  ].join(" ")}
                >
                  {it.label}
                </span>
                {it.hint ? (
                  <span className="truncate font-mono text-[11px] text-ns-muted">{it.hint}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
