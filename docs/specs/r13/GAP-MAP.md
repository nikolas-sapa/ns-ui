# Round 13 gap map — surface coverage of the 534 shipped components

Reference document for the round 13 scouts and the orchestrator. Built 2026-09-01 from
`registry.json` (534 items: 410 `core`, 124 `loud`) plus `git log`, `CHANGELOG.md`,
`docs/21st-bookmarks.md`, `docs/component-backlog.md`, `docs/polish-audit.md`,
`docs/marketing-plan.md` and `docs/decisions/`. Every slug below is bucketed into exactly
one surface. A `†` marks a `loud` (full-bleed showpiece) component; everything else is `core`.

**How to use it.** Before writing a spec, find the bucket your concept lands in, read the
slugs in it, and read the nearest component's header comment (not its slug). Section 3 lists
the concept axes that are used up; section 4 is what round 13 should actually be aimed at;
section 6 is the do-not-rebuild list.

---

## 1. Surface coverage

| Surface | Count | Share |
|---|---:|---:|
| Hero | 48 | 9.0% |
| Background (ambient full-bleed) | 54 | 10.1% |
| Section divider / transition | 21 | 3.9% |
| Scroll sequence | 5 | 0.9% |
| Feature grid / bento | 6 | 1.1% |
| Marquee | 3 | 0.6% |
| Gallery | 12 | 2.2% |
| Pricing | 4 | 0.7% |
| CTA / action moment | 17 | 3.2% |
| Testimonial / social proof | 2 | 0.4% |
| Logo wall | 1 | 0.2% |
| Waitlist / form moment | 53 | 9.9% |
| Footer | 1 | 0.2% |
| Nav / page furniture | 46 | 8.6% |
| Loader / curtain / status | 63 | 11.8% |
| Empty state / 404 | 12 | 2.2% |
| Decorative / texture | 23 | 4.3% |
| Product & app surfaces (non-landing) | 163 | 30.5% |
| **Total** | **534** | **100%** |

Two numbers matter here.

**157 of 534 (29%) sit on the landing-page axis** (hero, background, divider, scroll, grid,
marquee, gallery, pricing, testimonial, logo, footer). The other 71% is app and product
furniture, which round 13 is explicitly not adding to.

**Of those 157, 102 (65%) are hero or background.** The registry does not have a landing-page
coverage problem in general. It has one very deep column (a full-bleed surface behind or under
a headline) and eleven shallow ones. Every remaining bucket on that axis is in single or low
double digits, and four of them (footer 1, logo wall 1, testimonial 2, marquee 3) are
effectively unbuilt.

### Bucket definitions and members

#### Hero — 48

Full-bleed or full-width surface that carries the page's primary headline, or a headline treatment that replaces the H1's rendering.

`aspheric-turn-spiral`†, `auxin-canal`, `bitplane-cascade`†, `floret-pack`, `forage-vein`†, `hero-404-quadrant-occlusion`†, `hero-ascii-eclipse`†, `hero-ascii-lichtenberg`†, `hero-ascii-rainfall`†, `hero-ascii-reaction-front`†, `hero-ascii-schlieren`†, `hero-ascii-shock-diamonds`†, `hero-ascii-terrain`†, `hero-ascii-tunnel`†, `hero-ascii-wordmark`, `hero-beam-glyph`†, `hero-burin-hatch`†, `hero-chart-recorder`†, `hero-cloth-type`†, `hero-dipole-field`, `hero-faraday-wave-cell`†, `hero-glyph-silhouette-pack`†, `hero-gravity-well`†, `hero-isobar-contours`†, `hero-letterpress-lockup`†, `hero-long-exposure`, `hero-oscilloscope`†, `hero-particles-webgl`, `hero-penrose-inflate`†, `hero-recursive-type`†, `hero-slice-comb`†, `hero-string-envelope`†, `hero-text-ring-funnel`†, `hero-vortex-street`†, `kymograph-smoke-trace`†, `lenticule-swing`, `murmur-shear`†, `orb-web-construction`†, `photostat-reverse`†, `plasma-filament-wander`†, `rotor-window-bank`†, `text-ascii-cascade`†, `text-ligature-melt`, `text-prism-split`†, `text-slot-rotate`, `text-stitch-unpick`†, `weld-pool`†, `winnow-chaff-drift`†

#### Background (ambient full-bleed) — 54

Ambient full-bleed surface designed to sit *behind* content. Alive at rest, no primary copy of its own.

`agar-starve`†, `ascii-engraving-contour`†, `background-ascii-caustics`, `background-ascii-dither`, `background-ascii-domain-walls`, `background-ascii-flow`, `background-ascii-force-chains`, `background-ascii-nodal-lines`, `background-ascii-plasma`†, `background-ascii-voronoi-walls`, `background-ascii-wake`, `background-capillary-wick`†, `background-engine-turn-guilloche`†, `background-gradient-shader`†, `background-halftone-rosette`†, `background-lloyd-relax`, `background-text-branch-canopy`†, `background-truchet-weave`, `bed-fluidize`†, `brinicle-descent`†, `cursor-sixel-reveal`†, `cursor-subpixel-fringe`†, `dye-whorl`†, `edge-yield`†, `edm-crater-field`†, `film-gate-weave`†, `flash-entrain`, `flyback-tear`†, `foam-drain-coarsen`†, `granule-churn`†, `honeycomb-draw`, `interlace-field-comb`†, `kamacite-etch`†, `lamina-dome`†, `magnetron-racetrack-sweep`†, `mailbag-hook-exchange`†, `millstone-furrow-flow`, `offset-fountain-split`†, `pancake-lap`†, `ping-shadow`†, `rime-creep`†, `ring-graze`†, `ripple-migrate-slip`†, `roast-first-crack`†, `rolling-shutter-skew`†, `rosensweig-crest`†, `sand-lock`†, `shear-billow`†, `spiral-chute-accrete`†, `stack-step-carousel`†, `termite-ventilation-shafts`†, `terrain-erosion-carve`†, `thallus-siege`†, `tricone-bit-teeth`†

#### Section divider / transition — 21

Horizontal (or full-height) band separating two sections, plus layout-transition wipes.

`arc-ladder-climb`†, `bobbin-lace-pricking`, `craze-rule`, `cylinder-hillndale`, `delta-frame-macroblock`, `divider-mosaic-split`, `divider-petscii-vu`, `divider-telephone-cord-delam`, `divider-teletext-mosaic`, `edge-burnish-glaze`, `equation-kidney-cam`, `expansion-gap-breather`, `gravure-cell-wipe`, `neon-tube-striation`, `profilometer-trace`, `scroll-fine-register`, `transition-ascii-dissolve`†, `transition-panel-crumble`†, `tray-weep`†, `warp-knit-tricot-lapping`, `welt-channel-close`

