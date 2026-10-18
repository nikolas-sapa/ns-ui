// Whether a signal has earned the right to back a rule, computed from the
// evidence rather than declared.
//
// Session 1's structural finding: several v1 slop signals are pre-AI web
// conventions — hero-mockup-float ran 43% in 2014, centered-hero-stack 5/7 —
// so a rule against them convicts good pages and fails against the control
// cohort the first time anyone checks. A signal therefore earns a rule only if
// its present-rate separates exemplar from slop in the direction its class
// claims, AND the control cohort has enough rated evidence to show it is not
// simply what websites already looked like. See
// docs/superpowers/specs/2026-10-11-vocabulary-v2.md section 6 ("A signal must
// EARN a rule").
import { ALL_SIGNALS, CRAFT_SIGNALS, SLOP_SIGNALS, type SignalValue } from "../../lib/antislop-vocab.ts";
import type { Evidence } from "./evidence.ts";

// The gates, in one place. Every one of these encodes a finding at n=20 and is
// expected to be revisited as evidence accumulates — the spec calls this a
// procedure to re-run, not a calibrated constant, and no public claim should
// cite these numbers.
//
// What they reduce to on the current corpus is narrower than the values
// suggest. There are 2 slop files, so slopRate is quantised to {0, 0.5, 1} and
// the 0.3 gap does almost no work: the binding constraint is slopRate itself.
// One of those 2 is heroku-2014, a control file, so the separation and control
// gates are not independent — a 2014 convention earns separation credit from
// the same cohort the control gate penalises it for. The control pool is 7
// files, so one file moves controlRate by 0.143 and the gate turns on
// single-file coin flips. Both verdict rates also inherit the circularity the
// spec admits in section 6: verdicts were set by the rater who had just set
// the signals. The two pool minimums below are what stop any of that from
// authorizing a rule: thin evidence fails closed rather than passing quietly.
const SEPARATION_MIN = 0.3; // gap between the verdict pools, in the direction the class claims
const CONTROL_MAX = 0.3; // present-rate within the control cohort; SLOP SIGNALS ONLY
const CONTROL_MIN_N = 3; // rated control files before the control gate means anything; slop only
// The slop-pool minimum, applied to EITHER verdict pool rather than only the
// slop one: the gap is computed from both, so either being thin makes it
// unreliable, and for a craft signal the thin side is the slop pool anyway.
const VERDICT_MIN_N = 3; // rated files in each verdict pool before a gap means anything; both classes
// The signal's own positive count, across the WHOLE corpus rather than within
// a verdict pool. Added when the gate first opened and let two signals through
// on almost nothing: badge-pill-spam was eligible on a single `present` file
// and stock-photo-generic on two. Both passed because the pool minimums
// constrain how many files were RATED, and the separation gate reads a rate —
// 1 of 3 slop files is 33%, which clears a 0.3 gap. Neither gate looks at how
// many times the signal was actually observed. A rule reading "present in 1 of
// 32 files studied" is not a rule, it is an anecdote with a denominator.
const PRESENT_MIN_N = 3; // `present` observations corpus-wide before a signal may back a rule

// The cohort that answers "was this already normal before AI-built pages?".
// Named rather than inlined because every verdict here turns on it.
const CONTROL_COHORT = "pre-ai-2015";

