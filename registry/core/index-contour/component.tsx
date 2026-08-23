"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// IndexContour — a travel-time reach editor. One role=slider handle sets a
// single governing scalar t (minutes); the reach is drawn as topographic-
// style contour LINES (never a filled wash) re-thresholded at t, t-5, t-10...
// from a caller-supplied per-node cost field via marching squares. Every
// band is derived from that one field — none is independently authored —
// so the shape is exactly as non-convex and network-hugging as the field
// says it is. A Euclidean radius/speed fallback is structurally impossible
// here: if the field has no finite costs yet, marching squares emits zero
// segments at every level, so the "no data" state falls out of the
// algorithm itself rather than a special-cased branch (the supplied
// `roads` skeleton keeps drawing regardless, muted, so there is still
// context on screen — never a circle standing in for missing data).
//
// INDEX-CONTOUR RULE: every 3rd line (15-minute multiples, a 3:1 ratio on
// top of the 5-minute interval, matching USGS index-contour practice) is
// drawn 2px --foreground with its minute value set INSIDE a break in the
// stroke — a stroke-dasharray gap sized from the label's own measured
// SVG bounding box, centered on the arc-length position of that band's
// topmost point. Intermediate lines are 1px --ns-muted, unlabeled.
//
// GALTON RULE: bands must be non-convex and hug the network, never a
// circle. That property lives entirely in the supplied cost field (a real
// field, built from graph distances, produces exactly this); marching
// squares just re-thresholds whatever shape the field already has.
//
// EMERGENCE: growing t does not fade a new band in — fading reads as
// opacity, not reach. Each newly-revealed band mounts scaled down toward
// the field's own cost-minimum node (its "origin"), then a transform
// (never opacity) eases it out to scale(1) over 220ms ease-out-expo, so it
// visibly inflates outward from the previous line. prefers-reduced-motion
// skips the tween and renders the settled shape directly — still fully
// legible, just not animated.
// ---------------------------------------------------------------------------

const LEVEL_STEP = 5; // minutes between contour lines — sub-5 bands sit
// closer together than a label is tall at UI scale, so 5 is the floor.
const INDEX_EVERY = 3; // every 3rd line is an index line (USGS 3:1 ratio)
const INDEX_STEP = LEVEL_STEP * INDEX_EVERY; // 15
const GRID_COLS = 40;
const GRID_ROWS = 26;
const CELL = 13; // px per grid step — a real, fixed pixel grid (no viewBox
// rescaling), so a 2px/1px stroke and a getBBox() label measurement are
// both already in true screen px with nothing to reconcile.
const EMERGE_MS = 220;
const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const LABEL_PAD = 5; // px each side of the measured label inside its gap

type Pt = [number, number];

export interface ContourCostField {
  /** grid width, in nodes */
  cols: number;
  /** grid height, in nodes */
  rows: number;
  /**
   * minutes to reach each node, row-major (`values[row*cols+col]`).
   * `Infinity` (or omit/all-Infinity) means "no data yet" — contours then
   * render nothing at any level, by construction, not as a special case.
   */
  values: number[];
  /** underlying road polylines, in node [col,row] coordinates — drawn as
   * faint permanent context, and the only thing shown before `values` has
   * any finite entries. */
  roads?: Pt[][];
  /** metres represented by one grid-cell edge, for the derived area readout.
   * default 90 (a typical short city block). */
  metersPerCell?: number;
}

