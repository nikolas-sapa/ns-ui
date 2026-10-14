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
// SCOPE, and it applies to EVERY signal below, not just the ones whose notes
// repeat it. **Marketing chrome is the unit of analysis. Content inside an
// embedded product surface is not scored.** A product screenshot, a dashboard
// clone, a terminal transcript or a simulated app window is a thing the page
// is showing, not a decision the page is making about itself.
//
// This was attached only to badge-pill-spam in v3 and every session has paid
// for that. railway-com set the precedent twice (U+2713 inside JetBrains Mono
// log lines is captured output, not an icon; the six-series chart palette
// inside the Observability capture is data colour). In session 4 one rater had
// to extend it by analogy to three more signals in a single sitting —
// three-card-row on a 4-up of job-match cards inside a dashboard clone,
// emoji-as-icon on 7 checks used as diff markers, one-accent-discipline on
// pastel card fills and iOS blue — and the session's own rating brief got that
// card row wrong until a screenshot was opened.
// See docs/superpowers/specs/2026-10-14-vocabulary-v4-proposal.md, change 4.
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
// `video-embed` added at n=42: subvocal.company ships a 3.79s beauty clip and
// a 91.8s lab video of the prototype as in-page sections, which `video-hero`
// describes wrongly. Safe to add because a material can never back a rule.
export const MATERIALS = [
  "single-theme", "dual-theme", "stock-photo", "commissioned-photo",
  "illustration", "webgl", "video-hero", "video-embed",
] as const;

// faq / team / stats / security / integrations added at n=42. All ten
// session-4 drafts invented context values and the build rejected every one;
// sixteen distinct section names had no slot. These five are the ones that
// recurred and that map to a section with no overlap onto an existing value
// (faq on 4 pages, team on 3). Low risk: `context` backs no rule and no
// threshold reads it. The other eleven invented names were dropped rather
// than reinterpreted — see ~/scratch/antislop/context-normalisation.json and
// docs/superpowers/specs/2026-10-14-vocabulary-v4-proposal.md, change 7.
export const CONTEXTS = [
  "hero", "nav", "pricing", "features", "testimonials", "cta", "footer",
  "docs", "dashboard", "empty-state", "404", "auth", "blog-index", "article",
  "faq", "team", "stats", "security", "integrations",
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
