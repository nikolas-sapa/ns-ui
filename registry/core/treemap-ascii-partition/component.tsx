"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// AsciiPartition — a recursive slice-and-dice treemap where every cell's
// interior is an ASCII density ramp (" .:-=+*#%@") rather than a colour
// scale: darker/denser glyph runs read as "bigger share", exactly the way
// heatmap-year-stipple reads density instead of hue, but as filled rectangles
// rather than dot scatter. The mechanic (not just the picture): clicking a
// rectangle that has children DESCENDS into it — the partition recomputes
// from scratch over just that rectangle's children, filling the whole plot
// again (never a shrinking inset), and a breadcrumb trail above it can climb
// back out to any ancestor level, or straight to Root. Split axis alternates
// with depth (horizontal at the root, vertical one level down, and so on),
// the classic slice-and-dice rule, computed with cumulative-rounded
// boundaries so adjacent cells always share an exact edge — never a stray
// 1px gap or overlap from independently rounding each cell's own width.
// ---------------------------------------------------------------------------

export interface TreemapNode {
  id: string;
  label: string;
  value: number;
  children?: TreemapNode[];
}

export interface AsciiPartitionProps {
  data?: TreemapNode[];
  className?: string;
}

const ASCII_RAMP = " .:-=+*#%@";

const COLS = 34;
const ROWS = 15;
const CELL_W = 11;
const CELL_H = 15;

const DEFAULT_DATA: TreemapNode[] = [
  {
    id: "alpha",
    label: "Cluster Alpha",
    value: 420,
    children: [
      { id: "alpha-1", label: "Shard 1", value: 180 },
      { id: "alpha-2", label: "Shard 2", value: 140 },
      { id: "alpha-3", label: "Shard 3", value: 100 },
    ],
  },
  {
    id: "beta",
    label: "Cluster Beta",
    value: 260,
    children: [
      { id: "beta-1", label: "Shard 1", value: 150 },
      { id: "beta-2", label: "Shard 2", value: 110 },
    ],
  },
  {
    id: "gamma",
    label: "Cluster Gamma",
    value: 180,
    children: [
      { id: "gamma-1", label: "Shard 1", value: 95 },
      { id: "gamma-2", label: "Shard 2", value: 55 },
      { id: "gamma-3", label: "Shard 3", value: 30 },
    ],
  },
  { id: "delta", label: "Cluster Delta", value: 140 },
];

