// Parses and validates one evidence file against the closed vocabulary.
// One module per concern: scripts/build-antislop.ts owns main() and imports
// this, the way build-mcp-conventions.ts imports lib/css-tokens.ts rather
// than restating the token list. Nothing here touches the filesystem.
//
// The frontmatter primitives below (fail, splitFrontmatter, splitKey,
// inlineList) are exported because content/rules/*.md has the same fixed
// shape, and the one bug found in this logic so far — a value split on every
// colon instead of the first — is exactly what a second hand-written copy
// would have reproduced. One implementation, one set of tests behind it.
import {
  ALL_SIGNALS,
  COHORTS,
  CONTEXTS,
  KINDS,
  MATERIALS,
  SIGNAL_VALUES,
  VERDICTS,
  type SignalValue,
} from "../../lib/antislop-vocab.ts";

export type Evidence = {
  slug: string;
  source: string;
  kind: string;
  cohort: string;
  context: string[];
  verdict: string;
  studied: string;
  signals: Record<string, SignalValue>;
  materials: string[];
  prose: string;
};

const REQUIRED = ["source", "kind", "cohort", "context", "verdict", "studied"] as const;

// `prefix` is the full repo-relative path of the offending file, so every
// error names the file whoever has to fix it must open. Callers own their own
// path shape — this module never assumes it is parsing evidence rather than
// a rule.
export function fail(prefix: string, msg: string): never {
  throw new Error(`${prefix}: ${msg}`);
}

// A missing or unterminated fence must name the problem, not blow up on a
// null match downstream.
export function splitFrontmatter(text: string, prefix: string): { head: string; prose: string } {
  if (!text.startsWith("---\n")) fail(prefix, "no frontmatter: file must start with '---'");
  const end = text.indexOf("\n---", 3);
  if (end === -1) fail(prefix, "unterminated frontmatter: no closing '---'");
  return { head: text.slice(4, end), prose: text.slice(end + 4) };
}

// Split on the FIRST colon only. `source: https://example.com` carries two
// more, and splitting on all of them rewrites every URL in the corpus as
// `https: //example.com` — a corruption no other check in this file can see.
export function splitKey(line: string): [string, string] {
  const i = line.indexOf(":");
  if (i === -1) return [line.trim(), ""];
  return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
}

// `[hero, cta]` -> ["hero", "cta"]. The inline-list form is the only one the
// frontmatter uses, so there is nothing here a YAML dependency would buy.
export function inlineList(raw: string | undefined): string[] {
  return (raw ?? "")
    .replace(/[[\]]/g, "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseEvidence(text: string, slug: string): Evidence {
  const path = `content/evidence/${slug}.md`;
  const { head, prose } = splitFrontmatter(text, path);

  const scalars: Record<string, string> = {};
  const signals: Record<string, string> = {};
  let inSignals = false;
  for (const line of head.split("\n")) {
    if (!line.trim()) continue;
    if (line.trimEnd() === "signals:") {
      inSignals = true;
      continue;
    }
    if (inSignals && line.startsWith("  ")) {
      const [k, v] = splitKey(line);
      signals[k] = v;
      continue;
    }
    inSignals = false;
    const [k, v] = splitKey(line);
    scalars[k] = v;
  }

  for (const key of REQUIRED) if (!scalars[key]) fail(path, `missing required key '${key}'`);
  if (!KINDS.includes(scalars.kind as never)) fail(path, `kind '${scalars.kind}' is not one of: ${KINDS.join(", ")}`);
  if (!COHORTS.includes(scalars.cohort as never)) fail(path, `cohort '${scalars.cohort}' is not one of: ${COHORTS.join(", ")}`);
  if (!VERDICTS.includes(scalars.verdict as never)) fail(path, `verdict '${scalars.verdict}' is not one of: ${VERDICTS.join(", ")}`);

  const context = inlineList(scalars.context);
  for (const c of context) if (!CONTEXTS.includes(c as never)) fail(path, `context '${c}' is not in the vocabulary`);

  const materials = inlineList(scalars.materials);
  for (const m of materials) if (!MATERIALS.includes(m as never)) fail(path, `material '${m}' is not in the vocabulary`);

  // An evidence file that sets nothing contributes nothing but still passes
  // every other check — it would inflate the file count behind every rule.
  if (Object.keys(signals).length === 0) {
    fail(path,"signals: block is empty — an evidence file must set at least one signal");
  }

  for (const [k, v] of Object.entries(signals)) {
    if (!ALL_SIGNALS.includes(k as never)) fail(path, `signal '${k}' is not in the vocabulary (lib/antislop-vocab.ts)`);
    if (!SIGNAL_VALUES.includes(v as never)) fail(path, `signal '${k}' has value '${v}'; must be ${SIGNAL_VALUES.join(" | ")}`);
  }

  return {
    slug,
    source: scalars.source,
    kind: scalars.kind,
    cohort: scalars.cohort,
    context,
    verdict: scalars.verdict,
    studied: scalars.studied,
    signals: signals as Record<string, SignalValue>,
    materials,
    prose,
  };
}
