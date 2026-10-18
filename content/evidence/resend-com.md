---
source: https://resend.com
kind: site
cohort: agent-tools
context: [hero, nav, features, testimonials, cta, footer]
verdict: mixed
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
  indigo-violet-accent: present
  gradient-fill-cta: absent
  scroll-reveal-blank: present
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: present
  real-product-surface: present
  shows-deliverable: present
  density-variation: present
  one-accent-discipline: absent
  live-claim-control: absent
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
here on a site the cohort copies. v3's split is what finally names it: the hue is
recorded under indigo-violet-accent, which fires on any fill, while gradient-fill-cta
stays absent because the gradient is on a heading and on the hero badge's 1px border
(#4a1b64 at its left end), never on a button — the primary CTA is an achromatic
#151514 pill. Under v1's single purple-blue-gradient-cta the whole thing went
unrecorded.

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
**v3 re-pass.** `scroll-reveal-blank` is present. Between the "Reach humans, not spam
folders" heading and the Guillermo Rauch testimonial the full-page capture holds
roughly a thousand pixels of literal #000 — sampled every hundred rows, zero non-black
pixels across the band. That is unfired scroll-triggered content, and it is a separate
defect from the empty "Everything in your control" tab panel described above, which
renders its chrome.

`indigo-violet-accent` is present on the gradient-text heading and the badge border;
`gradient-fill-cta` is absent because the primary CTA is achromatic. That split is the
whole point of v3 breaking `purple-blue-gradient-cta` in two.

**Scroll walker, partial.** The walk lights rows inside the black band that were flat
`#000` in the static capture: 38 rows differ between the two captures, spanning
y5720 to y10960, and y8300 alone goes from zero to 41% inked. So the band is
scroll-gated rather than genuinely empty and `scroll-reveal-blank` stands. The gain
is thin — mean ink per row 8.5% to 9.3% against openhack's 6.0% to 27.8% — because
what mounts is sparse rather than because little mounts. Much of the band is still
black after a full walk; the gate is confirmed, the content behind it is not fully
recoverable headless.

**v4 hole-7 deliverable re-pass**

`shows-deliverable`: absent → **present** (flipped). The entry is the "Modular webhooks"
event feed's row `Bounced` · `Oct 16 03:31:57` · `to melia@gmail.com with type Spam`
(y≈3479). That is a send failing as spam, on a page whose subhead reads "The best way to
reach humans instead of spam folders."

Capture. Reused ~/scratch/antislop/s5/resend-com: 18 tiles, `clamped: false`,
`coverage: 1`, docH_before 12319, docH_after 12320 (+1px; stitched to the settled 12320),
3 strips (4400 / 4200 / 3720). The last strip ends in the footer: the address,
`All systems operational` and five link columns, ending at about y12185. DOM read with
Playwright on 2026-10-16 after a wheel walk. DOM y-coordinates sit within about 10px of the
stitched ones.

Candidates weighed (stitched y):
- y≈2210-2650, page canvas: the SDK code block. `if (error) {` / `return console.log(error);`
  is an error-handling idiom in sample code, not an outcome. Not an entry.
- y≈3245-3570, page canvas (page-authored `<pre>` rows): the "Test mode" card. Status chip
  `Delivered` on `delivered@resend.dev`, then a log of nothing but
  `HTTP 200: { "id": "7e91300f-7f72-4b78-952b-1fe57484d7ae" }`-shaped rows. Every value is
  the flattering one, the browserbase-com shape. Fails on stance.
- y≈3245-3570, page canvas (page-authored HTML spans, generated client-side on a live
  clock): the "Modular webhooks" event feed. Its generator draws from five statuses,
  `delivered`, `opened`, `clicked`, `complained` and `bounced`. The captured frame shows
  `Clicked` `Oct 16 03:32:24` `from noah@yahoo.com on Get Started` above the `Bounced` row
  quoted above. A later DOM read held `Complained` … `to liam@xerox.com with feedback Spam`
  and `Bounced` … `to lucas@figma.com with type Spam`. Bounced rows always carry
  `type Spam`, and Complained rows always carry `feedback Spam`. **This is the entry.**
- y≈4340-5130, page canvas: the composer (From `your.name@acme.com`, To
  `Newsletter Subscribers`, Subject `Weekly Newsletter`). Its body is the placeholder
  `Press '/' for commands`. Nothing against the vendor.
- y≈5568-5796, inside a product capture (`screenshot-zoom-audience.avif`): Audience
  `Newsletter subscribers`, `ALL CONTACTS 1,034`, `UNSUBSCRIBED 5`. Neutral.
- y≈5568-5796, inside a product capture (`screenshot-zoom-analytics.webp`):
  `DELIVERABILITY 98%`, `Delivered 3,204`, `Bounced 60`, `ENGAGEMENT 41%`. It has a bounce
  row. Corroborating.
- y≈6700-7400, page canvas: a react-email template beside its rendered output, "Welcome to
  ACME, user!". Output, with nothing against the vendor.
- y≈9661-10320, inside a product capture (`screenshot-metrics.webp`, alt "Resend Dashboard -
  Overview"): `DELIVERABILITY` `Good` (`Sent 29,486 100%`, `Delivered 29,486 100%`),
  `REPUTATION` `Good` (`Bounced 546 1.85%`, `Complained 2 0.01%`), and `ENGAGEMENT` `Poor`
  (`Opened 0 0%`, `Unsubscribed 137 0.46%`). The headline dashboard shows a non-zero
  bounce row and the product's own `Poor` verdict. Corroborating. This is the panel the
  original study saw as empty. It is a lazy-loaded image, not an empty panel.
- Excluded as not artefacts: the deliverability feature copy ("Be the first to know if your
  domain is added to a DNSBLs …"), which is body prose; the Infisical testimonial ("we don't
  hear complaints about emails landing on spam anymore"), which flatters; and the footer chip
  `All systems operational`, which flatters.

Verdict: present. The webhook feed is a page-authored rendering of the product's output.
That is Part B's tsenta position, so the medium qualifies. Its content shows the product
failing at its core job: a send bounced as spam, and recipients reporting sends as spam.
These rows sit under the subhead "reach humans instead of spam folders" and beside the H2
"Reach humans, not spam folders" (y≈7600). They narrow the page's lead claim.

This is not a limit the page sells as a feature. The card does list bounces as an event it
reports, but a bounced send is an outcome that counts against the vendor. railway-com's error
log also exists to report errors, and it still passed on its scanner probe. browserbase-com
failed precisely because its ledger had no `Failed` row, and this feed has one. The rows are
seeded demo content (random addresses, a live clock), so they are scored on what they say.
The two dashboard captures take the same stance (`Bounced 546 1.85%`, `ENGAGEMENT` `Poor`,
`Bounced 60`). modal-com's dashboard, with no error row, did not.

Studied-page check: unchanged. The height of 12319 matches the study. Wayback snapshot
20261010154437, taken on the studied date, carries "Modular webhooks", "Everything in your
control", `screenshot-metrics.webp`, `screenshot-zoom-analytics.webp` and
`screenshot-zoom-audience` in its server HTML. The feed rows are rendered client-side, so
they are absent from the server HTML. The original prose above does record
"delivery/bounced/complained status chips with actual timestamps". The pixel content of the
archived metrics image was not verified, because the Wayback image fetch was unavailable,
and the verdict does not rest on it.

The heading now reads "Integrate this afternoon", with an orange gradient
`from-[#FFC446] to-orange-9`, where the study recorded "this weekend". This is not drift. The
suffix is chosen client-side from local time (`useLocalDatetime`: Saturday or Sunday gives
`this weekend`, otherwise morning, afternoon or night). 2026-10-10 was a Saturday; this
re-pass ran on a Friday afternoon. The weekend variant's gradient is
`from-[#E131F3] via-[#59B2EA] to-[#A7FC8F]`, so the violet-to-teal fill recorded under
`indigo-violet-accent` appears only on weekends. That is noted here and not re-scored.
