---
source: https://subvocal.company
kind: site
cohort: yc-current
verdict: exemplar
studied: 2026-10-14
context: [hero, nav, cta, footer, faq]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: absent
  badge-pill-spam: absent
  generic-line-icon-set: absent
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: present
  single-optical-anchor: present
  type-scale-high-contrast: present
  editorial-grid-break: present
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: present
  density-variation: present
  one-accent-discipline: present
  live-claim-control: present
materials: [single-theme, illustration, video-embed]
---
Captured at 1440x900; full page 13726px; 20 tiles, 4 strips. Silent-speech
eyewear, YC F26. One slop signal against eight craft signals, and the capture
had to be redone before either count could be trusted.

**The given walk is broken, and it fails silently in a new way.** Tiles 8-19 —
12 of 20, 60% of the walk — are the same band: near-identical frames of a
product beauty shot. `window.scrollTo(0, y)` saturates at y=7092 and then
creeps 17px total across every request above it: asked 7500 got 7092, asked
9000 got 7096, asked 11000 got 7101, asked 13726 got 7109. Deficit at the
document end 6617px, so 48.2% of the page was never captured. The cause is
`div.scroll-film-pin.scroll-film--cover`, `position: sticky`,
`overflow: hidden`, 1440x900 at docTop 7109, with `scrollHeight` 1142 against
`clientHeight` 900 — a ratio of 1.27, under the walker's 1.5x inner-scroller
threshold. So the walker probed the element, correctly concluded it was not a
scroll container, fell back to the window, and used the one instrument that
element disables. Neither reading errors. This is a fifth capture failure mode
and it is worth adding to the brief: *an inner container too short to trip the
inner-scroller threshold can still clamp programmatic window scrolling.*
Synthetic wheel deltas pass through it; a wheel-driven walk reached y12736 in
19 bands and recovered the missing half — three scene panels, a seven-question
FAQ and the footer, none of which appears in any strip.

The repeated frames are not the walker's fault twice over: the pinned clip is
3.79s of footage (2304x1440 box, 1920x1080 native, muted, no controls,
`autoplay` false) held under that cover. Even a correct walk would recover a
slow dolly around one pair of glasses. The film advances; it has almost nothing
to advance through.

## The one slop signal

**`generic-sans-default` is present, and it is the whole slop count.** One
webfont ships — Inter — and it carries the entire ladder: 86.4px display at
`x=48, w=1344` ("Be the first / to get it."), 79.2px, 64.8px, 57.6px, 50.4px,
down to 16px body and a 12px scroll hint. No second family anywhere, which also
settles `custom-type-pairing` absent at one face.

The qualifier the measurement forces: this is the default family handled with
care rather than neglect. Display sizes carry an optical tracking table —
`-2.916px` on 64.8px and `-2.268px` on 50.4px, both exactly -0.045em, falling to
`-0.378px` (-0.015em) at 25.2px and `-0.18px` at 15px. Railway's Inter body runs
at `letter-spacing: normal`; this one does not. The signal is still correctly
present — one neo-grotesque doing display and body is what it names — but a rule
emitted from it would convict a page that did the tracking work.

## The craft signals

**`type-scale-high-contrast`.** Max display 86.4px against 16px body = 5.4:1.
The repeating section head is 79.2px against 15px body = 5.28:1, and even the
hero's 50.4px runs 3.36:1. Railway was marked absent at 2.7:1 and 3.4:1, so this
clears the cohort's bar by a wide margin rather than a judgment call.

**`asymmetric-split`.** All eight headings compute `text-align: start`; six sit
at `x=48`, the hero at `x=84`. Zero centered headings on a 13726px page, which
also settles `centered-hero-stack` and `symmetric-everything` absent. The figure
repeats: "Good questions." sets at `x=48, w=537` in 57.6px with the seven-row
FAQ list in a right column at `x≈718` and roughly 600px of vacancy under the
heading; each scene section pins a 480px text block at `x=48` with the output
panel flush to the right frame edge. Asymmetric by vacancy and by opposing mass
in the same composition.

**`editorial-grid-break`.** Two marquee tracks of quoted phrases set 25.2px at
`x=-12, w=2899` and `x=-11, w=2893` inside a 1440 frame — 2.01x the viewport,
clipped at both edges — against a text column that is 388px at the hero and
597px at its widest. The page's own grid is a left column at x=48; this element
ignores it in both directions.

