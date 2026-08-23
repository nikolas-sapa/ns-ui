// `/api/status-snapshot` — the sampler behind /status's 90-day daily-bar
// strip. Every call takes one measurement per service and adds it to that UTC
// day's row; the row keeps one bar per (day, service) however many times this
// runs, so calling it again by hand is safe.
//
// WHO CALLS IT, AND HOW OFTEN IT ACTUALLY RUNS — stated honestly, because a
// status page that overstates its own sampling rate is the exact failure this
// page exists to avoid:
//   .github/workflows/status-poll.yml   schedule `*/10 * * * *`. GitHub's own
//                                       floor is 5 minutes, and scheduled
//                                       workflows are queued on shared
//                                       infrastructure: runs are frequently
//                                       late and can be dropped entirely
//                                       during peak load. "Every 10 minutes"
//                                       is the request, not a guarantee.
//   vercel.json cron `0 6 * * *`        the fallback, once a day (the Hobby
//                                       plan's ceiling). It exists so a day
//                                       GitHub skipped is not a blank day.
// Neither caller is a heartbeat: the gap between two samples is unbounded, and
// the row's `sampleCount` is the only truthful record of how much was measured
// that day. Nothing here interpolates across a gap.
//
// WHAT IT MAY RECORD. Only what it measures in this request, right now. Every
// fetch below is `cache: "no-store"` and NOT the shared helper in
// lib/status-checks.ts: those pass `next: { revalidate: 3600 }`, so a daily job
// reusing them could stamp an hour-old value with this moment's timestamp — a
// measurement attributed to a time it did not happen. A check that cannot
// determine its state writes NOTHING; the day simply stays absent for that
// service and renders as NO DATA. There is no default state, no backfill, and
// no seeding anywhere in this file.
//
// WHY SO FEW STATES SURVIVE THAT RULE:
//   live-origin        the origin IS the service, so a 5xx from it is a real
//                      measurement of the service being down. A thrown fetch
//                      is not: it cannot distinguish an outage from this
//                      function's own network, so it records absence.
//   published-cli      one row per package, matching the two service ids
//   published-mcp      /status draws: the CLI and the MCP server are published
//                      separately and either can be stale while the other is
//                      current, so one package's read is never evidence about
//                      the other and a failed read for one leaves only that
//                      one's day absent. A bad response from
//                      registry.npmjs.org is a fact about npm, not about the
//                      package — recording "down" from it would be a
//                      fabricated measurement, so anything short of a clean
//                      read is absence. These rows CAN be DEGRADED here, same
//                      as on /status (see serviceChecks in
//                      lib/status-checks.ts, and the shared `driftOf` helper
//                      both this route and that module call so the two never
//                      state the same drift in different words): `build`
//                      below is a plain static import of
//                      lib/status.generated.json, the exact thing
//                      app/status/page.tsx does — a runtime cron reads the
//                      build-time facts fine, because they were baked into
//                      this function's bundle at build time, not read off a
//                      filesystem per request. What this route adds beyond
//                      that shared comparison is the SECOND network hop each
//                      package needs (the published component count, from
//                      unpkg — see `fetchPublishedComponents`), fetched
//                      `no-store` for the reason above: the page's own read of
//                      the same hop is cached an hour, which would attribute
//                      a stale count to this moment. Either hop failing
//                      leaves that package's day absent — never a guess, and
//                      never a silent fall-back to a version-only comparison:
//                      the 2026-08-20 incident had both a stale version AND a
//                      stale count, but the two are independent facts and a
//                      version-only check would miss a republish that reused
//                      an old version number over a changed index.
//   convex-read-path   resolves -> ok. Throws -> absence, for the same reason
//                      `RuntimeReads.convexReachable` is typed `true | null`
//                      rather than `boolean`: an outage and an unset
//                      NEXT_PUBLIC_CONVEX_URL are indistinguishable here.
//
// TWO GUARDS, NEITHER REDUNDANT. `CRON_SECRET` (sent automatically by Vercel
// cron as `Authorization: Bearer …`) gates this route. `STATUS_SNAPSHOT_SECRET`
// gates the Convex mutation itself, which is a public internet-facing endpoint
// that this route's guard does not stand in front of. Both unset = closed:
// the route refuses to write and says which variable is missing.
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import {
  CLI_INDEX_FILE,
  CLI_PACKAGE,
  driftOf,
  MCP_INDEX_FILE,
  MCP_PACKAGE,
} from "@/lib/status-checks";
import { submitBindingsMatch } from "@/lib/submit-oauth-cookies";
// The exact static import app/status/page.tsx uses. Generated by
// scripts/build-status.ts, chained into `npm run registry:build` before
// `next build` — the file exists on disk by the time this route is bundled,
// so this is baked into the function's output the same way the page's copy
// is, not a filesystem read at request time. See the header comment above.
import build from "@/lib/status.generated.json";

