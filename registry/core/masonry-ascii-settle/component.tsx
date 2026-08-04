"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// MasonryAsciiSettle — a masonry gallery where every tile renders as live
// ASCII halftone (a deterministic noise field mapped to a " .:-=+*#%@" glyph
// ramp, redrawn on <canvas>) that RESOLVES from a coarse print to a fine one
// exactly as the tile drops into its packed column slot: glyph pitch and drop
// offset ease together on one rAF loop, so "settling" is a real resolution
// change, not a decorative fade layered over a CSS `columns` snap. Column
// packing is this component's own shortest-column-first math (own math, not
// CSS `columns`, which flows top-to-bottom per column and can't be re-packed
// on demand). A container resize that crosses a column-count breakpoint
// re-packs every tile into its new column and replays the full coarse ->
// fine drop for all of them, staggered by row order — the reflow IS the
// interaction. This differs from gallery-coverflow-caustic (a 3D coverflow
// carousel with frosted-glass caustics, one card focused at a time, no
// masonry packing and no ASCII), testimonial-wall-reflow (FLIP-reflows real
// text cards on an expand/collapse toggle, no image content and no
// resolution mechanic), and logo-cloud-settle (drops static SVG marks once
// per viewport entry with no live rendering and no re-pack on resize).
// ---------------------------------------------------------------------------

export interface MasonryAsciiTile {
  id: string;
  title: string;
  /** noise seed for the generated ASCII field */
  seed: number;
  /** height as a multiple of the column width */
  aspect: number;
}

export interface MasonryAsciiSettleProps {
  tiles: MasonryAsciiTile[];
  className?: string;
}

const GAP = 14;
const COARSE_PITCH = 15;
const FINE_PITCH = 6;
const DROP_MS = 620;
const STAGGER_MS = 55;
const DROP_PX = 26;
const RAMP = " .:-=+*#%@";

function columnsFor(width: number): number {
  if (width < 520) return 1;
  if (width < 860) return 2;
  return 3;
}

