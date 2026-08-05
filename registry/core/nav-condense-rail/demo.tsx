"use client";

import { NavCondenseRail } from "./component";

// A tall page with real section content underneath the fixed bar. No scripted
// auto-scroll here — this route is the honest reference, fully interactive,
// zero synthetic input (see AGENTS.md). The autoplay "scroll" descriptor in
// meta.json is what animates the homepage card; scrolling by hand is what
// demonstrates it here.
const SECTIONS = [
  {
    id: "work",
    title: "Selected work",
    body: "Case studies, shipped product, the occasional postmortem. Scroll to watch the bar above tighten from roomy to a dense pinned rail — the transition length is measured from its own height, not a guessed pixel value.",
  },
  {
    id: "process",
    title: "Process",
    body: "Discovery, prototyping, build, handoff. Four sections, no filler beyond what makes the page tall enough to scroll through the condense.",
  },
  {
    id: "pricing",
    title: "Pricing",
    body: "Flat project rate, no retainer required. Scroll back up and the bar reopens to its roomy resting state at exactly the same measured distance.",
  },
  {
    id: "contact",
    title: "Contact",
    body: "One inbox, no ticket system. Reply time is measured in hours, not days.",
  },
];

export default function NavCondenseRailDemo() {
  return (
    <div id="top" className="min-h-screen">
      <NavCondenseRail />

      <div className="mx-auto flex max-w-3xl flex-col gap-24 px-6 pb-32 pt-40">
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
            ns-ui / nav-condense-rail
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            A site nav that condenses on measurement, not on a magic number
          </h1>
          <p className="max-w-xl leading-relaxed text-ns-muted">
            The distance this bar takes to go from roomy to dense is read off its own
            rendered height at each extreme — shrink the wordmark, change the font, resize
            the window, and the transition still ends exactly where the bar itself stops
            shrinking.
          </p>
        </div>

        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="flex flex-col gap-3 border-t border-border pt-8">
            <h2 className="text-xl font-medium text-foreground">{s.title}</h2>
            <p className="max-w-xl leading-relaxed text-ns-muted">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
