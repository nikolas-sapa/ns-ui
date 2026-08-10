"use client";

import { useState } from "react";
import { ChordPunch, type ChordValue } from "./component";

const DELETE_LINE: ChordValue = { ctrl: false, alt: false, shift: true, meta: true, base: "K" };
const SAVE_FILE: ChordValue = { ctrl: false, alt: false, shift: false, meta: true, base: "S" };

const BINDINGS = [
  { id: "delete-line", label: "Delete Line", chord: DELETE_LINE },
  { id: "save-file", label: "Save File", chord: SAVE_FILE },
];

export default function ChordPunchDemo() {
  // Deliberately seeded to collide with "Delete Line" so the resting frame
  // already shows the ≠ row, not just the empty-field state.
  const [duplicateLine, setDuplicateLine] = useState<ChordValue | null>(DELETE_LINE);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / chord-punch</p>

      <div className="w-full max-w-sm rounded-md border border-border bg-background p-5">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
        <p className="mb-4 text-xs text-ns-muted">
          Click a field, then press the combination you want it to remember.
        </p>

        <div className="flex flex-col gap-4">
          <ChordPunch
            id="duplicate-line"
            label="Duplicate Line"
            value={duplicateLine}
            onChange={setDuplicateLine}
            bindings={BINDINGS}
          />
        </div>
      </div>

      <p className="max-w-sm text-center text-xs text-ns-muted">
        Bound here to the same combo as &ldquo;Delete Line&rdquo; on purpose — record a different one to clear the
        clash.
      </p>
    </div>
  );
}
