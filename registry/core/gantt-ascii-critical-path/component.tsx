"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// GanttAsciiCriticalPath — a project schedule whose critical path is COMPUTED,
// not annotated. A real CPM pass (Kahn topological order -> ES/EF forward ->
// LS/LF backward -> totalFloat = LS - ES) runs in one useMemo and decides one
// thing: a task with zero float draws the heavy accented set (┝━━┥), every
// other task the light set (├──┤). Dragging a bar re-runs the pass on the same
// frame, so handing slack to a different chain swaps the weights mid-gesture.
//
// No canvas, no rAF: every recompute is a direct response to pointer or key
// input. Empty timeline cells render nothing at all — the ink sits in the bars,
// the week ticks and the one `┊` today column.
//
// NO DEPENDENCY ARROWS. A connector lane anchored to the successor's row can
// place a predecessor's corner glyph at the right COLUMN but never at the right
// ROW, so every edge reads as leaving whatever task sits directly above. Doing
// it truthfully needs vertical routing across intervening rows — more apparatus
// than the edge earns: the bar WEIGHT already says which chain the ship date
// rides on, and that reads at rest with no pointer.
//
// PITCH: the timeline grid is laid out in `ch` units, not pixels. In a
// monospace face 1ch is exactly one advance width, so consecutive `─`/`━`
// glyphs butt up into a continuous rule at ANY font size and in any fallback
// font — a hardcoded px pitch dashes the bars the moment the two disagree.
// The drag handler needs a pixel figure, so it measures the row grid's real
// width / cols at pointerdown rather than assuming one.
// ---------------------------------------------------------------------------

export interface GanttTask {
  /** stable id, referenced by other tasks' deps */
  id: string;
  label: string;
  /** duration in days */
  duration: number;
  /** ids this task cannot start before */
  deps?: string[];
}

export interface GanttAsciiCriticalPathProps {
  tasks?: GanttTask[];
  /** timeline cells drawn per row */
  cols?: number;
  /** day index marked by the `┊` column. A fixed prop, never new Date() */
  today?: number;
  /** week number printed at the first tick */
  startWeek?: number;
  title?: string;
  className?: string;
}

const LABEL_CHARS = 16;

const DEFAULT_TASKS: GanttTask[] = [
  { id: "discovery", label: "Discovery interviews", duration: 4, deps: [] },
  { id: "wireframes", label: "Wireframe review", duration: 3, deps: ["discovery"] },
  { id: "design-system", label: "Design system", duration: 5, deps: ["wireframes"] },
  { id: "api-contract", label: "API contract", duration: 3, deps: ["discovery"] },
  { id: "integrate-payments", label: "Integrate payments", duration: 7, deps: ["api-contract"] },
  { id: "checkout-ui", label: "Checkout UI build", duration: 6, deps: ["design-system"] },
  { id: "launch-comms", label: "Launch comms", duration: 2, deps: ["design-system"] },
  {
    id: "qa-regression",
    label: "QA regression pass",
    duration: 4,
    deps: ["checkout-ui", "integrate-payments"],
  },
  { id: "ship", label: "Production rollout", duration: 3, deps: ["qa-regression", "launch-comms"] },
];

type Computed = {
  es: number;
  ef: number;
  ls: number;
  lf: number;
  float: number;
  critical: boolean;
  cyclic: boolean;
};

function padLabel(label: string): string {
  if (label.length <= LABEL_CHARS) return label.padEnd(LABEL_CHARS, " ");
  return `${label.slice(0, LABEL_CHARS - 1)}…`;
}

