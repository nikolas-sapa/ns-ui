/**
 * Plain-UI-word -> component synonyms.
 *
 * Hand-curated on purpose. The components in this registry are named
 * evocatively rather than literally — dropdown-drape is a dropdown, select-caustic
 * is a select, file-upload-thermal is a file upload, password-strength-tide is a
 * password field, pricing-scale is a pricing section, toast-gravity-stack is a
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
  dropdown: ["dropdown-drape", "select-caustic"],
  select: ["select-caustic", "dropdown-drape"],
  listbox: ["select-caustic"],
  combobox: ["select-caustic", "command-palette-orbit"],
  picker: ["select-caustic", "date-picker-moon"],
  toggle: ["switch-frost", "segmented-control-fling"],
  switch: ["switch-frost"],
  checkbox: ["switch-frost"],
  settings: ["switch-frost", "dial-moire", "segmented-control-fling"],
  input: ["input-focus-membrane", "stepper-needle", "password-strength-tide"],
  "text field": ["input-focus-membrane"],
  textbox: ["input-focus-membrane"],
  "form field": ["input-focus-membrane", "password-strength-tide", "select-caustic"],
  validation: ["input-focus-membrane", "password-strength-tide"],
  "focus ring": ["input-focus-membrane"],
  password: ["password-strength-tide"],
  "strength meter": ["password-strength-tide"],
  signup: ["password-strength-tide", "otp-reel"],
  login: ["password-strength-tide", "otp-reel"],
  otp: ["otp-reel"],
  "one-time password": ["otp-reel"],
  "verification code": ["otp-reel"],
  "2fa": ["otp-reel"],
  pin: ["otp-reel"],
  "code input": ["otp-reel"],
  "date picker": ["date-picker-moon"],
  datepicker: ["date-picker-moon"],
  calendar: ["date-picker-moon"],
  "date input": ["date-picker-moon"],
  schedule: ["date-picker-moon"],
  "file upload": ["file-upload-thermal"],
  upload: ["file-upload-thermal"],
  dropzone: ["file-upload-thermal"],
  "drag and drop": ["file-upload-thermal", "gallery-coverflow-caustic", "compare-crack-seam"],
  attachments: ["file-upload-thermal"],
  slider: ["slider-loupe", "compare-crack-seam", "confirm-slide-shatter"],
  range: ["slider-loupe"],
  volume: ["slider-loupe", "dial-moire"],
  zoom: ["slider-loupe"],
  stepper: ["stepper-needle"],
  "number input": ["stepper-needle"],
  quantity: ["stepper-needle"],
  counter: ["stepper-needle", "stats-radar-sweep", "countdown-vapor-digits"],
  spinner: ["stepper-needle", "progress-narrated"],
  dial: ["dial-moire"],
  knob: ["dial-moire"],
  tuner: ["dial-moire"],
  tabs: ["segmented-control-fling"],
  "segmented control": ["segmented-control-fling"],
  "radio group": ["segmented-control-fling"],
  "toggle group": ["segmented-control-fling"],

  // -- buttons & actions ----------------------------------------------------
  button: ["button-glass", "confirm-hold-ink"],
  cta: ["button-glass", "hero-dipole-field"],
  confirm: ["confirm-hold-ink", "confirm-slide-shatter"],
  confirmation: ["confirm-hold-ink", "confirm-slide-shatter"],
  "are you sure": ["confirm-hold-ink", "confirm-slide-shatter"],
  delete: ["confirm-hold-ink", "confirm-slide-shatter"],
  destructive: ["confirm-hold-ink", "confirm-slide-shatter"],
  "press and hold": ["confirm-hold-ink"],
  "slide to confirm": ["confirm-slide-shatter"],
  swipe: ["confirm-slide-shatter"],
  unlock: ["confirm-slide-shatter"],

  // -- navigation & overlays ------------------------------------------------
  menu: ["dropdown-drape", "dock-cursor-magnify"],
  navbar: ["dropdown-drape", "dock-cursor-magnify"],
  navigation: ["dropdown-drape", "dock-cursor-magnify", "toc-minimap-mercury"],
  popover: ["dropdown-drape", "date-picker-moon"],
  modal: ["surface-glass"],
  dialog: ["surface-glass"],
  sheet: ["surface-glass"],
  panel: ["surface-glass"],
  card: ["surface-glass", "grid-magnetic-lattice"],
  container: ["surface-glass"],
  dock: ["dock-cursor-magnify"],
  toolbar: ["dock-cursor-magnify"],
  "command palette": ["command-palette-orbit"],
  "cmd k": ["command-palette-orbit"],
  cmdk: ["command-palette-orbit"],
  spotlight: ["command-palette-orbit"],
  "quick actions": ["command-palette-orbit"],
  "keyboard shortcuts": ["command-palette-orbit"],
  "table of contents": ["toc-minimap-mercury"],
  toc: ["toc-minimap-mercury"],
  sidebar: ["toc-minimap-mercury"],
  "reading progress": ["toc-minimap-mercury", "scroll-caliper"],
  minimap: ["toc-minimap-mercury"],
  scrollbar: ["scroll-caliper", "toc-minimap-mercury"],

  // -- feedback & status ----------------------------------------------------
  toast: ["toast-gravity-stack"],
  notification: ["toast-gravity-stack"],
  snackbar: ["toast-gravity-stack"],
  alert: ["toast-gravity-stack"],
  progress: ["progress-narrated"],
  "progress bar": ["progress-narrated"],
  loading: ["progress-narrated"],
  loader: ["progress-narrated"],
  skeleton: ["progress-narrated"],
  steps: ["progress-narrated"],
  countdown: ["countdown-vapor-digits"],
  timer: ["countdown-vapor-digits"],
  clock: ["countdown-vapor-digits"],
  launch: ["countdown-vapor-digits"],
  404: ["not-found-knockout"],
  "not found": ["not-found-knockout"],
  "error page": ["not-found-knockout"],
  "empty state": ["not-found-knockout"],
  "missing page": ["not-found-knockout"],
  tooltip: ["chart-area-aurora", "table-heat-shimmer"],
  status: ["text-ekg-baseline", "toast-gravity-stack", "progress-narrated"],
  heartbeat: ["text-ekg-baseline"],
  pulse: ["text-ekg-baseline"],

  // -- data & charts --------------------------------------------------------
  chart: ["chart-area-aurora", "sparkline-automaton", "chart-ridgeline-terrain"],
  graph: ["chart-area-aurora", "sparkline-automaton", "chart-ridgeline-terrain"],
  "area chart": ["chart-area-aurora"],
  "line chart": ["chart-area-aurora", "sparkline-automaton"],
  analytics: ["chart-area-aurora", "stats-radar-sweep", "sparkline-automaton"],
  sparkline: ["sparkline-automaton"],
  trend: ["sparkline-automaton", "chart-area-aurora"],
  metric: ["sparkline-automaton", "stats-radar-sweep"],
  metrics: ["stats-radar-sweep", "sparkline-automaton"],
  stats: ["stats-radar-sweep"],
  kpi: ["stats-radar-sweep", "sparkline-automaton"],
  dashboard: ["stats-radar-sweep", "table-heat-shimmer", "chart-area-aurora"],
  numbers: ["stats-radar-sweep", "countdown-vapor-digits", "stepper-needle"],
  table: ["table-heat-shimmer"],
  "data table": ["table-heat-shimmer"],
  rows: ["table-heat-shimmer"],
  list: ["table-heat-shimmer", "toast-gravity-stack"],
  sortable: ["table-heat-shimmer"],
  monitoring: ["chart-ridgeline-terrain", "table-heat-shimmer"],
  timeline: ["timeline-changelog-wave"],
  changelog: ["timeline-changelog-wave"],
  releases: ["timeline-changelog-wave"],
  history: ["timeline-changelog-wave"],
  roadmap: ["timeline-changelog-wave"],
  activity: ["timeline-changelog-wave"],
  pricing: ["pricing-scale"],
  plans: ["pricing-scale"],
  tiers: ["pricing-scale"],
  subscription: ["pricing-scale"],
  billing: ["pricing-scale"],
  avatar: ["avatar-stack-flock"],
  avatars: ["avatar-stack-flock"],
  "avatar group": ["avatar-stack-flock"],
  team: ["avatar-stack-flock"],
  users: ["avatar-stack-flock"],
  profile: ["avatar-stack-flock"],

  // -- media & galleries ----------------------------------------------------
  gallery: ["gallery-coverflow-caustic", "reveal-ripple-tiles"],
  carousel: ["gallery-coverflow-caustic"],
  coverflow: ["gallery-coverflow-caustic"],
  images: ["gallery-coverflow-caustic", "reveal-ripple-tiles", "scroll-defrost", "compare-crack-seam"],
  photo: ["scroll-defrost", "reveal-ripple-tiles", "background-ascii-dither"],
  "image reveal": ["reveal-ripple-tiles", "scroll-defrost"],
  "before after": ["compare-crack-seam"],
  compare: ["compare-crack-seam"],
  diff: ["compare-crack-seam"],
  ascii: ["background-ascii-dither"],
  halftone: ["background-ascii-dither"],
  dither: ["background-ascii-dither"],

  // -- heroes, sections & layout --------------------------------------------
  hero: [
    "hero-particles-webgl",
    "hero-dipole-field",
    "hero-long-exposure",
    "hero-gravity-well",
  ],
  landing: ["hero-particles-webgl", "hero-dipole-field", "hero-long-exposure"],
  banner: ["hero-dipole-field", "hero-long-exposure"],
  header: ["hero-dipole-field", "hero-particles-webgl"],
  grid: ["grid-magnetic-lattice"],
  bento: ["grid-magnetic-lattice"],
  layout: ["grid-magnetic-lattice", "surface-glass"],
  background: ["terrain-erosion-carve", "background-ascii-dither", "grid-magnetic-lattice"],
  wallpaper: ["terrain-erosion-carve", "background-ascii-dither"],
  texture: ["background-ascii-dither", "terrain-erosion-carve"],
  map: ["terrain-erosion-carve"],
  terrain: ["terrain-erosion-carve", "chart-ridgeline-terrain"],

  // -- scroll & text --------------------------------------------------------
  scroll: [
    "scroll-story-strata",
    "scroll-particle-tunnel",
    "scroll-defrost",
    "scroll-caliper",
    "toc-minimap-mercury",
  ],
  scrollytelling: ["scroll-story-strata", "scroll-particle-tunnel", "scroll-defrost"],
  storytelling: ["scroll-story-strata", "scroll-particle-tunnel"],
  parallax: ["scroll-particle-tunnel", "scroll-story-strata"],
  pinned: ["scroll-story-strata", "scroll-defrost"],
  text: [
    "text-decrypt",
    "text-variable-weight",
    "text-ligature-melt",
    "text-prism-split",
    "text-ekg-baseline",
    "hero-gravity-well",
  ],
  headline: [
    "text-variable-weight",
    "text-ligature-melt",
    "text-prism-split",
    "hero-gravity-well",
  ],
  typing: ["text-decrypt", "progress-narrated"],
  scramble: ["text-decrypt"],
  "text reveal": ["text-decrypt", "hero-particles-webgl", "hero-gravity-well"],
  typography: ["text-variable-weight", "text-ligature-melt", "text-prism-split"],
  glitch: ["text-prism-split"],
  "rgb split": ["text-prism-split"],
  particles: ["hero-particles-webgl", "hero-gravity-well", "countdown-vapor-digits"],
  search: ["command-palette-orbit"],
  glass: ["surface-glass", "button-glass", "select-caustic", "scroll-defrost"],
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
