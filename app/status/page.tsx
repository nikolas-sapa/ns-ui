/**
 * /status — an answer sheet, not a system-status board.
 *
 * There is no uptime percentage, no availability history, no incident log and
 * no "All systems operational" banner on this page, and their absence is the
 * design. Nothing in this repo stores a time series, so every one of those
 * would be a number invented at render time. Worse: both real incidents this
 * registry has had — 72 preview videos named with pre-rename slugs, and a
 * published CLI index behind the site — returned HTTP 200 from every system
 * involved. A conventional status page would have been green through both.
 *
 * So the first viewport asks four questions a consumer actually has, and
 * answers each in one sentence. The ledger underneath carries the evidence:
 * a state word, the provenance of the number, and the number.
 *
 * All of the measuring lives in lib/status-checks.ts. This route fetches, and
 * lays out what comes back.
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
  type StatusBuild,
} from "@/lib/status-checks";
import { answers } from "./answers";
import { LedgerSection, stamp } from "./ledger";

const title = "Status";
const description =
  "What is actually working in ns-ui, measured: whether a component installs, whether an agent can read the registry, and what this repo cannot measure at all.";

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

export default async function StatusPage() {
  const [liveOriginCount, cli, mcpVersionPublished, convexReachable] = await Promise.all([
    fetchLiveOriginCount(REGISTRY_ORIGIN),
    fetchPublishedCli(),
    fetchPublishedVersion(MCP_PACKAGE),
    // The public, unauthenticated query — the only Convex read this page is
    // entitled to make. A throw is "we could not look", never "Convex is down".
    probeConvex(() => fetchQuery(api.testimonials.approved, {})),
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
  const notMeasured = notMeasuredChecks(buildData.builtAt);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-32 sm:px-10">
      <header className="pt-20 sm:pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          ns-ui / status
        </p>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          What is actually working.
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-7 text-muted">
          Four questions, answered from measurements rather than from a
          heartbeat. Every failure this registry has had returned HTTP 200, so
          there is no uptime figure here, no incident log and no green banner —
          nothing on this page is stored over time, and anything that cannot be
          measured says so.
        </p>
      </header>

      <section className="mt-16 border-t border-border">
        {answers(buildData, integrity, services).map((a) => (
          <div key={a.id} className="border-b border-border py-8">
            <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
              {a.question}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted">{a.answer}</p>
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

      <p className="mt-16 max-w-2xl border-t border-border pt-6 text-sm leading-6 text-muted">
        Build measurements were taken at {stamp(buildData.builtAt)} by{" "}
        <span className="font-mono text-foreground">scripts/build-status.ts</span> and
        ship with this deployment. Live reads come from{" "}
        <span className="font-mono text-foreground">{REGISTRY_ORIGIN}/r/registry.json</span>,
        the npm dist-tags for{" "}
        <span className="font-mono text-foreground">{CLI_PACKAGE}</span> and{" "}
        <span className="font-mono text-foreground">{MCP_PACKAGE}</span>, and one public
        Convex query, refreshed hourly.
      </p>
    </main>
  );
}
