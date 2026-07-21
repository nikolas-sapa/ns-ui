/**
 * Plain-UI-word -> component synonyms.
 *
 * Hand-curated on purpose. The components in this registry are named
 * evocatively rather than literally — drape-menu is a dropdown, caustic-select
 * is a select, updraft-dropzone is a file upload, tide-gauge-password is a
 * password field, counterpoise-tiers is a pricing section, sediment-stack is a
 * toast system. Someone who has never seen the library arrives typing the
 * literal word ("dropdown", "toggle", "file upload"), and that word appears
 * nowhere in the registry's own copy. No amount of clever matching over the
 * existing text fixes that: the vocabulary genuinely is not in the data, so it
 * has to be written down.
 *
 * Every entry below was derived by reading the component's meta.json
 * description + instruction, not guessed from its name. Keys are lowercase and
 * may be multi-word; the showcase folds them into each component's searchable
 * text, so a query still matches term-by-term ("file upload" -> "file",
 * "upload").
 *
 * Adding a component? Add its plain words here too, or it is invisible to
 * anyone who does not already know the house vocabulary.
 */
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  // -- forms & inputs -------------------------------------------------------
  dropdown: ["drape-menu", "caustic-select"],
  select: ["caustic-select", "drape-menu"],
  listbox: ["caustic-select"],
  combobox: ["caustic-select", "event-horizon-command"],
  picker: ["caustic-select", "terminator-date-field"],
  toggle: ["frostbite-switch", "fling-segment"],
  switch: ["frostbite-switch"],
  checkbox: ["frostbite-switch"],
  settings: ["frostbite-switch", "moire-dial", "fling-segment"],
  input: ["respire-field", "needle-stepper", "tide-gauge-password"],
  "text field": ["respire-field"],
  textbox: ["respire-field"],
  "form field": ["respire-field", "tide-gauge-password", "caustic-select"],
  validation: ["respire-field", "tide-gauge-password"],
  "focus ring": ["respire-field"],
  password: ["tide-gauge-password"],
  "strength meter": ["tide-gauge-password"],
  signup: ["tide-gauge-password", "cipher-reel-otp"],
  login: ["tide-gauge-password", "cipher-reel-otp"],
  otp: ["cipher-reel-otp"],
  "one-time password": ["cipher-reel-otp"],
  "verification code": ["cipher-reel-otp"],
  "2fa": ["cipher-reel-otp"],
  pin: ["cipher-reel-otp"],
  "code input": ["cipher-reel-otp"],
  "date picker": ["terminator-date-field"],
  datepicker: ["terminator-date-field"],
  calendar: ["terminator-date-field"],
  "date input": ["terminator-date-field"],
  schedule: ["terminator-date-field"],
  "file upload": ["updraft-dropzone"],
  upload: ["updraft-dropzone"],
  dropzone: ["updraft-dropzone"],
  "drag and drop": ["updraft-dropzone", "caustic-coverflow", "crack-compare"],
  attachments: ["updraft-dropzone"],
  slider: ["loupe-slider", "crack-compare", "slide-to-shatter"],
  range: ["loupe-slider"],
  volume: ["loupe-slider", "moire-dial"],
  zoom: ["loupe-slider"],
  stepper: ["needle-stepper"],
  "number input": ["needle-stepper"],
  quantity: ["needle-stepper"],
  counter: ["needle-stepper", "scan-sweep-stats", "vapor-countdown"],
  spinner: ["needle-stepper", "chronicle-bar"],
  dial: ["moire-dial"],
  knob: ["moire-dial"],
  tuner: ["moire-dial"],
  tabs: ["fling-segment"],
  "segmented control": ["fling-segment"],
  "radio group": ["fling-segment"],
  "toggle group": ["fling-segment"],

  // -- buttons & actions ----------------------------------------------------
  button: ["glass-button", "hold-to-confirm"],
  cta: ["glass-button", "lodestone-hero"],
  confirm: ["hold-to-confirm", "slide-to-shatter"],
  confirmation: ["hold-to-confirm", "slide-to-shatter"],
  "are you sure": ["hold-to-confirm", "slide-to-shatter"],
  delete: ["hold-to-confirm", "slide-to-shatter"],
  destructive: ["hold-to-confirm", "slide-to-shatter"],
  "press and hold": ["hold-to-confirm"],
  "slide to confirm": ["slide-to-shatter"],
  swipe: ["slide-to-shatter"],
  unlock: ["slide-to-shatter"],

  // -- navigation & overlays ------------------------------------------------
  menu: ["drape-menu", "magnetic-dock"],
  navbar: ["drape-menu", "magnetic-dock"],
  navigation: ["drape-menu", "magnetic-dock", "mercury-minimap"],
  popover: ["drape-menu", "terminator-date-field"],
  modal: ["glass-panel"],
  dialog: ["glass-panel"],
  sheet: ["glass-panel"],
  panel: ["glass-panel"],
  card: ["glass-panel", "warp-lattice"],
  container: ["glass-panel"],
  dock: ["magnetic-dock"],
  toolbar: ["magnetic-dock"],
  "command palette": ["event-horizon-command"],
  "cmd k": ["event-horizon-command"],
  cmdk: ["event-horizon-command"],
  spotlight: ["event-horizon-command"],
  "quick actions": ["event-horizon-command"],
  "keyboard shortcuts": ["event-horizon-command"],
  "table of contents": ["mercury-minimap"],
  toc: ["mercury-minimap"],
  sidebar: ["mercury-minimap"],
  "reading progress": ["mercury-minimap", "scroll-caliper"],
  minimap: ["mercury-minimap"],
  scrollbar: ["scroll-caliper", "mercury-minimap"],

  // -- feedback & status ----------------------------------------------------
  toast: ["sediment-stack"],
  notification: ["sediment-stack"],
  snackbar: ["sediment-stack"],
  alert: ["sediment-stack"],
  progress: ["chronicle-bar"],
  "progress bar": ["chronicle-bar"],
  loading: ["chronicle-bar"],
  loader: ["chronicle-bar"],
  skeleton: ["chronicle-bar"],
  steps: ["chronicle-bar"],
  countdown: ["vapor-countdown"],
  timer: ["vapor-countdown"],
  clock: ["vapor-countdown"],
  launch: ["vapor-countdown"],
  404: ["knockout-404"],
  "not found": ["knockout-404"],
  "error page": ["knockout-404"],
  "empty state": ["knockout-404"],
  "missing page": ["knockout-404"],
  tooltip: ["aurora-flow-chart", "heatwave-ledger"],
  status: ["cardio-baseline", "sediment-stack", "chronicle-bar"],
  heartbeat: ["cardio-baseline"],
  pulse: ["cardio-baseline"],

  // -- data & charts --------------------------------------------------------
  chart: ["aurora-flow-chart", "rule-sparkline", "signal-terrain"],
  graph: ["aurora-flow-chart", "rule-sparkline", "signal-terrain"],
  "area chart": ["aurora-flow-chart"],
  "line chart": ["aurora-flow-chart", "rule-sparkline"],
  analytics: ["aurora-flow-chart", "scan-sweep-stats", "rule-sparkline"],
  sparkline: ["rule-sparkline"],
  trend: ["rule-sparkline", "aurora-flow-chart"],
  metric: ["rule-sparkline", "scan-sweep-stats"],
  metrics: ["scan-sweep-stats", "rule-sparkline"],
  stats: ["scan-sweep-stats"],
  kpi: ["scan-sweep-stats", "rule-sparkline"],
  dashboard: ["scan-sweep-stats", "heatwave-ledger", "aurora-flow-chart"],
  numbers: ["scan-sweep-stats", "vapor-countdown", "needle-stepper"],
  table: ["heatwave-ledger"],
  "data table": ["heatwave-ledger"],
  rows: ["heatwave-ledger"],
  list: ["heatwave-ledger", "sediment-stack"],
  sortable: ["heatwave-ledger"],
  monitoring: ["signal-terrain", "heatwave-ledger"],
  timeline: ["strandline"],
  changelog: ["strandline"],
  releases: ["strandline"],
  history: ["strandline"],
  roadmap: ["strandline"],
  activity: ["strandline"],
  pricing: ["counterpoise-tiers"],
  plans: ["counterpoise-tiers"],
  tiers: ["counterpoise-tiers"],
  subscription: ["counterpoise-tiers"],
  billing: ["counterpoise-tiers"],
  avatar: ["flock-stack"],
  avatars: ["flock-stack"],
  "avatar group": ["flock-stack"],
  team: ["flock-stack"],
  users: ["flock-stack"],
  profile: ["flock-stack"],

  // -- media & galleries ----------------------------------------------------
  gallery: ["caustic-coverflow", "ripple-unfold"],
  carousel: ["caustic-coverflow"],
  coverflow: ["caustic-coverflow"],
  images: ["caustic-coverflow", "ripple-unfold", "frost-scrub", "crack-compare"],
  photo: ["frost-scrub", "ripple-unfold", "ascii-dither-media"],
  "image reveal": ["ripple-unfold", "frost-scrub"],
  "before after": ["crack-compare"],
  compare: ["crack-compare"],
  diff: ["crack-compare"],
  ascii: ["ascii-dither-media"],
  halftone: ["ascii-dither-media"],
  dither: ["ascii-dither-media"],

  // -- heroes, sections & layout --------------------------------------------
  hero: [
    "particle-hero",
    "lodestone-hero",
    "solargraph-hero",
    "singularity-text",
  ],
  landing: ["particle-hero", "lodestone-hero", "solargraph-hero"],
  banner: ["lodestone-hero", "solargraph-hero"],
  header: ["lodestone-hero", "particle-hero"],
  grid: ["warp-lattice"],
  bento: ["warp-lattice"],
  layout: ["warp-lattice", "glass-panel"],
  background: ["erosion-trail", "ascii-dither-media", "warp-lattice"],
  wallpaper: ["erosion-trail", "ascii-dither-media"],
  texture: ["ascii-dither-media", "erosion-trail"],
  map: ["erosion-trail"],
  terrain: ["erosion-trail", "signal-terrain"],

  // -- scroll & text --------------------------------------------------------
  scroll: [
    "core-sample-scroll",
    "particle-tunnel-scrub",
    "frost-scrub",
    "scroll-caliper",
    "mercury-minimap",
  ],
  scrollytelling: ["core-sample-scroll", "particle-tunnel-scrub", "frost-scrub"],
  storytelling: ["core-sample-scroll", "particle-tunnel-scrub"],
  parallax: ["particle-tunnel-scrub", "core-sample-scroll"],
  pinned: ["core-sample-scroll", "frost-scrub"],
  text: [
    "decrypt-text",
    "dynamic-weight-text",
    "ligature-melt",
    "prism-drag-split",
    "cardio-baseline",
    "singularity-text",
  ],
  headline: [
    "dynamic-weight-text",
    "ligature-melt",
    "prism-drag-split",
    "singularity-text",
  ],
  typing: ["decrypt-text", "chronicle-bar"],
  scramble: ["decrypt-text"],
  "text reveal": ["decrypt-text", "particle-hero", "singularity-text"],
  typography: ["dynamic-weight-text", "ligature-melt", "prism-drag-split"],
  glitch: ["prism-drag-split"],
  "rgb split": ["prism-drag-split"],
  particles: ["particle-hero", "singularity-text", "vapor-countdown"],
  search: ["event-horizon-command"],
  glass: ["glass-panel", "glass-button", "caustic-select", "frost-scrub"],
};

/**
 * name -> the plain words that point at it, ready to append to that
 * component's searchable text.
 */
export const SYNONYM_TEXT: Record<string, string> = (() => {
  const out: Record<string, string[]> = {};
  for (const [word, names] of Object.entries(SEARCH_SYNONYMS)) {
    for (const name of names) (out[name] ??= []).push(word);
  }
  return Object.fromEntries(
    Object.entries(out).map(([name, words]) => [name, words.join(" ")]),
  );
})();
