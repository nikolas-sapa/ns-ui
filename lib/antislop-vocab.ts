// The closed vocabulary every evidence file and rule is validated against.
// Decided in docs/superpowers/specs/2026-10-11-vocabulary-v3.md after 20
// evidence files invalidated a third of the list written before any site
// was studied. Adding a name here is a deliberate act: scripts/build-antislop.ts
// rejects anything outside these arrays, which is what keeps the counts
// meaningful. See the v2 doc for why each rename was forced.
//
// No I/O, the way lib/css-tokens.ts is the single source for the token line.
// There is one signal namespace and no third class: whether a signal may back
// a rule is computed from the evidence, not declared here.
// SCOPE, and it applies to EVERY signal below, not just the ones whose notes
// repeat it. **Marketing chrome is the unit of analysis. Content inside an
// embedded product surface is not scored.** A product screenshot, a dashboard
// clone, a terminal transcript or a simulated app window is a thing the page
// is showing, not a decision the page is making about itself.
//
// This was attached only to badge-pill-spam in v3 and every session has paid
// for that. railway-com set the precedent twice (U+2713 inside JetBrains Mono
// log lines is captured output, not an icon; the six-series chart palette
// inside the Observability capture is data colour). In session 4 one rater had
// to extend it by analogy to three more signals in a single sitting —
// three-card-row on a 4-up of job-match cards inside a dashboard clone,
// emoji-as-icon on 7 checks used as diff markers, one-accent-discipline on
// pastel card fills and iOS blue — and the session's own rating brief got that
// card row wrong until a screenshot was opened.
// See docs/superpowers/specs/2026-10-14-vocabulary-v4-proposal.md, change 4.
//
// WHEN THE PAGE IS THE PRODUCT. Six of the eight randomly drawn ai-builder
// pages serve the product at the root URL: a dashboard (dachly), a feed
// (correlation-studio), a Sudoku (puzzlesbox), two generators (luna-vos,
// sakura-name-sparkle). Nothing is embedded, so SCOPE above excludes nothing:
// the product's own interface IS the page's chrome, scored as its decisions.
// Every rater on those pages reached that independently. Two limits:
//   - DATA IS NOT CHROME. Feed items, generated output, puzzle digits and
//     other values the product renders are content, as captured output is on
//     a marketing page. Style the product applies around them is chrome
//     (correlation-studio: module framing scored, chips inside items not).
//   - SCORE AT REST. What renders on load and on scroll, not what a click
//     opens. Marketing pages are rated without opening menus; a product page
//     is not rated deeper. Settled dachly's `emoji-as-icon`, whose only
//     emoji sit in a panel one click away: absent.
// `real-product-surface` and `live-claim-control` fire on such pages by
// construction. Every rater recorded that and none read it toward `exemplar`.
export const SLOP_SIGNALS = [
  "gradient-blob",
  "three-card-row",
  "glass-card-overuse",
  "emoji-as-icon",
  "generic-sans-default",
  "symmetric-everything",
  "badge-pill-spam",
  "generic-line-icon-set",
  "testimonial-card-row",
  "indigo-violet-accent",
  "gradient-fill-cta",
  "scroll-reveal-blank",
  "typewriter-headline",
  "stock-photo-generic",
  // centered-hero-stack and hero-mockup-float are expected to fail
  // eligibility — pre-AI conventions, kept as recorded facts, not rules.
  "centered-hero-stack",
  "hero-mockup-float",
] as const;

