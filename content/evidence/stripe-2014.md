---
source: https://web.archive.org/web/20150101092245/https://stripe.com/
kind: site
cohort: pre-ai-2015
context: [hero, features, footer]
verdict: mixed
studied: 2026-10-11
materials: [single-theme, illustration]
signals:
  gradient-blob: present
  three-card-row: present
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: absent
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: present
  testimonial-card-row: absent
  indigo-violet-accent: present
  gradient-fill-cta: present
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: present
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
---
Capture year 2014 (Jan 2015 snapshot). The finding that matters: this page
already runs the full slop combination seven years before a model wrote a
line of marketing copy.

A full-bleed multi-hue gradient fills the hero, dark navy at top left
through purple to a warm tan at bottom right. Not a blob behind the
headline but a gradient field under the whole viewport, which is the same
device at larger scale. Hero copy sits left at roughly 36px over 17px body,
a modest ratio. A tablet and a credit card float at right with drop
shadows, clipped by the viewport edge.

Below the fold, three feature cards in a row — Feature-packed payments,
Simple pricing, Natively web & mobile — each under a circular green
line icon drawn from one icon set at one weight. Then a six-logo customer
wall in uniform grey. Carousel arrows at both viewport edges and four dots
at the bottom mean the hero is a rotating slideshow.

Accent discipline fails: a blue CTA, green feature icons, and a multi-hue
background put three unrelated hues on one screen.
**v3 re-pass.** Two of the new signals fire here, and both matter for the eligibility
test rather than for a rule. `indigo-violet-accent` is present: the hero field is
sampled at #1f265b through #9c7974 down its left third, an indigo-to-violet band
under the whole viewport. `gradient-fill-cta` is present and measured: the primary
"Explore the Stripe stack" button runs #50afe5 at its top edge to #168ada at its
bottom, a vertical two-stop fill. That is the 2014 gloss-bevel convention, not the
multi-hue gradient the signal was written against, which is exactly the kind of
pre-AI base rate eligibility test 2 exists to catch.

`typewriter-headline` is unresolved. The hero is a four-slide carousel (arrows at both
viewport edges, four dots beneath), so phrases do cycle on this page, but a still
cannot show whether the headline alone substitutes or the whole slide swaps — and the
signal's definition covers the first while its name describes the second.

**v4 change 3b surface re-pass**

Values decided before this prose: `real-product-surface` flips absent to present;
`shows-deliverable` stays absent.

