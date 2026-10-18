---
source: https://puzzlesbox.lovable.app/
kind: site
cohort: ai-builder
verdict: mixed
studied: 2026-10-18
context: [nav, footer]
signals:
  gradient-blob: absent
  three-card-row: absent
  glass-card-overuse: absent
  emoji-as-icon: absent
  generic-sans-default: present
  symmetric-everything: present
  badge-pill-spam: absent
  generic-line-icon-set: unresolved
  testimonial-card-row: absent
  indigo-violet-accent: absent
  gradient-fill-cta: absent
  scroll-reveal-blank: absent
  typewriter-headline: absent
  stock-photo-generic: absent
  centered-hero-stack: absent
  hero-mockup-float: absent
  asymmetric-split: absent
  single-optical-anchor: present
  type-scale-high-contrast: absent
  editorial-grid-break: absent
  custom-type-pairing: absent
  real-product-surface: present
  shows-deliverable: absent
  density-variation: absent
  one-accent-discipline: present
  live-claim-control: absent
materials: [dual-theme]
---

**Sampling: random draw.** One of eight drawn with seed 20261018 from the thirty remaining gallery sites (pre-stated exclusions only: unreachable, blank, sign-in wall). Not chosen on any signal.

Rated by two independent blind raters on 2026-10-18, neither reading the other's draft. Both reached `mixed`. They agreed on 25 of 26 signals; the 1 split `generic-line-icon-set` (A present, B absent) are recorded `unresolved`, which never counts toward a rule. Both write-ups follow in full.

**Rater A.**

Rater A, blind, new page (no prior study). Puzzlebox is not a landing page: the
URL serves the product itself, a playable Sudoku / Wordle / Word Search app, in
one 995px viewport-and-a-bit. There is no hero, no features band, no social
proof and no pricing. **This is a thin page, and most of the 26 signals have
nowhere to fire.** The low counts on both sides below are partly that, not a
finding about restraint or about template use.

## 1. Capture facts

- Viewport 1440x900. `docH` 995 before and after the walk; scroller `window`,
  no inner-scroll candidates.
- 2 tiles, `clamped: false`, `coverage: 1`, reached 995px (second landing at
  95px). Stitched to one strip, 1440x995, equal to page height (stitcher: OK).
- The strip ends in the footer: a 65px band at y930, `MADE WITH CARE ·
  PUZZLEBOX`, centred, 12px uppercase at 0.2em tracking.
- The `Edit with Lovable` badge appears twice in the strip. It is a
  `position: fixed` `<aside>` injected by the builder platform, repeated across
  the two tiles, not duplicated content. It is excluded from every count below
  as platform chrome the page did not author.
- Studied state is the default load: Casual mode, Sudoku tab, Easy. Every
  other state was also walked by DOM (dark theme, Wordle tab 1041px, Word
  Search tab 933px, Competitive mode, More Games menu) for near-misses only.
- The board is generated per load (two loads gave two different grids), so the
  digits in the strip will not match a re-shoot.

## 2. Slop signals present (3)

**`generic-sans-default`.** `document.fonts` holds 0 faces and no `@font-face`
rule exists in any stylesheet. Body computes `ui-sans-serif, system-ui,
sans-serif, ...` (the Tailwind default stack); every control, tab, caption and
button label (19 visible sans leaves) resolves to the visitor's OS sans. The
only tracking is two utility presets on uppercase labels (0.05em on nav, tabs
and difficulty at 11-14px; 0.2em on the 10-12px tagline, caption and footer);
the 14px buttons and the timer run `letter-spacing: normal`. No size-indexed
tracking table compensates for the face (the edotenv discriminator), so this is
the acyclic reading: no typeface specified, the sans carried by the OS default.

**`symmetric-everything`.** On alignment counts, 70 of 76 visible text leaves
are `text-align: center` (16 of 22 excluding the 54 board and keypad digits).
The 6 `start` leaves are the logo lockup (2), two shrink-wrapped nav-pill labels
where alignment has no visual effect, the timer, and the platform badge. By
mass placement every block shares one axis: `main` 272-1168, the mode toggle,
the caption, the game tab bar, the 408px board (x516), the keypad (x506-934),
the action row (x502-938) and the footer all centre on x=720 to the pixel. The
two off-axis pairs are mirrors about x=720: logo at x296 against the theme
button ending at x1144, and the difficulty control at x296 against the timer
ending at x1144.

