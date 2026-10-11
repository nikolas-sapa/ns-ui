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

// The cohort that answers "was this already normal before AI-built pages?".
// Named rather than inlined because every verdict here turns on it.
const CONTROL_COHORT = "pre-ai-2015";

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
