# Lab ASCII — Batch 1 Ideation Record

Raw ideation archive for the `ASCII & raster surfaces` lane. Reference only — completeness over brevity. Do not treat this as a spec; the built components in `registry/` are authoritative.

## Owner verdict (2026-08-10) — read this before the concepts below

All 10 selected concepts passed the technical gate (`## Outcome` further down). The owner then reviewed the built components and rejected 7 of 10 outright. The 3 that survived did not survive on execution quality — the judge's selections below were unanimous on that. They survived on whether the product surface itself was worth building at all.

- **`light-table` — CUT.** Hex viewer. A developer tool wearing an ascii skin.
- **`under-brace` — CUT.** Regex tester. A developer tool.
- **`chalk-snap` — CUT.** Freehand code/UI annotator. A developer tool.
- **`stencil-fill` — LIFTED.** Kept, but needed a visual pass (motion + scale) before it cleared the bar — it did not pass as originally built.
- **`chord-punch` — CUT.** Shortcut recorder. A settings-screen control.
- **`pin-barrel` — CUT.** Cron-expression editor. A developer/ops tool.
- **`flood-mark` — CUT.** SRE alert-threshold config. An ops tool.
- **`grain-crest` — CUT.** Admin data-table column header. An internal-dashboard control.
- **`nomogram-edge` — LIFTED.** Kept, but needed the same visual pass as `stencil-fill` before it cleared the bar.
- **`rosensweig-crest` — KEPT (fixed).** Shipped broken; repaired to working, no taste objection.

The failure was structural, not a matter of any one concept's craft: every cut was a niche developer/ops/settings tool wearing an ascii skin, and every one rendered as a static bordered grey card until interacted with. Do not read the concept write-ups below — including the ones for cut components — as examples of reasoning that produces keepers. See `03-Resources/fable-taste-patterns.md`'s 2026-08-10 correction section in the vault for what this means for future ideation.

## Lane brief

> You are a design engineer with distinctive taste, brainstorming new components for ns-ui. Be creative, aesthetic, exploratory — this is the generative step. Every concept must be honest and buildable in principle.
>
> ns-ui house style: near-black restrained "Geist-dark" surfaces; a small "loud" collection is deliberately flashier. Colors come ONLY from CSS custom properties `--background --foreground …` (full token list truncated in the source workflow log).

Lane: **ASCII & raster surfaces** — 533 slugs already taken in the registry at generation time.

## Ideator postures

Three parallel `claude-fable-5` agents ran the same lane brief above under three distinct postures, each producing 10 concepts (30 total, 0 lost to dedup against the taken set or each other):

- **`daily-driver`** — agent `af9d699de610f388b`. Practical, dashboard/dev-tool-leaning concepts (e.g. `scar-strip`, the uptime-status strip).
- **`mechanism-first`** — agent `a7d5296737dbd26b2`. Concepts that start from a raster/physical mechanism and find the UI job after (e.g. `glaze-craze`, ceramic craquelure as staleness).
- **`swing`** — agent `a2e1ebd45dce59c1e`. Higher-risk, more exploratory concepts, including most of the `loud` collection entries.

(Individual concepts below are not separately tagged by posture in the source data; the postures are recorded here as the generation context for the batch as a whole.)

## Outcome

