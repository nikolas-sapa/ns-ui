"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// MapChoroplethAscii — the registry's first choropleth, and queue item #15
// (zero prior coverage). The geography is entirely synthetic: a fixed grid
// partitioned by hand-placed seed points into a Voronoi tessellation, not a
// real country, coastline or GeoJSON import — no geo dependency, nothing
// that could read as a political claim. Nearest neighbours: heatmap-year-
// stipple keys stipple density to a date, heatmap-calendar-tide and table-
// heat-shimmer key intensity to time-of-day or a threshold — none of the
// three tessellates a plane into regions with borders.
//
// Region fill is the family's shared ASCII ramp ' .:-=+*#%@', density
// tracking each region's synthetic index value, with a small deterministic
// per-cell jitter (a fixed hash, not Math.random) so a solid region still
// reads as ink texture rather than a flat block. The mechanic: hovering the
// map (exact cell under the pointer) or moving keyboard focus through the
// region list (Tab into the map, then ArrowLeft/ArrowRight) ISOLATES that
// region — every other region's cells drop to a fixed low "background"
// density while the hovered region keeps its true density and gains a thin
// var(--ns-accent) boundary trace — and the legend rescales its domain to a
// tight band around the hovered value instead of the global min/max,
// highlighting exactly where that value falls. Losing hover/focus restores
// the global view. Pure var(--foreground) ink; var(--ns-accent) is reserved
// for the isolated region's boundary and the legend marker only.
// ---------------------------------------------------------------------------

const RAMP = " .:-=+*#%@";

export interface ChoroplethRegion {
  id: number;
  label: string;
  /** Voronoi seed, in grid-cell coordinates */
  seedCol: number;
  seedRow: number;
  /** synthetic index value, arbitrary units */
  value: number;
}

export interface MapChoroplethAsciiProps {
  /** the shaded regions */
  regions?: ChoroplethRegion[];
  /** heading above the map */
  title?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

// hand-placed seeds across a fixed grid — an abstract tessellation, not a
// real place. Values are an invented "regional index", clearly synthetic.
const DEFAULT_REGIONS: ChoroplethRegion[] = [
  { id: 0, label: "Sector 1", seedCol: 3, seedRow: 3, value: 62 },
  { id: 1, label: "Sector 2", seedCol: 9, seedRow: 2, value: 34 },
  { id: 2, label: "Sector 3", seedCol: 16, seedRow: 3, value: 88 },
  { id: 3, label: "Sector 4", seedCol: 21, seedRow: 6, value: 45 },
  { id: 4, label: "Sector 5", seedCol: 14, seedRow: 7, value: 21 },
  { id: 5, label: "Sector 6", seedCol: 5, seedRow: 9, value: 70 },
  { id: 6, label: "Sector 7", seedCol: 10, seedRow: 11, value: 55 },
  { id: 7, label: "Sector 8", seedCol: 19, seedRow: 10, value: 39 },
];

const COLS = 24;
const ROWS = 13;
const CELL = 15;
const TOP_PAD = 10;
const LEFT_PAD = 10;
const RIGHT_PAD = 10;
const LEGEND_H = 44;
const MAP_W = COLS * CELL;
const MAP_H = ROWS * CELL;
const BAND = 14; // half-width of the rescaled legend band around a hovered value
const ENTRANCE_MS = 340;

interface Tokens {
  fg: string;
  bg: string;
  muted: string;
  border: string;
  accent: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    fg: get("--foreground", "#171717"),
    bg: get("--background", "#ffffff"),
    muted: get("--ns-muted", "#4d4d4d"),
    border: get("--border", "#ebebeb"),
    accent: get("--ns-accent", "#006bff"),
  };
}

function useTokens(): Tokens {
  const [tokens, setTokens] = useState<Tokens>(() =>
    typeof document === "undefined"
      ? { fg: "#171717", bg: "#ffffff", muted: "#4d4d4d", border: "#ebebeb", accent: "#006bff" }
      : readTokens()
  );
  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => mo.disconnect();
  }, []);
  return tokens;
}