#### Scroll sequence — 5

Scroll position is the driver: pinned scenes, scrubbed cameras, scroll-linked instruments.

`ebb-flat`†, `scroll-caliper`, `scroll-defrost`†, `scroll-particle-tunnel`, `scroll-story-strata`†

#### Feature grid / bento — 6

Feature grid, bento layout primitive, or a grid whose cells carry the mechanic.

`feature-grid-ascii-rule`, `grazing-light`, `grid-bento-ascii`, `grid-bento-dense`, `grid-magnetic-lattice`, `team-grid-timezone-rail`

#### Marquee — 3

Continuously travelling horizontal band of content.

`marquee-ticker-glyph`, `ticker-tape-splice`, `ticker-teleprinter`

#### Gallery — 12

Image / media / card gallery, carousel, masonry, and media reveals.

`carousel-card-riffle`, `compare-crack-seam`, `fiche-step-repeat`, `gallery-ascii-gradient-orientation`, `gallery-coverflow-caustic`, `gallery-gantry-track`†, `magazine-drop`†, `masonry-ascii-settle`, `reveal-cloth-unfurl`†, `reveal-ripple-tiles`, `slump-mould-drape`, `starch-shear`

#### Pricing — 4

Pricing tiers, plan comparison, plan-selection mechanics.

`brine-float`, `compare-table-reach-rule`, `pricing-scale`, `weir-crest`†

#### CTA / action moment — 17

The primary-action moment: button chrome, press-and-hold and destructive confirms, and the success payoff that follows.

`border-electric-arc`†, `button-cooldown-heat`, `button-glass`, `button-retry-backoff`, `confirm-dial-align`, `confirm-hold-ink`, `confirm-hold-wax`†, `confirm-slide-shatter`, `crack-arrest-hole`, `crimp-barrel-set`, `rapid-wire`†, `seam-gild`, `shakeout-crumble`†, `sinkhole-ravel`, `success-iron-filings`†, `success-nucleation`†, `success-plumb-bob`†

#### Testimonial / social proof — 2

Quotes, wall-of-love, review or social-proof surfaces.

`seal-roll`, `testimonial-wall-reflow`

#### Logo wall — 1

Customer / partner logo wall.

`logo-cloud-settle`

#### Waitlist / form moment — 53

Any input, control or form moment, including the waitlist / newsletter / signup capture.

`card-number-emboss`, `checkbox-domino-run`, `checkbox-ink-stroke`, `checkbox-tally-notch`, `consent-scope-redact`, `contact-form-teletype`, `crossfoot-gap`, `date-picker-moon`, `date-range-tape`, `dial-moire`, `envelope-window`, `file-upload-seal`, `file-upload-thermal`, `filter-facet-mesh`, `input-focus-membrane`, `listbox-sticky-groups`, `mesh-lash`, `newsletter-cadence-rail`, `otp-reel`, `password-strength-tide`, `radio-ballot-drop`, `radio-group-pin`, `rating-stamp`, `search-winnow`, `segmented-control-fling`, `select-caustic`, `signature-consent`, `slider-allocation-wire`, `slider-chladni-tune`†, `slider-loupe`, `slider-range-shear`, `slider-vernier`, `slug-field-mirror`, `spark-test-id`†, `stencil-fill`, `stepper-needle`, `stepper-ratchet`, `switch-ascii-knife`, `switch-eclipse`, `switch-frost`, `switch-solder-bead`, `tag-input-backspace`, `tag-input-cord`, `tag-input-pull`, `tag-input-tear`, `textarea-autosize-swell`, `time-picker-sundial`, `transfer-list-siphon`, `validation-error-summary`, `validation-inline-wick`, `voice-recorder-meter`, `wizard-canal-lock`, `wizard-dovetail`

#### Footer — 1

Site footer.

`footer-ascii-rule`

#### Nav / page furniture — 46

Site nav, menus, tabs, breadcrumbs, dialogs, toasts, tooltips, drawers, trees, pagination, theme toggle.

`accordion-latch`, `announcement-bar-relay`, `banner-tear-stub`, `breadcrumb-fold`, `breadcrumb-overflow-menu`, `command-palette-orbit`†, `command-palette-rotary`†, `context-menu-unfold`, `crease-fall`†, `dialog-emerge`, `dock-cursor-magnify`, `dock-shelf-lean`, `drawer-counterweight`, `drill-down-spines`, `dropdown-drape`, `faq-answer-depth-gutter`, `header-scroll-pill`, `hover-card-dwell`, `kelvin-wake`, `menu-nested-trays`, `minimap-pantograph`, `nav-blue-noise-scrim`, `nav-condense-rail`, `nav-overstrike-typewriter`, `nav-site-condense`, `notification-bell-swing`, `pagination-dog-ear`, `popover-pendulum`, `sieve-throw`†, `storey-pole`, `tabs-carriage`, `tabs-notch-tenon`, `tabs-rail-points`, `tabs-slack-cable`, `toast-gravity-stack`, `toast-newton-cradle`†, `toast-undo-fuse`, `toc-minimap-mercury`, `toggle-theme-ascii`, `tooltip-delay-group`, `tour-spotlight`, `tree-box-drawing`, `tree-hinge-fold`, `tree-root-trace`, `turntable-stall`, `view-toggle-rails`

#### Loader / curtain / status — 63

Loaders, progress, skeletons, route curtains, and live status indicators.

`airlift-slug-flow`, `autosave-ratchet`, `blade-stop`†, `bombe-drum-halt`, `braze-capillary-fill`, `caddisfly-case-assembly`, `capstan-slip`, `curd-cut-whey`, `curtain-austrian-gather`†, `curtain-leader-countdown`†, `curtain-tab-diagonal`†, `curtain-traveler-draw`†, `extrusion-die-cut`, `facer-stamp-flip`, `fax-line-slip`, `float-ribbon-draw`, `frazil-dam`, `gather-marver`, `glaze-crawl-heal`, `glory-hole-cycle`, `gluten-windowpane`, `grinding-chatter-lobes`, `groove-pitch`, `jacquard-card-chain`, `jam-kickout-loop`, `knife-edge-rack-focus`, `loader-ascii-diffuse-fill`, `loader-braille`, `loader-die-tumble`, `loader-ink-blob`, `loader-iris`, `loader-loom-weave`†, `loader-pendulum-sync`, `loader-spirograph-trace`, `loader-spring-bars`, `loader-thread-spool`, `lug-cage-tally`, `melt-pond-drain`, `progress-hatch`, `progress-narrated`, `progress-nlq-overstrike`, `progress-telegraph-log`, `progress-wick`, `remontoire-rewind`, `ring-stain`, `riso-drum-pass`, `roller-break-reduce`, `roller-occlusion`, `screen-flood-stroke`, `serving-mallet-wind`, `shearer-advance`, `shutter-telegraph-board`, `skeleton-develop`, `skeleton-schema`, `sleeper-renewal-relay`, `sorter-pocket-route`, `status-glyph-cadence`, `status-sphere-dots`, `steam-trap-batch-flush`, `tamper-tine-squeeze`, `toner-fuse-streak`, `venturi-ejector-draw`, `wind-regulator-bellows`