// COLOUR: `satPct` is not a measurement, and it was fed to raters as one. It
// is HSL saturation, `(mx-mn)/(255-|mx+mn-255|)`, whose denominator collapses
// toward zero as luminance approaches white. `#FBFAF7` -- visually paper --
// scores 0.333, clears the 0.18 gate, and floors into one hue bucket, so an
// off-white page reads as fully saturated. The sharpest case: `rgb(253,252,252)`
// scores 20% on a 0.02 margin, and `rgb(252,252,252)` scores 0.
//
//   USE MAX-MIN RGB CHROMA.     chroma = max(r,g,b) - min(r,g,b)
//
// It is the number that behaves: the four documented false positives fall from
// 72-98% to chroma 1, 3, 4 and 16, while a real accent (#006bff, chroma 255)
// and a red CTA (chroma 182) stay far above any gate. `probe3.cjs` now emits
// `chromaPct`; its `satPct` is kept only for comparability and is labelled as
// the lying one on the payload itself.
//
// KNOWN LIMIT, so the replacement is not over-read: chroma is necessary, not
// sufficient. `osseus` cream has a real, subtle all-over tint (chroma 16),
// which no per-pixel threshold can separate from an accent. Deciding whether
// low-level chroma is a BACKGROUND FIELD or an ACCENT takes the per-element
// decomposition `osseus`'s rater ran, not a threshold.
//
// The rule that travels: a NUMBER FROM A DERIVED INSTRUMENT IS A CLAIM, NOT
// EVIDENCE. `satPct` was in four rater briefs as a "finding" and four raters
// spent their effort disproving it. `chromaPct` replaces it; neither belongs in
// a brief as an established fact without the reading that produced it.
//
// `type-scale-high-contrast` has a MEASUREMENT PROCEDURE and a necessary
// threshold, derived at n=42 and stated here because the signal shipped in v3
// with no threshold and no stated altitude, and two session-4 raters had to
// interpolate one. See the v4 proposal, change 1.
//
//   ratio = largest text node containing at least one letter, nominal
//           font-size, divided by getComputedStyle(document.body).fontSize
//
// Below 3.75:1 the signal is ABSENT. Necessary, not sufficient.
//
// Both halves were measured rather than chosen. Two denominators were run head
// to head over all 42 files: body computed font-size misclassifies 5/42 at its
// best cut of 3.75; the adjacent hero subhead misclassifies 8/41 at 3.33. Body
// wins, which also retires railway-com's own framing ("54/20 = 2.7:1 against
// the hero subhead, 3.4:1 against 16px body") — at 3.4 against body it falls
// below the cut and agrees.
//
// "At least one letter" is the display-term rule and it is narrower than it
// looks: requiring two words excluded grep.ai's "$ 2.89" and "78.6" correctly
// but also rejected anthropic.com's "Haiku 5.5", which IS the headline,
// dropping that page to a false 1.2:1.
//
// NOT SUFFICIENT, and this is the part to respect: five files sit at exactly
// 3.75:1 — databuddy, decent-com and nxtcure-labs scored present, deepmark and
// neuron-industries absent. Identical measured ratio, opposite calls. So
// something other than the ratio decided those five, the threshold rules out
// rather than ruling in, and no existing value was changed on its strength.
// scripts/antislop/ladder.cjs implements the procedure.
// `real-product-surface` — renamed from `real-product-screenshot` (change 3b,
// addendum hole 6). The old name keyed the signal to a FORMAT when the thing
// worth recording is GENUINENESS, and at n=42 that cost four files.
//
//   satisfied by a genuine capture OR a faithful live rebuild of the real
//   product; failed by a stylised or invented UI.
//
// The asymmetry it closes: `hero-mockup-float` penalises a FAKE UI, the old
// `real-product-screenshot` credited a CAPTURED UI, and nothing covered REAL
// BUT UNCAPTURED. Two files read `absent` under the old name while plainly
// showing their product — financial-datasets rebuilt live (network log: 5
// image responses of 59, four of them logos; DOM walk: zero canvas, video,
// iframe, CSS `url()` or `data:` URI; inline-SVG census: 37 glyphs, largest
// 20x20, none containing `<text>`), railway-com drawn in vector (all five
// product visuals SVG with live `<text>` and zero `<image>`) — and two more,
// clerk-com and grep-ai, held `present` only on the convention. financial-
// datasets showed its product HARDER than a screenshot can: interactive,
// selectable, accessible, theme-aware, and structurally incapable of being a
// stale or doctored capture.
//
// CORRECTED 2026-10-16: this block first read "three files ... `grep-ai`
// page-authored replicas ... and a fourth, clerk-com". grep-ai is not a third
// `absent`. It reads `present` at every commit from its origin (0d196ebe)
// through HEAD, and its own prose says so: "`real-product-screenshot` stays
// `present`, flagged ... a **fourth** instance". It belongs in the convention
// group with clerk-com, which is where it now sits. The addendum that seeded
// the sentence carried the same mis-grouping; the count of affected files (4)
// was right, the split was not. Correcting prose is not a re-score: no value
// moved, and grep-ai's `present` is still flagged as one of hole 6's cases.
//
// It still catches the slop case the signal was built for: a glassy fake
// dashboard floating in a hero is an invented UI and fails.
//
// THE DOORWAY IS NOT THE SURFACE. The product surface is what the product
// presents IN USE, not the act of reaching it. A faithful command line with no
// prompt and no output, a sign-in or sign-up form, an install snippet: each is
// real, and each fails, because the product has not answered yet. Settled at
// n=42 on acyclic, whose four CLI commands were checked flag by flag against
// the shipped binary (`@acyclic-labs/cli-linux-x64@0.0.6`) and are entirely
// genuine, while the product's own screens (`--watch` progress, the
// dashboard, the merged patch) appear nowhere. Same shape as dropbox-2014's
// real sign-up forms (the account gate, not Dropbox) and browserbase-com.
// Counter-case, so the rule is not over-read: stripe-2014's Checkout form IS
// the product — the screen Stripe sells to merchants — and passes even with
// empty fields.
//
// NOT the same question as `shows-deliverable` (medium vs content) and NOT the
// same question as hole 8 (is the CONTENT sourced or fabricated). This signal
// asks only whether the SURFACE is the real product. A faithful rebuild
// populated with invented data is `present` here and is judged on its content
// by the other two.
//
// A RE-PASS RE-INTERPRETS THE PAGE AS STUDIED. These pages change under you:
// of the fourteen re-passed at n=42, decent-com had removed the band its
// deliverable rested on and aviern had replaced its hero and gained a video,
// both since their `studied` date. Flipping one signal to the redesign leaves
// a file describing two pages at once. So a re-pass asks whether the STUDIED
// page passes the new wording; a redesign triggers a full re-study (every
// signal, the verdict, the `studied` date), never a single-signal flip. A flip
// that corrects a capture miss on the same page is fine: stripe-2014's
// Checkout slides were on the studied snapshot all along, behind a carousel
// pinned to another slide.
//
// RENAME ONLY as applied: no value moved with it. All 42 evidence files carry
// the signal — the rename is global scope, so every front-matter has one and
// the old key survives nowhere — and they are being re-passed against this
// wording by independent raters, one per file, the way change 3's rename was
// followed by its re-score. The set that actually needs the pass is the
// `absent` ones, not the `present` ones: a widening definition puts every
// `absent` file at risk, so the re-pass set is the inverse of the one the
// addendum named.

