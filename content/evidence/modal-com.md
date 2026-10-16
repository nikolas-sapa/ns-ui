---
source: https://modal.com
kind: site
cohort: agent-tools
verdict: exemplar
studied: 2026-10-11
context: [hero, nav, features, cta, footer]
signals:
  gradient-blob: absent
  three-card-row: present
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
  centered-hero-stack: present
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: absent
  editorial-grid-break: present
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, webgl]
---
Captured at 1440x900; full page 10618px. The cleanest ornament sheet measured in
this cohort: zero gradients of any kind, zero faded text, one hue. It carries a
centered hero and a line-icon set and is still the exemplar here, which is
itself a useful data point about which signals carry weight.

**Zero gradients. Not few — zero.** No element over 500x250px on the page
declares a `gradient` of any kind: the large-element scan returns an empty list.
No button declares one. No text carries `background-clip: text`. For a 2026 AI
infrastructure homepage that is close to unheard of, and it is why the page needs
no defence of its background: there is nothing painted on it. The field samples
`#040804` at every one of fifty-six probe points away from content — a near-black
with a four-point green cast baked into the base colour itself rather than
applied as a wash. 75.3% of viewport pixels sit in one 16-step bucket around
(8,8,8).

**One hue, and the exceptions are data.** The only saturated chrome colour is
`rgb(127, 238, 100)` green: "production AI" in the headline, the section eyebrow
glyphs, the nav hover, the CLI word in mono. Seven other saturated colours exist
in the DOM and every one is information rather than brand — `rgb(203, 241, 193)`
and `rgb(251, 116, 85)` inside `<pre>` syntax highlighting, and amber / violet /
coral / teal exclusively on region labels across the world map (US Central, EU
North, Asia Pacific · Melbourne, Japan), which is a categorical scale encoding
geography. By the same exemption that keeps product-UI pills out of
`badge-pill-spam`, `one-accent-discipline` is present.

**The hero is the one centered thing on the page.** "The platform for production
AI" sets at 44px centered, weight 400 — not 600, not 700 — on a 16px centered
subhead, over two centered pills. Display-to-body is 2.75:1, the lowest measured
in this cohort, so `type-scale-high-contrast` is absent; the restraint is
deliberate and consistent, since section heads below run 37px and feature labels
14px. One of twenty-five headings on the page is centered. Everything after the
hero sets left at x=64 or x=231, including the closing CTA ("Ship your first app
in minutes", left at x=64, with `$30 / month free compute` under it at 12px
mono), so `symmetric-everything` is absent and the hero reads as a deliberate
exception rather than a default.

Behind it, a 1440x1080 WebGL canvas positioned at y=-90 renders an isometric cube
as a field of individual green dots, brightest at the centre, dissolving into
near-black at the edges. It bleeds above the viewport top and past both margins.
Because it never exceeds roughly 40% luminance — the whole page tops out at
`lumMax: 227`, nothing reaches white — the only high-luminance object in the
first viewport is the headline plus the 104x36 "Get started" pill.
`single-optical-anchor` present, by the same mechanism Linear uses: spend the
luminance budget once.

**Type is ABC Diatype at every size.** A licensed Dinamo grotesque sets the 44px
headline, the 16px body, the 14px labels and the nav; Fira Mono carries code and
figures. `generic-sans-default` absent. `custom-type-pairing` is absent rather
than present: a sans with mono confined to code blocks is one speaking voice, not
two in dialogue — contrast Railway, which puts a serif display against a sans
body in the same section.

**The repeating figure is a real asymmetric split.** Four consecutive sections
pin a ~440px text column at x=231 (16px heading, three-line body, a 2x2 grid of
small line-icon features, a "Learn more" pill) against a 646x499 panel at the
right. Unequal widths, same axis, four times. In the left gutter at x=64 a sticky
section index (Inference / Training / Sandboxes / Functions) tracks scroll with
the active item in green — an element living permanently in the margin outside
the content column, which with the full-bleed world map running under type that
belongs to the content column is why `editorial-grid-break` is present.

**Those right-hand panels are the thing to copy, and they are easy to misread.**
A naive full-page capture renders them empty: correct dimensions, a centred mono
caption, nothing between. They are not blank. Scrolled into view with a ten-second
dwell they paint animated diagrams on 644x498 canvases — an orbit of model-provider
marks around a `modal deploy` code chip; a TRAINER / INFERENCE / SANDBOXES
hexagon grid where red cells drain and green cells fill. Twelve further WebGL
contexts sit at 0x0 until mounted. The capture lies, not the page.

