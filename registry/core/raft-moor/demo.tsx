"use client";

import { useEffect, useState } from "react";
import { RaftMoor, type RaftMoorCollaborator } from "./component";

const SECTIONS = [
  { id: "intro", label: "Intro", fraction: 0.06 },
  { id: "install", label: "Install", fraction: 0.28 },
  { id: "api", label: "API", fraction: 0.5 },
  { id: "examples", label: "Examples", fraction: 0.72 },
  { id: "faq", label: "FAQ", fraction: 0.94 },
] as const;

// Scripted section-index walk per teammate. Stepped together so the moments
// of overlap are legible: Jonas joins Mara on API at step 1 (rafts outward,
// arrived second), Sam joins both at step 2 (rafts outward again, arrived
// third) — a live three-way raft — then they peel back off. Aiko never
// moves, so the idle chip is always the one parked on FAQ.
const WALKERS: { id: string; name: string; initials: string; path: number[] }[] = [
  { id: "sam", name: "Sam Okafor", initials: "SO", path: [0, 1, 2, 1, 0] },
  { id: "mara", name: "Mara Chen", initials: "MC", path: [2, 2, 2, 3, 2] },
  { id: "jonas", name: "Jonas Weber", initials: "JW", path: [1, 2, 2, 2, 1] },
  { id: "aiko", name: "Aiko Tanaka", initials: "AT", path: [4, 4, 4, 4, 4] },
];

const STEP_MS = 2600;

function collaboratorsAt(step: number): RaftMoorCollaborator[] {
  return WALKERS.map((w) => {
    const idx = w.path[step % w.path.length] ?? 0;
    const s = SECTIONS[idx] ?? SECTIONS[0];
    return {
      id: w.id,
      name: w.name,
      initials: w.initials,
      fraction: s.fraction,
      sectionId: s.id,
      sectionLabel: s.label,
    };
  });
}

const PROPS: [string, string, string][] = [
  ["collaborators", "RaftMoorCollaborator[]", "required"],
  ["idleThresholdMs", "number", "60000"],
  ["railHeightVh", "number", "70"],
];

export default function RaftMoorDemo() {
  const [step, setStep] = useState(0);
  const [collaborators, setCollaborators] = useState<RaftMoorCollaborator[]>(() => collaboratorsAt(0));

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => {
        const next = s + 1;
        setCollaborators(collaboratorsAt(next));
        return next;
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* demo-only: 5s instead of the 60s production default, so Aiko's
          parked chip visibly eases to 50% opacity while watching the preview */}
      <RaftMoor collaborators={collaborators} idleThresholdMs={5000} />

      <main className="mx-auto max-w-2xl px-6 pb-48 pt-20">
        <p className="font-mono text-xs text-ns-muted">ns-ui / raft-moor</p>

        <section id="intro" className="flex min-h-[85vh] flex-col justify-start pt-10">
          <h1 className="text-4xl font-semibold tracking-tight">Raft Moor</h1>
          <p className="mt-6 max-w-prose leading-relaxed text-ns-muted">
            A presence rail down the left edge. Four teammates are reading this
            document right now — each one a small initialed chip riding at their
            live scroll position. Watch the rail: when two of them land on the
            same stretch, the later arrival moors alongside instead of hiding
            behind the first.
          </p>
          <p className="mt-4 max-w-prose leading-relaxed text-ns-muted">
            Sam, Mara and Jonas drift between sections every few seconds. Aiko
            stays parked on the FAQ and fades to half-opacity once idle. Click
            any chip to jump straight to that person&apos;s section — focus
            follows you there.
          </p>
        </section>

        <section
          id="install"
          className="flex min-h-[80vh] flex-col justify-start border-t border-border pt-12"
        >
          <h2 className="text-2xl font-semibold tracking-tight">Install</h2>
          <p className="mt-4 max-w-prose leading-relaxed text-ns-muted">
            Zero dependencies beyond React. Position and rafting are plain DOM
            math — a per-chip spring and a clustering pass, no canvas, no SVG.
          </p>
          <pre className="mt-6 overflow-x-auto rounded-md border border-border bg-background p-4 font-mono text-xs leading-relaxed text-ns-muted">
            {"npx shadcn add @ns-ui/raft-moor"}
          </pre>
        </section>

        <section
          id="api"
          className="flex min-h-[80vh] flex-col justify-start border-t border-border pt-12"
        >
          <h2 className="text-2xl font-semibold tracking-tight">API</h2>
          <p className="mt-4 max-w-prose leading-relaxed text-ns-muted">
            <span className="font-mono text-xs text-foreground">fraction</span> is
            the governing scalar — 0..1 through the document — and sets a chip&apos;s
            y directly. Chips within 24px of each other raft: earliest arrival
            stays flush to the rail, everyone later moors one chip-width further
            out.
          </p>
          <div className="mt-6 overflow-hidden rounded-md border border-border">
            {PROPS.map(([name, type, def], i) => (
              <div
                key={name}
                className={`grid grid-cols-3 gap-4 px-4 py-3 font-mono text-xs ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="text-foreground">{name}</span>
                <span className="text-ns-muted">{type}</span>
                <span className="text-ns-muted">{def}</span>
              </div>
            ))}
          </div>
        </section>

        <section
          id="examples"
          className="flex min-h-[80vh] flex-col justify-start border-t border-border pt-12"
        >
          <h2 className="text-2xl font-semibold tracking-tight">Examples</h2>
          <p className="mt-4 max-w-prose leading-relaxed text-ns-muted">
            Feed it whatever a presence channel gives you — id, name, current
            scroll fraction, and the nearest section:
          </p>
          <pre className="mt-6 overflow-x-auto rounded-md border border-border bg-background p-4 font-mono text-xs leading-relaxed text-ns-muted">
            {`<RaftMoor
  collaborators={[
    { id: "sam", name: "Sam Okafor", fraction: 0.5,
      sectionId: "api", sectionLabel: "API" },
  ]}
/>`}
          </pre>
          <p className="mt-4 max-w-prose leading-relaxed text-ns-muted">
            Every chip is a real button — tab to one and its position is
            announced through its accessible name, never streamed live.
          </p>
        </section>

        <section
          id="faq"
          className="flex min-h-[70vh] flex-col justify-start border-t border-border pt-12"
        >
          <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
          <p className="mt-4 max-w-prose leading-relaxed text-ns-muted">
            <span className="font-mono text-xs text-foreground">Why not a
            &quot;+N&quot; badge on overlap?</span> Co-location is the interesting
            moment — two people on the same paragraph is exactly when you want
            both names, not a count. Rafting keeps every identity legible
            instead of collapsing the signal that made it worth showing.
          </p>
          <p className="mt-4 max-w-prose leading-relaxed text-ns-muted">
            Under reduced motion, chips reposition instantly with no spring —
            only the idle-opacity fade keeps its ease, since that&apos;s not
            spatial motion.
          </p>
        </section>
      </main>
    </div>
  );
}