export function GanttAsciiCriticalPath({
  tasks = DEFAULT_TASKS,
  cols = 32,
  today = 9,
  startWeek = 12,
  title = "Checkout replatform",
  className = "",
}: GanttAsciiCriticalPathProps) {
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startOffset: number;
    prev: number;
    cellPx: number;
  } | null>(null);

  // --- CPM: Kahn topological order, forward pass, backward pass -------------
  const { plan, projectEnd, scale, bases } = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const indeg = new Map<string, number>();
    const succ = new Map<string, string[]>();
    for (const t of tasks) {
      const deps = (t.deps ?? []).filter((d) => byId.has(d) && d !== t.id);
      indeg.set(t.id, deps.length);
      for (const d of deps) succ.set(d, [...(succ.get(d) ?? []), t.id]);
    }
    const queue = tasks.filter((t) => (indeg.get(t.id) ?? 0) === 0).map((t) => t.id);
    const order: string[] = [];
    while (queue.length) {
      const id = queue.shift() as string;
      order.push(id);
      for (const s of succ.get(id) ?? []) {
        const n = (indeg.get(s) ?? 0) - 1;
        indeg.set(s, n);
        if (n === 0) queue.push(s);
      }
    }
    // Anything Kahn never drained sits on a cycle: excluded, never hung on.
    const inOrder = new Set(order);

    // FORWARD: ES = max(0, max(EF of deps) + manualOffset), EF = ES + duration
    const es = new Map<string, number>();
    const ef = new Map<string, number>();
    // earliest day a task could start on dependencies alone, before its manual
    // offset — the floor an ArrowLeft nudge must not drift below.
    const base0 = new Map<string, number>();
    for (const id of order) {
      const t = byId.get(id) as GanttTask;
      let base = 0;
      for (const d of t.deps ?? []) if (inOrder.has(d)) base = Math.max(base, ef.get(d) ?? 0);
      base0.set(id, base);
      const start = Math.max(0, base + (offsets[id] ?? 0));
      es.set(id, start);
      ef.set(id, start + Math.max(1, t.duration));
    }
    const end = order.reduce((m, id) => Math.max(m, ef.get(id) ?? 0), 1);

    // BACKWARD, reverse topological: LF = min(LS of successors) or projectEnd
    const ls = new Map<string, number>();
    const lf = new Map<string, number>();
    for (let i = order.length - 1; i >= 0; i--) {
      const id = order[i];
      const t = byId.get(id) as GanttTask;
      const outs = (succ.get(id) ?? []).filter((s) => inOrder.has(s));
      const late = outs.length ? Math.min(...outs.map((s) => ls.get(s) ?? end)) : end;
      lf.set(id, late);
      ls.set(id, late - Math.max(1, t.duration));
    }

    const map = new Map<string, Computed>();
    for (const t of tasks) {
      if (!inOrder.has(t.id)) {
        map.set(t.id, { es: 0, ef: 0, ls: 0, lf: 0, float: 0, critical: false, cyclic: true });
        continue;
      }
      const f = (ls.get(t.id) as number) - (es.get(t.id) as number);
      map.set(t.id, {
        es: es.get(t.id) as number,
        ef: ef.get(t.id) as number,
        ls: ls.get(t.id) as number,
        lf: lf.get(t.id) as number,
        float: f,
        // <= rather than ===: a drag can push a task to negative float
        // mid-gesture, and that row is still the tight one, not a slack one.
        critical: f <= 0,
        cyclic: false,
      });
    }
    return { plan: map, projectEnd: end, bases: base0, scale: Math.max(1, Math.ceil(end / cols)) };
  }, [tasks, offsets, cols]);

  // --- drag: pixel dx -> whole cells -> manualOffset, CPM re-runs live ------
  useEffect(() => {
    if (!dragId) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const cells = Math.round((e.clientX - d.startX) / d.cellPx);
      setOffsets((o) => ({ ...o, [d.id]: d.startOffset + cells * scale }));
    };
    const end = () => {
      dragRef.current = null;
      setDragId(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const d = dragRef.current;
      if (d) setOffsets((o) => ({ ...o, [d.id]: d.prev }));
      dragRef.current = null;
      setDragId(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("keydown", key);
    };
  }, [dragId, scale]);

  // Clamped both ways against the task's dependency-earliest start: at −base so
  // repeated ArrowLeft on a task already sitting at day 0 cannot accumulate
  // invisible negative offset that a later ArrowRight has to spend itself
  // unwinding, and at cols*scale − base so held ArrowRight cannot run ES past
  // aria-valuemax while the bar saturates at the last column. aria-valuenow
  // (the clamped ES) therefore stays in step with the stored offset.
  const nudge = (id: string, dir: number) =>
    setOffsets((o) => {
      const base = bases.get(id) ?? 0;
      const next = (o[id] ?? 0) + dir * scale;
      return { ...o, [id]: Math.min(cols * scale - base, Math.max(-base, next)) };
    });

  const colOf = (day: number) => Math.floor(day / scale);
  const todayCol = colOf(today);

  const geom = (id: string) => {
    const c = plan.get(id) as Computed;
    const start = Math.min(cols - 2, Math.max(0, colOf(c.es)));
    const len = Math.max(2, Math.min(cols - start, Math.round((c.ef - c.es) / scale)));
    return { start, len, c };
  };

  const active = hovered ?? focused;

  const readout = (() => {
    if (!active) {
      const crit = tasks.filter((t) => plan.get(t.id)?.critical && !plan.get(t.id)?.cyclic).length;
      const slack = tasks.length - crit;
      return `${projectEnd} days  critical chain ${crit} tasks  ${slack} tasks carry float`;
    }
    const t = tasks.find((x) => x.id === active) as GanttTask;
    const c = plan.get(active) as Computed;
    if (c.cyclic) return `${t.label}  ×  circular dependency, excluded from the pass`;
    return `${t.label}  ES ${c.es}  EF ${c.ef}  LS ${c.ls}  LF ${c.lf}  float ${c.float} day${
      c.float === 1 ? "" : "s"
    }`;
  })();

  // 1ch === one monospace advance, so `─` runs join with no seam at any size.
  const cell = "inline-block text-center";
  const cellStyle = { width: "1ch" } as const;
  const labelStyle = { width: `${LABEL_CHARS}ch` } as const;
  const trackStyle = { gridTemplateColumns: `repeat(${cols}, 1ch)` } as const;

  return (
    <section
      data-gantt
      aria-label={`${title} — Gantt chart with computed critical path`}
      className={`inline-flex select-none flex-col gap-3 font-mono text-[15px] leading-none ${className}`}
    >
      <div className="flex items-baseline justify-between gap-6">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">{title}</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
          <span className="text-accent">━</span> critical &nbsp; ─ has float
        </span>
      </div>

      <div className="flex flex-col gap-[3px]">
        {/* week labels */}
        <div className="flex items-center">
          <span className="shrink-0 whitespace-pre" style={labelStyle} />
          <span className={cell} style={cellStyle} />
          <div className="grid" style={trackStyle}>
            {Array.from({ length: cols }, (_, i) => {
              const day = i * scale;
              if (day % 7 !== 0) return null;
              return (
                <span
                  key={i}
                  className="whitespace-pre text-[10px] leading-none text-muted"
                  style={{ gridColumn: `${i + 1} / span 4` }}
                >
                  {`W${startWeek + day / 7}`}
                </span>
              );
            })}
          </div>
        </div>

        {/* ruler: `┬` every 7 days over a `─` rule, `┊` at today */}
        <div className="flex items-center">
          <span className="shrink-0 whitespace-pre" style={labelStyle} />
          <span className={`${cell} text-border`} style={cellStyle}>
            ┌
          </span>
          <div className="flex">
            {Array.from({ length: cols }, (_, i) => {
              const day = i * scale;
              const tick = day % 7 === 0;
              const isToday = i === todayCol;
              return (
                <span
                  key={i}
                  className={`${cell} ${
                    isToday ? "text-foreground" : tick ? "text-muted" : "text-muted/40"
                  }`}
                  style={cellStyle}
                >
                  {isToday ? "┊" : tick ? "┬" : "─"}
                </span>
              );
            })}
          </div>
        </div>

        {tasks.map((t) => {
          const { start, len, c } = geom(t.id);
          const isActive = active === t.id;
          const barGlyphs = c.critical
            ? `┝${"━".repeat(Math.max(0, len - 2))}┥`
            : `├${"─".repeat(Math.max(0, len - 2))}┤`;
          const todayFree = todayCol < start || todayCol >= start + len;

          return (
            <div
              key={t.id}
              data-task-row={t.id}
              className="flex items-center"
              onPointerEnter={() => setHovered(t.id)}
              onPointerLeave={() => setHovered((h) => (h === t.id ? null : h))}
            >
              <span
                className={`shrink-0 whitespace-pre text-[13px] transition-colors duration-[140ms] motion-reduce:transition-none ${
                  isActive || c.critical ? "text-foreground" : "text-muted"
                }`}
                style={labelStyle}
              >
                {padLabel(t.label)}
              </span>
              <span className={`${cell} text-border`} style={cellStyle}>
                │
              </span>

              {c.cyclic ? (
                <span className="whitespace-pre pl-1 text-[13px] text-muted">
                  ×  cycle — excluded
                </span>
              ) : (
                <div className="relative grid" style={trackStyle}>
                  <button
                    type="button"
                    role="slider"
                    aria-orientation="horizontal"
                    aria-valuemin={0}
                    aria-valuemax={cols * scale}
                    aria-valuenow={c.es}
                    aria-valuetext={`starts day ${c.es}, ends day ${c.ef}, ${
                      c.critical ? "on the critical path, no float" : `${c.float} days of float`
                    }`}
                    aria-label={`${t.label} schedule. Drag or use arrow keys to reschedule.`}
                    className="flex cursor-ew-resize items-center rounded-[2px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    style={{ gridColumn: `${start + 1} / span ${len}`, gridRow: 1 }}
                    onFocus={() => setFocused(t.id)}
                    onBlur={() => setFocused((f) => (f === t.id ? null : f))}
                    onPointerDown={(e) => {
                      // Measure the real pitch off the laid-out track instead
                      // of trusting a px constant to match the font metric.
                      const track = e.currentTarget.parentElement;
                      const w = track ? track.getBoundingClientRect().width : 0;
                      dragRef.current = {
                        id: t.id,
                        startX: e.clientX,
                        startOffset: offsets[t.id] ?? 0,
                        prev: offsets[t.id] ?? 0,
                        cellPx: w > 0 ? w / cols : 9,
                      };
                      setDragId(t.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        nudge(t.id, -1);
                      } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        nudge(t.id, 1);
                      } else if (e.key === "Escape" && !dragId) {
                        // Guarded on !dragId: mid-drag the window keydown
                        // listener owns Escape (it restores the pre-drag
                        // offset) and both firing would fight.
                        e.preventDefault();
                        setOffsets((o) => ({ ...o, [t.id]: 0 }));
                      }
                    }}
                  >
                    {barGlyphs.split("").map((ch, k) => (
                      <span
                        key={k}
                        className={`${cell} ${c.critical ? "text-accent" : "text-muted"}`}
                        style={cellStyle}
                      >
                        {ch}
                      </span>
                    ))}
                  </button>

                  {todayFree && todayCol >= 0 && todayCol < cols && (
                    <span
                      aria-hidden
                      className={`${cell} text-foreground`}
                      style={{
                        gridColumn: `${todayCol + 1} / span 1`,
                        gridRow: 1,
                        width: "1ch",
                      }}
                    >
                      ┊
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p
        aria-live="polite"
        className="rounded-sm border border-border bg-background px-3 py-2 text-[11px] tabular-nums text-muted"
      >
        {readout}
      </p>
    </section>
  );
}
