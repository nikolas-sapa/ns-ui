---
source: https://neomatter.com
kind: site
cohort: yc-current
context: [hero, nav, features, cta, footer]
verdict: exemplar
studied: 2026-10-10
materials: [single-theme, illustration]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: present
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: present
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
---
In-house legal automation, YC F26. Filed as an exemplar despite a centred hero,
because the centring is the only template move on the page and everything else
works against it.

The hero is one line of a high-contrast display serif at roughly 110px, "The work
is *done* before you open it", with "done" set in a true italic rather than a
slanted roman. Nothing competes with it: no mockup, no badge row, no second CTA.
Body is a geometric sans at 20px. Headline to body is better than 5:1, and the two
families are doing different jobs rather than being one family at two weights.

The integration row under the hero uses the real Gmail, Outlook, Teams and Slack
marks at their own proportions, not a normalised line-icon set.

Below the hero the grid stops being centred. Alternating bands pair a text column
against a product card, and the card is never aligned to the text column: it sits
on a painterly plaster-and-foliage photograph that bleeds to the viewport edge,
with the card straddling the boundary between photograph and page background.
Section numbers run in small caps in the margin ("01 Picks up every request",
"02 Prepares the work", "03 Brings you the decision"). The "See everything" band
drops to a two-up, not a three-up.

The product cards carry argued content, not lorem: a Slack-shaped request thread
with a named sender and a redline reference, an MSA fallback table with "Liability
cap / AI indemnity / Data use" rows and actual clause text, a citation card quoting
"I don't want token improvising on uncapped indemnity for AI generated
recommendations or a SOW cap." A near-black band interrupts the cream for the
security section, then the cream returns for the closing CTA over a Tuscan
landscape.

Palette is cream and near-black with no chromatic accent at all; the photography
carries every colour on the page. Recorded as one-accent-discipline present on the
reading that holding to zero or one accent is the same restraint, which is a call
worth confirming.

Single theme: light-scheme and dark-scheme captures are byte-identical, so the site
ignores prefers-color-scheme rather than shipping a neglected dark mode. Two
captures 3.5s apart are also byte-identical, so nothing animates on a timer and a
static frame cannot settle whether anything answers the pointer.
**v3 re-pass, correcting a material.** The warm plaster-and-foliage and Tuscan-doorway
images are not photographs. At 1:1 they are painted — visible brushwork on the plaster
and the olive leaves, no lens falloff, no grain — and they are described above as
"painterly" for that reason. Recorded as `materials: illustration`, and
`stock-photo-generic` is absent because there is no stock photograph to judge.

The hero product card renders with its interior blurred behind a visible
Active / Waiting / Done tab strip. That is a frosted treatment, not an unfired
section.

**v3 re-pass, scroll walk against a time control.** `scroll-reveal-blank` is
present, and the earlier reading of absent came from judging a static full-page
capture. Walked at 1440x900 in 600px steps, 36 text nodes carrying 1028 characters
cross from under 8% effective opacity to visible — every faded node on the page,
with none left stuck — and a control dwelling the same 15 steps without scrolling
crosses zero, so the gate is the scroll and not the clock. The band at y3140-3380
goes from 16.3% to 30.3% ink with ten rows gained and none lost: at rest the
"Decisions come to you ready" panel shows only its title, and the three options it
asks the reader to choose between render solely after scrolling.

**v4 hole-7 deliverable re-pass**

`shows-deliverable` stays absent. No entry on the page could have embarrassed the
vendor.

Capture: the existing s5 walk was reused (13 tiles, `clamped: false`, coverage 1,
docH 8577 before and after, no drift). Stitched to two strips, 8577px against a
page of 8577px. The last strip ends in the footer (`© 2026 Lightfield, Inc.`).
Hidden content was read off the DOM after a wheel walk, and the launch film was
pulled from its `src` and read as frames every 4s.

The medium is not the problem. Every product card here is a page-authored HTML
rendering of the product's output on a painted backdrop. All of it is readable,
none of it is placeholder, and under Part B all of it is eligible. The page fails
on stance: every value it shows is the flattering one.

Candidates weighed, all on the page's own canvas unless noted:

