"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// StoreyPole — an indoor level switcher drawn as a true architectural
// cross-section rather than an abstract vertical list. Floors are horizontal
// slab bars stacked by their REAL relative heights: slab pixel height =
// storeyHeight(metres) x one shared px-per-metre scale, the same scale for
// every slab in the drawing. A double-height lobby is visibly taller than a
// mezzanine; nothing here ever renders two different storeys as identical
// bars, because that would make the section a fake.
//
// GOVERNING SCALAR: `e`, the selected level's datum elevation in metres
// (its finished-floor elevation, the bottom edge of its slab). Four things
// derive from `e`: the datum line's y position, which slab is visually
// highlighted, the plan viewport's crossfade pairing, and the readout text.
//
// MECHANISM: slabs never move — a section is a fixed drawing. Only the
// datum line moves, via an rAF mass-spring (k constant, zeta derived from
// how many floors were crossed: 1 floor is near-critically-damped with
// almost no overshoot, farther jumps progressively underdamp so the
// overshoot visibly scales with distance traveled — a fixed overshoot would
// make a 1-floor and an 8-floor jump feel identical). Pointer interaction on
// the cross-section drags the line continuously: it magnetizes to a slab's
// datum with a deadband 30% of THAT slab's own height, snapping there when
// close; outside every deadband it free-follows the pointer. The nearest
// slab is tracked as a live PREVIEW (drives the highlight, the plan
// crossfade and the readout) without touching the committed value or
// firing onValueChange until pointer-up.
//
// Below-grade slabs (elevation < 0) carry a 45-degree --border hatch fill
// down their left margin — the standard section convention for earth — so
// "below ground" reads before any label does.
//
// STRUCTURE: real native input type=radio per level (not wrapped in a
// <label>, since pointer commits are handled by the drag/click surface
// covering the whole section — but every native radio behavior arrow-key
// roving, Tab order, form participation, aria-checked comes free from the
// browser). Each radio's accessible name carries the real numbers: label,
// elevation phrase, optional name, and its immediate neighbors above/below.
// Arrow-key/commit changes push a spoken elevation delta ("up 3.6 m") into
// an aria-live region. The datum line and hatch are aria-hidden; reduced
// motion repositions the line instantly instead of springing, and skips the
// plan crossfade's fade in favor of an instant swap.
//
// Pure DOM + SVG + CSS. No canvas. Every ink color is one of --background
// --foreground --ns-muted --border --ns-accent, --ns-accent reserved for
// the keyboard focus ring only.
//
// Distinct from counterpoise-tiers: counterpoise-tiers stacks CONTENT by
// weight (an information hierarchy). StoreyPole stacks REAL BUILDING
// GEOMETRY — the metres behind every slab's proportion are printed in its
// accessible name, and the falsifiable constraint (shared px/metre scale)
// means the drawing is either an honest section or visibly wrong, never a
// stylistic choice.
// ---------------------------------------------------------------------------

export interface StoreyPoleLevel {
  /** Stable identifier, used as the native radio's value. */
  id: string;
  /** Short floor code, e.g. "3", "G", "M", "B2". */
  label: string;
  /** Optional descriptive name, e.g. "Engineering", "Lobby", "Parking". */
  name?: string;
  /** Finished-floor elevation in metres above ground (negative = below grade). */
  elevation: number;
  /** Storey height in metres — the ONLY thing that drives this slab's drawn height. */
  height: number;
}

