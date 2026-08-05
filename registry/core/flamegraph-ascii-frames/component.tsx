"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

// ---------------------------------------------------------------------------
// FlamegraphAsciiFrames — a CPU-profile flame graph laid out in monospace
// character cells. One ROW per stack depth, frame WIDTH proportional to sample
// count, self-vs-total time encoded as ink weight. This is deliberately NOT a
// squarified/slice-and-dice partition (that is treemap-ascii-partition's
// mechanism): there is a real depth axis here, and a frame's horizontal extent
// is inherited from its parent's extent, never re-packed to fill a rectangle.
//
// LAYOUT: the zoom root spans all `cols` columns. A child of a frame spanning
// [x, x+w) gets childW = round(w * total(child) / total(parent)), laid left to
// right in the parent's own declared child order — stable, never sorted by
// size, so the same call site sits in the same place across renders. Children
// whose childW < 3 are dropped and accumulated into ONE trailing `... n` frame
// carrying their summed sample count: narrow frames become one honest marker
// instead of a row of unreadable one-column slivers.
//
// GLYPHS: a frame renders a left rule followed by its name truncated with an
// ellipsis to w-1 columns. The rest of its row is blank, so the graph is
// mostly negative space with a stepped silhouette rather than a filled block.
// ---------------------------------------------------------------------------

export interface FlameNode {
  /** Frame name, as it would appear in a profiler's stack. */
  name: string;
  /** Samples attributed to this frame itself, excluding its children. */
  self: number;
  children?: FlameNode[];
}

export interface FlamegraphAsciiFramesProps {
  /** Root of the sample tree. Totals are rolled up once, internally. */
  tree?: FlameNode;
  /** Rows are this tall in px; also drives the graph's overall height. */
  rowHeight?: number;
  className?: string;
}

/** A child narrower than this many columns cannot carry a readable label. */
const MIN_FRAME_COLS = 3;
/** Self-fraction bucket edges. Four buckets are the ONLY visual encoding. */
const INK_BUCKETS = [0.02, 0.1, 0.3] as const;
/** Fallback column count used for the first paint, before measurement. */
const DEFAULT_COLS = 96;

const DEFAULT_TREE: FlameNode = {
  name: "node server.js",
  self: 74,
  children: [
    { name: "uv__io_poll", self: 486 },
    {
      name: "http.Server.emit",
      self: 74,
      children: [
        {
          name: "router.handle",
          self: 96,
          children: [
            { name: "parseHeaders", self: 402 },
            {
              name: "auth.verifyJwt",
              self: 130,
              children: [
                { name: "crypto.verify", self: 314 },
                { name: "jwt.decode", self: 14, children: [{ name: "Buffer.toString", self: 152 }] },
              ],
            },
            {
              name: "orders.list",
              self: 160,
              children: [
                {
                  name: "pg.query",
                  self: 68,
                  children: [
                    { name: "net.write", self: 214 },
                    {
                      name: "parseRowDescription",
                      self: 20,
                      children: [{ name: "Buffer.readUInt32BE", self: 234 }],
                    },
                  ],
                },
                { name: "serialize", self: 34, children: [{ name: "JSON.stringify", self: 284 }] },
              ],
            },
            { name: "metrics.observe", self: 18, children: [{ name: "hist.record", self: 22 }] },
            { name: "cors.apply", self: 14 },
            { name: "compress.gzip", self: 96 },
          ],
        },
        { name: "keepAliveTimeout", self: 26 },
      ],
    },
    { name: "gc.MarkCompact", self: 168 },
    { name: "require.resolve", self: 12 },
  ],
};

// --- rollup ---------------------------------------------------------------

interface RolledNode {
  key: string;
  name: string;
  self: number;
  /** total(n) = n.self + sum(total(children)), memoized once per tree. */
  total: number;
  children: RolledNode[];
}

function roll(node: FlameNode, key: string, index: Map<string, RolledNode>): RolledNode {
  const children = (node.children ?? []).map((c, i) => roll(c, `${key}.${i}`, index));
  const self = Math.max(0, node.self);
  const rolled: RolledNode = {
    key,
    name: node.name,
    self,
    total: self + children.reduce((s, c) => s + c.total, 0),
    children,
  };
  index.set(key, rolled);
  return rolled;
}

// --- layout ---------------------------------------------------------------

interface Frame {
  key: string;
  name: string;
  depth: number;
  /** Column offset and width, in character cells of the current `cols` grid. */
  x: number;
  w: number;
  self: number;
  total: number;
  parentKey: string | null;
  hasChildren: boolean;
  /** True for the aggregate `...` marker standing in for dropped siblings. */
  fold: boolean;
  foldCount: number;
}

