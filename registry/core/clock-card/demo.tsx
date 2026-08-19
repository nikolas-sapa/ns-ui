"use client";

import { useState } from "react";
import { ClockCardRack, type ClockCardCollaborator } from "./component";

const D = "2026-08-17";

const INITIAL: ClockCardCollaborator[] = [
  {
    id: "priya",
    name: "Priya",
    bursts: [
      { id: "priya-1", section: "edited section 2", start: `${D}T14:10:00`, end: `${D}T14:32:00`, unread: true },
      { id: "priya-2", section: "resolved 3 threads", start: `${D}T12:05:00`, end: `${D}T12:48:00`, unread: true },
      { id: "priya-3", section: "reviewed the outline", start: `${D}T09:00:00`, end: `${D}T09:20:00`, unread: false },
    ],
  },
  {
    id: "marcus",
    name: "Marcus",
    bursts: [
      { id: "marcus-1", section: "shipped the fix", start: `${D}T11:40:00`, end: `${D}T11:52:00`, unread: true },
      { id: "marcus-2", section: "wrote release notes", start: `${D}T08:15:00`, end: `${D}T08:44:00`, unread: false },
    ],
  },
  {
    id: "dana",
    name: "Dana",
    bursts: [
      { id: "dana-1", section: "triaged the backlog", start: `${D}T07:30:00`, end: `${D}T08:05:00`, unread: false },
    ],
  },
];

let punchSeq = 0;

export default function ClockCardDemo() {
  const [collaborators, setCollaborators] = useState(INITIAL);

  function handleMarkCaughtUp(id: string) {
    setCollaborators((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, bursts: c.bursts.map((b) => ({ ...b, unread: false })) } : c
      )
    );
  }

  function simulateNewPunch() {
    punchSeq++;
    // fixed, deterministic times — later each press so it keeps climbing to
    // the top of the rack, never real wall-clock time
    const h = 15 + punchSeq;
    setCollaborators((prev) =>
      prev.map((c) =>
        c.id === "dana"
          ? {
              ...c,
              bursts: [
                ...c.bursts,
                {
                  id: `dana-live-${punchSeq}`,
                  section: "picked up a new thread",
                  start: `${D}T${String(h).padStart(2, "0")}:00:00`,
                  end: `${D}T${String(h).padStart(2, "0")}:18:00`,
                  unread: true,
                },
              ],
            }
          : c
      )
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="w-full max-w-md">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / clock-card
        </p>

        <ClockCardRack
          collaborators={collaborators}
          onMarkCaughtUp={handleMarkCaughtUp}
          ariaLabel="While you were away"
        />

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={simulateNewPunch}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
          >
            Simulate new punch — Dana
          </button>
        </div>
      </div>
    </div>
  );
}
