"use client";

import { useEffect, useState } from "react";
import { WetInk } from "./component";

// A canned assistant reply, pre-split into arrival-sized chunks the way a
// real token stream shows up (a few characters to a short word at a time,
// whitespace glued to whichever side the model would actually emit it on).
const SCRIPT =
  "Sure — here's a quick summary. The build was failing because the cache " +
  "key didn't include the lockfile hash, so a dependency bump quietly " +
  "reused a stale layer.\n\nI've pinned the key to the lockfile now. " +
  "Re-running the pipeline should pick up the fix on the next push.";

function chunk(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const size = text[i] === "\n" ? 2 : 2 + Math.floor(Math.random() * 4);
    out.push(text.slice(i, i + size));
    i += size;
  }
  return out;
}

const CHUNKS = chunk(SCRIPT);
const TICK_MS = 55;
const REST_MS = 1100;

export default function WetInkDemo() {
  const [count, setCount] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const done = count >= CHUNKS.length;
    const t = window.setTimeout(
      () => setCount((c) => (c >= CHUNKS.length ? 0 : c + 1)),
      done ? REST_MS : TICK_MS
    );
    return () => window.clearTimeout(t);
  }, [count, paused]);

  const tokens = CHUNKS.slice(0, count);
  const streaming = count < CHUNKS.length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / streaming-ink-dry
      </p>

      <div
        className="w-full max-w-xl rounded-md border border-border bg-surface p-6"
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-muted">assistant</span>
          <span className="font-mono text-[11px] text-muted">
            {streaming ? "streaming" : "settled"}
          </span>
        </div>
        <WetInk
          tokens={tokens}
          className="min-h-[9rem] text-base leading-relaxed text-foreground sm:text-lg"
        />
      </div>

      <button
        onClick={() => setCount(0)}
        className="rounded-sm border border-border px-4 py-2 font-mono text-xs text-muted transition-colors duration-150 hover:border-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        restart stream
      </button>

      <p className="font-mono text-[10px] text-muted">
        hover the panel to pause the stream
      </p>
    </div>
  );
}