export interface IndexContourProps {
  /** the per-node travel-time field contours are re-thresholded from. */
  costField?: ContourCostField;
  /** controlled value, in minutes (quantized to a multiple of 5). */
  value?: number;
  /** uncontrolled initial value, in minutes. default 25 */
  defaultValue?: number;
  /** minimum minutes reachable via the control. default 5 */
  min?: number;
  /** maximum minutes reachable via the control; defaults to the field's own
   * reachable ceiling rounded up to the next 15-minute index line. */
  max?: number;
  /** fired with the new value (always a multiple of 5) on drag/keyboard change */
  onValueChange?: (minutes: number) => void;
  /** accessible name for the slider; also the visible eyebrow label */
  label?: string;
  /** people per km², to append a population estimate to the readout */
  populationPerKm2?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// -- geometry: marching squares over a scalar grid --------------------------

function interp(level: number, v0: number, v1: number, p0: Pt, p1: Pt): Pt {
  const f0 = Number.isFinite(v0);
  const f1 = Number.isFinite(v1);
  let t: number;
  if (f0 && f1) {
    t = v1 === v0 ? 0.5 : (level - v0) / (v1 - v0);
  } else if (!f0 && f1) {
    t = 0.1; // barrier at p0 — hug tight against it, not a linear guess
  } else if (f0 && !f1) {
    t = 0.9; // barrier at p1
  } else {
    t = 0.5;
  }
  t = Math.min(1, Math.max(0, t));
  return [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
}

function marchingSquaresSegments(
  values: number[],
  cols: number,
  rows: number,
  level: number,
  cell: number
): [Pt, Pt][] {
  const segments: [Pt, Pt][] = [];
  const at = (i: number, j: number) => values[j * cols + i] ?? Infinity;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const tl = at(i, j);
      const tr = at(i + 1, j);
      const br = at(i + 1, j + 1);
      const bl = at(i, j + 1);
      const c =
        (tl <= level ? 8 : 0) |
        (tr <= level ? 4 : 0) |
        (br <= level ? 2 : 0) |
        (bl <= level ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const x0 = i * cell,
        x1 = (i + 1) * cell,
        y0 = j * cell,
        y1 = (j + 1) * cell;
      const pTL: Pt = [x0, y0],
        pTR: Pt = [x1, y0],
        pBR: Pt = [x1, y1],
        pBL: Pt = [x0, y1];
      const top = () => interp(level, tl, tr, pTL, pTR);
      const right = () => interp(level, tr, br, pTR, pBR);
      const bottom = () => interp(level, bl, br, pBL, pBR);
      const left = () => interp(level, tl, bl, pTL, pBL);
      switch (c) {
        case 1:
          segments.push([left(), bottom()]);
          break;
        case 2:
          segments.push([bottom(), right()]);
          break;
        case 3:
          segments.push([left(), right()]);
          break;
        case 4:
          segments.push([top(), right()]);
          break;
        case 5:
          segments.push([top(), right()]);
          segments.push([bottom(), left()]);
          break;
        case 6:
          segments.push([top(), bottom()]);
          break;
        case 7:
          segments.push([top(), left()]);
          break;
        case 8:
          segments.push([top(), left()]);
          break;
        case 9:
          segments.push([top(), bottom()]);
          break;
        case 10:
          segments.push([top(), left()]);
          segments.push([bottom(), right()]);
          break;
        case 11:
          segments.push([top(), right()]);
          break;
        case 12:
          segments.push([left(), right()]);
          break;
        case 13:
          segments.push([bottom(), right()]);
          break;
        case 14:
          segments.push([left(), bottom()]);
          break;
      }
    }
  }
  return segments;
}

function polylineLength(pts: Pt[]): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) {
    l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return l;
}

// Stitches loose segments (shared-endpoint pairs) into polylines — closed
// loops where the field forms an island, open chains where a partial band
// clips at the grid edge or against an unreachable pocket. Degenerate
// zero-length chains (an exact-tie lattice point matched on all four
// corners) are dropped rather than rendered as a phantom dot.
function stitchSegments(segments: [Pt, Pt][]): Pt[][] {
  const key = (p: Pt) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  const used = new Array(segments.length).fill(false);
  const byKey = new Map<string, number[]>();
  segments.forEach((seg, idx) => {
    for (const p of seg) {
      const k = key(p);
      const arr = byKey.get(k);
      if (arr) arr.push(idx);
      else byKey.set(k, [idx]);
    }
  });
  const polylines: Pt[][] = [];
  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    const chain: Pt[] = [segments[start][0], segments[start][1]];
    let extended = true;
    while (extended) {
      extended = false;
      const tailKey = key(chain[chain.length - 1]);
      for (const idx of byKey.get(tailKey) ?? []) {
        if (used[idx]) continue;
        const [a, b] = segments[idx];
        if (key(a) === tailKey) {
          chain.push(b);
          used[idx] = true;
          extended = true;
          break;
        }
        if (key(b) === tailKey) {
          chain.push(a);
          used[idx] = true;
          extended = true;
          break;
        }
      }
    }
    extended = true;
    while (extended) {
      extended = false;
      const headKey = key(chain[0]);
      for (const idx of byKey.get(headKey) ?? []) {
        if (used[idx]) continue;
        const [a, b] = segments[idx];
        if (key(a) === headKey) {
          chain.unshift(b);
          used[idx] = true;
          extended = true;
          break;
        }
        if (key(b) === headKey) {
          chain.unshift(a);
          used[idx] = true;
          extended = true;
          break;
        }
      }
    }
    polylines.push(chain);
  }
  return polylines.filter((l) => polylineLength(l) > 0.5);
}

