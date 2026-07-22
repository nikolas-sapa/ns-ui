"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RidgeWalk — a model picker that renders the live Pareto frontier of
// cost / latency / quality as a single inline SVG ridgeline. Every model is
// plotted at x = a weighted blend of its normalized cost and latency (the
// blend depends on the speed/balance/quality toggle), y = its normalized
// quality score (higher score sits higher on the ridge). Models that no
// other model strictly beats-or-ties on cost AND latency while beating on
// score form the frontier and are connected by the ridge line as 2px
// cairns; every other model is dominated and sits, honestly, below the
// line as a --muted tick — still selectable, never hidden.
//
// Selection is a real radiogroup: one role="radio" per model (frontier and
// dominated alike), roving tabindex, Arrow/Home/End move AND commit in
// frontier (x) order — same "move commits" contract as chop-press. A drag
// on the ridge computes the nearest cairn by 1D distance along x ("Voronoi"
// snap zones) and commits on every zone crossing, so dragging is walking
// the thumb from cairn to cairn, never a free-floating pointer echo. The
// visual thumb, the ridge path, and every tick's x position transition with
// the same ease-out-expo curve (cubic-bezier(0.16,1,0.3,1)) already used
// elsewhere in this registry (chop-press) — a CSS transition on left/top/
// cx/cy/d rather than a hand-rolled spring, since the frontier's point count
// never changes between axis modes (only their x moves), so the path's `d`
// command sequence is stable and interpolates cleanly.
//
// The mono delta caption below the ridge is plain, decorative text (the
// ridge SVG is aria-hidden — all data lives in each radio's aria-label) and
// only updates once per COMMIT, never per pixel of drag, so it reads calm.
// A parallel sr-only aria-live=polite region carries the same delta as a
// sentence, read on every focus/commit change; a raw "+2.1s p50, -$0.14/1k"
// string is unpleasant read aloud, so the live region gets words instead.
//
// Colors: --foreground (ridge, frontier ticks), --muted (dominated ticks,
// captions), --border (baseline), --accent (selected tick + thumb — the
// only place accent appears, consistent with "interaction-only"). No
// canvas — pure SVG geometry plus real DOM buttons layered on top for the
// actual hit targets and accessible names.
// ---------------------------------------------------------------------------

export interface RidgeWalkModel {
  id: string;
  name: string;
  /** USD per 1,000 tokens (or requests) — lower is better. */
  cost: number;
  /** p50 latency in seconds — lower is better. */
  latency: number;
  /** Quality score, e.g. an eval percentage — higher is better. */
  score: number;
}

export type RidgeWalkAxisMode = "speed" | "balance" | "quality";

export interface RidgeWalkProps {
  /** The models to plot. Needs at least one entry to render controls. */
  models: RidgeWalkModel[];
  /** Controlled selected model id. */
  value?: string;
  /** Initial selected id when uncontrolled. Defaults to the frontier model closest to the midline. */
  defaultValue?: string;
  /** Fires on commit — click, drag zone-crossing, or an arrow/Home/End key move. */
  onValueChange?: (id: string) => void;
  /** Controlled axis-emphasis mode. */
  mode?: RidgeWalkAxisMode;
  /** Initial mode when uncontrolled. @default "balance" */
  defaultMode?: RidgeWalkAxisMode;
  onModeChange?: (mode: RidgeWalkAxisMode) => void;
  /** Accessible name for the model radiogroup. @default "Model" */
  label?: string;
  /** Word used for the score axis in captions and announcements, e.g. "MMLU". @default "quality" */
  scoreLabel?: string;
  className?: string;
}

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // ease-out-expo
const DUR_MS = 450;

// viewBox is a fixed 0-100 square with preserveAspectRatio="none", so a
// coordinate value IS the percentage of the rendered box on both axes —
// letting the DOM overlay buttons use plain left/top percentages that stay
// pixel-aligned with the SVG ticks at any container size, no ResizeObserver
// needed.
const PAD_X = 8;
const SPAN_X = 84;
const PAD_Y = 10;
const SPAN_Y = 78;

type Pt = { x: number; y: number };

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function norm(v: number, min: number, max: number): number {
  return max > min ? (v - min) / (max - min) : 0.5;
}

const AXIS_WEIGHTS: Record<RidgeWalkAxisMode, { cost: number; latency: number }> = {
  speed: { cost: 0.15, latency: 0.85 },
  balance: { cost: 0.5, latency: 0.5 },
  quality: { cost: 0.85, latency: 0.15 },
};

