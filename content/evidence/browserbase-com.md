---
source: https://www.browserbase.com
kind: site
cohort: agent-tools
verdict: exemplar
studied: 2026-10-11
context: [hero, nav, features, cta, footer]
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
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: present
  real-product-screenshot: absent
  artifact-not-dashboard: present
  density-variation: present
  one-accent-discipline: present
  live-claim-control: absent
materials: [single-theme, video-hero, illustration]
---
Captured at 1440x900; full page 7322px. The only site in this cohort that never
once pictures its own interface, and the only one that ships a hand-written
page for readers without JavaScript. Both are the finding.

**It never shows the product. It shows what the product produces.** There is no
Browserbase console, no session list, no dashboard anywhere on 7322px. What runs
instead is the agent's output. Three 845x384 looping videos step through a real
task trace: `Searching for "roundtrip flight from SFO to NYC"` → a result row
reading `Skyscanner - Flights from San Francisco (SFO) to New…` → `Fetched
flights from Skyscanner` → the page returned as `# Skyscanner` markdown → a
browser at `flights.example.com/booking`. Elsewhere, illustrated vignettes show a
hotel listing marked `Lower Price Available! The Empire Hotel — $350 $250/Night`
and a parallel-run ledger of `vendor-portal.io 12,440 Done / supplier-hub.io
10,300 Uploading / records.gov.uk 3,440 Uploading — 247 sites running in
parallel`. A priced comparison and a run ledger, which is almost word for word
what v3 gives as the definition. `artifact-not-dashboard` present and
`real-product-screenshot` absent, cleanly, with nothing to arbitrate.

**The field is a dithered photograph, and the type sits in a knockout bar.** The
hero is `hero-loopA-designer-desktop-1350x720.mp4`, 1312x711, looping: a mountain
range reduced to a 1-bit halftone in an indexed palette of black, orange, yellow
and green against a pale `#c5d3e8` sky that carries a visible dot texture. The
headline does not float on it and no scrim is bolted over it. Instead the two
lines are set in white on a solid `rgb(255, 69, 0)` rectangle that hugs the text
exactly, stepping in width between line one and line two. That device recurs
four times with different tints — black on pale yellow for "Use the whole web
like it's an API", black on pale pink for "Don't use the web. Scale it.", black
on pale blue for "10,000+ years saved" — so the page's whole emphasis system is
a highlighter rather than a colour change on the glyphs.

This is why `single-optical-anchor` is present despite a 65% saturated viewport:
the orange bar is the only high-chroma mass above the fold, the mountain beneath
it is a low-contrast texture, and everything else is black on pale blue. And it
is why `one-accent-discipline` survives: exactly one saturated text colour exists
on the page, `rgb(255, 69, 0)`, carrying the CTA fill, the inline emphasis
("Anything **you can do** in a browser", "Zero setup. **Real results.**") and the
entire footer field. The pale tints all sit near 90% luminance and never compete.
The single exception on the record is an 8px magenta bullet square beside the
`HUMAN YEARS BROWSING THE WEB` eyebrow.

**The grid is drawn.** A 1px hairline column and row grid is visible across the
whole page — vertical rules at x≈65 and x≈1375, horizontal rules at every section
boundary, and a sub-grid of twelve cells across the footer approach. It reads as
a technical drawing sheet, and it exists so that things can break it. The
"10,000+ years saved" bar at 103.97px runs from x≈65 to x≈1113, overlapping the
dithered mountain, crossing the page's own column rule, and the type overruns the
bar's right edge. `editorial-grid-break` present, and specifically present
*because* the grid is declared first.

**Type is two Grilli Type voices plus a mono.** GT Planar sets every display line
(45px hero, 36px section heads); a separate face registered as `plain` sets body
and all 16px feature labels at `letter-spacing: 0.4px`; GT Standard Mono carries
the eyebrows, the inline chips (`Your BRIDGE between AI and the DIGITAL WORLD`),
the bullet lists and every `GET STARTED ▶` link. Two distinct speaking faces
visible in one viewport, so `custom-type-pairing` present and
`generic-sans-default` absent.

`type-scale-high-contrast` is present on the page's range and not on its hero,
and the honest number first: the hero is 45px against a 20px subhead, 2.25:1, the
weakest hero ratio measured in this cohort. The page's actual span is 103.97px
against 16px body — 6.5:1, the highest measured anywhere here — with 36px and
14px mono stops between.

