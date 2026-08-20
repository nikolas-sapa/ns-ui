// Proves the /status check layer against the real emitted measurements.
// Usage: node scripts/build-status.ts && node scripts/test-status-checks.ts
//
// Offline and deterministic by default: it reads lib/status.generated.json
// and exercises the pure builders. Pass --live to additionally PRINT the four
// network reads. Those are never asserted — they depend on npm, unpkg and the
// production origin being up, and a test that fails because someone else's
// host is down teaches nothing.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  integrityChecks,
  serviceChecks,
  notMeasuredChecks,
  fetchLiveOriginCount,
  fetchPublishedCli,
  fetchPublishedMcp,
  probeConvex,
  driftOf,
  EM_DASH,
  type StatusBuild,
  type StatusCheck,
} from "../lib/status-checks.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED = join(ROOT, "lib", "status.generated.json");
if (!existsSync(GENERATED)) {
  throw new Error("lib/status.generated.json missing — run scripts/build-status.ts first.");
}
const build: StatusBuild = JSON.parse(readFileSync(GENERATED, "utf8"));

const by = (checks: StatusCheck[], id: string): StatusCheck => {
  const found = checks.find((c) => c.id === id);
  assert.ok(found, `no check with id "${id}"`);
  return found;
};

// --- the measurements are internally consistent --------------------------
assert.ok(build.components > 0, "no components measured");
for (const field of ["payloadsOk", "screenshotsOk", "metaOk", "postersOk", "previewsOk"] as const) {
  const total = build[field.replace("Ok", "Total") as keyof StatusBuild] as number;
  assert.ok(build[field] <= total, `${field} exceeds its total`);
}
assert.equal(build.redirectEntries, build.redirectPairs * 4, "redirect entries != pairs x 4");
assert.ok(!Number.isNaN(Date.parse(build.builtAt)), "builtAt is not a date");

// --- integrity rows, with the published count present --------------------
const integrity = integrityChecks(build, build.components - 32, "2026-01-01T00:00:00.000Z");
assert.equal(integrity.length, 7);

// Severity-descending: no row may be followed by a more severe one.
const RANK: Record<string, number> = { down: 0, degraded: 1, unknown: 2, ok: 3 };
for (let i = 1; i < integrity.length; i += 1) {
  assert.ok(
    RANK[integrity[i - 1].state] <= RANK[integrity[i].state],
    `row ${i} (${integrity[i].id}) outranks the row above it`
  );
}

// Every row states a value and a reason, always. A silent row is a lie.
for (const check of [...integrity, ...notMeasuredChecks(build.builtAt)]) {
  assert.ok(check.detail.length > 0, `${check.id} has no detail`);
  assert.ok(check.value.length > 0, `${check.id} has no value`);
  assert.ok(!Number.isNaN(Date.parse(check.measuredAt)), `${check.id} measuredAt is not a date`);
}

// Build-derived rows carry builtAt, never a render time.
assert.equal(by(integrity, "featured-previews").measuredAt, build.builtAt);
assert.equal(by(integrity, "screenshot-gate").measuredAt, build.builtAt);

// The one row sourced from npm carries the runtime timestamp instead.
assert.equal(by(integrity, "published-tooling-coverage").measuredAt, "2026-01-01T00:00:00.000Z");

// Coverage states follow the measurement, and the declared severity decides
// how a shortfall reads.
assert.equal(
  by(integrity, "featured-previews").state,
  build.previewsOk === build.previewsTotal ? "ok" : "down"
);
// Measured per file (slug x theme), reported per card: 0/72 files is 0/36 cards.
assert.equal(
  by(integrity, "featured-previews").value,
  `${build.previewsOk / 2} / ${build.previewsTotal / 2}`
);
assert.equal(
  by(integrity, "screenshot-gate").state,
  build.screenshotsOk === build.screenshotsTotal ? "ok" : "degraded"
);
assert.equal(by(integrity, "published-tooling-coverage").state, "degraded");
// A published index AHEAD of this build is still drift, and must not render a
// negative shortfall ("-5 live components are absent").
assert.ok(
  !by(
    integrityChecks(build, build.components + 5, "2026-01-01T00:00:00.000Z"),
    "published-tooling-coverage"
  ).detail.includes("-"),
  "published coverage detail states a negative gap"
);
assert.equal(
  by(integrity, "rename-redirects").value,
  `${build.redirectPairs} pairs · ${build.redirectEntries} entries · ${build.redirectBrokenTargets} broken`
);

