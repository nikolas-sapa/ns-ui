"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// FeatureGridAsciiRule — a feature grid where hovering or focusing a cell
// draws real box-drawing connectors between it and its related features,
// routed orthogonally through the grid's own gutters (never straight through
// a neighbouring cell). Every related pair always meets at the ONE shared
// horizontal gutter between the two rows: the connector drops from the
// source cell's gutter-facing edge, runs across at the gutter's mid-line,
// then rises into the target cell's gutter-facing edge — a uniform 3-segment
// Manhattan route regardless of which rows the two cells sit in, rasterized
// into individual ─ │ ┌ ┐ └ ┘ glyphs at a fixed pitch and revealed glyph by
// glyph (source -> target) on entry, retracted glyph by glyph in the
// opposite order (target -> source) on leave. This is a distinct mechanic
// from grid-bento-ascii (one static seam that structurally disappears when a
// single tile re-spans the whole grid — no relationships, no routing, no
// second cell involved once expanded), grid-bento-dense (FLIP reflow of tile
// footprints, no connectors at all) and grid-magnetic-lattice (a continuous
// cursor-warped field sampled by every line at once, not discrete per-pair
// routes tied to a data relationship).
// ---------------------------------------------------------------------------

export interface FeatureGridAsciiRuleItem {
  id: string;
  title: string;
  description: string;
  /** ids of other items in this same array this feature relates to */
  relatedIds: string[];
}

export interface FeatureGridAsciiRuleProps {
  /** the feature cards */
  items: FeatureGridAsciiRuleItem[];
  /** number of grid columns */
  cols?: number;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

interface Tokens {
  fg: string;
  border: string;
  accent: string;
}

function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    fg: get("--foreground", "#ededed"),
    border: get("--border", "#2e2e2e"),
    accent: get("--ns-accent", "#006bff"),
  };
}

const PITCH = 11; // px per glyph, both axes
const STAGGER = 26; // ms per glyph step
const FADE = 140; // ms per glyph's own fade

type GlyphKind = "h" | "v" | "corner";

interface Glyph {
  x: number;
  y: number;
  ch: string;
  kind: GlyphKind;
  dist: number; // step index from source (0-based)
}

function corner(vert: "up" | "down", horiz: "left" | "right"): string {
  if (vert === "up" && horiz === "right") return "└"; // └
  if (vert === "up" && horiz === "left") return "┘"; // ┘
  if (vert === "down" && horiz === "right") return "┌"; // ┌
  return "┐"; // ┐
}

/** Builds the glyph list for one source -> target connector, routed through
 *  the single shared horizontal gutter between the two grid rows. */
