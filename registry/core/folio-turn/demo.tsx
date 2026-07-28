"use client";

import { useEffect, useState } from "react";
import { FolioTurn } from "./component";

const COUNT = 6;
// Cycles forward through every page then jumps back, self-driving through
// onChange exactly like a pointing user clicking next repeatedly, no
// pointer/keyboard events required in the loop.
const STEP_MS = 1800;

const ITEMS: Record<number, string[]> = {
  1: ["Cover letter", "Table of contents"],
  2: ["Chapter I — Departure", "Chapter II — The Coast Road"],
  3: ["Chapter III — The Junction", "Chapter IV — Overnight Hold"],
  4: ["Chapter V — Inland", "Chapter VI — Arrival"],
  5: ["Appendix A — Manifest", "Appendix B — Route Notes"],
  6: ["Index", "Colophon"],
};

export default function FolioTurnDemo() {
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setPage((p) => (p >= COUNT ? 1 : p + 1));
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / folio-turn
      </p>

      <div className="flex w-full max-w-md flex-col gap-4 rounded-[12px] border border-border bg-background p-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
          Table of contents
        </span>
        <ul className="flex flex-col gap-2">
          {ITEMS[page]!.map((line) => (
            <li key={line} className="text-sm text-foreground">
              {line}
            </li>
          ))}
        </ul>
      </div>

      <FolioTurn page={page} count={COUNT} onChange={setPage} />

      <p className="max-w-md text-center text-xs text-muted">
        Hover next/prev to peek the corner curl on the current page; visited
        pages keep a small permanent crease.
      </p>
    </div>
  );
}
