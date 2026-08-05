"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// RidgeWalk — a model picker rendered as the actual decision: a point on the
// cost/latency/quality Pareto frontier. It reads as a small scatter-plot
// instrument that self-explains at rest.
//
// Layout is a real chart. The y-axis is QUALITY (higher = up, labelled top-
// left where cheap-and-excellent never exists, so the corner is reliably
// empty). The x-axis is the cost/latency blend (cheaper·faster left →
// costlier·slower right; the speed/balance/quality toggle only re-weights
// that blend). The frontier — the models nothing strictly beats — is drawn as
// a single rising polyline with solid --foreground nodes: the line itself IS
// the tradeoff, you cannot climb in quality without moving right into cost.
//
// Dominated models are not hidden. Each is a hollow --ns-muted node sitting below
// the ridge, joined to it by a faint vertical connector whose LENGTH is the
// quality you leave on the table by picking it — the single most legible way
// to say "strictly worse". They stay fully selectable.
//
// Selection is a real radiogroup: one role="radio" per model (frontier and
// dominated alike), roving tabindex, Arrow/Home/End move AND commit in visual
// x-order. A drag anywhere on the plot snaps to the nearest node by 1D x
// distance (a Voronoi partition) and commits on every zone crossing, so
// dragging walks the selection node-to-node, never a free pointer echo. The
// selected node is the only --ns-accent in the component (a filled dot with a
// soft accent halo), matching "accent = interaction only".
//
// Beneath the plot a caption names the selected model, prints its three raw
// numbers, and — once per COMMIT, never per drag pixel — the concrete delta
// versus the previously selected model. A parallel sr-only aria-live region
// says the same change in words on every focus/commit. Dominated selections
// append who beats them and by how much.
//
// Nodes, ridge path `d`, and connectors all transition together on one
// ease-out-expo curve; the frontier's point count is constant across modes so
// the path interpolates cleanly. prefers-reduced-motion skips every one.
//
// No canvas (core). One aria-hidden SVG draws the lines (preserveAspectRatio
// "none" is safe for straight strokes with non-scaling-stroke); every DOT is
// a real DOM element positioned by percentage — so nodes stay perfect circles
// at any aspect ratio and the hit-target buttons stay pixel-aligned with the
// geometry with no ResizeObserver. All data lives in each radio's aria-label.
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
// letting the DOM overlay dots/buttons use plain left/top percentages that
// stay aligned with the SVG lines at any container size, no ResizeObserver.
const PAD_X = 9;
const SPAN_X = 82;
const PAD_Y = 15;
const SPAN_Y = 66;
const BASELINE_Y = PAD_Y + SPAN_Y;

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
// Independent of the axis-emphasis mode: the mode only re-warps where things
// sit on screen, never what the frontier actually is.
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

