"use client";

import { ScrollCaliper } from "./component";

const SECTIONS: {
  id: string;
  kicker: string;
  title: string;
  body: string[];
  code?: string;
}[] = [
  {
    id: "cal-principle",
    kicker: "01",
    title: "The measuring principle",
    body: [
      "A vernier caliper does not measure distance so much as it brackets it: two ground blades close on the workpiece until the gap between them is the dimension. The instrument in the margin does the same to this article — the upper jaw rides the active section's leading edge, the lower jaw its trailing edge, and the opening between them is the section's visible extent in pixels.",
      "Scroll slowly and the blades track almost imperceptibly. Flick the wheel and they lag by design: the jaws chase their targets through a near-critically damped spring, the small hesitation that separates an instrument from a cursor.",
    ],
  },
  {
    id: "cal-vernier",
    kicker: "02",
    title: "Reading the vernier",
    body: [
      "The main beam carries a fixed scale — minor graduations every two pixels, majors every eight, a long index line every forty. Against it slides the vernier subscale on the lower jaw, its pitch deliberately mismatched so that exactly one pair of lines coincides at any opening. That coincidence is the fractional digit a plain ruler cannot give you.",
      "Here the coincidence is done for you: the readout chip resolves the jaw opening to a tenth of a pixel and the sweep percentage of the section under measurement. Watch it when you stop scrolling — the needle overshoots and settles with a wobble, a softer spring than the jaws ride.",
    ],
  },
  {
    id: "cal-motion",
    kicker: "03",
    title: "Velocity and blur",
    body: [
      "Move fast enough and any engraved scale smears. The tick layer is duplicated, offset along the scroll direction, and blurred in proportion to smoothed scroll velocity — then removed entirely at rest so the graduations stay razor-crisp for reading.",
    ],
    code: `// motion blur, per frame
opacity = clamp(|v| / 3000, 0, 0.6)
length  = clamp(|v| /  200, 0, 10)  // px
offset  = sign(v) * length

// settle gate — loop sleeps when
idle    = now - lastScroll > 150ms
settled = |x - target| < 0.05 && |v| < 0.05`,
  },
  {
    id: "cal-care",
    kicker: "04",
    title: "Care and calibration",
    body: [
      "A caliper is only as honest as its zero. Close the jaws on nothing and the readout must say nothing: scroll to a section boundary and the blades meet the edges exactly, spring lag bleeding off within a few hundred milliseconds. Keep the beam clean — no decorative ink lives on the scale, and the single accent marker is reserved for the value being read.",
      "Store the instrument closed. When the article stops moving, the loop stops running; an idle caliper spends no frames at all.",
    ],
  },
];

export default function ScrollCaliperDemo() {
  const jump = (id: string) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-muted">
          ns-ui / scroll-caliper
        </p>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <span className="font-mono text-xs tracking-widest text-muted">
              FIELD MANUAL — VERNIER MEASUREMENT
            </span>
            <nav className="flex items-center gap-1.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => jump(s.id)}
                  className="rounded-sm border border-border px-2.5 py-1 font-mono text-[11px] tabular-nums text-muted transition-colors duration-200 hover:border-foreground/20 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {s.kicker}
                </button>
              ))}
            </nav>
          </header>

          <ScrollCaliper className="h-[520px]">
            <article className="space-y-14 px-8 py-10">
              {SECTIONS.map((s) => (
                <section
                  key={s.id}
                  id={s.id}
                  data-section
                  className="scroll-mt-6 space-y-4"
                >
                  <p className="font-mono text-[11px] tracking-widest text-muted">
                    {s.kicker}
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {s.title}
                  </h2>
                  {s.body.map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-muted">
                      {p}
                    </p>
                  ))}
                  {s.code ? (
                    <pre className="overflow-x-auto rounded-sm border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground">
                      {s.code}
                    </pre>
                  ) : null}
                </section>
              ))}
              <p className="border-t border-border pt-6 font-mono text-[11px] text-muted">
                END OF MANUAL — the jaws should now be closed on section 04
              </p>
            </article>
          </ScrollCaliper>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          scroll the article, or jump between sections — stop to catch the
          needle wobble
        </p>
      </div>
    </main>
  );
}
