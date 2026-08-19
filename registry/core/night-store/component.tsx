"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// HeaterRack — a cache diagnostics panel where every key-group is a
// storage-heater brick holding heat. One rule drives every brick: its
// temperature T is a pure function of elapsed time since its last hit,
// T(dt) = exp(-dt / tau) with tau = ttlMs/3000 seconds — chosen so a
// never-hit entry already reads visibly cold at roughly a third of its
// lifetime, early enough to PREDICT an eviction rather than report one. A
// hit resets a brick's clock (T snaps to 1); the "single fast charge ease"
// the brief asks for is realized as a plain ~220ms CSS opacity transition on
// each stipple dot, not a hand-rolled JS ramp — the same trick this
// registry already uses for its other scalar-driven surfaces (see
// button-cooldown-heat's --heat). Temperature never touches color: it is
// rendered purely as glyph-density STIPPLE (a fixed pool of deterministic,
// per-brick dot positions, radially ranked so a warming brick fills from its
// own center outward) quantized to a 5-level ramp — level = floor(T*5).
//
// Every visual property of a brick derives from ITS OWN T and nothing else.
// There is no shared clock, stagger, or wave across the rack: two bricks
// with identical hit histories always look identical, and a brick being hit
// over and over while its neighbors sit idle visibly flickers cold-hot
// against a static field — that contrast is the component's only
// diagnostic value, so nothing here is allowed to move the whole rack in
// unison.
//
// The rack's order is exactly the order of the `entries` prop and is NEVER
// re-sorted by temperature — re-sorting would make it impossible to track
// one brick's heat over time, which is the entire point of a diagnostics
// view. An id that drops out of `entries` (a real eviction) doesn't vanish;
// it plays a brief "leaving" contraction (max-width/opacity/margin easing
// to zero) and only then leaves the DOM, so the rack visibly contracts by
// exactly one slot instead of jump-cutting.
//
// Each brick is `role="listitem"` carrying the full diagnostic sentence in
// its own aria-label (key-group, hit count, a T/tau-derived eviction
// forecast) so a screen reader can walk the list without touching anything.
// The stipple SVG itself is aria-hidden. Anything beyond that summary — raw
// temperature, TTL, last-hit age — sits behind a real per-brick disclosure
// button (never a hover-only tooltip), which is also what keeps the
// component keyboard-reachable: a diagnostics grid otherwise has no natural
// "control" at all. Header stats (hit ratio, entry count, evictions/min)
// are live numbers; a separate sr-only aria-live=polite region announces
// only when `hitRatio` crosses the caller-supplied
// `hitRatioAlertThreshold`, never on every tick.
//
// DOM + SVG + CSS only, no canvas. Every ink value is --foreground over
// --ns-muted/--border/--background; --ns-accent appears solely on the
// disclosure button's focus ring.
// ---------------------------------------------------------------------------

export interface CacheEntryInput {
  /** stable identity for this cache entry/shard */
  id: string;
  /** the key-group label rendered on the brick, e.g. "user:profile" */
  keyGroup: string;
  /** this entry's TTL in ms — tau (the decay time-constant) is ttlMs / 3 */
  ttlMs: number;
  /** cumulative hit count, owned by the caller */
  hitCount: number;
  /** epoch ms of this entry's most recent hit (or creation, if never hit again) */
  lastHitAt: number;
}