// Quality-height of the frontier ridge at an arbitrary x, by linear
// interpolation along the (x-sorted) frontier polyline. Used to draw the
// "quality left on the table" connector under each dominated node.
function ridgeYAt(x: number, frontierPts: Pt[]): number {
  const n = frontierPts.length;
  if (n === 0) return BASELINE_Y;
  if (x <= frontierPts[0]!.x) return frontierPts[0]!.y;
  if (x >= frontierPts[n - 1]!.x) return frontierPts[n - 1]!.y;
  for (let i = 1; i < n; i++) {
    const a = frontierPts[i - 1]!;
    const b = frontierPts[i]!;
    if (x <= b.x) {
      const t = b.x > a.x ? (x - a.x) / (b.x - a.x) : 0;
      return a.y + (b.y - a.y) * t;
    }
  }
  return frontierPts[n - 1]!.y;
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

function fmtCost(v: number): string {
  return `$${v.toFixed(2)}`;
}

function signedMoney(v: number): string {
  const sign = v >= 0 ? "+" : "−";
  const a = Math.abs(v);
  return `${sign}$${a.toFixed(2)}`;
}

function signedNum(v: number, digits: number, unit: string): string {
  const sign = v >= 0 ? "+" : "−";
  return `${sign}${Math.abs(v).toFixed(digits)}${unit}`;
}

// Concrete delta vs the previously selected model — printed once per commit.
function fmtDelta(
  curr: RidgeWalkModel,
  prev: RidgeWalkModel | null,
  scoreLabel: string
): string | null {
  if (!prev || prev.id === curr.id) return null;
  const dl = curr.latency - prev.latency;
  const dc = curr.cost - prev.cost;
  const ds = curr.score - prev.score;
  return `vs ${prev.name} ${signedNum(dl, 1, "s")} · ${signedMoney(
    dc
  )}/1k · ${signedNum(ds, 0, ` ${scoreLabel}`)}`;
}

function fmtWordDelta(
  curr: RidgeWalkModel,
  prev: RidgeWalkModel | null,
  scoreLabel: string,
  dominatorName?: string,
  dominatorScoreGain?: number
): string {
  let sentence: string;
  if (!prev || prev.id === curr.id) {
    sentence = `${curr.name} selected. ${curr.latency.toFixed(
      1
    )} seconds p50, ${fmtCost(curr.cost)} per thousand, ${Math.round(
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
      bits.push(
        `${fmtCost(Math.abs(dc))} ${dc > 0 ? "more expensive" : "cheaper"} per thousand`
      );
    if (Math.abs(ds) >= 0.5)
      bits.push(`${Math.abs(Math.round(ds))} points ${ds > 0 ? "higher" : "lower"} ${scoreLabel}`);
    sentence = `${curr.name}: ${bits.length ? bits.join(", ") : "no meaningful change"}.`;
  }
  if (dominatorName) {
    const gain =
      dominatorScoreGain && dominatorScoreGain >= 0.5
        ? ` — ${Math.round(dominatorScoreGain)} more ${scoreLabel} at no higher cost or latency`
        : ` — same cost and latency is available there with higher ${scoreLabel}`;
    sentence += ` Dominated by ${dominatorName}${gain}.`;
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
            className={`rounded-sm px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
              checked ? "bg-foreground/[0.08] text-foreground" : "text-ns-muted hover:text-foreground"
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
    () => [...models].sort((a, b) => positions.get(a.id)!.x - positions.get(b.id)!.x),
    [models, positions]
  );

  const frontier = useMemo(
    () => navOrder.filter((m) => !dominatedBy.has(m.id)),
    [navOrder, dominatedBy]
  );

  const byId = useMemo(() => new Map(models.map((m) => [m.id, m] as const)), [models]);

  // Initial pick when uncontrolled: the frontier model nearest the midline.
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
      <p className={`font-mono text-xs text-ns-muted ${className}`}>No models to compare.</p>
    );
  }

  const currModel = byId.get(committedId) ?? models[0];
  const prevId = prevIdRef.current;
  const prevModel = prevId ? byId.get(prevId) ?? null : null;
  const currDominatorId = dominatedBy.get(committedId);
  const currDominator = currDominatorId ? byId.get(currDominatorId) : undefined;
  const currDominatorGain = currDominator ? currDominator.score - currModel.score : undefined;
  const isSelectedDominated = !!currDominator;

  const deltaLine = fmtDelta(currModel, prevModel, scoreLabel);
  const wordDelta = fmtWordDelta(
    currModel,
    prevModel,
    scoreLabel,
    currDominator?.name,
    currDominatorGain
  );

  const frontierPts = frontier.map((m) => positions.get(m.id)!);
  const ridgeD = frontierPts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  const lineTransition = reducedMotion ? "none" : `d ${DUR_MS}ms ${EASE}`;
  const connectorTransition = reducedMotion
    ? "none"
    : `x1 ${DUR_MS}ms ${EASE}, x2 ${DUR_MS}ms ${EASE}, y1 ${DUR_MS}ms ${EASE}, y2 ${DUR_MS}ms ${EASE}`;
  const nodeTransition = reducedMotion ? "none" : `left ${DUR_MS}ms ${EASE}, top ${DUR_MS}ms ${EASE}`;

  const scoreWord = scoreLabel.toUpperCase();

  return (
    <div className={`ns-rw-root w-full max-w-xl ${className}`}>
      {/* ---- plot ---- */}
      <div className="relative w-full" style={{ aspectRatio: "8 / 5" }}>
        {/* y-axis intent: cheap-and-excellent doesn't exist, so top-left is empty */}
        <div className="pointer-events-none absolute left-0 top-0 flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ns-muted">
          <span aria-hidden="true">↑</span>
          {scoreWord}
        </div>

        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {/* baseline */}
          <line
            x1={PAD_X}
            y1={BASELINE_Y}
            x2={PAD_X + SPAN_X}
            y2={BASELINE_Y}
            className="text-border"
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />

          {/* "quality left on the table": dominated node up to the ridge */}
          {navOrder
            .filter((m) => dominatedBy.has(m.id))
            .map((m) => {
              const p = positions.get(m.id)!;
              const ry = ridgeYAt(p.x, frontierPts);
              if (p.y - ry <= 1.5) return null;
              return (
                <line
                  key={m.id}
                  x1={p.x}
                  x2={p.x}
                  y1={ry}
                  y2={p.y}
                  className="text-ns-muted"
                  stroke="currentColor"
                  strokeWidth={1}
                  strokeOpacity={0.4}
                  vectorEffect="non-scaling-stroke"
                  style={{ transition: connectorTransition }}
                />
              );
            })}

          {/* the frontier ridge */}
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
              style={{ transition: lineTransition }}
            />
          )}
        </svg>

        {/* interactive layer: real DOM dots + hit targets, aligned by % */}
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
            const accLabel = `${m.name}, ${fmtCost(m.cost)} per thousand, ${m.latency.toFixed(
              1
            )} seconds p50, ${Math.round(m.score)} ${scoreLabel}${
              dominated ? `, dominated by ${dName}` : ", on the frontier"
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
                style={{ left: `${p.x}%`, top: `${p.y}%`, transition: nodeTransition }}
                className="group absolute flex h-9 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-sm border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
              >
                {/* accent halo — selection only */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ns-accent/15 transition-[width,height,opacity] duration-200 ${
                    checked ? "h-[22px] w-[22px] opacity-100" : "h-2 w-2 opacity-0"
                  }`}
                />
                {/* the node dot */}
                <span
                  aria-hidden="true"
                  className={`relative rounded-full transition-transform duration-150 ${
                    checked
                      ? "h-3 w-3 bg-ns-accent"
                      : dominated
                        ? "h-2 w-2 border border-ns-muted bg-background group-hover:scale-125"
                        : "h-[9px] w-[9px] bg-foreground group-hover:scale-125"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- x-axis meaning ---- */}
      <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-ns-muted">
        <span>cheaper · faster</span>
        <span>costlier · slower</span>
      </div>

      {/* ---- selected readout (self-explains at rest) ---- */}
      <div className="mt-4 rounded-md border border-border p-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
            {currModel.name}
          </h3>
          <span
            className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] ${
              isSelectedDominated ? "text-ns-muted" : "text-foreground"
            }`}
          >
            {isSelectedDominated ? "dominated" : "on frontier"}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 tabular-nums">
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ns-muted">Cost</dt>
            <dd className="mt-0.5 font-mono text-sm text-foreground">
              {fmtCost(currModel.cost)}
              <span className="text-ns-muted"> /1k</span>
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ns-muted">
              Latency
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-foreground">
              {currModel.latency.toFixed(1)}
              <span className="text-ns-muted">s</span>
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ns-muted">
              {scoreWord}
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-foreground">{Math.round(currModel.score)}</dd>
          </div>
        </dl>

        <p
          className="mt-3 h-4 truncate font-mono text-[11px] text-ns-muted"
          aria-hidden="true"
        >
          {isSelectedDominated && currDominator
            ? `${currDominator.name} gives ${signedNum(
                currDominator.score - currModel.score,
                0,
                ` ${scoreLabel}`
              )} at no higher cost or latency`
            : deltaLine ?? "nothing beats it on cost, latency and quality at once"}
        </p>
      </div>

      {/* ---- legend + axis toggle ---- */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3 font-mono text-[10px] text-ns-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-[9px] w-[9px] rounded-full bg-foreground" />
            frontier
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full border border-ns-muted bg-background"
            />
            dominated
          </span>
        </div>
        <ModeToggle mode={activeMode} onChange={commitMode} />
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {wordDelta}
      </div>
    </div>
  );
}