**`generic-line-icon-set`, on the literal definition.** 7 visible glyphs, all
`svg.lucide` at `stroke-width="2"`: gamepad-2, log-in, trophy (16px, tinted
accent) in the header pills; coffee and swords (14px) in the mode toggle;
chevron-down (12px); moon (16px). Five of the seven restate the label inside
the same button (`MORE GAMES`, `SIGN IN`, `HALL OF FAME`, `CASUAL`,
`COMPETITIVE`). One set, uniform stroke, uniform size within each row, carrying
nothing the label does not. Flagged: these are button-label glyphs, not
feature-card heads; see near-misses.

## 3. Craft signals present (3)

**`real-product-surface`.** The page is the live product in use, not a picture
of it and not a doorway to it. On load it presents a populated 9x9 Sudoku
(45 givens on Easy), a 1-9 keypad, Erase / Check / Reset / Reveal / New Puzzle,
and a millisecond timer, all operable without signing in. Sign-in exists only
as a nav link.

**`one-accent-discipline`.** Census of `color`, `background-color`, border and
`stroke` on every visible element, by max-min RGB chroma: one hue clears 40,
`rgb(231,100,68)` (chroma 163, hue about 12 degrees, vermilion), on 16
properties: two logo cells and the three header icons. Every other colour is a
warm neutral at chroma 0-24 (`rgb(251,245,232)` field, `rgb(29,20,13)` ink,
`rgb(95,83,71)` muted, `rgb(217,207,195)` rules). Dark theme keeps the same
single hue at `rgb(245,112,80)`. Competitive mode spends the same accent on its
active pill. The Wordle tab adds a green `rgb(71,156,77)` and a yellow
`rgb(227,174,40)` as two 20px legend swatches; those are the game's tile
semantics (the Wordle convention the product implements), excluded under
SCOPE, and off the studied state in any case.

**`single-optical-anchor` (rule-ineligible, undefined; honest call).** The
anchor counted is the Sudoku board: 408x408 at x516 y358, framed by a 2px
near-black border, the only object on the page over 50px tall. The nearest
competitors are the 384x46 tab bar and three small black fills (the active
`CASUAL` pill with a hard 3px offset shadow, the active `SUDOKU` tab, and
`New Puzzle`), which out-weigh the board per pixel but not in total. Stated
plainly: **one mass dominates because there is only one mass.** The board is
the product's play surface, not a composed hero, so this records a fact about
an app layout more than a compositional decision.

## 4. Near-misses

- **`generic-line-icon-set`** (present) goes absent on a feature-card reading:
  the page has no feature section, and toolbar glyphs inside labelled buttons
  are ordinary app iconography. The referable-dev precedent scored the literal
  definition on 17px list bullets, so I followed the literal one. Absent gives
  net -1.
- **`single-optical-anchor`** (present) goes absent if "only one mass" is
  disqualifying. Net +1.
- **`symmetric-everything`** (present): a Sudoku grid is centred almost by
  necessity, so the measurement may be recording the genre rather than a
  choice. The measurement itself is unambiguous (every block's centre at
  x=720), so it stands.
- **`generic-sans-default`** (present) could be read absent on voice: the
  serif carries 55 of 76 visible leaves (the wordmark, all 45 givens, the 9
  keypad digits) at 18-20px. But that serif is `ui-serif, Georgia, ...`, the
  Tailwind `font-serif` default, and every reading-text and control leaf is the
  OS sans. Absent gives net -1.
- **`custom-type-pairing`**, absent. The role split is deliberate and
  consistent: serif for puzzle content and the wordmark, sans for chrome, mono
  (`ui-monospace`) for the timer. But all three are CSS generic keywords and 0
  faces load; the neuron-industries ruling holds that crediting a pairing of
  two defaults while `generic-sans-default` fires on one of them is incoherent.
