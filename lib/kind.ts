/**
 * The plain-language label that answers "what am I looking at" before the
 * component's own name gets a chance to be evocative.
 *
 * Names here are deliberately metaphorical (bough-index, quoin-lock,
 * escapement-tick) — that is the registry's voice and renaming 223 components
 * would break every install anyone has already run. So the *kind* is shown
 * next to the name instead: "Bough Index · Tree view".
 *
 * It is derived, not authored. `meta.json` tags are written kind-first by
 * convention — the first tag of emerge-dialog is "dialog", of blade-iris
 * "loader" — so the label is just the first tag that names what the thing IS.
 * About 27 components lead with the technology they happen to be built on
 * instead, so those words are skipped and the next tag wins.
 */
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

/** Tags whose expansion a reader should not have to guess. */
const PRETTY: Record<string, string> = {
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

export function kindOf(tags: readonly string[] | undefined): string | null {
  if (!tags?.length) return null;
  const tag = tags.find((t) => !TECH.has(t)) ?? tags[0];
  if (PRETTY[tag]) return PRETTY[tag];
  const words = tag.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