interface Band {
  level: number;
  isIndex: boolean;
  lines: Pt[][];
  /** arc-length position, within its longest line, of that line's topmost
   * vertex — where an index label anchors, if the line is long enough. */
  labelLineIdx: number;
  labelArc: number;
  labelPt: Pt | null;
}

function buildBand(
  values: number[],
  cols: number,
  rows: number,
  level: number,
  cell: number
): Band {
  const segs = marchingSquaresSegments(values, cols, rows, level, cell);
  const lines = stitchSegments(segs);
  const isIndex = level % INDEX_STEP === 0;
  let labelLineIdx = -1;
  let labelArc = 0;
  let labelPt: Pt | null = null;
  if (isIndex && lines.length) {
    let bestLen = -1;
    lines.forEach((line, li) => {
      const len = polylineLength(line);
      if (len > bestLen) {
        bestLen = len;
        labelLineIdx = li;
      }
    });
    if (labelLineIdx >= 0 && bestLen > 40) {
      const line = lines[labelLineIdx];
      let topIdx = 0;
      for (let i = 1; i < line.length; i++) {
        if (line[i][1] < line[topIdx][1]) topIdx = i;
      }
      let arc = 0;
      for (let i = 1; i <= topIdx; i++) {
        arc += Math.hypot(
          line[i][0] - line[i - 1][0],
          line[i][1] - line[i - 1][1]
        );
      }
      labelArc = arc;
      labelPt = line[topIdx];
    }
  }
  return { level, isIndex, lines, labelLineIdx, labelArc, labelPt };
}

function pointsToPath(pts: Pt[]): string {
  if (!pts.length) return "";
  const closed =
    pts.length > 2 &&
    Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.5;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += `L${pts[i][0].toFixed(1)},${pts[i][1].toFixed(1)}`;
  if (closed) d += "Z";
  return d;
}

function findOriginIndex(values: number[]): number {
  let idx = 0;
  let best = Infinity;
  for (let i = 0; i < values.length; i++) {
    if (values[i] < best) {
      best = values[i];
      idx = i;
    }
  }
  return idx;
}

