---
source: https://openhack.com
kind: site
cohort: yc-current
context: [hero, nav, cta]
verdict: slop
studied: 2026-10-10
signals:
  centered-hero-stack: present
  gradient-blob: present
  three-card-row: unresolved
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  purple-blue-gradient-cta: absent
  symmetric-everything: present
  badge-pill-spam: absent
  hero-mockup-float: present
  feature-icons-identical: unresolved
  testimonial-card-triplet: unresolved
  dark-mode-afterthought: absent
  asymmetric-split: absent
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  motion-tied-to-input: unresolved
  real-product-screenshot: present
  density-variation: absent
  one-accent-discipline: present
---
AI security scanning, YC F26. This is the reference rendering of the current
template, and worth filing precisely because nothing about it is distinctive.

The hero is a centre-stacked column on a near-black field: two-line headline with
the second line ("AI Security Engineer.") in gold, three centred lines of body copy
at a narrow measure, then two centred buttons side by side (filled white "Book a
demo", outlined "Get started"). Every element shares one centre axis, including the
dashboard that follows. Nothing sits off-axis anywhere above the fold.

Behind the headline, a soft radial bloom: amber at the top right, a cooler teal
wash at the top left, both fading to black before they reach the copy.

Type is a neo-grotesque at default tracking across the whole hero, headline and
body in the same family and the same weight class. Headline to body is roughly
56px against 16px, which is a conventional ratio rather than a deliberate jump,
and there is no second family anywhere.

The product screenshot is real and is the best thing on the page: an org/project
switcher, a left rail of thirteen named sections, a findings sparkline, a severity
breakdown reading "277 total findings · 34 critical · 84 high", and a recent-scans
list with per-scan timestamps and severity chips. That content is specific. Its
presentation, a flat rounded rectangle floated under a centred hero, is not.

Below the fold is not assessable from a static capture and is marked unresolved
rather than guessed. The full-page render returns almost entirely black: section
borders and isolated controls ("Book a demo", "Get started", a GitHub mark, "All
research") appear at their correct positions with no content between them, so the
sections are scroll-triggered and never fired. Two captures 3.5s apart are
byte-identical, confirming nothing animates on a timer; the page waits for scroll.

Single theme, so there is no neglected second one. One accent, a single gold, used
on the headline's second line and nowhere else. A cookie-preferences panel covers
the lower right of the first viewport on load.
