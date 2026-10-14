/**
 * Browsable categories — the "I don't know what this library calls things"
 * entry point.
 *
 * There are 1,100+ distinct tags across the registry and most appear only once
 * or twice, so tag chips would be noise rather than navigation. These 14
 * buckets are the roles a newcomer already has words for.
 *
 * Membership is COMPUTED from each component's real tags wherever the tags
 * carry the role (they usually do: `hero`, `otp`, `toast`, `table`, `chart`,
 * `dropzone`…). `extra` is the escape hatch for the handful whose tags describe
 * the technique rather than the job — background-ascii-dither is tagged
 * `background, ascii, dither, canvas, cursor` with nothing saying "media", and
 * dropdown-drape's `menu, dropdown, cloth` says nothing about being an overlay.
 * Hand-listing every component was rejected: it would drift the moment a
 * component changes shape, whereas a tag rule keeps working.
 *
 * `canvas` and `generative` are deliberately absent from any tag list: they
 * describe a rendering technique shared by 40+ components across every
 * category (inputs, sliders, charts, backgrounds alike), not a role — adding
 * either as a match tag pulled form fields and sparklines into "Backgrounds".
 * Components whose actual job is a background but whose tags don't say so
 * are listed in `backgrounds.extra` instead. Same reasoning kept `grid` and
 * `field` off backgrounds: both are shared by form components (`date-range-tape`,
 * `slug-field-mirror`), not just background ones.
 *
 * This set was measured against the full registry (`categorize()` against
 * every item) after being extended in 2026-07 to close a real gap: 41 of 206
 * components (20%) had zero tag hits and were unreachable from the chip row.
 *
 * Re-measured 2026-10 at 542 components: 29 were orphaned again, and most of
 * them were NEAR-MISSES rather than missing buckets — four components tagged
 * `data-visualization` while this file matched only `data-viz`, three tagged
 * `graph` while it matched only `network`. A near-miss is the worst failure
 * mode here because nothing looks wrong: the component has tags, the bucket
 * has members, and the component is simply unreachable. Two genuinely new
 * roles (Cards, Social proof) accounted for the rest.
 *
 * Widening a tag list is riskier than it looks, and an orphan count cannot
 * see the risk — orphans only ever go down. Matching on `audio`/`waveform`
 * filed a divider, an empty state, a text effect and a hero under Media;
 * `footer`/`team` filed two backgrounds and an invite list under Sections;
 * `graph` filed a feature-flag slider under Charts. All five were reverted to
 * named `extra` entries. The rule the header already states for `canvas`
 * generalises: if a tag names the drawing or the topic rather than the job,
 * it cannot be a match rule. Check both directions after any edit here.
 */
export type Category = {
  id: string;
  label: string;
  /** any of these tags puts a component in this category */
  tags: string[];
  /** components whose tags don't encode the role */
  extra?: string[];
};