- **`type-scale-high-contrast`**, absent and not close: `ladder.cjs` gives
  18px over 16px body = 1.13:1 (largest lettered node is the 18px `Puzzlebox`
  wordmark; board digits reach 20px but carry no letter).
- **`shows-deliverable`**, absent. The deliverable is a generated puzzle, and I
  could not name an entry that counts against the vendor. Ten boards were read
  off the DOM and solved: every one has consistent givens and exactly one
  solution, at 45 / 35 / 27 givens for Easy / Medium / Hard. (A first pass
  appeared to show Medium at 45 givens; that was my read lagging the
  regeneration by one click, confirmed by grid signatures, not a product
  defect.) Nothing on the studied state shows the product declining or failing.
  The one unflattering string found, `SLOW DOWN — WAIT A FEW SECONDS BEFORE A
  NEW PUZZLE.`, is a toast my own rapid clicking triggered, not page content.
- **`live-claim-control`**, absent. Everything on the page is a control, but
  the page makes no falsifiable claim for one to test: the only claim text is
  `DAILY BRAIN WORKOUT` and the mode caption. ("AI-generated Sudoku" lives only
  in the meta description, not on the page.) `Check` validates the visitor's
  entries, which is the game, not a test of an assertion. Present gives net -1.
- **`centered-hero-stack`**, absent: there is no hero. The `h1` is the 18px
  wordmark, start-aligned at x338 inside the header; the centred column below
  is a stack of app controls with no headline, subhead or CTA. A rater reading
  the centred control stack as the hero gets present, net +1.
- **`badge-pill-spam`**, absent. 7 pill-shaped elements above the fold (three
  nav pills, the mode toggle and its active pill, the tab bar and its active
  pill); all 7 are interactive. Zero decorative. Competitive mode adds one
  decorative `COMPETITIVE RUN` pill, off the studied state and below 3.
- **`glass-card-overuse`**, absent: 0 `backdrop-filter` surfaces at rest.
  Competitive mode adds one visible `blur(8px)` overlay (848x408) that hides the
  board until `Ready`: a functional mask, not a glass card, and 1 is under 3.
- **`density-variation`**, absent. Ink coverage per band (every second pixel,
  summed RGB delta over 60 from the `rgb(251,245,232)` field, platform badge
  excluded): header 5.16%, mode and caption 3.68%, tabs 6.00%, difficulty row
  1.43%, board band 3.03%, keypad and actions 4.55%, footer 4.15%. A 4.6 pp
  spread across one screen: one texture throughout.
- **`scroll-reveal-blank`**, absent: 0 visible text leaves under 8% effective
  opacity at rest, 0 running animations, `docH` 995 before and after. Nothing is
  hidden, so the dwell control is moot.
- **`typewriter-headline`**, absent: `innerText` identical (371 characters) at
  6s and 12s after load with no interaction. The timer does not run until play.
- **`emoji-as-icon`**, absent: 0 `Extended_Pictographic` code points in the
  default, dark, Wordle, Word Search and Competitive states.
- **`gradient-blob` / `gradient-fill-cta`**, absent: 0 elements with a
  gradient `background-image` in any of the five states; `New Puzzle` is a flat
  `rgb(35,24,15)` fill.
- **`context`** is `[nav, footer]` because the vocabulary has no slot for a
  playable app surface; the main band is neither `dashboard` nor `hero`.
  Context backs no rule. `kind: site` per the brief template, though `tool`
  would also describe it.

## 5. Verdict

**`mixed`, net 0** (3 slop present minus 3 craft present). Every combination of
the near-misses above stays inside the mixed band: the reading least
favourable to the page (anchor absent, centred control stack read as a hero)
reaches +2; the most favourable (icon set absent, sans read as serif-voiced,
live-claim present) reaches -3. Nothing reaches +4, so `slop` is not available
on the count, and no comparison with deepmark or stripe-2014 is needed to
refuse it.

It is not an `exemplar` either. Net 0 is short of the exemplar band (-8..-2),
and the craft it scores is thin: `real-product-surface` is present because the
page *is* the product, `single-optical-anchor` because there is only one mass,
and `one-accent-discipline` on a palette of one hue. The slop it scores is
equally thin: a default type stack, a centred axis a Sudoku layout nearly
forces, and five toolbar glyphs. None of the AI-template furniture the cohort
was harvested for appears: 0 gradients, 0 glass, 0 indigo, 0 card rows, 0
stock imagery, 0 scroll gating. This is a small, coherent web app on one 995px
screen, rated on a vocabulary built for marketing pages, and the honest result
is the middle.