export interface StoreyPoleProps {
  /** Accessible name for the radiogroup, e.g. "Select floor". */
  label: string;
  levels: StoreyPoleLevel[];
  /** Controlled selected level id. */
  value?: string;
  /** Initial value when uncontrolled. @default the level at elevation 0, else the topmost level */
  defaultValue?: string;
  /** called with the new level id when the committed selection changes */
  onValueChange?: (id: string) => void;
  /** Shared `name` for the native radios. @default a generated id */
  name?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

interface Geom {
  level: StoreyPoleLevel;
  top: number;
  height: number;
  bottom: number;
}

interface SpringState {
  raf: number;
  last: number;
  y: number;
  vy: number;
  target: number;
  zeta: number;
  deadline: number;
}

const PX_PER_METRE = 15;
const BAR_WIDTH = 44;
const SPRING_K = 300; // rad^2/s^2, constant — only zeta varies with distance
const BASE_SETTLE_MS = 280;
const PER_FLOOR_SETTLE_MS = 45;
const MAX_SETTLE_MS = 640;
const MIN_ZETA = 0.28;
const ZETA_STEP = 0.11;
const PLAN_FADE_MS = 220;
const DEADBAND_FRACTION = 0.3;

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

function elevationPhrase(elevation: number): string {
  if (elevation === 0) return "at ground level";
  const abs = Math.abs(elevation).toFixed(1);
  return elevation > 0 ? `${abs} m above ground` : `${abs} m below ground`;
}

function elevationShort(elevation: number): string {
  if (elevation === 0) return "±0.0 m";
  const sign = elevation > 0 ? "+" : "−";
  return `${sign}${Math.abs(elevation).toFixed(1)} m`;
}

function neighborName(g: Geom | undefined): string | undefined {
  if (!g) return undefined;
  return g.level.name ?? `Level ${g.level.label}`;
}

// --- deterministic per-level "plan" glyph -----------------------------------
// A tiny seeded PRNG (mulberry32, seeded from a FNV-1a hash of the level id)
// so each floor gets a stable, visually distinct abstract room layout across
// renders and reloads, with no per-render randomness.
function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function PlanGlyph({
  level,
  className,
}: {
  level: StoreyPoleLevel;
  className?: string;
}) {
  const rng = useMemo(() => mulberry32(seedFromString(level.id)), [level.id]);
  const cuts = useMemo(() => {
    const n = 2 + Math.floor(rng() * 3);
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < n; i++) {
      if (rng() > 0.5) {
        const x = 14 + rng() * 68;
        lines.push({ x1: x, y1: 6, x2: x, y2: 66 });
      } else {
        const y = 12 + rng() * 48;
        lines.push({ x1: 6, y1: y, x2: 90, y2: y });
      }
    }
    return lines;
  }, [rng]);
  const core = useMemo(
    () => ({
      x: 10 + rng() * 58,
      y: 10 + rng() * 42,
      w: 10 + rng() * 12,
      h: 8 + rng() * 10,
    }),
    [rng]
  );
  return (
    <svg
      viewBox="0 0 96 72"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x={2}
        y={2}
        width={92}
        height={68}
        className="text-border"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      {cuts.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          className="text-border"
          stroke="currentColor"
          strokeWidth={1}
        />
      ))}
      <rect
        x={core.x}
        y={core.y}
        width={core.w}
        height={core.h}
        className="text-ns-muted"
        fill="currentColor"
        fillOpacity={0.28}
        stroke="currentColor"
        strokeWidth={1}
      />
    </svg>
  );
}