#### Empty state / 404 — 12

Empty states, first-run states, and 404s.

`cmm-probe-touch`, `dew-coalesce`, `eink-waveform-ghost`, `empty-state-braille-orbit`, `empty-state-dashed`, `empty-state-mezzotint`, `empty-state-pegboard`, `empty-state-sonar`, `empty-state-survey`, `not-found-attribute-clash`†, `not-found-knockout`†, `not-found-postmark`†

#### Decorative / texture — 23

Standalone decorative objects and card / panel backing textures with no page position of their own.

`ascii-globe-spin`†, `ascii-knot-volumetric`†, `ascii-torus-donut`†, `blast-hole-delay-sequence`, `border-chrome-ring`†, `cambium-lay`, `card-dot-gain-screen`, `container-box-drawing`, `crack-polygon-order`, `device-mockup-ascii-screen`, `honing-crosshatch`, `knit-ladder-run`, `network-packet-trace`, `peen-coverage`, `polyp-bud`, `range-light-transit`, `ropewalk-lay-twist`, `spall-face`, `sticker-peel`†, `surface-glass`, `tendril-cast`, `tufting-gun-loop-pile`, `turbidite-graded-bed`

#### Product & app surfaces (non-landing) — 163

Dashboards, data-viz, agent and LLM surfaces, money and billing, collaboration, developer and admin tooling. Auto-reject territory for round 13.

`adhesive-squeeze-bead`, `approval-inline-diff`, `avatar-stack-flock`, `back-bearing`, `badge-unread-tarnish`, `barograph-drum-week`, `bias-hysteresis`, `bitting-cut`, `board-kanban-ascii-wip`, `bowditch-close`, `boxplot-ascii-whisker`, `brass-check`, `carbon-ply-fade`, `catenary-contact-stagger`, `cathode-stack-glow`, `chain-scale`, `chargen-rom-slice`, `chart-area-aurora`†, `chart-bar-dither`, `chart-bar-halftone`, `chart-donut-halftone`, `chart-funnel-stage-drop`, `chart-line-dither`, `chart-radar-dither`, `chart-ridgeline-terrain`, `chart-scatter-ascii-bin`, `chart-waterfall-ascii-step`, `citation-grounding-gap`, `citation-grounding-hatch`, `citation-inline-card`, `clock-card`, `confidence-logprob-hatch`, `context-compaction-river`, `context-prompt-shims`, `contra-strike`, `copy-button-travel`, `copy-field-crimp`, `countdown-vapor-digits`, `counter-carry-ripple`, `creep-span`, `cruet-settle`, `decatron-step-ring`, `diagram-ascii-flow`, `diff-unified-viewer`, `due-slip`, `eval-regression-shear`, `event-stream-vapor`†, `feed-escapement`, `flamegraph-ascii-frames`, `flyball-throttle`, `frank-register`, `fugitive-ink`, `fusee-cone`, `galley-bracket`, `gantt-ascii-critical-path`, `gauge-capacity-waterline`, `git-graph-ascii-lanes`, `growth-ring`, `guardrail-interlock-keys`, `hachure-fall`, `heatmap-calendar-tide`†, `heatmap-year-stipple`, `helicorder-line-wrap`, `histogram-live-grain`, `idler-drop`, `image-crop-mat`, `index-contour`, `jominy-quench`†, `keymap-ascii-heat`, `knot-capsize-cycle`, `lcd-response-smear`, `leaven-crest-fall`, `lens-ascii-magnify`, `lining-wear`, `log-viewer-ascii-tail`, `manifold-bleed`, `map-choropleth-ascii`, `memory-ledger-decay`, `meter-context-window`, `meter-latency-capillary`, `meter-matrix-scan`, `meter-quota-meniscus`, `meter-quota-rule`, `meter-threshold-trip`, `mudflow-levee-build`, `mull-hinge`, `night-store`, `nomogram-edge`, `optimistic-stitch`, `overflow-chip-mux`, `parison-inflate`, `passing-loop`, `patchbay-ascii-cable`, `pecked-ring`, `picker-pareto-frontier`, `pin-register`, `pole-shy`, `post-list-ascii-index`, `press-register`, `prompt-version-grain`, `punch-figure`, `punch-patch`, `queue-triage-ratchet`, `rack-seat`, `raft-moor`, `redaction-hold-reveal`, `refresh-pull-flywheel`, `refusal-negotiation`, `remnant-cut`, `reorder-drag-wake`, `retrieval-chunk-sieve`, `return-aviso`, `router-tier-cascade`, `routing-slip`, `running-belay`, `rupert-snap`†, `sankey-ascii-flow`, `schedule-ascii-freebusy`, `scrubber-film-strip`, `seatmap-ascii-pick`, `seep-lattice`, `sheet-ascii-range`, `shortcuts-cheat-sheet`, `sparkline-ascii`, `sparkline-automaton`, `specie-clip`, `spectrogram-ascii-bands`, `spindle-strike`, `split-flap-board`, `split-pane-weighted`, `stat-row-baseline-spark`, `stat-tile-ascii-arrive`, `stats-radar-sweep`, `status-metaball-merge`, `stem-and-leaf-live`, `streaming-ink-dry`, `streaming-markdown-caret`, `streaming-retraction`, `streaming-token-settle`, `strip-station`, `swipe-row-detent`, `table-heat-shimmer`, `tacho-disc`, `tally-cleave`, `text-card-flick`, `text-decrypt`, `text-ekg-baseline`, `text-variable-weight`, `time-ago-drift`, `timeline-agent-lanes`, `timeline-changelog-wave`, `timeline-reasoning-rail`, `tonearm-skate`, `tool-call-board`, `treemap-ascii-partition`, `truncation-taper-fade`, `truncation-word-count`, `typing-indicator-trace`, `undo-drift-bar`, `undo-ghost-row`, `vellum-scrape`, `waveform-ascii-scrub`, `zipper-stall`

---

## 2. Mechanic families — how they render, not what they depict

