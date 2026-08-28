"use client";

import { VacuumFiltrationCakeBuild } from "./component";

export default function VacuumFiltrationCakeBuildDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / vacuum-filtration-cake-build
        </p>
        <VacuumFiltrationCakeBuild />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          drops fall through the paper as the cake thickens, the gap between them stretching out
        </p>
      </div>
    </main>
  );
}
