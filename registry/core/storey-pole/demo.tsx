"use client";

import { useState } from "react";
import { StoreyPole, type StoreyPoleLevel } from "./component";

const LEVELS: StoreyPoleLevel[] = [
  { id: "4", label: "4", name: "Design", elevation: 19.6, height: 3.5 },
  { id: "3", label: "3", name: "Engineering", elevation: 16.1, height: 3.5 },
  { id: "2", label: "2", name: "Retail", elevation: 12.6, height: 3.5 },
  { id: "1", label: "1", name: "Food Court", elevation: 9.1, height: 3.5 },
  { id: "m", label: "M", name: "Mezzanine", elevation: 6.5, height: 2.6 },
  { id: "g", label: "G", name: "Lobby", elevation: 0, height: 6.5 },
  { id: "b1", label: "B1", name: "Parking", elevation: -3.2, height: 3.2 },
  { id: "b2", label: "B2", name: "Parking", elevation: -6.4, height: 3.2 },
];

export default function StoreyPoleDemo() {
  const [floor, setFloor] = useState("g");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / storey-pole — a building you can read
      </p>

      <div className="w-full max-w-lg rounded-md border border-border bg-background p-6">
        <h2 className="text-sm font-semibold text-foreground">Select floor</h2>
        <p className="mt-1 text-xs text-ns-muted">
          Double-height lobby, a short mezzanine, two basement parking
          levels — drawn at their real relative heights, not as equal rows.
        </p>
        <div className="mt-5">
          <StoreyPole
            label="Select floor"
            levels={LEVELS}
            value={floor}
            onValueChange={setFloor}
          />
        </div>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Click or drag anywhere in the section to scrub — the line
        magnetizes to each slab and previews it before you release. Arrow
        keys move one floor at a time.
      </p>
    </div>
  );
}
