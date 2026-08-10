# Lab Free — Batch 2 Ideation Record

Raw ideation archive for the `Beautiful surfaces — product-page components` lane. Reference only — completeness over brevity. Do not treat this as a spec; the built components in `registry/` are authoritative.

## Lane brief

> Lane: **Beautiful surfaces — product-page components**. 539 slugs already taken in the registry at generation time.
>
> The owner's standing taste rule for this lane, given up front at ideation (unlike batch 1, where it was applied only as a late judge/owner filter — see the comparison section in `03-Resources/fable-taste-patterns.md`):
>
> Beautiful first, broadly useful second. Filter 1: name the product surface the component replaces — hero, background, divider, card, nav, loader, empty state, feedback moment, pricing element, gallery, testimonial, footer. "A settings screen", "an internal dashboard" or "a developer tool" fails, however clever the mechanism. Filter 2: it must be alive at rest and striking to look at. The resting frame is the first and often only thing judged; a static bordered grey card is an automatic rejection.

## Ideator postures

Three parallel `claude-fable-5` agents ran the same lane brief above under three distinct postures:

- **`daily-driver`** — agent `acf6aa9fb723a18ef`. First concept: `bedform-drift` (a section-divider glyph strip).
- **`mechanism-first`** — agent `a0127cf9299e6db70`. First concept: `strain-fringe` (a photoelastic-stress hero, loud).
- **`swing`** — agent `ad7e3f31a811095e8`. First concept: `craze-rule` (a drying-crack section divider).

As in batch 1, the source data does not individually tag each of the 29 surviving concepts by posture — only the ideation log's per-agent result preview (first concept generated) is recoverable. The three previews above are the only posture→concept evidence in the source; treat any broader posture inference in the vault comparison as directional, not a verified mapping.

## Outcome

- 30 concepts generated across the three postures, 29 survived dedup against the 539-slug taken set and against each other (1 lost).
- 10 selected: `core/craze-rule`, `core/ring-stain`, `core/dew-coalesce`, `core/brine-float`, `core/seam-gild`, `core/lenticule-swing`, `core/grazing-light`, `core/starch-shear`, `core/seal-roll`, `loud/kamacite-etch`.
- 19 not selected: 17 with a recorded judge reason (below), 2 with none recorded in the source (`lichen-creep`, `pappus-loft` — marked accordingly, not reconstructed).
- 10/10 selected concepts built; gate results and Filter 2 (alive-at-rest) findings are reported separately (build/gate companion notes, not this ideation record).

---

## Concepts

### `bedform-drift` (core) — REJECTED

- **The idea:** A section divider that is a thin band of aeolian sand ripples rendered in glyphs — asymmetric crests (steep lee face, shallow stoss face) that migrate almost imperceptibly downwind, occasionally merging when a fast ripple overtakes a slow one, exactly as real bedforms do.
- **The job:** Section divider. Replaces the inert `<hr>` between marketing sections with a living seam that carries the eye across the fold without demanding attention.
- **Why distinct:** Nearest is footer-ascii-rule / feature-grid-ascii-rule, which are static typographic rules. This one is a transport process: crests physically migrate at ~2px/s and merge, so the divider is alive at rest while staying one line tall. It is not a background — it is a 24-40px strip with a hard job.
- **Mechanism:** A single row (or 2-3 rows) of monospace glyphs from a density ramp (· ˑ - = ≡). A 1D height field of N ripples, each with position, wavelength, and speed inversely proportional to height (real ripple physics: small ripples travel faster and get absorbed). requestAnimationFrame updates glyph choice per cell from the sampled height field; crest cells get --foreground, troughs --ns-muted. Merging events cause a brief settle handled with an ease-out-expo height blend. Pauses via IntersectionObserver and prefers-reduced-motion.
- **Canvas needed:** false
- **A11y note:** Pure decoration: role='separator' with aria-hidden glyph content, so screen readers get a semantic divider and none of the character noise. No keyboard surface. prefers-reduced-motion freezes the field at one settled frame, which still reads as a textured rule.
- **Reference pull:** Time-lapse footage of wind ripples migrating across the Namib dune field — the counterintuitive detail that small ripples move faster and are consumed by large ones is the whole animation.
- **Rejected first instinct:** A sine-wave shimmer sweeping along a dashed line. Thrown out because a sweep is a loop you notice on the third pass; migration with occasional merge events is aperiodic, so it never registers as a repeating GIF.
- **Feel in one line:** Like glancing at a beach seam and realizing the sand is very slowly walking.
- **Judge's rejection reason:** A 24-40px glyph strip with a migrating density field is the background-ascii family compressed into a band; the merging-ripple physics is lovely but reads as texture number fourteen rather than as a divider with a job.

### `ring-stain` (core) — **SELECTED**

- **The idea:** A loader built on the coffee-ring effect: a circular field of tiny SVG particles drifts outward on evaporation currents and pins to the rim, so the visible artifact of waiting is a slowly densifying ring — the stain literally deposits progress.
- **The job:** Loader / indeterminate progress. The default spinner replacement for cards, panels, and page-level waits.
- **Why distinct:** Nearest is loader-ink-blob (liquid blob morph) and loader-iris (aperture). Neither accumulates: this loader's whole idea is deposition — the longer you wait, the denser and more particulate the rim gets, which honestly encodes elapsed time in an indeterminate wait. Determinate mode maps percent to rim coverage angle.
- **Mechanism:** 60-120 SVG circles (r 0.5-1.5px, fill --ns-muted) inside a clip circle. Each particle integrates a radial advection velocity (capillary-flow profile: slow at center, accelerating near the contact line) plus small Brownian jitter, then freezes on rim contact and brightens to --foreground. A faint meniscus edge is one thin --border circle. On load complete, the interior clears and the ring contracts with a spring, becoming the checkmark's stroke path. CSS transforms only, no filters.
- **Canvas needed:** false
- **A11y note:** role='progressbar' (aria-valuenow in determinate mode, aria-busy on the region otherwise) with visually hidden status text updated at coarse intervals ('still loading'). Reduced motion swaps drift for a step-wise opacity fill of the ring, which preserves the accumulation metaphor without movement.
- **Reference pull:** Deegan's coffee-ring papers and the underside of every mug on a desk: evaporation at the pinned contact line drives outward flow that carries particles to the rim.
- **Rejected first instinct:** A spinning ring of dots — the universal spinner with better styling. Rejected because rotation communicates nothing about elapsed time; the coffee ring was chosen precisely because deposition is monotonic and waiting visibly gets you somewhere.
- **Feel in one line:** Like watching a drop dry and being oddly satisfied that the wait left a mark.

### `frost-feather` (core) — REJECTED

- **The idea:** An empty state where dendritic frost feathers grow slowly inward from the panel's corners across the empty area — window frost claiming unused glass — and visibly retreat (melt back along their own branches) the moment content arrives.
- **The job:** Empty state. For inboxes, search-no-results, fresh workspaces: the panel is beautiful while empty and its beauty self-destructs into content, which is exactly the right incentive.
- **Why distinct:** Nearest is empty-state-dashed / empty-state-pegboard / empty-state-sonar. Those decorate emptiness statically or ping it; this one treats emptiness as a surface being colonized by a natural process, with a directional grow-in and a melt-out exit transition that no existing empty state has.
- **Mechanism:** Pre-generated dendrite paths (recursive branching with 60° side-branch bias, seeded per mount so no two panels match) as SVG strokes in --ns-muted at 1px, tips in --border. Growth is stroke-dashoffset animated at ~40s full extent with ease-out, staggered per branch depth; a barely visible tip glint (2px --foreground dot, opacity 0.15) tracks each growing tip. On content arrival, dashoffset reverses 6x faster from the tips inward. CTA text sits in the clear center; frost never overlaps it (paths are generated avoiding an exclusion rect).
- **Canvas needed:** false
- **A11y note:** Frost SVG is aria-hidden; the empty state's heading, description, and CTA are ordinary DOM with correct heading level and a real button, announced normally. Growth conveys nothing informational so nothing is lost to screen readers. Reduced motion renders the dendrites at ~60% extent, static.
- **Reference pull:** Window frost (fern frost) on single-pane glass — dendrites nucleate at scratches and edges and grow inward, and the exclusion behavior around finger-warmth is the model for keeping the CTA zone clear.
- **Rejected first instinct:** A slowly drifting particle field behind the CTA. Rejected because drift is generic ambiance for any surface; frost is specific to emptiness — it only grows on undisturbed glass, so the metaphor does argumentative work.
- **Feel in one line:** Like arriving at a cold windowpane that politely thaws the moment you have something to put there.
- **Judge's rejection reason:** Dendritic branching is already carried by hero-ascii-lichtenberg and background-ascii-nodal-lines, and a 40s full-extent growth means most visitors see a static half-grown state. The melt-back exit is the only truly new beat.