Capture. `/web/2014/` resolved to snapshot `20150101092245` (1 Jan 2015). Walker: 2
tiles, `clamped: false`, `coverage: 1`, docH 1385 before and after, window scroller,
stitched to one 1440x1385 strip. The strip ends in the footer ("© Stripe", "United
States", "Status Blog About Jobs Contact Privacy & Terms", footer at y1294). The Wayback
toolbar occupies y0-67 and is excluded; all y below are replay-page DOM coordinates.
The strip shows only the default hero slide, so each of the four carousel slides was
driven separately by clicking its dot, and every hero asset was checked against the CDX
index and fetched directly.

The default slide is not the page's natural first slide. The archived `home-*.js` sets
`k=window.environment.isMobile()?0:1` (desktop default = slide 2, Checkout), but an inline
`window.forceSlideIndex = 2;` in the HTML overrides it to slide 3. The carousel has no
timer (no `setInterval` in the script; 42 s of observation never left slide 3); slides
change only on arrow, dot, swipe, arrow key or URL hash.

Candidate surfaces:
- Slide 3, forced default, "Payments infrastructure for the internet" (raster
  `tablet-transparent.png` + `tablet-content.jpg`, x769 y273, 873x488). The tablet shows
  a Squarespace page ("Create your own SPACE", "GET STARTED"): a customer's site, not
  Stripe's UI. The card in front ("4841 1234 5678 9012", "ROSEN JENNY", "04/16") is a
  drawn illustration. Fails.
- Slide 1, "Web and mobile payments, built for developers" (raster `phones.png`, x773
  y279, 430x488, served from capture 20141231231439, paints in replay). Left phone is
  Lyft's own app ("Request Lyft", "Nearest driver is 1 minute away"), a customer's
  product. Right iPhone is Stripe Checkout on mobile web: "Dribbble", "Pro Plan",
  "Email", "Card", "Expiry", "CVC", "Remember me" with a switch, "Pay $25.00". Real
  product. Passes.
- Slide 2, "Checkout" / "A beautiful, optimized, cross-device payment form, with support
  for single click payments." (raster `checkout-hero.png`, div at x653 y269, 578x488).
  Desktop Checkout modal "Dribbble" / "Pro Account 1 Year", "Email" (with caret),
  "Card number", "MM / YY", "CVC", "Remember me", "Pay $20.00"; behind it a tablet
  Checkout for "WillCall" / "2 Tickets" / "Pay $15.00" and an iPhone one for "Humble
  Bundle" / "Mobile Bundle" / "Pay $50.00". Real product. Passes. ARCHIVE NOTE: the asset
  IS archived (CDX 200 at 20141231231441, digest QDZ432QNTCUCB6VF26WWBOXBQGTJFZ3V,
  unchanged since 20140307) and fetches cleanly as a 578x488 PNG, but it does not paint
  in replay: in three loads the request either 302'd and never completed or was never
  issued, and the slide renders as bare gradient. That is a replay failure, not the
  page's choice. Content was read from the direct fetch.
- Slide 4, "Stripe goes global" (raster `flags.png`, 1145x399): draped-flag illustration.
  Also fails to paint in replay though archived. Decorative. Fails.
- y1006: three feature-card line icons (`card.png`, `tag.png`, `web_mobile.png`).
  Decorative.
- No code sample anywhere: zero `pre`/`code`/`textarea`/`input`/`form` elements.

Faithfulness check, against Stripe's own archived Checkout bundle
(`checkout.stripe.com/v3/checkout/inner.js` and `inner.css`, capture 20141119112730).
The JS carries i18n keys `input.email`, `input.card`, `input.payment.cardNumber`,
`input.payment.cardExpiry.short`, `input.payment.cardExpiry.placeholder`,
`input.payment.cardCVC`, `rememberMe` and `button.pay`. That is the exact field set,
including the short/long split that separates the mobile labels ("Card", "Expiry") from
the desktop placeholders ("Card number", "MM / YY"). The CSS has the Pay button at
`linear-gradient(#45b1e8,#3097de)` (image samples #3cadeb top, #2d9de4 mid), the header
at `linear-gradient(#f5f5f7,#e9e9ea)` (image #eaeaec), border `#dededf` (exact match in
the image), and a 50x25 `.switchControl` for the mobile toggle. The English strings sit
in a locale file not fetched, so the match is on keys, layout and colour, not literal
copy.

Q1 verdict: present. Two hero slides carry raster captures of Stripe's real Checkout form
in device frames, matching the shipped bundle. That is the papaya case (real components,
composited for marketing), not a stylised approximation. The surface is one click
off-default (slides 1 and 2, behind a forced slide 3), and the slide that would have been
the desktop default without the override is the Checkout one. Slide 1 alone settles it,
since it paints in replay; the slide 2 replay failure does not change the call.

Q2 entry that could have embarrassed the vendor: none. Searched: all three Checkout
forms (every field is placeholder; the only values are "Pay $20.00", "Pay $25.00", "Pay
$15.00", "Pay $50.00", merchants' prices, no decline, error or fee shown, though the
bundle has an `error.cardDeclined` state the page never shows); the Lyft screen; the
drawn card; "Simple pricing" / "Leave complex fee structures behind." (no rate quoted);
"Businesses in Australia, the US, Canada, the UK, Ireland, and more can now use Stripe
to accept payments from around the world." (an availability list framed as expansion,
with "and more" keeping it broad, so not a narrowing refusal); the y≈930 banner "One
touch to pay on iOS. Easy Apple Pay integration for business built on Stripe. Start
integrating"; the six-logo wall at y≈1233; the footer.

Q2 verdict: absent. The medium is there (a real Checkout capture is product chrome), but
every value on it is blank or flattering. Nothing in the scored content could count
against Stripe.

Drift from earlier prose. The default view still matches ("A tablet and a credit card
float at right", four dots, arrows at both edges, six grey logos). But "the hero is a
rotating slideshow" is wrong for this snapshot: nothing rotates without input, and the
default slide is pinned by `forceSlideIndex`. The v3 note that "phrases do cycle on this
page" holds only under user navigation. The earlier prose also omits the Apple Pay banner
between hero and feature cards. Two of the four hero images (Checkout, flags) do not
replay at all today, so any earlier rating made from replay alone could not have seen
the Checkout slide.

**`source` pinned to snapshot `20150101092245`.** It was `/web/2014/`, which resolves to
the nearest snapshot. That target can move as the archive adds captures, so two
raters following the same `source` could rate different pages and nobody would
see it. The pin is the snapshot this file's 3b re-pass landed on. A 2014 page
cannot have changed since, so any later re-rate that disagrees with this file
is disagreeing about the same bytes.

**Orchestrator: `typewriter-headline` unresolved → absent.** The `unresolved`
rested on not knowing whether the four-slide hero swaps its headline on a
timer. The 3b surface re-pass settled the timer half: the page pins slide 3 via
`window.forceSlideIndex = 2` and nothing advanced across 42s without a click.
The signal is cycling on a timer, so a click-driven carousel is absent whatever
each slide's headline says.
