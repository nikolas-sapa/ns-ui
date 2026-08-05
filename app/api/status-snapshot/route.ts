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
//                      read is absence. Note these rows can be DEGRADED on
//                      /status (version drift, see serviceChecks in
//                      lib/status-checks.ts) but never here: drift is a
//                      comparison against the build-time versions in
//                      lib/status.generated.json, which a runtime cron does
//                      not have. `state: "ok"` here means the dist-tag read
//                      cleanly, and `detail` names the exact version read.
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
import { CLI_PACKAGE, MCP_PACKAGE } from "@/lib/status-checks";

export const dynamic = "force-dynamic";

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

async function checkLiveOrigin(): Promise<Measurement | Skipped> {
  const serviceId = "live-origin";
  try {
    const res = await fetch(`${REGISTRY_ORIGIN}/r/registry.json`, {
      cache: "no-store",
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
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const latest = (data as { "dist-tags"?: { latest?: unknown } })?.["dist-tags"]?.latest;
    return typeof latest === "string" ? latest : null;
  } catch {
    return null;
  }
}

/** One published package, one service id, one bar. The two calls are
 *  independent: a package whose dist-tag could not be read leaves ITS day
 *  absent and says nothing about the other one. */
async function checkPublishedPackage(
  serviceId: string,
  pkg: string,
): Promise<Measurement | Skipped> {
  const version = await distTagLatest(pkg);
  if (version === null) {
    return { serviceId, reason: `npm dist-tags could not be read for ${pkg}` };
  }
  // The caveat travels with the row, not just with this comment: whoever reads
  // the bar sees why an "ok" here is narrower than an "ok" in §3 of /status.
  return {
    serviceId,
    state: "ok",
    detail: `npm dist-tags latest for ${pkg}: ${version}; drift vs this repo not evaluated`,
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

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, wrote: false, error: "unauthorized" }, { status: 401 });
  }

  const results = await Promise.all([
    checkLiveOrigin(),
    checkConvexReadPath(),
    checkPublishedPackage("published-cli", CLI_PACKAGE),
    checkPublishedPackage("published-mcp", MCP_PACKAGE),
  ]);

  const recorded: Array<{ serviceId: string; state: string; result: string }> = [];
  const skipped: Skipped[] = [];
  const failed: Array<{ serviceId: string; error: string }> = [];

  for (const result of results) {
    if (!isMeasurement(result)) {
      skipped.push(result);
      continue;
    }
    try {
      const written = await fetchMutation(api.status.record, {
        secret: snapshotSecret,
        serviceId: result.serviceId,
        state: result.state,
        ...(result.detail === undefined ? {} : { detail: result.detail }),
      });
      recorded.push({ serviceId: result.serviceId, state: result.state, result: written.result });
    } catch (err) {
      // A measurement that could not be stored is reported, never retried into
      // a different day and never silently downgraded to "ok".
      console.error("status-snapshot: write failed", result.serviceId, err);
      failed.push({ serviceId: result.serviceId, error: String(err) });
    }
  }

  return NextResponse.json(
    { ok: failed.length === 0, recorded, skipped, failed },
    { status: failed.length === 0 ? 200 : 500 },
  );
}
