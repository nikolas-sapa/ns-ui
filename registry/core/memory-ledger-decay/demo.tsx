"use client";

import { useState } from "react";
import { PatinaLedger, type PatinaMemory } from "./component";

const INITIAL_TURN = 11;

const INITIAL_MEMORIES: PatinaMemory[] = [
  { id: "units", text: "prefers metric units", lastUsedTurn: 10, pinned: false },
  { id: "tone", text: "wants terse, no-fluff replies", lastUsedTurn: 11, pinned: true },
  { id: "stack", text: "project uses Next.js + Tailwind v4", lastUsedTurn: 8, pinned: false },
  { id: "tz", text: "based in Lisbon, GMT+1", lastUsedTurn: 6, pinned: false },
  { id: "editor", text: "reviews diffs before applying", lastUsedTurn: 1, pinned: false },
  { id: "coffee", text: "asked about espresso once, in passing", lastUsedTurn: 0, pinned: false },
  { id: "oldname", text: "old project name: 'nimbus'", lastUsedTurn: 0, pinned: false },
  { id: "deprecated-tz", text: "originally said Berlin, later corrected", lastUsedTurn: 0, pinned: false },
];

export default function PatinaLedgerDemo() {
  const [turn, setTurn] = useState(INITIAL_TURN);
  const [memories, setMemories] = useState(INITIAL_MEMORIES);

  function handlePinToggle(id: string, pinned: boolean) {
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, pinned } : m)));
  }

  function handleEvict(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  function advanceTurn() {
    setTurn((t) => t + 1);
  }

  function agentCites(id: string) {
    const nextTurn = turn + 1;
    setTurn(nextTurn);
    setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, lastUsedTurn: nextTurn } : m)));
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">
          ns-ui / memory-ledger-decay — turn {turn}
        </p>

        <PatinaLedger
          memories={memories}
          turn={turn}
          onPinToggle={handlePinToggle}
          onEvict={handleEvict}
          ariaLabel="What I remember about you"
        />

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={advanceTurn}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Advance turn
          </button>
          <button
            type="button"
            onClick={() => agentCites("units")}
            className="rounded-md bg-accent px-3 py-1.5 font-mono text-xs text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Agent cites: metric units
          </button>
          <button
            type="button"
            onClick={() => agentCites("tz")}
            className="rounded-md bg-accent px-3 py-1.5 font-mono text-xs text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Agent cites: timezone
          </button>
        </div>
      </div>
    </div>
  );
}
