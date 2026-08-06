"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ChunkSieve — RAG retrieval drawn as a literal sieve.
//
// One 2px --foreground rule spans the frame at 42% height. Every retrieved
// chunk is placed on x by RANK (highest similarity leftmost, 1fr per column)
// and on y by SCORE relative to the cutoff. A chunk whose score clears the
// cutoff RESTS ON the rule as a solid hairline card — mono doc id, char span,
// a 34px score bar — lifted (score − cutoff) × 240px above it. A chunk that
// misses FALLS THROUGH: a bare 1px stub at 0.38 alpha, only its doc id, sunk
// (cutoff − score) × 300px below the rule and tapering 1fr → 40% wide as it
// falls. So the resting composition is one hard boundary with the ink packed
// against it: six solid rows above, a thin dust of ghosts below, most of the
// lower frame empty.
//
// The second, harder question a retrieval panel usually hides is which of the
// retained chunks the answer actually USED. An ANSWER RAIL (1px --border) runs
// above the retained zone; a chunk with used:true draws a 1px connector from
// its right edge up to the rail, ending in a 3px filled square. A retained but
// uncited chunk draws NOTHING. "Retrieved and never cited" — the real RAG
// failure mode — is therefore visible as absence, with no badge and no color.
//
// The rule is the control: it is a real role="slider", and a vertical drag on
// it maps 1px = 0.004 score. Chunks crossing the new cutoff reflow between the
// two zones on one shared 240ms transform+opacity transition — the reflow IS
// the feedback, there is no separate readout animation.
//
// Ink is --foreground / --border / --ns-muted throughout; --ns-accent is spent only
// on focus rings. DOM + CSS only, no canvas, no SVG, no measurement pass.
// ---------------------------------------------------------------------------

export interface SieveChunk {
  id: string;
  /** Short source identifier, e.g. "runbook.md". Rendered in mono. */
  doc: string;
  /** Character offsets of the chunk inside its document: [start, end]. */
  span: [number, number];
  /** Similarity score, 0…1. Drives both zone and height. */
  score: number;
  /** True when the generated answer actually cited this chunk. */
  used?: boolean;
  /** Chunk text, shown in the strip pinned to the frame's bottom edge on hover. */
  preview: string;
}

