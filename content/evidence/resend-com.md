---
source: https://resend.com
kind: site
cohort: agent-tools
context: [hero, nav, features, testimonials, cta, footer]
verdict: mixed
studied: 2026-10-10
signals:
  centered-hero-stack: absent
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  purple-blue-gradient-cta: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  hero-mockup-float: absent
  feature-icons-identical: absent
  testimonial-card-triplet: absent
  dark-mode-afterthought: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: present
  motion-tied-to-input: unresolved
  real-product-screenshot: present
  density-variation: present
  one-accent-discipline: absent
---
Captured at 1440x900; full page 12319px.

The hero is the best type in the cohort and the page below it is where the slop
lives, which is why this is recorded as mixed rather than exemplar.

Hero type: "Email for developers" set in **Domaine** (a licensed display serif,
self-hosted as domaine_regular/medium/bold) at roughly 94px cap-derived on 97px
leading, left-aligned at x=168, against an **ABC Favorit** sans subhead at 16px on
27px leading. That is a 5.9:1 display-to-body ratio — the highest measured in this
cohort — and a genuine two-family pairing visible in one viewport, with a third
licensed face (Commit Mono) carrying code. A high-contrast serif at 94px on near-black
is doing something none of the grotesque-only sites here can do: the thin strokes of
the Domaine "E" and "l" drop to near-invisibility against #020202, so the headline
reads as modulated rather than as a solid block.

The field is flat. Nine samples away from the hero object hold between #000000 and
#020202; the only departure is #0e0e0e immediately adjacent to the rendered object at
(1380,150), which is its lighting falloff rather than a painted field. So despite 258
linear-gradient and 8 radial-gradient declarations in source, no gradient blob backs
the hero.

The hero's right half is a rendered sculptural object — a cube of cubes, near-black
on near-black, with faces differentiated only by material finish (matte, speckled,
glossy). No interface is pictured, so hero-mockup-float is absent, and because the
object is darker than the headline the single optical anchor is unambiguously the
type.

Where it fails, and the failures are worth more than the successes here:

**Gradient text.** The section heading "Integrate this weekend" sets the phrase "this
weekend" in a left-to-right gradient fill measured at #bb79f0 violet, #8b9eec
periwinkle, #73a9eb blue, #6ca9ca, #76b3bf teal. A violet-to-teal gradient on
display type is among the most machine-generated devices in circulation, and it is
here on a site the cohort copies. It is not scored under purple-blue-gradient-cta
because the gradient is on a heading and on the hero badge's 1px border (#4a1b64 at
its left end), not on a button — the primary CTA is an achromatic #151514 pill. See
the proposed-signal note below; the vocabulary cannot currently name this.

**Accent sprawl.** Three unrelated hues carry meaning on one page: violet-to-teal on
the heading and badge border, green on the status dot and the selected tab's
underline, and a cyan ring on one of the 3D icons. one-accent-discipline is absent.

**Four centered section stacks.** The hero is left-aligned, but "Integrate this
weekend", "Write using a delightful editor", "Develop emails using React" and
"Everything in your control" are each a glossy 3D icon render, centered, above a
centered heading, above centered two-line body copy. That is the generated section
template four times. centered-hero-stack stays absent because the signal names the
hero and the hero does not do it — which is a limitation of the signal, not a credit
to the page.

**An empty panel in production.** "Everything in your control" presents three equal
bordered boxes at 390px with ~37px gaps, each a 24px rounded-square icon chip plus a
label (Intuitive analytics / Full visibility / Domain authentication), the first
underlined green as selected. It is a tab selector, and the 1230px-wide bordered
panel beneath it renders completely empty in the capture. three-card-row is scored
absent because this is a three-item tab bar rather than three parallel feature
pitches, and the page's actual feature rows are **two** cards, not three — but the
distinction is one the vocabulary cannot currently express.

What to copy besides the hero type. Testimonials deliberately break the viewport:
quote cards run as a horizontal carousel that bleeds past both edges, with the
leftmost and rightmost cards cut mid-sentence, so the row reads as continuing rather
than as a complete set of three. Card heights vary with quote length instead of being
equalised. Attribution is an overlapping pair of circles — company mark behind,
person's photograph in front — then name and role at 13px. That overlap is a neat
solve for "whose logo, whose face" in one 40px slot.

Real product capture throughout and unusually honest: an email composer with real
From/To/Subject fields, a React email template with the code on the left and its
rendered output on the right, an HTTP log panel showing real 200 responses with
message ids, delivery/bounced/complained status chips with actual timestamps. The
logo wall is 13 customer marks in two centered rows, monochrome.

Single theme, dark-native. A prefers-color-scheme dark capture differs by 6.7% of
pixels with both fields at #020202 — that delta is animated content between the two
captures, not a theme, so there is no dark variant to be an afterthought.