**Rater B.**

Rater B, blind. Puzzlebox is not a landing page for a product: the root URL is
the product. It loads straight into a playable Sudoku board (mode toggle, game
tabs, difficulty, timer, 9x9 board, keypad, five action buttons) between a thin
header and a one-line footer. There is no hero, no headline, no feature band, no
pricing and no social proof. Most of the 26 signals therefore have nowhere to
fire, in both directions, and the profile below should be read as a thin page's.

**Capture.** 1440x900 viewport. `shoot-tiles.cjs`: `docH` 995 before and after,
scroller `window`, no inner-scroll candidates, 2 tiles, `clamped: false`,
`coverage: 1`, landings 0 and 95 (the page only scrolls 95px).
`NS_SESSION=s5 stitch.py`: 1 strip, 995px against a 995px page, no drift. The
strip ends in the footer, `MADE WITH CARE · PUZZLEBOX` at about y960. The "Edit
with Lovable" badge appears twice in the strip; it is one `position: fixed` node
(one text leaf in the DOM) caught by both tiles, not duplicated content. It is
host chrome injected by the builder (123x24, neutral `rgb(27,27,27)` /
`rgb(197,193,185)`) and moves no signal. Network: 12 responses, 8 scripts, 1
stylesheet, 1 document, 2 analytics beacons, 0 fonts, 0 images. The board is
generated client-side and differs on every load (three loads, three boards).

The scored state is the URL as it loads: Casual mode, Sudoku tab, Easy. I also
opened Wordle, Word Search, Competitive, the More Games menu (one item,
`WORDSCAPES`), the dark theme and `/leaderboard` to know what the page is, but
the other tabs are product states and `/leaderboard` is another route; neither
is scored.

**Scope.** The page has no embedded product surface because it has nothing
else. I applied the SCOPE rule this way: the page's own layout (the column,
the header, the bands and their alignment, the controls' chrome) is the page
deciding about itself and is scored; the interior of the board (cell digits,
the 3x3 box rules, the colour of player-entered digits) is product content and
is not.

### Slop signals present (2)

**`generic-sans-default`.** No webfont ships. `document.fonts` holds 0 faces,
the 90,244-byte stylesheet has 0 `@font-face` rules, and the network log has 0
font responses. Every sans leaf computes Tailwind's default `font-sans` stack
verbatim, `ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", ...`,
and that stack carries all of the chrome: nav labels, mode toggle, mode caption,
game tabs, difficulty tabs, action buttons, footer (19 of 21 non-digit visible
leaves; the other two are the serif wordmark and the mono timer). The serif and
mono are Tailwind's default `font-serif` (`ui-serif, Georgia, Cambria, ...`) and
`font-mono` stacks, also verbatim, read off `--font-serif` / `--font-sans` on
`:root`. Same finding as prilo-ai and basecamp-2014 (system stack, no webfont).
Railway's discriminator does not rescue it: the tracking is three Tailwind
presets (`tracking-tight` -0.45px on the 18px wordmark, `tracking-wider` 0.55px
on 11px labels, `tracking-[0.2em]` 2px on 10px labels), not an authored per-size
ramp.

**`symmetric-everything`.** Measured the corpus way, on alignment and a shared
centre axis. Of 21 visible non-digit text leaves (Lovable badge excluded), 16
compute `text-align: center` and 5 `start`. Every band in `<main>` sits on
x=720: the mode toggle (x601, w238, centre 720), the mode caption (x296, w848,
centre 720, `text-center`), the game tabs (x528, w384, centre 720), the board
(`mx-auto`, 408px, centre 720), the keypad and the five-button action row
(spanning x502-938, centre 720). The footer line is centred on 720. The only
two non-centred rows, the header (logo left, nav right) and the difficulty/timer
toolbar (Easy/Medium/Hard left, `0:00.000` right), are `justify-between` across
the same 848px column, x296-1144, which is itself mirrored about x=720 (296px
margin each side). Nothing on the page breaks the axis. There are no section
headings to count (the only H1 is the 18px wordmark), so this rests on bands and
leaves, not headings as in permit-guide-ai.

