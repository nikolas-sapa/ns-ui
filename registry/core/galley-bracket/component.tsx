"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// GalleyBracket — remote collaborators' live selections drawn as proofreader's
// marks, not highlight washes: a thin corner bracket at each end of a range,
// a hairline underline between them, and the selector's initials set small in
// the left margin at the opening bracket. Ranges are measured off the real
// rendered text with Range.getClientRects() (a Range over one text node, the
// same primitive selecting the text and reading getClientRects() would use),
// so a multi-line selection gets one underline per wrapped line and brackets
// only at its true start/end — never one per line. When ranges overlap, the
// only thing that varies per selection is its arrival index within that
// overlap group (arrival order, not z-index or hue): later arrivals' brackets
// stand outward from the text by index*3px and draw slightly lighter, so
// concurrent selections nest like stacked proof brackets instead of blending
// into a third, unreadable color. Marks draw in with a 160ms stroke-dashoffset
// reveal on first arrival only — the same selection re-ranging (a drag) never
// replays it, which is what keeps rapid re-selection from strobing. The SVG
// layer is aria-hidden; the real accessible surface is a debounced (2s)
// role=status summary ("Ana selected 12 words") plus a keyboard-reachable
// list of jump buttons that move the platform's own Selection into the named
// range. Every stroke is --foreground at reduced opacity — no filled
// highlights, ever, because two overlapping fills produce a third value that
// identifies nobody. DOM+SVG+CSS only, no canvas.
// ---------------------------------------------------------------------------

export interface GalleyBracketSelection {
  /** stable id for this collaborator's current range */
  id: string;
  /** full name — used in the debounced summary and the jump list */
  name: string;
  /** short code drawn small in the margin at the opening bracket; derived from `name` if omitted */
  initials?: string;
  /** character offset into `text` where the range starts */
  start: number;
  /** character offset into `text` where the range ends (exclusive) */
  end: number;
  /** arrival order key, lower = earlier. Defaults to this selection's index in the array, so
   *  passing a freshly-appended selection last is enough to make it the latest arrival. */
  arrivedAt?: number;
}

export interface GalleyBracketProps {
  /** the shared paragraph's plain text. One instance renders one paragraph — for a
   *  multi-paragraph editor, render one GalleyBracket per paragraph so range offsets
   *  stay simple character indices into a single text node. */
  text: string;
  /** remote collaborators' current ranges into `text` */
  selections: GalleyBracketSelection[];
  /** named in the debounced summary ("Ana selected 12 words in paragraph 3") */
  contextLabel?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

type LocalRect = { left: number; top: number; right: number; bottom: number };

const BRACKET_ARM = 6; // px, horizontal foot length
const OFFSET_STEP = 3; // px, outward nesting distance per arrival index
const UNDER_GAP = 4; // px, underline distance below the line's own baseline box
const BASE_OPACITY = 0.55;
const OPACITY_STEP = 0.09;
const MIN_OPACITY = 0.22;
const DEBOUNCE_MS = 2000;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(n, hi));
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

function wordCount(text: string, start: number, end: number): number {
  const len = text.length;
  const s = clamp(start, 0, len);
  const e = clamp(end, s, len);
  const slice = text.slice(s, e).trim();
  return slice ? slice.split(/\s+/).length : 0;
}

function opacityFor(localIndex: number): number {
  return Math.max(MIN_OPACITY, BASE_OPACITY - localIndex * OPACITY_STEP);
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

// Groups selections whose [start,end) ranges transitively overlap, then ranks each
// member by arrival order within its own group. That local rank — not the raw
// arrivedAt value, not DOM order — is the one scalar every other visual property
// derives from (outward offset, stroke opacity).
function computeArrivalIndex(sels: GalleyBracketSelection[]): Map<string, number> {
  const n = sels.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x] as number] as number;
      x = parent[x] as number;
    }
    return x;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = sels[i];
      const b = sels[j];
      if (a && b && overlaps(a, b)) union(i, j);
    }
  }
  const arrivalKey = (i: number) => sels[i]?.arrivedAt ?? i;
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(i);
    else groups.set(r, [i]);
  }
  const result = new Map<string, number>();
  for (const idxs of groups.values()) {
    idxs.sort((a, b) => arrivalKey(a) - arrivalKey(b));
    idxs.forEach((idx, local) => {
      const sel = sels[idx];
      if (sel) result.set(sel.id, local);
    });
  }
  return result;
}

function toLocal(rects: DOMRect[], originLeft: number, originTop: number): LocalRect[] {
  return rects
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      left: r.left - originLeft,
      top: r.top - originTop,
      right: r.right - originLeft,
      bottom: r.bottom - originTop,
    }))
    .sort((a, b) => a.top - b.top);
}

function BracketMark({
  rect,
  side,
  localIndex,
  opacity,
}: {
  rect: LocalRect;
  side: "open" | "close";
  localIndex: number;
  opacity: number;
}) {
  const topY = rect.top - localIndex * OFFSET_STEP;
  const footY = rect.bottom + UNDER_GAP + localIndex * OFFSET_STEP;
  const x = side === "open" ? rect.left : rect.right;
  const footX = side === "open" ? x + BRACKET_ARM : x - BRACKET_ARM;
  return (
    <>
      <line
        x1={x}
        y1={topY}
        x2={x}
        y2={footY}
        pathLength={1}
        strokeDasharray={1}
        className="ns-galley-draw"
        stroke="var(--foreground)"
        strokeWidth={1}
        strokeLinecap="round"
        opacity={opacity}
      />
      <line
        x1={x}
        y1={footY}
        x2={footX}
        y2={footY}
        pathLength={1}
        strokeDasharray={1}
        className="ns-galley-draw"
        stroke="var(--foreground)"
        strokeWidth={1}
        strokeLinecap="round"
        opacity={opacity}
      />
    </>
  );
}

