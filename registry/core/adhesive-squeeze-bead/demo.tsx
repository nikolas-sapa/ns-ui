"use client";

import { AdhesiveSqueezeBead } from "./component";

// A "merge these two cards" moment — the seam between them is the whole
// point, so the demo keeps both panels' content minimal and lets the bead
// carry it. Drag the lower panel up past the halfway point to commit a
// bond on demand; otherwise the ambient loop bonds and resets on its own.
export default function AdhesiveSqueezeBeadDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / adhesive-squeeze-bead
      </p>

      <div className="w-full max-w-sm">
        <AdhesiveSqueezeBead
          topContent={<span className="font-mono text-[11px] tracking-widest text-ns-muted">RECORD</span>}
          bottomContent={<span className="font-mono text-[11px] tracking-widest text-ns-muted">MERGE TARGET</span>}
        />
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        A continuous, even bead of squeeze-out along the seam is a good bond; a broken or
        lumpy line is a starved one. Drag the lower panel up to bond it yourself.
      </p>
    </div>
  );
}