**`artifact-not-dashboard`, and for once it resolves cleanly.** The product is
eyewear, so there is no UI to screenshot, and the page shows the deliverable
instead: the text silent speech produces, labelled with where it lands. Three
panels, each a destination app over the actual message — "Claude Code / Add
Google OAuth to the login flow. When the user clicks the login button…";
"Voice Agents / Find somewhere for dinner near my next stop. Something small and
quiet." footed "· A silent conversation with your AI"; "Glasses to glasses ·
Alex / This party is a bit too loud. Let's go home?" footed "· A silent
conversation with Alex". Upstream, a panel types "Your words flow at 200+ words
per minute." under a chrome bar and over two labels, "Silent input" and "No
words spoken aloud". That is the output of the product, captioned with its
destination, not a console.

**`live-claim-control`, and it took a click to settle.** Three of the page's
eight `<button>` elements are labelled "09:15 The office", "17:40 The train",
"19:30 Across the room", with a rule and an active underline above the scene.
From a still they are ambiguous: the underline advances with scroll position, so
they read equally as a scroll-synced progress indicator. Clicking "19:30 Across
the room" at rest moved `scrollY` 7456 → 10641 and swapped the visible scene to
"Glasses to glasses / A crowded room. A conversation for two." with the panel
"This party is a bit too loud. Let's go home?". They are controls. The claim
they let a visitor attack is the page's central one — that nobody notices — and
the control chooses the room. The second affordance is stronger still: the
demonstration at y4402 is 91.8s long, `controls: true`, `muted: false`,
`autoplay: false`, behind a button reading "Play prototype demonstration with
sound". A page whose claim is that you make no sound hands the visitor an
unmuted 1:31 recording of the rig and invites them to listen.

**`density-variation`.** The 3.79s clip is held across 6617px of scroll with
zero text nodes in frame; the FAQ packs seven native `<details>` and a 57.6px
head into roughly 900px. Between them, the marquee band runs 25.2px type across
2899px while the hero measure is 388px.

**`one-accent-discipline`, on zero chromatic accent in chrome.** The four
leading page colours are neutral and total 35.7% of sampled pixels — `8,8,8` at
19.1%, `232,232,232` at 9.5%, `24,24,24` at 4.8%, `40,40,40` at 2.3%. Every
interactive element is cream or near-black: button text `rgb(238,238,232)`, the
tab underline white, "Reserve Subvocal" a flat cream fill. The two warm entries
in the top six (`248,168,104` at 2.0%, `200,120,72` at 1.8%) are illustration
light, not UI.

**`single-optical-anchor`.** One focal subject per full-bleed composition: the
illustrated eye in the hero, one face in the office and train scenes, a lone
figure at the railing in the closing frame. This is the softest of the eight and
a second rater could reasonably take it the other way — the "crowded room"
scene holds two faces in focus, though that scene's subject is a pair.

## Near-misses

`glass-card-overuse` is **absent at exactly 2 of the 3 threshold**:
`SECTION.hero-floating-cta` 460x220 `blur(10px)` and `BUTTON.reserve` 151x52
`blur(10px)`, and nothing else on the page carries `backdrop-filter`. One more
glass chip flips it.

`stock-photo-generic` is absent, and the scrim clause nearly carries it. The
page's one large gradient is a two-layer linear scrim bolted over the 1440x900
scene image at y8391 —
`linear-gradient(rgba(20,33,31,0.44), rgba(0,0,0,0) 28%, rgba(16,28,21,0.376))`
plus `linear-gradient(90deg, rgba(21,34,25,0.48), rgba(0,0,0,0)…)` — which is
precisely "the type cannot survive on it so a scrim is bolted over it". What
settles it absent is that these are not stock: they are painterly renders built
for this page, and in all eight scenes the subject is wearing the product. They
could not belong to another company. Whatever tool made them, the material is
bespoke, so `materials` records `illustration` and the signal stays absent.

