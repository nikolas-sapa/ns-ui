"use client";

import { useEffect, useMemo, useState } from "react";

// A live multi-agent turn tracker: one hairline lane per agent, the lane
// currently holding the turn brightened to --foreground, idle lanes resting
// at --muted. This shows the PRESENT moment on a rolling `windowMs` window
// (a "now" line pins the right edge) — it is not a post-hoc trace viewer, so
// there is deliberately no scrub/seek control: adding one would turn this
// back into exactly the span-tree debugger it's meant to differ from. Past
// turns stay visible inside the window (dimmer than the live one) only so a
// handoff connector has two ends to draw between; once a turn's end falls
// behind the window it silently ages off the left, same as a real monitor.
//
// Concurrency (two+ lanes active at once, the normal shape of a parallel
// fan-out) needs no special case: any number of turns with no `end` can
// coexist across different agents and each just renders its own bar.
//
// A handoff connector (stepped DOM line + a Geist Mono duration chip) is
// drawn from a finished turn to the next turn on a DIFFERENT agent that
// starts at or after it ends (small slack for real-world event jitter) —
// i.e. a genuine baton pass, not two turns that happen to overlap. One
// finished turn can feed more than one connector (a fan-out reads as one
// source splitting into two stepped lines). Labels are packed against real
// collisions, not just parity-staggered: walking left→right, each label
// drops into the lowest stacking level whose last-placed label sits at
// least LABEL_MIN_SEP_PCT away in x (even levels above the rail, odd below,
// each extra pair stepping one row further out), so three or more handoffs
// close together in x fan into that many legible rows instead of one smear.
//
// Beyond MAX_LANES agents the extra rows collapse into one aggregate "+N
// more" lane that brightens with a live count badge when any of them are
// active, but never participates in handoff connectors (there's no single
// row to draw a line to) — a stated degrade, not a silent one.
//
// Pure DOM: every bar/hairline/connector segment is a plain absolutely
// positioned div, positioned with independent left:%/top:px so nothing goes
// through a scaled SVG viewBox (which would stretch mono text). No canvas,
// no SVG. Zero dependencies.

export interface RelayLaneAgent {
  id: string;
  label: string;
}

export interface RelayLaneTurn {
  /** stable id, unique across the whole run */
  id: string;
  agentId: string;
  /** ms timestamp the turn began */
  start: number;
  /** ms timestamp the turn ended — omit while the turn is still live */
  end?: number;
}

export interface RelayLaneProps {
  /** lane order, top to bottom */
  agents: RelayLaneAgent[];
  /** the run so far — append/mutate over time, oldest first is not required */
  turns: RelayLaneTurn[];
  /** accessible name for the region */
  label?: string;
  /** width of the rolling visible window, in ms */
  windowMs?: number;
  /** controlled "now" in ms — omit to let the component tick its own clock */
  now?: number;
  className?: string;
}

const MAX_LANES = 12;
const ROW_PITCH = 40;
const BAR_H = 4;
// Wide enough for a realistic agent name *plus* its running-duration chip. At
// 132px (and still at 156px for the longer names) the two together overflowed and truncated the label ("Orchestra…") —
// and only ever on the lane that was currently in flight, i.e. the one lane a
// reader most needs to identify.
const LABEL_W = 176;
const MIN_BAR_PCT = 1.2;
const HANDOFF_SLACK_MS = 400;
const LABEL_MIN_SEP_PCT = 10;

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Handoff {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  durationMs: number;
  band: "above" | "below";
  /** how many stagger rows out from the rail this label sits, per its band */
  tier: number;
}