// `shows-deliverable` — THE AXIS IT IS ON, and THE MEDIUM THAT COUNTS. Change 3
// split this signal from `real-product-screenshot` and left both questions
// open. Seven independent raters then hit them, one per file, at n=42. Settled
// here. See the change-3 addendum, holes 2 and 7.
//
// ---- PART A, the axis (hole 2) ----
//
// v3 gave three examples and they are not obviously the same kind of thing. "A
// priced comparison with real refusals" is vendor COMMERCIAL SUBSTANCE; "a
// force-vs-time chart" is the product's OUTPUT. A SaaS page with an honest
// pricing table and no output artefact is present on the first reading and
// absent on the second — the same two-axis conflation change 3 just removed
// from the screenshot pair, surviving inside one signal.
//
// They unify under railway-com's test, and the test is the definition:
//
//   WHOSE WORK DOES THE ARTEFACT SHOW, AND DOES ITS CONTENT CARRY ANYTHING
//   THAT COULD COUNT AGAINST THE VENDOR?
//
// All three v3 examples pass. A priced comparison with real refusals carries
// content against the vendor. A claims ledger enumerates assertions so each
// can be checked. A force-vs-time chart is one unit of the product doing its
// job and could have shown a failure.
//
// THE PROCEDURE, and it is the clause that actually discriminates. NAME THE
// ENTRY THAT COULD HAVE EMBARRASSED THE VENDOR. If a rater cannot point at one
// in the scored content, the signal is ABSENT. Run over the applied `present`
// scores at n=42 by thirteen auditors, one per file, this separated them
// cleanly and the "whose work" clause alone separated only one file, so the
// refusal is the load-bearing half:
//
//   passes, with the entry named — grep-ai `This evaluation used a Claude
//   agent baseline, not Codex. Savings vary by workload.` under its own 91%
//   claim, plus a competitor ticked at parity and its own `56.27/100`;
//   financial-datasets publishing its worse past accuracy (`96.10`) on a
//   95-100% axis beside a live sec.gov `filing_url`; neuron-industries
//   keeping `Certifications: UL + CE (planned)` on the flagship column;
//   decent-com answering "Every option you can get, priced." with two of six
//   rows `Not allowed` / `Too small` (as captured 2026-10-10; a redesign had
//   removed the band by 2026-10-16, so the example is dated, not live);
//   capveon closing its queue `Four approved in one click each. One
//   escalated.`; silica authoring its own
//   joint reading as applied force plus Gaussian noise (`gauss()*.8`), so at
//   the 2.0 g rest load its own sensor reads 0.3-3.8 g, under a heading
//   claiming it can feel "as light as a paperclip"; railway-com's own error log
//   carrying a WordPress scanner probing a non-WordPress app.
//
//   fails, and the absence is the finding — a dashboard with no error row, no
//   4xx, no timeout and a `GPU Utilization 94%` that is the top of a bounded
//   range; a card deck where nothing shows the product declining, failing or
//   costing; a capability diagram whose only quantity is "a billion possible
//   scenarios", which can only flatter by being larger.
//
// WHOSE FAILURE COUNTS, settled across 16 raters at n=42. An unflattering
// entry counts when it is the product's own operation or unscrubbed output,
// and NOT the capability the panel is selling. stripe-com's `Disputed` and
// `Refunded` rows are excluded: the panel's own callouts sell dispute
// handling. papaya's and linear-app's customer failures are excluded: catching
// them is the pitch. clerk-com's `Okta - HospitalB` / `Error` sync row counts
// though Okta may be at fault, as railway-com's scanner probe counts though
// Railway did not send it: nothing on either page sells error display.
//
// THE ENTRY MUST BE LEGIBLE AT PAGE SIZE, in CSS px as rendered. A reader
// cannot audit text they cannot read. basecamp-2014's "Still only 8 of about
// 40 attendees actually showed up" is a genuine concession and does not count
// at about 4 CSS px; heroku-2014's add-on prices fail the same way. Video is
// judged at its INLINE rendered size, not fullscreen: sona8's "58 of 203
// statements fit none of the 5 themes." renders at about 4px in a 558px player
// and fails, where aviern's missed shrub (about 37x50 CSS px, 45 of 49 frames)
// is visible at normal playback and counts.
//
// A refusal counts when it narrows a claim the page would benefit from leaving
// broad (hole 1). neuron-industries keeps `Certifications: UL + CE (planned)`
// on the flagship column rather than omitting the row; grep-ai leaves a
// competitor's cost cell `Unconfirmed / Preview pricing incomplete` rather
// than filled in, and ticks `Managed execution` for all six vendors including
// competitors. Without that test the signal fires on any three-column pricing
// grid, because "Enterprise only" is a differentiator wearing a refusal's
// clothes.
//
// "AUDIT" IS NOT A PROVENANCE TEST, AND THIS IS THE PART RATERS GET WRONG.
// Thirteen auditors ran this test over the applied scores, one per file, and
// three read "audit" as "trace the content to a real measurement" — which
// flips seeded and
// self-labelled demo data to absent on provenance grounds. That is hole 8
// (sourced vs fabricated content), it is a SEPARATE AXIS, and it has not had
// its pass. railway-com's own ruling forecloses the reading: its split-flap
// board was verified genuinely live, a runtime fetch returning
// `totalDeploymentsLastMonth: 209533282` ticking against a read 15 minutes
// earlier, and is STILL absent — "precision and liveness are properties of
// the rendering, not of the content's relation to the reader." Maximum
// provenance, no credit. So provenance neither earns this signal nor forfeits
// it. Seeded or self-labelled example content is scored on WHAT IT SAYS: a
// demo that shows the product declining, costing or failing passes; a demo
// where every value is the flattering one does not, and it fails on stance,
// not on being a demo.
//
// PRECEDENT, cohort-wide: A VENDOR-AGGREGATE STATISTIC IS ABSENT HOWEVER WELL
// BUILT. Every row of railway-com's board can only flatter by being larger, no
// entry can embarrass, and those 209 million deployments are things Railway's
// CUSTOMERS did — it measures aggregate adoption, not the product's output on
// any job. It is "10,000+ teams trust us" with real plumbing behind it.
// Otherwise every odometer scores present and the signal collapses into "has a
// nice number".
//
// ---- PART B, the medium (hole 7) ----
//
// This clause exists because without it the fix undoes itself. The deliverable
// may be shown AS product chrome, AS a captured artefact, OR AS A
// PAGE-AUTHORED RENDERING OF THE PRODUCT'S OUTPUT. What disqualifies is
// unreadable or placeholder content, NOT the authoring medium.
//
// The change-3 wording named two positions — the deliverable as chrome, and
// via the hard case the deliverable inside chrome. Pages occupy a third.
// tsenta's strongest content is a page-authored HTML panel under a marketing
// eyebrow, containment probed directly at `inClone: false`: a scored shortlist
// keeping `Senior Frontend Engineer · Stripe` 92% against three refusals
// struck through in real CSS `line-through` at 18-31%, each explained by its
// own row content. Not a screenshot of a running app, not an exported file.
// Under change 3 alone a rater can call that "just a marketing graphic" and
// score absent, LANDING ON v3'S WRONG ANSWER BY THE OPPOSITE ROUTE.
//
// DO NOT GENERALISE THE SCOPE RULE ABOVE INTO THIS SIGNAL. That rule says
// marketing signals are not scored off content inside an embedded product
// surface. It does NOT say only product chrome counts for the deliverable. One
// rule is about where a page's self-presentation lives; the inversion ("only
// product chrome counts") is the error this clause blocks, and a rater
// generalising change 4 by instinct will reach it.
//
// Part B also closes hole 3's collapse hazard from the other side: the test is
// content that could count against the vendor, so a well-populated UI shot
// earns nothing merely for being well populated, and the authoring medium is
// irrelevant in both directions.
export const CRAFT_SIGNALS = [
  "asymmetric-split",
  "single-optical-anchor",
  "type-scale-high-contrast",
  "editorial-grid-break",
  "custom-type-pairing",
  "real-product-surface",
  "shows-deliverable",
  "density-variation",
  "one-accent-discipline",
  "live-claim-control",
] as const;

