"use client";

import { useState } from "react";
import { PunchFigure } from "./component";

export default function PunchFigureDemo() {
  // Issuing is a one-shot, permanently-disabled action — remount on a delay
  // after it completes so the card resets to "unissued" and the autoplay
  // driver's next press cycle has something to punch again.
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / punch-figure — press Issue, then Void
      </p>

      <PunchFigure
        key={resetKey}
        amount={1180}
        invoiceId="INV-2041"
        label="Invoice"
        onIssue={() => setTimeout(() => setResetKey((k) => k + 1), 1800)}
      />

      <p className="max-w-md text-center text-xs text-ns-muted">
        The amount is punched through the sheet as a dot matrix, one head pass, left to right — it
        can never be edited, only voided with a second pass punched diagonally across it.
      </p>
    </div>
  );
}