export function IndexContour({
  costField,
  value,
  defaultValue = 25,
  min = LEVEL_STEP,
  max,
  onValueChange,
  label = "Reach",
  populationPerKm2,
  className = "",
}: IndexContourProps) {
  const cols = costField?.cols ?? GRID_COLS;
  const rows = costField?.rows ?? GRID_ROWS;
  const values = useMemo(
    () => costField?.values ?? new Array(cols * rows).fill(Infinity),
    [costField, cols, rows]
  );
  const roads = costField?.roads ?? [];
  const metersPerCell = costField?.metersPerCell ?? 90;

  const fieldMax = useMemo(() => {
    let m = 0;
    for (const v of values) if (Number.isFinite(v) && v > m) m = v;
    return m;
  }, [values]);

  const safeMin = Math.max(LEVEL_STEP, Math.round(min / LEVEL_STEP) * LEVEL_STEP);
  const autoMax = Math.max(30, Math.min(90, Math.ceil((fieldMax || 60) / INDEX_STEP) * INDEX_STEP));
  const safeMax = Math.max(
    safeMin + LEVEL_STEP,
    Math.round((max ?? autoMax) / LEVEL_STEP) * LEVEL_STEP
  );

  const quantize = (v: number) =>
    Math.min(safeMax, Math.max(safeMin, Math.round(v / LEVEL_STEP) * LEVEL_STEP));

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(() => quantize(defaultValue));
  const current = isControlled ? quantize(value as number) : internal;
  const currentRef = useRef(current);
  currentRef.current = current;

  const commit = (v: number) => {
    const q = quantize(v);
    if (q === currentRef.current) return;
    if (!isControlled) setInternal(q);
    onValueChange?.(q);
  };

  const width = (cols - 1) * CELL;
  const height = (rows - 1) * CELL;

  const originIdx = useMemo(() => findOriginIndex(values), [values]);
  const originPt: Pt = [
    (originIdx % cols) * CELL,
    Math.floor(originIdx / cols) * CELL,
  ];

  const bands = useMemo(() => {
    const arr: Band[] = [];
    for (let lvl = LEVEL_STEP; lvl <= current; lvl += LEVEL_STEP) {
      arr.push(buildBand(values, cols, rows, lvl, CELL));
    }
    return arr;
  }, [values, cols, rows, current]);

  const reachableCount = useMemo(() => {
    let n = 0;
    for (const v of values) if (Number.isFinite(v) && v <= current) n++;
    return n;
  }, [values, current]);
  const cellAreaKm2 = (metersPerCell / 1000) * (metersPerCell / 1000);
  const areaKm2 = Math.round(reachableCount * cellAreaKm2);
  const popText =
    populationPerKm2 !== undefined
      ? `, approx. ${Math.round(areaKm2 * populationPerKm2).toLocaleString()} people`
      : "";
  const bandCount = bands.length;
  const valueText = `${current} minutes, reach covers approx. ${areaKm2} km²${popText}`;
  const liveText = bandCount
    ? `${bandCount} contour band${bandCount === 1 ? "" : "s"} to ${current} minutes · approx. ${areaKm2} km² reachable${popText}`
    : `no reach data yet at ${current} minutes`;

  // -- refs for imperative label measurement + emergence animation --------
  // Keyed by "level:lineIndex" (not just level) because a band can be
  // multiple disjoint loops — the park obstacle in the demo field splits
  // reach into two separate polylines at the same level — and every one of
  // them needs its own emerge transform, not just the one carrying the label.
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const textRefs = useRef(new Map<number, SVGTextElement>());
  const bornKeysRef = useRef(new Set<string>());
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      reducedRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Measure each index label's real rendered width and size the stroke gap
  // from it; also drive the emerge-from-previous-line transform on newly
  // added bands. Runs before paint so neither ever flashes ungapped/unscaled.
  useLayoutEffect(() => {
    const currentKeys = new Set<string>();
    const newlyBorn: SVGPathElement[] = [];

    for (const band of bands) {
      band.lines.forEach((line, li) => {
        const compositeKey = `${band.level}:${li}`;
        currentKeys.add(compositeKey);
        const path = pathRefs.current.get(compositeKey);
        if (!path) return;

        if (band.isIndex && band.labelPt && li === band.labelLineIdx) {
          const text = textRefs.current.get(band.level);
          const total = polylineLength(line);
          let gap = LABEL_PAD * 2 + 24; // safe fallback before first measure
          if (text) {
            try {
              const bbox = text.getBBox();
              gap = bbox.width + LABEL_PAD * 2;
            } catch {
              // getBBox can throw on a display:none ancestor; keep the fallback
            }
          }
          gap = Math.min(gap, total * 0.45);
          if (total > gap + 4) {
            const solid = total - gap;
            path.setAttribute("stroke-dasharray", `${solid.toFixed(1)} ${gap.toFixed(1)}`);
            const offset = -(band.labelArc + gap / 2);
            path.setAttribute("stroke-dashoffset", offset.toFixed(1));
          } else {
            path.removeAttribute("stroke-dasharray");
            path.removeAttribute("stroke-dashoffset");
          }
        } else {
          path.removeAttribute("stroke-dasharray");
          path.removeAttribute("stroke-dashoffset");
        }

        if (!bornKeysRef.current.has(compositeKey)) {
          if (reducedRef.current) {
            path.style.transition = "none";
            path.style.transform = "none";
          } else {
            path.style.transformOrigin = `${originPt[0]}px ${originPt[1]}px`;
            path.style.transition = "none";
            path.style.transform = "scale(0.9)";
            newlyBorn.push(path);
          }
        }
      });
    }

    if (newlyBorn.length) {
      // force a layout flush so the browser commits every "from" frame
      // before the next write flips them to the eased "to" frame.
      void newlyBorn[0]?.getBoundingClientRect();
      requestAnimationFrame(() => {
        for (const path of newlyBorn) {
          path.style.transition = `transform ${EMERGE_MS}ms ${EASE_OUT_EXPO}`;
          path.style.transform = "scale(1)";
        }
      });
    }

    bornKeysRef.current = currentKeys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bands, originPt[0], originPt[1]]);

  // -- slider control -------------------------------------------------------
  const trackRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = currentRef.current + LEVEL_STEP;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = currentRef.current - LEVEL_STEP;
        break;
      case "PageUp":
        next = currentRef.current + INDEX_STEP;
        break;
      case "PageDown":
        next = currentRef.current - INDEX_STEP;
        break;
      case "Home":
        next = safeMin;
        break;
      case "End":
        next = safeMax;
        break;
      default:
        return;
    }
    e.preventDefault();
    commit(next);
  };

  const dragFromClientX = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const frac = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    const v = safeMin + frac * (safeMax - safeMin);
    commit(v);
  };

  const draggingRef = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    trackRef.current?.setPointerCapture(e.pointerId);
    trackRef.current?.focus({ preventScroll: true });
    dragFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    dragFromClientX(e.clientX);
  };
  const onPointerUp = () => {
    draggingRef.current = false;
  };

  const fillFrac = (current - safeMin) / (safeMax - safeMin || 1);

  return (
    <div
      className={`w-full max-w-xl rounded-md border border-border bg-background p-4 ${className}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ns-muted">
          {label}
        </span>
        <span
          aria-hidden="true"
          className="font-mono text-lg font-semibold tabular-nums text-foreground"
        >
          {current}
          <span className="ml-1 text-xs font-normal text-ns-muted">min</span>
        </span>
      </div>

      <div className="w-full overflow-x-auto rounded-sm border border-border">
        <svg
          aria-hidden="true"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block bg-background"
        >
          <g className="text-border" stroke="currentColor" strokeWidth={1} fill="none">
            {roads.map((road, i) => (
              <path
                key={i}
                d={pointsToPath(road.map(([c, r]) => [c * CELL, r * CELL] as Pt))}
              />
            ))}
          </g>

          {bands.map((band) => (
            <g key={band.level}>
              {band.lines.map((line, li) => (
                <path
                  key={li}
                  ref={(el) => {
                    const compositeKey = `${band.level}:${li}`;
                    if (el) pathRefs.current.set(compositeKey, el);
                    else pathRefs.current.delete(compositeKey);
                  }}
                  d={pointsToPath(line)}
                  fill="none"
                  strokeLinejoin="round"
                  className={band.isIndex ? "text-foreground" : "text-ns-muted"}
                  stroke="currentColor"
                  strokeWidth={band.isIndex ? 2 : 1}
                />
              ))}
              {band.isIndex && band.labelPt ? (
                <text
                  ref={(el) => {
                    if (el) textRefs.current.set(band.level, el);
                    else textRefs.current.delete(band.level);
                  }}
                  x={band.labelPt[0]}
                  y={band.labelPt[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="fill-foreground font-mono"
                  style={{ fontSize: 10 }}
                >
                  {band.level}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={safeMin}
        aria-valuemax={safeMax}
        aria-valuenow={current}
        aria-valuetext={valueText}
        data-index-contour-track
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative mt-4 block h-6 w-full touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ns-muted"
          style={{ width: `${fillFrac * 100}%` }}
        />
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background transition-transform duration-150 hover:scale-110"
          style={{ left: `${fillFrac * 100}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ns-muted">
        <span>{safeMin}</span>
        <span>{safeMax} min</span>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {liveText}
      </span>
    </div>
  );
}