export interface ChunkSieveProps {
  /** Retrieved chunks. Rank on screen is derived from score, not array order. */
  chunks: SieveChunk[];
  /** Controlled similarity cutoff, 0…1. */
  cutoff?: number;
  /** Initial cutoff when uncontrolled. @default 0.5 */
  defaultCutoff?: number;
  /** Fires on release / keypress with the value snapped to 3 decimals. */
  onCutoffChange?: (cutoff: number) => void;
  /** Frame height in px — the sieve's geometry is absolute, not fluid. @default 440 */
  height?: number;
  /** Accessible name for the cutoff slider. @default "Similarity cutoff" */
  label?: string;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

const LINE_PCT = 0.42; // the sieve rule's height in the frame
const LIFT_PER_SCORE = 240; // px of lift per 1.0 of score above the cutoff
const DROP_PER_SCORE = 300; // px of fall per 1.0 of score below the cutoff
const CARD_H = 52; // retained card height (fixed, so connectors need no measuring)
const RAIL_TOP = 24; // answer rail, px from the frame's inner top
const RAIL_GAP = 14; // minimum clearance between a lifted card and the rail
const SCORE_BAR_W = 34;
const PX_PER_SCORE = 0.004; // drag sensitivity: 1px = 0.004 score
const STUB_MIN_W = 40; // % width a stub tapers to at the bottom of its fall
// Stub alpha. 0.38 is the floor at which a 1px --foreground hairline and 9px
// mono are still legible in BOTH themes (~2.6:1 light, ~3.0:1 dark); the
// original 0.14 composited to ~1.35:1 in both, i.e. not rendered — which
// deleted the "falls through" half of the sieve from the resting frame.
const STUB_ALPHA = 0.38;
const STUB_ALPHA_DIM = 0.15; // a stub while some other chunk is hovered

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function fmt3(v: number): string {
  return v.toFixed(3);
}

export function ChunkSieve({
  chunks,
  cutoff,
  defaultCutoff = 0.5,
  onCutoffChange,
  height = 440,
  label = "Similarity cutoff",
  className = "",
}: ChunkSieveProps) {
  const isControlled = cutoff !== undefined;
  const [internal, setInternal] = useState(() => clamp01(defaultCutoff));
  // Live drag value overrides both, so a controlled consumer still sees the
  // reflow while the pointer is down even though onCutoffChange fires on release.
  const [live, setLive] = useState<number | null>(null);
  const committed = clamp01(isControlled ? cutoff! : internal);
  const value = live ?? committed;

  const [hovered, setHovered] = useState<string | null>(null);
  const [arrived, setArrived] = useState<string[]>([]);
  const prevRetained = useRef<Set<string> | null>(null);
  const dragRef = useRef<{ y: number; from: number } | null>(null);
  const arriveTimer = useRef<number | null>(null);

  const ordered = [...chunks].sort((a, b) => b.score - a.score);
  const retainedCount = ordered.filter((c) => c.score >= value).length;

  const lineY = height * LINE_PCT;
  const maxLift = Math.max(0, lineY - CARD_H - RAIL_TOP - RAIL_GAP);
  const maxDrop = Math.max(1, height - lineY - 28);

  // Newly retained chunks pulse once on arrival.
  useEffect(() => {
    const now = new Set(
      chunks.filter((c) => c.score >= value).map((c) => c.id)
    );
    const prev = prevRetained.current;
    prevRetained.current = now;
    if (!prev) return;
    const fresh: string[] = [];
    now.forEach((id) => {
      if (!prev.has(id)) fresh.push(id);
    });
    if (fresh.length === 0) return;
    setArrived(fresh);
    // The timer lives in a ref, not in the effect's cleanup: `value` changes on
    // every frame of a drag, and an effect-scoped cleanup would cancel the
    // pending clear on the very next frame, leaving `arrived` stuck with stale
    // ids so those chunks could never pulse again on re-entry.
    if (arriveTimer.current !== null) window.clearTimeout(arriveTimer.current);
    arriveTimer.current = window.setTimeout(() => {
      arriveTimer.current = null;
      setArrived([]);
    }, 900);
  }, [value, chunks]);

  useEffect(
    () => () => {
      if (arriveTimer.current !== null) window.clearTimeout(arriveTimer.current);
    },
    []
  );

  const commit = (next: number) => {
    const v = round3(clamp01(next));
    if (!isControlled) setInternal(v);
    if (v !== round3(committed)) onCutoffChange?.(v);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { y: e.clientY, from: value };
    e.currentTarget.setPointerCapture(e.pointerId);
    setLive(value);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    // Dragging the rule DOWN lowers the bar: more chunks clear it.
    setLive(clamp01(d.from - (e.clientY - d.y) * PX_PER_SCORE));
  };

  const endDrag = () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    const v = live;
    setLive(null);
    if (v !== null) commit(v);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") next = value + 0.01;
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = value - 0.01;
    else if (e.key === "PageUp") next = value + 0.1;
    else if (e.key === "PageDown") next = value - 0.1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    else return;
    e.preventDefault();
    setLive(null);
    commit(next);
  };

  const hoveredChunk = hovered ? chunks.find((c) => c.id === hovered) : undefined;
  const readout = `cutoff ${fmt3(value)} · ${retainedCount}/${chunks.length} retained`;