export interface HeaterRackProps {
  /**
   * The tracked key-groups, in the fixed diagnostic order the rack renders
   * them — this order is never touched by the component. An id that drops
   * out of a later `entries` array is treated as a real eviction and
   * animates out; a new id is appended as a new brick.
   */
  entries: CacheEntryInput[];
  /** rolling hit ratio, 0..1, shown in the header. Caller computes this — the rack doesn't infer it from `entries`. */
  hitRatio: number;
  /** evictions observed in the last 60s, shown in the header. */
  evictionsPerMin: number;
  /** if set, the sr-only live region announces only when hitRatio crosses this value (either direction). */
  hitRatioAlertThreshold?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

interface BrickRow {
  id: string;
  entry: CacheEntryInput;
  leaving: boolean;
}

const POOL_SIZE = 16;
const EVICT_TH = 0.15; // T below this reads as "at risk now" in the forecast text
const POLL_MS_NORMAL = 220;
const POLL_MS_REDUCED = 1000;
const LEAVE_MS = 260;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic, per-id stipple pool in normalized [0,1] space, ranked by
 *  distance from center so the reveal order (see `visibleCount`) fills a
 *  warming brick from its own core outward. Computed once per id and cached
 *  on a ref for the component's lifetime — positions never change. */
function stipplePool(id: string): { x: number; y: number }[] {
  const rng = mulberry32(hashStr(id));
  const pts = Array.from({ length: POOL_SIZE }, () => ({ x: rng(), y: rng() }));
  pts.sort((a, b) => Math.hypot(a.x - 0.5, a.y - 0.5) - Math.hypot(b.x - 0.5, b.y - 0.5));
  return pts;
}

function computeT(nowMs: number, entry: CacheEntryInput): number {
  const dt = Math.max(0, (nowMs - entry.lastHitAt) / 1000);
  if (dt === 0) return 1;
  const tau = Math.max(0.05, entry.ttlMs / 3000);
  return Math.exp(-dt / tau);
}

function levelFromT(t: number): number {
  return Math.min(4, Math.max(0, Math.floor(t * 5)));
}

function visibleCount(level: number): number {
  return Math.round((level / 4) * POOL_SIZE);
}

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function forecastText(t: number, entry: CacheEntryInput): string {
  if (t >= 0.94) return "just hit, full heat";
  if (t <= EVICT_TH) return "cold, at risk of eviction now";
  const tau = Math.max(0.05, entry.ttlMs / 3000);
  const secs = Math.max(1, Math.round(tau * Math.log(t / EVICT_TH)));
  return `cooling, likely evicted in ~${secs}s`;
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

export function HeaterRack({
  entries,
  hitRatio,
  evictionsPerMin,
  hitRatioAlertThreshold,
  className = "",
}: HeaterRackProps) {
  const uid = useId();
  const reduced = useReducedMotion();

  // -- ordered rows: mirrors `entries` exactly while an id is present, keeps
  // a departed id around (marked `leaving`) just long enough to animate the
  // rack's contraction, and never reorders anything itself.
  const [rows, setRows] = useState<BrickRow[]>(() =>
    entries.map((entry) => ({ id: entry.id, entry, leaving: false }))
  );
  const leaveTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const byId = new Map(entries.map((e) => [e.id, e]));
    setRows((prev) => {
      const next: BrickRow[] = [];
      const seen = new Set<string>();
      for (const row of prev) {
        seen.add(row.id);
        const live = byId.get(row.id);
        if (live) {
          next.push({ id: row.id, entry: live, leaving: false });
        } else if (row.leaving) {
          next.push(row); // already animating out
        } else {
          next.push({ ...row, leaving: true });
          const timer = window.setTimeout(() => {
            setRows((cur) => cur.filter((r) => r.id !== row.id));
            leaveTimersRef.current.delete(row.id);
          }, LEAVE_MS);
          const prior = leaveTimersRef.current.get(row.id);
          if (prior) window.clearTimeout(prior);
          leaveTimersRef.current.set(row.id, timer);
        }
      }
      for (const entry of entries) {
        if (!seen.has(entry.id)) next.push({ id: entry.id, entry, leaving: false });
      }
      return next;
    });
  }, [entries]);

  useEffect(() => {
    const timers = leaveTimersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  // -- periodic recompute of T for every brick. T is a pure function of
  // elapsed time, so there's nothing to simulate frame-by-frame — this just
  // re-samples it, at 1Hz under reduced motion per the spec, faster
  // otherwise so the fast charge-ease reads smoothly.
  const [tick, setTick] = useState(0);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  useEffect(() => {
    let id = 0;
    const schedule = () => {
      id = window.setTimeout(() => {
        setTick((t) => t + 1);
        schedule();
      }, reducedRef.current ? POLL_MS_REDUCED : POLL_MS_NORMAL);
    };
    schedule();
    return () => window.clearTimeout(id);
  }, []);

  const now = useMemo(() => Date.now(), [tick]);

  const poolCacheRef = useRef<Map<string, { x: number; y: number }[]>>(new Map());
  const poolFor = (id: string) => {
    let pool = poolCacheRef.current.get(id);
    if (!pool) {
      pool = stipplePool(id);
      poolCacheRef.current.set(id, pool);
    }
    return pool;
  };

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // -- threshold-crossing announcement only, never a per-tick readout.
  const [announce, setAnnounce] = useState("");
  const prevAboveRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (hitRatioAlertThreshold == null) return;
    const above = hitRatio >= hitRatioAlertThreshold;
    if (prevAboveRef.current !== null && prevAboveRef.current !== above) {
      const pct = Math.round(hitRatioAlertThreshold * 100);
      setAnnounce(
        above
          ? `Hit ratio recovered above ${pct}%.`
          : `Hit ratio dropped below ${pct}% — cache under pressure.`
      );
    }
    prevAboveRef.current = above;
  }, [hitRatio, hitRatioAlertThreshold]);

