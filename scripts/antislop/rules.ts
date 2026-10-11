// Rule parsing and the computed counts behind each rule.
//
// A rule asserts nothing about how many sites back it: the number is computed
// from the evidence slugs it names, so a rule cannot claim a count its files
// do not support. Everything here exists to keep that true — see the duplicate
// and unresolved handling below.
import { ALL_SIGNALS, CONTEXTS, MATERIALS, type SignalValue } from "../../lib/antislop-vocab.ts";
import { fail, inlineList, splitFrontmatter, splitKey, type Evidence } from "./evidence.ts";

// The two closed sets a rule's own fields are drawn from. Not in
// lib/antislop-vocab.ts because they describe a rule's shape, not the
// vocabulary the evidence is rated against.
const STANCES = ["avoid", "prefer"] as const;
const SEVERITIES = ["hard", "soft"] as const;

export type Rule = {
  id: string;
  context: string;
  signal: string;
  stance: (typeof STANCES)[number];
  severity: (typeof SEVERITIES)[number];
  evidence: string[];
  body: string;
};

const REQUIRED = ["context", "signal", "stance", "severity", "evidence"] as const;

export function parseRule(text: string, id: string): Rule {
  // Frontmatter primitives come from evidence.ts rather than a second copy
  // here: a hand-written duplicate is exactly what reproduced the
  // split-on-every-colon bug once already.
  const path = `content/rules/${id}.md`;
  const { head, prose: body } = splitFrontmatter(text, path);

  const scalars: Record<string, string> = {};
  for (const line of head.split("\n")) {
    if (!line.trim()) continue;
    const [k, v] = splitKey(line);
    scalars[k] = v;
  }

  for (const key of REQUIRED) if (!scalars[key]) fail(path, `missing required key '${key}'`);

  // Materials are checked before the vocabulary check so the error says why
  // the name is wrong, not merely that it is absent from the signal list.
  if (MATERIALS.includes(scalars.signal as never)) {
    fail(
      path,
      `signal '${scalars.signal}' is a material, not a signal. Materials are descriptive and cannot carry a stance — a rule written against one can never be satisfied.`,
    );
  }
  if (!ALL_SIGNALS.includes(scalars.signal as never)) {
    fail(path, `signal '${scalars.signal}' is not in the vocabulary (lib/antislop-vocab.ts)`);
  }

  // A context outside the vocabulary is the same defect class as a material
  // signal: rulesForContext is queried with vocabulary contexts, so the rule
  // would validate, count, and never be served to anyone.
  if (!CONTEXTS.includes(scalars.context as never)) {
    fail(path, `context '${scalars.context}' is not in the vocabulary: ${CONTEXTS.join(", ")}`);
  }
  if (!STANCES.includes(scalars.stance as never)) {
    fail(path, `stance '${scalars.stance}' is not one of: ${STANCES.join(", ")}`);
  }
  if (!SEVERITIES.includes(scalars.severity as never)) {
    fail(path, `severity '${scalars.severity}' is not one of: ${SEVERITIES.join(", ")}`);
  }

  const evidence = inlineList(scalars.evidence);

  // A rule with no evidence still renders a count — 0/0 — which reads as a
  // measurement and is not one.
  if (evidence.length === 0) {
    fail(path, "evidence: list is empty — a rule must name at least one evidence file");
  }

  const seen = new Set<string>();
  for (const slug of evidence) {
    // A duplicate inflates the numerator against a denominator of distinct
    // files — exactly the drift the computed-count discipline exists to stop.
    // Rejected rather than deduped: a rule claiming 40 with 39 distinct files
    // is an authoring error worth seeing, not something to quietly correct.
    if (seen.has(slug)) fail(path, `duplicate slug '${slug}' in evidence:`);
    seen.add(slug);
  }

  return {
    id,
    context: scalars.context,
    signal: scalars.signal,
    stance: scalars.stance as Rule["stance"],
    severity: scalars.severity as Rule["severity"],
    evidence,
    body,
  };
}

export function countRule(rule: Rule, corpus: Map<string, Evidence>): { present: number; total: number } {
  let present = 0;
  let total = 0;
  for (const slug of rule.evidence) {
    const e = corpus.get(slug);
    if (!e) fail(`content/rules/${rule.id}.md`, `evidence '${slug}' has no file in content/evidence/`);
    // Annotated, not inferred: the repo does not set noUncheckedIndexedAccess,
    // so a Record lookup types as SignalValue and `v === undefined` would be a
    // no-overlap type error — on a line whose whole point is the missing case.
    // The undefined arm is live: a file that never set this signal at all.
    const v: SignalValue | undefined = e.signals[rule.signal];
    // `unresolved` leaves both sides: it is a statement that the evidence
    // could not settle this, so it can neither support nor oppose the rule.
    // Counting it as absent would dilute the rate with non-answers; counting
    // it as present would invent evidence. An unset signal is the same case.
    if (v === "unresolved" || v === undefined) continue;
    total += 1;
    if (v === "present") present += 1;
  }
  return { present, total };
}
