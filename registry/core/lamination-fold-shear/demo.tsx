"use client";

import { LaminationFoldShear } from "./component";

export default function LaminationFoldShearDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / lamination-fold-shear</p>

      <LaminationFoldShear label="Build pipeline" steps={["Build", "Test", "Deploy"]} />

      <p className="max-w-md text-center text-xs text-ns-muted">
        A cross-section of dough bands splits into three times as many, three times thinner bands at each of three
        fold events, then wipes back to one band and folds again.
      </p>
    </div>
  );
}
