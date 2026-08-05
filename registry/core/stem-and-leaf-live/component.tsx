"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// StemSift — a stem-and-leaf plot that stays a live instrument instead of a
// static printout: the `records` prop is a rolling window of raw
// { id, value, meta } values, and every arrival is rendered as one Geist
// Mono digit — the ones-digit of its rounded value — inserted into its
// tens-stem row in ascending order. Nothing is pre-aggregated: the glyphs
// ARE the data, every leaf is a real focusable record, not a pixel a
// histogram would have thrown away.
//
// MECHANISM: rows are real <table> rows (<th scope="row"> for the stem
// range, <td> holding a flex row of leaf digits) so the count and every
// value are exposed to assistive tech the way a table naturally reads them.
// A new leaf is measured against a decorative staging slot above the table
// (aria-hidden) and, on mount into its sorted position, is given an inverted
// transform equal to (staging rect - final rect) with transitions off, then
// one rAF later the transform is cleared with a spring transition — a
// two-keyframe fly from the staging point into its row. Every *existing*
// sibling leaf whose position changed because of that insertion (the
// "shoulder nudge") gets the same FLIP treatment computed from its own
// previous vs. current rect, so a row's leaves visibly part to make room
// rather than snapping to a new layout. Row length is never a separate bar —
// the flex row's own width IS the bar, doubling as both data and chart.
//
// A11y: native table semantics (caption states n/median/range), leaves are
// real <button>s with a roving tabindex (one Tab stop per component, Arrow
// keys move within a row and Up/Down step to the nearest populated row),
// each leaf's accessible name is its full raw value + optional meta so a
// screen reader gets the actual record, not just a digit. Hover or focus any
// leaf and it lifts 2px and the footer readout swaps from the resting
// n/median/range summary to that record. Arrivals are batched into a
// debounced role=status live region ("3 new values, median now 141ms")
// rather than announcing every tick. FLIP + fly-in are both skipped under
// prefers-reduced-motion — leaves place at their final position instantly,
// the table stays fully readable and navigable either way.
//
// Pure DOM + CSS, no canvas. All ink is token-relative (--foreground digits
// and staging box, --border rules and empty-row dashes, --ns-muted labels,
// --ns-accent only on the keyboard focus ring).
// ---------------------------------------------------------------------------

export interface StemSiftRecord {
  /** stable id — leaves are keyed by it so an entry FLIPs, not remounts */
  id: string | number;
  value: number;
  /** short source tag shown in the detail readout, e.g. "req-4821" */
  meta?: string;
}

export interface StemSiftProps {
  /** rolling window of raw samples, oldest first */
  records: StemSiftRecord[];
  /** unit suffix for readouts and stem labels, e.g. "ms" */
  unit?: string;
  label?: string;
  className?: string;
}

const TRAVEL_MS = 440; // staging slot -> row, fly-in
const REFLOW_MS = 320; // shoulder-nudge of existing siblings
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const STAGING_HOLD_MS = 360;
const ANNOUNCE_DEBOUNCE_MS = 900;

interface Leaf {
  sid: string;
  id: string | number;
  value: number; // rounded, used for stem/leaf math
  raw: number; // original value, shown in detail
  digit: number;
  meta?: string;
}

interface StemRow {
  stem: number;
  lo: number;
  hi: number;
  leaves: Leaf[];
}