// A clean coverage row is silent: state ok, and its detail names the source.
const posters = by(integrity, "featured-posters");
if (build.postersOk === build.postersTotal) assert.equal(posters.state, "ok");
// Posters keep the raw file-pair count. The asymmetry is in the spec.
assert.equal(posters.value, `${build.postersOk} / ${build.postersTotal}`);

// --- an unreadable published count is UNKNOWN, never a failure -----------
const noNpm = integrityChecks(build, null, "2026-01-01T00:00:00.000Z");
const unknownRow = by(noNpm, "published-tooling-coverage");
assert.equal(unknownRow.state, "unknown");
assert.equal(unknownRow.value, EM_DASH);
assert.ok(unknownRow.detail.length > 0);

// --- services: total runtime failure produces zero red -------------------
const dead = serviceChecks(
  build,
  {
    liveOriginCount: null,
    cliVersionPublished: null,
    mcpVersionPublished: null,
    convexReachable: null,
  },
  "2026-01-01T00:00:00.000Z"
);
// live origin, convex, and one row per published package.
assert.equal(dead.length, 4);
for (const check of dead) {
  assert.equal(check.state, "unknown", `${check.id} must be unknown when its read fails`);
  assert.equal(check.value, EM_DASH);
}
// The core honesty rule: nothing anywhere on the page turns red because a
// fetch failed. A Convex throw is "we could not look", not "Convex is down".
const allDead = [...noNpm, ...dead];
assert.equal(
  allDead.filter((c) => c.state === "down" && c.id !== "featured-previews").length,
  0,
  "a failed read produced a FAILED state"
);
// Naming an outage as one of two indistinguishable causes is honest; ASSERTING
// one is not. The banned shape is a declarative "X is down/unreachable/offline".
assert.ok(
  !dead.some((c) => /\b(is|are)\s+(down|offline|unreachable|broken)\b/i.test(c.detail)),
  "an unknown row asserts that something is down"
);

// --- services: everything up ---------------------------------------------
const live = serviceChecks(
  build,
  {
    liveOriginCount: build.components,
    cliVersionPublished: build.cliVersionLocal,
    cliComponentsPublished: build.components,
    mcpVersionPublished: build.mcpVersionLocal,
    mcpComponentsPublished: build.components,
    convexReachable: true,
  },
  "2026-01-01T00:00:00.000Z"
);
assert.equal(by(live, "live-origin").state, "ok");
assert.equal(by(live, "live-origin").value, `${build.components} items`);
assert.equal(by(live, "convex-read-path").state, "ok");
assert.equal(by(live, "convex-read-path").value, "reachable");
// One row per package, each resting on its own two reads.
assert.equal(by(live, "published-cli").state, "ok");
assert.equal(by(live, "published-mcp").state, "ok");
assert.equal(
  by(live, "published-cli").value,
  `${build.cliVersionLocal} · ${build.components} components`
);
assert.equal(
  by(live, "published-mcp").value,
  `${build.mcpVersionLocal} · ${build.components} components`
);
// The MCP row is read from the MCP's own artifact, never the CLI's index.
assert.ok(by(live, "published-mcp").detail.includes("registry-snapshot.json"));
assert.ok(by(live, "published-cli").detail.includes("registry-index.json"));
// The caveat is present even when the row is clean.
assert.ok(by(live, "convex-read-path").detail.includes("unauthenticated"));

// A published version ahead of this repo is drift, and both numbers are named.
// It is drift on THAT package's row only: the other package is untouched.
const stale = serviceChecks(
  build,
  {
    liveOriginCount: build.components,
    cliVersionPublished: "99.0.0",
    cliComponentsPublished: build.components,
    mcpVersionPublished: build.mcpVersionLocal,
    mcpComponentsPublished: build.components,
    convexReachable: true,
  },
  "2026-01-01T00:00:00.000Z"
);
const pkgRow = by(stale, "published-cli");
assert.equal(pkgRow.state, "degraded");
assert.ok(pkgRow.detail.includes("99.0.0"));
assert.ok(pkgRow.detail.includes(build.cliVersionLocal ?? "—"));
assert.equal(by(stale, "published-mcp").state, "ok");

// A component count short of this build is drift too, and names both counts.
const short = by(
  serviceChecks(
    build,
    {
      liveOriginCount: build.components,
      cliVersionPublished: build.cliVersionLocal,
      cliComponentsPublished: build.components,
      mcpVersionPublished: build.mcpVersionLocal,
      mcpComponentsPublished: build.components - 5,
      convexReachable: true,
    },
    "2026-01-01T00:00:00.000Z"
  ),
  "published-mcp"
);
assert.equal(short.state, "degraded");
assert.ok(short.detail.includes(`${build.components - 5}`));
assert.ok(short.detail.includes(`${build.components}`));