function layoutFrames(root: RolledNode, cols: number): Frame[] {
  const out: Frame[] = [];
  walk(root, 0, cols, 0, null, out);
  return out;
}

function walk(
  node: RolledNode,
  x: number,
  w: number,
  depth: number,
  parentKey: string | null,
  out: Frame[],
) {
  out.push({
    key: node.key,
    name: node.name,
    depth,
    x,
    w,
    self: node.self,
    total: node.total,
    parentKey,
    hasChildren: node.children.length > 0,
    fold: false,
    foldCount: 0,
  });

  if (!node.children.length || node.total <= 0 || w <= 0) return;

  const childrenTotal = node.children.reduce((s, c) => s + c.total, 0);
  // The children run occupies only their share of the parent's span; the
  // remainder to the right is the parent's own self time, left as blank.
  const span = Math.round((w * childrenTotal) / node.total);

  const kept: { node: RolledNode; w: number }[] = [];
  let foldSamples = 0;
  let foldW = 0;
  let foldCount = 0;
  for (const child of node.children) {
    const cw = Math.max(0, Math.round((w * child.total) / node.total));
    if (cw < MIN_FRAME_COLS) {
      foldSamples += child.total;
      foldW += cw;
      foldCount += 1;
    } else {
      kept.push({ node: child, w: cw });
    }
  }

  // Rounding residual is absorbed by the LAST laid frame, so the run ends
  // exactly on `span` rather than drifting a column per child.
  let markerW = foldCount ? Math.max(MIN_FRAME_COLS, foldW) : 0;
  const laid = kept.reduce((s, k) => s + k.w, 0) + markerW;
  const residual = span - laid;
  if (foldCount) markerW = Math.max(MIN_FRAME_COLS, markerW + residual);
  else if (kept.length)
    kept[kept.length - 1].w = Math.max(MIN_FRAME_COLS, kept[kept.length - 1].w + residual);

  let cursor = x;
  const limit = x + w;
  for (const k of kept) {
    const width = Math.min(k.w, limit - cursor);
    if (width < 1) break;
    walk(k.node, cursor, width, depth + 1, node.key, out);
    cursor += width;
  }
  if (foldCount && cursor < limit) {
    // Let the marker borrow up to its own label length from the blank
    // self-time gutter to its right, so `⋯ 54` stays readable instead of
    // truncating to a bare ellipsis at the 3-column floor.
    const desired = `⋯ ${foldSamples.toLocaleString()}`.length;
    out.push({
      key: `${node.key}~fold`,
      name: "",
      depth: depth + 1,
      x: cursor,
      w: Math.min(Math.max(markerW, desired), limit - cursor),
      self: foldSamples,
      total: foldSamples,
      parentKey: node.key,
      hasChildren: false,
      fold: true,
      foldCount,
    });
  }
}

// --- ink ------------------------------------------------------------------

// Ink weight is bucketed self-fraction and nothing else: no fills, no hue
// ramp, no gradient. A leaf is 100% self, so accent ink lands exactly on the
// tips of the silhouette — where the CPU time actually is.
function inkClass(self: number, total: number): string {
  const s = total > 0 ? self / total : 0;
  if (s < INK_BUCKETS[0]) return "text-border";
  if (s < INK_BUCKETS[1]) return "text-ns-muted";
  if (s < INK_BUCKETS[2]) return "text-foreground";
  return "text-ns-accent";
}

function fit(name: string, width: number): string {
  if (width <= 0) return "";
  if (name.length <= width) return name;
  if (width === 1) return "…";
  return name.slice(0, width - 1) + "…";
}

function pct(part: number, whole: number): string {
  return `${whole > 0 ? ((part / whole) * 100).toFixed(1) : "0.0"}%`;
}

