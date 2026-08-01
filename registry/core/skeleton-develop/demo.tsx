"use client";

import { useEffect, useState } from "react";
import { DevelopSkeleton, type SkeletonBlock } from "./component";

const BLOCKS: SkeletonBlock[] = [
  { kind: "row", gap: 14, align: "center", items: [{ kind: "circle", size: 44 }, { kind: "text", lines: 2 }] },
  { kind: "box", height: 132 },
  { kind: "heading", width: 0.66 },
  { kind: "text", lines: 3 },
];

export default function DevelopSkeletonDemo() {
  const [loading, setLoading] = useState(true);

  // loops so the card is alive, but dwells far longer in the loading state —
  // the still frame has to read as "this is loading" with no caption. Under
  // reduced motion it simply never leaves it.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let id = 0;
    const schedule = (next: boolean, delay: number) => {
      id = window.setTimeout(() => {
        setLoading(next);
        schedule(!next, next ? 3000 : 1800);
      }, delay);
    };
    schedule(false, 4000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / skeleton-develop — placeholder resolving into content
      </p>

      <div className="w-[420px] rounded-md border border-border bg-surface p-6">
        <DevelopSkeleton loading={loading} blocks={BLOCKS} developMs={950}>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3.5">
              <div className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background font-mono text-xs text-muted">
                NS
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">Ansel Ward</p>
                <p className="text-xs text-muted">Posted 2 hours ago</p>
              </div>
            </div>

            <div className="grid h-[132px] place-items-center rounded-md border border-border bg-background">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                fig. 1 — contact sheet
              </span>
            </div>

            <h3 className="text-base font-medium text-foreground">Everything the tray remembers</h3>

            <p className="text-sm leading-relaxed text-muted">
              The image is already there before you can see it. Agitate, wait, and the grain settles
              into edges: a paragraph resolving out of its own placeholder, in the order it was read.
            </p>
          </div>
        </DevelopSkeleton>
      </div>
    </div>
  );
}
