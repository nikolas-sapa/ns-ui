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
import { unstable_cache } from "next/cache";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import build from "@/lib/status.generated.json";
import {
  CLI_PACKAGE,
  MCP_PACKAGE,
  fetchLiveOriginCount,
  fetchPublishedCli,
  fetchPublishedMcp,
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
  alternates: { canonical: "/status" },
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
 *
 * `fetchQuery` talks to Convex over its own HTTP transport, not Next's
 * patched `fetch` — so it carries no cache config Next can see, and a live
 * `NEXT_PUBLIC_CONVEX_URL` opts this whole route OUT of static/ISR rendering
 * (verified: the route table reads `● /status` with the env var unset, `ƒ`
 * with it set to a real host). `export const revalidate` above then does
 * nothing, and every visitor pays for a Convex round-trip in their own
 * request. Wrapping the call in `unstable_cache` moves the read into Next's
 * data cache instead: the first request after the window pays for it, every
 * later one reads a cached value while Next revalidates in the background,
 * and the page itself goes back to being static.
 */
const cachedHistory = unstable_cache(
  async (): Promise<HistoryEntry[]> => {
    try {
      const rows = await fetchQuery(api.status.recent, {});
      return Array.isArray(rows) ? rows : [];
    } catch {
      // An absent module, an unset NEXT_PUBLIC_CONVEX_URL and a real outage are
      // indistinguishable here, and all three mean the same thing for the strip:
      // there is no recorded history to draw. Never a green day.
      return [];
    }
  },
  ["status-convex-history"],
  { revalidate: 3600 }
);

async function fetchHistory(): Promise<HistoryEntry[]> {
  return cachedHistory();
}

/** Same reasoning as `cachedHistory` above, for the other Convex read this
 *  page makes: `probeConvex` still owns the try/catch (a cache miss that
 *  throws must still collapse to UNKNOWN, never DOWN), this only keeps the
 *  read itself off the request path. */
const cachedTestimonialsApproved = unstable_cache(
  () => fetchQuery(api.testimonials.approved, {}),
  ["status-convex-testimonials-approved"],
  { revalidate: 3600 }
);

/**
 * The board's rows, in declaration order. Each id is the check id
 * lib/status-checks.ts already uses, and the `serviceId` the snapshot job
 * writes against. `services` is THIS render's live read (the same array
 * `bannerState()` ranks for the headline above) — each row carries its own
 * slice of it as `live`, so a card can never show a stale "operational" while
 * the banner it sits under says "Degraded" for that exact check. See the
 * "now" vs. "last recorded day" split in `ServiceCard`.
 */
function serviceRows(services: StatusCheck[]): ServiceRow[] {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const liveOf = (id: string): { state: CheckState; detail: string } => {
    const check = services.find((c) => c.id === id);
    // Every id below is one `serviceChecks()` always returns, so this is
    // reachable only if a row here and the check array in lib/status-checks.ts
    // have drifted apart — fail loudly rather than render a fabricated OK.
    if (!check) throw new Error(`serviceRows: no live check found for "${id}"`);
    return { state: check.state, detail: check.detail };
  };
  return [
    {
      id: "live-origin",
      name: "Registry origin",
      subtitle: hostOf(REGISTRY_ORIGIN),
      live: liveOf("live-origin"),
    },
    {
      id: "convex-read-path",
      name: "Convex read path",
      // No identifier rather than an empty one when the URL is unset.
      subtitle: convexUrl ? hostOf(convexUrl) : undefined,
      live: liveOf("convex-read-path"),
    },
    // The CLI and the MCP server are published separately from separate
    // package.json files and can be stale independently, so they are two
    // services, not one row averaging both.
    {
      id: "published-cli",
      name: "Published CLI package",
      subtitle: CLI_PACKAGE,
      note: SPLIT_NOTE,
      live: liveOf("published-cli"),
    },
    {
      id: "published-mcp",
      name: "Published MCP package",
      subtitle: MCP_PACKAGE,
      note: SPLIT_NOTE,
      live: liveOf("published-mcp"),
    },
  ];
}

/**
 * Both package strips start empty, and this says so on the card.
 *
 * The snapshots recorded before the split sit under the service id
 * `published-packages`, a single check that read both packages' dist-tags
 * together and recorded a state only when BOTH read cleanly. Those rows are
 * untouched in Convex and are not copied under either new id: a day that check
 * marked operational is one measurement of two packages, and rendering it twice
 * would show two bars where one reading happened. So the old history is
 * declared here rather than redrawn, and each new strip fills in from its own
 * first recorded day.
 */
const SPLIT_NOTE =
  "This strip starts empty. Days before this package got its own check were recorded against a single combined published-packages check that read both packages together and could not tell them apart, so they are not redrawn as if this package had been measured on its own.";

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
  // Each package is read twice and independently: its own dist-tag, and the
  // component index inside its own published tarball. The bare version reads
  // are what let a row say "npm serves it at 0.4.0, but its index did not
  // parse" instead of collapsing both failures into one blank UNKNOWN.
  const [
    liveOriginCount,
    cli,
    mcp,
    cliVersionOnly,
    mcpVersionOnly,
    convexReachable,
    history,
  ] = await Promise.all([
    fetchLiveOriginCount(REGISTRY_ORIGIN),
    fetchPublishedCli(),
    fetchPublishedMcp(),
    fetchPublishedVersion(CLI_PACKAGE),
    fetchPublishedVersion(MCP_PACKAGE),
    // The public, unauthenticated query — the only Convex read this page is
    // entitled to make. A throw is "we could not look", never "Convex is down".
    probeConvex(cachedTestimonialsApproved),
    // Isolated: a missing history module must leave the page standing.
    fetchHistory(),
  ]);

  const now = new Date().toISOString();
  const integrity = integrityChecks(buildData, cli?.components ?? null, now);
  const services = serviceChecks(
    buildData,
    {
      liveOriginCount,
      cliVersionPublished: cli?.version ?? cliVersionOnly,
      cliComponentsPublished: cli?.components ?? null,
      mcpVersionPublished: mcp?.version ?? mcpVersionOnly,
      mcpComponentsPublished: mcp?.components ?? null,
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
  const rows = serviceRows(services);

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
        <span className="break-words font-mono text-foreground">{REGISTRY_ORIGIN}/r/registry.json</span>,
        the npm dist-tag and the published component index of{" "}
        <span className="font-mono text-foreground">{CLI_PACKAGE}</span> and of{" "}
        <span className="font-mono text-foreground">{MCP_PACKAGE}</span> — each package
        read from its own tarball, never from the other&rsquo;s — and one public
        Convex query, refreshed hourly. The daily bars come from recorded
        snapshots only; days before recording began stay grey.
      </p>
    </main>
  );
}