| Family | Count | Share |
|---|---:|---:|
| 2D canvas particle / field | 156 | 29.2% |
| SVG geometry | 131 | 24.5% |
| CSS-only | 94 | 17.6% |
| ASCII / glyph grid | 73 | 13.7% |
| DOM / spring physics | 41 | 7.7% |
| WebGL shader | 20 | 3.7% |
| Text / typography manipulation | 19 | 3.6% |

**2D canvas particle / field** (156): `agar-starve`†, `arc-ladder-climb`†, `background-capillary-wick`†, `background-engine-turn-guilloche`†, `background-lloyd-relax`, `background-text-branch-canopy`†, `background-truchet-weave`, `barograph-drum-week`, `bed-fluidize`†, `bias-hysteresis`, `bitplane-cascade`†, `blade-stop`†, `bobbin-lace-pricking`, `braze-capillary-fill`, `brinicle-descent`†, `caddisfly-case-assembly`, `card-dot-gain-screen`, `cathode-stack-glow`, `chart-area-aurora`†, `chart-bar-dither`, `chart-funnel-stage-drop`, `chart-line-dither`, `chart-radar-dither`, `chart-ridgeline-terrain`, `cmm-probe-touch`, `command-palette-orbit`†, `compare-crack-seam`, `confirm-hold-ink`, `confirm-slide-shatter`, `countdown-vapor-digits`, `crack-arrest-hole`, `curd-cut-whey`, `cursor-subpixel-fringe`†, `curtain-leader-countdown`†, `cylinder-hillndale`, `date-picker-moon`, `delta-frame-macroblock`, `dial-moire`, `divider-mosaic-split`, `divider-petscii-vu`, `divider-telephone-cord-delam`, `divider-teletext-mosaic`, `edge-burnish-glaze`, `eink-waveform-ghost`, `event-stream-vapor`†, `extrusion-die-cut`, `fax-line-slip`, `file-upload-thermal`, `film-gate-weave`†, `float-ribbon-draw`, `foam-drain-coarsen`†, `forage-vein`†, `frazil-dam`, `gallery-coverflow-caustic`, `gather-marver`, `glaze-crawl-heal`, `glory-hole-cycle`, `gluten-windowpane`, `gravure-cell-wipe`, `grid-magnetic-lattice`, `grinding-chatter-lobes`, `groove-pitch`, `helicorder-line-wrap`, `hero-beam-glyph`†, `hero-burin-hatch`†, `hero-chart-recorder`†, `hero-cloth-type`†, `hero-dipole-field`, `hero-faraday-wave-cell`†, `hero-gravity-well`†, `hero-long-exposure`, `hero-penrose-inflate`†, `hero-slice-comb`†, `hero-text-ring-funnel`†, `hero-vortex-street`†, `honeycomb-draw`, `honing-crosshatch`, `input-focus-membrane`, `interlace-field-comb`†, `jacquard-card-chain`, `jominy-quench`†, `kelvin-wake`, `knife-edge-rack-focus`, `knit-ladder-run`, `kymograph-smoke-trace`†, `lamina-dome`†, `lcd-response-smear`, `loader-ink-blob`, `loader-loom-weave`†, `magazine-drop`†, `mailbag-hook-exchange`†, `melt-pond-drain`, `meter-matrix-scan`, `millstone-furrow-flow`, `mudflow-levee-build`, `murmur-shear`†, `nav-blue-noise-scrim`, `nav-overstrike-typewriter`, `neon-tube-striation`, `not-found-knockout`†, `offset-fountain-split`†, `orb-web-construction`†, `otp-reel`, `pancake-lap`†, `parison-inflate`, `password-strength-tide`, `peen-coverage`, `plasma-filament-wander`†, `pricing-scale`, `profilometer-trace`, `reveal-ripple-tiles`, `ring-graze`†, `ripple-migrate-slip`†, `riso-drum-pass`, `roast-first-crack`†, `roller-break-reduce`, `roller-occlusion`, `rolling-shutter-skew`†, `ropewalk-lay-twist`, `rupert-snap`†, `screen-flood-stroke`, `scroll-particle-tunnel`, `scroll-story-strata`†, `select-caustic`, `serving-mallet-wind`, `shakeout-crumble`†, `sieve-throw`†, `signature-consent`, `sinkhole-ravel`, `slider-chladni-tune`†, `slider-loupe`, `slump-mould-drape`, `spall-face`, `spark-test-id`†, `sparkline-automaton`, `spiral-chute-accrete`†, `stack-step-carousel`†, `stats-radar-sweep`, `status-metaball-merge`, `stepper-needle`, `success-iron-filings`†, `success-nucleation`†, `switch-frost`, `table-heat-shimmer`, `termite-ventilation-shafts`†, `terrain-erosion-carve`†, `thallus-siege`†, `timeline-changelog-wave`, `toner-fuse-streak`, `transition-panel-crumble`†, `tricone-bit-teeth`†, `tufting-gun-loop-pile`, `turbidite-graded-bed`, `venturi-ejector-draw`, `warp-knit-tricot-lapping`, `winnow-chaff-drift`†

