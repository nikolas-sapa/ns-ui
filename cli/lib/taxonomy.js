// Deliberate, standalone copy of the category taxonomy and "kind" label
// logic — ported from lib/search-categories.ts and lib/kind.ts at the repo
// root. This is a copy, not an import: the CLI package must work fully
// standalone (search/list/categories/info) whether or not it's run from
// inside this repo, and whether or not the sibling `mcp/` package exists on
// the machine at all. Re-sync by hand if the source files change — category
// additions are rare (see lib/search-categories.ts's own file header for
// when/why it last grew).
//
// See lib/search-categories.ts for the full reasoning behind each category's
// tag list; that commentary isn't duplicated here to keep this file short.

export const CATEGORIES = [
  { id: "heroes", label: "Heroes", tags: ["hero"] },
  {
    id: "actions",
    label: "Buttons",
    tags: ["button", "control", "confirm", "confirmation", "destructive"],
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
    tags: ["scroll", "story", "scroll-story", "scroll-trigger", "parallax"],
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
    extra: ["ascii-dither-media", "decal-peel", "flock-stack"],
  },
  {
    id: "backgrounds",
    label: "Backgrounds",
    tags: ["background", "terrain", "topographic"],
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

/** name -> the category ids it belongs to. Every component lands in >= 1. */
export function categorize(items) {
  const out = new Map();
  for (const item of items) {
    const tags = new Set(item.tags);
    const ids = CATEGORIES.filter(
      (cat) => cat.tags.some((t) => tags.has(t)) || cat.extra?.includes(item.name)
    ).map((cat) => cat.id);
    out.set(item.name, ids);
  }
  return out;
}

const TECH = new Set([
  "canvas",
  "webgl",
  "shader",
  "svg",
  "ascii",
  "css-animation",
  "physics",
  "spring",
  "3d",
  "mono",
  "cursor",
  "drag",
  "scroll",
  "colour",
  "color",
  "ambient",
  "decorative",
  "showpiece",
  "micro-interaction",
  "typography",
  "accessibility",
  "aria-live",
  "keyboard-navigation",
  "intersection-observer",
  "motion",
  "animation",
]);

const PRETTY = {
  "data-viz": "Data viz",
  otp: "OTP input",
  "empty-state": "Empty state",
  "tag-input": "Tag input",
  "context-menu": "Context menu",
  "date-picker": "Date picker",
  "file-upload": "File upload",
  spinbutton: "Stepper",
  radiogroup: "Radio group",
  listbox: "Listbox",
  combobox: "Combobox",
  nav: "Navigation",
  "kinetic-type": "Kinetic type",
  "text-reveal": "Text reveal",
  cta: "CTA",
  "2fa": "2FA",
  "optimistic-ui": "Optimistic UI",
  rag: "RAG",
  ai: "AI",
  ui: "UI",
  url: "URL",
};

export function kindOf(tags) {
  if (!tags?.length) return null;
  const tag = tags.find((t) => !TECH.has(t)) ?? tags[0];
  if (PRETTY[tag]) return PRETTY[tag];
  const words = tag.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