export const CATEGORIES: Category[] = [
  { id: "heroes", label: "Heroes", tags: ["hero"] },
  {
    id: "actions",
    label: "Buttons",
    tags: ["button", "control", "confirm", "confirmation", "destructive"],
    // swipe-row-detent is a swipe-to-act list row — an action, not a list.
    // brass-check (hold-to-confirm session revoke), frank-register and
    // rapid-wire (payment-commit actions) are the same shape: the payload
    // looks like a list/receipt but the actual job is the commit action.
    extra: ["swipe-row-detent", "brass-check", "frank-register", "rapid-wire"],
  },
  {
    id: "forms",
    label: "Inputs & forms",
    tags: [
      "form",
      "input",
      "select",
      "listbox",
      "switch",
      "toggle",
      "stepper",
      "spinbutton",
      "otp",
      "date-picker",
      "calendar",
      "password",
      "dropzone",
      "file-upload",
      "segmented",
      "dial",
      "knob",
    ],
    // bitting-cut (passkey list) and rack-seat (step-up auth) are account
    // security controls with no form-role tag; idler-drop and punch-patch
    // are permission/delegation toggles, same shape as envelope-window and
    // manifold-bleed which already match here on "switch"/"permissions".
    //
    // seatmap-ascii-pick is a seat picker (a selection input), overflow-chip-mux
    // an overflowing tag/chip field. Both are inputs whose tags name the
    // domain rather than the role.
    extra: [
      "bitting-cut",
      "rack-seat",
      "idler-drop",
      "punch-patch",
      "seatmap-ascii-pick",
      "overflow-chip-mux",
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    tags: [
      "nav",
      "menu",
      "dropdown",
      "dock",
      "toc",
      "command-palette",
      "cmd-k",
      // "navigation" itself was missing — several components (breadcrumb-fold,
      // tabs-carriage, tabs-notch-tenon…) are tagged with the literal word and
      // nothing else this list matched.
      "navigation",
      "breadcrumb",
      "tabs",
      "tree",
      "sidebar",
      "file-tree",
    ],
  },
  {
    id: "data",
    label: "Charts & data",
    tags: [
      "chart",
      "data-viz",
      // `data-visualization` is the long form of `data-viz` and four
      // components use it (flamegraph-ascii-frames, keymap-ascii-heat,
      // sheet-ascii-range, spectrogram-ascii-bands). A near-miss like this is
      // invisible: the component looks tagged, the bucket looks populated, and
      // the thing is simply unreachable from the chip row.
      "data-visualization",
      "spreadsheet",
      "logs",
      "observability",
      "sparkline",
      "kpi",
      "dashboard",
      "stats",
      "table",
      "timeline",
      "ticker",
      "marquee",
      "feed",
      "network",
    ],
    // memory-ledger-decay is a data/list display (agent memory ledger) with no tag
    // this list's roles cover. punch-figure (amount ledger), spindle-strike
    // (payment-history spindle) and tally-cleave (invite list) are the same
    // shape. vellum-scrape (version-history rail) and zipper-stall (merge/
    // diff resolution) are history/version-control views with no "timeline"
    // or "table" tag to match on.
    extra: [
      "memory-ledger-decay",
      "punch-figure",
      "spindle-strike",
      "tally-cleave",
      "vellum-scrape",
      "zipper-stall",
      // DAG/flow views. `graph` is NOT a match tag: adding it pulled in
      // seep-lattice, which is a feature-flag slider that happens to render a
      // percolation graph. Same lesson as `canvas` in the file header — the
      // tag names the drawing, not the job.
      "diagram-ascii-flow",
      "git-graph-ascii-lanes",
      "patchbay-ascii-cable",
    ],
  },
  {
    id: "feedback",
    label: "Feedback",
    tags: [
      "toast",
      "notification",
      "notifications",
      "feedback",
      "progress",
      "loader",
      "countdown",
      "404",
      "status",
      "indicator",
      "loading",
      "skeleton",
      "spinner",
      "meter",
      "gauge",
      "alert",
      "notice",
      "banner",
      "bell",
      "autosave",
      "hysteresis",
      "threshold",
      "empty-state",
      "presence",
      "typing-indicator",
    ],
    // return-aviso's read-receipt/delivery-status is a status readout with
    // no tag saying "status"; fugitive-ink's reveal-then-decay is the same
    // kind of live state readout, just for a secret instead of a message.
    extra: ["return-aviso", "fugitive-ink"],
  },
  {
    id: "scroll",
    label: "Scroll stories",
    tags: [
      "scroll",
      "story",
      "scroll-story",
      "scroll-trigger",
      "parallax",
    ],
  },
  {
    id: "text",
    label: "Text effects",
    tags: ["text", "typography", "headline", "text-reveal"],
  },
  {
    id: "surfaces",
    label: "Overlays",
    tags: [
      "surface",
      "container",
      "glass",
      "dialog",
      "modal",
      "popover",
      "tooltip",
      "overlay",
      "hover-card",
      "spotlight",
      "onboarding",
      "tour",
      "coach-mark",
      "shortcuts",
    ],
    // mull-hinge is a margin annotation thread anchored to content, the same
    // overlay role as a hover-card/tooltip, with no tag saying so.
    extra: ["dropdown-drape", "command-palette-orbit", "date-picker-moon", "mull-hinge"],
  },
  {
    id: "media",
    label: "Media",
    tags: [
      "gallery",
      "coverflow",
      "media",
      "image",
      "image-diff",
      "compare",
      "device-mockup",
    ],
    // sticker-peel (a draggable sticker) and avatar-stack-flock (a team avatar
    // cluster) are visual/imagery components with no tag saying so.
    //
    // The two audio surfaces are named rather than matched on `audio`/
    // `waveform`: both tags are used as *aesthetic* descriptors elsewhere and
    // adding them pulled in divider-petscii-vu (a divider styled as a VU
    // meter), eink-waveform-ghost (an empty state), text-ekg-baseline (a text
    // effect) and hero-oscilloscope (a hero).
    extra: [
      "background-ascii-dither",
      "sticker-peel",
      "avatar-stack-flock",
      "waveform-ascii-scrub",
      "spectrogram-ascii-bands",
    ],
  },
  {
    id: "backgrounds",
    label: "Backgrounds",
    tags: ["background", "terrain", "topographic"],
    // ascii-engraving-contour and grid-magnetic-lattice are full-bleed canvas backgrounds, but
    // `canvas` itself is shared by 40+ non-background components (inputs,
    // sliders, charts) — see the file header — so it can't be a match tag.
    //
    // The three ascii-*-{spin,volumetric,donut} are rotating ASCII solids:
    // ambient showpieces with no interactive role at all. Their only shared
    // tag is `3d`, which kind.ts classifies as a *technique* (it is shared by
    // 14 components across unrelated roles), so it cannot be a match tag here
    // for the same reason `canvas` cannot. Listed by name instead.
    extra: [
      "ascii-engraving-contour",
      "grid-magnetic-lattice",
      "ascii-globe-spin",
      "ascii-knot-volumetric",
      "ascii-torus-donut",
    ],
  },
  {
    id: "cards",
    label: "Cards",
    // Six components lead with `card` and nothing in the previous twelve
    // buckets matched it. `surfaces` was the near-miss, but it is LABELLED
    // "Overlays" and holds dialog/modal/popover/tooltip — a feature card is
    // not an overlay, and filing it there would make the Overlays chip lie.
    // `feature-grid` rides along because damask-float and grazing-light carry
    // both; bare `grid` is deliberately NOT here, same reason the file header
    // gives for keeping it off Backgrounds (form components use it).
    tags: ["card", "feature-grid"],
    // feature-grid-ascii-rule is a feature grid tagged `grid, feature` rather
    // than `feature-grid`. `feature` is used by exactly one component in the
    // registry, so promoting it to a match tag would be a rule that exists for
    // a single row and would quietly collect anything tagged `feature` later.
    // Named here instead, which is this file's escape hatch for a component
    // whose tags describe the thing rather than the job.
    extra: ["feature-grid-ascii-rule"],
  },
  {
    id: "social-proof",
    label: "Social proof",
    // testimonial/quote/logo-cloud components had no bucket at all. Distinct
    // from `sections` (which is page scaffolding) because a visitor looking
    // for a testimonial wall is looking for the content type, not the layout.
    tags: ["testimonial", "quote", "social-proof", "logo-cloud", "trust-wall"],
  },
  {
    id: "sections",
    label: "Sections",
    tags: [
      "section",
      "pricing",
      "page",
      "changelog",
      "layout",
      "panel",
      "divider",
      "split-pane",
      "kanban",
      "accordion",
      "disclosure",
      "sitemap",
      "post-list",
      "blog",
    ],
    // Page furniture whose tags name the topic, not the role. `footer` and
    // `team` are NOT match tags: `footer` is carried as an ambient/aesthetic
    // tag by background components (flash-entrain, lamina-dome) and `team` by
    // an invite list (tally-cleave), so matching on either filed three
    // non-sections under Sections.
    extra: ["joint-iron", "team-grid-timezone-rail"],
  },
];

/**
 * name -> the category ids it belongs to.
 *
 * Most components in the registry currently land in at least one, verified
 * by running this against every `meta.json` — but that is a measured fact
 * about today's registry, not a guarantee the rules provide. A new component
 * whose tags name a role no bucket matches gets an empty array and vanishes
 * from the chip row without erroring. It has happened twice (41 of 206 in
 * 2026-07, 29 of 542 in 2026-10), so re-measure after adding components
 * rather than trusting this comment.
 */
export function categorize(
  items: { name: string; tags: string[] }[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const item of items) {
    const tags = new Set(item.tags);
    const ids = CATEGORIES.filter(
      (c) => c.tags.some((t) => tags.has(t)) || c.extra?.includes(item.name),
    ).map((c) => c.id);
    out.set(item.name, ids);
  }
  return out;
}
