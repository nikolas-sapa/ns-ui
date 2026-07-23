"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KerfCaret } from "./component";

// Chunked to land mid-token and mid-delimiter on purpose — "**" opens on
// one tick and only closes several ticks later, and the backtick pair
// straddles a chunk boundary too, so the settle flash on close is visible
// instead of hypothetical.
const CHUNKS = [
  "Sure", "—", " here's", " the", " short", " version", ".", " Wrap", " the", " expensive",
  " re-render", " in", " `", "startTransition", "`", " so", " typing", " stays", " responsive",
  " while", " React", " finishes", " the", " heavier", " work", " in", " the", " background", ".",
  "\n\n", "The", " key", " part", " is", " that", " ", "**", "state", " updates", " marked", " as",
  " a", " transition", "**", " are", " interruptible", " —", " a", " newer", " keystroke", " can",
  " cancel", " a", " stale", " render", " before", " it", " commits", ".",
];

export default function KerfCaretDemo() {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(true);
  const indexRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Loops: stream in, sit complete for a beat, restart. A one-shot demo
  // freezes on a finished paragraph — the resting frame the landing card
  // renders and the owner judges first — which hides the whole point of
  // the component (the caret, the settle flashes). Looping keeps the
  // unfinished edge visible at rest, which is also what makes autoplay
  // "none" (genuinely self-animating, no synthetic input needed) honest.
  const run = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    setText("");
    setStreaming(true);
    indexRef.current = 0;
    const step = () => {
      const i = indexRef.current;
      if (i >= CHUNKS.length) {
        setStreaming(false);
        timeoutRef.current = setTimeout(run, 2600);
        return;
      }
      setText((t) => t + CHUNKS[i]);
      indexRef.current += 1;
      timeoutRef.current = setTimeout(step, 55 + Math.random() * 90);
    };
    timeoutRef.current = setTimeout(step, 300);
  }, []);

  useEffect(() => {
    run();
    return () => window.clearTimeout(timeoutRef.current);
  }, [run]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / kerf-caret
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">ASSISTANT</span>
            <button
              type="button"
              onClick={run}
              className="cursor-pointer rounded-sm border border-border px-3 py-1 font-mono text-[11px] text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              replay
            </button>
          </header>
          <div className="flex flex-col gap-4 px-5 py-5">
            <div className="self-end max-w-[80%] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
              How do I keep the input responsive while a big list re-renders?
            </div>
            <div className="max-w-[85%] rounded-md bg-background px-3 py-2 text-sm leading-relaxed text-foreground">
              <KerfCaret text={text} streaming={streaming} />
            </div>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          arrived text never re-animates — only the trailing edge carries the caret
          and settles when a bold or code span closes
        </p>
      </div>
    </main>
  );
}