### `steelyard-slide` (core) — REJECTED

- **The idea:** A usage-based pricing element built as a steelyard balance: a graduated horizontal beam, a sliding counterweight the user drags along it (usage tier), and the beam tilting to settle at balance where the price reads off the fulcrum — with a slow breathing micro-sway at rest so the instrument feels suspended, not drawn.
- **The job:** Pricing element for usage-based / seat-based tiers, replacing the labeled range slider with a monthly cost readout above it.
- **Why distinct:** Nearest is pricing-scale and counterpoise-tiers (two-pan / tiered weights) and slider-vernier (precision slider). A steelyard is a different machine: one arm, one sliding poise, price found by where the beam levels — so dragging is literally searching for equilibrium, and the settle-oscillation gives the price a physical arrival that a number ticking up cannot.
- **Mechanism:** SVG beam (thin --border stroke with Geist Mono graduation ticks), fulcrum triangle, hanging price plate in Geist Mono. Dragging the poise applies torque; beam angle follows a damped spring (stiffness/damping tuned to 2-3 visible overshoots). Price plate counter-rotates to stay level. Detents at named tiers produce a small angular click. At rest the beam sways ±0.4° on a 7s sine, like a balance in a draft. Poise hover uses --ns-accent ring, the only accent use.
- **Canvas needed:** false
- **A11y note:** The poise is a native-pattern slider: role='slider' with aria-valuemin/max/now and aria-valuetext ('2M requests, $49/mo'), arrow keys step tiers, Home/End jump. Price is a live region updated on settle, not per-frame. Reduced motion removes the sway and snaps the beam without oscillation. Fully operable without ever seeing the beam.
- **Reference pull:** The Roman steelyard (statera) still used in fish markets: one sliding poise on a notched arm, weight read at the balance notch — buying by finding level.
- **Rejected first instinct:** A styled range slider with the price counting up in a card above. Rejected because the number and the control stay causally disconnected; the steelyard fuses them — the price is a physical consequence of where you put the weight.
- **Feel in one line:** Like weighing your own appetite on a market scale and trusting the number because you watched it level.
- **Judge's rejection reason:** A steelyard is a scale. pricing-scale and counterpoise-tiers already own the balance metaphor for pricing; a third weighing instrument is a variant, not a distinct component, however good the sliding-poise detail is.

### `groove-stylus` (core) — REJECTED

- **The idea:** A testimonial rotator styled as a phonograph record: quotes are grooves in a slowly rotating disc, a stylus arm tracks inward, and the visible quote 'plays' — words ink in as the stylus passes their groove position — while at rest the disc turns lazily with a moving groove glint.
- **The job:** Testimonial / quote rotator on marketing pages, replacing the crossfading quote carousel.
- **Why distinct:** Nearest is testimonial-wall-reflow (grid reflow) and carousel-card-riffle (card motion). Neither has playback: here quote progression is a needle position, so time-until-next-quote is visible as remaining groove, and skipping ahead is dropping the needle — the rotator self-explains its own timing, which crossfade carousels never do.
- **Mechanism:** SVG disc: 30-40 concentric circles at 1px --border with slight radius jitter, rotating at 0.8rpm via CSS. Groove glint is a conic-gradient-shaped mask of slightly-lifted stroke opacity that stays fixed while grooves rotate under it (how real records catch light). The tonearm is two SVG lines with a counterweight, easing inward on ease-out-expo per quote. Quote text sits beside the disc; words transition --ns-muted to --foreground keyed to needle progress. Clicking a groove band seeks to that quote; the arm lifts, swings, drops with a 2-frame settle bounce.
- **Canvas needed:** false
- **A11y note:** Quotes live in a region with aria-roledescription='carousel', each quote a real blockquote with cite; auto-advance pauses on focus/hover per WCAG 2.2.2, and prev/next are real buttons (arrow-key seekable). The word-inking is opacity-only so the full quote text is always in the DOM for screen readers. Reduced motion: static disc, instant quote swaps, arm jumps without swing.
- **Reference pull:** Watching a turntable from above: the paradox that the grooves spin but the light glint stays still, and the tonearm's slow inevitable march inward as a visible clock.
- **Rejected first instinct:** Quotes on ticker tape scrolling by. Rejected because tape is linear and endless — no sense of a bounded set; the record's finite grooves tell you at a glance there are five voices and where you are among them.
- **Feel in one line:** Like putting on a record of people saying nice things and letting the side play out.
- **Judge's rejection reason:** Skeuomorphic costume: the disc rotates beside the quote and does no work on it, and turntable-with-tonearm is a well-worn UI trope. The fixed-glint-over-moving-grooves detail deserves rescuing into another component.

### `loupe-drift` (core) — REJECTED

- **The idea:** A gallery presented as a photographic contact sheet on a light table: a frame of small dark thumbnails with sprocket-edge borders, and a loupe that drifts slowly across the sheet at idle — magnifying whatever it crosses — then snaps to the user's cursor or focus the moment they engage.
- **The job:** Gallery / image grid for portfolio and product-shot sections; the loupe replaces the lightbox for casual browsing (click still opens full view).
- **Why distinct:** Nearest is gallery-gantry-track (mechanical camera track) and slider-loupe (a loupe on a slider control). This is the loupe as autonomous idle inhabitant of a grid: the component browses itself when nobody is touching it, which both demonstrates the interaction and makes the resting frame alive. Hover behavior then feels like taking the tool out of the machine's hand.
- **Mechanism:** Thumbnails in a strict grid with 1px --border frames and Geist Mono frame numbers (07A, 07B) beneath, on a --background sheet with a soft under-glow (inset box-shadow, not gradient wash). The loupe is a circular clipped duplicate of the sheet at 2.5x, ringed by a --border circle with a subtle handle. Idle path is a slow Lissajous curve (~45s period) with spring-smoothed velocity; on pointerenter it springs to the cursor; on pointerleave it waits 3s then resumes drifting from where it was. Focused thumbnail pulls the loupe via the same spring.
- **Canvas needed:** false
- **A11y note:** The grid is a list of buttons, each with alt-derived accessible names; arrow keys move focus and the loupe follows focus, so keyboard users get the identical magnification affordance. Enter opens the full image. The loupe itself is aria-hidden (pure duplicate content). Reduced motion disables idle drift entirely; the loupe appears only on hover/focus, statically positioned.
- **Reference pull:** An editor's light table: 8x loupe sitting on a contact sheet of negatives, and the specific gesture of sliding it frame to frame instead of picking it up.
- **Rejected first instinct:** Hover-to-zoom on each thumbnail (scale 1.05 with shadow). Rejected because per-cell zoom is the most templated gallery interaction alive; moving the magnification into a single shared physical object gives the grid one continuous surface instead of twenty twitchy ones.
- **Feel in one line:** Like finding the editor's loupe still slowly wandering the contact sheet and gently taking it from them.
- **Judge's rejection reason:** Magnification is claimed three times over (slider-loupe, loupe-slider, lens-ascii-magnify). The idle-drifting loupe is a charming wrapper on an owned idea.

### `pappus-loft` (core) — REJECTED (no reason recorded in source)

- **The idea:** A success/celebration moment as a dandelion clock: a small glyph seed-head that sways faintly at rest, and on the success event releases its pappus seeds to loft, drift, and disperse with real parachute-drag physics — a quiet, single-breath celebration instead of confetti.
- **The job:** Feedback/celebration moment: form submitted, plan upgraded, onboarding step complete. Sits inline where the completed thing was.
- **Why distinct:** Nearest is success-nucleation and success-iron-filings — both are fields organizing inward toward order. This is the opposite gesture: release. The payload disperses and leaves the stalk standing, which suits completions that are endings (sent, published, done) rather than achievements assembling.
- **Mechanism:** Seed head is ~24 SVG seed groups (achene tick + radiating pappus lines in --ns-muted) on a thin stalk, arranged spherically by golden-angle. At rest the whole head sways on a 5s pendulum of ±1.5°. On trigger, seeds detach in 2-3 staggered gusts; each integrates gravity against high quadratic drag (terminal velocity ~30px/s, the slow dandelion fall) plus a shared horizontal breeze field, rotating to trail its velocity vector, fading over 2.5s. The bare receptacle remains with a satisfied 1px --foreground dot per socket. Total life ~3s, then optional replaced-by-content.
- **Canvas needed:** false
- **A11y note:** The animation is decoration for a status change: the real announcement is role='status' text ('Message sent') rendered simultaneously, so screen reader timing matches visual timing. Nothing is focusable. Reduced motion: seeds fade out in place without trajectories; the status text is identical.
- **Reference pull:** The dandelion pappus vortex-ring studies (Nature, 2018) — the separated vortex that gives seeds their absurdly low terminal velocity — plus the childhood one-breath clock.
- **Rejected first instinct:** Restrained monochrome confetti. Rejected because confetti is celebration's stock photo regardless of palette; dispersal-with-drag reads as an event with weather in it, and the surviving bare stalk gives the moment an after-image confetti never has.
- **Feel in one line:** Like blowing the clock and watching your finished task ride off on the wind.
- **Judge's rejection reason:** Not recorded in source (not in `rejected_notable`).

