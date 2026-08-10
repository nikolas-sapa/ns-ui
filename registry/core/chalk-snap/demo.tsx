"use client";

import { ChalkSnap } from "./component";

export default function ChalkSnapDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">ns-ui / chalk-snap</p>

      <div className="inline-block rounded-[12px] border border-border bg-background p-6">
        <ChalkSnap>
          <div aria-hidden className="w-[420px] max-w-full select-none rounded-[6px] border border-border bg-background p-4">
            <div className="text-[11px] text-ns-muted">feature-flags.ts</div>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-5 text-foreground">
{`export function isEnabled(flag: string) {
  return flags.has(flag);
}`}
            </pre>
            <div className="mt-4 flex justify-end">
              <span className="rounded-[6px] border border-border px-3 py-1 text-[11px] text-foreground">Ship</span>
            </div>
          </div>
        </ChalkSnap>
      </div>

      <p className="max-w-md text-center text-xs text-ns-muted">
        Drag over the code to draw — the stroke snaps to box-drawing glyphs as you move. Focus the
        grid and use arrow keys (Shift+arrow to draw, Enter to cap an arrowhead) to annotate without
        a pointer. Copy raster pastes it as plain text.
      </p>
    </div>
  );
}