### Craft signals present (3)

**`single-optical-anchor`** (rule-ineligible, undefined; my honest call). The
anchor is the Sudoku board: 408x408 = 166,464 px², 2px ink border, 45 bold 20px
serif givens. The next-largest bordered or filled mass is the game-tabs pill at
384x46 = 17,664 px², 9.4x smaller, and the only other dark marks are three small
filled controls (Casual 94x29, Sudoku tab 112x36, New Puzzle 109x36). It
dominates, and it dominates largely **because there is only one mass**: the page
is one object in a column of thin control strips. I am recording present because
the eye has exactly one place to land, but a rater who requires the anchor to
win against competing masses would have nothing to measure it against.

**`real-product-surface`.** The page is the live product, not a picture of it,
and the product has answered: it has generated a puzzle. The doorway rule does
not bite, because this is not a sign-in form or an install line; the sign-in is
a nav link and the first screen is the game in use. I checked that the surface
is genuine rather than a static prop: the board read from the DOM had 45 givens,
0 duplicates in any row, column or box, and exactly 1 solution (backtracking
solver, limit 2); clicking Reveal filled the 36 empty cells and the filled grid
matched both the givens and the solver's solution cell for cell.

**`one-accent-discipline`.** One chromatic hue: `--accent`, computed
`rgb(231,100,68)`, chroma 163, hue about 12° (red-orange). In chrome it appears
on the two accent squares of the 4-square CSS logo (12x12 each) and on three
16px Lucide glyphs in the nav (gamepad-2, log-in, trophy). Inside the board it
colours player-entered digits, which is product content. Every other colour is
a warm neutral by max-min chroma: ink `rgb(29,20,13)` 16, primary/CTA fill
`rgb(35,24,15)` 20, muted text `rgb(95,83,71)` 24, paper `rgb(251,245,232)` 19,
card `rgb(254,250,241)` 13, border `rgb(217,207,195)` 22, muted fill
`rgb(238,231,219)` 19. One accent, held.

### Near-misses

- **`live-claim-control`, absent, and the closest call.** Every control on the
  page is live: the board takes input, Check verifies it, Reveal shows the
  solution, New Puzzle regenerates, and a visitor could falsify "this is a valid
  puzzle" with them (I tried; it held). But the signal needs a stated central
  claim, and the page states none. Its only visible statements are the tagline
  `Daily brain workout` and the mode caption `Casual — board visible, scores go
  to the casual board`; neither can be falsified by a control on the page (the
  score half needs an account). "Play AI-generated Sudoku and Wordle" exists only
  in the `<meta name=description>`, which no visitor sees. The controls are the
  product operating, already credited under `real-product-surface`. Flipping it
  gives net -2; the verdict does not move.
