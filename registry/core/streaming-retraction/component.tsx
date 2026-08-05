"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Replay an append/retract op log into inline segments. Streaming APIs that
// self-correct (constrained decoding, guardrail rewrites, tool-output
// patching) emit exactly this shape: text arrives, then N characters are
// taken back, then the replacement arrives. Rendering the *final* string
// hides the revision; diffing two snapshots re-animates settled text. The op
// log keeps both honest: arrived text never re-renders (offset-stable keys),
// and every retraction leaves an addressable scar at the exact spot it
// happened.
export type RetractInkOp =
  | { type: "append"; text: string }
  | { type: "retract"; chars: number };

type Seg =
  | { kind: "text"; content: string; start: number }
  | { kind: "scar"; content: string; opIndex: number };

function replay(ops: RetractInkOp[]): Seg[] {
  const segs: Seg[] = [];
  let offset = 0; // running append-offset, only ever grows → stable text keys
  ops.forEach((op, opIndex) => {
    if (op.type === "append") {
      const last = segs[segs.length - 1];
      if (last && last.kind === "text") {
        last.content += op.text;
      } else {
        segs.push({ kind: "text", content: op.text, start: offset });
      }
      offset += op.text.length;
      return;
    }
    // retract: pull chars off trailing text segs; scars are zero-width in
    // the live text, so a retract that reaches one simply stops there — you
    // cannot un-retract a retraction.
    let remaining = op.chars;
    let taken = "";
    while (remaining > 0) {
      const last = segs[segs.length - 1];
      if (!last || last.kind !== "text") break;
      const cut = Math.min(remaining, last.content.length);
      taken = last.content.slice(last.content.length - cut) + taken;
      last.content = last.content.slice(0, last.content.length - cut);
      remaining -= cut;
      if (last.content.length === 0) segs.pop();
    }
    if (taken.length > 0) segs.push({ kind: "scar", content: taken, opIndex });
  });
  return segs;
}

const STRIKE_MS = 1050; // strike sweep + evaporate, then the scar tick takes over

function Scar({ content, live }: { content: string; live: boolean }) {
  // live: created after mount → play strike/evaporate. Historical scars
  // (ops present at mount) render settled instantly — a page of old
  // corrections must not all animate at once on load.
  const [settled, setSettled] = useState(!live);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (settled) return;
    const t = window.setTimeout(() => setSettled(true), STRIKE_MS);
    return () => window.clearTimeout(t);
  }, [settled]);

  if (!settled) {
    return (
      <span aria-hidden className="ns-retract-strike text-ns-muted">
        {content}
      </span>
    );
  }

  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return (
    <>
      <button
        type="button"
        data-scar
        aria-expanded={open}
        aria-label={
          open
            ? "Hide retracted text"
            : `Show retracted text (${words} ${words === 1 ? "word" : "words"} removed)`
        }
        onClick={() => setOpen((o) => !o)}
        className="ns-retract-tick relative mx-[1px] inline-block h-[0.95em] w-[7px] translate-y-[0.12em] cursor-pointer rounded-[2px] align-text-bottom transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        {/* the notch: a 1px kerf cut into the tick, the mark of something excised */}
        <span aria-hidden className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-background" />
      </button>
      {open && (
        <span
          data-retract-ghost
          className="mx-0.5 rounded-sm bg-surface px-1 text-ns-muted line-through decoration-ns-muted/70"
        >
          {content}
        </span>
      )}
    </>
  );
}

export interface RetractInkProps {
  /**
   * Append-only op log. Push new ops as they arrive — never rewrite earlier
   * entries, the offset-based keys that stop settled text from re-animating
   * depend on it.
   */
  ops: RetractInkOp[];
  /** true while more ops may still arrive. Controls the caret and the sr-only status. */
  streaming?: boolean;
  className?: string;
}

export function RetractInk({ ops, streaming = true, className = "" }: RetractInkProps) {
  const segs = useMemo(() => replay(ops), [ops]);
  // ops.length at mount: scars born before it are history, not events.
  const mountLenRef = useRef<number | null>(null);
  if (mountLenRef.current === null) mountLenRef.current = ops.length;
  const mountLen = mountLenRef.current;

  const scarCount = segs.reduce((n, s) => (s.kind === "scar" ? n + 1 : n), 0);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (streaming)
      setStatus(scarCount > 0 ? `Generating — ${scarCount} self-corrections so far` : "Generating response…");
    else if (ops.length > 0)
      setStatus(scarCount > 0 ? `Response complete with ${scarCount} self-corrections.` : "Response complete.");
  }, [streaming, scarCount, ops.length]);

  return (
    <span className={`relative whitespace-pre-wrap ${className}`}>
      <style>{`
        .ns-retract-strike {
          position: relative;
          background-image: linear-gradient(currentColor, currentColor);
          background-repeat: no-repeat;
          background-position: 0 52%;
          background-size: 100% 1px;
          animation: ns-retract-sweep ${STRIKE_MS}ms linear both;
        }
        @keyframes ns-retract-sweep {
          0%   { background-size: 0% 1px; opacity: 1; }
          45%  { background-size: 100% 1px; opacity: 1; }
          72%  { opacity: 0.35; }
          100% { background-size: 100% 1px; opacity: 0; }
        }
        .ns-retract-tick { background-color: var(--ns-muted); opacity: .5; }
        .ns-retract-tick:hover, .ns-retract-tick[aria-expanded="true"] { opacity: 1; background-color: var(--foreground); }
        @keyframes ns-retract-blink { 0%, 50% { opacity: 1 } 50.01%, 100% { opacity: .25 } }
        .ns-retract-caret { animation: ns-retract-blink 1s steps(1, end) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ns-retract-strike { animation: none; opacity: .45; }
          .ns-retract-caret { animation: none; opacity: .55; }
        }
      `}</style>
      {segs.map((seg) =>
        seg.kind === "text" ? (
          <span key={`t-${seg.start}`}>{seg.content}</span>
        ) : (
          <Scar key={`s-${seg.opIndex}`} content={seg.content} live={seg.opIndex >= mountLen} />
        ),
      )}
      {streaming && (
        <span
          aria-hidden
          className="ns-retract-caret ml-0.5 inline-block h-[1em] w-[0.55em] translate-y-[0.15em] rounded-[2px] bg-ns-muted align-text-bottom"
        />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
    </span>
  );
}