### `grazing-light` (core) — **SELECTED**

- **The idea:** A feature card whose icon and heading are blind-embossed into the surface, revealed by a low-angle light that slowly rakes across the card at idle — relief appearing and vanishing as the angle changes — and that snaps to track the cursor's direction on hover, like tilting paper toward a lamp.
- **The job:** Card — the feature-grid card, the most-reached-for surface on any product page.
- **Why distinct:** Nearest is emboss-plate and card-number-emboss, which are static emboss treatments. Here the emboss is inert; the component is the light. A raking angle sweeping at idle makes the card alive at rest with zero layout motion, and cursor-directional lighting makes a whole grid of cards respond coherently to one pointer, which single-card hover effects cannot.
- **Mechanism:** One CSS custom property --rake-angle drives everything: heading and icon get paired 1px light/dark text-shadows (and SVG feDropShadow duplicates for the icon) whose offsets are cos/sin of the angle; the card border gets an asymmetric inset highlight from the same angle. Idle: the angle eases through a slow 24s circuit (ease-in-out per quadrant, so it lingers). On pointermove anywhere over the grid, each card computes cursor-to-center bearing and springs its angle there; a grid-level provider keeps them phase-coherent. Colors strictly --foreground/--ns-muted/--border shadows, no gradient fills.
- **Canvas needed:** false
- **A11y note:** Heading and body are real text with full contrast in the base state — the emboss shadows add relief, never replace legibility (contrast is checked with shadows removed). Card is a single link with descriptive name; no interaction lives in the light. Reduced motion pins the rake at 315° (the classic top-left key light), static.
- **Reference pull:** Museum raking-light photography of blind-embossed prints and letterpress — conservators sweep a lamp at 5-10° to make an invisible impression legible, and the reveal-as-the-light-moves is the exact loop borrowed.
- **Rejected first instinct:** A specular sheen sweeping diagonally across the card (the skeleton-shimmer as decoration). Rejected because a sheen is surface gloss with no subject; raking light needs relief to reveal, which forced the emboss and gave the motion something to be about.
- **Feel in one line:** Like tilting a business card under a desk lamp to feel that the printing is pressed in, not printed on.

### `background-ascii-fingering` (loud) — REJECTED

- **The idea:** A glyph-raster background of Saffman–Taylor viscous fingering: an invisible thin fluid slowly invades a denser one from the edges of a Hele-Shaw cell, and the interface breaks into branching fingers that split at their tips — glyph density mapping the two phases, the fractal boundary alive and forever advancing without ever filling the frame.
- **The job:** Background — full-bleed hero/section backdrop, continuing the ascii-raster family (caustics, dither, domain-walls, wake...).
- **Why distinct:** Nearest are background-ascii-flow and background-ascii-domain-walls. Flow advects a field everywhere; domain-walls relax boundaries between settled regions. Fingering is an instability at a single moving interface: all the action is one branching frontier with tip-splitting, giving a botanical/lichen silhouette none of the existing physics produces. A slow recession phase re-absorbs fingers so it cycles without a visible reset.
- **Mechanism:** Canvas glyph raster (~110x60 cells). Pressure field solved on a coarse grid (few Jacobi iterations/frame); interface cells advance with velocity proportional to the local pressure gradient plus curvature-dependent surface tension, which is what makes wide tips split. Invaded phase renders sparse light glyphs (· ˑ), defending phase dense ones (▒-adjacent ASCII), interface cells get the brightest ramp glyphs. Colors read from --background/--foreground/--ns-muted via getComputedStyle at mount and on a MutationObserver watching theme class changes. Time-step throttled to 12fps physics / 60fps glyph fade for calm.
- **Canvas needed:** true
- **A11y note:** aria-hidden decorative canvas behind content; a plain --background scrim ensures foreground text contrast never depends on the pattern. prefers-reduced-motion halts the interface and shows one grown fingering pattern statically (still gorgeous as a frozen frame). No interaction, no focus.
- **Reference pull:** Hele-Shaw cell demos: air injected between glass plates filled with glycerin — the instant tip-splitting fingers — and the same morphology in manganese dendrites on limestone.
- **Rejected first instinct:** Diffusion-limited aggregation (particles random-walking onto a growing cluster). Rejected because DLA converges to one static crystal and its growth is pointillist and twitchy; fingering keeps a smooth advancing front with continuous, watchable motion and a natural retreat cycle.
- **Feel in one line:** Like watching ink pressed between glass plates decide, branch by branch, where it is allowed to go.
- **Judge's rejection reason:** An advancing branching interface duplicates hero-ascii-reaction-front in idea and lands in the same visual family as hero-ascii-lichtenberg and background-ascii-nodal-lines. Fractal branching is the single most represented morphology already in the ascii backgrounds.

### `murmur-condense` (loud) — REJECTED

- **The idea:** A hero where a starling murmuration of glyphs pours across the viewport, shears, folds, and then condenses into the wordmark — each character of the headline a local attractor the flock settles onto — after which the flock breathes at rest, birds occasionally lifting off a letter edge and rejoining.
- **The job:** Hero. The above-the-fold showpiece for a launch page.
- **Why distinct:** Nearest is particle-hero and hero-cloth-type. Particle-hero is a generic particle field; cloth-type drapes type as fabric. Murmuration is flocking — velocity alignment, neighbor cohesion, predator-wave shear — so the pre-settle phase has the signature banking sheets of density (dark ribbons that flip thin) no particle system without boids rules produces, and the type is arrived at, not displayed.
- **Mechanism:** Canvas, ~1500 agents drawn as small glyph marks (comma-like strokes, not dots) whose orientation follows heading. Standard boids (separation/alignment/cohesion) with a periodic shear impulse that propagates as a wave through neighbor links, creating the density-flip ribbons. Headline is rasterized offscreen to sample target points; after 4s, per-agent spring force to assigned target ramps up, flock condenses, agents damp into letterform positions with residual jitter. At rest, 2-3% of agents per 10s get released and re-captured. Colors via getComputedStyle from tokens, re-read on theme change; density modulates between --ns-muted and --foreground only.
- **Canvas needed:** true
- **A11y note:** The real headline exists as an H1 in the DOM (visually revealed beneath/behind the settled flock, or sr-only if fully covered) so the page has its heading instantly for screen readers and search — the canvas is aria-hidden theater. Reduced motion skips the flight: headline renders as settled glyph-texture type immediately, with no idle lift-offs. No pointer capture; scroll is never hijacked.
- **Reference pull:** Starling murmurations over Rome's EUR district at dusk — specifically the density waves that travel through the flock when a peregrine strikes, which is the shear impulse in the sim.
- **Rejected first instinct:** Particles exploding outward from the wordmark on load. Rejected because explosion is entropy theater — impressive for 400ms, meaningless after; condensation runs the arrow the other way, so the spectacle terminates in the message instead of departing from it.
- **Feel in one line:** Like watching ten thousand birds agree, all at once, to spell something for you.
- **Judge's rejection reason:** Particles condensing into a wordmark is one of the most-shipped web demos alive, and particle-hero plus hero-particles-webgl already occupy the slot. The boids ribbons only distinguish the first four seconds; the payoff frame is the cliche.

### `strain-fringe` (loud) — REJECTED

