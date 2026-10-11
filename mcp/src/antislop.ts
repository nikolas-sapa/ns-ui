// Loads the anti-slop snapshot baked into this package by
// scripts/build-antislop.ts (repo root). Same contract as data.ts: offline,
// no network, no filesystem walk at query time, one cached read.
//
// Loaded lazily rather than at server boot, unlike the registry snapshot:
// a missing anti-slop snapshot should take out this one tool, not the whole
// server. Diagnostics go to stderr — stdout carries only JSON-RPC frames.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type AntislopRule = {
  id: string;
  context: string;
  signal: string;
  stance: "avoid" | "prefer";
  severity: "hard" | "soft";
  // The evidence files this rule's count was computed from. Served because a
  // count with no provenance is just a number an agent has to take on trust.
  evidence: string[];
  present: number;
  total: number;
  body: string;
};

export type AntislopSnapshot = {
  generatedAt: string;
  evidenceCount: number;
  cohorts: string[];
  rules: AntislopRule[];
};

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = join(PKG_ROOT, "data", "antislop.json");

let cached: AntislopSnapshot | null = null;

export function loadAntislop(): AntislopSnapshot {
  if (cached) return cached;
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(
      `[ns-ui-mcp] missing ${SNAPSHOT_PATH}. This package ships a generated ` +
        `snapshot of the anti-slop evidence; if you're running from a source ` +
        `checkout instead of an npm install, run \`npm run registry:build\` at ` +
        `the repo root (or \`npm run prepack\` inside mcp/) to generate it.`
    );
    throw new Error(`ns-ui-mcp: anti-slop snapshot not found at ${SNAPSHOT_PATH}`);
  }
  cached = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  return cached!;
}

export function rulesForContext(context?: string): AntislopRule[] {
  const { rules } = loadAntislop();
  const want = context?.trim().toLowerCase();
  if (!want) return rules;
  return rules.filter((r) => r.context.toLowerCase() === want);
}

// The marker pair is build plumbing (scripts/build-antislop.ts rewrites the
// count between them). Strip the comments and keep the value, or every served
// rule reads as HTML source.
const stripMarkers = (s: string) => s.replace(/<!-- generated:[a-z-]+ (?:start|end) -->/g, "");

export function formatRules(rules: AntislopRule[], context?: string): string {
  const snapshot = loadAntislop();
  const studied = `${snapshot.evidenceCount} evidence file(s) across ${snapshot.cohorts.join(", ")}`;
  const asked = context ? ` for '${context}'` : "";

  // An empty result is the honest answer at the moment of writing: 26 signals
  // are rated and none has yet cleared the eligibility bar. Saying so beats
  // returning nothing, which reads as "no constraints here".
  if (rules.length === 0) {
    const contexts = [...new Set(snapshot.rules.map((r) => r.context))].sort();
    return (
      `# ns-ui anti-slop rules\n\n` +
      `No rules${asked}. ${studied} have been studied` +
      (contexts.length > 0
        ? `, and rules exist for: ${contexts.join(", ")}.`
        : `, but no signal has cleared the eligibility bar yet. A signal backs a rule ` +
          `only once its present-rate separates slop from exemplar evidence by a wide ` +
          `enough margin AND it is not already common in the pre-ai-2015 control cohort. ` +
          `Several candidates failed that second test: they are pre-AI web conventions, ` +
          `not AI artifacts.`) +
      `\n\nThis tool asserts nothing beyond what the evidence supports. Treat the ` +
      `absence of a rule as "not measured yet", never as "anything goes".\n`
    );
  }

  const header =
    `# ns-ui anti-slop rules${asked}\n\n` +
    `${rules.length} rule(s), each count computed from the evidence files it names ` +
    `(${studied}).\n`;

  return (
    header +
    rules
      .map(
        (r) =>
          `\n## ${r.id}\n` +
          `${r.stance} \`${r.signal}\` in ${r.context} (${r.severity}); present in ` +
          `${r.present} of ${r.total} rated evidence file(s)\n\n` +
          `${stripMarkers(r.body)}\n\n` +
          `evidence: ${r.evidence.join(", ")}\n`
      )
      .join("")
  );
}
