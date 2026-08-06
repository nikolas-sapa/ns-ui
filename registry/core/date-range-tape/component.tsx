"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

// ---------------------------------------------------------------------------
// SpanTape — a date-range calendar where the selection IS a tape measure.
// Pointerdown (or Enter) on a cell drops the hook and anchors the tape;
// moving the pointer (or arrowing, drag or plain hover) extends a segmented,
// mono-ticked strip across the grid — each segment is measured from real
// cell rects so it wraps cleanly at week boundaries — with a live "N nights"
// readout printed on its free end. A second pointerup/Enter on a different
// cell locks the tape (confirmed); Escape, or a second press on the anchor
// cell, recoils it back to zero width (ease-out-expo, skipped under reduced
// motion). All geometry is measured, not indexed — ticks are a
// repeating-linear-gradient in --border sized to the measured cell pitch.
// No canvas. Colors: --background --foreground --ns-muted --border --ns-accent
// only, via Tailwind's token classes and opacity modifiers.
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
const WEEKDAYS = [
  ["Su", "Sunday"], ["Mo", "Monday"], ["Tu", "Tuesday"], ["We", "Wednesday"],
  ["Th", "Thursday"], ["Fr", "Friday"], ["Sa", "Saturday"],
] as const;

const DAY_MS = 86400000;
const RECOIL_MS = 260;
const BAND = 8; // tape strip height, px

// ---------------------------------------------------------------------------
// date helpers
// ---------------------------------------------------------------------------