// Signals held back from backing a rule for a reason the rates cannot see.
// The gates above test whether a signal's present-rate separates the verdict
// pools; they cannot test whether the signal was applied consistently in the
// first place. A signal with no definition passes them on noise.
//
// Session 3 authored eleven rules and withdrew all eleven when two blind
// raters split on one craft signal. Session 4 then measured the thing that
// makes that repeatable: flipping ONE file's verdict moves eleven signals
// from ineligible to eligible, and `single-optical-anchor` is in that eleven.
// See docs/superpowers/specs/2026-10-14-vocabulary-v4-proposal.md, change 2.
//
// Entries are expected to be removed, not to accumulate. Removing one needs a
// definition AND a re-pass of the corpus against it — not just a definition,
// because the existing values were set without one.
const RULE_INELIGIBLE: Record<string, string> = {
  "single-optical-anchor":
    "the only v3 signal with an empty notes cell: it has no definition, and the 25 `present` values in the corpus were each set without one. It also came in at 8/10 in the session-4 batch against 40% in the prior yc-current cohort, a +38pt swing consistent with being marked present by default, and 44% of the files scoring it present discuss it in prose at all. Define it and re-pass the corpus, then delete this entry — a definition alone would retroactively validate or invalidate 25 scores nobody has re-read.",
  // The next two are eligible only through the five screen-selected
  // ai-builder files: the pre-screen that chose them ranked on these signals,
  // so their slop present-rate is partly the selection. Remove each once three
  // or more slop files no screen chose settle it and it still separates.
  // docs/superpowers/specs/2026-10-15-holes-7-and-2-applied.md, the slop hunt.
  "gradient-blob":
    "eligible only through the screen-selected ai-builder files, whose pre-screen ranked on blur blobs. Only two slop files were not screen-selected (heroku-2014, toppic), under the three-file pool minimum.",
  "three-card-row":
    "eligible only through the screen-selected ai-builder files, whose pre-screen ranked on three-card rows. Only two slop files were not screen-selected (heroku-2014, toppic), under the three-file pool minimum.",
  "glass-card-overuse":
    "eligible only through the screen-selected ai-builder files, whose pre-screen ranked on glass panels. Authored as a rule over heroku-2014, openhack and toppic, then withdrawn when the symmetric-everything re-pass moved openhack to `mixed`: two unscreened slop files remain, under the three-file pool minimum.",
  "generic-sans-default":
    "eligible only through the screen-selected ai-builder files, whose pre-screen ranked on generic sans. Authored as a rule over heroku-2014, openhack and toppic, then withdrawn when the symmetric-everything re-pass moved openhack to `mixed`: two unscreened slop files remain, under the three-file pool minimum.",
  "indigo-violet-accent":
    "eligible only through the screen-selected ai-builder files, whose pre-screen ranked on an indigo accent. Authored as a rule over heroku-2014, openhack and toppic, then withdrawn when the symmetric-everything re-pass moved openhack to `mixed`: two unscreened slop files remain, under the three-file pool minimum.",
};

type Eligibility = {
  eligible: boolean;
  reason: string;
  exemplarRate: number;
  slopRate: number;
  controlRate: number;
};

// Spec test 9. A signal that never fires is not self-evidently wrong — the
// badge-pill and glassmorphism waves genuinely passed — but it must be
// visible, because the other cause is a definition that cannot match reality.
export function deadSignals(corpus: Map<string, Evidence>): string[] {
  return ALL_SIGNALS.filter((s) => ![...corpus.values()].some((e) => e.signals[s] === "present"));
}

