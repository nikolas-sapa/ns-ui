"use client";

import { useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// GrowthRing — version history as a dendrochronological cross-section. The
// authoritative control is the listbox on the left: every fact (`v14 ·
// Priya Shah · +340 words · 14:02 · Restore`) lives there as real text, and
// keyboard/click drive it exactly like any other listbox. The SVG cross-
// section beside it is pure `aria-hidden` decoration that mirrors the same
// data geometrically — radius is the version's position in time (index,
// strictly monotonic; never re-sorted by author), ring width is the
// version's change magnitude clamped 2-14px, and a tight dark "latewood"
// line marks every boundary where authorship changed hands. Restoring is
// modeled as a literal cut: arming a version tilts every ring OUTSIDE it
// open on a shared hinge and dims them, so what a restore discards is shown
// before it happens; confirming is a distinct second step.
// ---------------------------------------------------------------------------

export type GrowthRingVersion = {
  id: string;
  /** short version tag, e.g. "v14" */
  label: string;
  author: string;
  /** magnitude of the change this version made — the scalar ring width derives from */
  delta: number;
  /** pre-formatted display string for the delta, e.g. "+340 words" */
  deltaLabel: string;
  /** pre-formatted display string for when it saved, e.g. "14:02" */
  time: string;
};

export interface GrowthRingProps {
  /** newest first, like a git log — the ring chart reads it in reverse (oldest at the core) */
  versions: GrowthRingVersion[];
  /** called once a restore is actually confirmed, with the version restored to */
  onRestore?: (version: GrowthRingVersion) => void;
  /** accessible name for the listbox; default "Version history" */
  ariaLabel?: string;
  className?: string;
}

const INNER_RADIUS = 20;
const MIN_RING_WIDTH = 2;
const MAX_RING_WIDTH = 14;
// A raw character/word delta of a few thousand (one giant paste) would
// otherwise dwarf every other ring and flatten the chart to "one huge band
// plus noise" — dividing before the clamp is what keeps normal edits in a
// readable 2-14px band while still clamping the outlier rather than trusting
// the divisor alone.
const DELTA_TO_PX = 25;
const PADDING_MIN = 14;
// The disc rotates 8deg about its own bottom tangent to open the "discard"
// flap, which pushes its rightmost point out by roughly sin(8deg) (~13.9%)
// of the outer radius. A fixed pixel padding runs out once the ring stack
// gets big enough — a proportional floor keeps the swing inside the
// viewBox no matter how many versions or how wide their rings get.
const HINGE_CLEARANCE_RATIO = 0.2;
const HINGE_DEG = 8;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// A near-full circular arc, used only as an invisible <textPath> guide for
// the focused ring's author-initials label — never rendered with a stroke.
function arcGuide(cx: number, cy: number, r: number) {
  return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`;
}

type Ring = {
  id: string;
  version: GrowthRingVersion;
  chronoIndex: number; // 0 = oldest
  inner: number;
  outer: number;
  mid: number;
  width: number;
  handover: boolean; // author differs from the previous (older) version
};

function buildRings(versions: GrowthRingVersion[]): Ring[] {
  const chrono = [...versions].reverse(); // oldest first — radius follows time, nothing else
  let r = INNER_RADIUS;
  return chrono.map((v, i) => {
    const width = clamp(Math.round(Math.abs(v.delta) / DELTA_TO_PX), MIN_RING_WIDTH, MAX_RING_WIDTH);
    const inner = r;
    const outer = r + width;
    r = outer;
    const handover = i > 0 && chrono[i - 1].author !== v.author;
    return { id: v.id, version: v, chronoIndex: i, inner, outer, mid: (inner + outer) / 2, width, handover };
  });
}

export function GrowthRing({
  versions,
  onRestore,
  ariaLabel = "Version history",
  className = "",
}: GrowthRingProps) {
  const uid = useId();
  const [items, setItems] = useState(versions);
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const optionRefs = useRef(new Map<string, HTMLLIElement>());

  const rings = useMemo(() => buildRings(items), [items]);
  const outerMost = rings.length ? rings[rings.length - 1].outer : INNER_RADIUS;
  const padding = Math.max(PADDING_MIN, Math.round(outerMost * HINGE_CLEARANCE_RATIO));
  const size = outerMost + padding;
  const cx = size;
  const cy = size;
  const hingeX = cx;
  const hingeY = cy + outerMost; // bottom tangent of the whole disc

  const armedRing = armedId ? rings.find((r) => r.id === armedId) ?? null : null;
  const discardedRings = armedRing ? rings.filter((r) => r.chronoIndex > armedRing.chronoIndex) : [];
  const keptRings = armedRing ? rings.filter((r) => r.chronoIndex <= armedRing.chronoIndex) : rings;
  const discardedAuthors = new Set(discardedRings.map((r) => r.version.author));
  const discardCount = discardedRings.length;

  function arm(id: string) {
    const idx = items.findIndex((v) => v.id === id);
    if (idx <= 0) return; // the newest version is already current — nothing to preview or restore
    setArmedId(id);
    const target = items[idx];
    const authorsAhead = new Set(items.slice(0, idx).map((v) => v.author));
    setAnnouncement(
      `Restoring to ${target.label} removes ${plural(idx, "newer version")} by ${plural(authorsAhead.size, "author")}.`
    );
  }

  function disarm(announce: boolean) {
    setArmedId(null);
    if (announce) setAnnouncement("Restore cancelled.");
  }

  function commit() {
    if (!armedRing) return;
    const idx = items.findIndex((v) => v.id === armedRing.id);
    if (idx < 0) return;
    const restored = items[idx];
    const next = items.slice(idx); // the cut: everything newer than the restored version is gone
    setItems(next);
    setArmedId(null);
    setActiveId(restored.id);
    setAnnouncement(`Restored to ${restored.label}.`);
    onRestore?.(restored);
  }

  function focusOption(id: string) {
    setActiveId(id);
    optionRefs.current.get(id)?.focus();
  }

  function handleOptionKeyDown(e: React.KeyboardEvent<HTMLLIElement>, id: string) {
    const idx = items.findIndex((v) => v.id === id);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = items[Math.min(idx + 1, items.length - 1)];
      if (next) focusOption(next.id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = items[Math.max(idx - 1, 0)];
      if (prev) focusOption(prev.id);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (items[0]) focusOption(items[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      const last = items[items.length - 1];
      if (last) focusOption(last.id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      arm(id);
    } else if (e.key === "Escape" && armedId) {
      e.preventDefault();
      disarm(true);
    }
  }

  function ringStroke(chronoIndex: number) {
    return chronoIndex % 2 === 0 ? "var(--ns-muted)" : "var(--background)";
  }

  function renderRingGroup(group: Ring[], isCutFace: boolean) {
    return group.map((ring) => {
      const pulsed = ring.id === focusedId || ring.id === hoveredId;
      const strokeWidth = pulsed ? ring.width + 3 : ring.width;
      const showLabel = ring.id === focusedId;
      const guideId = `${uid}-arc-${ring.chronoIndex}`;
      return (
        <g key={ring.id}>
          <circle
            cx={cx}
            cy={cy}
            r={ring.mid}
            fill="none"
            stroke={ringStroke(ring.chronoIndex)}
            strokeWidth={strokeWidth}
            className="ns-growth-ring"
          />
          <circle
            cx={cx}
            cy={cy}
            r={ring.inner}
            fill="none"
            stroke={ring.handover ? "var(--foreground)" : "var(--border)"}
            strokeWidth={ring.handover ? 1.6 : 1}
          />
          {showLabel ? (
            <>
              <path id={guideId} d={arcGuide(cx, cy, ring.mid)} fill="none" stroke="none" />
              <text
                className="font-mono"
                fontSize={Math.max(7, Math.min(9, ring.width))}
                fill="var(--foreground)"
              >
                <textPath href={`#${guideId}`} startOffset="2%">
                  {initials(ring.version.author)}
                </textPath>
              </text>
            </>
          ) : null}
        </g>
      );
    });
  }

  return (
    <div data-growth-root className={className}>
      <style>{`
.ns-growth-ring{transition:stroke-width 200ms cubic-bezier(0.16,1,0.3,1)}
.ns-growth-outer{transition:transform 420ms cubic-bezier(0.16,1,0.3,1),opacity 420ms cubic-bezier(0.16,1,0.3,1)}
.ns-growth-option{transition:background-color 160ms ease,border-color 160ms ease}
@media (prefers-reduced-motion: reduce){
  .ns-growth-ring{transition:none}
  .ns-growth-outer{transition:opacity 150ms linear !important;transform:none !important}
  .ns-growth-option{transition:none}
}
`}</style>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="min-w-0 flex-1 divide-y divide-border rounded-md border border-border"
        >
          {items.map((v, idx) => {
            const isArmed = v.id === armedId;
            const isActive = v.id === activeId;
            const isFocused = v.id === focusedId;
            return (
              <li
                key={v.id}
                ref={(el) => {
                  if (el) optionRefs.current.set(v.id, el);
                  else optionRefs.current.delete(v.id);
                }}
                role="option"
                aria-selected={isArmed}
                tabIndex={isActive ? 0 : -1}
                data-growth-version={v.id}
                onFocus={() => setFocusedId(v.id)}
                onBlur={() => setFocusedId((f) => (f === v.id ? null : f))}
                onMouseEnter={() => setHoveredId(v.id)}
                onMouseLeave={() => setHoveredId((h) => (h === v.id ? null : h))}
                onClick={() => {
                  setActiveId(v.id);
                  arm(v.id);
                }}
                onKeyDown={(e) => handleOptionKeyDown(e, v.id)}
                className={
                  "ns-growth-option flex cursor-pointer flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ns-accent " +
                  (isFocused
                    ? "border-l-2 border-ns-accent bg-surface pl-[10px]"
                    : "border-l-2 border-transparent pl-[10px]") +
                  (isArmed ? " bg-surface" : "")
                }
              >
                <span className="font-mono text-foreground">{v.label}</span>
                <span className="text-foreground">{v.author}</span>
                <span className="font-mono tabular-nums text-ns-muted">{v.deltaLabel}</span>
                <span className="font-mono tabular-nums text-ns-muted">{v.time}</span>
                <span className="ml-auto shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ns-muted">
                  {idx === 0 ? "Current" : "Restore"}
                </span>
              </li>
            );
          })}
        </ul>

        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={`0 0 ${size * 2} ${size * 2}`}
          className="h-48 w-48 shrink-0 sm:h-56 sm:w-56"
        >
          <g>{renderRingGroup(keptRings, false)}</g>
          {armedRing ? (
            <circle
              cx={cx}
              cy={cy}
              r={armedRing.outer}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={2}
            />
          ) : (
            <circle cx={cx} cy={cy} r={outerMost} fill="none" stroke="var(--border)" strokeWidth={1} />
          )}
          {discardedRings.length ? (
            <g
              data-discarded="true"
              className="ns-growth-outer"
              style={{
                transformOrigin: `${hingeX}px ${hingeY}px`,
                transform: `rotate(${HINGE_DEG}deg)`,
                opacity: 0.4,
              }}
            >
              {renderRingGroup(discardedRings, true)}
            </g>
          ) : null}
        </svg>
      </div>

      {armedRing ? (
        <div data-growth-confirm-panel className="mt-4 rounded-md border border-border bg-surface p-3">
          <p className="text-sm text-foreground">
            This removes {plural(discardCount, "newer version")} by{" "}
            {plural(discardedAuthors.size, "author")}.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => disarm(true)}
              className="rounded-sm border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              Cancel
            </button>
            <button
              type="button"
              data-growth-confirm
              onClick={commit}
              className="rounded-sm bg-ns-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
            >
              Confirm restore to {armedRing.version.label}
            </button>
          </div>
        </div>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
