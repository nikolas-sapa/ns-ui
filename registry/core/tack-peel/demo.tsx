"use client";

import { useState } from "react";
import { TackPeelCard } from "./component";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
}

const SEED: NotificationItem[] = [
  { id: "n1", title: "New comment on your post", description: "Mara replied to “Q3 roadmap notes”." },
  { id: "n2", title: "Deploy succeeded", description: "tack-peel-demo shipped to production." },
  { id: "n3", title: "Storage nearing limit", description: "82% of your workspace quota is in use." },
];

export default function TackPeelDemo() {
  const [items, setItems] = useState(SEED);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-4 text-center font-mono text-xs tracking-widest text-muted">
          ns-ui / tack-peel
        </p>
        <div className="rounded-md border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted">
              {items.length} new
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
                All clear.
              </p>
            ) : (
              items.map((item, idx) => (
                // The autoplay driver drags inside a single card's own box — a
                // demo-only wrapper class scopes its target to exactly item 0
                // (whichever notification currently occupies that slot) so a
                // pointer path confined to that box can never spill into a
                // neighboring card's geometry.
                <div key={item.id} className={idx === 0 ? "ns-tackpeel-autoplay-target" : undefined}>
                  <TackPeelCard
                    title={item.title}
                    description={item.description}
                    onRemove={() =>
                      setItems((rows) => rows.filter((row) => row.id !== item.id))
                    }
                  />
                </div>
              ))
            )}
          </div>
          <p className="mt-3 font-mono text-[10px] text-muted">
            drag a corner past the tipping point to peel it off, or use the × — Undo holds for 5s
          </p>
        </div>
      </div>
    </main>
  );
}
