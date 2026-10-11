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

// Thresholds. Deliberately stated here, not buried.
//
// What they actually reduce to at n=20 is narrower than the numbers suggest:
// the corpus holds 2 slop files, so slopRate is quantised to {0, 0.5, 1} and
// the separation gate becomes "both slop files show it and fewer than 7 of 9
// exemplars do", or "one does and at most 1 of 9 exemplars does". The control
// pool is 7 files, so one file moves controlRate by 0.143 and the gate is
// decided by single-file coin flips. Both rates also inherit the circularity
// the spec admits in section 6: verdicts were set by the rater who had just
// set the signals. This is a procedure to re-run as evidence accumulates, not
// a calibrated constant, and no public claim should cite these numbers.
const SEPARATION_MIN = 0.3; // gap between the two verdict pools, in the direction the class claims
const CONTROL_MAX = 0.3; // present-rate within the control cohort
const CONTROL_MIN_N = 3; // rated control files needed before the gate means anything

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
    reason: `separates as a ${cls} signal: ${pct(hi.rate)} of ${hiName} (n=${hi.n}) vs ${pct(lo.rate)} of ${loName} evidence (n=${lo.n}), gap ${gap.toFixed(2)}; ${pct(control.rate)} in ${CONTROL_COHORT} (n=${control.n})`,
  };
}