export const ALL_SIGNALS = [...SLOP_SIGNALS, ...CRAFT_SIGNALS] as const;

// Descriptive facts a page is made of. Deliberately NOT signals: a material
// cannot carry a stance, so a rule must never be written against one. Open
// list — extend as evidence demands.
// `video-embed` added at n=42: subvocal.company ships a 3.79s beauty clip and
// a 91.8s lab video of the prototype as in-page sections, which `video-hero`
// describes wrongly. Safe to add because a material can never back a rule.
//
// PROVENANCE (hole 8), four tokens recording where a deliverable's CONTENT came
// from. They appear ONLY on files scoring `shows-deliverable: present`, and
// their absence there means `unresolved` / `unanchored` / `undisclosed`; on
// any other file there is nothing to have provenance, so nothing is recorded.
//   origin-captured  a real run of the VENDOR'S OWN product, shown by an
//                    instrument: a live request returning the values,
//                    byte-identity with a source, a commit that resolves in
//                    the real repo, a detail with no authored purpose
//   origin-authored  the vendor wrote or generated it, shown by an
//                    instrument: Math.random or a fixture in the bundle, a
//                    clock seed, failed arithmetic, a placeholder identity
//   anchored         a value in the artefact checks against an authority the
//                    vendor does not control (an SEC filing, a published
//                    datasheet, a third-party benchmark, a public repo)
//   disclosed        the page labels the artefact as an example or estimate,
//                    in visible text beside it
// In materials, not signals, deliberately: `authored` is not slop. silica's
// simulated chart and financial-datasets' fixture are among the corpus's most
// honest deliverables, and a rule against fabrication would convict them.
// Validated before it was applied: 13 files, two blind raters each, agreeing
// 12/13 on origin and 13/13 on anchor and disclosure. The one split, aviern,
// is what "of the VENDOR'S OWN product" settles: machine-made masks on real
// footage show that some model ran, not that it was Aviern's. Test plan and
// results: docs/superpowers/specs/2026-10-16-hole-8-provenance-proposal.md.
export const MATERIALS = [
  "single-theme", "dual-theme", "stock-photo", "commissioned-photo",
  "illustration", "webgl", "video-hero", "video-embed",
  "origin-captured", "origin-authored", "anchored", "disclosed",
] as const;