// fixed hash, not Math.random — deterministic per-cell jitter for ink texture
function hashCell(c: number, r: number): number {
  const n = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export function MapChoroplethAscii({ regions, title = "Regional index", className = "" }: MapChoroplethAsciiProps) {
  const data = useMemo(() => regions ?? DEFAULT_REGIONS, [regions]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const tokens = useTokens();
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const rafRef = useRef(0);
  const mountAtRef = useRef(0);

  const reducedRef = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const globalMin = Math.min(...data.map((r) => r.value));
  const globalMax = Math.max(...data.map((r) => r.value));
  const globalSpan = Math.max(1e-6, globalMax - globalMin);

  // Voronoi cell -> region id, computed once per region set
  const cellRegion = useMemo(() => {
    const buf = new Uint8Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let best = 0;
        let bestDist = Infinity;
        for (const region of data) {
          const dx = c - region.seedCol;
          const dy = r - region.seedRow;
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            best = region.id;
          }
        }
        buf[r * COLS + c] = best;
      }
    }
    return buf;
  }, [data]);

  useEffect(() => {
    mountAtRef.current = performance.now();
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const viewW = LEFT_PAD + MAP_W + RIGHT_PAD;
    const viewH = TOP_PAD + MAP_H + LEGEND_H;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = viewW * dpr;
    canvas.height = viewH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // legend domain: global by default, tightened around the hovered value
    const hoveredRegion = hoverId !== null ? data.find((r) => r.id === hoverId) ?? null : null;
    const legendMin = hoveredRegion ? Math.max(globalMin, hoveredRegion.value - BAND) : globalMin;
    const legendMax = hoveredRegion ? Math.min(globalMax, hoveredRegion.value + BAND) : globalMax;
    const legendSpan = Math.max(1e-6, legendMax - legendMin);

    const draw = () => {
      const now = performance.now();
      const t = reducedRef.current ? 1 : Math.min(1, (now - mountAtRef.current) / ENTRANCE_MS);
      ctx.clearRect(0, 0, viewW, viewH);

      ctx.font = `${CELL - 4}px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const regionId = cellRegion[r * COLS + c];
          const region = data.find((rg) => rg.id === regionId)!;
          const isolating = hoverId !== null;
          const isolated = isolating && regionId !== hoverId;
          const norm = (region.value - globalMin) / globalSpan;
          const jitter = (hashCell(c, r) - 0.5) * 0.14;
          const baseLevel = Math.min(RAMP.length - 1, Math.max(1, Math.round((norm + jitter) * (RAMP.length - 1))));
          const level = isolated ? 2 : baseLevel;
          const ch = RAMP[level];
          if (ch === " ") continue;
          const cx = LEFT_PAD + c * CELL + CELL / 2;
          const cy = TOP_PAD + r * CELL + CELL / 2;
          ctx.fillStyle = isolated ? tokens.muted : tokens.fg;
          ctx.globalAlpha = t * (isolated ? 0.55 : 1);
          ctx.fillText(ch, cx, cy);
          ctx.globalAlpha = 1;
        }
      }

      // region boundaries
      ctx.strokeStyle = tokens.border;
      ctx.lineWidth = 1;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const id = cellRegion[r * COLS + c];
          const rightId = c + 1 < COLS ? cellRegion[r * COLS + c + 1] : id;
          const downId = r + 1 < ROWS ? cellRegion[(r + 1) * COLS + c] : id;
          const x = LEFT_PAD + (c + 1) * CELL;
          const y = TOP_PAD + (r + 1) * CELL;
          if (rightId !== id) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, TOP_PAD + r * CELL);
            ctx.lineTo(x + 0.5, TOP_PAD + (r + 1) * CELL);
            ctx.stroke();
          }
          if (downId !== id) {
            ctx.beginPath();
            ctx.moveTo(LEFT_PAD + c * CELL, y + 0.5);
            ctx.lineTo(LEFT_PAD + (c + 1) * CELL, y + 0.5);
            ctx.stroke();
          }
        }
      }

      // isolated region's own boundary re-traced in accent
      if (hoverId !== null) {
        ctx.strokeStyle = tokens.accent;
        ctx.lineWidth = 1.5;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const id = cellRegion[r * COLS + c];
            if (id !== hoverId) continue;
            const rightId = c + 1 < COLS ? cellRegion[r * COLS + c + 1] : -1;
            const downId = r + 1 < ROWS ? cellRegion[(r + 1) * COLS + c] : -1;
            const leftId = c - 1 >= 0 ? cellRegion[r * COLS + c - 1] : -1;
            const upId = r - 1 >= 0 ? cellRegion[(r - 1) * COLS + c] : -1;
            const x0 = LEFT_PAD + c * CELL;
            const y0 = TOP_PAD + r * CELL;
            if (rightId !== id) {
              ctx.beginPath();
              ctx.moveTo(x0 + CELL + 0.5, y0);
              ctx.lineTo(x0 + CELL + 0.5, y0 + CELL);
              ctx.stroke();
            }
            if (leftId !== id) {
              ctx.beginPath();
              ctx.moveTo(x0 + 0.5, y0);
              ctx.lineTo(x0 + 0.5, y0 + CELL);
              ctx.stroke();
            }
            if (downId !== id) {
              ctx.beginPath();
              ctx.moveTo(x0, y0 + CELL + 0.5);
              ctx.lineTo(x0 + CELL, y0 + CELL + 0.5);
              ctx.stroke();
            }
            if (upId !== id) {
              ctx.beginPath();
              ctx.moveTo(x0, y0 + 0.5);
              ctx.lineTo(x0 + CELL, y0 + 0.5);
              ctx.stroke();
            }
          }
        }
      }

      // legend — ramp gradient bar, domain rescales around the hovered value
      const legendY = TOP_PAD + MAP_H + 20;
      const legendW = MAP_W;
      const swatches = 20;
      ctx.font = `${CELL - 3}px "GeistMono", ui-monospace, monospace`;
      for (let i = 0; i < swatches; i++) {
        const frac = i / (swatches - 1);
        const level = Math.round(frac * (RAMP.length - 1));
        ctx.fillStyle = tokens.fg;
        ctx.fillText(RAMP[Math.max(level, 1)], LEFT_PAD + (i + 0.5) * (legendW / swatches), legendY);
      }
      ctx.fillStyle = tokens.muted;
      ctx.font = `9px "GeistMono", ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.fillText(legendMin.toFixed(0), LEFT_PAD, legendY + 14);
      ctx.textAlign = "right";
      ctx.fillText(legendMax.toFixed(0), LEFT_PAD + legendW, legendY + 14);

      if (hoveredRegion) {
        const markFrac = Math.min(1, Math.max(0, (hoveredRegion.value - legendMin) / legendSpan));
        const mx = LEFT_PAD + markFrac * legendW;
        ctx.strokeStyle = tokens.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx, legendY - 10);
        ctx.lineTo(mx, legendY + 6);
        ctx.stroke();
      }

      if (t < 1 && !reducedRef.current) rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [cellRegion, data, tokens, hoverId, globalMin, globalMax, globalSpan, reducedRef]);

  const setHoverFromEvent = (e: { clientX: number; clientY: number }) => {
    const el = hitRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.min(COLS - 1, Math.max(0, Math.floor(x / CELL)));
    const r = Math.min(ROWS - 1, Math.max(0, Math.floor(y / CELL)));
    const id = cellRegion[r * COLS + c];
    setHoverId(id);
    const idx = data.findIndex((rg) => rg.id === id);
    if (idx >= 0) setActiveIdx(idx);
  };

  const hoveredRegion = hoverId !== null ? data.find((r) => r.id === hoverId) ?? null : null;

  return (
    <figure className={`ns-mca inline-block ${className}`} aria-label={`${title}, choropleth map`}>
      <style>{CSS}</style>
      <div className="flex items-center justify-between gap-3 pb-2">
        <span className="font-mono text-xs tracking-widest text-ns-muted">{title.toUpperCase()}</span>
        <span className="font-mono text-[11px] text-ns-muted tabular-nums">
          {hoveredRegion ? `${hoveredRegion.label} · ${hoveredRegion.value}` : `${data.length} sectors`}
        </span>
      </div>
      <div className="relative" style={{ width: LEFT_PAD + MAP_W + RIGHT_PAD, maxWidth: "100%" }}>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="ns-mca-canvas"
          style={{
            width: LEFT_PAD + MAP_W + RIGHT_PAD,
            height: TOP_PAD + MAP_H + LEGEND_H,
            maxWidth: "100%",
            display: "block",
          }}
        />
        <div
          ref={hitRef}
          role="button"
          tabIndex={0}
          aria-label={
            hoveredRegion
              ? `${hoveredRegion.label}, index ${hoveredRegion.value}. Arrow keys cycle sectors.`
              : "Choropleth map. Point at a sector, or use arrow keys to cycle sectors."
          }
          className="ns-mca-hit absolute cursor-pointer rounded-sm outline-none"
          style={{ left: LEFT_PAD, top: TOP_PAD, width: MAP_W, height: MAP_H }}
          onPointerMove={(e) => setHoverFromEvent(e)}
          onPointerLeave={() => setHoverId(null)}
          onFocus={() => setHoverId(data[activeIdx]?.id ?? data[0].id)}
          onBlur={() => setHoverId(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              const next = (activeIdx + 1) % data.length;
              setActiveIdx(next);
              setHoverId(data[next].id);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              const next = (activeIdx - 1 + data.length) % data.length;
              setActiveIdx(next);
              setHoverId(data[next].id);
            } else if (e.key === "Escape") {
              setHoverId(null);
            }
          }}
        />
      </div>
    </figure>
  );
}

const CSS = `
.ns-mca-hit:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
`;