**SVG geometry** (131): `accordion-latch`, `adhesive-squeeze-bead`, `airlift-slug-flow`, `autosave-ratchet`, `auxin-canal`, `back-bearing`, `bitting-cut`, `border-electric-arc`†, `bowditch-close`, `brass-check`, `brine-float`, `cambium-lay`, `capstan-slip`, `catenary-contact-stagger`, `chart-bar-halftone`, `chart-donut-halftone`, `checkbox-ink-stroke`, `checkbox-tally-notch`, `citation-grounding-gap`, `confirm-hold-wax`†, `context-compaction-river`, `contra-strike`, `crack-polygon-order`, `craze-rule`, `creep-span`, `crimp-barrel-set`, `crossfoot-gap`, `cruet-settle`, `curtain-austrian-gather`†, `curtain-tab-diagonal`†, `curtain-traveler-draw`†, `decatron-step-ring`, `dew-coalesce`, `empty-state-dashed`, `empty-state-pegboard`, `empty-state-sonar`, `empty-state-survey`, `equation-kidney-cam`, `expansion-gap-breather`, `file-upload-seal`, `filter-facet-mesh`, `flyball-throttle`, `frank-register`, `fusee-cone`, `galley-bracket`, `gauge-capacity-waterline`, `growth-ring`, `hachure-fall`, `heatmap-year-stipple`, `hero-isobar-contours`†, `hero-string-envelope`†, `hover-card-dwell`, `idler-drop`, `index-contour`, `knot-capsize-cycle`, `leaven-crest-fall`, `loader-die-tumble`, `loader-iris`, `loader-spirograph-trace`, `loader-thread-spool`, `lug-cage-tally`, `manifold-bleed`, `mesh-lash`, `meter-latency-capillary`, `meter-quota-meniscus`, `meter-quota-rule`, `meter-threshold-trip`, `minimap-pantograph`, `mull-hinge`, `network-packet-trace`, `night-store`, `nomogram-edge`, `not-found-postmark`†, `notification-bell-swing`, `optimistic-stitch`, `pecked-ring`, `picker-pareto-frontier`, `pole-shy`, `polyp-bud`, `press-register`, `punch-patch`, `rack-seat`, `range-light-transit`, `rapid-wire`†, `refresh-pull-flywheel`, `remnant-cut`, `remontoire-rewind`, `ring-stain`, `scroll-caliper`, `scrubber-film-strip`, `seal-roll`, `seam-gild`, `seep-lattice`, `shearer-advance`, `sleeper-renewal-relay`, `slider-allocation-wire`, `slider-vernier`, `specie-clip`, `status-glyph-cadence`, `status-sphere-dots`, `steam-trap-batch-flush`, `stepper-ratchet`, `storey-pole`, `strip-station`, `success-plumb-bob`†, `switch-eclipse`, `switch-solder-bead`, `tabs-notch-tenon`, `tabs-rail-points`, `tabs-slack-cable`, `tacho-disc`, `tag-input-cord`, `tag-input-tear`, `tally-cleave`, `tamper-tine-squeeze`, `tendril-cast`, `text-ekg-baseline`, `text-stitch-unpick`†, `time-picker-sundial`, `toast-undo-fuse`, `toc-minimap-mercury`, `tonearm-skate`, `transfer-list-siphon`, `tree-root-trace`, `turntable-stall`, `typing-indicator-trace`, `validation-error-summary`, `view-toggle-rails`, `voice-recorder-meter`, `wind-regulator-bellows`, `wizard-dovetail`

**CSS-only** (94): `announcement-bar-relay`, `approval-inline-diff`, `background-halftone-rosette`†, `badge-unread-tarnish`, `banner-tear-stub`, `blast-hole-delay-sequence`, `breadcrumb-fold`, `breadcrumb-overflow-menu`, `button-cooldown-heat`, `button-glass`, `button-retry-backoff`, `card-number-emboss`, `carousel-card-riffle`, `chain-scale`, `checkbox-domino-run`, `citation-grounding-hatch`, `clock-card`, `consent-scope-redact`, `contact-form-teletype`, `context-menu-unfold`, `context-prompt-shims`, `copy-button-travel`, `date-range-tape`, `dialog-emerge`, `dock-cursor-magnify`, `dock-shelf-lean`, `drill-down-spines`, `due-slip`, `envelope-window`, `eval-regression-shear`, `faq-answer-depth-gutter`, `fiche-step-repeat`, `floret-pack`, `fugitive-ink`, `grazing-light`, `grid-bento-dense`, `guardrail-interlock-keys`, `header-scroll-pill`, `heatmap-calendar-tide`†, `histogram-live-grain`, `image-crop-mat`, `lining-wear`, `listbox-sticky-groups`, `marquee-ticker-glyph`, `memory-ledger-decay`, `menu-nested-trays`, `meter-context-window`, `nav-condense-rail`, `nav-site-condense`, `overflow-chip-mux`, `pagination-dog-ear`, `passing-loop`, `progress-nlq-overstrike`, `progress-telegraph-log`, `prompt-version-grain`, `punch-figure`, `queue-triage-ratchet`, `raft-moor`, `rating-stamp`, `refusal-negotiation`, `retrieval-chunk-sieve`, `return-aviso`, `router-tier-cascade`, `routing-slip`, `running-belay`, `scroll-fine-register`, `search-winnow`, `shortcuts-cheat-sheet`, `skeleton-develop`, `skeleton-schema`, `slider-range-shear`, `stat-row-baseline-spark`, `stem-and-leaf-live`, `stencil-fill`, `surface-glass`, `swipe-row-detent`, `tag-input-backspace`, `tag-input-pull`, `team-grid-timezone-rail`, `testimonial-wall-reflow`, `textarea-autosize-swell`, `ticker-tape-splice`, `timeline-agent-lanes`, `timeline-reasoning-rail`, `tool-call-board`, `tooltip-delay-group`, `tour-spotlight`, `tree-hinge-fold`, `undo-drift-bar`, `undo-ghost-row`, `validation-inline-wick`, `vellum-scrape`, `wizard-canal-lock`, `zipper-stall`

**ASCII / glyph grid** (73): `ascii-engraving-contour`†, `ascii-globe-spin`†, `ascii-knot-volumetric`†, `ascii-torus-donut`†, `background-ascii-caustics`, `background-ascii-dither`, `background-ascii-domain-walls`, `background-ascii-flow`, `background-ascii-force-chains`, `background-ascii-nodal-lines`, `background-ascii-plasma`†, `background-ascii-voronoi-walls`, `background-ascii-wake`, `board-kanban-ascii-wip`, `boxplot-ascii-whisker`, `chargen-rom-slice`, `chart-scatter-ascii-bin`, `chart-waterfall-ascii-step`, `compare-table-reach-rule`, `container-box-drawing`, `cursor-sixel-reveal`†, `device-mockup-ascii-screen`, `diagram-ascii-flow`, `empty-state-braille-orbit`, `empty-state-mezzotint`, `feature-grid-ascii-rule`, `flamegraph-ascii-frames`, `footer-ascii-rule`, `gallery-ascii-gradient-orientation`, `gantt-ascii-critical-path`, `git-graph-ascii-lanes`, `grid-bento-ascii`, `hero-404-quadrant-occlusion`†, `hero-ascii-eclipse`†, `hero-ascii-lichtenberg`†, `hero-ascii-rainfall`†, `hero-ascii-reaction-front`†, `hero-ascii-schlieren`†, `hero-ascii-shock-diamonds`†, `hero-ascii-terrain`†, `hero-ascii-tunnel`†, `hero-ascii-wordmark`, `hero-glyph-silhouette-pack`†, `hero-oscilloscope`†, `hero-recursive-type`†, `kamacite-etch`†, `keymap-ascii-heat`, `lens-ascii-magnify`, `loader-ascii-diffuse-fill`, `loader-braille`, `log-viewer-ascii-tail`, `map-choropleth-ascii`, `masonry-ascii-settle`, `newsletter-cadence-rail`, `not-found-attribute-clash`†, `patchbay-ascii-cable`, `post-list-ascii-index`, `progress-hatch`, `rosensweig-crest`†, `sankey-ascii-flow`, `schedule-ascii-freebusy`, `seatmap-ascii-pick`, `sheet-ascii-range`, `sparkline-ascii`, `spectrogram-ascii-bands`, `stat-tile-ascii-arrive`, `switch-ascii-knife`, `ticker-teleprinter`, `toggle-theme-ascii`, `transition-ascii-dissolve`†, `tree-box-drawing`, `treemap-ascii-partition`, `waveform-ascii-scrub`

