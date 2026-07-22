"use client";

// ---------------------------------------------------------------------------
// PhaseSwing — an indeterminate loader built as a physical pendulum wave.
// A row of hairline pendulums (1px arm in --muted, 4px bob in --foreground)
// share one mount instant but each gets its own animation-duration —
// periodMs / (BASE_OSCILLATIONS + i) — so pendulum i completes exactly
// BASE_OSCILLATIONS+i whole swings in one periodMs cycle. Because that
// count is an integer for every pendulum, the whole row is guaranteed to
// land back in phase, all at once, every periodMs — no JS drives that
// realignment, it falls out of picking integer-oscillation periods. Between
// realignments the same arithmetic passes the row through a travelling-wave
// phase and, at the half-cycle where every count differs from its neighbor
// by exactly one half-swing, a double-helix phase — pure interference, zero
// per-frame JS.
//
// The determinate variant (a `value` 0-100 prop) is the one place JS
// touches timing at all: each pendulum's duration is linearly retargeted
// from its natural period toward the middle pendulum's own natural period,
// so the whole row visibly detunes into unison exactly as value reaches
// 100 — converging on an existing rhythm in the row, not an arbitrary new
// one.
//
// A sync moment looks identical to "finished" by design (that's the point —
// it's a watchable heartbeat for a long wait) so completion is never
// inferred from rhythm: an explicit `done` prop is required to end the
// loader, and doing so changes the DOM structurally (every pendulum
// retracts upward and fades, animation paused mid-swing) rather than just
// letting a sync happen to land. The one text node is role=status/
// aria-live=polite and is the only place "done" is ever announced.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

const BASE_OSCILLATIONS = 8; // pendulum 0 completes this many full swings per periodMs cycle
const MIN_COUNT = 9;
const MAX_COUNT = 15;
const ANNOUNCE_STEP_S = 5; // sparse — ticks the visible/aria text every 5s, never per-frame

const CSS = `
.ns-ps-row{
  display:flex;
  align-items:flex-start;
  justify-content:center;
  gap:13px;
  height:76px;
  padding-top:6px;
}
.ns-ps-pendulum{
  position:relative;
  width:1px;
  height:64px;
  transform-origin:top center;
  animation-name:ns-ps-swing;
  animation-timing-function:cubic-bezier(.37,0,.63,1);
  animation-iteration-count:infinite;
  transition:transform 520ms cubic-bezier(.16,1,.3,1),
             opacity 420ms ease;
}
.ns-ps-arm{
  position:absolute;
  inset:0;
  width:1px;
  background:var(--muted);
}
.ns-ps-bob{
  position:absolute;
  left:50%;
  bottom:-2px;
  width:4px;
  height:4px;
  margin-left:-2px;
  border-radius:9999px;
  background:var(--foreground);
}
@keyframes ns-ps-swing{
  0%{transform:rotate(var(--ns-ps-amp))}
  50%{transform:rotate(calc(-1 * var(--ns-ps-amp)))}
  100%{transform:rotate(var(--ns-ps-amp))}
}
.ns-ps-row.ns-ps-done .ns-ps-pendulum{
  animation-play-state:paused;
  transition-delay:var(--ns-ps-retract-delay,0ms);
  transform:translateY(-140%);
  opacity:0;
}
@media (prefers-reduced-motion: reduce){
  .ns-ps-pendulum{
    animation:none;
    transition:opacity 200ms ease;
    transform:rotate(0deg);
  }
  .ns-ps-row.ns-ps-done .ns-ps-pendulum{
    transform:rotate(0deg);
    opacity:0;
  }
}
`;

export interface PhaseSwingProps {
  /** Text prefix for the status label, e.g. "Building" / "Indexing". */
  label?: string;
  /** Label shown (and announced) once `done` is true. */
  doneLabel?: string;
  /** Controlled 0-100 progress. Omit for pure ambient indeterminate mode. */
  value?: number;
  /** Explicit completion. Structural (pendulums retract) — never inferred from a sync moment. */
  done?: boolean;
  /** Full sync-chaos-sync cycle length, ms. */
  periodMs?: number;
  /** Pendulum count, clamped to 9-15. */
  count?: number;
  /** Half-angle of swing, degrees. */
  amplitudeDeg?: number;
  className?: string;
}

export function PhaseSwing({
  label = "Building",
  doneLabel = "Build complete",
  value,
  done = false,
  periodMs = 8000,
  count = 13,
  amplitudeDeg = 26,
  className = "",
}: PhaseSwingProps) {
  const n = Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(count)));

  // Natural period per pendulum: pendulum i completes BASE+i whole swings
  // in one periodMs cycle, so every one lands back at phase 0 simultaneously.
  const naturalPeriods = useMemo(
    () => Array.from({ length: n }, (_, i) => periodMs / (BASE_OSCILLATIONS + i)),
    [n, periodMs]
  );

  // Determinate retarget: converge every pendulum toward the middle
  // pendulum's own natural period (not an arbitrary new tempo) as value
  // climbs 0->100, landing exactly in unison at 100.
  const targetPeriod = naturalPeriods[Math.floor((n - 1) / 2)] ?? naturalPeriods[0]!;
  const durations = useMemo(() => {
    if (value == null) return naturalPeriods;
    const t = Math.min(100, Math.max(0, value)) / 100;
    return naturalPeriods.map((p) => p + (targetPeriod - p) * t);
  }, [naturalPeriods, targetPeriod, value]);

  // Sparse elapsed-time announcement, resets whenever a fresh run starts.
  const [elapsed, setElapsed] = useState(0);
  const wasDoneRef = useRef(done);
  useEffect(() => {
    if (wasDoneRef.current && !done) setElapsed(0);
    wasDoneRef.current = done;
  }, [done]);
  useEffect(() => {
    if (done) return;
    const id = window.setInterval(() => setElapsed((s) => s + ANNOUNCE_STEP_S), ANNOUNCE_STEP_S * 1000);
    return () => window.clearInterval(id);
  }, [done]);

  const statusText = done
    ? doneLabel
    : `${label}, ${elapsed} second${elapsed === 1 ? "" : "s"} elapsed`;

  return (
    <div role="status" aria-live="polite" className={`inline-flex flex-col items-center gap-3 ${className}`}>
      <style>{CSS}</style>
      <div className={done ? "ns-ps-row ns-ps-done" : "ns-ps-row"} aria-hidden="true">
        {durations.map((d, i) => {
          const style: CSSProperties = {
            animationDuration: `${d}ms`,
            // identical negative delay on every pendulum: nulls out any
            // one-frame paint stagger from mounting n elements in a single
            // React render (every pendulum is pre-advanced the same
            // wall-clock amount, which does not disturb relative phase).
            animationDelay: "-1ms",
            "--ns-ps-amp": `${amplitudeDeg}deg`,
            "--ns-ps-retract-delay": `${i * 22}ms`,
          } as CSSProperties;
          return (
            <span key={i} className="ns-ps-pendulum" style={style}>
              <span className="ns-ps-arm" />
              <span className="ns-ps-bob" />
            </span>
          );
        })}
      </div>
      <p className="font-mono text-xs text-muted">{statusText}</p>
    </div>
  );
}
