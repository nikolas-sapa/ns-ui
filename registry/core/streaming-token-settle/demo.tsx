"use client";

import { useEffect, useRef, useState } from "react";
import { LooseType, type LooseTypeToken } from "./component";

// A canned ASR-style transcript. "eleven" is deliberately wrong — a beat
// after it lands provisional, the recognizer revises it to "twelve" (a
// fresh id at the same seam, not an in-place text edit) before either ever
// commits. Everything else streams straight through: provisional a few
// words behind the arriving head, then locks a few words further back.
const WORDS = [
  "The",
  "quarterly",
  "revenue",
  "increased",
  "by",
  "eleven",
  "percent,",
  "driven",
  "mainly",
  "by",
  "strong",
  "enterprise",
  "demand.",
];
const CORRECTION_AFTER = 5; // index of "eleven" in WORDS
const CORRECTED_TEXT = "twelve";
const LAG = 3; // tokens stay provisional this many positions behind the head
const WORD_MS = 320;
const REST_MS = 1400;

type Step =
  | { kind: "append" }
  | { kind: "correct" };

function buildScript(): Step[] {
  const steps: Step[] = [];
  for (let i = 0; i < WORDS.length; i++) {
    steps.push({ kind: "append" });
    if (i === CORRECTION_AFTER) steps.push({ kind: "correct" });
  }
  return steps;
}
const SCRIPT = buildScript();

export default function LooseTypeDemo() {
  const [tokens, setTokens] = useState<LooseTypeToken[]>([]);
  const [paused, setPaused] = useState(false);
  const stepRef = useRef(0);
  const wordRef = useRef(0);
  const seqRef = useRef(0);

  useEffect(() => {
    if (paused) return;
    const done = stepRef.current >= SCRIPT.length;
    const t = window.setTimeout(
      () => {
        if (done) {
          stepRef.current = 0;
          wordRef.current = 0;
          setTokens([]);
          return;
        }
        const step = SCRIPT[stepRef.current]!;
        stepRef.current++;

        setTokens((prev) => {
          let next = prev;
          if (step.kind === "append") {
            const id = `w${seqRef.current++}`;
            next = [...prev, { id, text: WORDS[wordRef.current]!, committed: false }];
            wordRef.current++;
          } else {
            // correction: swap the most recent token for a fresh id, same
            // position, still provisional — this is what triggers the
            // slide-out/slide-in seam instead of an in-place text edit.
            const id = `w${seqRef.current++}`;
            next = prev.map((t, i) =>
              i === prev.length - 1 ? { id, text: CORRECTED_TEXT, committed: false } : t
            );
          }
          // commit anything more than LAG tokens behind the head
          const cutoff = next.length - LAG;
          return next.map((t, i) => (i < cutoff && !t.committed ? { ...t, committed: true } : t));
        });
      },
      done ? REST_MS : WORD_MS
    );
    return () => window.clearTimeout(t);
  }, [tokens, paused]);

  const streaming = stepRef.current < SCRIPT.length || tokens.some((t) => !t.committed);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / streaming-token-settle
      </p>

      <div
        className="w-full max-w-xl rounded-md border border-border bg-background p-6"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-ns-muted">transcript</span>
          <span className="font-mono text-[11px] text-ns-muted">
            {streaming ? "transcribing" : "settled"}
          </span>
        </div>
        <LooseType tokens={tokens} className="min-h-[6rem] text-lg leading-relaxed text-foreground" />
      </div>

      <button
        onClick={() => {
          stepRef.current = 0;
          wordRef.current = 0;
          setTokens([]);
        }}
        className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-ns-muted transition-colors duration-150 hover:border-ns-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
      >
        restart transcript
      </button>

      <p className="font-mono text-[10px] text-ns-muted">
        hover the panel to pause &middot; loose type is provisional, locked type is committed
      </p>
    </div>
  );
}
