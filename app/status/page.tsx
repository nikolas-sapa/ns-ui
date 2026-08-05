/**
 * /status — a service board on top, the answer sheet underneath.
 *
 * The board is conventional in shape and unconventional in what it refuses to
 * do. The banner states the worst state among the live reads taken for THIS
 * render, and nothing else; the ninety-day strips under it are drawn purely
 * from recorded snapshots, so every day before recording began is grey and
 * stays grey. Nothing is seeded, nothing is backfilled, and an uptime figure
 * only appears once there is at least one recorded day to compute it from —
 * with its denominator printed next to it.
 *
 * The answers below the board are the part that catches what a board cannot.
 * Both real incidents this registry has had — 72 preview videos named with
 * pre-rename slugs, a published CLI index behind the site — returned HTTP 200
 * from every system involved, so the strips would have been green through both
 * of them. That is why the questions stayed, and why the "not measured" list
 * stayed with them.
 *
 * All of the measuring lives in lib/status-checks.ts and in the Convex history
 * query. This route fetches, and lays out what comes back.
 */
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import build from "@/lib/status.generated.json";
import {
  CLI_PACKAGE,
  MCP_PACKAGE,
  fetchLiveOriginCount,
  fetchPublishedCli,
  fetchPublishedVersion,
  integrityChecks,
  notMeasuredChecks,
  probeConvex,
  serviceChecks,
  type CheckState,
  type StatusBuild,
  type StatusCheck,
} from "@/lib/status-checks";
import { answers } from "./answers";
import { LedgerSection, stamp } from "./ledger";
import {
  BarLegend,
  OverallBanner,
  ServiceCard,
  dayWindow,
  type BannerState,
  type HistoryEntry,
  type ServiceRow,
} from "./uptime";

const title = "Status";
const description =
  "What is actually working in ns-ui, measured: ninety days of recorded snapshots, whether a component installs, whether an agent can read the registry, and what this repo cannot measure at all.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
};

/** Hourly, matching the `revalidate` the network reads in lib/status-checks.ts
 *  already ask for. A shorter window would re-hit npm and unpkg for numbers
 *  that move on release cadence, not on the minute. */
export const revalidate = 3600;

const buildData: StatusBuild = build;

/**
 * The daily snapshot history: `recent` in convex/status.ts, the public,
 * unauthenticated read of the last 90 UTC days. It returns only the rows that
 * exist and never pads the window, which is what lets every unrecorded day
 * below render as NO DATA rather than as anything.
 *
 * Read through the generated `api` object on purpose: a wrong function name or
 * a changed argument shape fails the build instead of failing silently as a
 * board of permanently grey bars.
 */
async function fetchHistory(): Promise<HistoryEntry[]> {
  try {
    const rows = await fetchQuery(api.status.recent, {});
    return Array.isArray(rows) ? rows : [];
  } catch {
    // An absent module, an unset NEXT_PUBLIC_CONVEX_URL and a real outage are
    // indistinguishable here, and all three mean the same thing for the strip:
    // there is no recorded history to draw. Never a green day.
    return [];
  }
}

/** The board's rows, in declaration order. Each id is the check id
 *  lib/status-checks.ts already uses, and the `serviceId` the snapshot job
 *  writes against. */
