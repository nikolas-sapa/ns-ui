"use client";

import { CurdCutWhey } from "./component";

export default function CurdCutWheyDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / curd-cut-whey
        </p>
        <CurdCutWhey />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          cubes cut, shrink unevenly and jostle on a stir beat, then recombine into a fresh batch
        </p>
      </div>
    </main>
  );
}