**The hero is a centered stack.** Headline centered at x=456 w=529, centered
subhead, two centered pills. `centered-hero-stack` present, and it is the only
template signal on the sheet. Everything after it sets left at x=80: 3 of 26
headings on the page are centered. The body figure is an unequal split — a
~620px text column at x=80 against a dithered illustration or a video panel on
the right — repeated through five sections.

**The feature grid is eight cells, not three.** Where the template puts three
cards, this puts a 4x2 grid at x=80/406/732/1058, 302px each, with no fill, no
border and no radius. Above each cell is not an icon but a drawn vignette of a
browser doing something specific: cursors landing on a page, a Sign In form, an
"Add to cart" button under an orange cursor dot, a reCAPTCHA checkbox being
ticked, a form being filled, the hotel price comparison, the parallel-run table.
Eight different scenes, none a stroke glyph, which is why `generic-line-icon-set`
is absent as well as `three-card-row`.

The closest thing to a triplet is the "Zero setup. Real results." row — three
413px columns, each a dithered landscape with a white UI diagram overlaid, above
a label and body. Scored absent on two grounds worth recording: there is no card
chrome around the unit, the image is the panel; and the three are a numbered
sequence (Create a browser session → Choose your model → Execute your first
task), not three parallel feature pitches. A reader may disagree with the second
ground; the first is measurable.

**The no-JS page is a second edition, written by hand.** With JavaScript
disabled the page yields 852 characters against 4106 with it — 21% survival, by
far the worst raw number in this cohort. It is not degradation. What renders is a
*different page*: a different headline ("Give your agents access to the whole
web."), a different subhead, then a black panel reading "The complete platform to
run agents that use the web like humans." over a dense ~700-character paragraph
that exists nowhere in the JS version —
`Browserbase runs 35m+ browser sessions a month across 10,000 customers,
including Ramp, Microsoft, and Lovable` — and four links. That copy is authored
and specific; whether it is intended as a no-JS fallback or as an
answer-engine block cannot be told from the outside, but either way the reader
`scroll-reveal-blank` worries about gets a denser page here, not a thinner one.
The text-opacity measurement is unchanged and still agrees: only 92 characters of
body prose render under 8% opacity at rest, and the opacity-gated count is
identical before and after a full scroll walk (10 nodes, 10 nodes; innerText 4106
both times).

**v3 re-pass, pixel diff against a same-run control.** The signal is nonetheless
present, because on this page nothing that waits for a scroll is text. Two bands
gain ink and lose none — y4640-5080 from 0.6% to 61.0%, y5820-6380 from 17.6% to
51.7%, 52 rows in all — and the first is the three-up under "Create a browser
session / Choose your model / Execute your first task", whose captions are present
at rest while the three illustrations above them are absent from the capture
entirely and paint only after scrolling. A same-length dwell without scrolling
reproduces the static capture, so the gate is the scroll. This is why the
opacity-gated count reads clean: the reveal is on the illustrations, which have no
text to fade, and a text instrument cannot see it. The vocabulary has no slot for an authored no-JS edition and
probably should.

`gradient-blob` and `gradient-fill-cta` are absent on zero gradient declarations
anywhere — no element of any size carries one, and the CTA is a flat black pill.
`glass-card-overuse` absent at zero `backdrop-filter` surfaces.
`indigo-violet-accent` absent. Zero emoji. `badge-pill-spam` absent: three
rounded elements above the fold and all three are buttons.
`testimonial-card-row` absent — there are no quotes on the page at all; social
proof is a six-cell logo wall and a four-panel stat row (800,000 weekly SDK
downloads / 100,000 developers / 10,000 companies / Millions websites visited),
each on a different pale tint.

One thing it shares with Stripe and nothing else here: the logo wall keeps every
customer's brand colour — Microsoft's four squares, Clay, Amplitude, ramp,
Lovable's gradient mark, DeepMind — in six equal bordered cells. So a
brand-colour logo wall is not unique to Stripe in this cohort, and whatever rule
the build derives from it needs both files.

Single theme, light-native: a `prefers-color-scheme: dark` render differs from
light by 0.0% of sampled pixels, with zero dark hooks in source.
