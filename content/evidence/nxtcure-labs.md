---
source: https://nxtcure.com
kind: site
cohort: yc-current
context: [hero, nav, footer]
verdict: mixed
studied: 2026-10-10
materials: [dual-theme]
signals:
  gradient-blob: present
  three-card-row: unresolved
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: unresolved
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: present
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: present
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: unresolved
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
AI-driven CRO running clinical trials, YC F26. The archetypal indigo-violet AI site,
with one thing on it that almost nothing else in this pass has: a second theme that
was actually built.

Hero is a left/right split, text at roughly 48% and a product card at 40%, with the
card lower than the headline's cap line rather than centred against it. The headline
is mid-animation in both captures ("tumor analysis|" in one, "site act|" in the
other) with a solid indigo block cursor and the animated phrase set in indigo
against black for the fixed part, so the third line cycles through the work the
agents do. A soft lilac radial wash sits behind the upper left of the hero, and a
second lavender band gradient appears mid-page.

The accent is a single flat indigo-violet, held across the CTA pill, the typewriter
phrase, the three checklist marks and the product card's row icons. Sampled down the
CTA pill it holds flat at #8b85ff, so gradient-fill-cta is absent; the hue itself is
the single most recognisable palette choice of this cohort and is what
indigo-violet-accent exists to record. v1, naming only the gradient, missed it.

Copy is the strongest part and argues a mechanism rather than a benefit: "thirteen
purpose-built agents run a study end to end in lifecycle order, and every action
with clinical, safety, regulatory or financial consequence stops in one review queue
until a qualified human approves it", then three checks including "One human review
queue. There is no second path." A compliance line under the CTA cites "the FDA and
EMA January 2026 guiding principles for AI in drug development".

The hero card lists five pipeline stages (Feasibility, Site activation, Monitoring,
Safety, Biostatistics) each with a status chip (Done / Review / Running), specific
readouts ("Contract aging 41 d against the 77 d benchmark", "Site 12 KRI 0.74",
"Serious AE, grade 3 · to safety physician, critical") and a footer strip reading
"13 agents · 2 awaiting human review · 0 silent failures". Whether that is the
product or a designed representation of it cannot be settled from a screenshot, so
real-product-screenshot is unresolved rather than guessed.

`materials: dual-theme` is recorded on evidence, not assumption. The nav
carries a theme toggle and the site answers prefers-color-scheme: the dark render
swaps the moon glyph for a sun, re-grounds the page in deep indigo-black, re-skins
the product card to a dark surface with lighter hairline borders, inverts text and
keeps the status chips and the indigo accent legible. Nothing is washed out and no
surface is left at its light value.

Below the hero the full-page capture is empty until the footer: the mid-page bands
are scroll-triggered and never fired — scroll-reveal-blank present — so three-card-row
and testimonial-card-row stay unresolved. The nav names seven sections the capture
cannot reach (Human checkpoint, Agents, Platform, Cancer App, AI Hospital Guide,
Founders, Advisors).

**Scroll walker confirms the gate.** A full-document scroll walk paints every band
the static capture left blank: the YC / Harvard / MIT credit card, a five-mark
partner wall, "Reviewed by Board of Oncologists" over a four-row review queue with
Reject/Approve controls, "Thirteen agents, in the order a trial unfolds", a four-card
"One orchestration layer" row, and the closing CTA. `scroll-reveal-blank` is present
on evidence, not inference.

That walk also puts three of this file's `unresolved` calls within reach of being
settled — the pillar row is a four-up rather than a `three-card-row`, the page
carries no quote cards at all, and the revealed panels are the same designed-card
idiom as the hero rather than captures of a shipping UI. Left `unresolved` here
because re-rating them is outside this migration, but they are no longer unsettleable.
