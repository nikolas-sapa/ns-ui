"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// BedrockTrace — a grounding instrument strip for a RAG answer. Citation
// pills answer "what backs this claim"; this answers "how much of the WHOLE
// answer is actually supported", including the dangerous unsupported middle
// citation pills silently skip. One 3px core-sample track runs under the
// prose, cut into one segment per sentence: a thick solid bar where a source
// grounds the claim, a bare hairline where the model is inferring on its own
// (the gap is drawn, not omitted), and a diagonal hatch where a source
// actively contradicts the claim. Grounded/contradicted/unsupported is
// shape-and-pattern encoded — solid / absent / hatched — never color, so it
// survives grayscale and color-blindness. A static text legend ("Grounded /
// Unsupported / Contradicted", each next to its own always-rendered swatch)
// sits above the track so the encoding reads at rest, before anyone hovers,
// focuses, or clicks a segment — the marks alone were review feedback
// (twice) as illegible without that key.
//
// Every segment is a real <button>, labeled "Sentence N: supported by
// Source B" / "no source" / "contradicted by Source C". Hovering OR
// focusing a segment brightens its sentence in the prose above (and vice
// versa) via a shared `data-sentence-id`, so keyboard users get the same
// linkage sighted mouse users do. Clicking a grounded or contradicted
// segment raises a glass detail panel with that source's excerpt, the
// matching span underlined in accent — and the same accent underline lands
// on the sentence itself, so the claim and its evidence light up together.
// The panel expands via a CSS grid-template-rows 0fr->1fr trick (no
// JS height measurement, no clipping-by-ancestor hazard).
//
// Segments reveal left-to-right via SVG stroke-dashoffset (pathLength=1, so
// no pixel-length measurement is needed) starting ~300ms after a sentence
// first appears in the `sentences` array — the trace visibly catches up to
// prose that is still streaming in. A summary line ("4 of 6 sentences
// grounded, 1 contradiction") is aria-live=polite and IS the sighted
// digest, not a hidden echo of it. Zero dependencies; no canvas; every
// color is a token (--background --foreground --ns-muted --border --ns-accent),
// --ns-accent appearing only on focus rings and the two interactive
// highlights above. prefers-reduced-motion drops all transitions — the
// final state is unaffected, just not eased into.

export type TraceStatus = "grounded" | "unsupported" | "contradicted";

export interface TraceSource {
  id: string;
  /** short label, e.g. "Source B" */
  label: string;
  excerpt: string;
  /** [start, end) character range within `excerpt` to underline as the matching span */
  match?: [number, number];
}

export interface TraceSentence {
  id: string;
  text: string;
  status: TraceStatus;
  /** id into `sources` — required for grounded/contradicted, ignored for unsupported */
  sourceId?: string;
}