`real-product-screenshot` is absent and that is a category fact, not a
deficiency — there is no Subvocal UI in existence to capture. The page shows the
hardware as a 3.79s beauty clip and a 91.8s lab video of the actual prototype
rig (two people at a desk, a laptop, a breadboard, loose frames on the table).
This is the first file in the corpus where the mutual exclusivity with
`artifact-not-dashboard` costs nothing: railway had to leave its split-flap
board unscored because its four real captures held the slot.

`scroll-reveal-blank` is absent on the prescribed measure and the margin is
wide. Excluding nav, header, footer and dialog subtrees, 40 text nodes exist at
rest; 5 sit under 8% effective opacity; a wheel walk to the document end crosses
3 of them to visible, carrying 63 characters — "Get yours now", "until it's
awkward.", "Some words aren't for everyone." — and 0 nodes mount that were not
already in the DOM. Railway scored present at 38 nodes and 564 characters. The
three that cross are second lines inside the scroll film, not a section gate. A
dwell control holding the same wall clock (420 steps x 90ms = 37.8s) at zero
displacement crosses 0 nodes, so the gate is scroll rather than time — which
matters only for having checked, given the count.

That same dwell settles `typewriter-headline` absent: `setInterval` count 0,
`heroTextStable` true, and over 37.8s without scrolling, `innerText` moved 2745
→ 2719 characters with zero opacity crossings. Nothing on this page cycles on a
timer. The product panel that types "Your words flow" into "Your words flow at
200+ words per minute." is driven by scroll offset and types one phrase once.

`generic-line-icon-set` is absent at `svgCount: 1` for the whole document — a
28x28 fill glyph at y4749, the video play mark. The FAQ's disclosure markers are
text `+` characters on native `<details>`, not an icon set. `emoji-as-icon`
absent at zero emoji. `badge-pill-spam` absent at zero pills anywhere, not just
above the fold. `indigo-violet-accent` absent at 0.03% of sampled pixels across
the four hue buckets spanning 240-360deg. `gradient-fill-cta` absent at zero
button gradients and zero gradient text. `gradient-blob` absent: one large
gradient on the page and it is the linear scrim above, with no radial bloom
anywhere — the colour in the red problem field and the blue closing field is
painted into the artwork, not a CSS wash. `three-card-row` absent: the three row
candidates the probe found are all n=2 at equal widths (1440/1440, 1344/1344,
2304/2304) and are video-plus-wrapper pairs, not cards. `testimonial-card-row`
absent: there is no social-proof section in 2745 characters of `innerText` or in
any of the 19 recovered bands — no quotes, no logo wall, no customer marks.
`hero-mockup-float` absent at zero transformed elements on the document; the
output panels are flat, flush to the frame edge, with no bezel, tilt or shadow.

## The defect the vocabulary cannot record

**With JavaScript disabled this page yields 0 characters and
`documentElement.scrollHeight` of 900px.** Not a degraded page — nothing. No
headline, no FAQ text, no footer links, and a viewport-height document. Railway
flagged the same gap at 53% of its text and said the vocabulary could not
distinguish it from a scroll reveal; this is the 100% case, and it reads `absent`
on every signal in the list. `scroll-reveal-blank` is the nearest and its own
definition — text crossing opacity under scroll — correctly exonerates the page,
because the text is all present and opaque at rest *once JS has run*. A
no-JS, print, prefetch or agent reader of this URL gets a blank document. That
is a worse robustness failure than any reveal gate in the corpus and the
vocabulary has no slot for it.

## Verdict

Net -7: one slop signal present against eight craft. That ties `vercel-com` at
the floor of the corpus and lands inside the exemplar band (-7..-2). The
distinguishing facts a second rater can check without agreeing with my taste:
zero centered headings on a 13726px page; a 5.4:1 display-to-body ratio; zero
pills, zero emoji, zero button gradients, zero violet, one SVG; two
`backdrop-filter` surfaces; and a deliverable-not-dashboard presentation that is
uncontested because the product has no UI.

The honest weak points are named above and they are `single-optical-anchor` and
`one-accent-discipline`. If a second rater reads the red problem field and the
blue closing field as two chrome accents rather than illustration grounds, and
takes the two-face scene as competing anchors, the count goes to 6 craft and the
net to -5 — still exemplar, which is why the verdict does not turn on either.
What would move it is `generic-sans-default` being joined by anything else, and
nothing else fired.

**v4 holes 7+2 / change 3b re-score**