function sameDay(a: Date | null, b: Date | null) {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function addMonths(d: Date, n: number) {
  const r = new Date(d);
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  r.setDate(Math.min(day, daysInMonth(r.getFullYear(), r.getMonth())));
  return r;
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function nightsBetween(a: Date, b: Date) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round(Math.abs(ub - ua) / DAY_MS);
}
function fmtLong(d: Date) {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}
function fmtFull(d: Date) {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
/** 42 cells (6 weeks) covering the given month, bleeding into neighbours. */
function buildGrid(y: number, m: number): Date[] {
  const first = new Date(y, m, 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

// ---------------------------------------------------------------------------
// geometry — segments computed from real cell rects, not index math
// ---------------------------------------------------------------------------

interface Seg {
  left: number;
  top: number;
  width: number;
  height: number;
}
interface Geom {
  segments: Seg[];
  hook: { left: number; top: number };
  free: { left: number; top: number };
  pitch: number;
  anchorIsLo: boolean;
}

function computeSegments(
  cellEls: (HTMLButtonElement | null)[],
  wrapRect: DOMRect,
  fromIdx: number,
  toIdx: number
): Seg[] {
  const lo = Math.min(fromIdx, toIdx);
  const hi = Math.max(fromIdx, toIdx);
  const segs: Seg[] = [];
  const rowOf = (i: number) => Math.floor(i / 7);
  for (let row = rowOf(lo); row <= rowOf(hi); row++) {
    const rowStart = row * 7;
    const rowEnd = rowStart + 6;
    const segLo = Math.max(lo, rowStart);
    const segHi = Math.min(hi, rowEnd);
    const elLo = cellEls[segLo];
    const elHi = cellEls[segHi];
    if (!elLo || !elHi) continue;
    const rLo = elLo.getBoundingClientRect();
    const rHi = elHi.getBoundingClientRect();
    if (!rLo.width || !rLo.height) continue;
    segs.push({
      left: rLo.left - wrapRect.left,
      top: rLo.top - wrapRect.top + rLo.height - BAND - 5,
      width: rHi.right - rLo.left,
      height: BAND,
    });
  }
  return segs;
}

function cellIndexFromPoint(
  cellEls: (HTMLButtonElement | null)[],
  x: number,
  y: number
): number {
  for (let i = 0; i < cellEls.length; i++) {
    const el = cellEls[i];
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

export interface SpanTapeRange {
  start: Date;
  end: Date;
}

export interface SpanTapeProps {
  /** visible label above the grid */
  label?: string;
  /** month to open on, when uncontrolled and no value is set */
  initialMonth?: Date;
  /** controlled confirmed range; pass null for "no selection" */
  value?: SpanTapeRange | null;
  /** fires with the locked range on confirm, or null on cancel */
  onValueChange?: (range: SpanTapeRange | null) => void;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type Status = "idle" | "anchored" | "confirmed" | "retracting";

export function SpanTape({
  label = "Stay dates",
  initialMonth,
  value,
  onValueChange,
  className = "",
}: SpanTapeProps) {
  const isControlled = value !== undefined;
  const gridId = useId();
  const readoutId = useId();

  const [internalRange, setInternalRange] = useState<SpanTapeRange | null>(null);
  const confirmedRange = isControlled ? (value ?? null) : internalRange;

  const today = useMemo(() => new Date(), []);
  const seedDate = initialMonth ?? confirmedRange?.start ?? today;

  const [view, setView] = useState(() => ({
    y: seedDate.getFullYear(),
    m: seedDate.getMonth(),
  }));
  const [focusedDate, setFocusedDate] = useState(seedDate);
  const [anchor, setAnchor] = useState<Date | null>(confirmedRange?.start ?? null);
  const [hoverDate, setHoverDate] = useState<Date | null>(confirmedRange?.end ?? null);
  const [status, setStatus] = useState<Status>(confirmedRange ? "confirmed" : "idle");
  const [geom, setGeom] = useState<Geom | null>(null);

  const gridWrapRef = useRef<HTMLDivElement>(null);
  const cellElsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const liveRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const pressRef = useRef<{ mode: "fresh" | "press"; moved: boolean } | null>(null);

  // refs mirroring latest state, read from the document-level pointerup
  // listener below so it never closes over a stale render.
  const statusRef = useRef(status);
  statusRef.current = status;
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  const hoverRef = useRef(hoverDate);
  hoverRef.current = hoverDate;

  const cells = useMemo(() => buildGrid(view.y, view.m), [view.y, view.m]);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  // controlled value sync — mirrors the interaction state to whatever the
  // consumer passes, including a range seeded before first paint.
  const controlledKey = isControlled
    ? value
      ? `${value.start.getTime()}-${value.end.getTime()}`
      : "null"
    : null;
  useEffect(() => {
    if (controlledKey === null) return;
    if (value) {
      setAnchor(value.start);
      setHoverDate(value.end);
      setStatus("confirmed");
      setFocusedDate(value.start);
      setView({ y: value.start.getFullYear(), m: value.start.getMonth() });
    } else {
      setAnchor(null);
      setHoverDate(null);
      setStatus("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledKey]);

  const announce = (text: string) => {
    if (liveRef.current) liveRef.current.textContent = text;
  };

  const startAnchor = (d: Date) => {
    if (status === "confirmed") {
      if (!isControlled) setInternalRange(null);
      onValueChange?.(null);
    }
    setAnchor(d);
    setHoverDate(d);
    setStatus("anchored");
    setFocusedDate(d);
    announce(`${fmtFull(d)} anchored. Choose an end date.`);
  };

  const updateHover = (d: Date) => {
    setHoverDate((prev) => (sameDay(prev, d) ? prev : d));
    if (!anchorRef.current) return;
    const n = nightsBetween(anchorRef.current, d);
    announce(`Through ${fmtLong(d)}, ${n} night${n === 1 ? "" : "s"}`);
  };

  const confirmRange = (endDate: Date) => {
    const a = anchorRef.current;
    if (!a) return;
    const start = a.getTime() <= endDate.getTime() ? a : endDate;
    const end = a.getTime() <= endDate.getTime() ? endDate : a;
    const range: SpanTapeRange = { start, end };
    if (!isControlled) setInternalRange(range);
    onValueChange?.(range);
    setHoverDate(endDate);
    setStatus("confirmed");
    setFocusedDate(endDate);
    const n = nightsBetween(start, end);
    announce(`Selected ${fmtLong(start)} through ${fmtLong(end)}, ${n} night${n === 1 ? "" : "s"}.`);
  };

  const cancelSelection = () => {
    if (statusRef.current === "idle") return;
    if (!isControlled) setInternalRange(null);
    onValueChange?.(null);
    announce("Selection cleared.");
    setStatus("retracting");
    window.setTimeout(() => {
      setStatus("idle");
      setAnchor(null);
      setHoverDate(null);
    }, RECOIL_MS + 20);
  };

  // stable refs so the document listener always calls the latest closures
  const confirmRangeRef = useRef(confirmRange);
  confirmRangeRef.current = confirmRange;
  const cancelSelectionRef = useRef(cancelSelection);
  cancelSelectionRef.current = cancelSelection;

  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const press = pressRef.current;
      pressRef.current = null;
      if (statusRef.current !== "anchored") return;
      const idx = cellIndexFromPoint(cellElsRef.current, e.clientX, e.clientY);
      const target = idx >= 0 ? cellsRef.current[idx] : hoverRef.current;
      const a = anchorRef.current;
      if (!a || !target) return;
      if (sameDay(target, a) && !press?.moved) {
        if (press?.mode === "fresh") return; // plain click just anchored — stay armed
        cancelSelectionRef.current();
        return;
      }
      confirmRangeRef.current(target);
    };
    document.addEventListener("pointerup", onUp);
    return () => document.removeEventListener("pointerup", onUp);
  }, []);

  // geometry — recomputed whenever the measured range or the grid itself
  // changes, plus on resize (font load, container reflow).
  useLayoutEffect(() => {
    const wrap = gridWrapRef.current;
    if (!wrap) return;
    const recompute = () => {
      if (!anchor || !hoverDate) {
        setGeom(null);
        return;
      }
      const anchorIdx = cells.findIndex((c) => sameDay(c, anchor));
      const hoverIdx = cells.findIndex((c) => sameDay(c, hoverDate));
      if (anchorIdx < 0 || hoverIdx < 0) {
        setGeom(null);
        return;
      }
      const wrapRect = wrap.getBoundingClientRect();
      const segs = computeSegments(cellElsRef.current, wrapRect, anchorIdx, hoverIdx);
      if (!segs.length) {
        setGeom(null);
        return;
      }
      const anchorIsLo = anchorIdx <= hoverIdx;
      const first = segs[0];
      const last = segs[segs.length - 1];
      const hook = anchorIsLo
        ? { left: first.left, top: first.top + first.height / 2 }
        : { left: last.left + last.width, top: last.top + last.height / 2 };
      const free = anchorIsLo
        ? { left: last.left + last.width, top: last.top + last.height / 2 }
        : { left: first.left, top: first.top + first.height / 2 };
      const pitch = cellElsRef.current[0]?.getBoundingClientRect().width ?? 44;
      setGeom({ segments: segs, hook, free, pitch, anchorIsLo });
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [anchor, hoverDate, cells]);

  // number-settle pulse on the live count, whenever it changes
  const nights = anchor && hoverDate ? nightsBetween(anchor, hoverDate) : 0;
  useEffect(() => {
    const el = countRef.current;
    if (!el) return;
    el.classList.remove("ns-st-pulse");
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    void el.offsetWidth;
    el.classList.add("ns-st-pulse");
  }, [nights]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const idx = cellIndexFromPoint(cellElsRef.current, e.clientX, e.clientY);
    if (idx < 0) return;
    const d = cells[idx];
    if (status === "idle" || status === "confirmed") {
      startAnchor(d);
      pressRef.current = { mode: "fresh", moved: false };
    } else if (status === "anchored") {
      pressRef.current = { mode: "press", moved: false };
      if (anchor && !sameDay(d, anchor)) updateHover(d);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (status !== "anchored") return;
    const idx = cellIndexFromPoint(cellElsRef.current, e.clientX, e.clientY);
    if (idx < 0) return;
    const d = cells[idx];
    if (!hoverDate || !sameDay(d, hoverDate)) updateHover(d);
    if (pressRef.current && anchor && !sameDay(d, anchor)) pressRef.current.moved = true;
  };

  const moveFocus = (d: Date) => {
    setFocusedDate(d);
    setView({ y: d.getFullYear(), m: d.getMonth() });
    if (status === "anchored") updateHover(d);
  };

  const onGridKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (status === "idle" || status === "confirmed") {
        startAnchor(focusedDate);
      } else if (status === "anchored" && anchor) {
        if (sameDay(focusedDate, anchor)) cancelSelection();
        else confirmRange(focusedDate);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelSelection();
      return;
    }
    let d: Date | null = null;
    switch (e.key) {
      case "ArrowLeft": d = addDays(focusedDate, -1); break;
      case "ArrowRight": d = addDays(focusedDate, 1); break;
      case "ArrowUp": d = addDays(focusedDate, -7); break;
      case "ArrowDown": d = addDays(focusedDate, 7); break;
      case "Home": d = addDays(focusedDate, -focusedDate.getDay()); break;
      case "End": d = addDays(focusedDate, 6 - focusedDate.getDay()); break;
      case "PageUp": d = addMonths(focusedDate, e.shiftKey ? -12 : -1); break;
      case "PageDown": d = addMonths(focusedDate, e.shiftKey ? 12 : 1); break;
      default: return;
    }
    e.preventDefault();
    moveFocus(d);
  };

  const rangeLo = anchor && hoverDate ? (anchor.getTime() <= hoverDate.getTime() ? anchor : hoverDate) : null;
  const rangeHi = anchor && hoverDate ? (anchor.getTime() <= hoverDate.getTime() ? hoverDate : anchor) : null;
  const isSelected = (d: Date) =>
    !!rangeLo && !!rangeHi && d.getTime() >= rangeLo.getTime() && d.getTime() <= rangeHi.getTime();

  const focusedIdx = cells.findIndex((c) => sameDay(c, focusedDate));
  const tabbableIdx = focusedIdx >= 0 ? focusedIdx : new Date(view.y, view.m, 1).getDay();
  const monthLabel = `${MONTH_NAMES[view.m]} ${view.y}`;

  const readoutText =
    status === "idle"
      ? "Select a start date"
      : status === "anchored" && anchor
        ? `Anchored ${fmtLong(anchor)} — choose an end date`
        : status === "confirmed" && rangeLo && rangeHi
          ? `${fmtLong(rangeLo)} – ${fmtLong(rangeHi)} · ${nights} night${nights === 1 ? "" : "s"}`
          : "Selection cleared";

  return (
    <div className={`w-full max-w-[292px] ${className}`}>
      <style>{`
        .ns-st-seg {
          transition: transform ${RECOIL_MS}ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ns-st-hook, .ns-st-chip {
          transition: opacity 160ms ease;
        }
        @keyframes ns-st-settle {
          from { transform: translateY(-3px); opacity: 0.35; }
          to { transform: none; opacity: 1; }
        }
        .ns-st-pulse { animation: ns-st-settle 60ms ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .ns-st-seg { transition: none; }
          .ns-st-hook, .ns-st-chip { transition: none; }
          .ns-st-pulse { animation: none; }
        }
      `}</style>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        <p
          id={readoutId}
          data-tape-readout
          className="font-mono text-[11px] text-ns-muted"
        >
          {readoutText}
        </p>
      </div>

      <div className="rounded-md border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => moveFocus(addMonths(focusedDate, -1))}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-ns-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <p aria-live="polite" className="text-[13px] font-semibold text-foreground">
            {monthLabel}
          </p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => moveFocus(addMonths(focusedDate, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-ns-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div
          ref={gridWrapRef}
          className="relative select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          {/* decorative tape overlay — the selection instrument itself */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
            {geom && (() => {
              const g = geom;
              return (
                <>
                  {g.segments.map((seg, i) => (
                    <div
                      key={i}
                      className={`ns-st-seg absolute rounded-full border-y ${
                        status === "confirmed"
                          ? "border-ns-accent/50 bg-ns-accent/[0.12]"
                          : "border-border bg-foreground/[0.06]"
                      }`}
                      style={{
                        left: seg.left,
                        top: seg.top,
                        width: seg.width,
                        height: seg.height,
                        transformOrigin: g.anchorIsLo ? "left center" : "right center",
                        transform: status === "retracting" ? "scaleX(0)" : "scaleX(1)",
                        backgroundImage: `repeating-linear-gradient(90deg, var(--border) 0px, var(--border) 1px, transparent 1px, transparent ${Math.max(4, g.pitch)}px)`,
                      }}
                    />
                  ))}
                  <div
                    className={`ns-st-hook absolute -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                      status === "confirmed" ? "border-ns-accent bg-ns-accent/20" : "border-foreground/70 bg-background"
                    }`}
                    style={{
                      left: g.hook.left,
                      top: g.hook.top,
                      width: 9,
                      height: 9,
                      opacity: status === "retracting" ? 0 : 1,
                    }}
                  />
                  {status !== "idle" && (
                    <div
                      data-tape-chip
                      className={`ns-st-chip pointer-events-auto absolute flex items-baseline gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 font-mono text-[11px] tabular-nums shadow-sm ${
                        status === "confirmed"
                          ? "border-ns-accent/50 bg-background text-ns-accent"
                          : "border-border bg-background text-foreground"
                      }`}
                      style={{
                        left: g.free.left,
                        top: g.free.top,
                        transform: g.anchorIsLo
                          ? "translate(6px, -50%)"
                          : "translate(calc(-100% - 6px), -50%)",
                        opacity: status === "retracting" ? 0 : 1,
                      }}
                    >
                      <span ref={countRef} className="ns-st-count">{nights}</span>
                      <span className="text-ns-muted">{nights === 1 ? "night" : "nights"}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          <div
            role="grid"
            id={gridId}
            aria-label={`${monthLabel}, choose a date range`}
            aria-describedby={readoutId}
            onKeyDown={onGridKeyDown}
            className="relative"
          >
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map(([abbr, full]) => (
                <div
                  key={abbr}
                  role="columnheader"
                  aria-label={full}
                  className="pb-1 text-center font-mono text-[10px] uppercase tracking-wider text-ns-muted"
                >
                  {abbr}
                </div>
              ))}
            </div>
            {Array.from({ length: 6 }, (_, r) => (
              <div key={r} role="row" className="grid grid-cols-7">
                {cells.slice(r * 7, r * 7 + 7).map((date, c) => {
                  const i = r * 7 + c;
                  const inMonth = date.getMonth() === view.m;
                  const isToday = sameDay(date, today);
                  const sel = isSelected(date);
                  const isEndpoint = sameDay(date, anchor) || sameDay(date, hoverDate);
                  return (
                    <button
                      key={i}
                      ref={(el) => {
                        cellElsRef.current[i] = el;
                      }}
                      type="button"
                      role="gridcell"
                      data-tape-cell
                      tabIndex={i === tabbableIdx ? 0 : -1}
                      aria-selected={sel}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={`${fmtFull(date)}${isEndpoint && status !== "idle" ? ", selection endpoint" : ""}`}
                      onFocus={() => setFocusedDate(date)}
                      className={`relative flex h-10 flex-col items-center justify-center rounded-sm pb-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ns-accent ${
                        sel
                          ? status === "confirmed"
                            ? "text-ns-accent"
                            : "text-foreground"
                          : inMonth
                            ? "text-foreground hover:bg-foreground/[0.06]"
                            : "text-ns-muted/60 hover:bg-foreground/[0.04]"
                      }`}
                    >
                      <span
                        className={
                          isToday && !sel ? "underline decoration-ns-muted underline-offset-[3px]" : ""
                        }
                      >
                        {date.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div ref={liveRef} role="status" aria-live="polite" className="sr-only" />
    </div>
  );
}
