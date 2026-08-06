"use client";

import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// AsciiSankeyFlow — a weighted, branching multi-stage flow diagram where the
// connecting bands are rendered as ASCII density ramp (" .:-=+*#%@") rather
// than colour, and node height is proportional to its own throughput. THE
// mechanic that separates this from a picture: clicking a node ISOLATES it —
// every ancestor (any node with a path leading into it) and every descendant
// (any node reachable from it) stays, everything else disappears — and the
// remaining nodes/bands don't just get left at their old size with everyone
// else dimmed: each surviving stage re-stacks from scratch using ONLY the
// isolated subset's values, so the visible nodes and bands genuinely GROW to
// fill the same vertical space the full graph used to occupy. Undoing the
// isolation (Escape, or the "Show all" control) re-expands back to the full
// graph. Pure DOM text + CSS, zero dependencies.
// ---------------------------------------------------------------------------

export interface SankeyNode {
  id: string;
  label: string;
  stage: number;
  value: number;
}

export interface SankeyLink {
  from: string;
  to: string;
  value: number;
}

export interface AsciiSankeyFlowProps {
  /** the diagram's nodes */
  nodes?: SankeyNode[];
  /** the flows between nodes */
  links?: SankeyLink[];
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const ASCII_RAMP = " .:-=+*#%@";

const STAGE_COUNT = 3;
const NODE_W = 3;
const BAND_W = 10;
const ROWS_STAGE = 16;
const CELL_W = 12;
const CELL_H = 15;
const TOP_PAD = 1;
const COLS = STAGE_COUNT * NODE_W + (STAGE_COUNT - 1) * BAND_W + 2;
const ROWS = ROWS_STAGE + TOP_PAD + 1;

const DEFAULT_NODES: SankeyNode[] = [
  { id: "search", label: "Search", stage: 0, value: 100 },
  { id: "social", label: "Social", stage: 0, value: 60 },
  { id: "referral", label: "Referral", stage: 0, value: 40 },
  { id: "onboarded", label: "Onboarded", stage: 1, value: 125 },
  { id: "bounced", label: "Bounced", stage: 1, value: 75 },
  { id: "converted", label: "Converted", stage: 2, value: 100 },
  { id: "churned", label: "Churned", stage: 2, value: 100 },
];

const DEFAULT_LINKS: SankeyLink[] = [
  { from: "search", to: "onboarded", value: 70 },
  { from: "search", to: "bounced", value: 30 },
  { from: "social", to: "onboarded", value: 30 },
  { from: "social", to: "bounced", value: 30 },
  { from: "referral", to: "onboarded", value: 25 },
  { from: "referral", to: "bounced", value: 15 },
  { from: "onboarded", to: "converted", value: 90 },
  { from: "onboarded", to: "churned", value: 35 },
  { from: "bounced", to: "converted", value: 10 },
  { from: "bounced", to: "churned", value: 65 },
];

interface Span {
  top: number;
  bottom: number;
}

// Cumulative-rounded 1D stacking — same technique as treemap-ascii-partition's
// layoutSlice, collapsed to one axis: every boundary derives from the running
// total so far, so adjacent spans always share an exact edge.
function stackSpans<T extends { value: number }>(items: T[], top: number, bottom: number): Span[] {
  const total = items.reduce((s, i) => s + Math.max(0, i.value), 0) || 1;
  const height = bottom - top;
  let acc = 0;
  let cursor = top;
  return items.map((item) => {
    acc += Math.max(0, item.value);
    const next = top + Math.round((acc / total) * height);
    const span = { top: cursor, bottom: Math.max(cursor + 1, next) };
    cursor = span.bottom;
    return span;
  });
}

function stageCol(stage: number): number {
  return 1 + stage * (NODE_W + BAND_W);
}

// This used to read --foreground/--background/etc via getComputedStyle at
// mount, hold them in state, and apply the result as raw hex through inline
// `style` — a real bug, not a style choice, see diagram-ascii-flow's
// component.tsx for the full story. Short version: SSR always renders with
// no `document`, so the FIRST markup bakes in the light-theme fallback hex,
// and because the client-computed value never CHANGES across renders (this
// component recomputes the same "correct" dark hex every time), React never
// patches it into the DOM — it only writes an attribute when the new
// render's value differs from the PREVIOUS render's, not from what's
// actually painted. Confirmed live here too: on a fresh load with dark mode
// already saved (the anti-flash script sets `.dark` on `<html>` before
// hydration), every node rendered background rgb(255,255,255) against a
// rgb(10,10,10) page. Tailwind classes bound to the same custom properties
// sidestep the whole bug class: the cascade resolves --background per theme
// at PAINT time, no JS or hydration step involved.

// Every node reachable from `id` by walking edges backward (ancestors) or
// forward (descendants) — the "isolate" set is {id} union both directions,
// which is what makes it a real subgraph isolation rather than a 1-hop
// highlight.
function reachable(id: string, links: SankeyLink[], direction: "forward" | "backward"): Set<string> {
  const out = new Set<string>();
  const frontier = [id];
  while (frontier.length) {
    const cur = frontier.pop()!;
    for (const link of links) {
      const next = direction === "forward" ? (link.from === cur ? link.to : null) : link.to === cur ? link.from : null;
      if (next && !out.has(next)) {
        out.add(next);
        frontier.push(next);
      }
    }
  }
  return out;
}

export function AsciiSankeyFlow({
  nodes = DEFAULT_NODES,
  links = DEFAULT_LINKS,
  className = "",
}: AsciiSankeyFlowProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const isolatedIds = useMemo(() => {
    if (!selectedId) return null;
    const ancestors = reachable(selectedId, links, "backward");
    const descendants = reachable(selectedId, links, "forward");
    return new Set<string>([selectedId, ...ancestors, ...descendants]);
  }, [selectedId, links]);

  const visibleNodes = useMemo(
    () => (isolatedIds ? nodes.filter((n) => isolatedIds.has(n.id)) : nodes),
    [nodes, isolatedIds]
  );
  const visibleLinks = useMemo(
    () =>
      isolatedIds ? links.filter((l) => isolatedIds.has(l.from) && isolatedIds.has(l.to)) : links,
    [links, isolatedIds]
  );

  // per-stage vertical spans, restacked from ONLY the currently visible
  // nodes' values — this is the re-weight: an isolated subset's nodes claim
  // the full ROWS_STAGE height among just themselves, not a subset of the
  // full graph's original spans.
  const nodeSpan = useMemo(() => {
    const map = new Map<string, Span>();
    for (let stage = 0; stage < STAGE_COUNT; stage++) {
      const stageNodes = visibleNodes.filter((n) => n.stage === stage);
      const spans = stackSpans(stageNodes, TOP_PAD, TOP_PAD + ROWS_STAGE);
      stageNodes.forEach((n, i) => map.set(n.id, spans[i]));
    }
    return map;
  }, [visibleNodes]);

  // per-node, per-link sub-spans (outgoing sub-spans partition the node's
  // own span for bands leaving it; incoming sub-spans partition it for bands
  // arriving) — same cumulative stacking, one level down.
  const linkSpan = useMemo(() => {
    const outMap = new Map<string, Span>(); // keyed by `${link.from}->${link.to}`
    const inMap = new Map<string, Span>();
    for (const node of visibleNodes) {
      const outgoing = visibleLinks.filter((l) => l.from === node.id);
      const incoming = visibleLinks.filter((l) => l.to === node.id);
      const span = nodeSpan.get(node.id);
      if (!span) continue;
      const outSpans = stackSpans(outgoing, span.top, span.bottom);
      outgoing.forEach((l, i) => outMap.set(`${l.from}->${l.to}`, outSpans[i]));
      const inSpans = stackSpans(incoming, span.top, span.bottom);
      incoming.forEach((l, i) => inMap.set(`${l.from}->${l.to}`, inSpans[i]));
    }
    return { outMap, inMap };
  }, [visibleNodes, visibleLinks, nodeSpan]);

  const maxLinkValue = useMemo(() => Math.max(1, ...visibleLinks.map((l) => l.value)), [visibleLinks]);

  const rows = useMemo(() => {
    const cells: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(" "));
    for (const link of visibleLinks) {
      const srcNode = visibleNodes.find((n) => n.id === link.from);
      const dstNode = visibleNodes.find((n) => n.id === link.to);
      if (!srcNode || !dstNode) continue;
      const srcSpan = linkSpan.outMap.get(`${link.from}->${link.to}`);
      const dstSpan = linkSpan.inMap.get(`${link.from}->${link.to}`);
      if (!srcSpan || !dstSpan) continue;
      const srcRight = stageCol(srcNode.stage) + NODE_W;
      const dstLeft = stageCol(dstNode.stage) - 1;
      const level = Math.max(1, Math.round((link.value / maxLinkValue) * (ASCII_RAMP.length - 1)));
      const ch = ASCII_RAMP[level];
      for (let x = srcRight; x <= dstLeft; x++) {
        const t = dstLeft > srcRight ? (x - srcRight) / (dstLeft - srcRight) : 0;
        const top = srcSpan.top + (dstSpan.top - srcSpan.top) * t;
        const bottom = srcSpan.bottom + (dstSpan.bottom - srcSpan.bottom) * t;
        for (let y = Math.round(top); y < Math.round(bottom); y++) {
          if (y >= 0 && y < ROWS && x >= 0 && x < COLS) cells[y][x] = ch;
        }
      }
    }
    return cells.map((r) => r.join(""));
  }, [visibleLinks, visibleNodes, linkSpan, maxLinkValue]);