// A version that was read while its index was not is UNKNOWN, and the row
// still prints an em dash — half a claim is not a value. The reason names the
// version that WAS read and the file that was not.
const halfRead = by(
  serviceChecks(
    build,
    {
      liveOriginCount: build.components,
      cliVersionPublished: build.cliVersionLocal,
      cliComponentsPublished: null,
      mcpVersionPublished: build.mcpVersionLocal,
      mcpComponentsPublished: build.components,
      convexReachable: true,
    },
    "2026-01-01T00:00:00.000Z"
  ),
  "published-cli"
);
assert.equal(halfRead.state, "unknown");
assert.equal(halfRead.value, EM_DASH);
assert.ok(halfRead.detail.includes(build.cliVersionLocal ?? "—"));
assert.ok(halfRead.detail.includes("registry-index.json"));

// The split is the point: no row anywhere still carries the combined id.
for (const row of [...live, ...stale, ...dead]) {
  assert.notEqual(row.id, "published-packages");
}

// A live origin behind this build still reads ok here — the divergence is
// §1's claim, rendered in --error there, and must not also be painted blue.
const behind = by(
  serviceChecks(
    build,
    {
      liveOriginCount: build.components - 1,
      cliVersionPublished: build.cliVersionLocal,
      mcpVersionPublished: build.mcpVersionLocal,
      convexReachable: true,
    },
    "2026-01-01T00:00:00.000Z"
  ),
  "live-origin"
);
assert.equal(behind.state, "ok");
assert.equal(behind.value, `${build.components - 1} items`);

// --- not measured: every row is an em dash with a reason -----------------
const notMeasured = notMeasuredChecks(build.builtAt);
assert.equal(notMeasured.length, 6);
for (const check of notMeasured) {
  assert.equal(check.state, "unknown");
  assert.equal(check.value, EM_DASH);
}

// --- driftOf, against the REAL 2026-08-20 incident numbers ---------------
// This is the comparison app/api/status-snapshot/route.ts now runs at poll
// time (it did not before this change — see convex/schema.ts's note on
// `state`), shared with `packageCheck` above via `driftOf` so the poller and
// §3 of /status can never describe the same drift in different words. The
// numbers below are not invented: `@nikolas.sapa/ns-ui` published 0.6.0 with
// 326 components on 2026-08-12 while this repo was already at 389 (verified
// against registry.npmjs.org's `time` field and unpkg's
// data/registry-index.json for that version), and republished 0.7.0 with all
// 389 components at 2026-08-20T17:06:54Z, resolving it.
assert.deepEqual(
  driftOf({ version: "0.6.0", localVersion: "0.7.0", components: 326, buildComponents: 389 }),
  [
    "0.6.0 published vs 0.7.0 in this repo",
    "326 components in the published package vs 389 in this build",
  ],
  "the incident's own numbers did not register as drift",
);
assert.deepEqual(
  driftOf({ version: "0.7.0", localVersion: "0.7.0", components: 389, buildComponents: 389 }),
  [],
  "matching version and count still registered as drift",
);
// A count-only drift (same version, different count) must ALSO be caught —
// the poller's whole reason for fetching the published index instead of
// stopping at the dist-tag is that a republish can reuse a version number
// over a changed index.
assert.deepEqual(
  driftOf({ version: "0.7.0", localVersion: "0.7.0", components: 380, buildComponents: 389 }).length,
  1,
  "a count-only drift with a matching version was not caught",
);

// --- injected Convex probe -----------------------------------------------
assert.equal(await probeConvex(async () => ({ ok: true })), true);
assert.equal(
  await probeConvex(async () => {
    throw new Error("no NEXT_PUBLIC_CONVEX_URL");
  }),
  null
);

console.log("status checks: pass");

if (process.argv.includes("--live")) {
  const { REGISTRY_ORIGIN } = await import("../lib/registry-origin.ts");
  const [origin, cli, mcp] = await Promise.all([
    fetchLiveOriginCount(REGISTRY_ORIGIN),
    fetchPublishedCli(),
    fetchPublishedMcp(),
  ]);
  console.log(`  live origin      ${origin ?? "unknown"}`);
  console.log(`  published cli    ${cli ? `${cli.version} · ${cli.components} components` : "unknown"}`);
  console.log(`  published mcp    ${mcp ? `${mcp.version} · ${mcp.components} components` : "unknown"}`);
}
