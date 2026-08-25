"use client";

import { CrackArrestHole } from "./component";

export default function CrackArrestHoleDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / crack-arrest-hole — hold to abort
      </p>
      <CrackArrestHole arrestedLabel="Stopped">Hold to abort</CrackArrestHole>
    </div>
  );
}