export function GalleyBracket({ text, selections, contextLabel, className = "" }: GalleyBracketProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [marks, setMarks] = useState<Record<string, LocalRect[]>>({});
  const [liveMessage, setLiveMessage] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);

  const prevSelRef = useRef<Map<string, { start: number; end: number }>>(new Map());
  const debounceTimer = useRef(0);

  const arrivalIndex = useMemo(() => computeArrivalIndex(selections), [selections]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const p = textRef.current;
    if (!container || !p) return;
    const box = container.getBoundingClientRect();
    setSize({ width: box.width, height: box.height });
    const node = p.firstChild;
    if (!(node instanceof Text)) {
      setMarks({});
      return;
    }
    const len = node.data.length;
    const next: Record<string, LocalRect[]> = {};
    for (const sel of selections) {
      const s = clamp(sel.start, 0, len);
      const e = clamp(sel.end, s, len);
      if (e <= s) continue;
      const range = document.createRange();
      try {
        range.setStart(node, s);
        range.setEnd(node, e);
        const rects = toLocal(Array.from(range.getClientRects()), box.left, box.top);
        if (rects.length) next[sel.id] = rects;
      } catch {
        // stale offsets against a text node mid-update — skip this selection's marks this frame
      }
    }
    setMarks(next);
  }, [selections]);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    document.fonts?.ready?.then(() => measure()).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [measure]);

  // debounced accessible summary — announces only the range that most recently
  // changed, 2s after changes stop, so a drag-selection in progress never floods
  // the live region with one announcement per pointermove.
  useEffect(() => {
    const prev = prevSelRef.current;
    let changed: GalleyBracketSelection | undefined;
    for (const sel of selections) {
      const p = prev.get(sel.id);
      if (!p || p.start !== sel.start || p.end !== sel.end) changed = sel;
    }
    prevSelRef.current = new Map(selections.map((s) => [s.id, { start: s.start, end: s.end }]));
    if (!changed) return;
    const target = changed;
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      const words = wordCount(text, target.start, target.end);
      const where = contextLabel ? ` in ${contextLabel}` : "";
      setLiveMessage(`${target.name} selected ${words} word${words === 1 ? "" : "s"}${where}.`);
    }, DEBOUNCE_MS);
  }, [selections, text, contextLabel]);

  useEffect(() => {
    const timer = debounceTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  const jumpTo = (sel: GalleyBracketSelection) => {
    const node = textRef.current?.firstChild;
    if (!(node instanceof Text)) return;
    const len = node.data.length;
    const s = clamp(sel.start, 0, len);
    const e = clamp(sel.end, s, len);
    if (e <= s) return;
    const range = document.createRange();
    try {
      range.setStart(node, s);
      range.setEnd(node, e);
    } catch {
      return;
    }
    const live = window.getSelection();
    live?.removeAllRanges();
    live?.addRange(range);
    textRef.current?.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <div className={["ns-galley relative", className].filter(Boolean).join(" ")}>
      <style>{`
.ns-galley-draw{ stroke-dashoffset: 1; animation: ns-galley-draw-in 160ms cubic-bezier(0.16,1,0.3,1) forwards; }
@keyframes ns-galley-draw-in{ from{ stroke-dashoffset: 1; } to{ stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce){
  .ns-galley-draw{ animation: none !important; stroke-dashoffset: 0 !important; }
}
`}</style>

      <div ref={containerRef} className="relative py-2 pl-9 pr-2">
        <p ref={textRef} className="text-base leading-[2.2] text-foreground">
          {text}
        </p>
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${Math.max(size.width, 1)} ${Math.max(size.height, 1)}`}
          preserveAspectRatio="none"
        >
          {selections.map((sel) => {
            const rects = marks[sel.id];
            if (!rects || rects.length === 0) return null;
            const first = rects[0];
            const last = rects[rects.length - 1];
            if (!first || !last) return null;
            const local = arrivalIndex.get(sel.id) ?? 0;
            const op = opacityFor(local);
            const initials = sel.initials?.trim() || deriveInitials(sel.name);
            return (
              <g key={sel.id} data-selection={sel.id}>
                {rects.map((r, i) => {
                  const y = r.bottom + UNDER_GAP + local * OFFSET_STEP;
                  return (
                    <line
                      key={i}
                      x1={r.left}
                      y1={y}
                      x2={r.right}
                      y2={y}
                      pathLength={1}
                      strokeDasharray={1}
                      className="ns-galley-draw"
                      stroke="var(--foreground)"
                      strokeWidth={1}
                      opacity={op}
                    />
                  );
                })}
                <BracketMark rect={first} side="open" localIndex={local} opacity={op} />
                <BracketMark rect={last} side="close" localIndex={local} opacity={op} />
                <text
                  x={4}
                  y={first.top - local * OFFSET_STEP + 9}
                  className="font-mono text-[8px]"
                  fill="var(--foreground)"
                  opacity={op}
                >
                  {initials}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      {selections.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ns-muted">
            Active selections
          </p>
          <ul className="flex flex-wrap gap-2">
            {selections.map((sel) => {
              const words = wordCount(text, sel.start, sel.end);
              return (
                <li key={sel.id}>
                  <button
                    type="button"
                    data-jump
                    onClick={() => jumpTo(sel)}
                    className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-ns-muted outline-none transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {sel.name} · {words} word{words === 1 ? "" : "s"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
