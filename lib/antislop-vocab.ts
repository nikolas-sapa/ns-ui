// The closed vocabulary every evidence file and rule is validated against.
// Decided in docs/superpowers/specs/2026-10-11-vocabulary-v3.md after 20
// evidence files invalidated a third of the list written before any site
// was studied. Adding a name here is a deliberate act: scripts/build-antislop.ts
// rejects anything outside these arrays, which is what keeps the counts
// meaningful. See the v2 doc for why each rename was forced.
//
// No I/O, the way lib/css-tokens.ts is the single source for the token line.
// There is one signal namespace and no third class: whether a signal may back
// a rule is computed from the evidence, not declared here.
export const SLOP_SIGNALS = [
  "gradient-blob",
  "three-card-row",
  "glass-card-overuse",
  "emoji-as-icon",
  "generic-sans-default",
  "symmetric-everything",
  "badge-pill-spam",
  "generic-line-icon-set",
  "testimonial-card-row",
  "indigo-violet-accent",
  "gradient-fill-cta",
  "scroll-reveal-blank",
  "typewriter-headline",
  "stock-photo-generic",
  // centered-hero-stack and hero-mockup-float are expected to fail
  // eligibility — pre-AI conventions, kept as recorded facts, not rules.
  "centered-hero-stack",
  "hero-mockup-float",
] as const;

export const CRAFT_SIGNALS = [
  "asymmetric-split",
  "single-optical-anchor",
  "type-scale-high-contrast",
  "editorial-grid-break",
  "custom-type-pairing",
  "real-product-screenshot",
  "artifact-not-dashboard",
  "density-variation",
  "one-accent-discipline",
  "live-claim-control",
] as const;

export const ALL_SIGNALS = [...SLOP_SIGNALS, ...CRAFT_SIGNALS] as const;

// Descriptive facts a page is made of. Deliberately NOT signals: a material
// cannot carry a stance, so a rule must never be written against one. Open
// list — extend as evidence demands.
export const MATERIALS = [
  "single-theme", "dual-theme", "stock-photo", "commissioned-photo",
  "illustration", "webgl", "video-hero",
] as const;

export const CONTEXTS = [
  "hero", "nav", "pricing", "features", "testimonials", "cta", "footer",
  "docs", "dashboard", "empty-state", "404", "auth", "blog-index", "article",
] as const;

export const COHORTS = [
  "yc-current", "yc-2015-2019", "agent-tools", "design-studio",
  "pre-ai-2015", "print", "architecture", "infographic", "academic-paper",
] as const;

// `unresolved` is an admission the evidence could not settle the signal,
// not a judgment. It must never count toward a rule — see build-antislop.ts.
export const SIGNAL_VALUES = ["present", "absent", "unresolved"] as const;
export const KINDS = ["site", "paper", "repo", "tool", "artifact"] as const;
export const VERDICTS = ["exemplar", "slop", "mixed"] as const;

export type Signal = (typeof ALL_SIGNALS)[number];
export type Cohort = (typeof COHORTS)[number];
export type SignalValue = (typeof SIGNAL_VALUES)[number];