export function StoreyPole({
  label,
  levels,
  value,
  defaultValue,
  onValueChange,
  name,
  className = "",
}: StoreyPoleProps) {
  const generatedName = useId();
  const groupName = name ?? generatedName;
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const sorted = useMemo(
    () => [...levels].sort((a, b) => b.elevation - a.elevation),
    [levels]
  );

  const geometry = useMemo<Geom[]>(() => {
    let acc = 0;
    return sorted.map((lvl) => {
      const px = Math.max(0, lvl.height) * PX_PER_METRE;
      const top = acc;
      acc += px;
      return { level: lvl, top, height: px, bottom: top + px };
    });
  }, [sorted]);

  const totalHeight = geometry.length
    ? geometry[geometry.length - 1].bottom
    : 0;

  const geomById = useMemo(
    () => new Map(geometry.map((g) => [g.level.id, g] as const)),
    [geometry]
  );
  const indexById = useMemo(
    () => new Map(sorted.map((l, i) => [l.id, i] as const)),
    [sorted]
  );

  const fallbackDefault = useMemo(() => {
    const ground = sorted.find((l) => l.elevation === 0);
    return ground?.id ?? sorted[0]?.id ?? "";
  }, [sorted]);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(
    () => defaultValue ?? fallbackDefault
  );
  const committedId = isControlled ? (value as string) : internal;

  const commit = useCallback(
    (id: string) => {
      if (!isControlled) setInternal(id);
      if (id !== committedId) onValueChange?.(id);
    },
    [isControlled, committedId, onValueChange]
  );

  // live preview id: mirrors committedId at rest, but tracks the
  // pointer-nearest slab during a drag scrub without committing.
  const [previewId, setPreviewId] = useState(committedId);
  const previewIdRef = useRef(previewId);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (draggingRef.current) return;
    previewIdRef.current = committedId;
    setPreviewId(committedId);
  }, [committedId]);

  // --- datum line spring -----------------------------------------------
  const lineRef = useRef<HTMLDivElement | null>(null);
  const springRef = useRef<SpringState | null>(null);
  if (!springRef.current) {
    const y = geomById.get(committedId)?.bottom ?? 0;
    springRef.current = { raf: 0, last: 0, y, vy: 0, target: y, zeta: 1, deadline: 0 };
  }

  const applyTransform = useCallback((y: number) => {
    const el = lineRef.current;
    if (el) el.style.transform = `translateY(${y}px)`;
  }, []);

  const setLineImmediate = useCallback(
    (px: number) => {
      const s = springRef.current!;
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.y = px;
      s.vy = 0;
      s.target = px;
      applyTransform(px);
    },
    [applyTransform]
  );

  const loop = useCallback(
    (now: number) => {
      const s = springRef.current!;
      s.raf = 0;
      const dt = s.last ? Math.min(0.033, (now - s.last) / 1000) : 1 / 60;
      s.last = now;
      const c = 2 * s.zeta * Math.sqrt(SPRING_K);
      s.vy += (-SPRING_K * (s.y - s.target) - c * s.vy) * dt;
      s.y += s.vy * dt;
      const settled =
        now >= s.deadline || (Math.abs(s.y - s.target) < 0.3 && Math.abs(s.vy) < 4);
      if (settled) {
        s.y = s.target;
        s.vy = 0;
        applyTransform(s.y);
        return;
      }
      applyTransform(s.y);
      s.raf = requestAnimationFrame(loop);
    },
    [applyTransform]
  );

  const springTo = useCallback(
    (px: number, dist: number) => {
      if (reducedMotionRef.current) {
        setLineImmediate(px);
        return;
      }
      const s = springRef.current!;
      s.target = px;
      s.zeta = Math.max(MIN_ZETA, 1 - (dist - 1) * ZETA_STEP);
      s.deadline =
        performance.now() +
        Math.min(MAX_SETTLE_MS, BASE_SETTLE_MS + (dist - 1) * PER_FLOOR_SETTLE_MS);
      s.last = 0;
      if (!s.raf) s.raf = requestAnimationFrame(loop);
    },
    [loop, setLineImmediate]
  );

  useEffect(() => {
    return () => {
      const s = springRef.current;
      if (s?.raf) cancelAnimationFrame(s.raf);
    };
  }, []);

  // reposition (spring, or instantly under reduced motion) whenever the
  // COMMITTED value actually changes — via click, keyboard, drag-release,
  // or a controlled `value` prop update. `dist` is the number of floors
  // crossed since the last commit, which is what makes the overshoot scale
  // with distance rather than being a fixed constant.
  const prevIdxRef = useRef<number | null>(null);
  useEffect(() => {
    const idx = indexById.get(committedId);
    const g = geomById.get(committedId);
    if (idx === undefined || !g) return;
    if (prevIdxRef.current === null) {
      setLineImmediate(g.bottom);
      prevIdxRef.current = idx;
      return;
    }
    if (prevIdxRef.current === idx) return;
    const dist = Math.max(1, Math.abs(idx - prevIdxRef.current));
    prevIdxRef.current = idx;
    springTo(g.bottom, dist);
  }, [committedId, indexById, geomById, springTo, setLineImmediate]);

  // --- drag / scrub -------------------------------------------------------
  const sectionRef = useRef<HTMLDivElement | null>(null);

  const nearestGeom = useCallback(
    (px: number): Geom | undefined => {
      let best: Geom | undefined;
      let bestD = Infinity;
      for (const g of geometry) {
        const d = Math.abs(g.bottom - px);
        if (d < bestD) {
          bestD = d;
          best = g;
        }
      }
      return best;
    },
    [geometry]
  );

  const updateFromClientY = useCallback(
    (clientY: number) => {
      const el = sectionRef.current;
      if (!el || geometry.length === 0) return;
      const rect = el.getBoundingClientRect();
      const raw = Math.min(totalHeight, Math.max(0, clientY - rect.top));
      const nearest = nearestGeom(raw);
      if (!nearest) return;
      const deadband = nearest.height * DEADBAND_FRACTION;
      const within = Math.abs(raw - nearest.bottom) < deadband / 2;
      setLineImmediate(within ? nearest.bottom : raw);
      previewIdRef.current = nearest.level.id;
      setPreviewId(nearest.level.id);
    },
    [geometry, totalHeight, nearestGeom, setLineImmediate]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (geometry.length === 0) return;
      draggingRef.current = true;
      sectionRef.current?.setPointerCapture(e.pointerId);
      updateFromClientY(e.clientY);
    },
    [geometry.length, updateFromClientY]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      updateFromClientY(e.clientY);
    },
    [updateFromClientY]
  );

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const id = previewIdRef.current;
    const g = geomById.get(id);
    commit(id);
    if (g) springTo(g.bottom, 1);
  }, [geomById, commit, springTo]);

  // --- announcements --------------------------------------------------
  const [announcement, setAnnouncement] = useState("");
  const prevElevRef = useRef<number | null>(null);
  useEffect(() => {
    const g = geomById.get(committedId);
    if (!g) return;
    const elev = g.level.elevation;
    if (prevElevRef.current === null) {
      prevElevRef.current = elev;
      return;
    }
    const delta = elev - prevElevRef.current;
    prevElevRef.current = elev;
    if (delta === 0) {
      setAnnouncement(`Level ${g.level.label} selected`);
      return;
    }
    const dir = delta > 0 ? "up" : "down";
    setAnnouncement(`${dir} ${Math.abs(delta).toFixed(1)} m to Level ${g.level.label}`);
  }, [committedId, geomById]);

  // --- plan viewport crossfade -----------------------------------------
  const [outgoingLevel, setOutgoingLevel] = useState<StoreyPoleLevel | null>(null);
  const outgoingElRef = useRef<HTMLDivElement | null>(null);
  const lastPreviewIdRef = useRef(previewId);

  useEffect(() => {
    if (previewId === lastPreviewIdRef.current) return;
    const prevId = lastPreviewIdRef.current;
    lastPreviewIdRef.current = previewId;
    if (reducedMotion) {
      setOutgoingLevel(null);
      return;
    }
    setOutgoingLevel(geomById.get(prevId)?.level ?? null);
  }, [previewId, reducedMotion, geomById]);

  useEffect(() => {
    if (!outgoingLevel) return;
    const el = outgoingElRef.current;
    if (!el || typeof el.animate !== "function") {
      setOutgoingLevel(null);
      return;
    }
    const anim = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: PLAN_FADE_MS,
      easing: "ease-out",
      fill: "forwards",
    });
    const done = () =>
      setOutgoingLevel((cur) => (cur === outgoingLevel ? null : cur));
    anim.onfinish = done;
    anim.oncancel = done;
  }, [outgoingLevel]);

  if (geometry.length === 0) {
    return (
      <p className={`font-mono text-xs text-ns-muted ${className}`}>
        No levels to show.
      </p>
    );
  }

  const currentLevel = geomById.get(previewId)?.level ?? sorted[0];

  return (
    <div className={`ns-sp-root flex flex-wrap items-start gap-6 ${className}`}>
      <div
        ref={sectionRef}
        role="radiogroup"
        aria-label={label}
        className="ns-sp-section touch-none"
        style={{ height: totalHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {geometry.map((g, i) => {
          const lvl = g.level;
          const checked = lvl.id === committedId;
          const highlighted = lvl.id === previewId;
          const belowGrade = lvl.elevation < 0;

          const belowNeighbor = neighborName(geometry[i + 1]);
          const aboveNeighbor = neighborName(geometry[i - 1]);
          const neighborParts: string[] = [];
          if (belowNeighbor) neighborParts.push(`directly above ${belowNeighbor}`);
          if (aboveNeighbor) neighborParts.push(`below ${aboveNeighbor}`);
          const parts = [`Level ${lvl.label}`, elevationPhrase(lvl.elevation)];
          if (lvl.name) parts.push(lvl.name);
          let accLabel = parts.join(", ");
          if (neighborParts.length) accLabel += `; ${neighborParts.join(", ")}`;

          return (
            <div key={lvl.id} className="ns-sp-row" style={{ height: g.height }}>
              <input
                type="radio"
                className="ns-sp-input"
                name={groupName}
                value={lvl.id}
                checked={checked}
                onChange={() => commit(lvl.id)}
                aria-label={accLabel}
              />
              <span className="ns-sp-visual" data-checked={highlighted || undefined}>
                <span className="ns-sp-bar" data-checked={highlighted || undefined}>
                  {belowGrade && <span aria-hidden="true" className="ns-sp-hatch" />}
                </span>
                <span className="ns-sp-info">
                  <span className="ns-sp-code" data-checked={highlighted || undefined}>
                    {lvl.label}
                  </span>
                  <span className="ns-sp-elev">{elevationShort(lvl.elevation)}</span>
                  {lvl.name && <span className="ns-sp-name">{lvl.name}</span>}
                </span>
              </span>
            </div>
          );
        })}

        <div
          ref={lineRef}
          aria-hidden="true"
          className="ns-sp-datum"
          style={{ transform: `translateY(${springRef.current.y}px)` }}
        />
      </div>

      <div className="ns-sp-side min-w-[180px] max-w-[240px] flex-1">
        <div className="ns-sp-plan-stack">
          <PlanGlyph key={currentLevel.id} level={currentLevel} className="ns-sp-plan-glyph" />
          {outgoingLevel && (
            <div ref={outgoingElRef} className="ns-sp-plan-overlay">
              <PlanGlyph level={outgoingLevel} className="ns-sp-plan-glyph" />
            </div>
          )}
        </div>
        <div className="ns-sp-readout">
          <span className="ns-sp-readout-code">{currentLevel.label}</span>
          <span className="ns-sp-readout-elev">{elevationPhrase(currentLevel.elevation)}</span>
          {currentLevel.name && (
            <span className="ns-sp-readout-name">{currentLevel.name}</span>
          )}
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <style>{`
        .ns-sp-section {
          position: relative;
          width: ${BAR_WIDTH + 8}px;
          min-width: max-content;
        }
        .ns-sp-row {
          position: relative;
        }
        .ns-sp-input {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
          outline: none;
        }
        .ns-sp-visual {
          display: flex;
          align-items: stretch;
          height: 100%;
          border-radius: 4px;
        }
        .ns-sp-input:focus-visible + .ns-sp-visual {
          outline: 2px solid var(--ns-accent);
          outline-offset: 2px;
        }
        .ns-sp-bar {
          position: relative;
          flex: 0 0 ${BAR_WIDTH}px;
          width: ${BAR_WIDTH}px;
          box-sizing: border-box;
          border: 1px solid var(--border);
          background: var(--background);
          transition: background-color 160ms ease;
          overflow: hidden;
        }
        .ns-sp-bar[data-checked] {
          background: color-mix(in oklab, var(--foreground) 8%, transparent);
        }
        .ns-sp-row:hover .ns-sp-bar:not([data-checked]) {
          background: color-mix(in oklab, var(--foreground) 4%, transparent);
        }
        .ns-sp-hatch {
          position: absolute;
          inset: 0 auto 0 0;
          width: 9px;
          background-image: repeating-linear-gradient(
            45deg,
            var(--border) 0 1.5px,
            transparent 1.5px 5px
          );
        }
        .ns-sp-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px 0 12px;
          white-space: nowrap;
        }
        .ns-sp-code {
          font-family: var(--font-mono, monospace);
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--ns-muted);
          min-width: 1.5em;
          transition: color 160ms ease;
        }
        .ns-sp-code[data-checked] {
          color: var(--foreground);
          font-weight: 700;
        }
        .ns-sp-elev {
          font-family: var(--font-mono, monospace);
          font-size: 0.6875rem;
          color: var(--ns-muted);
          font-variant-numeric: tabular-nums;
        }
        .ns-sp-name {
          font-size: 0.75rem;
          color: var(--ns-muted);
        }
        .ns-sp-datum {
          position: absolute;
          left: 0;
          right: 0;
          top: -1px;
          height: 2px;
          background: var(--foreground);
          pointer-events: none;
          will-change: transform;
        }

        .ns-sp-side {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ns-sp-plan-stack {
          position: relative;
          aspect-ratio: 4 / 3;
          width: 100%;
          border-radius: 8px;
          background: var(--background);
        }
        .ns-sp-plan-overlay {
          position: absolute;
          inset: 0;
        }
        .ns-sp-plan-glyph {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }
        .ns-sp-readout {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 6px 8px;
        }
        .ns-sp-readout-code {
          font-family: var(--font-mono, monospace);
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--foreground);
        }
        .ns-sp-readout-elev {
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
          color: var(--ns-muted);
        }
        .ns-sp-readout-name {
          font-size: 0.8125rem;
          color: var(--ns-muted);
        }

        @media (prefers-reduced-motion: reduce) {
          .ns-sp-bar {
            transition: none;
          }
          .ns-sp-code {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
