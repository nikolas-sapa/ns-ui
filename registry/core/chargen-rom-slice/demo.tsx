"use client";

import { ChargenRomSlice } from "./component";

export default function ChargenRomSliceDemo() {
  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <p className="font-mono text-xs tracking-widest text-ns-muted">ns-ui / chargen-rom-slice</p>
        <p className="hidden font-mono text-[11px] text-ns-muted sm:block">
          each glyph builds top-to-bottom from ROM scanline slices, then holds clean before resweeping
        </p>
      </header>
      <div className="flex min-h-[calc(100vh-3.75rem)] items-center justify-center p-6">
        <div className="flex h-40 w-80 items-center justify-center rounded-md border border-border">
          <ChargenRomSlice text="BUFFER" />
        </div>
      </div>
    </main>
  );
}
