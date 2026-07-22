"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

// Streaming LLM text where the still-provisional tail visibly hasn't dried
// yet. Each new token starts light — variable-font weight down at 300,
// opacity .55, a hair of blur — then rides the weight axis up to 400 with
// opacity 1 and no blur over ~600ms, ease-out-expo. Because it's the weight
// axis (not a font swap or a scale/transform), Geist Sans barely changes
// glyph width between 300 and 400, so there's no reflow jitter as tokens
// dry; the registered "GeistSans Fallback" metric-matched font has no
// variable axis at all, so if the variable face hasn't loaded yet tokens
// just render at a locked weight, never mid-thin.
//
// Every token is a real, pure-CSS `animation: ... both` — arrival IS the
// stagger, nothing is scheduled or replayed from JS, and because tokens is
// append-only with stable index keys, React never remounts an already-dried
// span when new ones arrive. prefers-reduced-motion collapses the whole
// ramp to a plain settled span (see the media query below) rather than
// skipping the animation via JS, so there's no flash-of-wet-then-cut.
//
// Screen readers get a second, parallel channel rather than reading the
// decorative spans (which are aria-hidden): a visually-hidden log holds the
// real text, split into already-announced sentences (each its own static
// span — a plain node appended to a polite live region is itself the
// announcement) and one trailing `aria-busy` span for whatever hasn't hit a
// sentence boundary yet. Mutating a busy span's text doesn't get announced
// fragment by fragment; it's released into a settled sentence (and read
// once, whole) the moment punctuation closes it, or after a short idle gap
// if the stream stalls or ends mid-clause.

export interface WetInkProps {
  /**
   * Every token received so far, oldest first, append-only. Include
   * whatever whitespace the model actually emitted with each token — this
   * component never inserts its own spacing between them. Shrinking the
   * array (a fresh stream) resets both the ink and the live-region state.
   */
  tokens: string[];
  /** Ms for one token to fully dry. Default 600. */
  dryMs?: number;
  /**
   * Ms of arrival silence before an unfinished (no sentence-ending
   * punctuation yet) tail is flushed to the live region anyway. Default 900.
   */
  idleFlushMs?: number;
  className?: string;
}

const DEFAULT_DRY_MS = 600;
const DEFAULT_IDLE_FLUSH_MS = 900;

// Last index worth flushing a sentence at: a run of text ending in ./!/?
// followed by whitespace-or-end, or a bare newline (paragraph break) at any
// position. Deliberately a heuristic (an abbreviation like "Mr." will flush
// early) — good enough for batching, not a sentence parser.
function lastFlushBoundary(s: string): number {
  let idx = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\n") {
      idx = i;
      continue;
    }
    if ((c === "." || c === "!" || c === "?") && (i === s.length - 1 || /\s/.test(s[i + 1] ?? ""))) {
      idx = i;
    }
  }
  return idx;
}

export function WetInk({
  tokens,
  dryMs = DEFAULT_DRY_MS,
  idleFlushMs = DEFAULT_IDLE_FLUSH_MS,
  className = "",
}: WetInkProps) {
  const [settled, setSettled] = useState<string[]>([]);
  const [tail, setTail] = useState("");
  const bufRef = useRef({ settled: [] as string[], tail: "" });
  const consumedLenRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const fullText = tokens.join("");

    // Shorter than what we've already consumed => a new stream started.
    if (fullText.length < consumedLenRef.current) {
      consumedLenRef.current = 0;
      bufRef.current = { settled: [], tail: "" };
    }

    const delta = fullText.slice(consumedLenRef.current);
    consumedLenRef.current = fullText.length;

    if (delta) {
      let nextTail = bufRef.current.tail + delta;
      let nextSettled = bufRef.current.settled;
      const boundary = lastFlushBoundary(nextTail);
      if (boundary >= 0) {
        nextSettled = [...nextSettled, nextTail.slice(0, boundary + 1)];
        nextTail = nextTail.slice(boundary + 1);
      }
      bufRef.current = { settled: nextSettled, tail: nextTail };
      setSettled(nextSettled);
      setTail(nextTail);
    }

    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (bufRef.current.tail) {
        const flushed = [...bufRef.current.settled, bufRef.current.tail];
        bufRef.current = { settled: flushed, tail: "" };
        setSettled(flushed);
        setTail("");
      }
    }, idleFlushMs);

    return () => clearTimeout(idleTimerRef.current);
  }, [tokens, idleFlushMs]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-atomic="false"
      className={className}
      style={
        dryMs !== DEFAULT_DRY_MS
          ? ({ "--ns-wet-ink-dry-ms": `${dryMs}ms` } as CSSProperties)
          : undefined
      }
    >
      <p aria-hidden="true" className="ns-wet-ink-visual whitespace-pre-wrap">
        {tokens.map((tok, i) =>
          tok === "" ? null : (
            <span key={i} className="ns-wet-ink-token">
              {tok}
            </span>
          )
        )}
      </p>
      <span className="sr-only">
        {settled.map((chunk, i) => (
          <span key={i}>{chunk}</span>
        ))}
        <span aria-busy={tail.length > 0}>{tail}</span>
      </span>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.ns-wet-ink-token{
  font-weight:400;
  font-variation-settings:'wght' 400;
  animation:ns-wet-ink-dry var(--ns-wet-ink-dry-ms,600ms) cubic-bezier(.16,1,.3,1) both;
}
@keyframes ns-wet-ink-dry{
  from{font-weight:300;font-variation-settings:'wght' 300;opacity:.55;filter:blur(.4px)}
  to{font-weight:400;font-variation-settings:'wght' 400;opacity:1;filter:blur(0)}
}
@media (prefers-reduced-motion: reduce){
  .ns-wet-ink-token{animation:none;font-weight:400;font-variation-settings:'wght' 400;opacity:1;filter:none}
}
`;
