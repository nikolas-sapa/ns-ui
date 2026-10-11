---
source: https://www.databuddy.cc
kind: site
cohort: yc-current
context: [hero, nav, pricing, features, testimonials, cta, footer]
verdict: mixed
studied: 2026-10-10
signals:
  centered-hero-stack: absent
  gradient-blob: present
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  purple-blue-gradient-cta: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  hero-mockup-float: present
  feature-icons-identical: present
  testimonial-card-triplet: absent
  dark-mode-afterthought: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  motion-tied-to-input: unresolved
  real-product-screenshot: present
  density-variation: present
  one-accent-discipline: absent
---
Product analytics tool, YC F26. Dark site, hero text left at roughly half measure,
headline split across two weights so the second line ("without a data team.") drops
to a mid grey.

The gradient is the loudest thing on the page and it is not behind the headline: a
large soft bloom runs orange to magenta to violet across the top right corner,
bleeding under a pixel-art rabbit silhouette. The same gradient returns in the
footer CTA as a mountain-range silhouette. Two instances, one of them 8000px down
the page, so the site is paying the cost of the blob twice.

Below the hero a dashboard screenshot sits on the gradient with a separate insight
popover layered over its right edge, partly occluding the KPI row behind it. The
tab strip ("Overview / Events / Errors / Vitals / Funnels") straddles the boundary
between the hero band and the screenshot.

Where the page earns something: the bento band shows a real install snippet with
the actual CDN path and client-id attribute, and a live event log with typed
coloured pills (FLAG, ERROR, VITAL, EVENT, PAGEVIEW), timestamps to the second,
and real right-hand context ("Safari 18", "Chrome · Germany", "25% of users").
That is genuine density against an otherwise sparse page.

Pricing is three equal cards (Free / $9.99 / $49.99). The 3-up feature grid above
it carries one undifferentiated grey line-icon set at uniform size and weight
(panel, shield-check, bolt), each repeating what its heading already says.
Testimonials are not a triplet: roughly a dozen quotes in a masonry wall with real
handles and avatars.

Single theme. The default (prefers-color-scheme: light) capture renders dark, so
there is no second theme to have neglected. Two captures 3.5s apart differ, so
something on the page animates, but nothing in a static frame shows whether any
motion answers to the pointer.
