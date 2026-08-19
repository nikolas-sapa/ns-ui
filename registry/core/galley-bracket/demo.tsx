"use client";

import { useEffect, useRef, useState } from "react";
import { GalleyBracket, type GalleyBracketSelection } from "./component";

const TEXT =
  "Remote collaborators' selections should read like a proofreader's marks in the margin, not a wash of overlapping color. When two people select the same passage at once, the marks nest outward in the order each person arrived, so the story of who is where stays legible even as more collaborators join the paragraph.";

function span(needle: string): { start: number; end: number } {
  const start = TEXT.indexOf(needle);
  if (start < 0) throw new Error(`demo span not found: ${needle}`);
  return { start, end: start + needle.length };
}

const ANA = span("Remote collaborators' selections");
const BEN = span("selections should read like a proofreader's marks");
const CLEO = span("so the story of who is where stays legible");
const DRE = span("read like a proofreader's marks in the margin, not a wash");

// A short scripted co-editing session: three people already mid-paragraph at
// rest (Ana and Ben overlapping — the nesting the whole component exists to
// show — Cleo elsewhere), then a fourth arrival widens the overlap group, one
// person drag-reselects a few times in a row (debounce absorbs it, no
// announcement flood), and the newest arrival eventually lets go. Loops.
type Step = { selections: GalleyBracketSelection[]; hold: number };

const STEPS: Step[] = [
  {
    selections: [
      { id: "ana", name: "Ana Kader", start: ANA.start, end: ANA.end, arrivedAt: 0 },
      { id: "ben", name: "Ben Ostrowski", start: BEN.start, end: BEN.end, arrivedAt: 1 },
      { id: "cleo", name: "Cleo Iyer", start: CLEO.start, end: CLEO.end, arrivedAt: 2 },
    ],
    hold: 2200,
  },
  {
    selections: [
      { id: "ana", name: "Ana Kader", start: ANA.start, end: ANA.end, arrivedAt: 0 },
      { id: "ben", name: "Ben Ostrowski", start: BEN.start, end: BEN.end, arrivedAt: 1 },
      { id: "cleo", name: "Cleo Iyer", start: CLEO.start, end: CLEO.end, arrivedAt: 2 },
      { id: "dre", name: "Dre Voss", start: DRE.start, end: DRE.end, arrivedAt: 3 },
    ],
    hold: 1800,
  },
  {
    // Dre drags the edge of their own selection — same id, new range. The
    // stroke-dashoffset reveal does not replay for this; only the arrival
    // group's shared underline/bracket geometry shifts.
    selections: [
      { id: "ana", name: "Ana Kader", start: ANA.start, end: ANA.end, arrivedAt: 0 },
      { id: "ben", name: "Ben Ostrowski", start: BEN.start, end: BEN.end, arrivedAt: 1 },
      { id: "cleo", name: "Cleo Iyer", start: CLEO.start, end: CLEO.end, arrivedAt: 2 },
      { id: "dre", name: "Dre Voss", start: DRE.start, end: DRE.end + 24, arrivedAt: 3 },
    ],
    hold: 2600,
  },
  {
    // Dre releases — the group narrows back to three, brackets settle inward.
    selections: [
      { id: "ana", name: "Ana Kader", start: ANA.start, end: ANA.end, arrivedAt: 0 },
      { id: "ben", name: "Ben Ostrowski", start: BEN.start, end: BEN.end, arrivedAt: 1 },
      { id: "cleo", name: "Cleo Iyer", start: CLEO.start, end: CLEO.end, arrivedAt: 2 },
    ],
    hold: 2200,
  },
];

export default function GalleyBracketDemo() {
  const [stepIndex, setStepIndex] = useState(0);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (reducedRef.current) return; // static resting frame only — no scripted arrivals
    const step = STEPS[stepIndex];
    if (!step) return;
    const t = window.setTimeout(() => {
      setStepIndex((i) => (i + 1) % STEPS.length);
    }, step.hold);
    return () => window.clearTimeout(t);
  }, [stepIndex]);

  const current = STEPS[stepIndex] ?? STEPS[0];

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-8 py-24">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / galley-bracket — presence marked at the edges, not painted across the middle
      </p>
      <div className="rounded-md border border-border bg-background p-6">
        <GalleyBracket text={TEXT} selections={current?.selections ?? []} contextLabel="paragraph 1" />
      </div>
      <p className="text-xs leading-relaxed text-ns-muted">
        Each collaborator's range is marked only at its ends and a hairline beneath — overlapping
        ranges nest outward by arrival order instead of blending into a tinted wash. Press a name
        below the paragraph to jump the platform selection to that range.
      </p>
    </div>
  );
}