export function RelayLane({
  agents,
  turns,
  label = "Agent turn tracker",
  windowMs = 20000,
  now: nowProp,
  className = "",
}: RelayLaneProps) {
  // uncontrolled clock: seeded to 0 so server/client first paint match, then
  // set to the real time and ticked once mounted. Fully controlled (nowProp
  // set) runs no timer at all.
  const [internalNow, setInternalNow] = useState(0);
  useEffect(() => {
    if (nowProp !== undefined) return;
    setInternalNow(Date.now());
    const id = window.setInterval(() => setInternalNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [nowProp]);
  const now = nowProp ?? internalNow;
  const windowStart = now - windowMs;

  const visibleAgents = agents.length > MAX_LANES ? agents.slice(0, MAX_LANES - 1) : agents;
  const overflowAgents = agents.length > MAX_LANES ? agents.slice(MAX_LANES - 1) : [];
  const hasOverflow = overflowAgents.length > 0;

  const rowIndex = useMemo(() => {
    const m = new Map<string, number>();
    visibleAgents.forEach((a, i) => m.set(a.id, i));
    return m;
  }, [visibleAgents]);

  const rowCount = visibleAgents.length + (hasOverflow ? 1 : 0);

  const openTurnByAgent = useMemo(() => {
    const m = new Map<string, RelayLaneTurn>();
    for (const t of turns) {
      if (t.end === undefined) m.set(t.agentId, t);
    }
    return m;
  }, [turns]);

  const overflowActiveCount = overflowAgents.filter((a) =>
    openTurnByAgent.has(a.id)
  ).length;

  // handoffs: for every turn, its predecessor is the most-recently-ended
  // OTHER-agent turn that finished at or before it starts (+ slack)
  const handoffs = useMemo<Handoff[]>(() => {
    const finished = turns.filter((t) => t.end !== undefined);
    const sorted = [...turns].sort((a, b) => a.start - b.start);
    const raw: { from: RelayLaneTurn; to: RelayLaneTurn; midX: number }[] = [];

    for (const t of sorted) {
      let best: RelayLaneTurn | undefined;
      for (const f of finished) {
        if (f.id === t.id || f.agentId === t.agentId) continue;
        if (f.end! <= t.start + HANDOFF_SLACK_MS) {
          if (!best || f.end! > best.end!) best = f;
        }
      }
      if (!best) continue;
      if (best.end! < windowStart) continue; // aged fully out of view
      const fromRow = rowIndex.get(best.agentId);
      const toRow = rowIndex.get(t.agentId);
      if (fromRow === undefined || toRow === undefined) continue; // overflowed lane

      const x1 = Math.min(100, Math.max(0, ((best.end! - windowStart) / windowMs) * 100));
      const x2 = Math.min(100, Math.max(0, ((t.start - windowStart) / windowMs) * 100));
      raw.push({
        from: best,
        to: t,
        midX: (x1 + x2) / 2,
      });
    }

    // Real de-overlap, not a parity stagger: three or more handoffs whose
    // labels land close together in x (a fan-out from one source is exactly
    // this shape) all overprinted when the only escape was a single above/
    // below flip. Instead, walk the labels left→right and drop each into the
    // lowest stacking LEVEL whose most-recently-placed label is at least
    // LABEL_MIN_SEP_PCT away in x — the classic occupied-range packer. Even
    // levels ride above the rail, odd below; every additional pair of levels
    // (its `tier`) steps one row further out, so N coincident labels fan into
    // N legible rows instead of a single smear.
    const lastXByLevel: number[] = [];
    const levelByIndex = new Map<number, number>();
    [...raw.keys()]
      .sort((a, b) => raw[a]!.midX - raw[b]!.midX)
      .forEach((idx) => {
        let level = 0;
        while (
          lastXByLevel[level] !== undefined &&
          raw[idx]!.midX - lastXByLevel[level]! < LABEL_MIN_SEP_PCT
        ) {
          level++;
        }
        lastXByLevel[level] = raw[idx]!.midX;
        levelByIndex.set(idx, level);
      });

    return raw.map((h, i): Handoff => {
      const level = levelByIndex.get(i) ?? 0;
      const band: "above" | "below" = level % 2 === 0 ? "above" : "below";
      const tier = Math.floor(level / 2);

      const fromRow = rowIndex.get(h.from.agentId)!;
      const toRow = rowIndex.get(h.to.agentId)!;
      const x1 = Math.min(100, Math.max(0, ((h.from.end! - windowStart) / windowMs) * 100));
      const x2 = Math.min(100, Math.max(0, ((h.to.start - windowStart) / windowMs) * 100));

      return {
        key: `${h.from.id}->${h.to.id}`,
        x1,
        y1: fromRow * ROW_PITCH + ROW_PITCH / 2,
        x2,
        y2: toRow * ROW_PITCH + ROW_PITCH / 2,
        durationMs: h.from.end! - h.from.start,
        band,
        tier,
      };
    });
  }, [turns, rowIndex, windowStart, windowMs]);

  const activeAgents = visibleAgents.filter((a) => openTurnByAgent.has(a.id));
  const summary =
    activeAgents.length === 0
      ? overflowActiveCount > 0
        ? `${overflowActiveCount} of the overflow agents are active.`
        : "No agent currently has the turn."
      : activeAgents.length === 1
        ? `${activeAgents[0]!.label} has the turn.`
        : `${activeAgents.map((a) => a.label).join(", ")} are active concurrently.`;

  return (
    <div
      role="region"
      aria-label={label}
      className={`rounded-md border border-border bg-surface p-4 ${className}`}
    >
      <div
        aria-hidden="true"
        className="mb-1 flex font-mono text-[9px] uppercase tracking-[0.14em] text-muted"
        style={{ paddingLeft: LABEL_W }}
      >
        <span className="flex-1 text-right">now</span>
      </div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${LABEL_W}px 1fr`,
          gridAutoRows: `${ROW_PITCH}px`,
        }}
      >
        {visibleAgents.map((a, i) => {
          const open = openTurnByAgent.get(a.id);
          const elapsed = open ? now - open.start : null;
          return (
            <div
              key={a.id}
              className="flex min-w-0 items-center gap-2 pr-3"
              style={{ gridColumn: 1, gridRow: i + 1 }}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  open
                    ? "bg-foreground motion-safe:animate-pulse"
                    : "bg-muted"
                }`}
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  open ? "text-foreground" : "text-muted"
                }`}
              >
                {a.label}
              </span>
              {elapsed !== null && (
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">
                  {formatDuration(elapsed)}
                </span>
              )}
            </div>
          );
        })}

        {hasOverflow && (
          <div
            className="flex min-w-0 items-center gap-2 pr-3"
            style={{ gridColumn: 1, gridRow: visibleAgents.length + 1 }}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                overflowActiveCount > 0
                  ? "bg-foreground motion-safe:animate-pulse"
                  : "bg-muted"
              }`}
            />
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                overflowActiveCount > 0 ? "text-foreground" : "text-muted"
              }`}
            >
              +{overflowAgents.length} more
            </span>
            {overflowActiveCount > 0 && (
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted">
                {overflowActiveCount} active
              </span>
            )}
          </div>
        )}

        {/* track overlay: spans the full lane stack, everything inside is
            positioned with independent left:%/top:px so no axis distorts
            the other */}
        <div
          className="relative overflow-hidden"
          style={{
            gridColumn: 2,
            gridRow: `1 / span ${rowCount}`,
          }}
        >
          {/* idle baseline: one full-width hairline per lane */}
          {visibleAgents.map((a, i) => (
            <div
              key={a.id}
              aria-hidden="true"
              className="absolute left-0 h-px w-full bg-muted"
              style={{ top: i * ROW_PITCH + ROW_PITCH / 2 }}
            />
          ))}
          {hasOverflow && (
            <div
              aria-hidden="true"
              className="absolute left-0 h-px w-full bg-muted"
              style={{ top: visibleAgents.length * ROW_PITCH + ROW_PITCH / 2 }}
            />
          )}

          {/* turn bars: finished turns dimmer, the live/open turn full
              brightness with a breathing pulse */}
          {turns.map((t) => {
            const row = rowIndex.get(t.agentId);
            if (row === undefined) return null;
            const effectiveEnd = t.end ?? now;
            if (effectiveEnd < windowStart) return null;
            const clampedStart = Math.max(t.start, windowStart);
            const clampedEnd = Math.min(effectiveEnd, now);
            if (clampedEnd <= clampedStart && t.end !== undefined) return null;
            const leftPct = ((clampedStart - windowStart) / windowMs) * 100;
            const widthPct = Math.max(
              ((clampedEnd - clampedStart) / windowMs) * 100,
              MIN_BAR_PCT
            );
            const isOpen = t.end === undefined;
            return (
              <div
                key={t.id}
                aria-hidden="true"
                className={`absolute rounded-full transition-[left,width] duration-500 ease-out motion-reduce:transition-none ${
                  isOpen
                    ? "bg-foreground motion-safe:animate-pulse"
                    : "bg-foreground/45"
                }`}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: row * ROW_PITCH + ROW_PITCH / 2 - BAR_H / 2,
                  height: BAR_H,
                }}
              />
            );
          })}

          {/* handoff connectors: stepped (horizontal/vertical/horizontal)
              lines built from plain divs, plus a mono duration chip */}
          {handoffs.map((h) => {
            const midX = (h.x1 + h.x2) / 2;
            const yTop = Math.min(h.y1, h.y2);
            const yBottom = Math.max(h.y1, h.y2);
            // each extra tier steps the label one 15px row further from the
            // rail, in its band's direction, so stacked labels never overlap
            const TIER_STEP = 18;
            const rawChipTop =
              h.band === "above"
                ? Math.min(h.y1, h.y2) - 20 - h.tier * TIER_STEP
                : Math.max(h.y1, h.y2) + 8 + h.tier * TIER_STEP;
            // clamp inside the (now overflow-hidden) track box so a handoff
            // touching the first or last lane never clips its own label
            const chipTop = Math.min(
              Math.max(rawChipTop, 0),
              rowCount * ROW_PITCH - 18
            );
            return (
              <div key={h.key} aria-hidden="true">
                <div
                  className="absolute h-px bg-foreground/25"
                  style={{
                    top: h.y1,
                    left: `${Math.min(h.x1, midX)}%`,
                    width: `${Math.abs(midX - h.x1)}%`,
                  }}
                />
                <div
                  className="absolute w-px bg-foreground/25"
                  style={{
                    left: `${midX}%`,
                    top: yTop,
                    height: yBottom - yTop,
                  }}
                />
                <div
                  className="absolute h-px bg-foreground/25"
                  style={{
                    top: h.y2,
                    left: `${Math.min(h.x2, midX)}%`,
                    width: `${Math.abs(h.x2 - midX)}%`,
                  }}
                />
                <div
                  className="absolute -translate-x-1/2 whitespace-nowrap rounded-sm border border-border bg-background px-1 py-0.5 font-mono text-[10px] tabular-nums text-muted"
                  style={{ left: `${midX}%`, top: chipTop }}
                >
                  {formatDuration(h.durationMs)}
                </div>
              </div>
            );
          })}

          {/* now line: the right edge is always the present moment */}
          <div
            aria-hidden="true"
            className="absolute right-0 top-0 w-px bg-border"
            style={{ height: rowCount * ROW_PITCH }}
          />
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {summary}
      </div>
    </div>
  );
}
