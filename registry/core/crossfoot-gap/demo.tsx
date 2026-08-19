"use client";

import { useState } from "react";
import { CrossfootGap, type CrossfootColumn, type CrossfootRow } from "./component";

const COLUMNS: CrossfootColumn[] = [
  { id: "lodging", label: "Lodging" },
  { id: "meals", label: "Meals" },
  { id: "transport", label: "Transport" },
];

const ROWS: CrossfootRow[] = [
  { id: "hotel", label: "Grand Hotel — 3 nights", amount: 612.0 },
  { id: "taxi", label: "Downtown Taxi Co", amount: 84.5 },
  { id: "cafe", label: "Café Luz — working lunch", amount: 38.25 },
  { id: "parking", label: "Airport parking", amount: 96.0 },
];

// Every receipt fully coded — the ledger foots exactly, at rest, with no
// submit step: it is simply what's true of this data right now.
const BALANCED_CELLS: Record<string, Record<string, string>> = {
  hotel: { lodging: "550.00", meals: "42.00", transport: "20.00" },
  taxi: { transport: "84.50" },
  cafe: { meals: "38.25" },
  parking: { transport: "96.00" },
};

export default function CrossfootGapDemo() {
  const [cells, setCells] = useState(BALANCED_CELLS);

  function handleCellChange(rowId: string, colId: string, value: string) {
    setCells((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [colId]: value },
    }));
  }

  function simulateTypo() {
    // A fat-fingered digit — nine cents off.
    setCells((prev) => ({ ...prev, hotel: { ...prev.hotel, lodging: "550.09" } }));
  }

  function simulateDroppedLine() {
    // The whole hotel receipt never got coded — off by exactly its amount.
    setCells((prev) => ({ ...prev, hotel: {} }));
  }

  function reset() {
    setCells(BALANCED_CELLS);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="w-full max-w-2xl">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / crossfoot-gap — expense report</p>

        <CrossfootGap
          columns={COLUMNS}
          rows={ROWS}
          cells={cells}
          onCellChange={handleCellChange}
          ariaLabel="Q3 travel expense coding"
        />

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={simulateTypo}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Simulate typo (9¢)
          </button>
          <button
            type="button"
            onClick={simulateDroppedLine}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Simulate dropped line ($612)
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-ns-accent px-3 py-1.5 font-mono text-xs text-white transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Reset — close the ledger
          </button>
        </div>
      </div>
    </div>
  );
}
