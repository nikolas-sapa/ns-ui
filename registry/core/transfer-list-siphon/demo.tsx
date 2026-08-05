"use client";

import { SiphonLift, type SiphonItem } from "./component";

const ROSTER: SiphonItem[] = [
  { id: "wren", label: "Wren Okafor", hint: "Frontend" },
  { id: "castillo", label: "Marcus Castillo", hint: "Backend" },
  { id: "ling", label: "Priya Ling", hint: "Design" },
  { id: "haas", label: "Dov Haas", hint: "Backend" },
  { id: "novak", label: "Ilse Novak", hint: "Frontend" },
  { id: "abara", label: "Femi Abara", hint: "QA" },
  { id: "suzuki", label: "Rin Suzuki", hint: "Design" },
  { id: "belmont", label: "Cass Belmont", hint: "Frontend" },
];

export default function SiphonLiftDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / transfer-list-siphon — select many, drag one, the rest flow through the tube
      </p>

      <div className="w-full max-w-2xl rounded-md border border-border bg-background p-6">
        <h2 className="text-sm font-semibold text-foreground">Staff the Aurora sprint</h2>
        <p className="mt-1 text-sm text-ns-muted">
          Select engineers on the left, then drag any one of them into the squad. The rest
          of your selection siphons across on its own — watch the tube, or stop it mid-flow.
        </p>

        <div className="mt-6">
          <SiphonLift
            items={ROSTER}
            defaultSelectedIds={["wren", "castillo", "novak"]}
            defaultDestinationIds={["ling"]}
            sourceLabel="Bench"
            destinationLabel="Aurora squad"
          />
        </div>
      </div>

      <p className="max-w-xl text-center text-xs text-ns-muted">
        Space toggles a focused row, arrow keys move between rows. The "Move selected"
        command starts the exact same primed flow as a drag, so nothing here requires a
        pointer.
      </p>
    </div>
  );
}