**DOM / spring physics** (41): `avatar-stack-flock`, `bombe-drum-halt`, `carbon-ply-fade`, `command-palette-rotary`†, `confirm-dial-align`, `counter-carry-ripple`, `crease-fall`†, `drawer-counterweight`, `dropdown-drape`, `facer-stamp-flip`, `feed-escapement`, `flash-entrain`, `gallery-gantry-track`†, `hero-letterpress-lockup`†, `jam-kickout-loop`, `lenticule-swing`, `loader-pendulum-sync`, `loader-spring-bars`, `logo-cloud-settle`, `pin-register`, `popover-pendulum`, `progress-wick`, `radio-ballot-drop`, `radio-group-pin`, `reorder-drag-wake`, `reveal-cloth-unfurl`†, `rotor-window-bank`†, `segmented-control-fling`, `shutter-telegraph-board`, `sorter-pocket-route`, `spindle-strike`, `split-pane-weighted`, `starch-shear`, `sticker-peel`†, `tabs-carriage`, `text-ascii-cascade`†, `text-card-flick`, `text-prism-split`†, `toast-gravity-stack`, `toast-newton-cradle`†, `welt-channel-close`

**WebGL shader** (20): `aspheric-turn-spiral`†, `background-gradient-shader`†, `border-chrome-ring`†, `dye-whorl`†, `ebb-flat`†, `edge-yield`†, `edm-crater-field`†, `flyback-tear`†, `granule-churn`†, `hero-particles-webgl`, `magnetron-racetrack-sweep`†, `photostat-reverse`†, `ping-shadow`†, `rime-creep`†, `sand-lock`†, `scroll-defrost`†, `shear-billow`†, `tray-weep`†, `weir-crest`†, `weld-pool`†

**Text / typography manipulation** (19): `citation-inline-card`, `confidence-logprob-hatch`, `copy-field-crimp`, `diff-unified-viewer`, `progress-narrated`, `redaction-hold-reveal`, `slug-field-mirror`, `split-flap-board`, `streaming-ink-dry`, `streaming-markdown-caret`, `streaming-retraction`, `streaming-token-settle`, `text-decrypt`, `text-ligature-melt`, `text-slot-rotate`, `text-variable-weight`, `time-ago-drift`, `truncation-taper-fade`, `truncation-word-count`
---

## 3. The exhausted axes

An axis is exhausted when the *next* concept on it is a restyle: same rendering technique, same
class of source, differing only in which field gets simulated. Five are exhausted, with counts.

### 3.1 The ASCII scalar field — 73 slugs, and the technique axis on top of it is also closing

73 components tag `ascii` or `box-drawing`; 96 slugs mention glyph, monospace or box-drawing
rendering in their description. The core pattern is what round 8a already recorded: *simulate a
scalar field, map luminance through a ramp glyph, keep 85-97% of cells empty*. Round 8a's answer
was to move up a level and source the **technique** rather than the field (quadrant sub-cells,
braille 2x4, Sobel angle, Floyd-Steinberg, blue noise, PETSCII, sixel, teletext sextants,
overstrike, NLQ half-pitch, mezzotint, attribute clash, ClearType slivers, contact-screen dot
gain). That axis is now also thin: 13 ASCII heroes and 13 ASCII backgrounds already ship, plus
one per surface almost everywhere else (`footer-ascii-rule`, `grid-bento-ascii`,
`feature-grid-ascii-rule`, `masonry-ascii-settle`, `post-list-ascii-index`, `switch-ascii-knife`,
`toggle-theme-ascii`, `transition-ascii-dissolve`, `treemap-ascii-partition`). **A new ASCII
component needs a sub-cell addressing scheme or a print technique nobody here has used. "Which
field" is dead; "which glyph grid" is nearly dead.**

### 3.2 The full-bleed simulated physical process — 102 slugs

Hero (48) plus ambient background (54). The recipe is fixed: pick a real physical or industrial
process, integrate it on a canvas or in a fragment shader, run it full-bleed, put the headline
over or inside it. `CHANGELOG.md` records **24 distinct sourcing axes consumed by rounds 9-12
alone** (textile, machining, analog recording, reprographics, chart recorders, scan technique,
lab instrumentation, milling, glass, cipher machines, optics manufacture, joining, horology,
cryo, pneumatics, gas discharge, mail handling, fermentation, drilling, animal architecture,
railway permanent way, leather and cordage, optical telegraphy, granular flow), on top of round
8a's own long list. The evidence that it is used up is in the round record itself: of the 118
components built in rounds 9-12, **51 were cut** and the changelog names "restyles of components
already shipped" as the dominant kill reason before code was even written. Round 13 should treat
"a new physical process rendered full-bleed" as the default-reject, not the default-accept.

### 3.3 Print and photo-reproduction — 40 slugs

`dither`, `halftone`, Bayer, riso, gravure, offset, screen-print, toner, letterpress, photostat,
stipple, mezzotint, dot gain and moire between them cover 40 components, including a whole
six-member dithered chart family. Ink-density-instead-of-colour is now this registry's house
idiom rather than an unclaimed axis.

### 3.4 Display-hardware artifacts — 32 slugs

CRT, scanline, phosphor, e-ink, LCD overdrive, rolling shutter, interlace, subpixel, teletext,
PETSCII, ZX attribute clash, NES PPU, Nixie, decatron, split-flap, sixel, dot-matrix, vector
display, bitplane. Round 8b took this axis as an explicit brief and shipped 16 on it. There is
very little unclaimed display hardware left that is also monochrome-legible.

### 3.5 The small mechanism metaphor — 23 slugs

Ratchet, escapement, pawl, detent, gear train, flywheel, governor, cam, capstan, crank. This axis
also has the worst kill record in the repo: **15 of the 59 removed components were cut in one
commit as "slop/duplicate"**, and almost all of them were this (`barrel-bolt`, `breaker-snap`,
`cog-rail`, `dashpot-latch`, `dovetail-pick`, `feeler-gap`, `keystone-lean`, `torsion-latch`,
`slack-reel`). A mechanism metaphor attached to a small control is the single most-rejected shape
in this registry's history.

### Not exhausted, worth naming

- **Type-setting and composition mechanics** as a *layout* driver rather than a headline effect.
  19 components manipulate text, but almost all operate on one headline or one streaming line.
- **Scroll as the driver.** 5 slugs. The technique is barely touched compared to hero and
  background.