const AXIS_LABEL: Record<RidgeWalkAxisMode, string> = {
  speed: "Speed",
  balance: "Balance",
  quality: "Quality",
};

// A model D dominates M if D is no worse on cost AND latency AND score,
// and strictly better on at least one — the textbook Pareto relation.
// This is independent of the axis-emphasis mode: the mode only re-warps
// where things sit on screen, never what the frontier actually is.
function computeDominance(models: RidgeWalkModel[]): Map<string, string> {
  const dominatedBy = new Map<string, string>();
  for (const m of models) {
    for (const other of models) {
      if (other.id === m.id || dominatedBy.has(m.id)) continue;
      const notWorse =
        other.cost <= m.cost && other.latency <= m.latency && other.score >= m.score;
      const strictlyBetter =
        other.cost < m.cost || other.latency < m.latency || other.score > m.score;
      if (notWorse && strictlyBetter) dominatedBy.set(m.id, other.id);
    }
  }
  return dominatedBy;
}

function computePositions(
  models: RidgeWalkModel[],
  mode: RidgeWalkAxisMode
): Map<string, Pt> {
  const costs = models.map((m) => m.cost);
  const lats = models.map((m) => m.latency);
  const scores = models.map((m) => m.score);
  const costMin = Math.min(...costs);
  const costMax = Math.max(...costs);
  const latMin = Math.min(...lats);
  const latMax = Math.max(...lats);
  const scoreMin = Math.min(...scores);
  const scoreMax = Math.max(...scores);
  const w = AXIS_WEIGHTS[mode];
  const positions = new Map<string, Pt>();
  for (const m of models) {
    const cN = norm(m.cost, costMin, costMax);
    const lN = norm(m.latency, latMin, latMax);
    const sN = norm(m.score, scoreMin, scoreMax);
    const xN = clamp01(w.cost * cN + w.latency * lN);
    positions.set(m.id, {
      x: PAD_X + xN * SPAN_X,
      y: PAD_Y + (1 - sN) * SPAN_Y,
    });
  }
  return positions;
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

function fmtMoney(v: number): string {
  const a = Math.abs(v);
  return a < 1 ? `${Math.round(a * 100)}¢` : `$${a.toFixed(2)}`;
}

function fmtCompactDelta(
  curr: RidgeWalkModel,
  prev: RidgeWalkModel | null,
  scoreLabel: string
): string {
  if (!prev) {
    return `$${curr.cost.toFixed(2)}/1k · ${curr.latency.toFixed(1)}s p50 · ${Math.round(
      curr.score
    )} ${scoreLabel}`;
  }
  const dl = curr.latency - prev.latency;
  const dc = curr.cost - prev.cost;
  const ds = curr.score - prev.score;
  const l = `${dl >= 0 ? "+" : "-"}${Math.abs(dl).toFixed(1)}s p50`;
  const c = `${dc >= 0 ? "+" : "-"}${fmtMoney(dc)}/1k`;
  const s = `${ds >= 0 ? "+" : "-"}${Math.abs(Math.round(ds))} ${scoreLabel}`;
  return `${l} · ${c} · ${s}`;
}

function fmtWordDelta(
  curr: RidgeWalkModel,
  prev: RidgeWalkModel | null,
  scoreLabel: string,
  dominatorName?: string
): string {
  let sentence: string;
  if (!prev) {
    sentence = `${curr.name} selected. ${curr.latency.toFixed(
      1
    )} seconds p50, ${fmtMoney(curr.cost)} per thousand, ${Math.round(
      curr.score
    )} ${scoreLabel}.`;
  } else {
    const dl = curr.latency - prev.latency;
    const dc = curr.cost - prev.cost;
    const ds = curr.score - prev.score;
    const bits: string[] = [];
    if (Math.abs(dl) >= 0.05)
      bits.push(`${Math.abs(dl).toFixed(1)} seconds ${dl > 0 ? "slower" : "faster"}`);
    if (Math.abs(dc) >= 0.005)
      bits.push(`${fmtMoney(Math.abs(dc))} ${dc > 0 ? "more expensive" : "cheaper"} per thousand`);
    if (Math.abs(ds) >= 0.5)
      bits.push(`${Math.abs(Math.round(ds))} points ${ds > 0 ? "higher" : "lower"} ${scoreLabel}`);
    sentence = `${curr.name}: ${bits.length ? bits.join(", ") : "no meaningful change"}.`;
  }
  if (dominatorName) {
    sentence += ` Dominated by ${dominatorName} — same cost and latency is available there with higher ${scoreLabel}.`;
  }
  return sentence;
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: RidgeWalkAxisMode;
  onChange: (m: RidgeWalkAxisMode) => void;
}) {
  const order: RidgeWalkAxisMode[] = ["speed", "balance", "quality"];
  const refs = useRef<Map<RidgeWalkAxisMode, HTMLButtonElement>>(new Map());

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = order.indexOf(mode);
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(order.length - 1, idx + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(0, idx - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = order.length - 1;
    else return;
    e.preventDefault();
    const target = order[next];
    onChange(target);
    refs.current.get(target)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Axis emphasis"
      onKeyDown={onKeyDown}
      className="inline-flex gap-0.5 rounded-sm border border-border p-0.5"
    >
      {order.map((m) => {
        const checked = m === mode;
        return (
          <button
            key={m}
            ref={(el) => {
              if (el) refs.current.set(m, el);
              else refs.current.delete(m);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={AXIS_LABEL[m]}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(m)}
            className={`rounded-sm px-2 py-1 font-mono text-[10px] tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              checked ? "bg-foreground/[0.08] text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {AXIS_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}

export function RidgeWalk({
  models,
  value,
  defaultValue,
  onValueChange,
  mode,
  defaultMode = "balance",
  onModeChange,
  label = "Model",
  scoreLabel = "quality",
  className = "",
}: RidgeWalkProps) {
  const reducedMotion = useReducedMotion();
  const groupId = useId();

  const isModeControlled = mode !== undefined;
  const [internalMode, setInternalMode] = useState<RidgeWalkAxisMode>(defaultMode);
  const activeMode = isModeControlled ? (mode as RidgeWalkAxisMode) : internalMode;

  const dominatedBy = useMemo(() => computeDominance(models), [models]);
  const positions = useMemo(() => computePositions(models, activeMode), [models, activeMode]);

  const navOrder = useMemo(
    () =>
      [...models].sort((a, b) => positions.get(a.id)!.x - positions.get(b.id)!.x),
    [models, positions]
  );

  const frontier = useMemo(
    () => navOrder.filter((m) => !dominatedBy.has(m.id)),
    [navOrder, dominatedBy]
  );

  const byId = useMemo(() => new Map(models.map((m) => [m.id, m] as const)), [models]);

  // Initial pick when uncontrolled: the frontier model nearest the midline,
  // computed once at mount from that first render's frontier/positions.
  const [internalCommitted, setInternalCommitted] = useState<string>(() => {
    if (defaultValue) return defaultValue;
    const pool = frontier.length > 0 ? frontier : models;
    if (pool.length === 0) return "";
    let best = pool[0];
    let bestD = Infinity;
    for (const m of pool) {
      const d = Math.abs(positions.get(m.id)!.x - (PAD_X + SPAN_X / 2));
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best.id;
  });

  const isControlled = value !== undefined;
  const committedId = isControlled ? (value as string) : internalCommitted;

  const prevIdRef = useRef<string | null>(null);
  useEffect(() => {
    prevIdRef.current = committedId;
  }, [committedId]);

  const commit = (id: string) => {
    if (!isControlled) setInternalCommitted(id);
    if (id !== committedId) onValueChange?.(id);
  };

  const commitMode = (m: RidgeWalkAxisMode) => {
    if (!isModeControlled) setInternalMode(m);
    if (m !== activeMode) onModeChange?.(m);
  };

  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const nearestByFraction = (fracPct: number): RidgeWalkModel => {
    let best = navOrder[0];
    let bestD = Infinity;
    for (const m of navOrder) {
      const d = Math.abs(positions.get(m.id)!.x - fracPct);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  };

  const fractionFromClientX = (clientX: number): number | null => {
    const el = trackRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    return clamp01((clientX - rect.left) / rect.width) * 100;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (navOrder.length === 0) return;
    draggingRef.current = true;
    trackRef.current?.setPointerCapture(e.pointerId);
    const frac = fractionFromClientX(e.clientX);
    if (frac !== null) commit(nearestByFraction(frac).id);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const frac = fractionFromClientX(e.clientX);
    if (frac === null) return;
    const nearest = nearestByFraction(frac);
    if (nearest.id !== committedId) commit(nearest.id);
  };
  const endDrag = () => {
    draggingRef.current = false;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (navOrder.length === 0) return;
    const idx = navOrder.findIndex((m) => m.id === committedId);
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp")
      nextIdx = Math.min(navOrder.length - 1, (idx < 0 ? 0 : idx) + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown")
      nextIdx = Math.max(0, (idx < 0 ? 0 : idx) - 1);
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = navOrder.length - 1;
    else return;
    e.preventDefault();
    const next = navOrder[nextIdx];
    commit(next.id);
    btnRefs.current.get(next.id)?.focus();
  };

  if (models.length === 0 || !positions.has(committedId)) {
    return (
      <p className={`font-mono text-xs text-muted ${className}`}>
        No models to compare.
      </p>
    );
  }

  const currModel = byId.get(committedId) ?? models[0];
  const prevId = prevIdRef.current;
  const prevModel = prevId ? byId.get(prevId) ?? null : null;
  const dominatorId = dominatedBy.get(committedId);
  const dominatorName = dominatorId ? byId.get(dominatorId)?.name : undefined;
  const compactDelta = fmtCompactDelta(currModel, prevModel, scoreLabel);
  const wordDelta = fmtWordDelta(currModel, prevModel, scoreLabel, dominatorName);
  const thumb = positions.get(committedId)!;
  const transitionAll = reducedMotion
    ? "none"
    : `left ${DUR_MS}ms ${EASE}, top ${DUR_MS}ms ${EASE}`;

  const ridgeD = frontier
    .map((m, i) => {
      const p = positions.get(m.id)!;
      return `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className={`ns-rw-root w-full max-w-2xl ${className}`}>
      <div className="relative w-full" style={{ aspectRatio: "5 / 2" }}>
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <line
            x1={PAD_X}
            y1={PAD_Y + SPAN_Y}
            x2={PAD_X + SPAN_X}
            y2={PAD_Y + SPAN_Y}
            className="text-border"
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />

          {navOrder
            .filter((m) => dominatedBy.has(m.id))
            .map((m) => {
              const p = positions.get(m.id)!;
              return (
                <line
                  key={m.id}
                  x1={p.x}
                  x2={p.x}
                  y1={p.y - 3}
                  y2={p.y + 3}
                  className="text-muted"
                  stroke="currentColor"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  style={{ transition: reducedMotion ? "none" : `x1 ${DUR_MS}ms ${EASE}, x2 ${DUR_MS}ms ${EASE}` }}
                />
              );
            })}

          {ridgeD && (
            <path
              d={ridgeD}
              fill="none"
              className="text-foreground"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ transition: reducedMotion ? "none" : `d ${DUR_MS}ms ${EASE}` }}
            />
          )}

          {frontier.map((m) => {
            const p = positions.get(m.id)!;
            const checked = m.id === committedId;
            return (
              <line
                key={m.id}
                x1={p.x}
                x2={p.x}
                y1={p.y - 4}
                y2={p.y + 4}
                className={checked ? "text-accent" : "text-foreground"}
                stroke="currentColor"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                style={{ transition: reducedMotion ? "none" : `x1 ${DUR_MS}ms ${EASE}, x2 ${DUR_MS}ms ${EASE}` }}
              />
            );
          })}

          <circle
            cx={thumb.x}
            cy={thumb.y}
            r={3.2}
            className="text-accent"
            fill="currentColor"
            style={{ transition: reducedMotion ? "none" : `cx ${DUR_MS}ms ${EASE}, cy ${DUR_MS}ms ${EASE}` }}
          />
        </svg>

        <div
          ref={trackRef}
          role="radiogroup"
          aria-label={label}
          data-rw-ridge=""
          className="absolute inset-0 touch-none"
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {navOrder.map((m) => {
            const p = positions.get(m.id)!;
            const dominated = dominatedBy.has(m.id);
            const dId = dominatedBy.get(m.id);
            const dName = dId ? byId.get(dId)?.name : undefined;
            const checked = m.id === committedId;
            const accLabel = `${m.name}, $${m.cost.toFixed(2)} per thousand, ${m.latency.toFixed(
              1
            )} seconds p50, ${Math.round(m.score)} ${scoreLabel}${
              dominated && dName ? `, dominated by ${dName}` : ""
            }`;
            return (
              <button
                key={m.id}
                ref={(el) => {
                  if (el) btnRefs.current.set(m.id, el);
                  else btnRefs.current.delete(m.id);
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={accLabel}
                id={`${groupId}-${m.id}`}
                tabIndex={checked ? 0 : -1}
                onClick={() => commit(m.id)}
                style={{ left: `${p.x}%`, top: `${p.y}%`, transition: transitionAll }}
                className="absolute h-[34px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-sm border-0 bg-transparent p-0 hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
            );
          })}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted">
        <span>cheap · fast</span>
        <span>costly · slow</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-foreground" aria-hidden="true">
          {compactDelta}
        </p>
        <ModeToggle mode={activeMode} onChange={commitMode} />
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {wordDelta}
      </div>
    </div>
  );
}
