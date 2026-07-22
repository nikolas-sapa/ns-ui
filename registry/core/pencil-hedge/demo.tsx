"use client";

import { useState } from "react";
import { PencilHedge, type PencilHedgeSegment } from "./component";

// One passage, three doubtful tokens (a date, a measurement, a name — the
// brief's "dates, numbers, names, exactly where hallucination bites"),
// each in a different bucket so all three hatch densities show at once.
// Two switches above demonstrate the opt-in settings: verbose screen-reader
// descriptions, and a superscript dagger on the highest-doubt bucket.

const SEGMENTS: PencilHedgeSegment[] = [
  "According to the shipping manifest, the package left the warehouse on ",
  {
    id: "date",
    text: "March 12",
    bucket: "sparse",
    said: 0.61,
    alternatives: [
      { text: "March 21", prob: 0.24 },
      { text: "March 2", prob: 0.09 },
    ],
  },
  " with a declared weight of ",
  {
    id: "weight",
    text: "42.6 kg",
    bucket: "medium",
    said: 0.52,
    alternatives: [
      { text: "41.8 kg", prob: 0.33 },
      { text: "44.0 kg", prob: 0.11 },
    ],
  },
  ", and was signed for on receipt by ",
  {
    id: "name",
    text: "Dana Whitfield",
    bucket: "cross-hatch",
    said: 0.38,
    alternatives: [
      { text: "Dana Whitmore", prob: 0.31 },
      { text: "Dana Winfield", prob: 0.19 },
    ],
  },
  ".",
];

function SettingSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 rounded-sm text-xs text-muted transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span
        aria-hidden
        className={[
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors duration-150 ease-out",
          checked ? "border-accent bg-accent" : "border-border bg-background",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-2.5 w-2.5 rounded-full bg-background transition-transform duration-150 ease-out",
            checked ? "translate-x-3.5" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
      {label}
    </button>
  );
}

export default function PencilHedgeDemo() {
  const [verbose, setVerbose] = useState(false);
  const [dagger, setDagger] = useState(true);

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-md border border-border bg-background p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Generated reply · per-token confidence
        </p>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Shipment confirmation
        </h2>

        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border pb-4">
          <SettingSwitch label="Verbose descriptions" checked={verbose} onChange={setVerbose} />
          <SettingSwitch label="Mark highest doubt with †" checked={dagger} onChange={setDagger} />
        </div>

        <p className="text-sm leading-relaxed text-foreground">
          <PencilHedge segments={SEGMENTS} verbose={verbose} daggerOnHighestDoubt={dagger} />
        </p>

        <p className="mt-5 text-xs leading-relaxed text-muted">
          Hover or focus a hatched word to see what the model almost said instead. Selecting an
          alternative rewrites the word in place and clears its marks.
        </p>
      </div>
    </div>
  );
}
