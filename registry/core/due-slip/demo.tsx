"use client";

import { useState } from "react";
import { DueSlip, type DueSlipReader } from "./component";

// A long-running thread, already well past capacity — this is the instance
// that actually shows the overflow ghost card (a real "+10", not a pile) at
// rest, and the ink-alpha ramp reaching its 0.55 floor once expanded.
const LONG_THREAD: DueSlipReader[] = [
  { id: "mara-chen", name: "Mara Chen", readAt: new Date(2026, 7, 17, 8, 3) },
  { id: "jonas-weber", name: "Jonas Weber", readAt: new Date(2026, 7, 17, 8, 22) },
  { id: "aiko-tanaka", name: "Aiko Tanaka", readAt: new Date(2026, 7, 17, 8, 41) },
  { id: "sam-okafor", name: "Sam Okafor", readAt: new Date(2026, 7, 17, 9, 5) },
  { id: "lena-fischer", name: "Lena Fischer", readAt: new Date(2026, 7, 17, 9, 20) },
  { id: "ravi-patel", name: "Ravi Patel", readAt: new Date(2026, 7, 17, 9, 47) },
  { id: "nora-lindqvist", name: "Nora Lindqvist", readAt: new Date(2026, 7, 17, 10, 12) },
  { id: "david-kim", name: "David Kim", readAt: new Date(2026, 7, 17, 10, 33) },
  { id: "priya-nair", name: "Priya Nair", readAt: new Date(2026, 7, 17, 10, 58) },
  { id: "owen-brennan", name: "Owen Brennan", readAt: new Date(2026, 7, 17, 11, 15) },
  { id: "yusuf-demir", name: "Yusuf Demir", readAt: new Date(2026, 7, 17, 11, 42) },
  { id: "elin-sorensen", name: "Elin Sorensen", readAt: new Date(2026, 7, 17, 12, 8) },
  { id: "marco-rossi", name: "Marco Rossi", readAt: new Date(2026, 7, 17, 13, 2) },
  { id: "chidi-okeke", name: "Chidi Okeke", readAt: new Date(2026, 7, 17, 13, 31) },
  { id: "ines-ferreira", name: "Ines Ferreira", readAt: new Date(2026, 7, 17, 14, 9) },
  { id: "tomas-novak", name: "Tomas Novak", readAt: new Date(2026, 7, 17, 14, 47) },
];

// A fresh doc with room to spare — this is the instance the autoplay press
// targets, so the stamp's press-in spring always has a free row to land in.
const FRESH_DOC: DueSlipReader[] = [
  { id: "f-mara-chen", name: "Mara Chen", readAt: new Date(2026, 7, 17, 9, 14) },
  { id: "f-jonas-weber", name: "Jonas Weber", readAt: new Date(2026, 7, 17, 9, 47) },
];

const POOL = ["Aiko Tanaka", "Sam Okafor", "Lena Fischer", "Ravi Patel", "Nora Lindqvist", "David Kim"];

export default function DueSlipDemo() {
  const [readers, setReaders] = useState<DueSlipReader[]>(FRESH_DOC);

  function simulateOpen() {
    setReaders((cur) => {
      const name = POOL[(cur.length - FRESH_DOC.length) % POOL.length];
      const id = `f-${name.toLowerCase().replace(/\s+/g, "-")}-${cur.length}`;
      return [...cur, { id, name, readAt: new Date() }];
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / due-slip — read by, not seen by
      </p>

      <div className="flex w-full max-w-sm flex-col gap-8">
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Design system RFC.md</p>
          <DueSlip readers={LONG_THREAD} label="Read receipts" visibleRows={6} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Q3 pricing spec.docx</p>
          <DueSlip readers={readers} label="Read receipts" visibleRows={6} />
        </div>
      </div>

      <button
        type="button"
        onClick={simulateOpen}
        className="due-slip-autoplay rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-ns-muted transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
      >
        Simulate a colleague opening the doc
      </button>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Each open stamps the next free row with initials and a timestamp, in
        order — no hover required to read who's seen it. Once a ruled card
        fills, later opens surface as a real count on the card behind it. Tab
        to a card's title and press Enter to expand full names.
      </p>
    </div>
  );
}
