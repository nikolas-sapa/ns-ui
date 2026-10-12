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
  real-product-screenshot: present
  artifact-not-dashboard: absent
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
