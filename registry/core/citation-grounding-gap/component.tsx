"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

// TrestleGap — grounding coverage drawn as a walkable bridge under a RAG
// answer. Citation pills (citation-inline-card) and coverage tracks (citation-grounding-hatch)
// both put the evidence signal in a SEPARATE element beside or below the
// prose; here it runs directly under the words themselves — one SVG layer,
// measured off the live sentence buttons with Range.getClientRects() (so it
// tracks real wrapped line boxes, not a straight synthetic strip), drawing a
// solid 1px plank under every grounded sentence and letting the plank
// visibly END — three fading dashes, an open gap, three dashes fading back
// in — wherever a claim has no retrieved source. The inversion is the point:
// the ABSENCE of grounding is the loudest mark on the page, not a pill that
// was simply never placed. A grounded sentence is a real <button>; Enter (or
// a click anywhere on its plank) springs up a bottom sheet with the source
// excerpt, matched words underlined in the same plank stroke (again measured
// with Range.getClientRects, this time over the excerpt's own text node, so
// resizing the sheet keeps the underlines glued to the words). An ungrounded
// sentence's gap is live: clicking it (or pressing "f" while it's focused)
// fires a targeted find-support lookup for just that claim, announced
// through an aria-live region, and on success the plank draws itself in
// left-to-right via stroke-dashoffset rather than popping solid. Sentences
// carry the accessibility semantics (aria-description: "supported by <title>"
// / "no source found"); the SVG is aria-hidden drawing underneath them, never
// the other way around. Every stroke is --border/--muted/--foreground —
// --accent is reserved for the sheet's focus ring and link, never the marks
// themselves. DOM+SVG+CSS only.

export interface TrestleSource {
  title: string;
  excerpt: string;
  url?: string;
}

export interface TrestleSentence {
  id: string;
  text: string;
  /** omit, or null, for a claim with no retrieval support — its plank is drawn as a gap */
  source?: TrestleSource | null;
}

export interface TrestleGapProps {
  sentences: TrestleSentence[];
  /** Runs a retrieval attempt for one ungrounded sentence. Resolve a source on
   * success, or null/undefined if nothing was found. Defaults to a small
   * deterministic demo resolver (id-hashed, ~4-in-5 found) so the component
   * works with zero configuration. */
  findSupport?: (sentence: TrestleSentence) => Promise<TrestleSource | null | undefined>;
  className?: string;
}

type Status = "grounded" | "gap" | "searching" | "drawing";

type Row = {
  id: string;
  text: string;
  source: TrestleSource | null;
  status: Status;
};

type LocalRect = { left: number; right: number; bottom: number };

const INSET = 3; // px inset from each line box edge before a mark starts
const BASELINE_GAP = 6; // px below the text line's bottom edge
const DASH_W = 6;
const DASH_GAP = 5;
const FADE = [0.62, 0.34, 0.15]; // opacity per dash, brightest nearest the text
const MIN_SPAN_FOR_FADE = 2 * (3 * DASH_W + 2 * DASH_GAP) + 14;
const DRAW_MS = 620;

function toRow(s: TrestleSentence): Row {
  const source = s.source ?? null;
  return { id: s.id, text: s.text, source, status: source ? "grounded" : "gap" };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function truncate(text: string, n = 60): string {
  return text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text;
}

// deterministic pseudo-random, id-hashed — same demo data always behaves the
// same way across reloads, without a real backend
function defaultFindSupport(sentence: TrestleSentence): Promise<TrestleSource | null> {
  const hash = Array.from(sentence.id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const found = hash % 5 !== 0;
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve(
          found
            ? {
                title: `Retrieval match — ${sentence.id}`,
                excerpt: `${sentence.text} This passage was located during a follow-up retrieval pass over the source corpus.`,
              }
            : null
        ),
      850
    );
  });
}

const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "is",
  "are", "was", "were", "be", "been", "it", "its", "that", "this", "as",
  "by", "with", "from", "but", "not", "than", "so", "if", "into", "over",
]);

function significantWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  return new Set(words.filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}

// finds runs of words in `excerpt` that also appear (as significant words) in
// `claim`, merging adjacent matches so a matched phrase gets one underline
// rather than one choppy dash per word
function matchSpans(excerpt: string, claim: string): Array<[number, number]> {
  const keep = significantWords(claim);
  if (keep.size === 0) return [];
  const spans: Array<[number, number]> = [];
  const re = /[A-Za-z0-9']+/g;
  let m: RegExpExecArray | null;
  let pending: [number, number] | null = null;
  while ((m = re.exec(excerpt))) {
    const word = m[0].toLowerCase();
    const isMatch = word.length > 2 && keep.has(word);
    if (isMatch) {
      if (pending && m.index - pending[1] <= 2) {
        pending[1] = m.index + m[0].length;
      } else {
        if (pending) spans.push(pending);
        pending = [m.index, m.index + m[0].length];
      }
    }
  }
  if (pending) spans.push(pending);
  return spans;
}

// Measures an element's own rendered line boxes via a Range over its content
// — gives per-wrapped-line rects the same way selecting the text and reading
// getClientRects() would, without needing a synthetic straight strip.
function elementLineRects(el: Element): DOMRect[] {
  const range = document.createRange();
  range.selectNodeContents(el);
  return Array.from(range.getClientRects());
}

// Measures specific character spans within a single text node via Range —
// used to underline just the matched words inside the excerpt.
function textNodeSpanRects(node: Text, spans: Array<[number, number]>): DOMRect[][] {
  const len = node.data.length;
  return spans.map(([start, end]) => {
    const s = Math.max(0, Math.min(start, len));
    const e = Math.max(s, Math.min(end, len));
    if (s === e) return [];
    const range = document.createRange();
    try {
      range.setStart(node, s);
      range.setEnd(node, e);
      return Array.from(range.getClientRects());
    } catch {
      return [];
    }
  });
}

function toLocal(rects: DOMRect[], originLeft: number, originTop: number): LocalRect[] {
  return rects
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ left: r.left - originLeft, right: r.right - originLeft, bottom: r.bottom - originTop }));
}

// ---------------------------------------------------------------------------
// the SVG marks for one sentence's plank/gap, drawn from its own line rects
// ---------------------------------------------------------------------------
function PlankMarks({ id, rects, status }: { id: string; rects: LocalRect[]; status: Status }) {
  if (status === "grounded" || status === "drawing") {
    return (
      <g data-sentence-mark={id} data-status={status}>
        {rects.map((r, i) => {
          const x1 = r.left + INSET;
          const x2 = r.right - INSET;
          const y = r.bottom + BASELINE_GAP;
          if (x2 <= x1) return null;
          if (status === "drawing") {
            return (
              <line
                key={i}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                pathLength={1}
                strokeDasharray={1}
                className="ns-trestle-draw text-foreground"
                stroke="currentColor"
                strokeWidth={1}
                strokeLinecap="round"
              />
            );
          }
          return (
            <line
              key={i}
              x1={x1}
              y1={y}
              x2={x2}
              y2={y}
              className="text-border"
              stroke="currentColor"
              strokeWidth={1}
            />
          );
        })}
      </g>
    );
  }

  // gap / searching — three fading dashes, open middle, three dashes fading back in
  return (
    <g
      data-sentence-mark={id}
      data-status={status}
      className={status === "searching" ? "ns-trestle-searching text-border" : "text-border"}
    >
      {rects.map((r, i) => {
        const left = r.left + INSET;
        const right = r.right - INSET;
        const y = r.bottom + BASELINE_GAP;
        const span = right - left;
        if (span <= 0) return null;
        if (span < MIN_SPAN_FOR_FADE) {
          const w = Math.min(10, span);
          const cx = (left + right) / 2;
          return (
            <line
              key={i}
              x1={cx - w / 2}
              y1={y}
              x2={cx + w / 2}
              y2={y}
              stroke="currentColor"
              strokeWidth={1}
              opacity={0.28}
            />
          );
        }
        const dashes = [];
        for (let d = 0; d < 3; d++) {
          const x1 = left + d * (DASH_W + DASH_GAP);
          dashes.push(
            <line
              key={`l${d}`}
              x1={x1}
              y1={y}
              x2={x1 + DASH_W}
              y2={y}
              stroke="currentColor"
              strokeWidth={1}
              opacity={FADE[d]}
            />
          );
          const x2e = right - d * (DASH_W + DASH_GAP);
          dashes.push(
            <line
              key={`r${d}`}
              x1={x2e - DASH_W}
              y1={y}
              x2={x2e}
              y2={y}
              stroke="currentColor"
              strokeWidth={1}
              opacity={FADE[d]}
            />
          );
        }
        return <g key={i}>{dashes}</g>;
      })}
    </g>
  );
}

