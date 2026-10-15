---
source: https://capveon.ai
kind: site
cohort: yc-current
context: [hero, nav, features, cta, footer]
verdict: mixed
studied: 2026-10-10
materials: [single-theme, stock-photo]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-screenshot: absent
  shows-deliverable: present
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
Integration layer for construction and heavy industry, YC F26, the batch's only
Government-tagged company. Photography does all the work, and it is stock
photography, credited.

The hero is a full-bleed landscape of the Glen Canyon Dam with a credit line set at
11px along the bottom left: "Glen Canyon Dam and Lake Powell, Page, Arizona. CC0,
Luca Bravo." The headline, four lines of a tight geometric grotesk at roughly 80px,
is placed in the dark water at the left of the frame where the photograph has no
detail, so the type needs no scrim. Body copy sits beneath it and names the actual
systems ("Salesforce, Viewpoint, HeavyBid, Dodge"). Two white pill CTAs sit at the
lower right, off the headline's axis. The nav is a single floating translucent pill
bar over the photograph; it is the only glass surface on the page, so
glass-card-overuse is absent.

Segments are a 2x2 of photographic tiles, edge to edge with no gutter, each labelled
in white at the lower left with one line of copy and a square arrow button at the
top right: Contractors, Manufacturers, Supply chain, Private equity. Real
photographs of a highway interchange, a dam spillway, rail tankers and an orange
excavator, each with its own CC0 credit. Then "Three things Capveon does." resolves
into three full-bleed bands, one word each at the lower left (Connects, over an
aerial of a treatment plant, with a row of named system chips under it; Understands,
on black; Works, on black).

"What a morning looks like." is the product surface: a dark four-column table whose
rows pair an action with its evidence, including a refusal. "Create job / Bid 24-109
awarded per email from owner", "Update specification / Move to Closed Won in CRM.
Amount $3.8M matches signed contract", "Flag / ERP customer credit limit below
contract value. Needs a review", closing on "Four approvals in one click each."

The feature list is where the template shows. "Start with what wastes the most
time." is an eight-row list, each row a hard two-column split (heading left at
roughly 28px, body right at 14px, hairline rule between rows), and each heading
prefixed by one grey line icon from a single undifferentiated set at uniform stroke
and size: a target for Qualify opportunities, stacked layers for Preconstruction
research, an org-tree for Bid and spec review, a document for Specification
intelligence, two figures for Account intelligence. None of them carries
information the heading does not.

No chromatic accent in the chrome at all; white, near-black and the photographs,
which are uniformly warm. Recorded as one-accent-discipline present on the same
reading applied to neomatter, that zero or one accent is the same restraint. Single
theme. 10869px tall, the longest page in this pass, and the full-page capture
renders complete, so nothing here is scroll-gated.
**v3 re-pass.** `real-product-screenshot` moves from present to absent under v3's
scope fix ("the product's UI shown as a real screenshot"): nowhere on this page is
Capveon's own interface pictured. What the v1 rater was scoring is the "What a
morning looks like" panel, and that is the deliverable, not the UI — a two-column
queue of proposed writes against the evidence for each, closing on "Four approved in
one click each. One escalated.", with a refusal ("Flag / ERP customer credit limit
below contract value. Needs a person.") standing in the list. So
`artifact-not-dashboard` is present and the two stay mutually exclusive by
construction rather than by luck.

`stock-photo-generic` is absent on the carve-out v3 names: the photography is
unambiguously stock (every frame carries a CC0 credit line) but the headline is sited
in the dark water at the left of the dam frame where the image has no detail, so no
scrim is bolted over anything. The material fact is recorded as `materials:
stock-photo`; the signal asks a different question and answers no. 10869px render
complete, so `scroll-reveal-blank` is absent.