export const dynamic = "force-dynamic";
// NOT setting `maxDuration`: this deployment's actual function-duration
// ceiling is not confirmed from this worktree (vercel.json's once-a-day
// fallback cron and the header's "Hobby plan's ceiling" note are the only
// evidence, and neither pins a number), and requesting a `maxDuration` this
// tier cannot grant is worse than requesting none — it risks a deploy-time
// rejection of the whole route rather than a graceful clamp. If the timeout
// below turns out not to fit the real ceiling, that is a platform fact to go
// verify (`vercel functions inspect` or the dashboard), not one to guess at
// here.
//
// SIZE, NOT JUST LATENCY, IS THE REAL CONSTRAINT for the new two-hop package
// chains, and the numbers below are a FLOOR, not a budget: measured through
// this worktree's own network on 2026-08-20 (`curl -w '%{time_total}s
// %{size_download}B'`, no `--compressed`, so decompressed-equivalent bytes):
//   design.helpmarq.com/r/registry.json                    1.9 MB —  9-10s
//   unpkg …/ns-ui@0.7.0/data/registry-index.json          566 KB — <1s
//   unpkg …/ns-ui-mcp@0.6.0/data/registry-snapshot.json   9.0-12.0 MB — 9-17s
// (the MCP number is a range because two separate reads of the identical URL
// — this file's own curl and `npm run build`'s fetch of the same file — gave
// 8,980,103 and 11,974,538 bytes; the file is under active growth as
// components are added and neither figure should be trusted to the byte).
// Three unrelated CDN hosts all landing in the same 185-600 KB/s range reads
// as a throughput cap on THIS link, not evidence about those hosts — so
// treat every number above as "took at least this long here", not as what a
// Vercel-to-CDN hop costs in production.
//
// The one number this file controls in response is FETCH_TIMEOUT_MS, and it
// is chosen to be LEGIBLE, not generous: a timeout that fires BEFORE a
// suspected platform ceiling produces a reported, named `Skipped` — "so an
// operator can see WHY a bar is missing" (see `Skipped`'s doc comment below).
// A timeout set ABOVE that ceiling loses the race to the platform's own kill
// switch, which is silent: no skip entry, no reason, nothing in the
// response. 8s undercuts every ceiling this repo has evidence for (Hobby's
// suspected 10s, this file's own build-time 8s precedent in
// lib/status-checks.ts) at the cost of the MCP hop failing more often than a
// longer budget would allow — an acceptable trade, because a legible,
// frequent absence is what this route's whole design promises, and the
// per-service write restructuring below means one chain missing its budget
// costs only that chain: `live-origin` and `convex-read-path` still land.
// The actual fix — noted as the upgrade path in lib/status-checks.ts's
// `fetchPublishedIndex` — is publishing the component count into the
// packument itself, so this route never downloads the whole index; that is a
// publish-pipeline change this task's scope does not cover, and is named in
// the report as an owner decision rather than attempted here.

type Measurement = {
  serviceId: string;
  state: "ok" | "degraded" | "down";
  detail?: string;
};

/** A check that could not determine its state, and the reason — reported in
 *  the response so an operator can see WHY a bar is missing, and written
 *  nowhere, because absence is the recording. */
type Skipped = { serviceId: string; reason: string };

const NPM_REGISTRY = "https://registry.npmjs.org";

// One budget for every hop, including the multi-megabyte package index — see
// the header comment above for why this is deliberately tight rather than
// sized to the slowest observed download.
const FETCH_TIMEOUT_MS = 8_000;

