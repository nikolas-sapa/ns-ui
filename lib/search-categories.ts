/**
 * Browsable categories — the "I don't know what this library calls things"
 * entry point.
 *
 * There are 166+ distinct tags across the registry and most appear only once
 * or twice, so tag chips would be noise rather than navigation. These 12
 * buckets are the roles a newcomer already has words for.
 *
 * Membership is COMPUTED from each component's real tags wherever the tags
 * carry the role (they usually do: `hero`, `otp`, `toast`, `table`, `chart`,
 * `dropzone`…). `extra` is the escape hatch for the handful whose tags describe
 * the technique rather than the job — ascii-dither-media is tagged
 * `background, ascii, dither, canvas, cursor` with nothing saying "media", and
 * drape-menu's `menu, dropdown, cloth` says nothing about being an overlay.
 * Hand-listing every component was rejected: it would drift the moment a
 * component changes shape, whereas a tag rule keeps working.
 *
 * `canvas` and `generative` are deliberately absent from any tag list: they
 * describe a rendering technique shared by 40+ components across every
 * category (inputs, sliders, charts, backgrounds alike), not a role — adding
 * either as a match tag pulled form fields and sparklines into "Backgrounds".
 * Components whose actual job is a background but whose tags don't say so
 * are listed in `backgrounds.extra` instead. Same reasoning kept `grid` and
 * `field` off backgrounds: both are shared by form components (`span-tape`,
 * `carbon-flimsy`), not just background ones.
 *
 * This set was measured against the full registry (`categorize()` against
 * every item) after being extended in 2026-07 to close a real gap: 41 of 206
 * components (20%) had zero tag hits and were unreachable from the chip row.
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
    // detent-swipe is a swipe-to-act list row — an action, not a list.
    extra: ["detent-swipe"],
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
      // "navigation" itself was missing — several components (bellows-crumb,
      // carriage-return, mortise-slip…) are tagged with the literal word and
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
    // patina-ledger is a data/list display (agent memory ledger) with no tag
    // this list's roles cover.
    extra: ["patina-ledger"],
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
    extra: ["drape-menu", "event-horizon-command", "terminator-date-field"],
  },
  {
    id: "media",
    label: "Media",
    tags: ["gallery", "coverflow", "media", "image", "image-diff", "compare"],
    // decal-peel (a draggable sticker) and flock-stack (a team avatar
    // cluster) are visual/imagery components with no tag saying so.
    extra: ["ascii-dither-media", "decal-peel", "flock-stack"],
  },
  {
    id: "backgrounds",
    label: "Backgrounds",
    tags: ["background", "terrain", "topographic"],
    // burin-etch and warp-lattice are full-bleed canvas backgrounds, but
    // `canvas` itself is shared by 40+ non-background components (inputs,
    // sliders, charts) — see the file header — so it can't be a match tag.
    extra: ["burin-etch", "warp-lattice"],
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
    ],
  },
];

/** name -> the category ids it belongs to. Every component lands in ≥ 1. */
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
