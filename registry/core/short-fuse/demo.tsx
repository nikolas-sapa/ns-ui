"use client";

import { useCallback, useState } from "react";
import { ShortFuse } from "./component";

// A toast is always mounted from the first frame on — the fuse itself is the
// ambient animation, and undo/dismiss immediately swaps in the next item so
// the demo (and the verify gate's screenshot, whenever it lands) never shows
// a blank beat between toasts.
const ITEMS = [
  { id: 1, title: "Q3 planning notes", subtitle: "Shared doc · edited 2h ago" },
  { id: 2, title: "Invoice #4021", subtitle: "Paid · $1,240.00" },
  { id: 3, title: "Design review thread", subtitle: "12 replies · unread" },
];

export default function ShortFuseDemo() {
  const [slot, setSlot] = useState<{ key: number; index: number }>({
    key: 0,
    index: 0,
  });
  const [log, setLog] = useState("archived on load — hover or Tab to pause");

  const archive = useCallback((index: number) => {
    setSlot((s) => ({ key: s.key + 1, index }));
  }, []);

  const advance = useCallback(
    (reason: "undone" | "dismissed") => {
      const item = ITEMS[slot.index];
      setLog(
        reason === "undone"
          ? `restored "${item.title}"`
          : `"${item.title}" gone — fuse burned out`
      );
      setSlot((s) => ({ key: s.key + 1, index: (s.index + 1) % ITEMS.length }));
    },
    [slot.index]
  );

  const item = ITEMS[slot.index];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / short-fuse
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-background">
          <header className="border-b border-border px-4 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">
              INBOX
            </span>
          </header>
          <ul className="divide-y divide-border">
            {ITEMS.map((it, i) => (
              <li
                key={it.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{it.title}</p>
                  <p className="truncate text-xs text-muted">{it.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => archive(i)}
                  className="shrink-0 cursor-pointer rounded-[6px] border border-border px-2.5 py-1 font-mono text-[11px] tracking-widest text-muted transition-colors duration-150 hover:border-foreground/20 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  ARCHIVE
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3">
          <ShortFuse
            key={slot.key}
            message={`"${item.title}" archived`}
            duration={6000}
            onUndo={() => advance("undone")}
            onDismiss={() => advance("dismissed")}
          />
        </div>

        <p className="mt-3 truncate font-mono text-[11px] text-muted">{log}</p>
      </div>
    </main>
  );
}
