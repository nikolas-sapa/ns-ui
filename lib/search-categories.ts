/**
 * Browsable categories — the "I don't know what this library calls things"
 * entry point.
 *
 * There are 166 distinct tags across the registry and 128 of them appear
 * exactly once, so tag chips would be noise rather than navigation. These 12
 * buckets are the roles a newcomer already has words for.
 *
 * Membership is COMPUTED from each component's real tags wherever the tags
 * carry the role (they usually do: `hero`, `otp`, `toast`, `table`, `chart`,
 * `dropzone`…). `extra` is the escape hatch for the handful whose tags describe
 * the technique rather than the job — ascii-dither-media is tagged
 * `background, ascii, dither, canvas, cursor` with nothing saying "media", and
 * drape-menu's `menu, dropdown, cloth` says nothing about being an overlay.
 * Hand-listing all 50 was rejected: it would drift the moment a component
 * changes shape, whereas a tag rule keeps working.
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
    tags: ["nav", "menu", "dropdown", "dock", "toc", "command-palette", "cmd-k"],
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
    ],
  },
  {
    id: "feedback",
    label: "Feedback",
    tags: [
      "toast",
      "notification",
      "feedback",
      "progress",
      "loader",
      "countdown",
      "404",
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
    tags: ["surface", "container", "glass"],
    extra: ["drape-menu", "event-horizon-command", "terminator-date-field"],
  },
  {
    id: "media",
    label: "Media",
    tags: ["gallery", "coverflow", "media", "image", "image-diff", "compare"],
    extra: ["ascii-dither-media"],
  },
  {
    id: "backgrounds",
    label: "Backgrounds",
    tags: ["background", "terrain", "topographic", "grid", "field"],
  },
  {
    id: "sections",
    label: "Sections",
    tags: ["section", "pricing", "page", "changelog", "avatar"],
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