- 30 concepts generated, 30 survived dedup.
- 10 selected: core/light-table, core/under-brace, core/chalk-snap, core/stencil-fill, core/chord-punch, core/pin-barrel, core/flood-mark, core/grain-crest, core/nomogram-edge, loud/rosensweig-crest
- 20 rejected by the judge (see below, folded into each concept's entry).
- 10/10 selected concepts built and passed the gate (see `lab-ascii-batch-1-build.md` companion notes / gate_report if present).


## OUTCOME — owner review (2026-08-10)

All 10 selected concepts passed the technical quality gate. The owner then reviewed the built components and rejected 7 outright, unanimously and structurally — not on execution quality. Every cut was a niche developer/ops tool wearing an ascii skin, rendered as a static bordered grey card until interacted with.

- **`light-table`** — CUT. Hex viewer: a developer tool, not a product surface.
- **`under-brace`** — CUT. Regex tester: a developer tool.
- **`chalk-snap`** — CUT. Code annotator: a developer tool.
- **`chord-punch`** — CUT. Shortcut recorder: a developer tool.
- **`pin-barrel`** — CUT. Cron editor: a developer tool.
- **`flood-mark`** — CUT. SRE alert-threshold config: an internal dashboard input.
- **`grain-crest`** — CUT. Admin data-table header: an internal dashboard control.
- **`stencil-fill`** — LIFTED. Saved by a visual pass: rescaled 2.1x, license-key mask, dot-grid plaque, self-typing loop at rest.
- **`nomogram-edge`** — LIFTED. Saved by a visual pass: thicker line, entrance spring, ambient drift through value pairs, real handle/label overlap bug fixed.
- **`rosensweig-crest`** — KEPT, fixed. Was a broken loud hero: eruption radius was ~67px of a nominal 230 after smoothstep, and the exclusion rect was measured off the full-bleed wrapper so it blocked half the field.

The rule this produced, standing for all future batches: **Beautiful first, broadly useful second.** Filter 1 — name the product surface this component replaces (hero, background, divider, card, nav, loader, empty state, feedback moment, pricing element, gallery, testimonial, footer). If the honest answer is "a settings screen," "an internal dashboard," or "a developer tool," do not build it, however clever the mechanism. Filter 2 — it must be alive at rest and striking to look at. The resting frame is the first and often only thing judged; a static bordered grey card is an automatic rejection. Something must move, breathe, drift, or settle before the user touches anything.

---

## Concepts

### `scar-strip` (core) — REJECTED

- **The idea:** A 90-day uptime strip where each day is one monospace cell, healthy days sit at a faint ░, and incidents cut into the strip as darker glyphs whose ramp depth (░▒▓█) encodes severity and whose width encodes duration. Old scars never fully fade — a resolved incident settles back to ▒, so the strip carries its history like tissue.
- **The job:** The status-page availability bar: show a service's recent health at a glance in dashboards, status pages, and service lists, with per-day drill-in.
- **Why distinct:** Nearest is heatmap-calendar-tide / heatmap-year-stipple, which are 2D activity calendars. This is a single-row SLA readout where the ramp encodes error-budget burn, not activity volume, and where hover raises a box-drawing caret ┬ with the incident summary beneath the strip instead of a floating tooltip.
- **Mechanism:** One <div> of Geist Mono text, one char per day, rendered from a days[] prop mapped through a five-step glyph ramp. Keyboard focus and hover move a ┬ caret drawn in a second line under the strip; the focused day's detail prints in a fixed line below (date, uptime %, incident title) so nothing overlaps. Current day breathes between two ramp steps on a slow ease-out-expo loop. Foreground/muted tokens only; accent appears only on the focused caret.
- **Canvas needed:** False
- **A11y note:** Rendered as a listbox of 90 day options; arrow keys walk days, Home/End jump. Each option has an aria-label like 'March 4, 99.98% uptime, no incidents'. The glyph strip itself is aria-hidden; the visible detail line is a live region so SR users hear the same summary sighted users read.
- **Reference pull:** The green/yellow/red day bars on statuspage.io crossed with scar tissue on tree bark — a wound that closes but stays legibly darker than the surrounding grain.
- **Rejected first instinct:** Colored dot-per-day like every status page clone. Thrown out because color-only severity dies in the token palette (no red/green allowed) and says nothing at rest — glyph density carries severity without a legend.
- **Feel in one line:** Reading the weather in a plank of wood.
- **Judge's rejection reason:** The 90-day status bar is the most templated pattern in the batch; the scar persistence twist is not enough novelty for a registry whose value is distinctness.

### `swath-cut` (core) — REJECTED

- **The idea:** A range slider whose track is a braille-dot histogram of the underlying data (prices, latencies, file sizes). Dragging the handles mows a swath: bins inside the selection stand in full foreground dots, bins outside collapse to their bottom dot row in muted, like cut stubble. The selected count prints live at the swath's edge.
- **The job:** Filter a list by a numeric range while seeing where the data actually lives — the Airbnb price-filter job, done in the glyph grid.
- **Why distinct:** slider-range-shear and slider-vernier are about the handle mechanics on an abstract track; picker-pareto-frontier is 2D tradeoff picking. Here the histogram IS the track — the distribution is the surface you cut, and deselection reads as mowing, not dimming.
- **Mechanism:** Bins rendered as braille characters (⣿ family gives 4 vertical levels per cell, two bins per glyph) in a single mono line, height 2-3 rows. Handles are ┃ box-drawing verticals in accent. On drag, excluded bins animate down to ⣀ over ~180ms with spring easing, one bin-column at a time trailing the handle, so the cut visibly follows the blade. Pure DOM: one text layer for muted stubble, one clipped overlay (CSS clip-path inset) for the foreground swath — no per-glyph re-rendering during drag.
- **Canvas needed:** False
- **A11y note:** Two native-pattern sliders (role=slider each) with aria-valuetext including the in-range count ('$40 to $120, 63 of 210 results'). Arrow keys step bins, Shift+arrow steps 10. Histogram is aria-hidden decoration over real slider semantics; count line is polite live region.
- **Reference pull:** A hay mower cutting a swath through standing grain — the field keeps its rootline where cut, so you still see the ground you excluded.
- **Rejected first instinct:** Histogram behind a normal slider with opacity fade on the excluded part, like every price filter. Rejected because fade is decoration; collapsing bins to stubble makes the excluded data still countable, which is the actual information.
- **Feel in one line:** Mowing a clean stripe through a field and watching the count of what's standing.
- **Judge's rejection reason:** Strong, but a third braille-histogram-plus-drag piece alongside flood-mark and grain-crest would make the lane repetitive; the price-filter job is also the most templated of the three.

### `pin-barrel` (core) — **SELECTED**

- **The idea:** A cron-expression field with a live firing preview: beneath the five-field input, the next seven days render as a horizontal time rule of muted dots, and every scheduled firing is a raised pin ╹ set into the barrel. Edit the expression and pins re-seat instantly; an invalid expression leaves the barrel bare with the offending field underlined.
- **The job:** Author and sanity-check cron schedules — the 'wait, does */2 mean every two hours?' moment, answered by the surface itself before anything is saved.
- **Why distinct:** schedule-ascii-freebusy shows existing availability; date/time pickers pick single moments. Nothing in the registry translates a recurrence rule into its concrete firings. The value is the round trip: abstract syntax above, physical pins below, always in agreement.
- **Mechanism:** Five mono sub-inputs (min hour dom mon dow) with the active field's role printed beneath it in muted. A parser computes next-N firings; the 7-day rule is a mono string of · with ╹ at firing positions, day boundaries as ┊, 'now' as a slowly advancing ▏. On expression change, departing pins drop (translateY + fade, 120ms) and arriving pins seat with a small spring overshoot. Hovering a pin prints its absolute timestamp in the detail line. DOM+CSS only.
- **Canvas needed:** False
- **A11y note:** The five fields are labeled inputs with aria-describedby pointing at a plain-language rendering ('At minute 0 past every 2nd hour'); that sentence plus 'next run: Tue 14:00' live in a polite region, so SR users get the semantics the pins encode. The pin rule itself is aria-hidden; individual firings are reachable as a list under a disclosure.
- **Reference pull:** A music-box pin barrel — a schedule literally encoded as pins on a rotating drum, readable by eye before you ever wind it.
- **Rejected first instinct:** A dropdown-based 'cron builder' wizard (every ___ at ___). Rejected because it hides the syntax people actually paste into crontabs; the pin preview teaches the real notation instead of replacing it.
- **Feel in one line:** Setting pins in a drum and knowing exactly when each will strike.

### `light-table` (core) — **SELECTED**

- **The idea:** A hex viewer as two registered films on a light table: offset gutter, hex pane, and ASCII pane in Geist Mono, where the byte under the cursor lights up in all three columns simultaneously with a thin box-drawing bridge ─ drawn across the gap between panes. Non-printable bytes render as a shade ramp by value class (null ·, control ▖, high-bit ▓) instead of a uniform dot.
- **The job:** Inspect binary payloads, file headers, and wire bytes — the debugging chore devs hit weekly and currently do in a terminal xxd dump with no linking.
- **Why distinct:** log-viewer-ascii-tail and diff-unified-viewer are line-text surfaces. Nothing in the registry treats bytes, and nothing does registered cross-pane highlighting — the bridge between representations is the whole component.
- **Mechanism:** CSS grid of three mono columns. Hover/focus on any byte cell sets a shared index; the matching cells in the other panes get a foreground background-tint (color-mix of --foreground at 8%), and an absolutely positioned ─ rule spans the inter-pane gutter at that row. Selection drag highlights a byte range in both panes and prints length + decoded uint/utf8 guesses in a footer rule. Ramp classes are CSS classes on spans; theme-safe by construction.
- **Canvas needed:** False
- **A11y note:** The hex pane is a grid (role=grid) navigable by arrows with 16-byte row jumps; each cell announces 'offset 0x40, value 0x7F, DEL'. The ASCII pane is a mirrored aria-hidden view since it duplicates the grid's info. Range selection via Shift+arrows, announced as 'selected 8 bytes at 0x40'.
- **Reference pull:** A film editor's light table where two strips are pinned in registration and a grease-pencil line is drawn straight across both to mark the same frame.
- **Rejected first instinct:** A styled xxd dump with hover-highlight on the hex side only. Rejected because the entire cognitive cost of hex work is mapping between representations; without the drawn bridge it's just a prettier dump.
- **Feel in one line:** Running a finger across two filmstrips and feeling them line up.

### `under-brace` (core) — **SELECTED**

- **The idea:** A regex tester where matches are annotated below the sample text with box-drawing braces: each match gets a ╰──╯ span under its characters, capture groups nest as additional brace rows at increasing depth with stepped muted shading, and the group number prints inside its brace. Typing in the pattern field re-lays the braces live.
- **The job:** Write and debug regular expressions against sample text — a weekly dev task usually exiled to a browser tab of regex101.
- **Why distinct:** diagram-ascii-flow draws static diagrams; validation components mark pass/fail. This is proofreader-style structural annotation of live text: the braces show WHERE and HOW the pattern grips the string, including nesting, which inline highlight colors cannot express in a five-token palette.
- **Mechanism:** Sample text is one mono line-set; beneath each text line, up to N annotation lines are generated as mono strings of ╰ ─ ╯ ┴ with depth-ordered rendering (outer groups on lower rows). Brace rows animate in with a left-to-right character reveal (~12ms/char, ease-out). Hovering a brace raises its matched substring via a subtle background tint; hovering a group token in the pattern field lights all its braces. Invalid pattern prints the parser error under the caret position with a ┗ pointer.
- **Canvas needed:** False
- **A11y note:** Braces are aria-hidden paint. Real semantics: a results list ('Match 1: "foo42" at 8-13; group 1: "42"') in a region that updates politely on pattern change, plus the pattern input's error wired via aria-invalid and aria-describedby. Tab cycles matches; cycling moves visible focus ring to the corresponding brace.
- **Reference pull:** Sentence-diagramming and linguists' interlinear gloss brackets — structure drawn as ruled braces beneath the running text, never on top of it.
- **Rejected first instinct:** Colored inline highlight per capture group, regex101-style. Rejected because ns-ui has no palette for five group colors, and overlapping/nested groups turn inline highlights into mud; depth-stacked braces express nesting for free.
- **Feel in one line:** Watching a patient proofreader bracket exactly what your pattern grabbed.

### `stencil-fill` (core) — **SELECTED**

- **The idea:** A pattern-masked input (license keys, IBANs, phone numbers) where the full template sits visible at rest as a muted stencil — XXXX-XXXX-XXXX with literal separators in place — and each typed character inks its stencil cell in full foreground. Rejected characters print faintly in the cell for 200ms then fall away, so you see WHAT was refused, not just that something was.
- **The job:** Structured string entry: the everyday form field where users currently guess at format, add their own dashes, and get scolded after submit.
- **Why distinct:** card-number-emboss is a card-specific emboss treatment; terminator-date-field is date-specific. This is the general mechanism for any mask, and its signature is self-explanation at rest (the whole shape is visible before focus) plus the visible-rejection beat no mask input does.
- **Mechanism:** A hidden real <input> drives state; the visible layer is a mono grid of cells, each either stencil (muted, the placeholder glyph), inked (foreground, the typed char), or separator (muted literal, skipped automatically). Inking is a 90ms opacity+weight step; rejection renders the offending char at 40% muted with a 3px x-shake spring then removes it. Paste distributes characters across cells left-to-right, inking in a fast cascade. Caret is a kerf-thin accent ▏ in the next open cell.
- **Canvas needed:** False
- **A11y note:** All interaction lands on the real input, so SR and keyboard behavior are native: label, autocomplete attrs, and value with separators intact. Format announced up front via aria-describedby ('Format: 4 groups of 4 characters'). Rejections announced politely ('letter O not allowed'). The glyph layer is aria-hidden.
- **Reference pull:** A brass lettering stencil laid over paper — every character slot exists as a cut before any ink touches it, and ink only lands inside the cuts.
- **Rejected first instinct:** Auto-inserting separators into a normal input as the user types, the standard mask-library move. Rejected because the format is only discoverable by typing into it; a stencil states the contract before the first keystroke.
- **Feel in one line:** Inking letters into cuts that were always there waiting for them.

### `chord-punch` (core) — **SELECTED**

- **The idea:** A shortcut-recorder field: focus it, press a combination, and each key of the chord punches into place as a small box-drawing keycap ⌜⇧⌟ built glyph-by-glyph, modifiers seating first, the terminal key striking last with a slight overshoot. Conflicts with existing bindings surface immediately as a second, tarnished keycap row beneath with the colliding command's name.
- **The job:** Rebinding keyboard shortcuts in settings screens — a fiddly interaction every serious app ships and almost every app ships badly.
- **Why distinct:** keymap-ascii-heat and shortcuts-cheat-sheet display existing bindings; quick-key executes them. This is the capture input: the moment of recording a chord, with conflict detection as part of the surface rather than a toast afterward.
- **Mechanism:** Focused field enters record mode (accent ▏ pulse); keydown events accumulate modifiers, rendered as mono keycaps framed in ⌜⌝⌞⌟ corners that scale-in with spring easing in canonical order (⌃⌥⇧⌘ then key). Releasing all keys commits; Escape cancels; Backspace clears. A conflict lookup runs against a provided bindings map, and a collision renders the other binding's keycaps in muted with a ≠ rule between rows. Everything DOM+CSS.
- **Canvas needed:** False
- **A11y note:** Genuinely hard case, stated honestly: while recording, all keys are captured, so the field announces entry ('Recording, press a combination, Escape to cancel') and exit explicitly via assertive live region, and record mode can only be entered deliberately (Enter or click), never by tab-through. Committed chord and any conflict are read back in full ('Command Shift K, conflicts with Delete Line').
- **Reference pull:** A ticket punch clicking through paper — the chad drops and the hole is simply, physically there — plus the ordered seating of keys on a Monotype caster.
- **Rejected first instinct:** A text field that prints 'Cmd+Shift+K' as a string while you hold keys, like Chrome's extension shortcut page. Rejected because a string can't show the chord assembling or make a conflict feel like a physical collision — it reads as typed text, which it is not.
- **Feel in one line:** Punching a hole in a ticket and hearing whether the seat was already taken.

### `flood-mark` (core) — **SELECTED**

- **The idea:** A threshold-setting control drawn over history: the metric's last 30 days render as a braille sparkline field, and you drag a horizontal ─── rule (the flood mark) up and down through it. Every historical point above the rule flips from muted dots to foreground alert glyphs ▴ live, and a counter states the consequence: 'would have fired 3 times last month'.
- **The job:** Configure alert thresholds in monitoring settings — the input everyone sets blind today by typing a number into a bare field and finding out the noise level in production.
- **Why distinct:** meter-threshold-trip displays a live value against a fixed threshold; gauge-capacity-waterline shows current fill. This inverts both: the threshold is the thing being AUTHORED, and the surface's job is showing the retrospective consequence of the number before you commit it.
- **Mechanism:** Braille 2x4-dot sparkline (existing sparkline-ascii technique) as the base layer; the rule is a draggable row rendered as ─ glyphs with the numeric value in a small mono tag riding its right end. On drag (pointer or arrows), points above threshold swap glyph class via a y-position comparison, flipping in a ripple ordered by distance from the rule with 30ms stagger. The would-have-fired count and per-week breakdown print in a fixed line below. Snap points at p50/p95/p99 with a faint detent tick.
- **Canvas needed:** False
- **A11y note:** The rule is a role=slider with real min/max/step from the metric range; aria-valuetext is the full consequence sentence ('threshold 480ms, 3 alerts in the last 30 days'). Arrow keys step, Shift+arrows jump between percentile detents. Sparkline is aria-hidden; the consequence line doubles as the polite live region.
- **Reference pull:** Flood-mark plaques bolted to riverside buildings — a horizontal line labeled 1927, letting you stand in the present and read exactly which past events would have wet your feet.
- **Rejected first instinct:** A numeric input with a static sparkline next to it for context. Rejected because context you can't drag through is decoration; the insight only lands when moving the number visibly changes how many past points would have alerted.
- **Feel in one line:** Sliding a ruler down through last month and feeling exactly where the noise starts.

### `grain-crest` (core) — **SELECTED**

- **The idea:** A sortable table header where each column header carries a one-line braille micro-histogram of its column's distribution — the column's grain — sitting under the label. Clicking sorts; the crest doesn't change shape (the data didn't change) but a ▸ position marker slides along it showing where the current top row sits in the distribution, flipping ends when sort direction flips.
- **The job:** Data-table column headers: sort control plus instant answer to 'what does this column even look like' — skew, outliers, bimodality — before you sort or filter anything.
- **Why distinct:** sparkline-ascii and stat-row-baseline-spark decorate rows/stats with trends. This puts distribution shape into the th as part of the sort CONTROL, and the marker-on-crest move (sort state shown as a position within the distribution) exists nowhere in the registry.
- **Mechanism:** Each th stacks label, sort affordance, and a braille bar strip (⣀⣤⣶⣿ ramp, ~12-20 glyphs wide) computed from the column values, log-binned when skewed with a small ᴸ tag. The ▸ marker is an absolutely positioned glyph animating along the strip with ease-out-expo on sort change; hover on the strip shows bin range + count in the shared detail row. Numeric columns get histograms; categorical columns get a dominance bar (top category's share as filled fraction).
- **Canvas needed:** False
- **A11y note:** Standard th[aria-sort] sortable-header semantics, activation by Enter/Space. Each header's accessible name appends a one-line stat summary ('Latency, sortable, median 120ms, range 40 to 2100, right-skewed') so the crest's information survives without vision. Histogram glyphs aria-hidden.
- **Reference pull:** The end-grain of sawn lumber — you read the whole tree's growth history from a one-inch cross-section before deciding how to cut the board.
- **Rejected first instinct:** Sparklines in headers showing each column 'over time'. Rejected because most table columns have no time axis — the honest per-column summary is distribution shape, and a histogram answers the pre-sort question a trendline can't.
- **Feel in one line:** Reading the grain of each board before choosing which way to cut.

### `hero-ascii-craquelure` (loud) — REJECTED

- **The idea:** A hero background of drying craquelure: an even glyph field slowly develops a crack network, fractures propagating as box-drawing polylines that branch at natural ~90° joints, while the enclosed islands cure — their fill glyphs stepping down the density ramp as they dry and their edges curling to a slightly denser rim. Pointer proximity accelerates local drying, so the visitor's cursor weathers the surface.
- **The job:** Hero/section background with slow inevitable motion that never fights foreground copy — the ambient-texture job of the background-ascii family.
- **Why distinct:** reaction-front spreads a phase change and lichtenberg grows a discharge tree; both are propagation from a point. Craquelure is stress-relief in a shrinking FILM: cracks nucleate distributed, meet at right angles, and partition the plane into cells that then evolve independently — a two-stage system (fracture, then cure) no existing background has.
- **Mechanism:** Canvas glyph grid (loud). Simulation: a shrinkage stress field with random flaws; cracks grow along maximum-stress paths, arresting when they meet older cracks at near-perpendicular joints (real craquelure statistics). Cracks rasterize to ─│┌┐└┘├┤ runs; island interiors age through a ▓▒░· ramp on independent clocks; rims hold one ramp step denser. All colors read from --background/--foreground/--ns-muted via getComputedStyle at mount and on a theme-change MutationObserver; accent never appears. Full cure reached in ~90s, then holds still.
- **Canvas needed:** True
- **A11y note:** Pure decoration: aria-hidden, behind content, contrast-capped to muted levels so overlaid text always clears WCAG against --background. prefers-reduced-motion renders the final cured crack network as a static texture with zero animation. No interaction, nothing focusable.
- **Reference pull:** Craquelure on old-master oil paintings and the polygonal mudcrack fields of dry lake beds — the same shrinkage-stress physics at two scales, both partitioning a surface into aging islands.
- **Rejected first instinct:** Cracks radiating outward from the cursor on hover, shattered-glass style. Rejected because impact fracture is a cliché and instantaneous; craquelure's value is slow distributed inevitability, with the cursor only hastening what was already happening.
- **Feel in one line:** Watching a painted surface quietly become old.
- **Judge's rejection reason:** The hero-ascii background family is already ~20 deep in the taken set; another slow ambient texture is the lowest-marginal-value loud slot available.

### `glaze-craze` (core) — REJECTED

- **The idea:** A data panel whose glyph surface develops ceramic craquelure as its contents go stale. Freshly fetched regions are smooth (space / light shade glyphs); as each field's data ages, a crack network of box-drawing and slash glyphs (╱ ╲ ─ ┼ ╳) propagates through that region, polygon by polygon, exactly like a drying glaze. A refresh 're-wets' the surface: cracks retract along their own growth path. Crack density is the freshness readout, per field, not per panel.
- **The job:** Staleness indicator for dashboards and cached views. Answers 'which parts of this screen can I still trust?' at a glance, per region, without timestamps everywhere.
- **Why distinct:** Nearest are badge-unread-tarnish and patina-ledger, which encode age as accumulating surface tone on a single element. Glaze-craze encodes age as a growing crack TOPOLOGY across a whole panel, with per-region freshness (recently updated fields stay smooth islands inside a crazed surface), and it heals directionally on refresh instead of resetting.
- **Mechanism:** Panel is a Geist Mono glyph grid layered behind/around content. A seeded Voronoi-ish crack graph is precomputed per region; each crack segment has an 'appear at age t' value from a desiccation model (cracks meet at ~90°, subdivide polygons over time). A rAF-free interval (1/s is plenty) maps data-age to how many segments render, choosing ╱╲─│┼ per segment angle. Refresh animates segments out in reverse insertion order with ease-out-expo. All glyphs use --ns-muted at low opacity over --background; no accent.
- **Canvas needed:** False
- **A11y note:** Cracks are aria-hidden decoration over a real readout: each region carries a visually-hidden 'updated 4m ago' text plus a data-freshness attribute; a live region announces only when a region crosses the configured stale threshold. Keyboard users get the same info from the region's focusable header tooltip. Nothing is conveyed by crack density alone.
- **Reference pull:** Craquelure on raku ceramic glaze and the ~90° polygonal crack networks of drying playa mud, where crack spacing encodes how long and how fast the surface dried.
- **Rejected first instinct:** First instinct was a fade-to-grey 'aging' opacity on stale cards. Thrown away because opacity reads as disabled, not stale, and it carries zero information about HOW stale, whereas crack density is an analog scale the eye reads instantly.
- **Feel in one line:** Like noticing the teacup you left out has crazed overnight, and knowing without a clock roughly how long you were gone.
- **Judge's rejection reason:** Craquelure duplicate with hero-ascii-craquelure, and a crack network spreading behind live data reads as broken UI rather than stale data; badge-unread-tarnish and patina-ledger already own age-as-surface.

### `strut-bow` (core) — REJECTED

- **The idea:** A capacity meter built as a thin vertical column of glyphs under axial load. At low utilization the column is dead straight (│ glyphs stacked). As load rises it bows: each row gets a horizontal offset following an Euler buckling half-sine, and glyphs substitute along a curvature ramp │ ╎ ╱ ⟨. Past the critical load it snap-buckles sideways with a spring overshoot and holds the kinked shape until load drops.
- **The job:** Rate-limit / quota / memory-pressure meter for a settings pane or status bar. Communicates not just 'how full' but 'how close to failure', because bowing is nonlinear exactly like the real risk.
- **Why distinct:** Nearest is meter-threshold-trip (breaker: binary trip at a line) and gauge-capacity-waterline (level fill). Strut-bow is continuous and geometric: the WARNING is the shape of the meter itself deforming, with visible acceleration near the critical point, and failure is a snap event you feel coming rather than a crossed line.
- **Mechanism:** A single column of ~16 mono glyphs, each row a span with transform: translateX(A·sin(π·i/n)) where amplitude A grows superlinearly with load (mirroring 1/(1−P/Pcr)). Glyph choice per row from a slope ramp based on local dx. Buckle event swaps to a kinked profile with a spring (stiffness ~300, damping ~20) overshoot; recovery eases back with ease-out-expo. Column in --foreground, critical-load tick in --ns-muted; --ns-accent only on the focused/hovered state per house rule.
- **Canvas needed:** False
- **A11y note:** Rendered inside a role=meter with aria-valuenow/min/max and an aria-valuetext like '82% of rate limit'. The buckle event fires a polite live-region announcement ('rate limit exceeded'). Glyph column is aria-hidden. Not focusable unless interactive; if it opens details, it is a button with the same value text.
- **Reference pull:** Euler column buckling demos from structures lab: a steel ruler compressed end-to-end stays arrogantly straight, then bows visibly just before it snaps sideways all at once.
- **Rejected first instinct:** A color-shifting progress bar that goes red near the limit. Rejected because color-as-warning is both the most templated move in dashboards and invisible to colorblind users; deformation carries the same urgency in pure geometry.
- **Feel in one line:** Watching a ruler you are pressing on start to bow, and easing off before it snaps.
- **Judge's rejection reason:** Structural-member-deforming-under-load is already claimed by camber-beam, and meter-threshold-trip plus gauge-capacity-waterline cover the capacity job.

### `beat-null` (core) — REJECTED

- **The idea:** A sync-drift readout that works like tuning an instrument by beats. Two glyph waveforms, one for local state and one for remote, are superposed on the same mono strip; where they interfere, the envelope pulses at the difference frequency. Large drift = fast, agitated beating of the combined glyph amplitude. As client and server converge the beat slows, and perfect sync is a held, motionless standing wave.
- **The job:** Live replication/sync status for collaborative docs, local-first apps, or agent state mirrors. Replaces the lying green dot with an analog readout of how far apart two states are and whether they are converging.
- **Why distinct:** Nearest are oscillo-crest and cardio-baseline, which render ONE signal as a waveform. Beat-null renders the DIFFERENCE of two states as acoustic interference: the information is in the envelope period, a quantity no single-trace component can show, and 'in sync' is uniquely legible as stillness.
- **Mechanism:** One row (or two stacked rows) of ~40 mono glyphs. Each column i shows amplitude a(i,t) = sin(ωt−ki) + sin((ω+Δ)t−ki), mapped through a glyph ramp (space ˌ ‗ ≈ ≋ █-lite set using ▁▂▃▄▅). Δ is fed from real drift (pending ops count, vector-clock distance, or ms of lag). Updated at 12–15fps via one textContent write per row, cheap. Colors: wave in --foreground, envelope crest hint in --ns-muted. On reconnect, Δ animates to 0 with ease-out-expo so the user watches it null.
- **Canvas needed:** False
- **A11y note:** role=status with aria-live=polite announcing state transitions only ('syncing, 340ms behind' → 'in sync'), never per-frame. The glyph strip is aria-hidden. A prefers-reduced-motion query freezes the animation and shows a static three-state glyph (offset / converging / null) plus the same text.
- **Reference pull:** Tuning a guitar string against a reference tone: you do not read a number, you listen for the wah-wah-wah of beats slowing until the sound goes still.
- **Rejected first instinct:** A latency number with a colored dot next to it. Rejected because a number forces reading and the dot is binary; beats give preattentive rate perception, you sense convergence in peripheral vision without reading anything.
- **Feel in one line:** The relief of a wobbling tone settling into one pure note.
- **Judge's rejection reason:** Interference-envelope reading is close to phase-swing and oscillo-crest, and beat period rendered through a 40-cell glyph ramp at 15fps is unlikely to be perceptible as a rate.

### `pinch-hold` (core) — REJECTED

- **The idea:** A peak-hold meter modeled on the clinical mercury thermometer. A vertical glyph column shows the live value fluctuating, but a constriction glyph (≬ or ╳) sits in the channel: whenever the value spikes, fill glyphs pass up through the pinch and get trapped above it, holding the maximum reading indefinitely while the live value falls back. To reset, the user 'shakes it down', a quick drag-flick on the meter or pressing R, and the trapped column drains through the pinch with a springy shudder.
- **The job:** Peak latency / max error-rate / spike capture in monitoring UIs, where the question is 'what was the worst moment since I last looked?', not 'what is it now'. Both readings live in one column.
- **Why distinct:** Nearest is voice-recorder-meter (live level, conventional decaying peak LED) and meter-threshold-trip (binary breaker). Pinch-hold's peak does NOT decay, it is physically trapped by a visible constriction until deliberately shaken down, making acknowledgment of the spike an explicit, satisfying gesture rather than a timeout.
- **Mechanism:** Single mono column ~20 rows. Live value fills from bottom with ▁-█ ramp glyphs; the pinch row renders ≬ in --ns-muted. When value exceeds current trapped max, glyphs above the pinch update instantly; when value drops, only the sub-pinch region follows. Shake-down: pointer flick or keypress triggers a 3-cycle horizontal jitter (translateX spring) during which trapped glyphs drain downward one row per 30ms. Timestamp of trapped peak shown beside the column in Geist Mono, --ns-muted.
- **Canvas needed:** False
- **A11y note:** role=meter for the live value, plus a separate visually-associated text node 'peak 840ms at 14:02' that IS the accessible peak record. Reset is a real button ('clear peak') for keyboard and screen readers; the flick gesture is an alternative, never the only path. Live region announces only new peaks above the previous max.
- **Reference pull:** The clinical mercury thermometer: a kink in the capillary traps the maximum reading so the nurse can read your fever after the fact, and it takes a deliberate wrist-flick to shake the mercury back down.
- **Rejected first instinct:** A standard peak-hold line that decays after 3 seconds, like every audio meter. Rejected because auto-decay silently destroys the exact information the user came back for; the spike you missed while at lunch should still be there, held.
- **Feel in one line:** Reading the fever the day had while you were away, then flicking it back to zero yourself.
- **Judge's rejection reason:** Lovely trapped-peak gesture, but it is a fourth meter and meniscus-hold plus voice-recorder-meter sit close; cut for job spread against flood-mark.

### `brinell-press` (core) — REJECTED

- **The idea:** A weighted rating input built as a hardness test. The scale is a horizontal glyph bar of dense material (░▒ texture). The user presses and holds at a position; the longer the hold, the deeper the indentation, rendered as a widening crater ring in glyphs (· ∘ ○ ◎ growing outward, floor deepening through the shade ramp). Release leaves a permanent dent whose diameter IS the recorded weight. Where you press is the rating; how hard you press is your confidence.
- **The job:** Two-dimensional voting/rating: prioritization boards, RFC reactions, confidence-weighted polls, anywhere 'a hesitant 4' and 'an emphatic 4' should be different data.
- **Why distinct:** Nearest are rating-stamp (discrete stamp at a value) and confirm-hold-ink (hold as confirmation gate). Brinell-press makes hold DURATION itself the analog payload, and reads it back the way a materials lab does, by the diameter of the mark, so past votes on the same bar form a legible field of craters showing both position and conviction of every voter.
- **Mechanism:** Bar is a 3-row mono glyph grid. On pointerdown/Space-hold at position x, a crater grows: radius r(t) with ease-out-expo saturation (fast at first, diminishing, capping at max, exactly like real indentation), glyphs inside chosen by distance from center through a depth ramp ▓▒░·∘○. Haptic-ish feedback: 1px downward translate of the whole bar while pressing, spring release. Committed value = {x, r}. Other users' dents render at 40% opacity in --ns-muted; yours in --foreground; focus ring uses --ns-accent.
- **Canvas needed:** False
- **A11y note:** Exposed as role=slider for position (arrow keys) plus a secondary weight control: holding Space/Enter increases weight with aria-valuetext updating ('rating 4, weight 60%'), releasing commits. Screen readers get discrete announced steps, not the analog curve. Existing dents listed in a visually-hidden summary ('3 votes: strong at 4, light at 2...').
- **Reference pull:** The Brinell hardness test: press a hard ball into metal under known load, then measure the diameter of the round dent with a loupe, the mark itself is the measurement.
- **Rejected first instinct:** Star rating with a separate 'confidence' slider underneath. Rejected because splitting one intent across two controls doubles the interaction cost and nobody moves the second slider; pressure folds both into the single gesture people already perform.
- **Feel in one line:** Pressing your thumb into cool clay exactly as hard as you mean it.
- **Judge's rejection reason:** Hold-as-input is taken three times (hold-to-confirm, confirm-hold-ink, confirm-hold-wax), and press-duration-as-confidence does not self-explain at rest — nobody discovers the second dimension.

### `lenticular-tilt` (core) — REJECTED

- **The idea:** A before/after comparator with no seam. Two states (old/new render, prod/staging screenshot as ASCII dither, A/B copy) are interlaced into alternating narrow glyph columns like a lenticular print. Pointer x position (or a keyboard-driven angle) acts as viewing angle: at far left you see state A everywhere, far right state B, and in between every strip mixes locally, so the whole surface tilts from one state to the other at once instead of being wiped by a divider.
- **The job:** Visual diffing where the seam itself is the problem: comparing textures, layouts, dither renders, or dense text where a hard split line hides exactly the region under it. Global, reversible, whole-field comparison.
- **Why distinct:** Nearest are seam-diff, crack-compare, compare-crack-seam, all of which are divider-based, one side per region. Lenticular-tilt has no divider: every part of the image participates simultaneously, and the mix ratio is continuous, which makes small distributed differences (spacing, weight, density) pop as shimmer during the tilt in a way a wipe can never show.
- **Mechanism:** Both states rasterized to the same glyph grid (existing ascii-dither pipeline for images; direct for text). Grid split into 4-glyph-wide strips; each strip cross-fades its cell glyphs between A and B ramps by a per-strip phase offset of the global tilt angle, so a soft transition band rolls across as you tilt, mimicking lenticular ridge parallax. Pointer move maps to angle with slight spring lag; arrow keys step 10%; Home/End snap to pure A/B. All glyphs in --foreground on --background, changed-cell shimmer marked in --ns-muted.
- **Canvas needed:** False
- **A11y note:** role=slider ('comparison, 30% toward version B') controlling angle via arrow keys, Home/End for pure states. Both states available as full alternative text/downloads. The shimmer of changed regions is duplicated by a text summary of the top changed regions ('largest difference: header area'). Reduced motion removes the rolling band, tilt becomes a plain stepped crossfade.
- **Reference pull:** Lenticular postcards, the ribbed plastic prints that flip between two images as you tilt them, and the specific mid-tilt moment where both images shimmer through each other.
- **Rejected first instinct:** Yet another draggable divider with a nicer handle. Rejected because the registry already has three seam comparators and the seam mechanic structurally cannot show two states of the SAME pixel region at once, which is the entire job here.
- **Feel in one line:** Tilting a ribbed postcard back and forth to catch the moment both pictures exist.
- **Judge's rejection reason:** Duplicates lenticular-rock in this same batch, and both add a fourth before/after comparator; the interlaced midpoint also degrades to noise at 1ch column resolution.

### `zip-mesh` (core) — REJECTED

- **The idea:** A merge control built as a zipper. Two ordered lists hang as parallel glyph columns (teeth), and a draggable pull-tab travels down between them; behind the tab, items interleave into one merged spine with box-drawing connectors folding each tooth into place, tick by tick. The user can stop mid-travel, back the tab up to un-merge, or drag individual teeth to swap interleave order before the tab passes them. The tab reaching bottom commits the merge.
- **The job:** Previewing and committing an interleaved merge of two ordered sequences: playlist merges, combining two changelogs or feeds chronologically, merging two ranked shortlists, reordering rebase-style pick lists.
- **Why distinct:** Nearest are transfer-list-siphon (moving items BETWEEN lists, unordered) and git-graph-ascii-lanes (display-only history). Zip-mesh is about ORDER of interleave, made inspectable and reversible through a physical travel point: everything above the tab is decided and visibly meshed, everything below is still two lists, and the boundary is a handle you scrub.
- **Mechanism:** Three-column mono grid: left teeth, right teeth, merged spine growing from top. The pull-tab is a focusable handle; dragging it down animates the next tooth from its side sliding inward with a spring settle and a connector glyph (└┐ / ┌┘) snapping into the spine. Interleave order comes from a comparator (timestamp/rank) but any not-yet-meshed tooth is draggable across the centerline to override. Reverse travel plays the fold-in backwards. Spine items --foreground, unmeshed teeth --ns-muted, tab focus ring --ns-accent.
- **Canvas needed:** False
- **A11y note:** The tab is a slider (role=slider, 'merged 6 of 14 items', arrow keys step one tooth, PageDown five). Each tooth is a listitem; reordering an unmeshed tooth uses the standard grab/move keyboard pattern with aria-live position announcements. Commit is an explicit button, never a side effect of reaching the bottom. Full merged order readable as a plain list at any time.
- **Reference pull:** A zipper watched slowly: the slider is the only place where two independent rows of teeth become one interlocked spine, and everything above it is committed while everything below still hangs free.
- **Rejected first instinct:** A merged preview list with per-item up/down arrows. Rejected because it shows only the result, not the process boundary; without the travel point there is no way to see 'decided vs pending' or to partially merge and reconsider.
- **Feel in one line:** Pulling a zipper slowly enough to watch every tooth find its partner.
- **Judge's rejection reason:** Interleave-order-as-travel-point is real, but the job (merging two ordered sequences) is niche enough that the build cost of the drag/override/reverse model is not repaid.

### `dendrite-plate` (core) — REJECTED

- **The idea:** A long-task progress surface rendered as electrodeposition. A cathode edge (bottom rule of the panel) slowly grows a dendritic metal crystal upward through diffusion-limited aggregation: each completed unit of work releases wandering ion glyphs (·) that random-walk until they stick to the aggregate, becoming permanent branch glyphs picked from a density ramp (· ┴ ╀ ╬). Percent complete = plated area fraction. A stalled task is instantly visible: ions keep drifting but nothing new sticks.
- **The job:** Progress for multi-minute jobs (builds, ingestion, training epochs, batch agent runs) where a smooth bar lies. Growth texture encodes rate history: dense bushy regions were fast phases, thin spindly reaches were slow ones, and the fossil record of the whole run stays readable at completion.
- **Why distinct:** Nearest is hero-ascii-lichtenberg (dielectric branching as decoration) and histogram-live-grain (grain accumulation as histogram). Dendrite-plate makes aggregation the FUNCTIONAL progress readout: area maps to percent, sticking events map to real completed units, and stall/rate information is carried in the growth morphology, which no progress bar or decorative hero does.
- **Mechanism:** Mono glyph grid ~60×12. On each work-unit event, spawn k walker glyphs at the top; step them with a biased random walk a few frames; on adjacency to the aggregate they freeze and upgrade neighbor glyphs through the ramp. Area-to-percent stays honest by budgeting walkers per reported unit. Idle-but-alive shows walkers drifting (--ns-muted); frozen aggregate in --foreground; nothing animates when the page is hidden (visibilitychange pause). Completion runs a brief settle where the top surface levels with ease-out-expo.
- **Canvas needed:** False
- **A11y note:** Wrapped in role=progressbar with aria-valuenow updated on real units, plus aria-valuetext including rate ('42%, ~3 min left'). The crystal is aria-hidden. Stall detection surfaces as a polite announcement after a threshold ('no progress for 60s'). Reduced motion hides walkers and grows the aggregate in discrete steps.
- **Reference pull:** Electroplating dendrites in a copper sulfate cell, and Witten–Sander diffusion-limited aggregation: metal accreting on a cathode in branches whose thickness records how fast the current flowed.
- **Rejected first instinct:** An ASCII progress bar that fills with a dither ramp. Rejected because it is still a bar: it discards rate history and cannot distinguish 'slow but alive' from 'stalled', the two states long-running jobs most need to distinguish.
- **Feel in one line:** Watching frost grow across a window pane and knowing the cold is still working.
- **Judge's rejection reason:** Too close in idea to the taken seed-crystal and success-nucleation (accretion/growth as state readout), despite the honest progress-rate framing.

### `saltation-drift` (loud) — REJECTED

- **The idea:** A full-bleed background of migrating sand ripples built from saltation physics. Glyph grains hop downwind in low arcs, splash on landing, and out of thousands of hops, ripple crests self-organize and creep across the page. Wind speed is coupled to scroll velocity: idle pages hold near-still ripples with occasional creeping grains; scrolling raises the wind, sharpens crests, and sets the whole ripple field migrating; stopping lets it slump back into calm.
- **The job:** Ambient hero/section background for landing pages that makes scroll momentum physically visible, giving long marketing pages a sense of weather and place without any foreground content changes.
- **Why distinct:** Nearest are background-ascii-flow (continuous fluid advection) and background-ascii-wake (disturbance behind a moving body). Saltation is granular, not fluid: motion is discrete hops with splash ejection, and structure EMERGES as ripples from grain statistics rather than being a rendered field, a phenomenon the background family has not touched.
- **Mechanism:** Canvas glyph grid (loud rules apply): grain particles carry hop trajectories; landing ejects 1–2 neighbors probabilistically; a height field accumulates and shades cells through a ramp (space · ∙ ~ ≈ ∽ crest glyphs on lit side, shadow glyphs on lee). Wind parameter = smoothed scrollVelocity. Colors read from tokens via getComputedStyle at mount and on theme change (grains --ns-muted, crest highlights --foreground at low alpha, --background fill). Caps at ~2500 grains, degrades to static ripples on low-power/reduced-motion.
- **Canvas needed:** True
- **A11y note:** Pure decoration: aria-hidden, pointer-events none, sits behind content with contrast-safe alpha ceiling so text on top always meets contrast on --background. prefers-reduced-motion renders a single static ripple frame. No information lives here.
- **Reference pull:** Bagnold's physics of wind-blown sand: saltating grains hopping in ballistic arcs, splashing others loose on impact, with desert ripples emerging perpendicular to the wind purely from hop statistics.
- **Rejected first instinct:** A perlin-noise 'dune' heightmap scrolling sideways. Rejected because it is a texture pretending to be a process; without discrete hopping grains there is no emergence, and the tie to scroll velocity would feel like a parallax gimmick instead of wind.
- **Feel in one line:** Scrolling and feeling the desert pick up wind under your thumb.
- **Judge's rejection reason:** Granular emergence is a real distinction from background-ascii-flow and background-ascii-wake, but scroll-velocity-coupled ambient backgrounds are already well covered and rosensweig-crest is the stronger single loud slot.

### `rosensweig-crest` (loud) — **SELECTED**

- **The idea:** A hero surface of ASCII ferrofluid. A dark liquid pool of glyphs lies flat until the pointer approaches; the cursor is a magnet held above the surface, and beneath it the pool erupts into a hexagonal lattice of sharp spikes, the Rosensweig instability, rendered as glyph peaks (▲ ∧ 𝑥-height ramp) that grow, sharpen, and track the cursor with viscous lag. Pull the cursor away fast and spikes slump back into the pool with a heavy liquid settle; move slowly and the lattice re-tessellates continuously under you.
- **The job:** Signature hero for a landing page: an interactive centerpiece that rewards pointer play, with the wordmark or headline sitting inside a calm exclusion zone the fluid respects.
- **Why distinct:** Nearest are hero-dipole-field and iron-filings (particles aligning ALONG field lines) and lodestone-hero (attraction). Rosensweig-crest is a LIQUID SURFACE instability: the signature is peaks in a hexagonal lattice with a critical field threshold, spacing set by surface tension, nothing in the magnet family renders a deformable fluid surface or its characteristic spike tessellation.
- **Mechanism:** Canvas glyph grid over a 2D height field: field strength falls off with distance from pointer; above the critical threshold, a hexagonal candidate lattice (spacing ~ glyph aspect corrected) seeds peaks whose heights spring toward equilibrium (stiff spring up, damped slump down for the viscous asymmetry). Cells shade by height and slope through a ramp (~ ≈ ∧ ▲ at crests, ˘ hollows between). Pointer leaves: field decays, peaks merge back with overdamped settle. Tokens via getComputedStyle at mount + theme-change observer; touch devices get a slow autonomous magnet path instead of pointer tracking.
- **Canvas needed:** True
- **A11y note:** Decorative: aria-hidden, headline and CTA are real DOM above the canvas and never depend on it. Keyboard users lose only the toy, not content. prefers-reduced-motion swaps to a static frame of a formed spike lattice. Pointer interaction never captures or delays clicks on overlaid content.
- **Reference pull:** The Rosensweig (normal-field) instability: ferrofluid under a magnet snapping from mirror-flat liquid to a hedgehog of hexagonally packed spikes the instant the field crosses threshold, a staple of science-museum magnet demos.
- **Rejected first instinct:** Glyphs attracted toward the cursor like iron filings. Rejected because the registry already owns field-line and attraction mechanics twice over, and attraction has no threshold moment; the flat-to-spikes phase change is the entire drama here.
- **Feel in one line:** Holding a magnet over black liquid and feeling it stand up to meet you.

### `chalk-snap` (core) — **SELECTED**

- **The idea:** A freehand annotation layer where every pointer stroke quantizes live onto the character grid as box-drawing lines, corners, and arrowheads — you scribble, it snaps to ─│┌┐└┘►, and the result is a real, copyable ASCII diagram, not an image.
- **The job:** Annotate a UI, doc, or code region for feedback and paste the annotation into an issue, PR comment, or terminal — anywhere plain text travels and screenshots cannot.
- **Why distinct:** diagram-ascii-flow renders a given graph as ASCII; chalk-snap is an input surface — the human draws and the grid disciplines the stroke into legal glyph topology in real time.
- **Mechanism:** An invisible cell grid (1ch × 1lh) overlays the target. Pointer path is sampled, segments classified into H/V runs with a hysteresis threshold so wobble does not flicker; junction cells resolve by neighbor lookup (├ ┬ ┼ etc.), stroke ends past a velocity threshold get an arrowhead. Snapped cells fade in with a short ease-out-expo scale from the raw stroke position to the cell center, so you see the stroke 'settle' into type. A trailing SVG polyline shows the raw path for ~200ms before it dissolves into the glyphs.
- **Canvas needed:** False
- **A11y note:** Pointer-first, but a keyboard mode moves a visible grid cursor with arrows and lays line segments with Shift+arrows, so it is fully operable. The glyph raster itself is aria-hidden (SRs would read 'box drawings light horizontal' forever); a maintained shadow description lists strokes semantically ('arrow from row 3 col 10 to row 3 col 42') in a visually-hidden region, and the copy action copies the plain text.
- **Reference pull:** A carpenter's chalk line: you pull the string loose and wobbly, snap it, and it leaves one perfectly straight blue line on the wood. The stroke-then-settle motion is that snap.
- **Rejected first instinct:** A canvas scribble tool with an 'export as ASCII' button — thrown out because the conversion happening after the fact means you draw blind; the whole point is the grid disciplining your hand while you draw.
- **Feel in one line:** Like sketching on graph paper that politely straightens your hand as you go.

### `blink-plate` (core) — REJECTED

- **The idea:** A visual-diff viewer that works like an astronomer's blink comparator: two ASCII rasters of before/after (a screenshot dithered to glyphs, or two component states) alternate in place at a slow fixed cadence, and anything that changed appears to pulse while everything static stays perfectly still.
- **The job:** Visual regression review — spot the actual pixel/layout change between two builds without playing spot-the-difference across side-by-side images.
- **Why distinct:** compare-crack-seam and crack-compare are spatial split comparisons; blink-plate is temporal — the human visual system's motion detection does the diffing, which is exactly why astronomers found Pluto this way.
- **Mechanism:** Both sources are rasterized to the same glyph grid (same ramp, same cell metrics) so identical regions produce identical characters. The two pre-rendered layers are stacked and cross-toggled with a steep opacity step (not a fade — fading kills the effect) at 1Hz. Cells that differ between frames get a computed diff mask; hovering the surface shows a thin --border outline around changed clusters, and a count chip reports 'N regions differ'. Space bar steps frames manually; holding it parks on one plate.
- **Canvas needed:** False
- **A11y note:** Alternation is capped at 1–2Hz, far below photosensitivity thresholds, and prefers-reduced-motion switches to manual-step-only with the diff outlines always on. Keyboard: Space toggles plates, arrow keys jump between changed clusters. SR story: the raster is aria-hidden; an aria-live summary announces the region count and each cluster's position/size as you traverse them.
- **Reference pull:** The Zeiss blink comparator Clyde Tombaugh used to discover Pluto in 1930 — two photographic plates of the same star field alternated under an eyepiece so the one moving dot jumps out.
- **Rejected first instinct:** A red/green overlay diff of the two images — rejected because color-coding tells you where a tool thinks the change is; blinking lets your own eye catch changes the mask threshold would miss, and it survives monochrome.
- **Feel in one line:** The page holds perfectly still and the one thing that changed waves at you.
- **Judge's rejection reason:** Genuinely clever temporal diffing, but the registry already carries three comparators (seam-diff, crack-compare, compare-crack-seam) and the picked set already leans heavy on dev-tool inspectors.

### `lenticular-rock` (core) — REJECTED

- **The idea:** A before/after comparator built like a lenticular print: two glyph rasters are interlaced in alternating 1ch columns, and rocking a pointer (or a slider) across the surface shifts a hard-edged column mask so the image tips from state A to state B through a genuinely lenticular shimmer mid-travel.
- **The job:** Before/after presentation for marketing and changelogs — show a redesign, a filter, a data transformation — where a drag handle split-line feels clinical and a crossfade hides the structure.
- **Why distinct:** Every shipped before/after is a clip-path split (two images, one seam). Here both states occupy the whole surface simultaneously, interleaved; the transition is a phase shift of a stripe mask, so the midpoint is a legible hybrid, not a seam.
- **Mechanism:** Rasterize A and B to the same grid. Columns render as narrow flex strips; each strip holds the A-glyph and B-glyph stacked. A CSS custom property (0–1) driven by pointer-x or the keyboard slider sets, per strip, which glyph is visible — but offset by column parity, so at 0.5 odd columns show A and even show B (the classic lenticular in-between). Snapping past 0.35/0.65 with a spring gives the 'tip over' feel of rocking an actual print.
- **Canvas needed:** False
- **A11y note:** Exposed as role=slider with aria-valuetext ('showing: before' / 'mixed' / 'after'), arrow keys step in 10% increments, Home/End jump to pure states. The interlaced shimmer is skipped under prefers-reduced-motion (hard swap at 50%). Both states carry full text alternatives; the glyph field is aria-hidden.
- **Reference pull:** Lenticular postcards — the winking Jesus / tigers-that-pounce cards you tilt in your hand, where the half-tilt shows both frames sliced together.
- **Rejected first instinct:** Yet another drag-the-divider image comparison — rejected because the divider only ever shows you two half-images; nobody has shipped the interlaced middle state, which is the part that makes you feel the two states are the same surface.
- **Feel in one line:** Tilting a postcard in your hand until the picture makes up its mind.
- **Judge's rejection reason:** Same concept as lenticular-tilt; one of the pair had to go and neither beat the existing seam comparators enough to justify a fourth.

### `jacquard-punch` (core) — REJECTED

- **The idea:** A recurrence/schedule editor as a punch card: rows are weekdays, columns are hours, each cell is a punchable hole (· → ●) with a tiny chad-pop animation, and a read head sweeps the card to print the next N concrete run times below, teletype-style.
- **The job:** Building cron schedules, notification windows, or availability rules — replacing the five-field cron string or a wall of dropdowns with a surface where the pattern is the interface.
- **Why distinct:** schedule-ascii-freebusy displays availability read-only; jacquard-punch is the editor, and its defining trick is the machine reading its own card back to you — pattern in, concrete timestamps out, live.
- **Mechanism:** A role=grid of cells in Geist Mono; click or Space punches (the glyph scales down then pops to ● with a spring, and a tiny chad — a 3px SVG circle — drops and fades). Drag paints runs of holes; Alt-drag erases. A thin --ns-accent read-head line sweeps left-to-right across the card whenever the pattern changes, and as it crosses punched columns the 'next runs' list beneath types out the resolved datetimes. Column/row headers punch entire lanes.
- **Canvas needed:** False
- **A11y note:** Full grid keyboard model: arrows move, Space toggles, Shift+arrows extend a punch run, headers punch lanes. Every cell has an accessible name ('Tuesday 14:00, punched'). The resolved next-run list is real text in an aria-live=polite region, so the card's meaning — not its holes — is what a screen reader user consumes. Chad animation is decorative and suppressed under reduced-motion.
- **Reference pull:** Jacquard loom punch cards and the IBM 029 keypunch — the physical fact that a hole IS an instruction, and that the machine reads the card in a sweep.
- **Rejected first instinct:** A prettier cron-string builder with dropdowns that previews next runs — rejected because it still makes you think in cron's grammar; the grid lets you think in the shape of your week and never see the DSL.
- **Feel in one line:** Punching holes in a card and hearing the machine read your week back to you.
- **Judge's rejection reason:** Overlaps pin-barrel's job (schedule authoring with resolved-run preview); pin-barrel wins by teaching the real cron syntax instead of hiding it behind a 7x24 grid, which is itself a common pattern.

### `heddle-draft` (core) — REJECTED

- **The idea:** A permissions/capability matrix laid out like a weaving draft: roles thread across the top, resources down the side, a small tie-up grid in the corner maps roles to permission bundles, and the large drawdown quadrant fills with woven █/▓/· glyphs showing the computed effective access — edit the tie-up, watch the cloth re-weave.
- **The job:** RBAC and feature-flag matrix editing, where the hard part is seeing the consequences of a rule change across every role × resource combination at once.
- **Why distinct:** Nothing in the registry is a computed 2D matrix — the drawdown is derived, not drawn; you edit the small grids and the big one answers. loader-loom-weave and truchet-weave borrow weaving as texture; this borrows the draft as a computation diagram, which is what a draft actually is.
- **Mechanism:** Classic four-quadrant draft layout in Geist Mono. Threading and tie-up cells are toggle buttons (▢/▣). On any toggle, drawdown cells recompute; changed cells flip with a 60ms per-column stagger sweeping away from the edit — the re-weave reads as a shuttle pass. Glyph encodes level: █ write, ▓ read, ░ inherited, · none. Hovering a drawdown cell highlights its contributing threading column and tie-up row with a thin --ns-accent rule, exposing the why of any effective permission.
- **Canvas needed:** False
- **A11y note:** Editable quadrants are role=grid with named cells ('editor role → billing bundle: tied'); the drawdown is a read-only grid where each cell's accessible name is the computed result ('support × invoices: read, inherited from viewer'). An aria-live summary announces the delta after each edit ('3 cells gained write'). The stagger animation is presentation only; reduced-motion recomputes instantly.
- **Reference pull:** Handweavers' draft notation — threading, tie-up, treadling, drawdown — a centuries-old paper format whose entire purpose is showing how two small binary matrices multiply into a visible cloth pattern.
- **Rejected first instinct:** A checkbox table of role × permission with an 'effective access' tooltip — rejected because the tooltip shows one cell's consequence at a time; the drawdown shows all consequences simultaneously, which is the actual job.
- **Feel in one line:** Pulling one thread and watching the whole cloth honestly rearrange itself.
- **Judge's rejection reason:** The best of the cuts — a genuinely computed matrix — but weaving-draft notation has near-zero reader literacy, so it fails self-explains-at-rest without a tutorial.

### `coil-flip` (core) — REJECTED

- **The idea:** A KPI/counter display built as a flip-disc board: each digit is a 5×7 matrix of two-state discs (● face / ○ back), and on value change only the discs that differ flip — each with a fast rotateX spring and a slight electromagnetic overshoot, propagating across the board as a diagonal wave.
- **The job:** Dashboard stat tiles and live counters where the magnitude of change should be felt — a small tick flips a few discs, a big jump ripples the whole board.
- **Why distinct:** split-flap-board flips whole character cards; coil-flip works at the sub-glyph dot level, so the animation cost is proportional to how much the value actually changed — 199→200 storms, 200→201 barely stirs.
- **Mechanism:** Digits from a 5×7 font table; each disc is a span with backface styling, --foreground on one face, --ns-muted ring on the other. Diffing old/new matrices yields the flip set; each flipping disc animates rotateX(0→180) with a spring (slight overshoot past 180 then settle), delayed by manhattan-distance from the top-left for the wave. Discs that do not change do not animate — that stillness is the signal.
- **Canvas needed:** False
- **A11y note:** The disc field is aria-hidden; the real value lives in a visually-hidden aria-live=polite text node, debounced so rapid ticks announce at most every few seconds. No interaction surface, so no keyboard story needed beyond being skippable. Reduced-motion swaps disc states instantly with no rotation.
- **Reference pull:** Flip-disc (vane) transit signs — Luminator bus destination boards — where an electromagnet coil snaps each disc over and you can hear exactly how much of the sign changed.
- **Rejected first instinct:** A rolling odometer digit animation — rejected because odometers animate the same amount for any change; the flip-disc diff makes the animation itself carry information about how different the new value is.
- **Feel in one line:** The satisfying clatter of a station board deciding only what it must.
- **Judge's rejection reason:** Third flap/disc board after split-flap-board and solari-flap; sub-glyph diffing is a refinement of a taken mechanism, not a new one.

### `nomogram-edge` (core) — **SELECTED**

- **The idea:** A two-input calculator built as a nomogram: three vertical ASCII scales (ticks and figures in Geist Mono), you drag a point on the left scale and a point on the right scale, and a taut straightedge line stretched between them crosses the middle scale to read off the computed result.
- **The job:** Pricing and capacity estimators — requests × unit price → monthly cost, users × events → tier — replacing the two-slider-and-a-number widget with a surface where the relationship between the inputs is visible geometry.
- **Why distinct:** pricing-scale and the slider family move one value each; a nomogram's whole point is that the answer is the intersection — you see how sensitive the result is by how steeply the edge swings, which no pair of independent sliders can show.
- **Mechanism:** Three scales laid out as columns of tick glyphs (─ ┬ ╪ at major ticks) with mono figures; scale spacing follows real nomographic construction (log or linear per the formula) so a straight SVG line is mathematically exact. Grab handles on the outer scales are draggable with spring settle onto tick detents; the SVG straightedge follows with a tiny catenary sag while dragging that pulls taut on release. The intersection glyph on the middle scale swells to a ╪ and the read-off value prints beside it.
- **Canvas needed:** False
- **A11y note:** The two handles are role=slider with proper value semantics and arrow-key stepping; the computed middle value is announced through aria-valuetext on whichever handle moved ('40k requests — estimated $312/mo') plus a polite live region. The straightedge and scales are decorative SVG/text, aria-hidden. Fully keyboard-operable since only the two endpoints are interactive.
- **Reference pull:** Paper nomograms from mid-century engineering handbooks — three printed scales and the instruction 'lay a straightedge' — a whole computer made of geometry and one ruler.
- **Rejected first instinct:** Two range sliders and a big computed number — rejected because it hides the model; the swinging straightedge shows you at a glance that doubling the left input barely moves the answer while nudging the right one swings it wildly.
- **Feel in one line:** Laying a ruler across a chart and trusting the crossing point.

### `chad-reel` (core) — REJECTED

- **The idea:** An undo/history scrubber rendered as punched paper tape: every action punches a row of holes (an 8-channel ○/● pattern derived from the action type) onto a tape strip with sprocket holes down the middle, and dragging the tape back through the read head rewinds application state row by row.
- **The job:** Navigating deep undo history in an editor — seeing how far back an action is, what kind it was, and scrubbing to it — where a flat Ctrl+Z stack gives you no map at all.
- **Why distinct:** undo-ghost-row and undo-drift-bar visualize the pending undo; chad-reel is the whole history as a physical artifact you can read — action types have distinct hole patterns, so a run of deletions looks different from a run of edits before you read a single label.
- **Mechanism:** A horizontal strip of mono rows: 8 data channels (● punched / · blank, pattern hashed from action category so like actions look alike) plus a sprocket channel of small ○. The strip is a draggable track with inertia and per-row detents at the sprocket pitch; a fixed read-head line marks 'now'. Rows ahead of the head (undone) render in --ns-muted at reduced opacity — still punched, but unread. Hovering any row raises a label chip (action name, timestamp); click jumps the tape there with a spring.
- **Canvas needed:** False
- **A11y note:** The tape is a role=slider over history index with aria-valuetext set to the focused action ('step 14 of 60: deleted paragraph, 2m ago'); arrows step one action, PageUp/Down jump ten. Hole glyphs are aria-hidden — the semantic layer is the action list, also reachable as a plain listbox toggle for SR users who prefer discrete navigation. Inertia is disabled under reduced-motion.
- **Reference pull:** 8-level punched paper tape from teletypes and early CNC machines — history as a literal ribbon, where an experienced operator could read the hole patterns by eye.
- **Rejected first instinct:** A vertical timeline list of undo entries with icons — rejected because a list makes every action the same visual weight; the hole-pattern encoding lets you recognize the shape of what you did (a burst of deletes, a long edit run) peripherally, without reading.
- **Feel in one line:** Pulling a ribbon of your own keystrokes backwards through the machine.
- **Judge's rejection reason:** Duplicates sprocket-scrub and scrubber-film-strip in mechanism (sprocketed strip dragged past a fixed read head) even though the job is undo history.

### `stereo-grain` (loud) — REJECTED

- **The idea:** An autostereogram hero: a full-bleed field of random glyph noise that hides a depth map (a wordmark or product shape) the way a Magic Eye poster does — diverge your eyes and the word floats off the page — with a subtle cursor-driven parallax shimmer that hints, to everyone else, that the noise is not flat.
- **The job:** A landing hero for a product about hidden structure, search, or signal-from-noise — the rare hero where the visitor who 'gets it' has a genuine physical moment of discovery.
- **Why distinct:** Every hero in the registry renders its subject visibly (eclipse, terrain, wordmark); stereo-grain is the only surface whose payload is invisible to a screenshot — the depth exists only in the repeating-pattern displacement, which no existing piece touches.
- **Mechanism:** Classic SIRDS construction on a glyph grid: a repeating strip of random characters is copied left-to-right, with per-cell horizontal repeat-distance modulated by a depth map of the wordmark. Canvas renders the grid (cell count is large and the field re-seeds), pulling --background/--foreground/--ns-muted via getComputedStyle at mount and on theme change. Cursor position shifts the depth map a few cells with heavy easing, producing a crawling shimmer in the hidden region — a tell for viewers who cannot free-fuse.
- **Canvas needed:** True
- **A11y note:** Honest problem: the payload is inherently inaccessible (even most sighted users cannot free-fuse). Mitigation is structural — the hidden word MUST also exist as the page's real, visible h1 elsewhere; the canvas is aria-hidden with a description ('decorative stereogram of the wordmark'); a small 'reveal' control flattens the depth map into a visible dither rendering of the same shape. Parallax shimmer is disabled under reduced-motion.
- **Reference pull:** Magic Eye books and Tyler's single-image random-dot stereograms — mall-poster technology where a flat field of noise contains a sculpture you can only see by breaking your eyes' habits.
- **Rejected first instinct:** Noise that visibly resolves into the wordmark on scroll — rejected because resolution-on-scroll is already the ascii family's signature move (decrypt-text, reveal patterns); keeping the word truly hidden, with the reveal happening inside the viewer's visual system, is the swing.
- **Feel in one line:** Staring through the page and having it hand you a secret.
- **Judge's rejection reason:** The most original swing in the batch and painful to cut, but a hero whose payload most visitors physically cannot resolve fails the honest-accessibility bar; the mitigation reveals a plain dither, which is a component we already have.

### `flong-press` (core) — REJECTED

- **The idea:** A document minimap that is a true text facsimile: each source line is rendered into braille-cell dots (one braille char encodes a 2×4 pixel block), so the minimap shows the actual shape of the text — paragraph rags, code indentation ladders, heading weights — at 1/8 scale, in pure characters.
- **The job:** Long-document and code-file navigation, where you recognize where you are by the texture of the page (that jagged code block, that dense paragraph) faster than by any heading list.
- **Why distinct:** toc-minimap-mercury and minimap-pantograph abstract the document into sections/positions; flong-press rasterizes the real glyph layout into braille dots, so what you navigate by is the document's actual typographic fingerprint — indentation, line length, density — not a schematic.
- **Mechanism:** Line metrics (indent, length, weight class) are sampled from the rendered document and quantized into a 2×4-per-char dot buffer, emitted as braille characters (U+2800 block) in a narrow Geist Mono column — no canvas, the raster IS text. A viewport window (thin --border rectangle) slides over it, spring-tracking scroll; click or drag the window to jump. Headings render as fuller dot rows so structure reads as darker bands. Re-rasterization is incremental per changed line, so it stays live while editing.
- **Canvas needed:** False
- **A11y note:** Critical: braille characters are catastrophically noisy for screen readers (read as literal dot patterns), so the entire raster column is aria-hidden. The accessible layer is a parallel nav landmark listing headings/regions as buttons, and the viewport window is a role=slider over scroll position with aria-valuetext ('Section: Pricing, 60% through document'). Keyboard: arrows scroll, section keys jump. The visual facsimile is enhancement; navigation never depends on it.
- **Reference pull:** The flong — the papier-mâché mold pressed from a full page of set type in stereotype printing — a compressed, low-fidelity but faithful impression of an entire page's texture.
- **Rejected first instinct:** A scaled-down transform:scale() clone of the document as the minimap — rejected because sub-pixel text turns to grey mush and costs a full duplicate render; braille cells keep crisp 1-dot resolution at any theme and cost one character per 8 pixels.
- **Feel in one line:** Running your thumb down the page edge and knowing the chapter by its grain.
- **Judge's rejection reason:** Excellent rasterization idea, but minimap is already taken three times (toc-minimap-mercury, minimap-pantograph, mercury-minimap) and the job, not the raster technique, is what duplicates.