function hash2(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function noise2(x: number, y: number) {
  return 0.6 * vnoise(x, y) + 0.4 * vnoise(x * 2.1 + 11.3, y * 2.1 + 4.7);
}

function easeOutCubic(t: number) {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

interface Tokens {
  fg: string;
  bg: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return { fg: get("--foreground", "#ededed"), bg: get("--surface", "#171717") };
}

type Pos = { x: number; y: number; w: number; h: number };

function pack(order: string[], sizeOf: (id: string) => number, cols: number, colW: number) {
  const colH = new Array(cols).fill(0);
  const pos: Record<string, Pos> = {};
  for (const id of order) {
    let target = 0;
    for (let c = 1; c < cols; c++) if (colH[c] < colH[target]) target = c;
    const h = sizeOf(id);
    pos[id] = { x: target * (colW + GAP), y: colH[target], w: colW, h };
    colH[target] += h + GAP;
  }
  const maxH = Math.max(0, ...colH.map((h) => Math.max(0, h - GAP)));
  return { pos, maxH };
}

export function MasonryAsciiSettle({ tiles, className = "" }: MasonryAsciiSettleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const wrapRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevColsRef = useRef<number | null>(null);
  const dropStartRef = useRef<Record<string, number>>({});
  const tokensRef = useRef<Tokens>(typeof document === "undefined" ? { fg: "#ededed", bg: "#171717" } : readTokens());
  const reducedRef = useRef(false);
  const rafRef = useRef(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [colW, setColW] = useState(0);
  const [posMap, setPosMap] = useState<Record<string, Pos>>({});

  const ids = useMemo(() => tiles.map((t) => t.id), [tiles]);
  const byId = useMemo(() => {
    const m = new Map<string, MasonryAsciiTile>();
    tiles.forEach((t) => m.set(t.id, t));
    return m;
  }, [tiles]);

  const layout = useCallback(
    (replay: boolean) => {
      const container = containerRef.current;
      if (!container) return;
      const width = container.getBoundingClientRect().width;
      if (width < 4) return;
      const cols = columnsFor(width);
      const w = (width - GAP * (cols - 1)) / cols;
      setColW(w);

      const sizeOf = (id: string) => w * (byId.get(id)?.aspect ?? 1);
      const { pos, maxH } = pack(ids, sizeOf, cols, w);
      setPosMap(pos);
      setContainerHeight(maxH);

      const colsChanged = prevColsRef.current !== null && prevColsRef.current !== cols;
      prevColsRef.current = cols;

      if (replay && (colsChanged || dropStartRef.current["__first"] === undefined)) {
        dropStartRef.current["__first"] = 1;
        const now = performance.now();
        // stagger by final row (y), then column (x), so the reflow reads top
        // to bottom, left to right
        const order = [...ids].sort((a, b) => {
          const pa = pos[a];
          const pb = pos[b];
          if (!pa || !pb) return 0;
          if (Math.abs(pa.y - pb.y) > 1) return pa.y - pb.y;
          return pa.x - pb.x;
        });
        order.forEach((id, i) => {
          dropStartRef.current[id] = now + i * STAGGER_MS;
        });
        wake();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids, byId]
  );

  const wake = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(loop);
  };

  const loop = () => {
    rafRef.current = 0;
    const now = performance.now();
    let stillAnimating = false;

    for (const id of ids) {
      const canvas = canvasRefs.current[id];
      const wrap = wrapRefs.current[id];
      if (!canvas || !wrap) continue;
      const start = dropStartRef.current[id];
      const tile = byId.get(id);
      if (!tile) continue;

      let t = 1;
      if (start !== undefined && !reducedRef.current) {
        const elapsed = now - start;
        if (elapsed < 0) {
          t = 0;
          stillAnimating = true;
        } else {
          t = Math.min(1, elapsed / DROP_MS);
          if (t < 1) stillAnimating = true;
        }
      }
      const eased = easeOutCubic(t);
      wrap.style.transform = `translateY(${(1 - eased) * -DROP_PX}px)`;
      wrap.style.opacity = String(0.15 + 0.85 * eased);

      const pitch = COARSE_PITCH + (FINE_PITCH - COARSE_PITCH) * eased;
      paintTile(canvas, tile.seed, pitch);
    }

    if (stillAnimating) rafRef.current = requestAnimationFrame(loop);
  };

  const paintTile = (canvas: HTMLCanvasElement, seed: number, pitch: number) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 1;
    const cssH = canvas.clientHeight || 1;
    const targetW = Math.ceil(cssW * dpr);
    const targetH = Math.ceil(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { fg, bg } = tokensRef.current;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    const cols = Math.max(1, Math.ceil(cssW / pitch));
    const rows = Math.max(1, Math.ceil(cssH / pitch));
    const cellW = cssW / cols;
    const cellH = cssH / rows;
    ctx.fillStyle = fg;
    ctx.font = `${Math.max(6, Math.round(cellH * 0.95))}px "GeistMono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const v = Math.min(1, Math.max(0, noise2(gx * 0.3 + seed * 13.7, gy * 0.3 + seed * 5.1)));
        const idx = Math.min(RAMP.length - 1, Math.floor(v * RAMP.length));
        const ch = RAMP[idx];
        if (!ch || ch === " ") continue;
        ctx.fillText(ch, gx * cellW + cellW / 2, gy * cellH + cellH / 2);
      }
    }
  };

  useLayoutEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    tokensRef.current = readTokens();
    layout(true);
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => layout(true));
    ro.observe(container);
    const mo = new MutationObserver(() => {
      tokensRef.current = readTokens();
      wake();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    layout(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ height: containerHeight || undefined }}
    >
      {tiles.map((tile) => {
        const p = posMap[tile.id];
        return (
          <div
            key={tile.id}
            ref={(el) => {
              wrapRefs.current[tile.id] = el;
            }}
            data-masonry-tile={tile.id}
            className="absolute overflow-hidden rounded-md border border-border will-change-transform"
            style={{
              left: p?.x ?? 0,
              top: p?.y ?? 0,
              width: p?.w ?? colW,
              height: p?.h ?? colW,
            }}
          >
            <canvas
              ref={(el) => {
                canvasRefs.current[tile.id] = el;
              }}
              aria-hidden
              className="block h-full w-full"
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-background/90 to-transparent px-3 py-2 font-mono text-[11px] text-foreground">
              {tile.title}
            </span>
          </div>
        );
      })}
      <p className="sr-only">
        {tiles.length} images: {tiles.map((t) => t.title).join(", ")}.
      </p>
    </div>
  );
}
