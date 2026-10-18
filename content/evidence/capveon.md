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
  real-product-surface: absent
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

**v4 change 3b surface re-pass**

Decided first: `real-product-surface` absent (confirmed, no flip). `shows-deliverable`
present (confirmed, no flip).

Capture, 2026-10-16: 16 tiles at 1440x900, window scroller, `clamped: false`,
`coverage: 1`, docH 10869 before and after the walk, stitched to three strips of
4400 + 4200 + 2269 = 10869px. The last strip ends in the footer ("© 2026 Capveon,
Inc.", hello@capveon.ai, LinkedIn). The full-bleed band photographs under Connects and
Understands show partly repeated imagery in the stitch (layered backgrounds); heights
agree and the panel below renders once and intact. No `<video>`, no large `<svg>`, no
`<canvas>` on the page; the one empty-src `<iframe>` (y≈4538) is not a product surface.
Exact text below is a Playwright DOM read, not pixels.

Candidate product surfaces. There is one. The "What a morning looks like." section
(heading y=7455, over the Red Bluff Diversion Dam photograph from y=7110) carries a
DOM panel at x=744, y=7290 to 7839, w=648: a `<div class="extract glass">`
(`rgba(18, 22, 28, 0.34)` fill, `backdrop-filter: blur(28px) saturate(1.7)`, 1px
white-20% border, 20px radius) holding a title, a subtitle and a two-column `<dl>`.
There is no `<table>` on the page. Its text, exactly:

    Proposed writes, awaiting approval
    This morning's queue.
    Create job            Bid 26-041 awarded per email from owner. Create job in ERP from estimate.
    Update opportunity    Move to Closed Won in the CRM. Amount $3.8M matches signed contract.
    Merge accounts        'County Utilities' and 'County Util. Dept.' are one customer in both systems.
    Update contact        Project manager changed per transmittal letter.
    Flag                  ERP customer credit limit below contract value. Needs a person.
    Four approved in one click each. One escalated.

Row y: Create job 7417, Update opportunity 7490, Merge accounts 7563, Update contact
7636, Flag 7684; closing note 7777. Everything else on the page is credited
photography, a row of seven integration logos (y≈4638) and a line-icon list.

Faithfulness check. The real app is not reachable: `Log in` goes to app.capveon.ai,
which redirects to a Clerk sign-in at accounts.capveon.ai behind a Cloudflare
challenge (HTTP 403 to a scripted fetch), so there is no app bundle or chrome to
compare. The YC profile has `app_video_url: null`, `dday_video_url: null`, no videos
and no company photos. No subpage pictures the app either: /how-it-works, /security,
/capabilities and /about carry photographs only. What the subpages do show is that
`.extract.glass` is the site's own marketing component, reused with different
content: the same queue verbatim on /use-cases/crm-erp-automation, "Water
Reclamation Facility Expansion / One record, assembled from six systems." on
/solutions/contractors, and "Compliance matrix, treatment plant improvements RFP /
214 requirements found, 6 flagged for a person." on /use-cases/bid-document-review.
None of the instances contains a button or input. /security describes the real
surface as "a queue that shows the evidence", and the subhead beside the panel says
the writes are "waiting for one click each", yet the panel has nothing to click: no
approve or reject control, no row state, no app navigation.

Q1 verdict: absent. The panel is a page-authored rendering of the queue's output in
the marketing site's glass card, the same card the site uses for unrelated
illustrations, with none of the controls the page says the queue has. That is the
browserbase-com case (page-authored output panels, the real console nowhere), not
financial-datasets (live DOM rebuild with real controls) or papaya (verbatim app
components). The one residual: the app is gated, so this card cannot be compared to
the real queue directly; the missing click target the page itself promises is what
decides it.

Q2. The entry that could embarrass the vendor is the closing note at y=7777, "Four
approved in one click each. One escalated.", read with the Flag row at y=7684, "ERP
customer credit limit below contract value. Needs a person." The subhead beside the
panel at y=7616 claims the updates are "waiting for one click each"; the panel's own
tally says one of five was not, and that the product handed it to a person instead of
proposing a write. The page would benefit from leaving the one-click claim at five
for five, and the panel narrows it to four. This is not the approval gate repeated as
a selling point: approval applies to all five rows, and the escalation is the
exception to it. Counter-reading, recorded: flagging is pitched as a feature
elsewhere ("with the ones that are slipping flagged first" in the Account
intelligence row; "6 flagged for a person" on the bid-review subpage), and catching a
credit-limit gap flatters the product. The count still stands against the page's own
one-click line 160px above it, so it qualifies. The other rows are all wins ("Amount
$3.8M matches signed contract", the account merge), and "Read-only first." in the
Connects band is a limit sold as a feature, so neither counts. Searched: the panel,
all band copy, the eight-row use-case list, the closing CTA.

Q2 verdict: present. Part A is met by the escalation; Part B is met because a
page-authored rendering of the product's output counts and this one is readable and
specific.

Drift from earlier prose. The v1 paragraph no longer matches the page and was wrong
in form: it is not a "four-column table" but a two-column `<dl>` in a glass card;
"Bid 24-109" now reads "Bid 26-041"; "Update specification" now reads "Update
opportunity"; the "Merge accounts" and "Update contact" rows are missing from it;
"Needs a review" now reads "Needs a person."; "Four approvals in one click each." now
reads "Four approved in one click each. One escalated." The v3 quotation ("Four
approved in one click each. One escalated." and "Needs a person.") matches the live
page exactly and is the settled text. Elsewhere: Understands and Works are no longer
"on black" but over credited photographs ("Water released from Shasta Dam, 2017.
Bureau of Reclamation." and "Meadow Lake substation at dusk, White County, Indiana.
CC BY 2.0, Patrick Finnegan."), and not every frame is CC0: credits now include
"CC BY 2.0, dbking", "CC BY 4.0, Jon Mallard" and Bureau of Reclamation lines. Page
height is unchanged at 10869px.
