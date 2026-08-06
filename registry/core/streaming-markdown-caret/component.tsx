"use client";

import { useEffect, useMemo, useState } from "react";

// Tiny hand-written scanner — no markdown dependency. A real parser (e.g.
// streamdown) rebuilds its AST from the whole string on every token, and a
// fresh AST means fresh React elements for text that already rendered
// correctly last frame: the entire block remounts and shimmers. This
// scanner exists specifically so already-closed segments keep the same key
// (their fixed character offset) forever and are never touched again.
type Segment = { type: "text" | "bold" | "code"; content: string; start: number };

function parseKerf(source: string): { segments: Segment[]; tail: string } {
  const segments: Segment[] = [];
  let i = 0;
  let runStart = 0;
  const n = source.length;

  while (i < n) {
    if (source[i] === "*" && source[i + 1] === "*") {
      const close = source.indexOf("**", i + 2);
      if (close === -1) {
        if (i > runStart) segments.push({ type: "text", content: source.slice(runStart, i), start: runStart });
        runStart = i;
        break;
      }
      if (i > runStart) segments.push({ type: "text", content: source.slice(runStart, i), start: runStart });
      segments.push({ type: "bold", content: source.slice(i + 2, close), start: i });
      i = close + 2;
      runStart = i;
      continue;
    }
    if (source[i] === "`") {
      const close = source.indexOf("`", i + 1);
      if (close === -1) {
        if (i > runStart) segments.push({ type: "text", content: source.slice(runStart, i), start: runStart });
        runStart = i;
        break;
      }
      if (i > runStart) segments.push({ type: "text", content: source.slice(runStart, i), start: runStart });
      segments.push({ type: "code", content: source.slice(i + 1, close), start: i });
      i = close + 1;
      runStart = i;
      continue;
    }
    i++;
  }

  return { segments, tail: source.slice(runStart) };
}

export interface KerfCaretProps {
  /**
   * Full text accumulated so far. Append new characters as they arrive —
   * never mutate or replace earlier characters, or the offset-based keys
   * that keep the stable prefix from re-animating no longer hold.
   */
  text: string;
  /** true while more content may still arrive. Controls the trailing caret and the sr-only status. */
  streaming?: boolean;
  /** extra classes merged onto the rendered root element */
  className?: string;
}

export function KerfCaret({ text, streaming = true, className = "" }: KerfCaretProps) {
  const { segments, tail } = useMemo(() => parseKerf(text), [text]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (streaming) setStatus("Generating response…");
    else if (text.length > 0) setStatus("Response complete.");
  }, [streaming]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={`relative whitespace-pre-wrap ${className}`}>
      <style>{`
        @keyframes ns-kerf-settle { from { opacity: .45 } to { opacity: 1 } }
        .ns-kerf-settle { animation: ns-kerf-settle 120ms cubic-bezier(.16,1,.3,1); }
        @keyframes ns-kerf-blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: .25 } }
        .ns-streaming-markdown-caret { animation: ns-kerf-blink 1s steps(1, end) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ns-kerf-settle { animation: none; }
          .ns-streaming-markdown-caret { animation: none; opacity: .55; }
        }
      `}</style>
      {segments.map((seg) => {
        if (seg.type === "bold") {
          return (
            <strong key={`bold-${seg.start}`} className="ns-kerf-settle font-semibold">
              {seg.content}
            </strong>
          );
        }
        if (seg.type === "code") {
          return (
            <code
              key={`code-${seg.start}`}
              className="ns-kerf-settle rounded-sm border border-border bg-surface px-1 py-0.5 font-mono text-[0.9em]"
            >
              {seg.content}
            </code>
          );
        }
        return <span key={`text-${seg.start}`}>{seg.content}</span>;
      })}
      <span key="tail">{tail}</span>
      {streaming && (
        <span
          key="caret"
          aria-hidden
          className="ns-streaming-markdown-caret ml-0.5 inline-block h-[1em] w-[0.55em] translate-y-[0.15em] rounded-[2px] bg-ns-muted align-text-bottom"
        />
      )}
      <span key="status" role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </span>
  );
}
