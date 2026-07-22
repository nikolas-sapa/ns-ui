"use client";

import { useCallback, useRef, useState } from "react";
import { OxbowTurn, type OxbowTurnItem } from "./component";

const SUMMARIES = [
  "User asked to refactor the auth module; assistant proposed extracting token refresh into a hook, walked through three iterations, and confirmed the test suite passed.",
  "Long back-and-forth debugging a flaky CI job — traced it to a race in the cache warmer, assistant patched it and reran the suite twice to confirm.",
  "User pasted a stack trace from the billing webhook; assistant identified a missing idempotency key and added a migration to backfill it.",
];

function turnEntry(n: number) {
  return { id: `t${n}`, label: String(n) };
}

function seedTurns(from: number, to: number): OxbowTurnItem[] {
  const out: OxbowTurnItem[] = [];
  for (let n = from; n <= to; n++) out.push({ kind: "turn", id: `t${n}`, label: String(n) });
  return out;
}

const INITIAL: OxbowTurnItem[] = [
  ...seedTurns(1, 2),
  {
    kind: "compaction",
    id: "c1",
    turns: [turnEntry(3), turnEntry(4), turnEntry(5), turnEntry(6), turnEntry(7), turnEntry(8), turnEntry(9)],
    summary: SUMMARIES[0],
    tokenCount: 1840,
    compactedAgo: "2 minutes ago",
  },
  ...seedTurns(10, 16),
];

export default function OxbowTurnDemo() {
  const [items, setItems] = useState<OxbowTurnItem[]>(INITIAL);
  const [status, setStatus] = useState("session live · 9 turns in channel, 1 oxbow settled");
  const nextTurnRef = useRef(17);
  const nextCompactionRef = useRef(2);

  const addTurn = useCallback(() => {
    const n = nextTurnRef.current++;
    setItems((prev) => [...prev, { kind: "turn", id: `t${n}`, label: String(n) }]);
    setStatus(`turn ${n} streamed into the channel`);
  }, []);

  const compactOldest = useCallback(() => {
    setItems((prev) => {
      const runStart = prev.findIndex((it) => it.kind === "turn");
      if (runStart === -1) return prev;
      let runEnd = runStart;
      while (runEnd + 1 < prev.length && prev[runEnd + 1]?.kind === "turn" && runEnd - runStart < 3) {
        runEnd++;
      }
      if (runEnd === runStart) return prev; // need at least 2 turns to make folding visible
      const run = prev.slice(runStart, runEnd + 1) as Extract<OxbowTurnItem, { kind: "turn" }>[];
      if (run.length < 2) return prev;
      const id = `c${nextCompactionRef.current++}`;
      const compaction: OxbowTurnItem = {
        kind: "compaction",
        id,
        turns: run.map((t) => ({ id: t.id, label: t.label })),
        summary: SUMMARIES[(nextCompactionRef.current - 2) % SUMMARIES.length] ?? SUMMARIES[0],
        tokenCount: 400 + run.length * 180,
        compactedAgo: "just now",
      };
      const next = [...prev];
      next.splice(runStart, run.length, compaction);
      return next;
    });
    setStatus("context compacted · watch the channel shorten");
  }, []);

  const reinject = useCallback((compactionId: string) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.kind === "compaction" && it.id === compactionId);
      if (idx === -1) return prev;
      const c = prev[idx];
      if (!c || c.kind !== "compaction") return prev;
      const restored: OxbowTurnItem[] = c.turns.map((t) => ({ kind: "turn", id: t.id, label: t.label }));
      const next = [...prev];
      next.splice(idx, 1, ...restored);
      return next;
    });
    setStatus("re-injected · those turns are live again");
  }, []);

  const reset = useCallback(() => {
    setItems(INITIAL);
    nextTurnRef.current = 17;
    nextCompactionRef.current = 2;
    setStatus("session reset · baseline restored");
  }, []);

  const buttonClass =
    "cursor-pointer rounded-sm border border-border px-3 py-1.5 font-mono text-[11px] tracking-widest text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / oxbow-turn
        </p>

        <div className="rounded-md border border-border">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="font-mono text-xs uppercase tracking-widest text-muted">
              CONTEXT RIVER
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted">agent session</span>
          </header>

          <div className="px-5 py-5">
            <OxbowTurn items={items} onReinject={reinject} ariaLabel="Agent session context history" />
          </div>

          <div className="border-t border-border px-5 py-2">
            <p className="truncate font-mono text-[11px] text-muted">
              <span className="text-foreground">event</span> · {status}
            </p>
          </div>

          <footer className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
            <button type="button" onClick={addTurn} className={buttonClass}>
              ADD TURN
            </button>
            <button type="button" onClick={compactOldest} className={buttonClass}>
              COMPACT OLDEST
            </button>
            <button type="button" onClick={reset} className={buttonClass}>
              RESET SESSION
            </button>
          </footer>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          the channel is a picture of what is still live — open an oxbow to read what
          left it, or re-inject to splice it back in
        </p>
      </div>
    </main>
  );
}