Critically, the claim never lives in the canvas. Each panel carries its assertion
as mono text in the DOM —
`Trainer, Inference, and Sandboxes exchange weights, requests, and rollout data.`
— so the canvas decorates a sentence that is already readable. This is why
`scroll-reveal-blank` is absent and the number is emphatic: excluding nav and
menu subtrees, **zero characters** of body prose render under 8% opacity at rest,
and with JavaScript disabled the page still yields 7882 of 7966 characters, 99%.
No other site in this cohort comes close.

**Product capture with its own numbers.** The enterprise row shows three dark
filled cards, each a genuine fragment of the Modal console: an Audit Logs table
with `sandbox.create` / `sandbox.terminate` / `image.push` rows timestamped
Sep 10, 13:54:32 and attributed to `modal-bot`, `deploy-bot`, `ci-runner`; a
Containers chart with Live and Total series; and a Live Usage panel reading
`Containers 108`, `GPU Utilization 94%`, `H100s — 74 GPUs`. `real-product-screenshot`
present, so `artifact-not-dashboard` is absent by construction.

**The dot-matrix world map.** At y≈5442 the continents are drawn as a field of
small distinct glyphs — circles, diamonds, squares, asterisks — at roughly 15%
luminance, with exactly one green marker labelled "US West". A full-bleed 1440px
illustration whose only chromatic element is a single point. It replaces the
"globally distributed" stock-globe without being a globe.

Where the template wins, and it is two signals:

**A 20px line-icon set above a four-up.** Globe over "Globally distributed
capacity", checkbox over "True, on-demand autoscaling", gear over "Any GPU, any
time", pulse over "Automated fleet health". One set, one stroke weight, one size,
each glyph restating its heading. The row is separated by 1px vertical hairlines
running only the content height — the Linear device — but the hairlines do not
rescue the icons. `generic-line-icon-set` present.

**Three equal cards with chrome.** The enterprise row above is three ~430px
panels with a dark fill, a hairline border and radius, at one rank, equal weight.
`three-card-row` present. Two other 3-ups on the page (the storage/scheduling row
at x=81/525/969, the news row in the light section) carry no card chrome, but one
genuine instance is one instance.

`gradient-fill-cta` absent — "Get started" is a flat light pill, "Contact us" a
flat dark one. `indigo-violet-accent` absent entirely; the only violet on the
page is a map region label and a blog tag. `glass-card-overuse` absent: four
`backdrop-filter` surfaces exist and they are the sticky nav plus three
sub-40px controls at `rgba(255,255,255,0.05)` over a flat near-black field, where
a blur has nothing to blur. `badge-pill-spam` absent — four rounded elements
above the fold and all four are buttons; the tinted category tags
("Customer Stories", "News") sit below 9000px. Zero emoji. Zero `setInterval`,
and hero text byte-identical across 4.5s, so `typewriter-headline` absent. Single
theme, dark-native: dark and light renders differ by 0.0% of sampled pixels.

**v4 change 3 re-score — `shows-deliverable` absent → present.** Re-rated from
a fresh walk (16 tiles, `clamped: false`, `coverage: 1.0`) plus a 12s dwell
pass to force the WebGL panels to paint, and a digit-bearing text scan for
anything the tiles left illegible.

