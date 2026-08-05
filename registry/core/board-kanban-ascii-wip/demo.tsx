"use client";

import { useState } from "react";
import { WipBoard, type WipColumn } from "./component";

const COLUMNS: WipColumn[] = [
  {
    id: "backlog",
    title: "Backlog",
    limit: 8,
    cards: [
      { id: "c-411", ref: "ATL-411", title: "Rotate signing keys", meta: "P1" },
      { id: "c-388", ref: "ATL-388", title: "Dedupe webhook retries", meta: "P2" },
      { id: "c-402", ref: "ATL-402", title: "CSV column mapping", meta: "P2" },
      { id: "c-370", ref: "ATL-370", title: "Audit log retention", meta: "P3" },
    ],
  },
  {
    id: "doing",
    title: "In Progress",
    limit: 3,
    cards: [
      { id: "c-214", ref: "ATL-214", title: "Ship API pagination", meta: "mara" },
      { id: "c-357", ref: "ATL-357", title: "Safari focus trap", meta: "jonas" },
      { id: "c-291", ref: "ATL-291", title: "Stripe backfill", meta: "eli" },
    ],
  },
  {
    id: "review",
    title: "Review",
    limit: 3,
    cards: [
      { id: "c-198", ref: "ATL-198", title: "Rate-limit headers", meta: "+2" },
      { id: "c-233", ref: "ATL-233", title: "Search relevance", meta: "+1" },
      { id: "c-245", ref: "ATL-245", title: "Billing proration", meta: "+3" },
      { id: "c-260", ref: "ATL-260", title: "Seat invite emails", meta: "+1" },
      { id: "c-266", ref: "ATL-266", title: "Locale fallbacks", meta: "+2" },
    ],
  },
];

export default function WipBoardDemo() {
  const [note, setNote] = useState("Review is 2 over its limit");
  const titleOf = (id: string) => COLUMNS.find((c) => c.id === id)?.title ?? id;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-8 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / board-kanban-ascii-wip
      </p>

      <WipBoard
        columns={COLUMNS}
        onOverLimit={(colId, over) =>
          setNote(
            over > 0
              ? `${titleOf(colId)} is ${over} over its limit`
              : `${titleOf(colId)} is within its limit`
          )
        }
      />

      <p className="font-mono text-[11px] text-ns-muted">
        drag a card, or focus one and use the arrow keys &middot; {note}
      </p>
    </div>
  );
}
