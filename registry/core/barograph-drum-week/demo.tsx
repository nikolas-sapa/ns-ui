"use client";

import { BarographDrumWeek } from "./component";

export default function BarographDrumWeekDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / barograph-drum-week
        </p>
        <BarographDrumWeek />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          pen inches across a pre-ruled week of chart paper, ink trailing behind it, unattended
        </p>
      </div>
    </main>
  );
}