- **`shows-deliverable`, absent.** The deliverable is the generated puzzle, and
  the procedure asks me to name the entry that could embarrass the vendor. I
  cannot: the board is valid and uniquely solvable (measured above), so every
  entry is the correct one. An invalid or ambiguous AI-generated board at 20px
  would have been the product erring in plain view and would have passed; this
  load did not produce one. The one unflattering artefact I saw, the
  `/leaderboard` route listing `Owner 0:17.340` (the owner's own test run) and
  two boards reading `BE THE FIRST`, is on another route and not scored.
- **`generic-line-icon-set`, absent.** One Lucide set, stroke-width 2: gamepad-2,
  log-in, trophy, moon (16px, header) and coffee, swords (14px, mode toggle).
  Five of the six repeat the label beside them, which meets the emptiness half
  of the definition. Held absent on the corpus's position reading
  (financial-datasets, neuron-industries): none sits in a feature-icon position
  beside a heading; they decorate nav and toggle buttons, and the set is not
  uniform in size (16 vs 14). Flipping it gives net 0; still `mixed`.
- **`centered-hero-stack`, absent.** The first viewport is a centred stack, but
  of controls and a game board, with no headline, subhead or CTA. There is no
  hero to be a stack. The centring is recorded under `symmetric-everything`
  instead, so it is not lost.
- **`badge-pill-spam`, absent.** Above the fold there are 8 `rounded-full`
  bordered or filled shapes in uppercase tracked type (3 nav buttons, the
  2-segment mode toggle, the 3-segment game tabs). Each is a working control;
  none is a decorative badge. They look like pills and are not spam.
- **`custom-type-pairing`, absent.** The role split is real and consistent:
  serif for the wordmark and for puzzle glyphs (board digits, keypad, the word
  search grid and word chips), sans for every control, mono for the timer. But
  all three faces are Tailwind's unmodified default stacks, nothing is loaded,
  and the serif resolves to New York on macOS and Georgia elsewhere. A pairing
  of framework defaults is not custom.
- **`density-variation`, absent.** Outside the board every band is the same
  register: 10-14px uppercase tracked labels in thin pills with wide gaps. The
  only dense block is the board's 81 cells, which is product content under the
  scope reading. One band, no rhythm to vary.
- **`type-scale-high-contrast`, absent.** `ladder.cjs`: largest lettered node
  is the 18px wordmark, body 16px, ratio 1.13:1, far below the 3.75:1 floor.
  The 20px board digits have no letter and would give 1.25:1 anyway.
- **`scroll-reveal-blank` / `typewriter-headline`, absent.** 0 text leaves under
  8% effective opacity at rest, 0 running CSS animations, and the page only
  scrolls 95px, so nothing can be scroll-gated and the dwell control is moot.
  `document.body.innerText` is identical (371 characters) at 2s, 8s and 14s.
- **`glass-card-overuse`, absent.** 0 computed `backdrop-filter` surfaces at
  rest (the stylesheet carries 4 such utilities; none is applied on the scored
  state). **`gradient-blob` / `gradient-fill-cta`, absent:** 0 elements with a
  `background-image`; the CTA, New Puzzle, is a flat `rgb(35,24,15)` fill.
- **`materials`.** `dual-theme`: the moon button sets `html.dark`, body goes to
  near-black `lab(5.2 2.2 3.4)` with `lab(94.2 ...)` text. Light is the default;
  the stylesheet has no `prefers-color-scheme` query, so the theme is a toggle,
  not system-following. No images, video, canvas or illustration: the logo is a
  CSS 2x2 grid.
- **`context`.** Only `nav` and `footer` map. The main band is the game itself,
  and the vocabulary has no value for an app surface; `dashboard` would imply a
  data dashboard, so nothing was invented.

### Verdict: `mixed`, net -1

2 slop present (`generic-sans-default`, `symmetric-everything`) minus 3 craft
present (`single-optical-anchor`, `real-product-surface`,
`one-accent-discipline`) = **net -1**, inside the mixed band (-6..+3) and
outside both the exemplar band (-8..-2) and the slop floor (+4). It stays
`mixed` under every near-miss flip I recorded (`live-claim-control` to -2,
`generic-line-icon-set` to 0).

I am not rounding toward `exemplar`, and the reason is measurable: this is a
995px, one-viewport page with 21 non-digit text leaves and no marketing
sections. Fourteen of the sixteen slop signals are absent, and five of those
(`three-card-row`, `testimonial-card-row`, `centered-hero-stack`,
`hero-mockup-float`, `stock-photo-generic`) had no section to fire in at all.
Two of the three craft credits are near-automatic for any app served at its own
root: `real-product-surface` because the product is the
page, and `single-optical-anchor` because the page holds one object. The
measured restraint that is genuinely earned is narrow: one held accent on warm
neutrals, no gradients, no glass, no stock. Against that, the type and layout
are framework defaults throughout (three unmodified Tailwind stacks, 0 webfonts,
a 1.13:1 type ladder, every band on one axis).

**Vocabulary note.** The 26 signals assume a marketing page that shows a
product. When the page is the product, `real-product-surface` fires trivially
and `live-claim-control` has controls but no stated claim to attach them to, and
`context` has no slot for the surface that fills the page. A rule emitted from
either craft signal would credit every app-at-root for existing.