interface Rect {
  node: TreemapNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Cumulative-rounded slice-and-dice: each boundary is derived from the
// running total so far, never from rounding one segment's own share in
// isolation — that is what keeps neighboring cells' edges flush.
function layoutSlice(nodes: TreemapNode[], x: number, y: number, w: number, h: number, dir: "h" | "v"): Rect[] {
  const total = nodes.reduce((s, n) => s + Math.max(0, n.value), 0) || 1;
  const axisSize = dir === "h" ? w : h;
  const start = dir === "h" ? x : y;
  let acc = 0;
  let cursor = start;
  return nodes.map((node) => {
    acc += Math.max(0, node.value);
    const next = start + Math.round((acc / total) * axisSize);
    const size = Math.max(1, next - cursor);
    const rect: Rect =
      dir === "h" ? { node, x: cursor, y, w: size, h } : { node, x, y: cursor, w, h: size };
    cursor = next;
    return rect;
  });
}

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
    muted: get("--muted", "#4d4d4d"),
    border: get("--border", "#ebebeb"),
    accent: get("--accent", "#006bff"),
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

function buildMap(nodes: TreemapNode[], map: Map<string, TreemapNode>) {
  for (const n of nodes) {
    map.set(n.id, n);
    if (n.children) buildMap(n.children, map);
  }
}

function rampLine(char: string, count: number): string {
  return char.repeat(Math.max(0, count));
}

export function AsciiPartition({ data = DEFAULT_DATA, className = "" }: AsciiPartitionProps) {
  const tokens = useTokens();
  const [path, setPath] = useState<string[]>([]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const byId = useMemo(() => {
    const map = new Map<string, TreemapNode>();
    buildMap(data, map);
    return map;
  }, [data]);

  const siblings = useMemo(() => {
    if (path.length === 0) return data;
    const parent = byId.get(path[path.length - 1]);
    return parent?.children ?? [];
  }, [path, byId, data]);

  const dir: "h" | "v" = path.length % 2 === 0 ? "h" : "v";
  const rects = useMemo(() => layoutSlice(siblings, 0, 0, COLS, ROWS, dir), [siblings, dir]);
  const maxValue = useMemo(() => Math.max(1, ...siblings.map((n) => n.value)), [siblings]);

  useEffect(() => {
    setFocusIndex(0);
  }, [path]);

  const crumbLabels = path.map((id) => byId.get(id)?.label ?? id);

  const ascendTo = (depth: number) => {
    setPath((p) => p.slice(0, depth));
  };

  const descend = (node: TreemapNode) => {
    if (!node.children?.length) return;
    setPath((p) => [...p, node.id]);
  };

  const moveFocus = (delta: number) => {
    if (rects.length === 0) return;
    const next = Math.max(0, Math.min(rects.length - 1, focusIndex + delta));
    setFocusIndex(next);
    btnRefs.current[rects[next].node.id]?.focus();
  };

  return (
    <div className={`ns-tap font-mono ${className}`}>
      <style>{CSS}</style>

      <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => ascendTo(0)}
          className="ns-tap-crumb rounded-sm px-1.5 py-0.5 text-muted transition-colors duration-150 motion-reduce:transition-none hover:text-foreground"
          aria-current={path.length === 0 ? "true" : undefined}
        >
          Root
        </button>
        {crumbLabels.map((label, i) => (
          <span key={i} className="flex items-center gap-1">
            <span aria-hidden className="text-border">
              /
            </span>
            <button
              type="button"
              onClick={() => ascendTo(i + 1)}
              className="ns-tap-crumb rounded-sm px-1.5 py-0.5 text-muted transition-colors duration-150 motion-reduce:transition-none hover:text-foreground"
              aria-current={i === crumbLabels.length - 1 ? "true" : undefined}
            >
              {label}
            </button>
          </span>
        ))}
        {path.length > 0 && (
          <button
            type="button"
            data-treemap-up
            onClick={() => ascendTo(path.length - 1)}
            aria-label={`Up one level to ${crumbLabels.length > 1 ? crumbLabels[crumbLabels.length - 2] : "Root"}`}
            className="ns-tap-crumb ml-2 rounded-sm border border-border px-1.5 py-0.5 text-muted transition-colors duration-150 motion-reduce:transition-none hover:text-foreground hover:border-accent/40"
          >
            &lt; Up
          </button>
        )}
      </div>

      <div
        className="relative"
        style={{ width: COLS * CELL_W, height: ROWS * CELL_H, maxWidth: "100%" }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            moveFocus(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            moveFocus(-1);
          } else if (e.key === "Escape" && path.length > 0) {
            e.preventDefault();
            ascendTo(path.length - 1);
          }
        }}
      >
        {rects.map((r, i) => {
          const level = Math.round((r.node.value / maxValue) * (ASCII_RAMP.length - 1));
          const ch = ASCII_RAMP[Math.max(1, level)];
          const hasChildren = !!r.node.children?.length;
          const hovered = hoverId === r.node.id;
          // r.w / r.h are already whole grid-cell counts; approximate one
          // character per cell width at this font size/line-height pairing.
          const lines = r.h;
          const lineText = rampLine(ch, r.w);

          return (
            <button
              key={r.node.id}
              type="button"
              data-treemap-rect
              ref={(el) => {
                btnRefs.current[r.node.id] = el;
              }}
              tabIndex={i === focusIndex ? 0 : -1}
              onFocus={() => setFocusIndex(i)}
              onPointerEnter={() => setHoverId(r.node.id)}
              onPointerLeave={() => setHoverId((c) => (c === r.node.id ? null : c))}
              onClick={() => descend(r.node)}
              aria-label={`${r.node.label}: ${r.node.value.toLocaleString()}${
                hasChildren ? ", press Enter to open" : ""
              }`}
              className="ns-tap-rect absolute overflow-hidden border text-left transition-colors duration-150 motion-reduce:transition-none"
              style={{
                left: r.x * CELL_W,
                top: r.y * CELL_H,
                width: r.w * CELL_W,
                height: r.h * CELL_H,
                borderColor: hovered ? `color-mix(in srgb, ${tokens.accent} 45%, ${tokens.border})` : tokens.border,
                background: tokens.bg,
                cursor: hasChildren ? "pointer" : "default",
              }}
            >
              <div
                aria-hidden
                className="absolute inset-0 select-none overflow-hidden whitespace-pre leading-[15px]"
                style={{ color: hovered ? tokens.fg : tokens.muted, fontSize: 10 }}
              >
                {Array.from({ length: lines }).map((_, row) => (
                  <div key={row}>{lineText}</div>
                ))}
              </div>
              <div
                aria-hidden
                className="relative z-10 truncate px-1 py-0.5 text-[10px]"
                style={{ background: `color-mix(in srgb, ${tokens.bg} 78%, transparent)`, color: tokens.fg }}
              >
                {r.node.label}
                <span className="ml-1" style={{ color: tokens.muted }}>
                  {r.node.value.toLocaleString()}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
.ns-tap-rect:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ns-tap-crumb:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