function routeGlyphs(
  a: DOMRect,
  b: DOMRect,
  aIsTopRow: boolean,
  bIsTopRow: boolean,
  containerRect: DOMRect,
  gutterY: number
): Glyph[] {
  const ax = a.left + a.width / 2 - containerRect.left;
  const bx = b.left + b.width / 2 - containerRect.left;
  const aEdgeY = (aIsTopRow ? a.bottom : a.top) - containerRect.top;
  const bEdgeY = (bIsTopRow ? b.bottom : b.top) - containerRect.top;

  const glyphs: Glyph[] = [];
  let step = 0;

  // Anchor dot right on the source cell's own edge — without an explicit
  // mark here the connector's first glyph was drawn centered ON the
  // boundary line (half hidden behind the card), so the wire read as
  // fading into nothing rather than visibly plugging into the cell.
  glyphs.push({ x: ax, y: aEdgeY, ch: "●", kind: "corner", dist: step++ });

  // vertical run from the source cell's gutter-facing edge to the gutter line
  const v1Steps = Math.max(1, Math.round(Math.abs(gutterY - aEdgeY) / PITCH));
  for (let i = 1; i <= v1Steps; i++) {
    const y = aEdgeY + ((gutterY - aEdgeY) * i) / v1Steps;
    glyphs.push({ x: ax, y, ch: "│", kind: "v", dist: step++ });
  }

  // bend 1: connects back toward the source (vert) and across toward bend 2 (horiz)
  const vert1: "up" | "down" = aIsTopRow ? "up" : "down";
  const horiz1: "left" | "right" = bx >= ax ? "right" : "left";
  if (Math.abs(bx - ax) > 1) {
    glyphs.push({ x: ax, y: gutterY, ch: corner(vert1, horiz1), kind: "corner", dist: step++ });

    // horizontal run across the gutter
    const hSteps = Math.max(1, Math.round(Math.abs(bx - ax) / PITCH));
    for (let i = 1; i < hSteps; i++) {
      const x = ax + ((bx - ax) * i) / hSteps;
      glyphs.push({ x, y: gutterY, ch: "─", kind: "h", dist: step++ });
    }

    // bend 2: connects back toward bend 1 (horiz) and up/down toward the target (vert)
    const vert2: "up" | "down" = bIsTopRow ? "up" : "down";
    const horiz2: "left" | "right" = horiz1 === "right" ? "left" : "right";
    glyphs.push({ x: bx, y: gutterY, ch: corner(vert2, horiz2), kind: "corner", dist: step++ });
  } else {
    // same column: no bend needed, straight vertical line the whole way
  }

  // vertical run from the gutter to the target cell's gutter-facing edge
  const v2Steps = Math.max(1, Math.round(Math.abs(bEdgeY - gutterY) / PITCH));
  for (let i = 1; i <= v2Steps; i++) {
    const y = gutterY + ((bEdgeY - gutterY) * i) / v2Steps;
    glyphs.push({ x: bx, y, ch: "│", kind: "v", dist: step++ });
  }

  // Anchor dot on the target cell's edge, same reasoning as the source
  // anchor — this is the glyph that reads "arrived", so it's also the
  // first thing to fade on leave (retraction runs target -> source).
  glyphs.push({ x: bx, y: bEdgeY, ch: "●", kind: "corner", dist: step++ });

  return glyphs;
}

function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