- **Multi-element choreography.** Almost every component is one surface running one process.
  Components where N discrete blocks negotiate with each other (`testimonial-wall-reflow`,
  `grid-bento-dense`, `logo-cloud-settle`) are rare and all sit in the thin buckets.

---

## 4. The gap list, ranked

Ranked by how badly a real landing page needs the surface, weighted up when the repo has already
named the gap more than once (section 5) and weighted down when a partial answer exists.

| # | Surface | Count today | What is missing |
|---|---|---:|---|
| 1 | **Footer** | 1 | `footer-ascii-rule` is a back-to-top scroll instrument with a sitemap attached, not a footer block. Named as an open gap three times in this repo's own docs, and `footing-course` was built and removed for answering the category instead of the component. Nothing here handles the actual footer job: a wide multi-column terminal band that ends the page. |
| 2 | **CTA section / closing band** | 0 as a section | 17 slugs in the CTA bucket, but 13 of them are destructive confirms and success payoffs, and the rest are button chrome (`button-glass`, `button-cooldown-heat`, `button-retry-backoff`, `border-electric-arc`). There is no *closing CTA band*: the full-width final section that carries one headline and one button. The most load-bearing block on any landing page and the registry has zero. |
| 3 | **Logo wall** | 1 | `logo-cloud-settle` drops generated marks into a grid once and stops being interesting. No marquee variant, no density/scroll variant, nothing that stays alive at rest, and nothing that handles real logos of unequal optical weight. Named twice in the repo's docs (10 ecosystem hits). |
| 4 | **Testimonial / social proof** | 2 | `testimonial-wall-reflow` (masonry re-pack) and `seal-roll` (single-quote rotator). Missing: a wall-of-love marquee, a rating/score surface, an avatar-proof row (`avatar-stack-flock` is a presence widget, not social proof), and any quote surface where the *reading* is the mechanic. Named twice (13 ecosystem hits, "the second most repeated block out there"). |
| 5 | **Feature grid / bento** | 6 | Only `feature-grid-ascii-rule`, `grazing-light`, `grid-bento-ascii`, `grid-bento-dense`, `grid-magnetic-lattice`, `team-grid-timezone-rail`. The backlog calls feature grid "the single most repeated block out there" (19 hits) and bento a layout primitive the rest of the queue composes into (12 hits). Missing: a grid where the *cells* carry the mechanic and the grid earns being a grid rather than being a picture with borders. |
| 6 | **Waitlist / email capture moment** | 1 | 53 components in the form bucket and exactly one of them (`newsletter-cadence-rail`) is a landing capture. The rest are app inputs: sliders, switches, tag inputs, date pickers, validation. Missing: the waitlist moment itself, where submitting produces a real payoff (queue position, invite, referral state) instead of a toast. |
| 7 | **Pricing** | 4 | `brine-float`, `pricing-scale`, `weir-crest` and `compare-table-reach-rule`. Three of the four are "tiers as a physical balance/level" and read as siblings. Missing: the monthly/annual toggle as a real mechanic, a usage or seat calculator, and the enterprise/contact tier that breaks the row. |
| 8 | **Marquee** | 3 | `marquee-ticker-glyph`, `ticker-tape-splice`, `ticker-teleprinter` are all financial-ticker register: fixed-speed horizontal text. Missing: a marquee carrying non-text payload (logos, cards, quotes), and any marquee whose speed or direction is driven by something (scroll velocity, hover, content pressure). |
| 9 | **Site nav furniture** | 5 real navs | 46 slugs in the nav bucket, but only `nav-site-condense`, `nav-condense-rail`, `nav-overstrike-typewriter`, `kelvin-wake` and `header-scroll-pill` are actual site navigation; the rest are app menus, tabs, toasts, trees and dialogs. The backlog calls site nav "the one block with real mechanics in it, highest leverage remaining". Missing: a mega-menu, and a mobile sheet that is a component rather than a page. |
| 10 | **Scroll sequence** | 5 | `ebb-flat`, `scroll-defrost`, `scroll-story-strata`, `scroll-particle-tunnel`, `scroll-caliper`. Four are one pinned surface scrubbed by scroll; only `scroll-story-strata` has content beats. Missing: a scroll sequence that hands off between *sections* rather than scrubbing a single scene, i.e. the mechanic that carries a whole page rather than one viewport. |

### Runners-up, in order

11. **FAQ** — 1 (`faq-answer-depth-gutter`, deliberately plain). 12. **Stat / KPI row** — 3
(`stat-row-baseline-spark`, `stat-tile-ascii-arrive`, `cathode-stack-glow`), all app-register.
13. **Device mockup** — 1 (`device-mockup-ascii-screen`); named twice, 15 ecosystem hits.
14. **Blog / post index** — 1 (`post-list-ascii-index`). 15. **Team / about section** — 1
(`team-grid-timezone-rail`). 16. **Auth / login surface** — 0; named once (7 hits), and
`wizard-dovetail` is a stepper, not an auth surface. 17. **Comparison / "vs" section** — 1
(`compare-table-reach-rule`).

### Explicitly closed since the backlog was written — do not re-open

Liquid-metal full-bleed hero (`weld-pool`), rotating-word slot (`text-slot-rotate`), funnel chart
(`chart-funnel-stage-drop`), heatmap (`heatmap-calendar-tide`, `heatmap-year-stipple`), 404
(`not-found-postmark`, `not-found-knockout`, `not-found-attribute-clash`,
`hero-404-quadrant-occlusion`), knot/volumetric geometry (`ascii-knot-volumetric`), theme toggler
(`toggle-theme-ascii`), preloader / route curtain (`blade-stop` plus the four `curtain-*`
components), dithered chart family (six `chart-*-dither`/`halftone` slugs), choropleth
(`map-choropleth-ascii`), pie/donut (`chart-donut-halftone`), masonry gallery
(`masonry-ascii-settle`), contact form (`contact-form-teletype`), lens/magnifier
(`lens-ascii-magnify`, `slider-loupe`).

---

## 5. Gaps this repo has named more than once

Per the showpiece recipe, these outrank anything a scout invents. Sources checked:
`docs/21st-bookmarks.md`, `docs/component-backlog.md`, `docs/marketing-plan.md`,
`docs/polish-audit.md`, `docs/decisions/`.

