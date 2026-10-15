---
source: https://stripe.com
kind: site
cohort: agent-tools
verdict: mixed
studied: 2026-10-11
context: [hero, nav, features, testimonials, cta, footer]
signals:
  gradient-blob: present
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: absent
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
materials: [single-theme, illustration, commissioned-photo, webgl]
---
Captured at 1440x900; full page 14631px. The cohort treats this page as the
reference, and on the ornament signals it is the one site here that fails them
all. That is the finding, and it survives measurement.

**The hero field is the densest chromatic object in the cohort.** 29.4% of
viewport pixels are saturated above 0.18, and they are not one hue: binned into
twelve 30-degree buckets, six buckets clear 1.7% of the frame — orange 5.81,
amber 4.87, blue 4.97, violet 3.68, magenta 1.72, pink 5.81. The source is a
1392x975 `wave-fallback-desktop-1x.webp` positioned at y=-107, bleeding off the
top edge and occupying roughly the right 45% of the frame. Compare Linear, which
spends its entire luminance budget on one 73x27px pill: Stripe spends roughly
400,000px² on a six-hue ribbon that sells nothing and labels nothing.

It is not only the image. Five CSS radial-gradients paint circles of
`rgb(127, 125, 252)` violet to `rgb(244, 75, 204)` magenta to `rgb(229, 237, 245)`
at 753x753, 647x647 and three at 552x552, plus three more radials at 713x426
amber, 698x415 magenta and 683x439 indigo. Six discrete soft-edged ornamental
fields below the fold, each larger than a laptop viewport.

**The logo wall keeps every customer's brand colour.** Eighteen marks at
y=724 — Amazon's orange smile, Google's four-colour wordmark, Decathlon blue,
Nvidia green, Lovable's gradient mark, Booking.com blue — marqueed twice. Every
other site in this cohort that shows customer logos reduces them to one ink.
Stripe does not, and there is a second brand-colour grid further down: thirteen
platform marks (Shopify green, HubSpot orange, Woo purple, Wix, Framer, Webflow)
inside the middle integration panel. So the page carries three independent
chromatic systems — the wave, the gradient circles, and two logo walls — before
its own accent is counted.

**The accent itself is clean, and that is the surprise.** The primary CTA
measures `background-color: rgb(83, 58, 253)`, `background-image: none`, 4px
radius. A flat indigo fill, no gradient. `indigo-violet-accent` is present and
`gradient-fill-cta` is absent, which is exactly the split v3 forced: the
archetypal AI hue ships here as a flat fill and would have gone unrecorded under
the v1 signal. The three hero stat figures (`500m+`, `10k+`, `150k+`) are the one
place gradient reaches type, via `background-clip:text` runs of
`rgba(83,58,253)` to `rgba(255,140,108)` to `rgba(218,75,254)`.

What the page does instead of the template, and does well:

**One typeface, five sizes, almost no centering.** Söhne (`sohne-var`) sets
everything from the 48px headline to the 10px chrome inside captured product
panels. One of twenty-six headings on the page is centered — "The backbone of
global commerce" at 56px, which is also the only section that abandons the left
margin. The headline sets left at x=208 at 48px weight 300 on 55.2px leading,
against a 16px body: a 3.0:1 display-to-body ratio, the lowest in this cohort and
below Vercel's 3.9 and Resend's 5.9, so `type-scale-high-contrast` is absent. The
light weight pushes it lower still. Stripe is not a big-type page; it is a
dense-paragraph page, and the headline is a four-line sentence rather than a
slogan.

**A column rule nothing breaks.** A 1px vertical hairline runs the full 14631px
at x=88 and x=1352. Every section, every full-bleed colour field, every captured
panel starts and stops on it. That is why `editorial-grid-break` is absent — not
from timidity but because the grid is declared as a visible line and then obeyed,
which is a different and rarer discipline.

**Product capture with real numbers.** The Zenflow Connected Accounts table lists
ten studios with distinct per-account balances and volumes (Vital Flow
EUR 7,513.00 / EUR 64,406.68; Harmony Flow EUR 27,840.00 / EUR 265,202.69) rather
than lorem rows. A terminal panel shows `$ node server.js && stripe listen` with
an autocomplete menu open on `applePayDomains`. Checkout panels run in four
locales at once — English, German, Japanese, with matching currency and tax
lines — which is the claim ("accept payments globally") rendered as the thing
itself. That text is byte-identical across a 4.5s window, so the locales are a
static row, not a timer: `typewriter-headline` is absent. The only moving text is
a live GDP counter in the eyebrow, ticking 1.73040187% to 1.73040191%.

**Where the three-card row actually is.** Not in the feature sections — those are
plain text columns at x=128/544/960, 284px each, no fill, no border, no icon. It
is at y≈10835: "Choose an integration path" over three 399px filled rounded navy
panels with ~17px gutters, each a media box above a bold lead-in, two lines of
body, and a blue link. Fill, radius, equal width, equal weight, three of them.
Present.

**Social proof is one quote, not a triplet.** A centered pull-quote with
attribution over a four-logo tab strip (mindbody / Jobber / substack /
lightspeed), the active tab carrying an indigo underline, so clicking swaps the
quote. Three equal quote cards never appear; `testimonial-card-row` is absent.

`scroll-reveal-blank` is present on measurement, not impression. With nav, menu
and dialog subtrees excluded, 2285 characters of the page's own marketing prose —
32% of it — render at under 8% effective opacity at rest, including stat captions
("currencies and payment methods supported") and section leads ("Grow your
business with the most compreh…"). A full scroll walk also mounts 4369 characters
that were not in the DOM at load, taking innerText from 11981 to 16350. Separately
worth recording because the vocabulary has no name for it: with JavaScript off the
page still yields 10661 characters, 89% of its JS text — the best no-JS survival
of the three light-field sites here.

`single-optical-anchor` is absent and the mechanism is worth stating, because it
is the inverse of Linear's. Three masses compete in the first viewport: a 48px
headline at left, a six-hue ribbon at right, and eighteen full-colour logos across
the bottom. No one of them wins, so the eye has to choose, and the indigo CTA —
the only thing on the page that is a decision — is the smallest of the four.

`stock-photo-generic` is absent on both halves of the definition: the one
photograph is Stripe's own Sessions keynote, and no scrim is bolted over type to
rescue it. `glass-card-overuse` is absent at two blurred surfaces, one of which
is the cookie banner. Zero emoji, zero decorative pills above the fold, zero
`prefers-color-scheme` rules and zero dark hooks — a light-native single theme,
confirmed by a dark-scheme render that differs from the light one by 0.0% of
sampled pixels.