export function TrestleGap({ sentences, findSupport, className = "" }: TrestleGapProps) {
  const [rows, setRows] = useState<Row[]>(() => sentences.map(toRow));
  const [lineRects, setLineRects] = useState<Record<string, LocalRect[]>>({});
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [liveMessage, setLiveMessage] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const restoreFocusRef = useRef<HTMLButtonElement | null>(null);
  const drawTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dialogRef = useRef<HTMLDialogElement>(null);
  const excerptRef = useRef<HTMLParagraphElement>(null);
  const excerptWrapRef = useRef<HTMLDivElement>(null);
  const [excerptMarks, setExcerptMarks] = useState<LocalRect[][]>([]);
  const [excerptSize, setExcerptSize] = useState({ width: 0, height: 0 });

  const titleId = useId();

  const measurePlanks = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const box = container.getBoundingClientRect();
    const next: Record<string, LocalRect[]> = {};
    buttonRefs.current.forEach((el, id) => {
      next[id] = toLocal(elementLineRects(el), box.left, box.top);
    });
    setLineRects(next);
    setSize({ width: box.width, height: box.height });
  }, []);

  useLayoutEffect(() => {
    measurePlanks();
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measurePlanks());
    ro.observe(container);
    const onResize = () => measurePlanks();
    window.addEventListener("resize", onResize);
    document.fonts?.ready?.then(() => measurePlanks()).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [measurePlanks, rows]);

  useEffect(() => {
    const timers = drawTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const measureExcerpt = useCallback(() => {
    const wrap = excerptWrapRef.current;
    const p = excerptRef.current;
    if (!wrap || !p) return;
    const box = wrap.getBoundingClientRect();
    setExcerptSize({ width: box.width, height: box.height });
    const node = p.firstChild;
    if (!(node instanceof Text)) {
      setExcerptMarks([]);
      return;
    }
    const active = rows.find((r) => r.id === activeId);
    const spans = active?.source ? matchSpans(active.source.excerpt, active.text) : [];
    const rectsPerSpan = textNodeSpanRects(node, spans);
    setExcerptMarks(rectsPerSpan.map((rs) => toLocal(rs, box.left, box.top)));
  }, [rows, activeId]);

  useLayoutEffect(() => {
    if (!activeId) return;
    measureExcerpt();
    const wrap = excerptWrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => measureExcerpt());
    ro.observe(wrap);
    const onResize = () => measureExcerpt();
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [activeId, measureExcerpt]);

  // dialog lifecycle — native <dialog> supplies the focus trap, background
  // inertness and Escape-to-close; we only drive open/close from activeId and
  // restore focus to the sentence that opened it. data-open is set a frame
  // AFTER showModal() rather than in the same render, so the sheet actually
  // paints once at its off-screen position before springing to rest — set in
  // the same commit as showModal() and the browser has nothing to animate
  // from, it would just appear already open.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    let raf = 0;
    if (activeId) {
      if (!dlg.open) {
        dlg.removeAttribute("data-open");
        dlg.showModal();
        raf = requestAnimationFrame(() => dlg.setAttribute("data-open", ""));
      } else {
        dlg.setAttribute("data-open", "");
      }
    } else {
      dlg.removeAttribute("data-open");
      if (dlg.open) dlg.close();
    }
    return () => cancelAnimationFrame(raf);
  }, [activeId]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onClose = () => {
      setActiveId(null);
      restoreFocusRef.current?.focus();
    };
    const onBackdropClick = (e: MouseEvent) => {
      if (e.target === dlg) dlg.close();
    };
    dlg.addEventListener("close", onClose);
    dlg.addEventListener("click", onBackdropClick);
    return () => {
      dlg.removeEventListener("close", onClose);
      dlg.removeEventListener("click", onBackdropClick);
    };
  }, []);

  // simple body scroll lock while the sheet is open — showModal() blocks
  // pointer/focus from reaching the page but not wheel/touch scroll of it
  useEffect(() => {
    if (!activeId) return;
    const body = document.body;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev;
    };
  }, [activeId]);

  const openSheet = (id: string) => {
    restoreFocusRef.current = buttonRefs.current.get(id) ?? null;
    setActiveId(id);
  };

  const runFindSupport = useCallback(
    (id: string) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "searching" } : r)));
      const row = rows.find((r) => r.id === id);
      setLiveMessage(`Searching for support: “${truncate(row?.text ?? "", 50)}”`);
      const resolver = findSupport ?? defaultFindSupport;
      const sentence: TrestleSentence = { id, text: row?.text ?? "", source: row?.source ?? null };
      resolver(sentence)
        .then((found) => {
          if (found) {
            setRows((prev) => prev.map((r) => (r.id === id ? { ...r, source: found, status: "drawing" } : r)));
            setLiveMessage(`Support found: ${found.title}.`);
            const t = setTimeout(() => {
              setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "grounded" } : r)));
              drawTimers.current.delete(id);
            }, DRAW_MS);
            drawTimers.current.set(id, t);
          } else {
            setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "gap" } : r)));
            setLiveMessage("No source found for this claim.");
          }
        })
        .catch(() => {
          setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "gap" } : r)));
          setLiveMessage("No source found for this claim.");
        });
    },
    [findSupport, rows]
  );

  const activate = (row: Row) => {
    if (row.status === "grounded" || row.status === "drawing") openSheet(row.id);
    else if (row.status === "gap") runFindSupport(row.id);
    // "searching" — no-op, a lookup is already in flight for this sentence
  };

  const onSentenceKeyDown = (e: KeyboardEvent<HTMLButtonElement>, row: Row) => {
    if ((e.key === "f" || e.key === "F") && row.status === "gap") {
      e.preventDefault();
      runFindSupport(row.id);
    }
  };

  const active = rows.find((r) => r.id === activeId) ?? null;
  const activeSource = active?.source ?? null;

  return (
    <div className={["ns-trestle relative", className].filter(Boolean).join(" ")}>
      <style>{`
.ns-trestle-sentence{ transition: background-color 150ms ease-out; }
.ns-trestle-sentence:hover{ background-color: color-mix(in srgb, var(--muted) 16%, transparent); }
.ns-trestle-sentence:focus-visible{ outline: 2px solid var(--accent); outline-offset: 2px; }
.ns-trestle-draw{ stroke-dashoffset: 1; animation: ns-trestle-draw-in ${DRAW_MS}ms cubic-bezier(0.16,1,0.3,1) forwards; }
@keyframes ns-trestle-draw-in{ from{ stroke-dashoffset: 1; } to{ stroke-dashoffset: 0; } }
.ns-trestle-searching{ animation: ns-trestle-pulse 1.1s ease-in-out infinite; }
@keyframes ns-trestle-pulse{ 0%,100%{ opacity: 0.55; } 50%{ opacity: 1; } }
.ns-trestle-sheet{ position: fixed; left: 50%; top: auto; bottom: 0; margin: 0; width: min(34rem, calc(100vw - 2rem));
  max-height: min(80vh, 640px); transform: translate(-50%, 100%); opacity: 0; padding: 0;
  --ns-scrim: color-mix(in srgb, var(--foreground) 22%, transparent); }
:where(.dark) .ns-trestle-sheet{ --ns-scrim: color-mix(in srgb, var(--background) 66%, transparent); }
.ns-trestle-sheet[data-open]{ transform: translate(-50%, 0); opacity: 1;
  transition: transform 420ms cubic-bezier(0.16,1,0.3,1), opacity 260ms ease-out; }
.ns-trestle-sheet::backdrop{ background: var(--ns-scrim); }
@media (prefers-reduced-motion: reduce){
  .ns-trestle-draw{ animation: none !important; stroke-dashoffset: 0 !important; }
  .ns-trestle-searching{ animation: none !important; }
  .ns-trestle-sheet, .ns-trestle-sheet[data-open]{ transition: none !important; }
}
`}</style>

      <div ref={containerRef} className="relative">
        <p className="text-base leading-[2.1] text-foreground">
          {rows.map((row, i) => (
            <span key={row.id}>
              <button
                type="button"
                ref={(el) => {
                  if (el) buttonRefs.current.set(row.id, el);
                  else buttonRefs.current.delete(row.id);
                }}
                data-sentence
                data-status={row.status === "drawing" ? "grounded" : row.status}
                aria-description={
                  row.status === "searching"
                    ? "searching for support"
                    : row.source
                      ? `supported by ${row.source.title}`
                      : "no source found"
                }
                aria-keyshortcuts={row.status === "gap" ? "f" : undefined}
                onClick={() => activate(row)}
                onKeyDown={(e) => onSentenceKeyDown(e, row)}
                style={{ font: "inherit", color: "inherit" }}
                className="ns-trestle-sentence inline cursor-pointer rounded-[3px] border-0 bg-transparent p-0 m-0 text-left outline-none"
              >
                {row.text}
              </button>
              {i < rows.length - 1 ? " " : ""}
            </span>
          ))}
        </p>

        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${Math.max(size.width, 1)} ${Math.max(size.height, 1)}`}
          preserveAspectRatio="none"
        >
          {rows.map((row) => (
            <PlankMarks key={row.id} id={row.id} rects={lineRects[row.id] ?? []} status={row.status} />
          ))}
        </svg>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="ns-trestle-sheet rounded-t-lg border-t border-x border-border bg-background text-foreground"
      >
        {active && activeSource && (
          <div className="flex max-h-[min(80vh,640px)] flex-col gap-4 overflow-y-auto p-6 outline-none" tabIndex={-1} autoFocus>
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="text-sm font-semibold tracking-tight text-foreground">
                {activeSource.title}
              </h2>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                aria-label="Close source"
                className="ns-trestle-sentence shrink-0 rounded-[3px] border-0 bg-transparent p-1 text-muted outline-none hover:text-foreground"
              >
                <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div ref={excerptWrapRef} className="relative">
              <p ref={excerptRef} className="text-sm leading-relaxed text-muted">
                {activeSource.excerpt}
              </p>
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                viewBox={`0 0 ${Math.max(excerptSize.width, 1)} ${Math.max(excerptSize.height, 1)}`}
                preserveAspectRatio="none"
              >
                {excerptMarks.flat().map((r, i) => (
                  <line
                    key={i}
                    x1={r.left}
                    y1={r.bottom + 1}
                    x2={r.right}
                    y2={r.bottom + 1}
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth={1}
                  />
                ))}
              </svg>
            </div>

            {activeSource.url && (
              <a
                href={activeSource.url}
                target="_blank"
                rel="noreferrer"
                className="ns-trestle-sentence inline-block w-fit rounded-[3px] font-mono text-xs text-muted underline decoration-border underline-offset-4 outline-none hover:text-foreground"
              >
                {hostnameOf(activeSource.url)}
              </a>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}
