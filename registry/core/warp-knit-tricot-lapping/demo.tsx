"use client";

import { WarpKnitTricotLapping } from "./component";

export default function WarpKnitTricotLappingDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / warp-knit-tricot-lapping
        </p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          guide bar shogs 2 needle-spaces, alternating, building a diagonal chevron every course
        </p>
      </header>
      <div className="h-24 w-full border-b border-border sm:h-28">
        <WarpKnitTricotLapping />
      </div>
    </main>
  );
}