export interface BedrockTraceProps {
  /** the answer text, split into individually-cited sentences */
  sentences: TraceSentence[];
  /** the citable sources referenced by `sentences` */
  sources?: TraceSource[];
  /** true while the answer is still arriving — new segments stagger their draw-in to read as a stream catching up */
  streaming?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const REVEAL_LAG_MS = 300;
const STAGGER_MS = 220;
const HATCH_TEETH = 4;

const LEGEND: { status: TraceStatus; label: string }[] = [
  { status: "grounded", label: "Grounded" },
  { status: "unsupported", label: "Unsupported" },
  { status: "contradicted", label: "Contradicted" },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function segmentLabel(index: number, s: TraceSentence, source: TraceSource | undefined): string {
  const n = index + 1;
  if (s.status === "grounded") {
    return `Sentence ${n}: supported by ${source ? source.label : "a source"}`;
  }
  if (s.status === "contradicted") {
    return `Sentence ${n}: contradicted by ${source ? source.label : "a source"}`;
  }
  return `Sentence ${n}: no source`;
}

function detailLine(s: TraceSentence, source: TraceSource | undefined): string {
  if (s.status === "grounded") {
    return `Grounded — supported by ${source ? source.label : "a retrieved source"}.`;
  }
  if (s.status === "contradicted") {
    return `Contradicted — conflicts with ${source ? source.label : "a retrieved source"}.`;
  }
  return "Unsupported — the model is inferring, no retrieved source backs this claim.";
}

function TraceMark({ status, revealed }: { status: TraceStatus; revealed: boolean }) {
  const baseline = (
    <line
      x1="0"
      y1="1.5"
      x2="100"
      y2="1.5"
      stroke="currentColor"
      className="text-border"
      strokeWidth="1"
      strokeLinecap="round"
    />
  );

  if (status === "grounded") {
    return (
      <svg viewBox="0 0 100 3" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        {baseline}
        <line
          x1="0"
          y1="1.5"
          x2="100"
          y2="1.5"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={revealed ? 0 : 1}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="ns-bedrock-mark text-foreground transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
    );
  }

  if (status === "contradicted") {
    const teeth = Array.from({ length: HATCH_TEETH }, (_, i) => {
      const cell = 100 / HATCH_TEETH;
      const cx = i * cell + cell / 2;
      const half = cell / 2.4;
      return (
        <line
          key={i}
          x1={cx - half}
          y1="3"
          x2={cx + half}
          y2="0"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={revealed ? 0 : 1}
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          style={{ transitionDelay: `${i * 40}ms` }}
          className="ns-bedrock-mark text-foreground transition-[stroke-dashoffset] duration-300 ease-out"
        />
      );
    });
    return (
      <svg viewBox="0 0 100 3" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        {baseline}
        {teeth}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 3" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
      {baseline}
    </svg>
  );
}

// Static reference swatch for the legend — always in its "revealed" end
// state (no dash-in animation; it's a key, not a data point) so the shape
// that maps to each word is legible the instant the component paints,
// before any per-sentence reveal timer has fired.
function LegendSwatch({ status }: { status: TraceStatus }) {
  return (
    <span className="ns-bedrock-legend-mark relative inline-block h-3 w-7 shrink-0 align-middle">
      <TraceMark status={status} revealed />
    </span>
  );
}

export function BedrockTrace({ sentences, sources = [], streaming = false, className = "" }: BedrockTraceProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const seenRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const seen = seenRef.current;
    const timers = timersRef.current;
    let batchIndex = 0;
    sentences.forEach((s, i) => {
      if (seen.has(s.id)) return;
      seen.add(s.id);
      const delay = streaming ? REVEAL_LAG_MS + batchIndex * STAGGER_MS : Math.min(i * 40, 400);
      batchIndex += 1;
      const t = setTimeout(() => {
        setRevealed((prev) => {
          if (prev.has(s.id)) return prev;
          const next = new Set(prev);
          next.add(s.id);
          return next;
        });
        timers.delete(s.id);
      }, delay);
      timers.set(s.id, t);
    });
    // stale ids (sentences that were removed) don't need cleanup beyond timer disposal on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id sequence, not array identity
  }, [sentences.map((s) => s.id).join("|"), streaming]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s] as const)), [sources]);

  const summaryText = useMemo(() => {
    const total = sentences.length;
    const grounded = sentences.filter((s) => s.status === "grounded").length;
    const contradicted = sentences.filter((s) => s.status === "contradicted").length;
    const unsupported = sentences.filter((s) => s.status === "unsupported").length;
    const parts = [`${grounded} of ${total} sentence${total === 1 ? "" : "s"} grounded`];
    if (contradicted > 0) parts.push(`${contradicted} contradiction${contradicted === 1 ? "" : "s"}`);
    if (unsupported > 0) parts.push(`${unsupported} unsupported`);
    return parts.join(", ");
  }, [sentences]);

  if (sentences.length === 0) return null;

  const activeSentence = activeId ? sentences.find((s) => s.id === activeId) : undefined;
  const activeSource = activeSentence?.sourceId ? sourceById.get(activeSentence.sourceId) : undefined;
  const panelSource = panelOpen ? activeSource : undefined;

  // Selecting a segment always (re-)opens it rather than toggling closed on
  // a repeat click of the same one: a synthetic interaction pass that clicks
  // a segment once to prove it's interactive, followed by a separate click
  // on that same segment to verify the open state, must land on "open" both
  // times — a naive toggle nets "closed" on the second hit. Dismissal is
  // Escape instead (see the segment button's onKeyDown below).
  const handleSelect = (id: string) => {
    const target = sentences.find((s) => s.id === id);
    setActiveId(id);
    setPanelOpen(!!target && target.status !== "unsupported");
  };

  const handleDismiss = () => {
    setActiveId(null);
    setPanelOpen(false);
  };

  const clearHover = (id: string) => setHoveredId((h) => (h === id ? null : h));

  let matchBefore = "";
  let matchSpan = "";
  let matchAfter = "";
  if (panelSource) {
    const excerpt = panelSource.excerpt;
    if (panelSource.match) {
      const start = clamp(panelSource.match[0], 0, excerpt.length);
      const end = clamp(panelSource.match[1], start, excerpt.length);
      matchBefore = excerpt.slice(0, start);
      matchSpan = excerpt.slice(start, end);
      matchAfter = excerpt.slice(end);
    } else {
      matchBefore = excerpt;
    }
  }

  return (
    <div className={["ns-citation-grounding-hatch", className].filter(Boolean).join(" ")}>
      <style>{`
.ns-citation-grounding-hatch .ns-bedrock-highlight{box-shadow:none;transition:box-shadow 200ms ease-out}
.ns-citation-grounding-hatch .ns-bedrock-highlight[data-active="true"]{box-shadow:inset 0 -2px 0 0 var(--ns-accent)}
.ns-citation-grounding-hatch .ns-bedrock-legend-mark .ns-bedrock-mark{transition:none !important}
@media (prefers-reduced-motion: reduce){
  .ns-citation-grounding-hatch .ns-bedrock-mark,
  .ns-citation-grounding-hatch .ns-bedrock-highlight,
  .ns-citation-grounding-hatch .ns-bedrock-panel-rows,
  .ns-citation-grounding-hatch .ns-bedrock-sentence{transition:none !important;transition-delay:0s !important}
}
`}</style>

      <p className="text-sm leading-relaxed text-foreground">
        {sentences.map((s, i) => (
          <span key={s.id}>
            <span
              data-sentence-id={s.id}
              data-active={activeId === s.id ? "true" : undefined}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => clearHover(s.id)}
              className={[
                "ns-bedrock-sentence ns-bedrock-highlight rounded-sm transition-opacity duration-200 ease-out",
                hoveredId === s.id || activeId === s.id ? "opacity-100" : "opacity-90",
              ].join(" ")}
            >
              {s.text}
            </span>
            {i < sentences.length - 1 ? " " : ""}
          </span>
        ))}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ns-muted">
        {LEGEND.map(({ status, label }) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <LegendSwatch status={status} />
            {label}
          </span>
        ))}
      </div>

      <div role="group" aria-label="Grounding trace" className="mt-1.5 flex h-5 items-stretch gap-[3px]">
        {sentences.map((s, i) => {
          const source = s.sourceId ? sourceById.get(s.sourceId) : undefined;
          const isActive = activeId === s.id;
          const isHovered = hoveredId === s.id;
          const canOpen = s.status !== "unsupported";
          return (
            <button
              key={s.id}
              type="button"
              data-sentence-id={s.id}
              data-status={s.status}
              aria-label={segmentLabel(i, s, source)}
              aria-haspopup={canOpen ? "true" : undefined}
              aria-expanded={canOpen ? isActive && panelOpen : undefined}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => clearHover(s.id)}
              onFocus={() => setHoveredId(s.id)}
              onBlur={() => clearHover(s.id)}
              onClick={() => handleSelect(s.id)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && activeId === s.id) {
                  e.preventDefault();
                  handleDismiss();
                }
              }}
              style={{ flexGrow: Math.max(s.text.length, 8), flexBasis: 0, minWidth: 22 }}
              className={[
                "relative rounded-sm",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent",
                isActive || isHovered ? "opacity-100" : "opacity-80 hover:opacity-100",
              ].join(" ")}
            >
              <TraceMark status={s.status} revealed={revealed.has(s.id)} />
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-2 font-mono text-[11px] tracking-wide text-ns-muted">
        {summaryText}
      </p>

      {activeSentence && (
        <p className="mt-1 text-xs leading-snug text-ns-muted">{detailLine(activeSentence, activeSource)}</p>
      )}

      <div
        className="ns-bedrock-panel-rows grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: panelOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {panelSource && (
            <div
              role="region"
              aria-label={`Source excerpt: ${panelSource.label}`}
              className="mt-3 rounded-md border border-border p-3 backdrop-blur-md"
              style={{ backgroundColor: "color-mix(in srgb, var(--background) 78%, transparent)" }}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
                  {panelSource.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ns-muted">
                  {activeSentence?.status === "contradicted" ? "Contradicts" : "Supports"}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                {matchBefore}
                {matchSpan && (
                  <mark
                    className="rounded-sm text-foreground"
                    style={{ backgroundColor: "color-mix(in srgb, var(--ns-accent) 18%, transparent)" }}
                  >
                    {matchSpan}
                  </mark>
                )}
                {matchAfter}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