function serviceRows(): ServiceRow[] {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  return [
    {
      id: "live-origin",
      name: "Registry origin",
      subtitle: hostOf(REGISTRY_ORIGIN),
    },
    {
      id: "convex-read-path",
      name: "Convex read path",
      // No identifier rather than an empty one when the URL is unset.
      subtitle: convexUrl ? hostOf(convexUrl) : undefined,
    },
    {
      id: "published-packages",
      name: "Published packages",
      subtitle: `${CLI_PACKAGE} · ${MCP_PACKAGE}`,
    },
  ];
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

const RANK: Record<CheckState, number> = { down: 0, degraded: 1, unknown: 2, ok: 3 };

/** The banner adopts the worst live state. `unknown` is never rounded up into
 *  green: a read that did not come back is not a service that is fine. */
function bannerState(services: StatusCheck[]): BannerState {
  if (services.length === 0) return "unknown";
  const worst = services.reduce(
    (a, b) => (RANK[a.state] <= RANK[b.state] ? a : b),
    services[0]
  ).state;
  return worst;
}

const BANNER_CAPTION: Record<BannerState, string> = {
  ok: "Every live read taken for this page came back clean.",
  degraded:
    "At least one live read came back with drift — the rows below name which, and what it costs.",
  down: "At least one live read failed outright. The rows below name which.",
  unknown:
    "At least one live read did not come back, so its service is unproven rather than fine.",
};

export default async function StatusPage() {
  const [liveOriginCount, cli, mcpVersionPublished, convexReachable, history] =
    await Promise.all([
      fetchLiveOriginCount(REGISTRY_ORIGIN),
      fetchPublishedCli(),
      fetchPublishedVersion(MCP_PACKAGE),
      // The public, unauthenticated query — the only Convex read this page is
      // entitled to make. A throw is "we could not look", never "Convex is down".
      probeConvex(() => fetchQuery(api.testimonials.approved, {})),
      // Isolated: a missing history module must leave the page standing.
      fetchHistory(),
    ]);

  const now = new Date().toISOString();
  const integrity = integrityChecks(buildData, cli?.components ?? null, now);
  const services = serviceChecks(
    buildData,
    {
      liveOriginCount,
      cliVersionPublished: cli?.version ?? null,
      mcpVersionPublished,
      convexReachable,
    },
    now
  );
  // `uptime-history` is dropped: it claims no time-series store exists, and the
  // strips above are that store. Everything else in the list is still true —
  // there is no incident log, no latency percentiles, no deployment state.
  const notMeasured = notMeasuredChecks(buildData.builtAt).filter(
    (c) => c.id !== "uptime-history"
  );
  const banner = bannerState(services);
  const days = dayWindow();
  const rows = serviceRows();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-32 sm:px-10">
      <header className="pt-20 sm:pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
          ns-ui / status
        </p>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          What is actually working.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-7 text-ns-muted">
          The banner states the worst of the live reads taken for this page. The
          strips under it are drawn only from snapshots that were recorded — a
          day with no snapshot is grey, nothing is backfilled, and an uptime
          figure appears only once there is a recorded day behind it. Because
          every failure this registry has had returned HTTP 200, the questions
          further down carry the part a green strip cannot.
        </p>
      </header>

      <div className="mt-12">
        <OverallBanner
          state={banner}
          caption={`${BANNER_CAPTION[banner]} Read at ${stamp(now)}.`}
        />
      </div>

      <div className="mt-6 grid gap-4">
        {rows.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            days={days}
            history={history}
          />
        ))}
      </div>

      <div className="mt-4">
        <BarLegend />
      </div>

      <section className="mt-20 border-t border-border">
        {answers(buildData, integrity, services).map((a) => (
          <div key={a.id} className="border-b border-border py-8">
            <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
              {a.question}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-ns-muted">{a.answer}</p>
          </div>
        ))}
      </section>

      <LedgerSection
        heading="Measured from this build"
        at={buildData.builtAt}
        checks={integrity}
      />
      <LedgerSection heading="Read live" at={services[0]?.measuredAt} checks={services} />
      <LedgerSection heading="Not measured, and why" checks={notMeasured} />

      <p className="mt-16 max-w-2xl border-t border-border pt-6 text-sm leading-6 text-ns-muted">
        Build measurements were taken at {stamp(buildData.builtAt)} by{" "}
        <span className="font-mono text-foreground">scripts/build-status.ts</span> and
        ship with this deployment. Live reads come from{" "}
        <span className="font-mono text-foreground">{REGISTRY_ORIGIN}/r/registry.json</span>,
        the npm dist-tags for{" "}
        <span className="font-mono text-foreground">{CLI_PACKAGE}</span> and{" "}
        <span className="font-mono text-foreground">{MCP_PACKAGE}</span>, and one public
        Convex query, refreshed hourly. The daily bars come from recorded
        snapshots only; days before recording began stay grey.
      </p>
    </main>
  );
}