Signal profile, decided before the prose: `shows-deliverable: present`
(value confirmed, basis replaced), `real-product-surface: present` (flipped
from absent).

*Capture.* Reused `s5/the-subvocal-company/walk.json`: 20 tiles,
`clamped: false`, `coverage: 1`, `worstLandingErrorPx: 0`, docH 13726 before
and after, scroller `window+rAF-pin`. Stitched (`NS_SESSION=s5`) to 4 strips,
13726px against page 13726px. The last strip (1440x926) ends in the footer:
wordmark "THE Subvocal Company", links "How it works / The prototype / Preorder
terms / Privacy / LinkedIn", "© 2026 The Subvocal Company". Read from strips.
Live DOM re-probe found three `<video>` elements, one more than the old prose
names: an 8s muted autoplay hero film at y0, the 91.767s demonstration at
y4402 (1344x756, `controls: true`, `muted: false`, `autoplay: false`,
`aria-label` "Subvocal launch video and silent speech prototype
demonstration"), and the 3.79s scroll-film clip at y6803.

*Video method.* Fetched the demonstration mp4 directly from its Cloudflare
Stream `downloads/default.mp4` URL; SHA-256 `8de9f4e2…1669`, byte-identical to
the copy a previous rater left in `video/`. 1920x1080, 30fps, has an audio
track. ffmpeg at 1fps (92 frames) for the survey, then `-ss` single-frame seeks
at 0.3-1s steps around each demo, laptop screen cropped from the 1920x1080
frame and upscaled 4x (LANCZOS) for the small labels. Audio was not
transcribed (no speech-to-text installed); the burned-in captions were read
instead.

*What the rig produces.* The laptop runs a full-screen state app with a
window title that reads approximately "Text Entry Mode" (blurred even at 4x;
treat the wording as a reading, not a quote). Each take cycles a coloured
field with a centred state label: yellow (label illegible), red "RECORDING",
mid-blue "PREDICTING" (top of the glyphs cropped by the bezel at 54s), green
"TEXT RESULT", dark blue "READY". Three takes:
- 0-15s: green "TEXT RESULT" builds "I'm" (10s) → "I'm speaking right now
  but" (11s) → "I'm speaking right now but you can't hear me" (13s), then
  READY. Correct.
- 49-62s: yellow (49s) → "RECORDING" (50-53s) → "PREDICTING" (54-56s) →
  "TEXT RESULT": "I can" (57s), "I can talk primately" (57.5s), "I can talk
  primately and nobody" (58s), "I can talk primately and nobody can listen"
  (59s), then "READY" holding the same line (60-62s); the line is still on
  screen in the close-up at ~66-67s under the caption "And now we have this
  palm-sized". The speaker meant "privately". The edit overlays a cartoon-
  monkey cutout and the caption "**PRIVATELY" at ≈58.0-59.3s (present in
  seeks at 58.2, 58.5, 58.8, 59.1s; gone at 59.4s). No retake follows; the
  misdecode is never replaced on screen.
- 78-88s: yellow (78s) → "RECORDING" (80-82s) → "PREDICTING" (83-85s) → "TEXT
  RESULT": "Reserve yours today" (86s, rendered over a ghost of "Reserve yours
  to"), "Reserve yours today at subvocal dot" (87s), "Reserve yours today at
  subvocal dot co" (88s). Correct. Then an end card "Preorder at
  https://subvocal.co" and black.
PREDICTING holds roughly 2-3s between RECORDING and the first word in both
filmed takes, but camera cuts fall inside the sequences, so this is not a
latency measurement and none is recorded. No take states a WPM, accuracy or
confidence value.

**Q1 `shows-deliverable`: present, confirmed, on a different artefact.**
The entry that could have embarrassed the vendor: the prototype's own output,
"I can talk primately and nobody can listen" (demo video, 57.5s onward),
shipped with the vendor's "**PRIVATELY" correction stamped on it (≈58.0-59.3s).
A misrecognition in the vendor's flagship demo, of the one word that carries
the page's privacy pitch, kept in rather than retaken. Part A: it is the
vendor's own decoder at work, and the content says the product got a word
wrong; that can count against the vendor however charmingly it is framed. The
gag does not neutralise it; it is the vendor conceding the error on camera.
Part B: a captured artefact (a camera recording of the real screen), readable
at playback size. Passes on stance and medium.

The audit's objection to the old basis is correct and is upheld. The three
destination panels (Claude Code "Add Google OAuth to the login flow. When the
user clicks the login button..." at strip y≈8966; Voice Agents "Find somewhere
for dinner near my next stop. Something small and quiet." at strip y≈10366;
"Glasses to glasses · Alex" "This party is a bit too loud. Let's go home?" at
strip y≈11100) and the typing panel ("Your words flow" strip y≈5876 → "Your
words flow at 200+ words per minute." strip y≈6500-6600) are page-authored
renderings with no entry that can embarrass: every message is a clean decode,
no error, latency, confidence or accuracy value appears, and "200+" is a floor
that only flatters. On those alone the signal would be ABSENT. The FAQ was
also searched (open-state capture `faq-open.png`, strip y≈12130-12380): "Up
close, someone may notice slight movement" and "Like any input method, it can
occasionally get something wrong" both narrow claims the page would gain from
leaving broad, but they are marketing prose, not product chrome, a captured
artefact, or a rendering of output, so they fail Part B and do not carry this
signal. The video is the only artefact on the page with an entry that can
embarrass, and it does.

**Q2 `real-product-surface`: present, flipped from absent.** The old "no UI
exists" category fact does not survive the frames. The prototype has a
software surface, the state app above, and the page ships a genuine camera
capture of it running on a real laptop, wired to the real rig (breadboard,
wired frames, the cables the speakers say "we won't need ... anymore"), producing text
including its own mistake. That is a genuine capture of the real product, not a
stylised or invented UI. The caveat, stated so a second rater can disagree: it
is a lab harness, not the shipping surface, and its evidence sits behind a play
button (the poster frame at y4402 shows only an unlabelled blue screen). The
page's own panels, by contrast, are a stylised rebuild and would fail this
signal by themselves.

*Video ruling.* The demonstration's evidence belongs to `shows-deliverable`
(and supplies `real-product-surface`), not to `live-claim-control`. A recorded
take is fixed content the vendor selected; the visitor can play it and listen
but cannot choose the input or steer the run, so it is not a control over a
live claim. What it carries is a product output whose content counts against
the vendor, which is exactly the shows-deliverable axis. `live-claim-control`
is not re-rated here; it still stands on the three scene buttons ("09:15 The
office" / "17:40 The train" / "19:30 Across the room"), which the old prose
showed are real controls, and its second-affordance paragraph should no longer
lean on the video.

*Drift from old prose.* (1) The `artifact-not-dashboard` paragraph's evidence
for the deliverable signal is withdrawn; the value survives on the lab video.
(2) The near-miss "`real-product-screenshot` is absent and that is a category
fact" is wrong: a software surface exists and is captured. (3) The old prose
described the 91.8s video as "two people at a desk, a laptop, a breadboard,
loose frames on the table" and never said what the laptop shows; it shows
three decodes, one of them a shipped misrecognition. (4) The page has a third
video (8s autoplay hero film) the old prose did not count. The previous
rater's unfinished crop of the laptop band is completed above.

**Corrections to the above, from an independent second pass on the same task.**
It reached the same two values and named the same entry, the `I can talk
primately and nobody can listen` misdecode, from its own reading of the
byte-identical mp4 (29,038,764 bytes, 91.767s). It reads two details
differently. Neither moves a value:

- **The yellow state label is legible: `BASELINE`.** The full cycle is
  therefore BASELINE / RECORDING / PREDICTING / TEXT RESULT / READY.
- **The misdecode is followed further, to about 76s.** The first pass last
  sights it in the close-up at about 66-67s; the second follows it through
  READY and into later shots until the screen changes at about 76s. An
  extension, not a contradiction, and it strengthens the reading above: the
  error is not a frame the edit passes over quickly, it is held for roughly
  eighteen seconds.

One measurement the first pass did not take, recorded because it bears on the
page's central claim rather than on either signal: audio sits at about
**-63 dBFS** (room noise) during all three decode windows, against -28 to -40
dBFS for the narration. The rig is producing text while nobody is audibly
speaking. These are the second pass's reads and are recorded as such, not
re-measured.