export function FeatureGridAsciiRule({ items, cols = 3, className = "" }: FeatureGridAsciiRuleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [tokens, setTokens] = useState<Tokens>(() =>
    typeof document === "undefined" ? { fg: "#ededed", border: "#2e2e2e", accent: "#006bff" } : readTokens()
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const reducedRef = useRef(false);

  const byId = useMemo(() => {
    const m = new Map<string, FeatureGridAsciiRuleItem>();
    items.forEach((it) => m.set(it.id, it));
    return m;
  }, [items]);

  const rows = Math.ceil(items.length / cols);

  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // active/last-active tracked with a transition timestamp so leaving
  // animates a real retraction rather than an instant clear
  const stateRef = useRef<{ id: string | null; since: number; leavingId: string | null }>({
    id: null,
    since: 0,
    leavingId: null,
  });

  useEffect(() => {
    const now = performance.now();
    if (activeId) {
      stateRef.current = { id: activeId, since: now, leavingId: null };
    } else if (stateRef.current.id) {
      stateRef.current = { id: null, since: now, leavingId: stateRef.current.id };
    }
  }, [activeId]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const sizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(rect.width * dpr);
      canvas.height = Math.ceil(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeCanvas();
    const ro = new ResizeObserver(sizeCanvas);
    ro.observe(container);

    const draw = () => {
      const rect = container.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const st = stateRef.current;
      const showId = st.id ?? st.leavingId;
      if (showId) {
        const source = byId.get(showId);
        const sourceEl = cellRefs.current[showId];
        if (source && sourceEl) {
          const aRect = sourceEl.getBoundingClientRect();
          const aRow = Object.keys(cellRefs.current).indexOf(showId); // fallback, unused
          const aIndex = items.findIndex((it) => it.id === showId);
          const aTopRow = Math.floor(aIndex / cols) === 0;
          const rowGutterTop = Math.min(...items.map((_, i) => (Math.floor(i / cols) === 0 ? 1 : 0)));
          void aRow;
          void rowGutterTop;

          // gutter mid-line: between row 0's bottom and row 1's top, using the
          // first cell of each row actually present
          const row0El = cellRefs.current[items[0]?.id ?? ""];
          const row1Idx = items.findIndex((_, i) => Math.floor(i / cols) === 1);
          const row1El = row1Idx >= 0 ? cellRefs.current[items[row1Idx]!.id] : null;
          const gutterY =
            row0El && row1El
              ? (row0El.getBoundingClientRect().bottom + row1El.getBoundingClientRect().top) / 2 -
                rect.top
              : aRect.bottom - rect.top;

          const now = performance.now();
          const elapsed = now - st.since;
          const advancing = st.id === showId;

          ctx.font = `${PITCH}px "GeistMono", ui-monospace, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          for (const relId of source.relatedIds) {
            const targetEl = cellRefs.current[relId];
            const bIndex = items.findIndex((it) => it.id === relId);
            if (!targetEl || bIndex < 0) continue;
            const bRect = targetEl.getBoundingClientRect();
            const bTopRow = Math.floor(bIndex / cols) === 0;
            const glyphs = routeGlyphs(aRect, bRect, aTopRow, bTopRow, rect, gutterY);
            const n = Math.max(1, glyphs.length);

            for (const g of glyphs) {
              let opacity: number;
              if (reducedRef.current) {
                opacity = advancing ? 1 : 0;
              } else if (advancing) {
                const t = (elapsed - g.dist * STAGGER) / FADE;
                opacity = easeOutCubic(t);
              } else {
                // retract target-first: glyphs nearer the target (higher dist)
                // fade out earlier than glyphs nearer the source
                const revIndex = n - 1 - g.dist;
                const t = (elapsed - revIndex * STAGGER) / FADE;
                opacity = 1 - easeOutCubic(t);
              }
              if (opacity <= 0.01) continue;
              // Anchor dots draw in --ns-accent so both ends read as a clear
              // "plugged in" terminal against the fg-colored border glyphs;
              // the run between them stays --foreground so the accent reads
              // as an endpoint marker, not a wash over the whole wire.
              ctx.fillStyle = g.ch === "●" ? tokens.accent : tokens.fg;
              ctx.globalAlpha = Math.min(1, Math.max(0, opacity)) * (g.ch === "●" ? 1 : 0.9);
              ctx.fillText(g.ch, g.x, g.y);
            }
          }
          ctx.globalAlpha = 1;
        }
      }

      const st2 = stateRef.current;
      const stillLeaving = st2.leavingId && performance.now() - st2.since < STAGGER * 20 + FADE + 40;
      if (!stillLeaving && st2.leavingId) {
        stateRef.current = { id: st2.id, since: st2.since, leavingId: null };
      }
      const active = st2.id !== null || (st2.leavingId !== null && stillLeaving);
      if (active || !reducedRef.current) {
        raf = requestAnimationFrame(draw);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [byId, items, cols, tokens]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <canvas ref={canvasRef} aria-hidden className="ns-fgar-canvas pointer-events-none absolute inset-0 z-10" />
      <div
        className="relative grid gap-x-10 gap-y-8"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const isActive = activeId === item.id;
          const isRelated = activeId != null && byId.get(activeId)?.relatedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              ref={(el) => {
                cellRefs.current[item.id] = el;
              }}
              data-feature-cell={item.id}
              aria-label={`${item.title}: ${item.description}`}
              onPointerEnter={() => setActiveId(item.id)}
              onPointerLeave={() => setActiveId((c) => (c === item.id ? null : c))}
              onFocus={() => setActiveId(item.id)}
              onBlur={() => setActiveId((c) => (c === item.id ? null : c))}
              className={`group relative flex flex-col items-start gap-1.5 rounded-md border p-4 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent ${
                isActive
                  ? "border-foreground/40 bg-surface"
                  : isRelated
                    ? "border-foreground/25 bg-surface/60"
                    : "border-border bg-surface hover:border-foreground/20"
              }`}
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-ns-muted">
                {String(items.indexOf(item) + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-semibold text-foreground">{item.title}</span>
              <span className="text-xs text-ns-muted">{item.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