export function eligibility(signal: string, corpus: Map<string, Evidence>): Eligibility {
  const files = [...corpus.values()];

  // A signal the file never set, and one it set to `unresolved`, are both
  // non-answers: they leave the pool rather than landing in the denominator.
  const settled = (e: Evidence): SignalValue | undefined => {
    const v: SignalValue | undefined = e.signals[signal];
    return v === undefined || v === "unresolved" ? undefined : v;
  };

  // Both rate and pool size: spec section 11 — any claim built on these counts
  // states its n. A bare percentage at n=2 reads like a finding.
  const measure = (pred: (e: Evidence) => boolean) => {
    const pool = files.filter(pred).filter((e) => settled(e) !== undefined);
    if (pool.length === 0) return { rate: 0, n: 0 };
    return { rate: pool.filter((e) => settled(e) === "present").length / pool.length, n: pool.length };
  };

  const slop = measure((e) => e.verdict === "slop");
  const exemplar = measure((e) => e.verdict === "exemplar");
  const control = measure((e) => e.cohort === CONTROL_COHORT);

  const pct = (r: number) => `${Math.round(r * 100)}%`;
  const rates = { exemplarRate: exemplar.rate, slopRate: slop.rate, controlRate: control.rate };
  const no = (reason: string): Eligibility => ({ eligible: false, ...rates, reason });

  // The direction of the separation test comes from the signal's class, and
  // nothing here uses an absolute gap. A slop signal commoner among exemplars
  // is not a craft signal with a flipped stance — it is a signal classified
  // wrongly, and it has to surface as ineligible so a human looks at it.
  const isSlop = SLOP_SIGNALS.includes(signal as never);
  const isCraft = CRAFT_SIGNALS.includes(signal as never);
  if (!isSlop && !isCraft) {
    return no(
      `'${signal}' is in neither SLOP_SIGNALS nor CRAFT_SIGNALS, so there is no direction to test it in. Eligibility is only defined for the closed vocabulary in lib/antislop-vocab.ts.`,
    );
  }
  const cls = isSlop ? "slop" : "craft";
  // Held back by hand, and checked before the rates: a signal that was applied
  // inconsistently can still pass a separation test on noise.
  if (RULE_INELIGIBLE[signal]) return no(`'${signal}' is held back from backing a rule: ${RULE_INELIGIBLE[signal]}`);
  // For a slop signal the claim is "commoner among slop"; for a craft signal,
  // "commoner among exemplars". The gap is signed, in that order.
  const [hi, lo] = isSlop ? [slop, exemplar] : [exemplar, slop];
  const [hiName, loName] = isSlop ? ["slop", "exemplar"] : ["exemplar", "slop"];
  const gap = hi.rate - lo.rate;

  // The control gate is a slop-signal concern only. Its own argument — "a rule
  // against it would convict the control cohort" — is an avoid-rule argument:
  // a prefer rule built on a craft signal that was common in 2014 praises that
  // cohort, so there is nothing to convict. It is deliberately NOT inverted for
  // craft either. Requiring a minimum pre-AI presence would assert that real
  // craft must be timeless, a stronger claim than the evidence supports, and it
  // would disqualify a genuinely new technique — live-claim-control is exactly
  // that. Being common in 2014 is weak positive evidence for a craft signal,
  // not a requirement. controlRate is still measured and reported for every
  // signal; it just does not gate a craft one.
  if (isSlop) {
    // Fail closed. With too few rated control files the honest answer is "not
    // enough evidence to tell", and a rate of 0 over an empty pool would clear
    // the exact gate that exists to catch pre-AI conventions.
    if (control.n < CONTROL_MIN_N) {
      return no(
        `only ${control.n} rated ${CONTROL_COHORT} file(s) (n=${control.n}), ${CONTROL_MIN_N} required: not enough control evidence to tell whether this is a convention that predates AI-built pages. Rate it in more ${CONTROL_COHORT} evidence before authoring a rule.`,
      );
    }
    if (control.rate > CONTROL_MAX) {
      return no(
        `already present in ${pct(control.rate)} of ${CONTROL_COHORT} evidence (n=${control.n}) — a convention, not an AI artifact. A rule against it would convict the control cohort.`,
      );
    }
  }
  // Fail closed on the separation side too. The gap is computed from both
  // verdict pools, so either one being thin makes it unreliable however wide
  // it looks: three-card-row scored a gap of 0.89 on a single rated slop file.
  // Checked after the control gate because "this is a 2014 convention" is a
  // decisive finding, while a thin pool is only an absence of evidence.
  const thin = ([
    [hiName, hi],
    [loName, lo],
  ] as const).filter(([, p]) => p.n < VERDICT_MIN_N);
  if (thin.length > 0) {
    return no(
      `not enough rated evidence to compute a separation: ${thin
        .map(([name, p]) => `${name} (n=${p.n})`)
        .join(", ")}; ${VERDICT_MIN_N} rated files required in each verdict pool. A gap resting on one or two files cannot authorize a rule.`,
    );
  }
  // Fail closed on the signal's own evidence, not just the pools'. Checked
  // last: it is the narrowest claim of the three and the least informative
  // reason to report when a wider one applies.
  const presentN = files.filter((e) => settled(e) === "present").length;
  if (presentN < PRESENT_MIN_N) {
    return no(
      `only ${presentN} file(s) in the whole corpus rate this \`present\`, ${PRESENT_MIN_N} required: a rule would rest on an anecdote. Rate it in more evidence before authoring one.`,
    );
  }
  if (gap < SEPARATION_MIN) {
    return no(
      `does not separate as a ${cls} signal: ${pct(hi.rate)} of ${hiName} (n=${hi.n}) vs ${pct(lo.rate)} of ${loName} evidence (n=${lo.n}), gap ${gap.toFixed(2)} where ${SEPARATION_MIN.toFixed(2)} toward ${hiName} is required. ${
        isSlop
          ? "A rule would convict pages that did it well."
          : "A craft signal must be commoner among exemplars than slop; if it is not, its classification is wrong, not its stance."
      }`,
    );
  }
  return {
    eligible: true,
    ...rates,
    reason: `separates as a ${cls} signal: ${pct(hi.rate)} of ${hiName} (n=${hi.n}) vs ${pct(lo.rate)} of ${loName} evidence (n=${lo.n}), gap ${gap.toFixed(2)}; ${pct(control.rate)} in ${CONTROL_COHORT} (n=${control.n})${
      isSlop ? "" : ", measured but not gated for a craft signal"
    }`,
  };
}