export function FlamegraphAsciiFrames({
  tree = DEFAULT_TREE,
  rowHeight = 22,
  className = "",
}: FlamegraphAsciiFramesProps) {
  const [zoomPath, setZoomPath] = useState<string[]>(["0"]);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  /** Which frame Tab lands on — survives blur, unlike `focusKey`. */
  const [tabKey, setTabKey] = useState<string | null>(null);
  const [cols, setCols] = useState(DEFAULT_COLS);

  const wrapRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const { root, index } = useMemo(() => {
    const map = new Map<string, RolledNode>();
    return { root: roll(tree, "0", map), index: map };
  }, [tree]);

  // A zoom path whose tail no longer exists (data swapped under us) falls back
  // to the true root rather than rendering nothing.
  const safePath = useMemo(() => {
    const valid = zoomPath.filter((k) => index.has(k));
    return valid.length ? valid : ["0"];
  }, [zoomPath, index]);

  const zoomRoot = index.get(safePath[safePath.length - 1]) ?? root;

  // Column count comes from a ResizeObserver over the graph box divided by one
  // measured monospace advance. No rAF loop, no canvas — this memo is the only
  // recompute, over (tree, zoomPath, cols).
  useEffect(() => {
    const wrap = wrapRef.current;
    const probe = probeRef.current;
    if (!wrap || !probe) return;
    const measure = () => {
      const advance = probe.getBoundingClientRect().width / 40;
      const width = wrap.clientWidth;
      if (!advance || !width) return;
      setCols(Math.max(24, Math.floor(width / advance)));
    };
    measure();
    // The first measure can land on a fallback font; re-measure once the real
    // mono face is in, or every column would be sized off the wrong advance.
    let disposed = false;
    document.fonts?.ready.then(() => {
      if (!disposed) measure();
    });
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => {
      disposed = true;
      ro.disconnect();
    };
  }, []);

  const frames = useMemo(() => layoutFrames(zoomRoot, cols), [zoomRoot, cols]);
  const depthCount = frames.reduce((m, f) => Math.max(m, f.depth), 0) + 1;

  const byKey = useMemo(() => {
    const m = new Map<string, Frame>();
    for (const f of frames) m.set(f.key, f);
    return m;
  }, [frames]);

  const activeKey = hoverKey ?? focusKey;

  // The active frame plus its whole ancestor chain keeps full ink; everything
  // else drops to --border.
  const litKeys = useMemo(() => {
    if (!activeKey) return null;
    const lit = new Set<string>();
    let cur: Frame | undefined = byKey.get(activeKey);
    while (cur) {
      lit.add(cur.key);
      cur = cur.parentKey ? byKey.get(cur.parentKey) : undefined;
    }
    return lit;
  }, [activeKey, byKey]);

  const readout = (activeKey && byKey.get(activeKey)) || byKey.get(zoomRoot.key);

  const pathId = safePath.join("/");
  /** Set when a zoom pops the focused frame out of the tree, so focus can land
   * on the new root instead of falling back to <body>. */
  const restoreRootFocus = useRef(false);
  useEffect(() => {
    setFocusKey(null);
    setHoverKey(null);
    setTabKey(null);
    if (restoreRootFocus.current) {
      restoreRootFocus.current = false;
      const rootKey = frames[0]?.key;
      if (rootKey) btnRefs.current[rootKey]?.focus();
    }
    // `frames` is read only to reach the freshly laid root frame for that
    // focus hand-off; re-running on every layout would steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathId]);

  const zoomTo = useCallback(
    (key: string) => {
      const node = index.get(key);
      if (!node) return;
      // The key encodes the path from the root ("0.1.0"), so the crumb chain
      // is just its prefixes — no separate parent bookkeeping.
      const parts = key.split(".");
      setZoomPath(parts.map((_, i) => parts.slice(0, i + 1).join(".")));
    },
    [index],
  );

  const focusFrame = useCallback((key: string | undefined) => {
    if (!key) return;
    btnRefs.current[key]?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (safePath.length > 1) {
        e.preventDefault();
        restoreRootFocus.current = true;
        setZoomPath(["0"]);
      }
      return;
    }
    // The frame is read off the event target rather than `focusKey`: a zoom
    // clears that state while the DOM node keeps focus, and arrow keys would
    // otherwise go dead until the user tabbed out and back.
    const el = (e.target as HTMLElement | null)?.closest?.("[data-frame-key]");
    const key = el?.getAttribute("data-frame-key");
    const current = key ? byKey.get(key) : undefined;
    if (!current) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const row = frames
        .filter((f) => f.depth === current.depth && !f.fold)
        .sort((a, b) => a.x - b.x);
      const i = row.findIndex((f) => f.key === current.key);
      const next = row[i + (e.key === "ArrowRight" ? 1 : -1)];
      focusFrame(next?.key);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusFrame(current.parentKey ?? undefined);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const child = frames
        .filter((f) => f.parentKey === current.key && !f.fold)
        .sort((a, b) => a.x - b.x)[0];
      focusFrame(child?.key);
    }
  };

  const crumbs = safePath.map((k) => index.get(k)!).filter(Boolean);
  const rootTabKey = frames[0]?.key;

  return (
    // Escape / arrow handling sits on the outer wrapper so it also works while
    // focus is on a breadcrumb crumb, not only inside the graph box.
    <div className={`ns-flame font-mono ${className}`} onKeyDown={onKeyDown}>
      <style>{CSS}</style>

      <div
        role="group"
        aria-label="Zoom path"
        className="mb-2 flex min-h-[22px] flex-wrap items-center gap-1 text-[11px]"
      >
        {crumbs.length > 1 &&
          crumbs.map((c, i) => (
            <span key={c.key} className="flex items-center gap-1">
              {i > 0 && (
                <span aria-hidden className="text-border">
                  {"›"}
                </span>
              )}
              <button
                type="button"
                data-flame-crumb={i === 0 ? "root" : c.key}
                onClick={() => setZoomPath(safePath.slice(0, i + 1))}
                aria-current={i === crumbs.length - 1 ? "location" : undefined}
                aria-label={i === 0 ? "Zoom out to the whole graph" : `Zoom to ${c.name}`}
                className={`ns-flame-crumb rounded-sm px-1.5 py-0.5 transition-colors duration-150 motion-reduce:transition-none hover:text-foreground ${
                  i === crumbs.length - 1 ? "text-foreground" : "text-ns-muted"
                }`}
              >
                {i === 0 ? "root" : c.name}
              </button>
            </span>
          ))}
      </div>

      <div
        ref={wrapRef}
        data-flame-graph
        role="group"
        aria-label={`Flame graph of ${zoomRoot.name}, ${zoomRoot.total.toLocaleString()} samples. Arrow keys move between frames, Enter zooms, Escape resets.`}
        onPointerLeave={() => setHoverKey(null)}
        className="relative w-full select-none text-[13px]"
        style={{ height: depthCount * rowHeight }}
      >
        <span
          ref={probeRef}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0"
          style={{ whiteSpace: "pre" }}
        >
          {"0".repeat(40)}
        </span>

        {frames.map((f) => {
          const left = `${(f.x / cols) * 100}%`;
          const width = `${(f.w / cols) * 100}%`;
          const dim = litKeys ? !litKeys.has(f.key) : false;

          if (f.fold) {
            // Aggregate marker: it has no self-fraction of its own, so it sits
            // outside the four-bucket encoding at --ns-muted, and is static text
            // rather than a control — there is nothing to zoom into.
            return (
              <span
                key={f.key}
                role="img"
                aria-label={`Depth ${f.depth}, ${f.foldCount} frames too narrow to draw, ${f.total.toLocaleString()} samples combined.`}
                className={`ns-flame-fold absolute overflow-hidden whitespace-pre transition-colors duration-[120ms] motion-reduce:transition-none ${
                  dim ? "text-border" : "text-ns-muted"
                }`}
                style={{ left, width, top: f.depth * rowHeight, lineHeight: `${rowHeight}px` }}
              >
                {(() => {
                  const label = `⋯ ${f.total.toLocaleString()}`;
                  return label.length <= f.w ? label : "⋯";
                })()}
              </span>
            );
          }

          return (
            <button
              key={f.key}
              type="button"
              ref={(el) => {
                btnRefs.current[f.key] = el;
              }}
              data-flame-frame
              data-frame-key={f.key}
              data-frame-depth={f.depth}
              tabIndex={f.key === (tabKey ?? rootTabKey) ? 0 : -1}
              onFocus={() => {
                setFocusKey(f.key);
                setTabKey(f.key);
              }}
              onBlur={() => setFocusKey((k) => (k === f.key ? null : k))}
              onPointerEnter={() => setHoverKey(f.key)}
              onClick={() => zoomTo(f.key)}
              aria-label={`Depth ${f.depth}, ${f.name}, self ${pct(
                f.self,
                zoomRoot.total,
              )}, total ${pct(f.total, zoomRoot.total)}, ${f.total.toLocaleString()} samples${
                f.hasChildren ? ". Press Enter to zoom to this subtree." : "."
              }`}
              className={`ns-flame-frame absolute overflow-hidden whitespace-pre text-left transition-colors duration-[120ms] motion-reduce:transition-none ${
                dim ? "text-border" : inkClass(f.self, f.total)
              }`}
              style={{ left, width, top: f.depth * rowHeight, lineHeight: `${rowHeight}px` }}
            >
              <span aria-hidden>
                {"│"}
                {fit(f.name, f.w - 1)}
              </span>
            </button>
          );
        })}
      </div>

      <div
        data-flame-readout
        className="mt-3 overflow-hidden whitespace-nowrap border-t border-border pt-2 text-[12px] text-ns-muted transition-colors duration-[120ms] motion-reduce:transition-none"
      >
        {readout && (
          <>
            <span className="text-foreground">{readout.fold ? "folded frames" : readout.name}</span>
            <span className="ml-4">self </span>
            <span className="text-foreground">{pct(readout.self, zoomRoot.total)}</span>
            <span className="ml-3">total </span>
            <span className="text-foreground">{pct(readout.total, zoomRoot.total)}</span>
            <span className="ml-3 text-foreground">{readout.total.toLocaleString()}</span>
            <span> samples</span>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.ns-flame-frame:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: -2px; }
.ns-flame-crumb:focus-visible { outline: 2px solid var(--ns-accent); outline-offset: 2px; }
`;