  return (
    <div
      className={`ns-sieve-root relative w-full overflow-hidden border border-border bg-background ${className}`}
      style={{ height }}
    >
      <style>{`
.ns-sieve-flow{transition:transform 240ms cubic-bezier(0.22,1,0.36,1),opacity 240ms cubic-bezier(0.22,1,0.36,1),width 240ms cubic-bezier(0.22,1,0.36,1),height 240ms cubic-bezier(0.22,1,0.36,1)}
.ns-sieve-strip{transition:opacity 180ms ease-out,transform 180ms ease-out}
@keyframes ns-sieve-breathe{0%{transform:translateY(-0.5px)}50%{transform:translateY(0.5px)}100%{transform:translateY(-0.5px)}}
@keyframes ns-sieve-arrive{0%{opacity:0.6}100%{opacity:1}}
.ns-sieve-rule{animation:ns-sieve-breathe 4s ease-in-out infinite}
.ns-sieve-arrive{animation:ns-sieve-arrive 900ms ease-out 1}
@media (prefers-reduced-motion: reduce){
  .ns-sieve-flow,.ns-sieve-strip{transition:none}
  .ns-sieve-rule,.ns-sieve-arrive{animation:none}
}
`}</style>

      {/* ---- answer rail ---- */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-3 right-3 h-px bg-border"
        style={{ top: RAIL_TOP }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-3 font-mono text-[9px] uppercase tracking-[0.18em] text-ns-muted"
        style={{ top: RAIL_TOP - 16 }}
      >
        answer
      </span>

      {/* ---- live readout, sitting just above the rule ----
           aria-hidden on purpose: the slider's aria-valuetext already carries
           "cutoff 0.742, 6 of 12 chunks retained", so an aria-live copy of the
           same string would double-announce on every arrow key and on every
           frame of a drag. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-3 z-10 font-mono text-[10px] tabular-nums text-ns-muted"
        style={{ top: lineY - 30 }}
      >
        {readout}
      </div>

      {/* ---- chunk columns ---- */}
      <div className="absolute inset-y-0 left-3 right-3 flex items-stretch gap-1.5">
        {ordered.map((c) => {
          const retained = c.score >= value;
          const isHovered = hovered === c.id;
          const dim = hovered !== null && !isHovered;
          const spanText = `[${c.span[0]}-${c.span[1]}]`;
          // No `border-0`/`bg-transparent` here: preflight already resets both
          // on <button>, and stating them would race the retained card's own
          // `border border-border bg-background` in the generated stylesheet.
          const common =
            "ns-sieve-flow absolute left-0 right-0 block p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent";

          if (retained) {
            const lift = Math.min(maxLift, (c.score - value) * LIFT_PER_SCORE);
            const connectorH = lineY - lift - CARD_H - RAIL_TOP;
            return (
              <div key={c.id} className="relative min-w-0 flex-1">
                <div className="absolute left-0 right-0" style={{ top: lineY }}>
                  <button
                    type="button"
                    aria-label={`${c.doc}, characters ${c.span[0]} to ${
                      c.span[1]
                    }, score ${fmt3(c.score)}, retained${
                      c.used ? ", cited in the answer" : ", not cited"
                    }`}
                    onPointerEnter={() => setHovered(c.id)}
                    onPointerLeave={() => setHovered((h) => (h === c.id ? null : h))}
                    onFocus={() => setHovered(c.id)}
                    onBlur={() => setHovered((h) => (h === c.id ? null : h))}
                    className={`${common} ${
                      arrived.includes(c.id) ? "ns-sieve-arrive" : ""
                    } bottom-0 flex flex-col justify-between border border-border bg-background px-1.5 py-1`}
                    style={{
                      height: CARD_H,
                      opacity: dim ? 0.35 : 1,
                      transform: `translateY(${-(lift + (isHovered ? 2 : 0))}px)`,
                    }}
                  >
                    {/* connector to the answer rail — drawn only when cited */}
                    {c.used && connectorH > 6 && (
                      <span
                        aria-hidden="true"
                        className="ns-sieve-flow absolute bottom-full right-[3px] w-px bg-foreground"
                        style={{ height: connectorH }}
                      >
                        <span className="absolute -top-px left-1/2 h-[3px] w-[3px] -translate-x-1/2 bg-foreground" />
                      </span>
                    )}
                    <span className="block truncate font-mono text-[10px] leading-none text-foreground">
                      {c.doc}
                    </span>
                    <span className="block truncate font-mono text-[9px] leading-none tabular-nums text-ns-muted">
                      {spanText}
                    </span>
                    <span
                      aria-hidden="true"
                      className="relative block h-[3px] max-w-full bg-border"
                      style={{ width: SCORE_BAR_W }}
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-foreground"
                        style={{ width: `${clamp01(c.score) * 100}%` }}
                      />
                    </span>
                  </button>
                </div>
              </div>
            );
          }

          const drop = Math.min(maxDrop, (value - c.score) * DROP_PER_SCORE);
          const taper = clamp01(drop / maxDrop);
          return (
            <div key={c.id} className="relative min-w-0 flex-1">
              <div className="absolute left-0 right-0" style={{ top: lineY }}>
                <button
                  type="button"
                  aria-label={`${c.doc}, characters ${c.span[0]} to ${
                    c.span[1]
                  }, score ${fmt3(c.score)}, below the cutoff`}
                  onPointerEnter={() => setHovered(c.id)}
                  onPointerLeave={() => setHovered((h) => (h === c.id ? null : h))}
                  onFocus={() => setHovered(c.id)}
                  onBlur={() => setHovered((h) => (h === c.id ? null : h))}
                  className={`${common} top-0 py-1`}
                  style={{
                    width: `${100 - (100 - STUB_MIN_W) * taper}%`,
                    right: "auto",
                    opacity: isHovered ? 1 : dim ? STUB_ALPHA_DIM : STUB_ALPHA,
                    transform: `translateY(${drop - (isHovered ? 2 : 0)}px)`,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="block h-px w-full bg-foreground"
                  />
                  <span className="mt-1 block truncate font-mono text-[9px] leading-none text-foreground">
                    {c.doc}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- the sieve rule: the control ----
           The focus ring uses a NEGATIVE outline-offset on purpose: the grab
           strip runs edge to edge, so an outward offset pushes its left/right
           caps under the frame's overflow-hidden and the ring degrades into
           two loose horizontal lines. */}
      <div
        data-sieve-line=""
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={round3(value)}
        aria-valuetext={`cutoff ${fmt3(value)}, ${retainedCount} of ${
          chunks.length
        } chunks retained`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="absolute left-0 right-0 z-20 flex h-10 -translate-y-1/2 cursor-ns-resize touch-none items-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ns-accent"
        style={{ top: lineY }}
      >
        <span
          aria-hidden="true"
          className="ns-sieve-rule block h-[2px] w-full bg-foreground"
        />
      </div>

      {/* ---- preview strip, pinned to the frame's bottom edge ---- */}
      <div
        aria-hidden="true"
        className="ns-sieve-strip pointer-events-none absolute inset-x-0 bottom-0 border-t border-border bg-background px-3 py-2"
        style={{
          opacity: hoveredChunk ? 1 : 0,
          transform: `translateY(${hoveredChunk ? 0 : 6}px)`,
        }}
      >
        <p className="truncate font-mono text-[10px] leading-relaxed text-ns-muted">
          {hoveredChunk ? (
            <>
              <span className="text-foreground">{hoveredChunk.doc}</span>
              <span className="tabular-nums">
                {" "}
                [{hoveredChunk.span[0]}-{hoveredChunk.span[1]}] ·{" "}
                {fmt3(hoveredChunk.score)} ·{" "}
                {hoveredChunk.score >= value
                  ? hoveredChunk.used
                    ? "cited"
                    : "retained, not cited"
                  : "below cutoff"}
              </span>
              <span className="text-ns-muted"> — {hoveredChunk.preview}</span>
            </>
          ) : (
            " "
          )}
        </p>
      </div>
    </div>
  );
}

export default ChunkSieve;