- **The idea:** A hero where the headline sits inside a slab of transparent material viewed through a polariscope: monochrome photoelastic stress fringes (thin contour bands) breathe slowly around the letterforms at rest, and pointer pressure or scroll adds load, so fringes visibly concentrate and crowd at the contact point like stressed acrylic admitting where it hurts.
- **The job:** Hero section — the first-frame showpiece above the fold.
- **Why distinct:** Nearest is hero-isobar-contours, but those contours describe a static field; strain-fringe's band density encodes live simulated stress sourced from the letterform boundaries and the user's touch, so the type itself is the load-bearing inclusion the fringes wrap around.
- **Mechanism:** Canvas renders a scalar stress field (superposed point loads at pointer + fixed stress risers at glyph corners, computed from the headline's rasterized outline); field is quantized into alternating light/dark bands using only --foreground/--ns-muted over --background, band count proportional to local stress; idle state animates a slow phase drift so residual fringes breathe; tokens read via getComputedStyle at mount and on theme change.
- **Canvas needed:** true
- **A11y note:** Headline is real DOM text layered above an aria-hidden canvas, so screen readers and text selection are untouched; no interaction is required to use the page; prefers-reduced-motion freezes the fringe field at its resting frame.
- **Reference pull:** Polariscope photographs of loaded acrylic and injection-molded plastic protractors between crossed polarizers, where stress concentrations show as tight fringe packing at notches and corners.
- **Rejected first instinct:** Rendering the fringes in true photoelastic rainbow colors — thrown away because it violated the palette ban and instantly read as a gradient wash; monochrome band spacing carries the stress information better anyway.
- **Feel in one line:** Pressing on tempered glass and watching it quietly admit where it hurts.
- **Judge's rejection reason:** Loud hero saturation is the worst area of the registry (a dozen hero-ascii-* plus hero-particles-webgl, hero-oscilloscope, hero-dipole-field). And visually it lands on nested monochrome contour bands around a headline, which is what hero-isobar-contours already puts on screen; a different physics underneath does not rescue an identical silhouette.

### `lamella-pop` (core) — REJECTED

- **The idea:** A loader that is a soap film stretched across a thin ring: horizontal drainage bands (fine SVG contour strokes) drift downward as the film thins, film thickness maps inversely to progress, and at 100% a dark spot nucleates at the top and the film ruptures in one crisp radial retraction frame before content appears.
- **The job:** Loader — determinate progress and an indeterminate wobble-and-replenish mode.
- **Why distinct:** Nearest is loader-iris; that closes an aperture mechanically, while lamella-pop is continuous physical thinning with visible drainage banding whose completion is a rupture event, not a rotation — the loader ends by ceasing to exist.
- **Mechanism:** SVG ring with a clipped stack of thin horizontal strokes whose vertical spacing and stroke-width interpolate over time (drainage), driven by CSS variables from progress; a top 'black film' circle scales in near completion; rupture is a single 90ms stroke-dashoffset radial retraction; colors are --border for the ring, --ns-muted/--foreground for bands.
- **Canvas needed:** false
- **A11y note:** role=progressbar with aria-valuenow updated from real progress; completion fires an aria-live 'loaded' announcement since the pop itself is silent; reduced-motion replaces band drift with discrete stepped states and skips the rupture animation.
- **Reference pull:** A vertical soap film draining in a wire frame: gravity pulls thickness downward into visible interference bands, and the film turns to 'black film' at the top moments before it bursts.
- **Rejected first instinct:** A bubble that inflates with progress and pops at 100% — rejected because an inflating circle is the stock 'playful loader' cliché; the drainage banding is where all the beauty and the sense of time actually live.
- **Feel in one line:** Waiting on something delicate that ends with a tiny, satisfying finality.
- **Judge's rejection reason:** Elegant and cheap, but ending by ceasing to exist sits near loader-iris's closing aperture, and drifting horizontal bands land close to progress-hatch. Loader saturation left room for exactly one, and ring-stain's deposition encodes elapsed time more honestly.

### `oilcan-arch` (core) — REJECTED

- **The idea:** A monthly/annual pricing toggle that is a slender elastic strip bowed toward one side: dragging or clicking loads the strip until it snap-through buckles to the opposite bow with a spring overshoot, and the price numerals flip during the snap frame; at rest the held bow breathes about a pixel, like stored tension.
- **The job:** Pricing element — the billing-period switch on a pricing page.
- **Why distinct:** Nearest are the switch family and pricing-scale, all of which move a knob along a track; here there is no knob — the whole member is the state, partial drags visibly bow the strip and release relaxes it back, and the commitment point is a genuine buckling instability rather than a threshold on a slider.
- **Mechanism:** SVG quadratic path whose control point is driven by pointer displacement through a softening-spring curve; past the critical displacement the control point flips sign through a spring easing with overshoot; price swap is synchronized to the zero-crossing frame; idle breathing is a 6s CSS transform micro-oscillation on the path group; stroke uses --foreground, focus ring uses --ns-accent.
- **Canvas needed:** false
- **A11y note:** Implemented as a real role=switch button: Space/Enter and arrow keys toggle with the full snap (state announced as 'annual billing, 20% off'); drag is an enhancement, never the only path; reduced-motion swaps the buckle for an instant flip with no overshoot or idle breathing.
- **Reference pull:** Oil-canning in thin sheet metal — the bistable pop of a slightly domed panel — and the snap of a spring-band hair clip that resists, then commits all at once.
- **Rejected first instinct:** A springy pill toggle with a bouncy knob — rejected because knob-spring toggles are everywhere and the spring is decoration; in a buckling strip the resistance and the commitment are the same physical fact, which is what makes flipping it feel like a decision.
- **Feel in one line:** A decision that resists you, then commits completely all at once.
- **Judge's rejection reason:** Genuinely the best mechanism among the rejects (bistable snap-through, no knob, resistance and commitment as one physical fact), but the switch family is eight deep and brine-float already owns the billing toggle with a mechanism that acts on the whole section. Strongest hold-back candidate if an eleventh slot opens.

### `eddy-brake` (core) — REJECTED

- **The idea:** A testimonial carousel damped like a magnet falling through a copper pipe: flicked cards glide toward a fixed pole-piece zone at center and lose speed with eerie, velocity-proportional smoothness — no detents, no snap — while a faint induced hatching blooms on whichever card is currently braking and fades as it stops; at rest the row creeps forward at reading pace.
- **The job:** Testimonial / social-proof carousel (also serves logo or quote galleries).
- **Why distinct:** Nearest are carousel-card-riffle and segmented-control-fling, both built on snap physics and detents; eddy-brake's entire aesthetic is the absence of snap — deceleration is proportional to speed and proximity to center, so cards arrive exactly centered by damping alone, and the visible hatching makes the invisible braking force legible.
- **Mechanism:** requestAnimationFrame integrator applies drag force F = -k(x)·v where k peaks at the viewport center (the pole piece); flick velocity from pointer events feeds the sim; the braking card gets an SVG diagonal-hatch overlay whose opacity tracks instantaneous |F| in --ns-muted; idle mode injects a constant tiny driving force; all layout is transformed DOM cards with thin --border outlines.
- **Canvas needed:** false
- **A11y note:** Cards are list items in a real list; Tab/arrow keys move focus card by card using the same damped travel; auto-creep pauses on hover, focus, and prefers-reduced-motion (which also replaces damped travel with a simple 200ms ease); each card's quote and attribution are plain readable DOM.
- **Reference pull:** The eddy-current damping demo where a neodymium magnet dropped through a copper tube falls in impossible slow motion, and the damped needles of laboratory balance scales that settle without ever oscillating.
- **Rejected first instinct:** A 'magnetic' carousel where cards snap-to-center with a spring — rejected because snapping is what every carousel already does; the un-snap, the uncanny smooth loss of momentum, is the part nobody has built.
- **Feel in one line:** Momentum melting away like heavy silk, without ever clicking into place.
- **Judge's rejection reason:** Excellent physics, but it collides with starch-shear (both are velocity-dependent strip dynamics) and starch-shear self-explains better. Its only visible novelty is the absence of snap, which is subtractive and hard to notice, plus a hatch overlay in a set that already has progress-hatch, hatch-fill, confidence-logprob-hatch, and burin-etch.

### `dew-coalesce` (core) — **SELECTED**

- **The idea:** An empty state as condensation on cold glass: dozens of tiny droplets nucleate across the panel, grow imperceptibly, occasionally jitter and merge into larger ones, until a big drop crosses the runoff threshold and streaks down — wiping a clean track through the fog; the CTA sits in a permanently wiped clear patch, as if someone rubbed the glass to see in.
- **The job:** Empty state — for inboxes, project lists, and search results with nothing yet.
- **Why distinct:** Nearest is empty-state-sonar, which pings actively into absence; dew-coalesce instead accumulates quiet presence over time, and its runoff tracks do real compositional work — they are the sharp slits through which the crisp copy and CTA show, so the physics literally clears space for the action.
- **Mechanism:** SVG circle field seeded by PRNG; per-droplet radius grows on a slow tick, proximity merging replaces two circles with one at combined area plus a 3-frame jitter; radius above threshold triggers a translateY runoff along a slight meander path, leaving a rounded-rect 'clean track' mask; the fog is a --ns-muted low-opacity veil masked out by tracks and the CTA patch; droplets stroked in --border.
- **Canvas needed:** false
- **A11y note:** The entire condensation layer is aria-hidden decoration; heading, body, and CTA are normal DOM stacked above the veil at full token contrast (the fog never overlays text); reduced-motion renders a static sparse droplet field with the wiped patch already present.
- **Reference pull:** Time-lapse footage of breath condensing on a cold window: droplet nucleation, coalescence cascades, and the sudden runoff streaks that leave clear tracks behind.
- **Rejected first instinct:** Rain running down a window with parallax — rejected because looping rain reads as a screensaver and implies weather, not waiting; quasi-static coalescence reads as patience, which is the actual emotion of an empty state.
- **Feel in one line:** The interface quietly fogging up while it waits for you to give it something to do.

### `pitch-drop` (core) — REJECTED

- **The idea:** A section divider with a clock hidden in it: a bead of pitch hangs from the hairline rule and, over tens of seconds of page lifetime and scroll progress, elongates, necks, and finally falls — landing as the seed bead on the next section's rule. The fall is rare by design; most visitors see only the slow stretch, and the few who witness a drop get a tiny private event.
- **The job:** Section divider — rhythm marker between long-form landing-page sections.
- **Why distinct:** Nearest are rule-frame and footer-ascii-rule, which are static typographic furniture; pitch-drop makes the divider an instrument of elapsed time, and its event scarcity (borrowed straight from the pitch drop experiment) is the opposite of every looping divider animation.
- **Mechanism:** SVG blob built from a metaball-ish path whose lower control points ease downward on a very slow clock advanced by both wall time and IntersectionObserver scroll passes; necking is a width interpolation at the waist; detachment swaps to a falling ellipse with ease-in gravity and a 2-frame rule ripple on landing; filled --foreground on a --border rule.
- **Canvas needed:** false
- **A11y note:** Semantically an hr; the drop layer is aria-hidden and fully non-interactive; prefers-reduced-motion pins the bead mid-neck as a static ornament so the divider still has its silhouette without any animation.
- **Reference pull:** The University of Queensland pitch drop experiment — nine drops in ninety-six years, and almost nobody has ever seen one fall.
- **Rejected first instinct:** A liquid drip that falls on a 3-second loop — rejected because a regular drip is a leaky faucet, and repetition destroys the charm; rarity is the entire point of the reference.
- **Feel in one line:** Catching something almost nobody else gets to see happen.
- **Judge's rejection reason:** The rarity conceit means the component's entire payoff is invisible to essentially every visitor, so in practice it ships as a static blob on a rule. Charming as a story, fails self-explains-at-rest as a product.

### `newton-bloom` (core) — REJECTED

- **The idea:** Gallery images that behave like prints under slightly warped cover glass: faint concentric Newton's-ring contours breathe at one corner where the glass 'doesn't sit flat', and hovering presses the glass — rings bloom outward from the cursor's contact point while the image sharpens and lifts inside the innermost ring; release lets the rings relax back to their resting corner.
- **The job:** Gallery / image card — the hover treatment for portfolio and media grids.
- **Why distinct:** Nearest are caustic-select and gallery-coverflow-caustic, which decorate with refracted-light patterns; Newton's rings are contact interference — they map pressure, are centered on the cursor, and function as a reveal (the clear zone inside the first ring), so the effect communicates touch rather than water.
- **Mechanism:** SVG overlay of concentric ellipses (thin --ns-muted strokes at interference-correct r∝√n spacing) whose center lerps toward the pointer with spring easing and whose count grows with dwell 'pressure'; the innermost ring clips a mask where the image renders at full contrast/saturation versus a slightly veiled base; idle state runs a 8s center micro-drift at the resting corner.
- **Canvas needed:** false
- **A11y note:** Pure enhancement: images keep alt text and click targets regardless; keyboard focus triggers a centered bloom so keyboard users get the same reveal; ring layer is aria-hidden; reduced-motion shows one static ring on focus and no idle drift.
- **Reference pull:** Newton's rings between a convex lens and an optical flat — and the familiar faint rainbow rings where a framed photograph touches its glazing.
- **Rejected first instinct:** Lens-distortion zoom on hover — rejected because the hover loupe is done to death (the library already has loupe components); rings express contact and attention without the tired magnification metaphor.
- **Feel in one line:** Pressing a fingertip on framed glass and feeling the print answer back.
- **Judge's rejection reason:** Almost all of its life is in the hover state (the resting corner drift is negligible), and rings blooming from the cursor sits close to reveal-ripple-tiles and ripple-unfold in read, even though the interference spacing is physically correct.

### `lichen-creep` (core) — REJECTED (no reason recorded in source)

- **The idea:** The footer's dead space is slowly colonized by a diffusion-limited-aggregation colony of small glyphs (·, :, ∘, ×) seeding from the bottom edge and the link-column anchors, branching like lichen on a gravestone; growth is date-seeded and deterministic, so the colony is genuinely a little larger every day you visit, and during a session it accretes maybe one glyph every few seconds.
- **The job:** Footer — turning the page's end from dead space into a place where time collects.
- **Why distinct:** Nearest is the background-ascii family, but those are field simulations that loop; lichen-creep is accretive and persistent — a growth process, not a texture — and its date-keyed determinism gives the site a visible age, which no existing background or footer component does.
- **Mechanism:** Grid of absolutely positioned glyph spans; a seeded PRNG (key = site epoch + date) replays DLA random walks to the deterministic 'today' population at mount, then continues live at ~0.3 glyphs/sec with a 240ms fade-in per glyph; walker attachment probability biased downward for a crust-like profile; glyphs in --ns-muted, brightest generation in --foreground, behind the real footer content.
- **Canvas needed:** false
- **A11y note:** Colony layer is aria-hidden and pointer-events:none behind real footer navigation; glyph contrast is capped at the muted token so links always dominate; reduced-motion renders today's colony fully grown and static with no live accretion.
- **Reference pull:** Crustose lichen colonizing gravestones and stone walls — and DLA electrodeposition fractals, the branchy metal 'lichens' grown in a petri dish with a battery.
- **Rejected first instinct:** Another animated ascii texture behind the footer — rejected because that is just background number thirteen; accretion plus day-over-day persistence is what makes it belong to the footer, the one region of a page allowed to feel old.
- **Feel in one line:** The bottom of the page is old, patient, and very quietly alive.
- **Judge's rejection reason:** Not recorded in source (not in `rejected_notable`).

### `seam-gild` (core) — **SELECTED**

- **The idea:** A kintsugi success moment for weighty actions: on confirmation (payment cleared, migration finished) a hairline crack propagates across the panel in ~400ms with one or two branches, then immediately re-fills from both ends with a bright raised seam in the foreground color — and the scar stays for the rest of the session as ornament, with repeated successes accumulating distinct seams across the surface.
- **The job:** Feedback / celebration moment — the payoff frame after a consequential action.
- **Why distinct:** Nearest are success-nucleation and confirm-slide-shatter; shatter destroys and nucleation crystallizes, but both evaporate — seam-gild repairs, and the residue persists, converting the panel's history into decoration so the interface visibly remembers that something important went well.
- **Mechanism:** Crack is an SVG path generated by biased random-walk with one branch point, drawn via stroke-dashoffset over 400ms in --border; the gild pass re-traces the same path from both endpoints in --foreground at 1.5px with a 1px offset highlight stroke for the raised-lacquer read; finished seams are appended to a persistent layer (sessionStorage) positioned to never intersect text blocks.
- **Canvas needed:** false
- **A11y note:** The real confirmation is an aria-live announcement ('payment confirmed') fired with the event, independent of the visual; crack/seam layers are aria-hidden; reduced-motion draws the completed seam instantly without the propagation animation; seams are layout-inert and never overlap interactive targets.
- **Reference pull:** Kintsugi — gold-lacquer pottery repair that makes the break the most beautiful part — plus the crackle-glaze crazing of Song-dynasty Guan ware ceramics.
- **Rejected first instinct:** A confetti burst with a checkmark — rejected because explosion-celebrations evaporate in a second and mean nothing an hour later; a scar that stays is a trophy the surface keeps.
- **Feel in one line:** Something broke open and was made more beautiful for having happened.

### `starch-shear` (core) — **SELECTED**

- **The idea:** A media film-strip scrubber that is non-Newtonian: drag slowly and the thumbnails flow individually, each lagging its neighbor like liquid; flick fast and the strip instantly stiffens into a rigid slab that moves and stops as one piece. At rest the strip carries a faint liquid sag toward center — a reminder that it is fluid until you strike it.
- **The job:** Gallery / film-strip scrubber for media-heavy product and portfolio pages.
- **Why distinct:** Nearest are scrubber-film-strip and segmented-control-fling, both of which have fixed dynamics; here the inter-item coupling stiffness is a live function of input shear rate — the same surface is loose under browsing and solid under decisive motion, so the component reads intent from how hard you push.
- **Mechanism:** Each thumbnail is a spring node chained to its neighbor; coupling constant k scales with a fast-attack/slow-release envelope of |pointer velocity| (shear rate), so low velocity yields visible staggered lag and high velocity locks nodes into effectively infinite stiffness (translated as one transform); resting sag is a static ±2px translateY curve across the strip; thin --border frames, focused item ringed in --ns-accent.
- **Canvas needed:** false
- **A11y note:** listbox semantics with arrow keys stepping one item (rendered in slow/fluid mode) and Home/End jumping in stiff slab mode; focus ring always visible on the active thumbnail; reduced-motion removes stagger, sag, and the rate-dependent dynamics entirely, leaving plain instant scrolling.
- **Reference pull:** Cornstarch oobleck — punch it and it is a brick, rest a finger on it and it swallows you — the canonical shear-thickening fluid.
- **Rejected first instinct:** Rubber-band overscroll with staggered items — rejected because iOS shipped staggered elasticity a decade ago; the novelty is rate-dependent stiffness, where the material itself changes character based on how it is handled.
- **Feel in one line:** A surface that reads your intent from how hard you push it.

### `craze-rule` (core) — **SELECTED**

- **The idea:** A section divider that is a drying crack. Instead of a static 1px hairline, the rule enters as a fracture propagating across the page: the crack tip races left-to-right at a few hundred px/s when the divider scrolls into view, throws off short T-junction side branches at irregular intervals (mud-crack junctions are near-90-degree, which reads instantly), then settles. At rest the crack is not dead: the tip of the longest side branch creeps a pixel every few seconds and the hairline width 'breathes' by a fraction of a pixel via opacity, like a material still under stress.
- **The job:** Section divider between content blocks on a long product page; replaces `<hr>` and the generic border-top.
- **Why distinct:** Nearest neighbors are footer-ascii-rule (static glyph rule) and compare-crack-seam / crack-compare (cracks used as a comparison-slider seam). This one is the divider itself as a propagating fracture with branching topology, and its life is in arrival and idle creep, not in a drag interaction.
- **Mechanism:** Single SVG path for the main crack, generated once per mount from a seeded 1D random walk (y jitter within ±4px of the rule line); branches are short child paths at near-perpendicular angles. Propagation = stroke-dashoffset animation with ease-out-expo so the tip decelerates like a real crack running out of strain energy. Branches fire staggered via animation-delay. Idle creep = a 6s CSS keyframe nudging the last branch's dashoffset by 1-2px and modulating stroke-opacity 0.8→1.0. Stroke color is --border, tip flash momentarily --foreground. Zero JS after mount except IntersectionObserver to trigger.
- **Canvas needed:** false
- **A11y note:** Rendered as `<hr role="separator">` semantics via aria; the SVG is aria-hidden decoration on top. No keyboard interaction exists or is needed. prefers-reduced-motion: crack renders fully formed, no propagation, no idle creep.
- **Reference pull:** Desiccation cracking in drying mud and old oil-painting craquelure: cracks nucleate, run, and meet earlier cracks at T-junctions because a new crack always intersects an old free surface at 90 degrees. That junction-angle rule is the visual signature being borrowed.
- **Rejected first instinct:** An animated gradient shimmer sweeping along a plain rule, rejected because a shimmer is decoration on a line, while a crack IS the line; also gradient washes are banned and the shimmer says nothing about the page's structure the way a fracture between sections does.
- **Feel in one line:** Like watching a windshield chip decide, calmly, exactly how far it intends to go.

### `lenticule-swing` (core) — **SELECTED**

- **The idea:** A hero headline printed behind vertical lenticular slats. Two full headline states (e.g. the problem statement and the product promise) are interlaced into thin vertical columns; which one you see depends on 'viewing angle'. At rest the virtual viewing angle oscillates slowly through a few degrees, so the headline shimmers at the boundary between the two messages, strips of each visible at once, exactly like walking past a lenticular poster. Scroll position (or pointer x) drives the angle fully, snapping the flip cleanly from message A to message B partway down the hero.
- **The job:** Hero / above-the-fold headline lockup; replaces the static H1 plus subhead.
- **Why distinct:** text-slot-rotate swaps words mechanically, text-prism-split refracts one text, hero-recursive-type and text-variable-weight animate one message. This is two complete messages coexisting in one lockup with a physically-modeled transition zone, and the resting state is deliberately the ambiguous in-between, not either message.
- **Mechanism:** The headline is rendered twice into a shared container; a repeating-linear-gradient mask (or N absolutely-positioned column divs with overflow:hidden, ~8-12px pitch) clips each copy to alternating strips. 'Angle' is one CSS custom property --lens-angle; each strip translates its inner text horizontally by an amount proportional to angle times a per-strip parallax offset, so strips reveal more of A or more of B, with a 1-2 strip transition band where both interlace. Idle: --lens-angle animates ±3deg on an 8s spring-flavored keyframe. Scroll/pointer writes --lens-angle directly. Pure DOM+CSS, one rAF listener.
- **Canvas needed:** false
- **A11y note:** The real H1 is a visually-hidden element containing message A followed by message B as plain text; the slat apparatus is aria-hidden. Keyboard users get both messages read once, no interaction required. prefers-reduced-motion pins --lens-angle to full message A and swaps to B only on the scroll snap point, no oscillation.
- **Reference pull:** Lenticular prints, specifically the cheap two-phase 'winky' postcards and 1960s record sleeves where a half-degree of head movement flips the image, and the delicious moiré band where both frames interlace mid-flip.
- **Rejected first instinct:** A crossfade between two headlines on scroll. Rejected because a crossfade has no material logic, the mid-state is just mush at 50% opacity, whereas lenticular interlacing makes the mid-state the most interesting frame.
- **Feel in one line:** Like tilting a postcard back and forth to catch the second picture hiding inside the first.

### `sea-sparkle` (core) — REJECTED

- **The idea:** An empty state as a night tide full of bioluminescent plankton. The empty region is a near-black field scattered with faint, barely-visible glyph motes (periods, middots) that drift on a slow current. Every few seconds one mote fires: a brief bright flash that decays over ~600ms, sometimes triggering one neighbor, so the field twinkles sparsely at rest. Moving the pointer through the field is mechanical agitation: motes along the pointer's path flash in a wake behind it, exactly like dragging a hand through a bioluminescent bay. The CTA sits in the field like a lamp; on hover the nearest motes drift toward it.
- **The job:** Empty state for lists, inboxes, search-no-results; replaces the illustration-plus-caption empty state.
- **Why distinct:** empty-state-sonar pings outward from a center, empty-state-pegboard and -dashed are static furniture, reorder-drag-wake is a wake behind dragged list items. This is a field of independent agents whose idle behavior is stochastic flashing and whose interaction is disturbance-triggered luminescence, not a radial ping.
- **Mechanism:** 60-120 absolutely-positioned `<span>` motes, positions from a seeded blue-noise-ish scatter. Drift = each mote on a very slow CSS translate keyframe (40-90s, individual delays) so no JS runs for idle motion. Flashing = one lightweight interval picks a random mote every 2-5s and toggles a .fire class (color --ns-muted → --foreground, slight scale, 600ms ease-out decay); a 15% chance cascades to the nearest neighbor after 150ms. Pointer wake = pointermove throttled to rAF, distance check against a coarse grid bucket, fire motes within 40px. All color from tokens; no glow filters beyond a 1px text-shadow in --foreground at low alpha.
- **Canvas needed:** false
- **A11y note:** The container carries role="status" with the empty-state text ('No results yet...') as real DOM; motes are aria-hidden. CTA is a normal focusable button; on keyboard focus the nearby-mote flash fires once as pure decoration. prefers-reduced-motion: motes static, no flashing, CTA unchanged.
- **Reference pull:** Noctiluca scintillans, the dinoflagellate literally nicknamed 'sea sparkle': it flashes only when mechanically disturbed, so a still bay is dark until an oar, a fish, or a hand drags light out of it.
- **Rejected first instinct:** Fireflies drifting around the empty state, rejected because fireflies flash on their own schedule regardless of you, so the interaction adds nothing; the whole point of Noctiluca is that YOUR movement is the stimulus, which turns an empty screen into something that responds to being visited.
- **Feel in one line:** Like trailing your fingers through black water and finding it answers with light.
- **Judge's rejection reason:** Disturbance-triggered flashing is a good argument, but a near-black field of drifting twinkling motes is the generic starfield and overlaps gyre-mote and respire-field in resting appearance.

### `slit-drum` (core) — REJECTED

- **The idea:** A loader built as a zoetrope. A circular drum (SVG) spins continuously; its wall is opaque except for 12 thin radial slits. Behind the slits sits a 12-phase cycle of a tiny animation (a bouncing dot, or the product's glyph mark walking through a deformation cycle). Because you only glimpse the interior through the slits as they sweep past, the phases fuse into apparent motion, the actual zoetrope illusion, done live in the DOM. Determinate mode: the drum's spin rate maps to progress, starting slow with visible discrete phases that fuse into smooth motion as loading nears completion, so 'how done is it' is legible as 'how alive is the picture'.
- **The job:** Loader / progress indicator; replaces the spinner and the progress bar in cards, modals, page transitions.
- **Why distinct:** Nearest are loader-die-tumble and loader-spirograph-trace, both of which animate a single object. This one animates the apparatus of animation itself: the payload frames are static, and motion is manufactured by the occlusion schedule of the slits, which also gives determinate progress a novel encoding (frame-rate as completion).
- **Mechanism:** SVG: outer ring path with 12 slit gaps (mask), rotating via CSS transform with linear timing. Inner layer: 12 phase drawings placed radially, counter-rotating at the phase-lock ratio so each slit always exposes the 'next' frame, the standard zoetrope geometry. Phases are simple stroked paths in --foreground; drum wall in --border. Determinate: JS sets one custom property --spin-period from progress (e.g. 4s at 0% down to 0.6s at 100%); below the flicker-fusion rate the eye sees stuttering discrete frames, above it, fluid motion. Drum stops with a short spring overshoot on completion.
- **Canvas needed:** false
- **A11y note:** role="progressbar" with aria-valuenow updated from real progress (or aria-busy indeterminate); a visually-hidden text mirror announces percent at 10% steps via aria-live="polite". No keyboard interaction. prefers-reduced-motion: drum replaced by a static ring that fills stroke-dashoffset with progress.
- **Reference pull:** The zoetrope ('wheel of life', 1834): a slotted spinning drum whose slits act as a shutter, fusing printed phase drawings into motion, including the characteristic stutter when the drum spins too slowly for persistence of vision.
- **Rejected first instinct:** A film-strip loader where frames slide past a window, rejected because a sliding strip is just a carousel wearing a costume; the zoetrope's slit-shutter is the actual mechanism that manufactures motion, and its spin-rate/fluidity coupling gives progress a meaning a strip cannot.
- **Feel in one line:** Like cranking an antique toy faster and faster until the little figure suddenly comes alive.
- **Judge's rejection reason:** The zoetrope is the cleverest single idea in the batch and progress-as-frame-rate is unclaimed, but with fifteen loaders already taken the marginal value is low, it needs bespoke twelve-phase artwork per install, and fluidity cannot distinguish 40% from 60% the way ring-stain's rim coverage can.

### `kamacite-etch` (loud) — **SELECTED**

- **The idea:** A full-bleed background of a Widmanstätten pattern developing under acid etch. Iron meteorites, cut and etched, reveal interlocking bands of nickel-iron crystal lathes at fixed octahedral angles (roughly 60/120-degree families), a geometry that took millions of years to grow and cannot form on Earth. The background renders as a glyph raster: an invisible lattice of band orientations is precomputed, then an 'etch front' sweeps slowly across the surface over ~90 seconds, raising glyph density and weight along each lath so the crystal structure emerges out of blank metal. Fully etched regions then idle with a faint directional shimmer along each band's axis, like light raking across polished lathes. The etch front loops by 'repolishing' (fading) the oldest region.
- **The job:** Hero/section background; joins the background-ascii-* family (caustics, domain-walls, voronoi-walls...) as its metallurgical member.
- **Why distinct:** background-ascii-domain-walls and -voronoi-walls both partition space into irregular cells; Widmanstätten is the opposite: crystallographically LOCKED angles, long straight interlocking lathes in exactly four orientation families, plus a develop-over-time etch reveal none of the family has. It reads as machined, not organic.
- **Mechanism:** Canvas glyph raster (house background technique). Precompute: pick 4 lattice directions (octahedral projection), generate lathes by seeding lines in each family and widening them into bands with slight thickness noise; each cell of the char grid stores band-id, orientation, and phase. Render loop: etch front is a slow diagonal scalar field; cell brightness = etch(t) * bandContrast, glyph chosen from a density ramp (· : / \ = # subset matched to orientation, slashes aligned with the band axis, which is what makes the anisotropy legible in ASCII). Idle shimmer = per-band sinusoid on brightness with phase from position along the band axis. Colors read from --background/--ns-muted/--foreground via getComputedStyle at mount and on theme change per house rule.
- **Canvas needed:** true
- **A11y note:** Pure decoration: aria-hidden, pointer-events none, sits behind real content with contrast guarded by capping glyph brightness under any text overlay region. prefers-reduced-motion: render the fully-etched pattern statically, no front sweep, no shimmer.
- **Reference pull:** Widmanstätten figures in etched iron meteorites (Gibeon, Muonionalusta slices): nitric-acid etch differentially attacks kamacite vs taenite, so the octahedral crystal lattice surfaces as interlocking metallic bands, and the pattern literally develops as the acid works.
- **Rejected first instinct:** Generic 'crystal growth' background with dendrites growing from random seeds, rejected because dendrites are visually cousins of the existing lichtenberg and nodal-lines pieces; the fixed octahedral angle constraint is what makes Widmanstätten look engineered rather than grown, and that constraint is the whole aesthetic.
- **Feel in one line:** Like watching acid slowly confess the million-year geometry hiding inside a slab of polished iron.

### `brine-float` (core) — **SELECTED**

- **The idea:** Pricing tiers as hydrometer floats bobbing in a shared tank. The pricing section is one shallow vessel: a liquid surface line runs behind all tier cards, drawn as a subtle animated meniscus. Each tier card is a weighted float riding in that liquid, and each bobs gently at rest with its own phase and period, heavier (cheaper) tiers ride lower in the water, the recommended tier rides highest. Selecting the annual/monthly toggle changes the 'density of the brine': the whole liquid line shifts and every float smoothly finds a new equilibrium height with a damped overshoot, so a price change is felt as buoyancy, not a number swap. Hover pushes a float down slightly; release lets it bob back up.
- **The job:** Pricing section, tier cards plus billing-period toggle; replaces the static three-card pricing row.
- **Why distinct:** pricing-scale and counterpoise-tiers use balance/lever metaphors between tiers; plimsoll-gauge and meniscus-meter are single-value gauges. This makes the whole SECTION one fluid system where tier prominence is encoded as freeboard and the billing toggle acts on the medium, not on the cards.
- **Mechanism:** Container has one SVG water line (a low-amplitude 2-segment sine path, 10s morph loop, stroke --border) positioned behind the card row. Each card gets translateY = equilibrium(tier, billingMode) + bob(t), where bob is a per-card CSS keyframe (±3px, 4-6s, unique delay/duration so phases never lock). Toggle switches a data-attribute; equilibrium offsets transition with a spring curve (slight overshoot then settle, ~600ms). Hover: translateY +4px with fast ease-out, release springs back. Recommended tier additionally casts a 1px waterline reflection tick. All transforms are on the cards, layout space is reserved so nothing reflows.
- **Canvas needed:** false
- **A11y note:** Cards are normal landmarked articles with real headings/prices; the billing toggle is a native switch, and price changes are announced by updating text (aria-live on the price element is avoided in favor of the toggle's own state announcement plus visible text change). Bobbing is transform-only decoration; prefers-reduced-motion freezes equilibrium heights with no bob or overshoot. Keyboard: tab order is document order regardless of float height.
- **Reference pull:** A brewer's hydrometer in a test jar: the same instrument rides higher or lower purely because the liquid's density changed, and it always overshoots and bobs twice before settling on a reading.
- **Rejected first instinct:** Making the recommended tier physically larger with a scale transform on hover, the standard pricing-page move, rejected because size is a shout, height-in-a-shared-medium is a measurement, and a shared liquid gives the billing toggle something meaningful to act on.
- **Feel in one line:** Like reading which option matters by seeing what the water decided to hold up.

### `silver-glance` (core) — REJECTED

- **The idea:** A feature/gallery card that behaves like a daguerreotype plate. A daguerreotype is a mirror: viewed at the wrong angle the image is a ghostly negative in polished silver, and only at one angle does it snap into a rich positive. The card renders its image (or feature illustration) inverted and dimmed by default, with a faint mirror-sheen band lying across it. At rest the card rocks through a slow ±2 degree perspective tilt, and as it passes through the 'correct' angle window the image momentarily resolves to positive, a periodic glimpse. Pointer position controls tilt directly: sweeping across the card swings it through negative → sheen glare → full positive, which locks while hovered.
- **The job:** Feature card / gallery item / portfolio thumbnail; replaces the static image card with hover-zoom.
- **Why distinct:** after-image is retinal persistence, decal-peel is a surface sticker, mat-crop/image-crop-mat are framing. None couple image polarity to viewing angle; the negative-at-rest, positive-at-the-right-angle inversion is unclaimed and is a genuinely different resting state (the card idles as a mystery, not a preview).
- **Mechanism:** Card gets perspective + rotateY driven by a --tilt custom property (idle keyframe, pointer overrides via one rAF handler). The image is duplicated: base layer with filter: invert(1) grayscale(0.4) brightness(0.6), top layer normal, masked by a linear-gradient whose position and softness are functions of --tilt, so the positive literally wipes in around the correct-angle window. The sheen is a nearly-transparent diagonal highlight band (background on a pseudo-element, moving opposite to tilt for parallax) drawn in --foreground at ~4% alpha, not a gradient wash but a single specular stripe. Radius 12, hairline --border frame like a plate mat.
- **Canvas needed:** false
- **A11y note:** The card is a link/button with full text label and alt text; the inversion trick is presentational (real `<img>` with CSS filters, so alt is intact). Keyboard focus sets --tilt to the resolve angle immediately, so focus = full positive image, no sweep needed. prefers-reduced-motion: no idle rocking, card rests at the resolved positive angle permanently.
- **Reference pull:** Holding a daguerreotype in hand: the plate is polished silver, so you tilt it hunting for the one angle where the ghost negative flips into an impossibly detailed positive, and that hunt is half the object's magic.
- **Rejected first instinct:** A standard 3D tilt-toward-cursor card with a glare highlight (the ubiquitous 'holographic card' effect), rejected because glare-on-tilt is decoration that has been shipped ten thousand times; coupling tilt to image POLARITY makes the tilt informative, you are developing the picture, not glossing it.
- **Feel in one line:** Like angling an heirloom plate toward the window until the ghost in the silver suddenly looks back.
- **Judge's rejection reason:** The resting state is an inverted image, which is what after-image already is, and the tilt-plus-glare card is the ubiquitous holographic-card effect. Practical failure too: filter invert(1) on real color photography produces hue-shifted, blown-out frames that no token palette can govern.

### `seal-roll` (core) — **SELECTED**

- **The idea:** A testimonial rendered as a cylinder-seal impression. A small cylinder (drawn in SVG, its curved surface carrying compressed, mirrored hints of glyphs) rolls slowly across the testimonial card from left to right, and the quote appears in its wake, pressed into the surface: each word arrives with a brief letterpress-style debossed state (slightly darker, 1px inset shadow feel via layered text) that relaxes to normal ink over ~400ms. When the cylinder reaches the end it lifts, the attribution stamps below, and after a dwell the card 'reclays': the impression fades and the cylinder rolls the NEXT testimonial, making it a self-advancing testimonial rotator whose transition is the mechanism itself.
- **The job:** Testimonial / quote section, single-quote rotator variant; replaces the fading testimonial carousel.
- **Why distinct:** rating-stamp and signet-drop are single percussive stamps; drift-stamp likewise. contact-form-teletype types character-by-character. Rolling impression is continuous, word-scale, and the rotation between testimonials IS the roll-out/re-clay cycle rather than a crossfade bolted onto a reveal.
- **Mechanism:** The cylinder is an SVG group (ellipse-capped rectangle, faint mirrored glyph texture at 20% via a `<text>` element clipped to the barrel) translating across the card width over ~4s with linear travel plus rotation matched to circumference (rotation angle = distance/radius so it visibly rolls, not slides). The quote is pre-laid-out; each word is a span with visibility gated by the cylinder's x-position (one rAF loop compares word offsets to cylinder x). Deboss = a .pressed class: color --foreground at 115% weight-appearance via text-shadow 0 1px 0 in --background over a --ns-muted underlayer, relaxing via transition. Re-clay = whole quote opacity/blur-out over 800ms while the cylinder returns. Pauses on hover/focus.
- **Canvas needed:** false
- **A11y note:** The full current quote plus attribution exist as real text in the DOM the moment a cycle starts (visibility gating is opacity, not content injection), and rotation announces via aria-live="off" by default with prev/next buttons and a pause control for keyboard users, standard carousel pattern. prefers-reduced-motion: quotes swap instantly at the rotation interval, no roll.
- **Reference pull:** Mesopotamian cylinder seals: a carved stone barrel rolled across wet clay leaves a continuous frieze, the writing appears in the wake of the roller, and the barrel itself carries the text in mirror-image relief.
- **Rejected first instinct:** A rubber-stamp that slams the whole quote down at once, rejected because the family already owns percussive stamps (signet-drop, rating-stamp) and a slam gives long quotes no temporal shape; rolling paces the reading and gives the rotator its transition for free.
- **Feel in one line:** Like watching someone's words be pressed into clay slowly enough that you believe they meant them.

### `plate-glint` (core) — REJECTED

- **The idea:** A gallery presented as glass negatives racked on a lightbox rail. Thumbnails hang in a row as dim, slightly transparent 'plates', each with a hairline frame and a faint edge highlight. A virtual light source drifts slowly along the rail at rest, so plates catch a moving glint on their edges one after another, a quiet sequential shimmer that makes the row feel physically lit. Hovering (or focusing) a plate lifts it a few pixels toward the light and 'develops' it: brightness and contrast rise to full over ~300ms as if held up to the lamp, while neighbors dim slightly, borrowing their light. Clicking opens the full image.
- **The job:** Gallery / image grid / portfolio strip; replaces the uniform thumbnail grid with hover-brighten.
- **Why distinct:** gallery-coverflow-caustic and caustic-coverflow are caustic-light coverflows (3D fan, water-light texture); gallery-gantry-track is mechanical travel. This is a flat rail whose life comes from a traveling light source at rest and a lift-to-the-lamp develop on hover, no 3D fan, no caustics, and the idle sequential edge-glint is the signature frame.
- **Mechanism:** One custom property --lamp-x animates 0→100% over ~20s (alternating). Each plate computes proximity to the lamp in CSS: a pseudo-element edge highlight (1px inner stroke in --foreground) whose opacity is driven by a per-plate --dist set once from layout, combined with --lamp-x via a clamp() falloff, no JS in the idle loop at all if plates are evenly spaced (each just offsets the shared animation with animation-delay). Plates idle at filter: brightness(0.55) contrast(0.85); hover/focus transitions to full with translateY(-4px) and a spring settle; siblings get brightness(0.45) via :has() on the container. Images are real `<img>` with radius 6 and --border frames.
- **Canvas needed:** false
- **A11y note:** Standard list of links: each plate is an `<a>` with alt/label, fully keyboard-tabbable, and focus triggers the same develop treatment as hover so keyboard users get identical prominence. The lamp drift is decoration only. prefers-reduced-motion: lamp parked center, no drift; develop transition becomes instant.
- **Reference pull:** A photographer's lightbox and a rack of large-format glass negatives: plates look like smoked grey nothing until one is lifted toward the lamp, and their polished edges each throw a brief glint as you walk past with a torch.
- **Rejected first instinct:** Ken Burns slow-zoom on each thumbnail in turn, rejected because pan-zoom idle motion is stock-template language and draws attention INTO random images arbitrarily; a traveling light treats the collection as one physical object and keeps every image dormant-but-present until chosen.
- **Feel in one line:** Like walking a torch down a shelf of old negatives and lifting one to the lamp to see what it holds.
- **Judge's rejection reason:** Near-pure CSS and very house-fit, but the traveling-light-source idea is the same engine as grazing-light, which does more with it; stripped of the lamp it is hover-brighten on a thumbnail row.

---

## Owner-facing outcome record

This section is deliberately terse — full outcome/gate/Filter-2 reporting lives in the companion build/gate notes, not here. This ideation record's job is completeness of the raw generation, not the verdict.