- Hero card, y836-1283. Active tab: `Northstar expansion — final MSA fallback`,
  `Worked for 6m 18s`, `Northstar wants a $10M liability cap and uncapped
  AI‑output indemnity. The defensible package keeps the fees‑paid cap and
  adds one $2.4M super‑cap.` Then `Decision required` with `Authorize the
  playbook fallback` marked `Recommended`. The Waiting and Done tabs are in the
  DOM but hidden until clicked, y878-1170, and none of them shows the product
  failing. The Waiting items are blocked on people, and the product's own part is
  finished every time: `The rollout can’t be cleared until IT confirms which
  fields are switched off.`, `I drafted the disclosure; Product still owes the
  model documentation.`, `Nothing else is open on our side.` The Done items all
  closed clean: `Both sides have signed.`, `No objection needed; Security
  agreed.` The durations (`6m 18s`, `3m 42s`, `2m 05s`, `5m 51s`, `4m 10s`) can
  only flatter.
- Step 01 card, y2519-2843. Slack request plus `Working on it`: `Read the
  redline` and `Checked your MSA playbook` ticked, `Finding your closest
  precedent` in progress. That is a progress state, not a failure.
- Step 02 card, y3145-3436. `Liability cap  $10M is 8.3× annual fees. Keep the
  fees‑paid cap.`, `AI indemnity  Limit it to third‑party IP claims.`, `Data
  use  Keep security and support uses.`, and a typed reply. It is internally
  consistent: 2× fees is about $2.4M, which matches the hero's super-cap and the
  playbook's Fallback 1. It is still all win.
- Step 03 decision panel, y3805-4059. `Authorize Deal Desk’s final fallback`.
  This is the limit the page sells (`Decisions come to you ready`), so it is the
  "approval before execution" case and does not count.
- Citation card, y4777-4878. `“I don’t want Sales improvising on uncapped
  indemnity for AI‑generated recommendations or a $10M cap.”` It is a source
  the recommendation obeys. Note that the prose above misquotes it as "token
  improvising ... SOW cap". The Oct 10 capture reads exactly as the page does now,
  so that is a misread, not drift.
- Team view, y4771-4942. `Waiting for Product`, `Waiting for Lena Morales`,
  `Decision ready`, `In progress`. This is browserbase's ledger again: states,
  with no `Failed`.
- Playbook card, y5395-5828. `§ 8.1 · Redlined in 11 of 14 deals since January`,
  then Standard, two fallbacks with approvers, and `Walk away  Uncapped general
  liability, or a one‑way cap.` The 11-of-14 figure counts counterparties
  redlining the customer's paper, which argues for the product. The walk-away
  refusal belongs to the customer, not the vendor.
- Integrations panel, y6214-6607. All four rows read `Connected`.
- Security grid, y7053-7253, the nearest miss. `SOC 2 Type I` is stated
  instead of a bare "SOC 2". But it sits in a four-tile icon feature grid. That
  is body copy laid out as tiles, not an artefact, and it is presented as a
  credential (`Audited by a licensed CPA firm.`), not as a concession. It is
  excluded under the in-artefact rule. The Oct 11 walk shows the grid was on
  the studied page.
- Launch film, y1390 (`/launch/neomatter-launch-1080.mp4`, 80.1s), inside a
  captured artefact. It walks the same Northstar matter: `Checked` / `Drafted` /
  `Ready` pills, an `Approve redline` on §12.2, and the same decision with
  `Recommended`. Nothing errs. It also post-dates the study (see below), so it
  could not have moved the value anyway.

Studied-page check: the page has drifted, and the drift does not touch this
signal. Captures from Oct 10, 11 and 12 are 7832px. The page is now 8577px
(+745). The added material is a "One System" band at y≈1390-2035, with eight
integration marks and `Watch the film · 1:20`. The painted backdrops behind
step 01, step 03 and the closing CTA have also been replaced. The CTA is no
longer the Tuscan doorway the prose describes; it now shows papers weighted with
stones on a terrace. Every section the prose describes survives and the hero is
unchanged, so this re-pass rates the studied content. The value is the same on
both versions. The added band is flagged for the orchestrator.
