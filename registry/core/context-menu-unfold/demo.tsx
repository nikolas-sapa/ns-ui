"use client";

import { useEffect, useRef } from "react";
import { JackKnife, type JackKnifeItem } from "./component";

const ITEMS: JackKnifeItem[] = [
  { id: "rename", label: "Rename", shortcut: "⌘R" },
  { id: "duplicate", label: "Duplicate", shortcut: "⌘D" },
  {
    id: "export",
    label: "Export as",
    submenu: [
      { id: "export-png", label: "PNG" },
      { id: "export-svg", label: "SVG" },
      { id: "export-pdf", label: "PDF" },
    ],
  },
  { id: "share", label: "Share…" },
  { id: "delete", label: "Delete", shortcut: "⌫" },
];

// Self-driving: periodically opens the menu via the trigger button (a real
// DOM click, so it exercises the exact path a mouse user takes), waits,
// closes it with Escape, then loops — exercising the fold-open and
// fold-closed staggers without any input from whoever is viewing the demo.
export default function JackKnifeDemo() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const cycle = () => {
      if (cancelled) return;
      const trigger = rootRef.current?.querySelector<HTMLButtonElement>("[data-context-menu-unfold-trigger]");
      trigger?.click();
      timer = setTimeout(() => {
        if (cancelled) return;
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        timer = setTimeout(cycle, 1400);
      }, 2000);
    };

    timer = setTimeout(cycle, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={rootRef} className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / context-menu-unfold
      </p>

      <div className="flex w-full max-w-md flex-col items-center gap-3">
        <JackKnife items={ITEMS} label="File actions" onSelect={() => {}}>
          <div className="flex h-40 w-full max-w-md items-center justify-center rounded-[12px] border border-dashed border-border text-xs text-muted">
            Right-click this surface, or use the File actions button below
          </div>
        </JackKnife>
      </div>

      <p className="max-w-sm text-center text-xs text-muted">
        Items swing out from a hinge like knife blades; Export as opens a
        smaller knife of its own.
      </p>
    </div>
  );
}