**The enterprise row at y6732-7160**, three cards, values read from a DOM text
scan rather than eyeballed. *Containers* (x536-904) is a two-series
time-series with a fully labelled axis set — y `100 / 50 / 0`, x `Tue 15 / 03
AM / 06 AM / 09 AM / 06 PM`, legend `Live` and `Total` — whose curves run
~45-90 with per-interval variance and where `Total` sits at or above `Live`
across the whole window, which is correct semantics rather than two random
paths. *Live Usage* (x982-1346) reads `Time 05:17am`, `Containers 108`, `GPU
Utilization 94%`, with an `H100s` sub-panel badged `74 GPUs` over a *stepped*
sparkline — the right shape for an integer allocation series, against the
smooth curve used for container count. *Audit Logs* (x96-488) carries four
`timestamp + action + resource-id + actor` rows at second resolution using
Modal's real API verbs: `Sep 10, 13:54:49 / sandbox.create / sandbox-7f2a /
modal-bot`, then `sandbox.terminate`, `image.push`, `volume.delete`.

Strip the chrome — the card, the filter input, the column headers, the pill —
and what remains is a concurrency-vs-time plot with readable values, a measured
utilisation figure, and a ledger of executed operations. For a serverless
compute platform that *is* the output: compute produces no file, no document
and no image, so the artefact of "we ran your job on 74 H100s" is exactly the
container count, the utilisation number and the log line. A containers-vs-time
plot is the structural analogue of the vocabulary's "force-vs-time chart".

**The code samples were checked and deliberately not scored.** All four product
panels (Inference / Training / Sandboxes / Functions, y≈1455-4800) paint only
after a dwell, and with 12s parked they render a code chip over an abstract
animated field: `modal deploy` in an orbit of provider marks,
`Sandbox.create()` over a hexagon grid, `@app.function(gpu="B200:8", timeout=24
* HOURS, ...)`. Those are **inputs**, and none is paired with a result — no
return value, no log, no duration. `timeout=24 * HOURS` is a parameter, not a
measurement.

Also weighed and not load-bearing: the testimonial at y7721 ("Modal served 1
trillion tokens for Jev within three days of launch") is a measured claim but
it is prose in a customer quote, not a rendered artefact; and the blog-card
thumbnail at y8896-9132 renders a real latency A/B (`TRAFFIC → PROD 220 ms` /
`CANDIDATE 140 ms`) but as editorial illustration for a feature announcement.

**Why this page settles the hard case rather than stretching it: the page draws
the line itself.** Its "Fast container scheduling and startup" card (y≈5500)
illustrates a *timing* claim with an abstract isometric cube — the one place a
cold-start number is the obvious deliverable, and there is none. The product
panels illustrate execution with valueless hexagons. So Modal demonstrates both
sides of the distinction in one document, and the enterprise row sits on the
rendering side of its own line. That contrast is the reason for `present`
rather than `unresolved`.

**v4 holes 7+2 / change 3b re-score — `shows-deliverable` present → absent; `real-product-surface` present (confirmed, wording corrected).**

This flips a value an independent rater set to `present` yesterday from a fresh
capture. Their reading of the medium holds up and is kept below; what they did
not have is the stance test now stated in the definition: *name the entry that
could have embarrassed the vendor*, and seeded console data is scored on what it
says, failing when every value flatters. They also did not have Modal's own
audit-log documentation, which turns out to matter (see the `status` column).

*Capture.* Reused `s5/modal-com/walk.json`: 16 tiles, `clamped: false`,
`coverage: 1`, docH 10618 before and after. Stitched to 3 strips totalling
10618px = page height. The last strip ends in the footer (Products / Solutions /
Resources / Tools / Company columns, `Privacy Policy`, `Terms & Conditions`,
`© Modal 2026` at DOM y10523). Values below are Playwright DOM text from two
live loads ~20s apart, both docH 10618, document y-coordinates.

*The scored row, live DOM.* Audit Logs card, headers at y6855: `Audit Logs`
(x116) / `Action` (x244) / `Actor` (x372) / `Targets` (x500, clipped by the card
edge in the render). Rows:
- y6904 `Sep 10, 13:54:49` · `sandbox.create` · `modal-bot` / `bot@example.com` · `sandbox-7f2a`
- y6961 `Sep 10, 13:54:32` · `sandbox.terminate` · `deploy-bot` / `deploy@example.com` · `sandbox-3c91`
- y7018 `Sep 10, 13:54:32` · `image.push` · `ci-runner` / `ci@example.com` · `image-84bd`
- y7075 `Sep 10, 13:54:32` · `volume.delete` · `modal-bot` / `system@example.com` · `volume-19ac`

Containers card: `Containers` y6836; visible axis `100` (y6883) / `50` (y6932),
`Tue 15` / `06 AM` / `06 PM` (y6999); legend `Live` / `Total` (y7040). Live
Usage card: `Time 05:17am` (y6836), `Containers 108` (y6858), `GPU Utilization
94%` (y6880), `Live Usage` (y6836, x1257), `H100s` / `74 GPUs` (y6930).

*Whole-page search for anything that could count against Modal.* All
digit-bearing text, every text node matching error / fail / timeout / latency /
cold / start / second / price / cost / limit / quota / status / incident /
retry / down / slow / vs / compare / outage / uptime / SLA / refund and
negations, plus every link href for status / incident / pricing / compare.
Found:
- No error, failed, denied or retried state in any log, chart or code sample.
  The audit table has no status column at all.
- No latency or cold-start figure anywhere in the live DOM. The "Fast container
  scheduling and startup" card (y5011) still carries only "Modal runs a custom
  container runtime and image system built for large images and GPU scheduling."
  The only timing numbers seen in this pass, `PROD 220 ms` / `CANDIDATE 140 ms`,
  are raster text inside the Endpoint Candidates blog thumbnail in the s5
  capture; that card has since rotated out of the live blog row (now "Muse Spark
  Open is now available on Modal" x80, "Modal crosses $1B…" x524, "Toward RL…"
  x968, all y9160), and it was editorial and ~1800px from the scored row anyway.
- Cost: only `$30 / month free compute` (y9867, a giveaway that can only flatter
  by being larger) and the funding figures `$1B` / `$750M`. "Pricing" is a link
  (`/pricing`, y52 / y5562 / y10253), not a refusal or a number.
- Quota / limit: the page asserts the opposite, "without quota requests" (y6154)
  and "without quotas or reservations" (y7223).
- No comparison table, no competitor row, no status or incident link in nav or
  footer.
- Code samples are inputs with no output: `timeout=24 * HOURS` (y3723),
  `@modal.clustered(size=16, rdma=True)` (y3773-3790); the inference chip now
  types `modal endpoint create` (load 1 read `endpoint`, load 2 `endpoint creat`).

*The entry that could have embarrassed Modal: none exists.* Every value in the
row flatters or is neutral. `94%` is the top of a bounded 0-100 range and sits
directly above the caption it illustrates, "Maximum GPU utilization, billed by
the second" (y7187). `108` containers and `74 GPUs` can only flatter by being
larger. The H100 sparkline steps down to a floor, which illustrates "back to
zero when you're done" (y6154) rather than a fault. The four audit rows are four
completed bot operations. And the absence is constructed, not incidental:
Modal's own audit-log documentation (`/docs/guide/audit-logs`, checked this
pass) lists a `status` field, "Whether the action succeeded or failed", and
offers `-status:success` as an example filter. The real product records failure;
the homepage rendering drops exactly that column and keeps action / actor /
targets. Seeded data is not what fails here; stance is. **`shows-deliverable`
absent.**

Part B, for the record, would pass: the previous rater's argument that a
concurrency plot, a utilisation figure and an operations ledger are the
deliverable of a compute platform is sound, and the content is readable. The
signal fails on Part A alone.

*`real-product-surface` present, but not as a capture.* The row is DOM text and
inline SVG, not a screenshot, so the old prose's "a genuine fragment of the
Modal console" overstates it: it is a page-authored rebuild. It is faithful to
the real product's vocabulary where that can be checked without a login: the
column set is the documented field set minus `status`; the placeholder
`Filter by action, actor, IP address...` (y6805) names real filter keys
(`action`, `actor`, `context.ip_address`); `sandbox.create`, `sandbox.terminate`
and `volume.delete` are documented audit actions; "GPU utilization %" is a
documented Modal metric (`/docs/guide/gpu-metrics`). Deviations: `image.push`
is not a documented audit action (the only image action listed is
`image.delete`), actors carry RFC 2606 `@example.com` placeholder addresses, and
the Containers axis carries hidden labels (`0`, `03 AM`, `09 AM` at opacity 0)
stacked on visible ones at x615 and x817, with `Tue 15` / `06 AM` / `06 PM`
equally spaced over unequal intervals. Those are seeding and simplification
inside real chrome, not an invented UI; the Containers and Live Usage cards
could not be checked against the logged-in console.

*Timestamps.* Row 1 reads `Sep 10, 13:54:49`; rows 2-4 read `Sep 10, 13:54:32`.
Identical across both loads (every text node and y matched except the typing
endpoint chip and the SvelteKit bootstrap script), so the row is static, not
regenerated per load. The twelve long SVG paths in the row (y6700-7160) hash
identically across two further fresh loads, so the Containers and H100 curves
are static too. The old prose's two values were both true: the first
section generalised `13:54:32` to all rows, the second quoted row 1.

*Drift from old prose.* "Genuine fragment of the Modal console" → DOM rebuild
(above). The old axis list `100 / 50 / 0` and `Tue 15 / 03 AM / 06 AM / 09 AM /
06 PM` included three labels that render at opacity 0. The audit table has a
fourth `Targets` column the old prose never mentioned. The inference chip reads
`modal endpoint create`, not `modal deploy`. The blog row has rotated and the
220 ms / 140 ms thumbnail is no longer live.
