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

**v4 hole-7 deliverable re-pass**

Capture: reused the s5 walk, 21 tiles, `clamped: false`, `coverage: 1`,
docH_before 14613 = docH_after 14613 (no drift), stitched to 4 strips totalling
14613px. The last strip ends in the footer (`© 2026 Stripe, LLC.` under a
`Greece (English)` locale link). A cookie banner repeats at the right edge of
every tile; the DOM read below recovers everything it overlaps. Exact values are
from a Playwright read of every `*graphic*` container after a full wheel walk
(docH 14613), including text in animation states the walker froze.

Value: `absent`, confirmed. Entry that could have embarrassed the vendor: none.

Candidates weighed, in both places (inside product captures and on the page's
own canvas):

- y≈1023, payments bento (captured terminal and checkout chrome). Hidden locale
  states cycle `Pay Roastery US$5.46`, `Cartsy bezahlen €26.89`,
  `Showflix に支払う JP¥5,000`, each ending `Continue` / `Weiter` / `続行`. No
  decline, failed card or error in any state.
- y≈1061, billing bento: `Pro Plan`, `Tokens €0.01 per 1,000 units`, `Tokens
  used in the last 30 days` on a ticking counter (1,789,527,402 in the strip,
  2,010,569,010 in the DOM read). Nothing against the vendor.
- y≈1713, agentic-commerce chat: one request answered with two products and
  `Buy now`. Every turn succeeds. The issuing card and the stablecoin globe
  (`$100.00 USDC`) beside it carry no readable output beyond a card face and one
  amount.
- y≈2409, Connect bento: the Zenflow `Connected Accounts` table (ten studios,
  e.g. `Vital Flow` €7,513.00 / €64,406.68) plus three rotating receipts, each
  "Thank you! Your payment was successful." (`A$72.00`, `£22.00`, `US$999.00`).
  Every receipt is the success state.
- y≈3975, stats: `135+`, `US$1.9tn`, `99.999%` historical uptime, `200m+`.
  Vendor aggregates; the uptime figure is the top of a bounded range (the
  modal-com 94% case). The hero eyebrow `Global GDP running on Stripe:
  1.73322277%` and the dark band's `500m+` / `10k+` / `150k+` are odometers of
  the same kind.
- y≈7749-8481, platform panel, a page-authored Zenflow dashboard and the
  strongest candidate. Nine payment rows: seven `Succeeded`, plus
  `€14.99 Disputed Visa ••••4010 Single class` (y=8220) and
  `€14.99 Refunded Google Pay ••••1224 Single class` (y=8336), under an
  `Action required` banner (y=7924): "To make sure your business is
  supportable, we need to collect additional information." A second animation
  state swaps the banner for "Your information is in review".
- y≈10855, integration-path panels: a payment-link chat (`Pure glow cream
  €17.99`, `Scan to pay`), the integration logo grid, and a terminal ending
  `> Ready! Waiting for requests...`. No error line.

Why the platform panel does not pass. The Disputed row, the Refunded row and
the Action required banner are each the capability the panel sells, and the
panel labels them so with its own floating callouts: "Show a list of payments
with export, refund, and dispute capabilities." (y=8172) and "Show a banner
listing required actions for risk and onboarding." (y=7854). That is the "limit
the page sells, repeated as a feature" exclusion. None of them is Stripe failing
at its job: a dispute is a cardholder contesting a payment Stripe processed, a
refund is a merchant action, and the onboarding banner is a requirement Stripe
imposes and markets. No row narrows a claim the page would rather leave broad.
The analogue of browserbase's missing `Failed` would be a `Failed` or
`Declined` payment against "Accept and optimise payments", and no state of any
panel shows one. A DOM text search for
fail/declin/disput/refund/error/block/incomplete/overdue/cancel/retry/fraud/
chargeback/reject/pending/limit (nav, header, footer and dialogs excluded) hits
only those rows, their callouts, the success receipts, and the "Manage platform
risk." body copy under the panel. The footer link `Prohibited and restricted
businesses` is navigation, not an artefact.

Verdict: absent. On Part B the medium is fine: every panel is readable product
output, captured or page-authored. On Part A every entry is either the
flattering value or the sold feature, so it fails on stance, not on medium.

Studied-page check: unchanged, minor drift. docH 14613 against the prose's
14631 (-18px). Everything the prose describes is present in order: the Zenflow
Connected Accounts values match exactly (`Harmony Flow` €27,840.00 /
€265,202.69), the English/German/Japanese checkout panels, the integration-path
row at y≈10855 (prose y≈10835), the mindbody / Jobber / substack / lightspeed
quote tabs, and `500m+` / `10k+` / `150k+`. Live counters (GDP eyebrow, usage
meter) differ, as expected. The platform panel is not described in the original
prose, but height and section order show no redesign, and since the value does
not change its dating is moot.