async function checkLiveOrigin(): Promise<Measurement | Skipped> {
  const serviceId = "live-origin";
  try {
    const res = await fetch(`${REGISTRY_ORIGIN}/r/registry.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status >= 500) {
      // The origin answered, and what it answered with is a failure. This is
      // the one honest "down" this route can produce.
      return { serviceId, state: "down", detail: `origin answered ${res.status}` };
    }
    if (!res.ok) return { serviceId, reason: `origin answered ${res.status}` };
    const data: unknown = await res.json();
    const items = (data as { items?: unknown })?.items;
    if (!Array.isArray(items)) return { serviceId, reason: "registry index had no items array" };
    return { serviceId, state: "ok", detail: `${items.length} items in /r/registry.json` };
  } catch {
    // A throw cannot tell an outage from this function's own network.
    return { serviceId, reason: "the request threw; an outage and a network fault are indistinguishable" };
  }
}

async function distTagLatest(pkg: string): Promise<string | null> {
  try {
    const res = await fetch(`${NPM_REGISTRY}/${pkg}`, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const latest = (data as { "dist-tags"?: { latest?: unknown } })?.["dist-tags"]?.latest;
    return typeof latest === "string" ? latest : null;
  } catch {
    return null;
  }
}

/** The published package's own component count, read from the SAME resolved
 *  version `distTagLatest` returned — never a separately-cached read, for the
 *  same reason the whole file is `no-store`: a stale count attributed to this
 *  moment is a fabricated measurement. Deliberately NOT `fetchPublishedIndex`
 *  from lib/status-checks.ts, which caches with `next: { revalidate: 3600 }`. */
async function fetchPublishedComponents(pkg: string, indexFile: string, version: string): Promise<number | null> {
  try {
    const res = await fetch(`https://unpkg.com/${pkg}@${version}/${indexFile}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const components = (data as { components?: unknown })?.components;
    return Array.isArray(components) ? components.length : null;
  } catch {
    return null;
  }
}

/** One published package, one service id, one bar. The two calls are
 *  independent: a package whose dist-tag or component count could not be
 *  read leaves ITS day absent and says nothing about the other one.
 *
 *  Now measures drift, not just reachability: `localVersion` and
 *  `buildComponents` come from `lib/status.generated.json` (a static import,
 *  see the header comment), and `driftOf` — shared with §3 of /status — is
 *  the same comparison `packageCheck` renders there, so a degraded bar and a
 *  degraded §3 row for the same package always agree in wording. */
async function checkPublishedPackage(
  serviceId: string,
  pkg: string,
  indexFile: string,
  localVersion: string | null,
  buildComponents: number,
): Promise<Measurement | Skipped> {
  const version = await distTagLatest(pkg);
  if (version === null) {
    return { serviceId, reason: `npm dist-tags could not be read for ${pkg}` };
  }
  const components = await fetchPublishedComponents(pkg, indexFile, version);
  if (components === null) {
    // The version IS a real measurement, but a row can't state a drift on
    // half a comparison — see the identical judgment call in
    // lib/status-checks.ts's `packageCheck`. This package's day stays absent
    // rather than recording a version-only "ok" that could hide a drift.
    return {
      serviceId,
      reason: `npm serves ${pkg} at ${version}, but ${indexFile} inside that published version could not be read, so drift could not be evaluated`,
    };
  }

  const drifts = driftOf({ version, localVersion, components, buildComponents });

  return {
    serviceId,
    state: drifts.length > 0 ? "degraded" : "ok",
    detail:
      drifts.length > 0
        ? drifts.join("; ")
        : `npm dist-tags latest for ${pkg}: ${version}, and ${indexFile} indexes every component in this build`,
  };
}

async function checkConvexReadPath(): Promise<Measurement | Skipped> {
  const serviceId = "convex-read-path";
  try {
    await fetchQuery(api.testimonials.approved, {});
    return { serviceId, state: "ok", detail: "public unauthenticated query resolved" };
  } catch {
    return { serviceId, reason: "the query threw; a Convex outage and an unset NEXT_PUBLIC_CONVEX_URL are indistinguishable" };
  }
}

function isMeasurement(result: Measurement | Skipped): result is Measurement {
  return "state" in result;
}

type Outcome =
  | { kind: "recorded"; serviceId: string; state: string; result: string }
  | { kind: "skipped"; serviceId: string; reason: string }
  | { kind: "failed"; serviceId: string; error: string };

/**
 * Run one check and, if it measured something, write it — as ONE unit per
 * service, not as "measure all four, then write all four".
 *
 * Why this matters now and didn't before: two of the four chains can take
 * upwards of ten seconds (see the size note above `FETCH_TIMEOUT_MS`),
 * so `await Promise.all([...checks])` followed by a write loop means a slow
 * `published-mcp` fetch holds `live-origin`'s and `convex-read-path`'s
 * already-known results unwritten in memory for as long as it takes — and if
 * this function is killed by a platform duration ceiling before the slow
 * chain finishes, the fast ones' measurements are lost too, along with it.
 * Writing each result the moment its own chain resolves bounds that risk to
 * the slow chain itself: a killed function still leaves behind whatever had
 * already finished and been written.
 */
async function measureAndRecord(
  check: () => Promise<Measurement | Skipped>,
  snapshotSecret: string,
): Promise<Outcome> {
  const result = await check();
  if (!isMeasurement(result)) {
    return { kind: "skipped", serviceId: result.serviceId, reason: result.reason };
  }
  try {
    const written = await fetchMutation(api.status.record, {
      secret: snapshotSecret,
      serviceId: result.serviceId,
      state: result.state,
      ...(result.detail === undefined ? {} : { detail: result.detail }),
    });
    return { kind: "recorded", serviceId: result.serviceId, state: result.state, result: written.result };
  } catch (err) {
    // A measurement that could not be stored is reported, never retried into
    // a different day and never silently downgraded to "ok".
    console.error("status-snapshot: write failed", result.serviceId, err);
    return { kind: "failed", serviceId: result.serviceId, error: String(err) };
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET ?? "";
  const snapshotSecret = process.env.STATUS_SNAPSHOT_SECRET ?? "";

  // Refuse loudly and name the missing variable. A silent 200 here would leave
  // the strip permanently empty with nothing saying why.
  const missing = [
    cronSecret.length === 0 ? "CRON_SECRET" : null,
    snapshotSecret.length === 0 ? "STATUS_SNAPSHOT_SECRET" : null,
  ].filter((name): name is string => name !== null);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        wrote: false,
        error: `refusing to write: ${missing.join(" and ")} unset on this deployment`,
      },
      { status: 500 },
    );
  }

  // Constant-time compare (reuses `submitBindingsMatch` rather than a second
  // implementation, same helper `lib/submit-oauth-cookies.ts` uses for its
  // own header check) — a plain `!==` leaks timing on how many leading
  // characters matched. A length mismatch short-circuits `submitBindingsMatch`
  // itself, which is fine here: a wrong-length guess is already distinguishable
  // by its length, not by a timing side-channel.
  if (!submitBindingsMatch(request.headers.get("authorization") ?? "", `Bearer ${cronSecret}`)) {
    return NextResponse.json({ ok: false, wrote: false, error: "unauthorized" }, { status: 401 });
  }

  // `allSettled`, not `all`: `measureAndRecord` never rejects by construction
  // (every check catches internally, the write is try/catched), but that is
  // an invariant of code someone can change later without noticing that
  // `Promise.all` would then let one unexpected throw take the whole batch's
  // results down with it — exactly the failure mode the per-service write
  // restructuring above exists to avoid. A rejection here is treated as a
  // programmer error, not a measurement, and reported by its position rather
  // than invented a service id for.
  const labels = ["live-origin", "convex-read-path", "published-cli", "published-mcp"];
  const settled = await Promise.allSettled([
    measureAndRecord(checkLiveOrigin, snapshotSecret),
    measureAndRecord(checkConvexReadPath, snapshotSecret),
    measureAndRecord(
      () => checkPublishedPackage("published-cli", CLI_PACKAGE, CLI_INDEX_FILE, build.cliVersionLocal, build.components),
      snapshotSecret,
    ),
    measureAndRecord(
      () => checkPublishedPackage("published-mcp", MCP_PACKAGE, MCP_INDEX_FILE, build.mcpVersionLocal, build.components),
      snapshotSecret,
    ),
  ]);

  const outcomes: Outcome[] = settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { kind: "failed", serviceId: labels[i], error: String(s.reason) },
  );

  const recorded = outcomes
    .filter((o): o is Extract<Outcome, { kind: "recorded" }> => o.kind === "recorded")
    .map(({ serviceId, state, result }) => ({ serviceId, state, result }));
  const skipped = outcomes
    .filter((o): o is Extract<Outcome, { kind: "skipped" }> => o.kind === "skipped")
    .map(({ serviceId, reason }) => ({ serviceId, reason }));
  const failed = outcomes
    .filter((o): o is Extract<Outcome, { kind: "failed" }> => o.kind === "failed")
    .map(({ serviceId, error }) => ({ serviceId, error }));

  return NextResponse.json(
    { ok: failed.length === 0, recorded, skipped, failed },
    { status: failed.length === 0 ? 200 : 500 },
  );
}
