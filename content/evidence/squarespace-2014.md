---
source: https://web.archive.org/web/20150101001522/http://squarespace.com/
kind: site
cohort: pre-ai-2015
context: [hero, cta]
verdict: mixed
studied: 2026-10-11
materials: [single-theme, commissioned-photo]
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
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: present
  hero-mockup-float: present
  asymmetric-split: absent
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
---
Capture year 2014 (Jan 2015 snapshot). One viewport, one idea, nothing
below the fold but a thin filmstrip bar.

Full-bleed photograph of a climber's bivouac at dusk, deliberately
underexposed and thrown out of focus so it reads as a field rather than an
image. "Better websites for all." sits centered at roughly 58px in a light
weight against a 13px letterspaced all-caps subhead — close to a 4:1 ratio,
the highest in the cohort.

A MacBook floats dead centre with a real customer site on its screen, a
hand reaching toward the trackpad from the bottom edge. This is the
hero-mockup-float pattern in its original form, and it is doing real work
here: the product is websites, so the screen content is the product.

One white pill CTA is the only saturated element against the blue-grey
photograph. Nothing else on the page competes.

The whole page is one viewport tall. No feature grid, no logo wall, no
pricing. A 2026 page selling the same product would be twelve sections.
**v3 re-pass.** `typewriter-headline` is unresolved for the same reason as
`stripe-2014`: the hero rotates. The full-page capture caught a different slide from
the viewport one — a hand holding an iPad showing Quills Coffee's site over a
defocused coffee-shop interior, where the viewport capture has the bivouac and Alex
Honnold's site — so the page cycles, but whether the headline substitutes
independently is not something a still settles.

`stock-photo-generic` is absent, narrowly. Both slides are the soft-focus lifestyle
composition the signal usually catches, but neither photograph is interchangeable:
each is the real context of the named customer whose site is on the screen in it, and
the defocus is in the image rather than a scrim laid over it. The whole page is one
viewport, so `scroll-reveal-blank` is absent.

**v4 hole-7 deliverable re-pass**

Capture. Snapshot landed: `20150101001522` (redirected from `/web/2014/`), the same Jan 2015
capture the prose describes. The reused s5 walk reads `tiles: 5`, `clamped: false`,
`coverage: 1`, `docH_before` 3378 = `docH_after` 3378, but it is **blank**: every tile is 97%
white below the Wayback toolbar. The hero is load-gated. `DetailsGallery` keeps the layout in
`details--loading` with every `section.scene` at opacity 0 until the first background and device
bitmaps arrive, which takes about 25s through the archive; the walker's 8s settle shoots the empty
loading state. A re-shoot with the same walker came back identical. The 3378px height is the
loading state only. Once the first scene paints, `scrollHeight` is 900, `window.scrollTo(0, 700)`
lands at 0, and the page is one fixed 1440x900 viewport: coverage 900/900, nothing to clamp. There
is no footer. The viewport ends in the `Introducing the all new Squarespace 7` bar (y812-900).
I read it with a load-gated Playwright walk that waits for `section.scene.viz.loaded .device img`
and then clicks `.slider-arrow--right` through the playlist. That reached 17 of the 18 scenes in
the DOM; the 18th (`directors`, Mario Hugo) timed out, and I read its device bitmap from the
archive directly (`details-062614/directors/laptop-2100.webp`). All 18 were seen. The archive
serves the scene bitmaps from neighbouring captures (for example `20141215204509` and
`20150127005105`) at the same versioned `details-062614/...?v=1` paths. No scene failed to
archive.

Candidates weighed, all at 1440x900:
- The 18 device screens, y360-901 (`.device img`, a composited photo of a customer site on a
  laptop, tablet or phone, one bitmap per scene), inside a product capture. The screens are the
  product's output: a finished site per customer. Read from pixels, the legible ones are St Lucia
  `On Tour`, Alex Honnold `THIS IS MY STORY`, Instrument `HEADS UP DISPLAY`, Quills Coffee
  `ROASTING COFFEE GOODNESS`, Mel Debarge `LA GRAN FUGA`, Blue Smoke `SOUTHERN INSPIRATION`
  `CULINARY INNOVATION`, Mario Hugo `DIRECTION, DESIGN, AND ILLUSTRATION PORTFOLIO`. The other
  eleven (Jen Mussari, Hunt Amor, Hanksy, Matthias Heiderich, Max Dworkin, Real Magic,
  Soojin & Isaac, Project Ara, Lily + Spice Interiors, Minimally Minimal, Surface Magazine) are
  image-led portfolio, shop or editorial home pages.
- Per-scene attribution, y850 on the page canvas: `ST LUCIA – CUSTOMER STORY`,
  `ALEX HONNOLD – CUSTOMER STORY`, and `… – SQUARESPACE CUSTOMER` for the rest. The two
  "customer story" labels open YouTube testimonials (`6KEVtTSOouE`, `PmYl9gP2rK8`) on click. They
  are not on the canvas and are testimonials by kind.
- The page canvas copy: `Better websites for all.` (h1, y158, 64px), `START YOUR FREE TRIAL TODAY.
  NO CREDIT CARD REQUIRED.` (y247), `GET STARTED` (y235), and the Seven bar's `The easiest, most
  powerful Squarespace ever.` (y812). The trial terms are an offer the page sells, not a refusal.

The entry that could have embarrassed the vendor: **none.** I searched all 18 device screens and
every text node on the canvas. Every scene is a curated, finished, best-case customer site, chosen
one at a time to flatter the builder. No screen shows a template limit, a broken layout, a missing
feature, a price, an error or a site that came out worse than its owner wanted. This is a
sentient-os deck ("every demo card a win") in 2014 form. Part B is not the obstacle. The
deliverable is shown in a readable medium, inside product captures, and the rotation that hid most
of it from the first rating has now been walked. It fails on stance, not medium.

Verdict: `absent`, confirmed. The question this pass adds, whether there is a deliverable outside
chrome or in the unseen slides, is answered: there are 18, all flattering.

Studied-page check: unchanged. It is the same snapshot, and the prose's bivouac/Alex Honnold
laptop, white pill CTA and one-viewport layout are all present. One correction to the v3 note:
Quills Coffee is on a laptop, not an iPad (`personaInfo.smallbusiness.device: "laptop"`). The
headline measures 64px in the DOM against the prose's "roughly 58px". Neither is drift. Side
observation for `typewriter-headline`, which this pass does not change: the h1 read
`Better websites for all.` and the tagline stayed the same in all 17 DOM-visited scenes, so the
headline does not substitute when the hero rotates.

**Orchestrator: `typewriter-headline` unresolved → absent; `source` pinned to
`20150101001522`.** The `unresolved` was a carousel the capture could not step
through. The hole-7 re-pass stepped through it: 17 of 18 slides by clicking, the
18th from its archived image. The h1 "Better websites for all." is identical on
every slide; only the device screenshots swap. The signal names a headline or
panel cycling phrases, and none does. The pin is the snapshot that re-pass
landed on; `/web/2014/` resolves to the nearest capture and can drift.