function useReducedMotion(): boolean {
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

function formatValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function buildRows(records: StemSiftRecord[]): StemRow[] {
  if (records.length === 0) return [];
  const items = records.map((r) => {
    const rounded = Math.round(r.value);
    return {
      sid: String(r.id),
      id: r.id,
      value: rounded,
      raw: r.value,
      digit: ((rounded % 10) + 10) % 10,
      meta: r.meta,
    };
  });
  const stems = items.map((it) => Math.floor(it.value / 10));
  const minStem = Math.min(...stems);
  const maxStem = Math.max(...stems);
  const rows: StemRow[] = [];
  for (let s = minStem; s <= maxStem; s++) {
    const leaves = items
      .filter((it) => Math.floor(it.value / 10) === s)
      .sort((a, b) => a.digit - b.digit); // Array#sort is stable: ties keep arrival order
    rows.push({ stem: s, lo: s * 10, hi: s * 10 + 9, leaves });
  }
  return rows;
}

function stepRow(rows: StemRow[], ri: number, dir: 1 | -1): number {
  let next = ri + dir;
  while (next >= 0 && next < rows.length && rows[next].leaves.length === 0) {
    next += dir;
  }
  if (next < 0 || next >= rows.length || rows[next].leaves.length === 0) return ri;
  return next;
}

function median(sortedVals: number[]): number {
  const n = sortedVals.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sortedVals[mid] : (sortedVals[mid - 1] + sortedVals[mid]) / 2;
}

export function StemSift({ records, unit = "", label = "Distribution", className = "" }: StemSiftProps) {
  const rows = useMemo(() => buildRows(records), [records]);
  const reducedMotion = useReducedMotion();

  const wrapRefs = useRef(new Map<string, HTMLSpanElement>());
  const btnRefs = useRef(new Map<string, HTMLButtonElement>());
  const prevRectsRef = useRef(new Map<string, DOMRect>());
  const prevIdsRef = useRef(new Set<string>());
  const stagingRef = useRef<HTMLSpanElement>(null);
  const mountedRef = useRef(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [stagingDigit, setStagingDigit] = useState<number | null>(null);
  const stagingTimer = useRef<number | undefined>(undefined);

  const [announce, setAnnounce] = useState("");
  const pendingCountRef = useRef(0);
  const announceTimer = useRef<number | undefined>(undefined);

  const stats = useMemo(() => {
    const vals = records.map((r) => Math.round(r.value)).sort((a, b) => a - b);
    const n = vals.length;
    return {
      n,
      median: median(vals),
      min: n ? vals[0] : 0,
      max: n ? vals[n - 1] : 0,
    };
  }, [records]);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  // resolve which leaf currently owns the single Tab stop, falling back to
  // the first populated row's first leaf if the previous choice aged out
  const validActiveId = useMemo(() => {
    if (activeId && rows.some((r) => r.leaves.some((l) => l.sid === activeId))) return activeId;
    const first = rows.find((r) => r.leaves.length > 0)?.leaves[0];
    return first ? first.sid : null;
  }, [activeId, rows]);

  // FLIP: measure every leaf's rect before this commit's arrivals/removals
  // are accounted for, diff against what we measured last time, and either
  // fly entering leaves in from the staging slot or nudge existing ones from
  // their old position to the new one. useLayoutEffect (not useEffect) so
  // the invert transform is applied before the browser paints the new,
  // already-inserted DOM position — otherwise the leaf would flash at its
  // final spot for one frame before jumping back to start the animation.
  useLayoutEffect(() => {
    const currentIds = new Set<string>();
    rows.forEach((r) => r.leaves.forEach((l) => currentIds.add(l.sid)));
    const prevIds = prevIdsRef.current;
    const enteringSids: string[] = [];
    currentIds.forEach((sid) => {
      if (!prevIds.has(sid)) enteringSids.push(sid);
    });

    const nextRects = new Map<string, DOMRect>();
    const plays: { el: HTMLSpanElement; dx: number; dy: number; enter: boolean }[] = [];
    const stageRect = stagingRef.current?.getBoundingClientRect();

    currentIds.forEach((sid) => {
      const el = wrapRefs.current.get(sid);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      nextRects.set(sid, rect);
      if (reducedMotion) return;
      const entering = enteringSids.includes(sid);
      if (entering) {
        if (stageRect) {
          const dx = stageRect.left - rect.left;
          const dy = stageRect.top - rect.top;
          plays.push({ el, dx, dy, enter: true });
        }
      } else {
        const prevRect = prevRectsRef.current.get(sid);
        if (!prevRect) return;
        const dx = prevRect.left - rect.left;
        const dy = prevRect.top - rect.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          plays.push({ el, dx, dy, enter: false });
        }
      }
    });

    if (plays.length) {
      plays.forEach(({ el, dx, dy }) => {
        el.style.transition = "none";
        el.style.opacity = "";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      requestAnimationFrame(() => {
        plays.forEach(({ el, enter }) => {
          el.style.transition = `transform ${enter ? TRAVEL_MS : REFLOW_MS}ms ${SPRING_EASE}`;
          el.style.transform = "translate(0px, 0px)";
        });
      });
    }

    prevRectsRef.current = nextRects;
    prevIdsRef.current = currentIds;

    // staging slot flashes the most recent arrival's digit, then clears
    if (!reducedMotion && enteringSids.length && mountedRef.current) {
      const lastSid = enteringSids[enteringSids.length - 1];
      const leaf = rows.flatMap((r) => r.leaves).find((l) => l.sid === lastSid);
      if (leaf) {
        window.clearTimeout(stagingTimer.current);
        setStagingDigit(leaf.digit);
        stagingTimer.current = window.setTimeout(() => setStagingDigit(null), STAGING_HOLD_MS);
      }
    }

    // batched arrival announcement, debounced so a burst of ticks reads as
    // one sentence instead of one interruption per value
    if (mountedRef.current && enteringSids.length) {
      pendingCountRef.current += enteringSids.length;
      window.clearTimeout(announceTimer.current);
      announceTimer.current = window.setTimeout(() => {
        const count = pendingCountRef.current;
        pendingCountRef.current = 0;
        const { median: med, n } = statsRef.current;
        if (count > 0 && n > 0) {
          setAnnounce(`${count} new value${count === 1 ? "" : "s"}, median now ${formatValue(med)}${unit}.`);
        }
      }, ANNOUNCE_DEBOUNCE_MS);
    }

    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, reducedMotion]);

  useEffect(
    () => () => {
      window.clearTimeout(stagingTimer.current);
      window.clearTimeout(announceTimer.current);
    },
    []
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (!validActiveId) return;
    let ri = -1;
    let li = -1;
    for (let r = 0; r < rows.length; r++) {
      const idx = rows[r].leaves.findIndex((l) => l.sid === validActiveId);
      if (idx !== -1) {
        ri = r;
        li = idx;
        break;
      }
    }
    if (ri === -1) return;

    switch (e.key) {
      case "ArrowRight":
        li = Math.min(rows[ri].leaves.length - 1, li + 1);
        break;
      case "ArrowLeft":
        li = Math.max(0, li - 1);
        break;
      case "ArrowDown":
        ri = stepRow(rows, ri, 1);
        li = Math.min(li, rows[ri].leaves.length - 1);
        break;
      case "ArrowUp":
        ri = stepRow(rows, ri, -1);
        li = Math.min(li, rows[ri].leaves.length - 1);
        break;
      case "Home":
        li = 0;
        break;
      case "End":
        li = rows[ri].leaves.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = rows[ri]?.leaves[li];
    if (!target) return;
    setActiveId(target.sid);
    setDetailId(target.sid);
    btnRefs.current.get(target.sid)?.focus();
  };

  const detail = detailId ? rows.flatMap((r) => r.leaves).find((l) => l.sid === detailId) : null;

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">{label}</span>
        <span
          ref={stagingRef}
          aria-hidden="true"
          className="ns-sift-staging"
          data-active={stagingDigit !== null || undefined}
        >
          {stagingDigit ?? "·"}
        </span>
      </div>

      <div className="ns-sift-frame overflow-x-auto rounded-sm border border-border bg-background">
        <table className="ns-sift-table w-full border-collapse">
          <caption className="sr-only">
            {label} stem-and-leaf plot. {stats.n} value{stats.n === 1 ? "" : "s"}, median{" "}
            {formatValue(stats.median)}
            {unit}, range {formatValue(stats.min)}
            {unit} to {formatValue(stats.max)}
            {unit}. Each row is a stem of ten{unit ? ` ${unit}` : ""}; each leaf digit is one value's
            ones digit.
          </caption>
          <tbody onKeyDown={onKeyDown}>
            {rows.map((row) => (
              <tr key={row.stem} className="ns-sift-row">
                <th scope="row" className="ns-sift-stem">
                  {row.lo}–{row.hi}
                  {unit ? ` ${unit}` : ""}
                  <span className="sr-only">
                    {" "}
                    &middot; {row.leaves.length} value{row.leaves.length === 1 ? "" : "s"}
                  </span>
                </th>
                <td className="ns-sift-cell">
                  <div className="ns-sift-leaves">
                    {row.leaves.length === 0 && (
                      <span aria-hidden="true" className="ns-sift-empty">
                        &mdash;
                      </span>
                    )}
                    {row.leaves.map((leaf) => {
                      const tabbable = leaf.sid === validActiveId;
                      const ariaLabel = `${formatValue(leaf.raw)}${unit ? ` ${unit}` : ""}${
                        leaf.meta ? `, ${leaf.meta}` : ""
                      }`;
                      return (
                        <span
                          key={leaf.sid}
                          ref={(el) => {
                            if (el) wrapRefs.current.set(leaf.sid, el);
                            else wrapRefs.current.delete(leaf.sid);
                          }}
                          className="ns-sift-leaf-wrap"
                        >
                          <button
                            ref={(el) => {
                              if (el) btnRefs.current.set(leaf.sid, el);
                              else btnRefs.current.delete(leaf.sid);
                            }}
                            type="button"
                            className="ns-sift-leaf"
                            tabIndex={tabbable ? 0 : -1}
                            aria-label={ariaLabel}
                            data-detail={leaf.sid === detailId || undefined}
                            onClick={() => {
                              setActiveId(leaf.sid);
                              setDetailId(leaf.sid);
                            }}
                            onFocus={() => {
                              setActiveId(leaf.sid);
                              setDetailId(leaf.sid);
                            }}
                            onBlur={() => setDetailId((d) => (d === leaf.sid ? null : d))}
                            onMouseEnter={() => setDetailId(leaf.sid)}
                            onMouseLeave={() => setDetailId((d) => (d === leaf.sid ? null : d))}
                          >
                            {leaf.digit}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="ns-sift-none">
                  no data yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between font-mono text-[10px] tabular-nums text-ns-muted">
        <span>n {stats.n}</span>
        <span className="text-foreground/80" aria-live="off">
          {detail
            ? `${formatValue(detail.raw)}${unit}${detail.meta ? ` · ${detail.meta}` : ""}`
            : `median ${formatValue(stats.median)}${unit} · range ${formatValue(stats.min)}–${formatValue(
                stats.max
              )}${unit}`}
        </span>
        <span>stem = tens</span>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

      <style>{`
        .ns-sift-staging {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.7em;
          height: 1.5em;
          border: 1px dashed var(--border);
          border-radius: 6px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--ns-muted);
          transition: color 200ms ease, border-color 200ms ease;
        }
        .ns-sift-staging[data-active] {
          color: var(--foreground);
          border-style: solid;
          border-color: var(--foreground);
        }

        .ns-sift-table {
          font-family: var(--font-mono);
        }
        .ns-sift-row + .ns-sift-row .ns-sift-stem,
        .ns-sift-row + .ns-sift-row .ns-sift-cell {
          border-top: 1px solid var(--border);
        }
        .ns-sift-stem {
          text-align: right;
          vertical-align: baseline;
          white-space: nowrap;
          padding: 5px 10px 5px 8px;
          font-size: 11px;
          font-weight: 400;
          color: var(--ns-muted);
          border-right: 1px solid var(--border);
        }
        .ns-sift-cell {
          padding: 5px 8px;
          vertical-align: baseline;
          width: 100%;
        }
        .ns-sift-none {
          padding: 20px 8px;
          text-align: center;
          font-size: 12px;
          color: var(--ns-muted);
        }
        .ns-sift-leaves {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 1px;
          min-height: 1.5em;
        }
        .ns-sift-empty {
          font-size: 11px;
          color: var(--border);
          padding-left: 2px;
        }
        .ns-sift-leaf-wrap {
          display: inline-block;
        }
        .ns-sift-leaf {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.6em;
          height: 1.5em;
          padding: 0;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--foreground);
          font-family: var(--font-mono);
          font-size: 13px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: transform 120ms ease-out, background-color 120ms ease-out;
        }
        .ns-sift-leaf:hover,
        .ns-sift-leaf[data-detail] {
          transform: translateY(-2px);
          background: color-mix(in oklab, var(--foreground) 6%, transparent);
        }
        .ns-sift-leaf:focus-visible {
          outline: 2px solid var(--ns-accent);
          outline-offset: 2px;
          transform: translateY(-2px);
        }

        @media (prefers-reduced-motion: reduce) {
          .ns-sift-staging {
            transition: none;
          }
          .ns-sift-leaf {
            transition: background-color 120ms ease-out;
          }
        }
      `}</style>
    </div>
  );
}
