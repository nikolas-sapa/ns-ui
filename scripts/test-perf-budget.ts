import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

/**
 * Client JavaScript weight gate.
 *
 * The performance work in docs/perf-goal.md kept getting undone because nothing
 * blocked a regression from landing: each pass fixed symptoms and shipped, and
 * the next feature reintroduced the cost. This is that block.
 *
 * WHAT THIS CATCHES: total shipped client JS growing, and any single chunk
 * growing. That is the regression a feature branch actually causes — a chart
 * library pulled into a client component, a server component turned client.
 *
 * WHAT THIS CANNOT CATCH, and this matters more than what it can:
 *   - Field TTFB. Phase 1 measured a 117ms transatlantic origin hop that no
 *     bundle number reflects.
 *   - Paint and INP. Phase 2 found interactions that are entirely
 *     presentation-bound, with ~0ms of handler processing.
 *   - Anything a real user's network does.
 * A green run means "no new weight". It never means "still fast". Speed
 * Insights remains the only answer to that, and needs ~7 days of traffic after
 * a deploy.
 *
 * WHY NOT PER-ROUTE: Next 16 + Turbopack emits no `app-build-manifest.json` and
 * its route table prints no First Load JS column, so per-route attribution
 * would mean reading bundler internals. This is the honest limitation: a
 * regression isolated to one route can hide under the total's tolerance if it
 * is small relative to the whole. Sizeable additions — the ones that matter —
 * still trip it.
 *
 * WHY NOT A BROWSER: CI sets PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1, so a lab run
 * would cost a ~400MB download per PR to measure something noisier than this.
 *
 * ponytail: byte-sums the emitted chunks, no bundle analyzer. If per-route
 * attribution ever becomes necessary, read the build trace rather than adding a
 * dependency.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const chunkDir = join(root, ".next/static/chunks");
const budgetPath = join(root, "perf-budget.json");

/** Chunk hashing and dependency bumps move these numbers slightly on every
 *  build. 10% absorbs that without absorbing a real regression — a new library
 *  is far more than 10%. */
const TOLERANCE = 1.1;

// A missing build means the gate silently checked nothing, which is worse than
// failing: CI would go green on something never measured.
assert.ok(
  existsSync(chunkDir),
  "No .next/static/chunks — run `npm run build` before this gate. " +
    "Refusing to pass without measuring anything."
);

/** Every emitted client chunk, recursively: Turbopack nests some under
 *  per-entry directories. */
function jsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsFiles(p));
    else if (entry.name.endsWith(".js")) out.push(p);
  }
  return out;
}

const files = jsFiles(chunkDir);
assert.ok(
  files.length > 0,
  "Build output contained zero JS chunks — failing rather than passing on nothing checked."
);

const sizes = files.map((f) => ({ file: f.slice(root.length + 1), kb: statSync(f).size / 1024 }));
const totalKb = Math.round(sizes.reduce((a, c) => a + c.kb, 0));
const largest = sizes.sort((a, b) => b.kb - a.kb)[0];
const largestKb = Math.round(largest.kb);

const measured = { totalClientJsKb: totalKb, largestChunkKb: largestKb };

// `--update` re-baselines from the current build. Run it deliberately when an
// increase is real and accepted; never to turn a red CI green.
if (process.argv.includes("--update")) {
  writeFileSync(
    budgetPath,
    `${JSON.stringify(
      {
        "// generated": "npm run test:perf-budget -- --update — see scripts/test-perf-budget.ts",
        "// tolerance": `CI fails a value exceeding budget by more than ${Math.round(
          (TOLERANCE - 1) * 100
        )}%.`,
        "// scope": "Client JS weight only. Says nothing about TTFB, paint, or INP.",
        ...measured,
      },
      null,
      2
    )}\n`
  );
  console.log(
    `Wrote perf-budget.json — total ${totalKb} KB across ${files.length} chunks, largest ${largestKb} KB.`
  );
  process.exit(0);
}

assert.ok(
  existsSync(budgetPath),
  "No perf-budget.json — generate it once with `npm run test:perf-budget -- --update`."
);

const budget = JSON.parse(readFileSync(budgetPath, "utf8")) as Record<string, number>;
const failures: string[] = [];

for (const [key, value] of Object.entries(measured)) {
  const allowed = budget[key];
  assert.ok(
    typeof allowed === "number",
    `perf-budget.json is missing \`${key}\`. Re-baseline with \`--update\` rather than skipping the check.`
  );
  if (value > allowed * TOLERANCE) {
    failures.push(
      `  ${key}: ${allowed} KB -> ${value} KB  (+${Math.round(((value - allowed) / allowed) * 100)}%)`
    );
  }
}

if (failures.length) {
  console.error(
    `\nClient JS budget exceeded (tolerance ${Math.round((TOLERANCE - 1) * 100)}%):\n` +
      `${failures.join("\n")}\n` +
      `  largest chunk is ${largest.file}\n\n` +
      "If this growth is intended, re-baseline deliberately:\n" +
      "  npm run build && npm run test:perf-budget -- --update\n" +
      "and say so in the commit message. Do not re-baseline to silence a red CI.\n"
  );
  process.exit(1);
}

console.log(
  `Client JS budget OK — total ${totalKb} KB (budget ${budget.totalClientJsKb}), ` +
    `largest chunk ${largestKb} KB (budget ${budget.largestChunkKb}).`
);