  const connectionsCount = (id: string) => links.filter((l) => l.from === id || l.to === id).length;

  return (
    <div className={`ns-saf font-mono ${className}`}>
      <style>{CSS}</style>

      <div className="relative" style={{ width: COLS * CELL_W, height: ROWS * CELL_H, maxWidth: "100%" }}>
        {/* Each character is its own fixed-width span rather than one flowing
            text string per row: a browser's real monospace glyph advance
            almost never equals CELL_W exactly, and the bands must land on
            the SAME px grid the absolutely-positioned node buttons use — a
            flowing string drifts column alignment cumulatively across the
            row until bands land under the wrong node entirely. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 text-ns-muted"
          style={{ fontSize: 10 }}
        >
          {rows.map((line, y) => (
            <div key={y} style={{ height: CELL_H, lineHeight: `${CELL_H}px`, whiteSpace: "nowrap" }}>
              {line.split("").map((ch, x) => (
                <span key={x} style={{ display: "inline-block", width: CELL_W, textAlign: "center" }}>
                  {ch}
                </span>
              ))}
            </div>
          ))}
        </div>

        {visibleNodes.map((n) => {
          const span = nodeSpan.get(n.id);
          if (!span) return null;
          const selected = selectedId === n.id;
          const hovered = hoverId === n.id;
          const col = stageCol(n.stage);
          return (
            <button
              key={n.id}
              type="button"
              data-sankey-node={n.id}
              aria-pressed={selected}
              aria-label={`${n.label}: ${n.value.toLocaleString()}, ${connectionsCount(n.id)} connection${
                connectionsCount(n.id) === 1 ? "" : "s"
              }. Press Enter to isolate its upstream and downstream flow.`}
              className={`ns-saf-node absolute overflow-hidden border bg-background text-left text-[10px] transition-colors duration-150 motion-reduce:transition-none ${
                selected
                  ? "border-ns-accent text-foreground"
                  : hovered
                    ? "border-ns-accent/40 text-foreground"
                    : "border-border text-ns-muted"
              }`}
              style={{
                left: col * CELL_W,
                top: span.top * CELL_H,
                width: NODE_W * CELL_W,
                height: (span.bottom - span.top) * CELL_H,
              }}
              onPointerEnter={() => setHoverId(n.id)}
              onPointerLeave={() => setHoverId((c) => (c === n.id ? null : c))}
              onClick={() => setSelectedId(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSelectedId(null);
              }}
            >
              <span className="block truncate px-1 pt-0.5">{n.label}</span>
              <span className="block px-1 text-ns-muted">{n.value}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-[1.5em] font-mono text-xs text-ns-muted">
        {selectedId ? (
          <span data-sankey-isolated className="inline-flex items-center gap-2">
            Isolated: <strong className="text-foreground">{nodes.find((n) => n.id === selectedId)?.label}</strong> —{" "}
            {visibleNodes.length} of {nodes.length} nodes
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="ns-saf-clear rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-ns-muted transition-colors duration-150 motion-reduce:transition-none hover:text-foreground"
            >
              Show all
            </button>
          </span>
        ) : (
          <span>Click a node to isolate its upstream and downstream flow.</span>
        )}
      </div>
    </div>
  );
}

const CSS = `
.ns-saf-node:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
.ns-saf-clear:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
`;