// faq / team / stats / security / integrations added at n=42. All ten
// session-4 drafts invented context values and the build rejected every one;
// sixteen distinct section names had no slot. These five are the ones that
// recurred and that map to a section with no overlap onto an existing value
// (faq on 4 pages, team on 3). Low risk: `context` backs no rule and no
// threshold reads it. The other eleven invented names were dropped rather
// than reinterpreted — see ~/scratch/antislop/context-normalisation.json and
// docs/superpowers/specs/2026-10-14-vocabulary-v4-proposal.md, change 7.
export const CONTEXTS = [
  "hero", "nav", "pricing", "features", "testimonials", "cta", "footer",
  "docs", "dashboard", "empty-state", "404", "auth", "blog-index", "article",
  "faq", "team", "stats", "security", "integrations",
] as const;

// `ai-builder` added at n=47: sites launched by their makers from AI site
// builders (Lovable, Bolt), harvested from the builders' own showcase galleries.
// Added because YC pages yielded slop at ~4% and the corpus needed a population
// where it is common; three of five screened candidates were confirmed slop by
// two blind raters each. It is a sampling source, not a verdict: two of the
// five came back `mixed`, and the cohort carries no rule weight of its own.
export const COHORTS = [
  "yc-current", "yc-2015-2019", "agent-tools", "design-studio",
  "pre-ai-2015", "print", "architecture", "infographic", "academic-paper",
  "ai-builder",
] as const;

// `unresolved` is an admission the evidence could not settle the signal,
// not a judgment. It must never count toward a rule — see build-antislop.ts.
export const SIGNAL_VALUES = ["present", "absent", "unresolved"] as const;
export const KINDS = ["site", "paper", "repo", "tool", "artifact"] as const;
export const VERDICTS = ["exemplar", "slop", "mixed"] as const;

export type Signal = (typeof ALL_SIGNALS)[number];
export type Cohort = (typeof COHORTS)[number];
export type SignalValue = (typeof SIGNAL_VALUES)[number];