  return (
    <div className={`ns-hr-root ${className}`}>
      <style>{CSS}</style>

      <dl className="m-0 flex flex-wrap gap-x-6 gap-y-2 p-0" aria-label="Cache health">
        <div className="flex flex-col gap-0.5">
          <dt className="m-0 font-mono text-[10px] uppercase tracking-wider text-ns-muted">Hit ratio</dt>
          <dd className="m-0 font-mono text-sm font-semibold tabular-nums text-foreground">
            {Math.round(hitRatio * 100)}%
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="m-0 font-mono text-[10px] uppercase tracking-wider text-ns-muted">Entries</dt>
          <dd className="m-0 font-mono text-sm font-semibold tabular-nums text-foreground">{entries.length}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="m-0 font-mono text-[10px] uppercase tracking-wider text-ns-muted">Evictions/min</dt>
          <dd className="m-0 font-mono text-sm font-semibold tabular-nums text-foreground">{evictionsPerMin}</dd>
        </div>
      </dl>

      <ul className="ns-hr-rack m-0 mt-3 flex flex-wrap p-0" style={{ listStyle: "none" }}>
        {rows.map((row, index) => {
          const t = row.leaving ? 0 : computeT(now, row.entry);
          const level = levelFromT(t);
          const shown = visibleCount(level);
          const pool = poolFor(row.id);
          const isExpanded = expanded.has(row.id);
          const detailId = `${uid}-detail-${row.id}`;
          const forecast = forecastText(t, row.entry);
          const hitNoun = row.entry.hitCount === 1 ? "hit" : "hits";
          const ariaLabel = `${row.entry.keyGroup}, ${row.entry.hitCount} ${hitNoun}, ${forecast}`;

          return (
            <li
              key={row.id}
              role="listitem"
              aria-label={ariaLabel}
              data-ns-brick-index={index}
              className={`ns-hr-brick ${row.leaving ? "ns-hr-brick-leaving" : ""}`}
              style={{ "--t": t.toFixed(3) } as CSSProperties}
            >
              <div className="ns-hr-stipple" aria-hidden="true">
                <svg viewBox="0 0 1 1" preserveAspectRatio="none" focusable="false">
                  {pool.map((p, k) => (
                    <circle
                      key={k}
                      cx={p.x}
                      cy={p.y}
                      r={0.055}
                      className="ns-hr-dot"
                      style={{ opacity: k < shown ? 1 : 0 }}
                    />
                  ))}
                </svg>
              </div>

              <div className="mt-1.5 flex items-baseline justify-between gap-1.5">
                <span className="truncate font-mono text-[10px] text-foreground">{row.entry.keyGroup}</span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-ns-muted">
                  {row.entry.hitCount}
                </span>
              </div>

              <button
                type="button"
                data-ns-disclosure
                aria-expanded={isExpanded}
                aria-controls={detailId}
                onClick={() => toggleExpanded(row.id)}
                className="ns-hr-disclosure mt-1.5 flex w-full items-center justify-center rounded-[6px] border border-border py-0.5 text-[11px] leading-none text-ns-muted transition-colors duration-150 hover:border-foreground/30 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                <span className="sr-only">
                  {isExpanded ? "Hide" : "Show"} details for {row.entry.keyGroup}
                </span>
                <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
              </button>

              {isExpanded ? (
                <dl
                  id={detailId}
                  data-ns-detail
                  className="mt-1.5 flex flex-col gap-0.5 border-t border-border pt-1.5"
                >
                  <div className="flex justify-between gap-2">
                    <dt className="m-0 font-mono text-[9px] text-ns-muted">Temp</dt>
                    <dd className="m-0 font-mono text-[9px] tabular-nums text-foreground">{Math.round(t * 100)}%</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="m-0 font-mono text-[9px] text-ns-muted">TTL</dt>
                    <dd className="m-0 font-mono text-[9px] tabular-nums text-foreground">
                      {fmtDuration(row.entry.ttlMs)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="m-0 font-mono text-[9px] text-ns-muted">Last hit</dt>
                    <dd className="m-0 font-mono text-[9px] tabular-nums text-foreground">
                      {fmtDuration(now - row.entry.lastHitAt)} ago
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="m-0 font-mono text-[9px] text-ns-muted">Forecast</dt>
                    <dd className="m-0 text-right font-mono text-[9px] text-foreground">{forecast}</dd>
                  </div>
                </dl>
              ) : null}
            </li>
          );
        })}
      </ul>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

const CSS = `
.ns-hr-brick {
  position: relative;
  box-sizing: border-box;
  width: 104px;
  max-width: 104px;
  margin: 0 8px 8px 0;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background-color: color-mix(in srgb, var(--background), var(--ns-muted) calc(var(--t, 0) * 7%));
  overflow: hidden;
  transition: max-width 260ms cubic-bezier(0.4,0,0.2,1), opacity 260ms ease-in, margin-right 260ms ease-in, padding-left 260ms ease-in, padding-right 260ms ease-in, border-width 260ms ease-in, background-color 220ms ease-out;
}
.ns-hr-brick-leaving {
  max-width: 0;
  width: 0;
  opacity: 0;
  margin-right: 0;
  padding-left: 0;
  padding-right: 0;
  border-left-width: 0;
  border-right-width: 0;
}
.ns-hr-stipple { width: 100%; height: 40px; }
.ns-hr-stipple svg { width: 100%; height: 100%; display: block; }
.ns-hr-dot { fill: var(--foreground); transition: opacity 220ms ease-out; }
@media (prefers-reduced-motion: reduce) {
  .ns-hr-brick { transition: none; }
  .ns-hr-dot { transition: none; }
}
`;