| Gap | Named in | Times | Status |
|---|---|---:|---|
| **Footer** | bookmarks ("Page furniture" table + ranked queue #1), backlog (ranked queue #1), plus the `footing-course` removal commit | **3** | **Open.** One slug, and it is a scroll instrument. |
| **Feature grid** | backlog concept table (19 hits, "the single most repeated block out there") + backlog ranked queue #6 | 2 | **Open.** 2 real feature-grid slugs. |
| **Logo cloud** | backlog concept table (10 hits) + ranked queue #8 | 2 | **Open.** 1 slug. |
| **Testimonial wall** | backlog concept table (13 hits) + ranked queue #7 | 2 | **Open.** 2 slugs. |
| **Bento grid** | backlog concept table (12 hits) + ranked queue #5 | 2 | **Thin.** 2 slugs, both layout primitives. |
| **Site nav** | backlog concept table (12 hits) + ranked queue #3 | 2 | **Thin.** 5 real navs, no mega-menu. |
| **Stat tile / KPI row** | backlog concept table (7 hits) + ranked queue #9 | 2 | **Thin.** 3 slugs, all app-register. |
| **Device mockup** | backlog concept table (15 hits) + ranked queue #10 | 2 | **Thin.** 1 slug. |
| Preloader / route curtain | bookmarks ranked queue #2 + backlog ranked queue #2 | 2 | **Closed** by round 8a (5 slugs). |
| Liquid-metal full-bleed hero | bookmarks (3 separate bookmark rows) + bookmarks queue #4 + backlog queue #16 | 3 | **Closed** (`weld-pool`). |
| Rotating-word slot | bookmarks queue #5 + backlog queue #17 | 2 | **Closed** (`text-slot-rotate`). |
| Funnel chart | bookmarks queue #6 + backlog queue #13 | 2 | **Closed** (`chart-funnel-stage-drop`). |
| Theme toggler | backlog concept table (9 hits) + ranked queue #4 | 2 | **Closed** (`toggle-theme-ascii`). |

**The four to build against:** footer, feature grid, logo cloud, testimonial wall. Each is named
twice or more, each is still open, and all four sit in the top five of the ranked gap list
independently. A round 13 concept that answers one of these outranks a technically better concept
that answers none.

**Two documents contain no component gaps and can be skipped.** `docs/marketing-plan.md`'s gaps
are all SEO and distribution (no JSON-LD, no crawlable path to component pages, sitemap
coverage), not surfaces. `docs/polish-audit.md` is a site-chrome audit whose scope note
explicitly excludes `registry/` and `/preview/[name]`. `docs/decisions/` holds one file, on
component versioning, with no gap content.

**A standing warning from both source documents, repeated here because it killed two
components:** the bookmarks file's method note says a gap identified from slugs alone "is not
enough to build against", and the backlog says the same. `footing-course` and `gel-wash` were
both built by inventing a house-style answer to a named category. Naming the gap is step one;
step two is a real mechanic, not a category answer.

---

## 6. Removed-component ledger — 59 slugs, do not rebuild any of them

Derived from `git log --diff-filter=D --name-only -- 'registry/*/component.tsx'` across all
branches, with `docs/rename-map.tsv` (224 renames) subtracted so renamed slugs are not miscounted
as removals. 593 distinct component directories have ever existed under `registry/`. 534 remain;
of the 281 that no longer resolve, 222 are old sides of a rename and 59 are genuine removals.

### Cut in owner review after passing every gate, rounds 10-12 (23)

`CHANGELOG.md` v0.27.0: "rounds 10, 11 and 12 lost nine, six and eight to owner review
respectively, all quarantined rather than deleted." No per-slug reason was recorded; the spec for
each still sits in `docs/specs/r1x/`, which is the trap. **A spec file existing in
`docs/specs/r10`, `r11` or `r12` does not mean the component shipped.**

- **r10 (9):** `autoclave-cycle-gauge`, `centrifuge-rotor-band`, `differential-analyser-trace`,
  `lap-stroke-trace`, `microtome-ribbon-feed`, `rivet-buck-set`, `soxhlet-siphon-cycle`,
  `vacuum-filtration-cake-build`, `weld-nugget-grow`
- **r11 (6):** `column-wheel-heart-reset`, `elevator-leg-dump`, `lamination-fold-shear`,
  `pneumatic-carrier-dispatch`, `rack-snail-strike`, `tourbillon-cage`
- **r12 (8):** `auger-flighting-spoil`, `flag-hoist-run`, `fresnel-flash-group`,
  `jumbo-drill-boom-pattern`, `pipe-stand-trip`, `semaphore-arm-cast`, `semaphore-arm-tension`,
  `wasp-nest-envelope`

### Cut with a stated reason (36)

| Slug(s) | Date | Stated reason |
|---|---|---|
| `surface-crt-glass` | 2026-08-25 | Round 8a review: built, working, "none earning their place" (one of five 8a cuts; the other four never landed in `registry/`). |
| `sear-notch`, `blowdown-seat` | 2026-08-19 | "Both worked, neither could be read." Legibility, not mechanism. |
| `strata-cut` | 2026-08-11 | Duplicate of `scroll-story-strata`. |
| `capstan-scrub`, `chalk-snap`, `chord-punch`, `flood-mark`, `fringe-shift`, `grain-crest`, `hysteresis-latch`, `kintsugi-mend`, `light-table`, `pin-barrel`, `solvent-front`, `thumb-notch`, `under-brace` | 2026-08-10 | "Cut batch-1 components and unbriefed orphans." |
| `footing-course`, `gel-wash` | 2026-07-31 | "Built from slugs, not from the components they were meant to answer." The footer and the preloader/route-curtain gaps, both answered by category invention. Cited in `showpiece-recipe.md` as the canonical failure mode. |
| `tack-peel` | 2026-07-28 | Removed during a card-defect sweep. |
| `barrel-bolt`, `breaker-snap`, `camber-beam`, `cog-rail`, `dashpot-latch`, `day-tank`, `dovetail-pick`, `draw-tube`, `feeler-gap`, `gather-pleat`, `keystone-lean`, `level-bubble`, `slack-reel`, `torsion-latch`, `dead-reckoning` | 2026-07-22 | "15 slop/duplicate components flagged in owner review" (185 → 170). Mostly small mechanism metaphors: see section 3.5. |
| `tensegrity-drift` | 2026-07-22 | Cut on integration, resurrected by a merge, then re-cut. |

### Specced but never built (2)

`facsimile-drum-scan` and `spectrometer-slit-scan-drum` have r9 spec files and no component,
in git history or otherwise. Round 9 shipped 28 of 30 specs. Treat these two as unbuilt ideas
that were dropped, not as available slugs.

### The pattern in the ledger

Of 59 removals, **at least 40 are the same three failure modes**: a small mechanism metaphor that
reads as slop (15+), a component that works but cannot be read at card scale (`sear-notch`,
`blowdown-seat`, and most of the 23 round-10-12 quarantines by inference from the changelog), and
a category answered by invention rather than by a real mechanic (`footing-course`, `gel-wash`).
Nothing was ever removed for being too ambitious.
