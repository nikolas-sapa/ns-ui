/**
 * The /status check layer: every claim the page can make, as data.
 *
 * Two kinds of check live here and they are never merged, because they are
 * measured at different moments by different means:
 *
 *   BUILD-TIME  filesystem facts, produced by scripts/build-status.ts into
 *               lib/status.generated.json. Their `measuredAt` is that file's
 *               `builtAt` — never render time. A filesystem check stamped
 *               with the moment the page rendered claims a measurement that
 *               did not happen then.
 *   RUNTIME     network reads, performed per ISR revalidation. Their
 *               `measuredAt` is the moment the fetch resolved.
 *
 * Nothing in this module reads the filesystem or imports the generated JSON:
 * the build data arrives as a parameter, so a plain `node` script can import
 * and exercise these functions (see scripts/test-status-checks.ts) and the
 * page can pass a static import. This module has NO imports at all, in fact:
 * the Convex probe is injected and the registry origin is passed in, because
 * no other bundled module in this repo imports a sibling with an explicit
 * `.ts` extension and node's type stripping requires one. Zero imports means
 * the question never arises.
 *
 * STATE VOCABULARY — four states, and the difference between the last two is
 * the point of the page:
 *
 *   ok        HEALTHY. Renders as silence: no colour, no left rule, one line.
 *   degraded  DRIFT. Accent blue. Queued work, not alarm. Amber is banned.
 *   down      FAILED. `--error`, and only here. Currently wrong in production.
 *   unknown   We could not look. Dashed rule, em dash in the value column,
 *             always a reason. NEVER rendered as a failure and never as a
 *             number. "The thing is broken" and "we could not look" are
 *             different states.
 *
 * There is deliberately no `up`/`success` state and no green: `--success`
 * exists in globals.css and is not used on this page. Colour on the many
 * fine rows destroys the signal from the few bad ones.
 */
export type CheckState = "ok" | "degraded" | "down" | "unknown";

export type StatusCheck = {
  /** Stable slug, safe as a React key and as a test assertion target. */
  id: string;
  label: string;
  state: CheckState;
  /**
   * On a non-ok row, the consequence — what is actually wrong for a user,
   * in plain words. On an ok row, the source of the number. On an unknown
   * row, why it cannot be known. Never empty.
   */
  detail: string;
  /**
   * The value column. A string because several rows are compound
   * (`222 pairs · 888 entries · 0 broken`) and because an unknown row's
   * value is a literal em dash, never a number and never a word.
   */
  value: string;
  /** ISO 8601. Build data carries `builtAt`; runtime data carries fetch time. */
  measuredAt: string;
};

/** The flat object scripts/build-status.ts emits. */
export type StatusBuild = {
  builtAt: string;
  components: number;
  llmsBlocks: number | null;
  llmsFullBlocks: number | null;
  snapshotComponents: number | null;
  payloadsOk: number;
  payloadsTotal: number;
  redirectPairs: number;
  redirectEntries: number;
  redirectBrokenTargets: number;
  postersOk: number;
  postersTotal: number;
  previewsOk: number;
  previewsTotal: number;
  previewFilesPresent: number;
  screenshotsOk: number;
  screenshotsTotal: number;
  metaOk: number;
  metaTotal: number;
  cliVersionLocal: string | null;
  mcpVersionLocal: string | null;
};

export const EM_DASH = "—";

/**
 * Severity ordering for the ledger. `unknown` sits between the broken states
 * and the clean ones: it is not a failure, but it is not a pass either, and
 * burying it under the clean rows would let an unread check read as fine.
 */
const SEVERITY_RANK: Record<CheckState, number> = {
  down: 0,
  degraded: 1,
  unknown: 2,
  ok: 3,
};

/**
 * Severity-descending, declaration order preserved within a tier.
 *
 * The spec calls this "severity-descending, then alphabetical", but its own
 * clean tier is ordered install payloads → rename redirects → meta.json →
 * featured posters, which is not alphabetical. The numbered list is the
 * authority, so the tie-break is the order the rows are declared in below,
 * which reproduces it exactly. A stable sort is what makes that work.
 */
function bySeverity(checks: StatusCheck[]): StatusCheck[] {
  return [...checks].sort(
    (a, b) => SEVERITY_RANK[a.state] - SEVERITY_RANK[b.state]
  );
}

/**
 * A coverage row: clean when everything passes, otherwise the severity the
 * check declares for itself.
 *
 * Severity is declared per check and never inferred from the numbers. What is
 * measured is whether the check passes; how much a failure matters is a
 * judgement about consequence, and encoding it here keeps the ledger honest
 * when a count moves.
 */
function coverage(args: {
  id: string;
  label: string;
  ok: number;
  total: number;
  /** State when ok < total. */
  severity: Extract<CheckState, "degraded" | "down">;
  /** Shown when broken: what this costs a user. */
  consequence: string;
  /** Shown when clean: where the number came from. */
  source: string;
  /**
   * Divide both numerals by this before rendering. Only `featured-previews`
   * uses it: the measurement is per file (slug x theme), but the consequence
   * is per card, so the row reads `0 / 36` while the JSON stays `0 / 72`.
   * The state is decided on the raw numbers — one missing file out of two
   * still breaks that card.
   */
  per?: number;
  measuredAt: string;
}): StatusCheck {
  const clean = args.ok === args.total;
  const per = args.per ?? 1;
  return {
    id: args.id,
    label: args.label,
    state: clean ? "ok" : args.severity,
    detail: clean ? args.source : args.consequence,
    value: `${Math.floor(args.ok / per)} / ${args.total / per}`,
    measuredAt: args.measuredAt,
  };
}

/** An UNKNOWN row: absence, stated, with the reason named. */
export function unknownCheck(
  id: string,
  label: string,
  reason: string,
  measuredAt: string
): StatusCheck {
  return { id, label, state: "unknown", detail: reason, value: EM_DASH, measuredAt };
}

// -------------------------------------------------------------------------
// §2 INTEGRITY — the ledger. Build-time only, except row 2.
// -------------------------------------------------------------------------

/**
 * `publishedComponents` is R2's count, from the published CLI package's own
 * `data/registry-index.json`. `null` (either npm hop failed) collapses that
 * one row to UNKNOWN rather than guessing a number or reporting a failure.
 *
 * It is NOT read from mcp/data/registry-snapshot.json: that file is
 * regenerated by `npm run registry:build` and therefore always reflects HEAD,
 * never what shipped.
 */
export function integrityChecks(
  build: StatusBuild,
  publishedComponents: number | null,
  runtimeMeasuredAt: string
): StatusCheck[] {
  const at = build.builtAt;

  const publishedCoverage: StatusCheck =
    publishedComponents === null
      ? unknownCheck(
          "published-tooling-coverage",
          "published tooling coverage",
          "the published package index could not be read; npm or unpkg did not answer",
          runtimeMeasuredAt
        )
      : coverage({
          id: "published-tooling-coverage",
          label: "published tooling coverage",
          ok: publishedComponents,
          total: build.components,
          severity: "degraded",
          // Symmetric wording on purpose: the published index can lead this
          // build (a publish landed after it, or components were deleted), and
          // a subtraction phrased one way renders "-5 components are absent".
          consequence: `${publishedComponents} components in the published CLI package vs ${build.components} in this build`,
          source: "the published CLI package indexes every component in this build",
          // The count comes from the npm hops, so it is a runtime measurement
          // even though it is divided by a build-time total.
          measuredAt: runtimeMeasuredAt,
        });

  return bySeverity([
    // Verified live: featured-card.tsx requests /previews/<slug>-<theme>.mp4,
    // and the 72 files in public/previews are named with pre-rename slugs, so
    // not one of them resolves. Unlike public/r/, public/previews/ is in
    // neither .gitignore nor .vercelignore, so the stale files ship.
    coverage({
      id: "featured-previews",
      label: "featured previews",
      ok: build.previewsOk,
      total: build.previewsTotal,
      severity: "down",
      consequence: "every featured card silently falls back to its poster",
      source: "every featured card has both preview videos",
      per: 2, // files measured, cards reported
      measuredAt: at,
    }),
    publishedCoverage,
    coverage({
      id: "screenshot-gate",
      label: "screenshot gate",
      ok: build.screenshotsOk,
      total: build.screenshotsTotal,
      severity: "degraded",
      consequence: `${build.screenshotsTotal - build.screenshotsOk} newest components are not yet gated by scripts/verify.ts`,
      source: "every component carries the light and dark screenshots verify.ts gates on",
      measuredAt: at,
    }),
    // Not "the URL resolves" — each payload is parsed and every file body is
    // asserted non-empty. Still not a claim that `npx shadcn add` succeeds.
    coverage({
      id: "install-payloads",
      label: "install payloads",
      ok: build.payloadsOk,
      total: build.payloadsTotal,
      severity: "down",
      consequence: `${build.payloadsTotal - build.payloadsOk} install payloads are missing, unparseable, or carry an empty file`,
      source: "every payload parses and carries non-empty file contents",
      measuredAt: at,
    }),
    {
      id: "rename-redirects",
      label: "rename redirects",
      state: build.redirectBrokenTargets === 0 ? "ok" : "down",
      detail:
        build.redirectBrokenTargets === 0
          ? "every renamed slug still resolves to a component that exists"
          : `${build.redirectBrokenTargets} redirects point at components that no longer exist`,
      value: `${build.redirectPairs} pairs · ${build.redirectEntries} entries · ${build.redirectBrokenTargets} broken`,
      measuredAt: at,
    },
    coverage({
      id: "meta-completeness",
      label: "meta.json completeness",
      ok: build.metaOk,
      total: build.metaTotal,
      severity: "degraded",
      consequence: `${build.metaTotal - build.metaOk} components are missing a required meta.json field`,
      source: "every component declares all seven fields verify.ts requires",
      measuredAt: at,
    }),
    coverage({
      id: "featured-posters",
      label: "featured posters",
      ok: build.postersOk,
      total: build.postersTotal,
      severity: "down",
      consequence: "featured cards with no poster render an empty frame",
      source: "every featured card has both posters",
      measuredAt: at,
    }),
  ]);
}

// -------------------------------------------------------------------------
// §3 SERVICES — runtime. Caveats are always present, even when clean.
// -------------------------------------------------------------------------

export type RuntimeReads = {
  /** R1: items.length from the live origin's /r/registry.json. */
  liveOriginCount: number | null;
  /** R2a: dist-tags.latest for the CLI package. */
  cliVersionPublished: string | null;
  /**
   * R2b: components.length inside THAT resolved CLI version's own
   * `data/registry-index.json`. Optional and defaulting to null, because a
   * caller that only read the version has not read the count, and the row
   * must say so rather than assume it.
   */
  cliComponentsPublished?: number | null;
  /** R3: dist-tags.latest for the MCP package. */
  mcpVersionPublished: string | null;
  /** R3b: components.length inside THAT resolved MCP version's own
   *  `data/registry-snapshot.json`. Never inferred from the CLI's file. */
  mcpComponentsPublished?: number | null;
  /**
   * R4: did the public unauthenticated Convex query resolve? `null` means the
   * call threw — which is NOT the same as Convex being down, see below.
   * Deliberately `true | null`, never `boolean`: there is no measurement this
   * layer can make that means "down", so the type refuses to let a caller
   * state one.
   */
  convexReachable: true | null;
};

export function serviceChecks(
  build: StatusBuild,
  runtime: RuntimeReads,
  measuredAt: string
): StatusCheck[] {
  const liveOrigin: StatusCheck =
    runtime.liveOriginCount === null
      ? unknownCheck(
          "live-origin",
          "live origin",
          "the registry index could not be fetched; fetched from /r/registry.json, revalidated hourly",
          measuredAt
        )
      : {
          id: "live-origin",
          label: "live origin",
          // Two outcomes only: the number, or UNKNOWN. Production disagreeing
          // with this build is a real fact, but it is §1's — the read-back row
          // renders the diverging numeral in --error and captions which
          // artifact diverged. Flagging it here too would paint one claim blue
          // in §3 and red in §1.
          state: "ok",
          detail: "fetched from /r/registry.json, revalidated hourly",
          value: `${runtime.liveOriginCount} items`,
          measuredAt,
        };

  // A throw here is UNKNOWN and never FAILED. fetchQuery throws identically on
  // a real Convex outage and on an unset NEXT_PUBLIC_CONVEX_URL, and nothing
  // in the response distinguishes them — so this check cannot honestly say
  // which happened, and must not caption itself "Convex is down".
  const convex: StatusCheck =
    runtime.convexReachable === true
      ? {
          id: "convex-read-path",
          label: "convex read path",
          state: "ok",
          detail:
            "public unauthenticated query only; auth, mutations and account surfaces are unproven by this check",
          value: "reachable",
          measuredAt,
        }
      : unknownCheck(
          "convex-read-path",
          "convex read path",
          "the query threw — a Convex outage and an unset NEXT_PUBLIC_CONVEX_URL are indistinguishable here; auth, mutations and account surfaces are unproven either way",
          measuredAt
        );

  const cliPackage = packageCheck({
    id: "published-cli",
    label: "published CLI package",
    pkg: CLI_PACKAGE,
    indexFile: CLI_INDEX_FILE,
    publishedVersion: runtime.cliVersionPublished,
    localVersion: build.cliVersionLocal,
    publishedComponents: runtime.cliComponentsPublished ?? null,
    buildComponents: build.components,
    measuredAt,
  });

  const mcpPackage = packageCheck({
    id: "published-mcp",
    label: "published MCP package",
    pkg: MCP_PACKAGE,
    indexFile: MCP_INDEX_FILE,
    publishedVersion: runtime.mcpVersionPublished,
    localVersion: build.mcpVersionLocal,
    publishedComponents: runtime.mcpComponentsPublished ?? null,
    buildComponents: build.components,
    measuredAt,
  });

  // Declaration order, not severity order: §3 is a fixed list.
  return [liveOrigin, convex, cliPackage, mcpPackage];
}

/**
 * One published npm package, as one row.
 *
 * The CLI and the MCP server are separate artifacts, published separately from
 * separate package.json files, and either can be stale while the other is
 * current — so they get a row each and neither is ever evidence about the
 * other. Each row rests on two reads of the SAME resolved version: the version
 * npm serves, and the component count inside the index that version ships.
 *
 * Three outcomes, and only three:
 *   the registry did not answer          → UNKNOWN, reason names the package
 *   it answered, its index did not       → UNKNOWN, reason names the version
 *                                          that WAS read and the file that
 *                                          was not, so the partial read is
 *                                          not thrown away silently
 *   both read                            → OK, or DEGRADED naming every
 *                                          number on both sides of the drift
 *
 * There is no path to `down` here: npm failing to answer is a fact about npm,
 * not about this package, and a fetch that throws cannot tell the two apart.
 */
/**
 * The comparison at the heart of a published-package row: does what npm
 * serves match what this build shipped, on BOTH the version and the
 * component count? Returns one string per drift found, empty when the two
 * sides agree completely. Symmetric wording on purpose — the published index
 * can legitimately lead this build (a publish landed ahead of a deploy, or
 * components were deleted since), and a subtraction phrased one way renders
 * "-5 components".
 *
 * Exported and shared rather than left inline in `packageCheck` so
 * `app/api/status-snapshot/route.ts` — which now measures the same drift at
 * poll time, not just at page-render time — states it in the exact same
 * words. Two copies of this comparison drifting apart in wording is exactly
 * the class of split `app/status/uptime.tsx`'s `now:` / `last recorded day:`
 * fix exists to warn against.
 */
export function driftOf(args: {
  version: string;
  localVersion: string | null;
  components: number;
  buildComponents: number;
}): string[] {
  return [
    args.version === args.localVersion
      ? null
      : `${args.version} published vs ${args.localVersion ?? EM_DASH} in this repo`,
    args.components === args.buildComponents
      ? null
      : `${args.components} components in the published package vs ${args.buildComponents} in this build`,
  ].filter((d): d is string => d !== null);
}

function packageCheck(args: {
  id: string;
  label: string;
  pkg: string;
  /** The file inside the published package whose components are counted. */
  indexFile: string;
  publishedVersion: string | null;
  localVersion: string | null;
  publishedComponents: number | null;
  buildComponents: number;
  measuredAt: string;
}): StatusCheck {
  const { id, label, pkg, indexFile, publishedVersion: version, measuredAt } = args;

  if (version === null) {
    return unknownCheck(
      id,
      label,
      `the npm registry did not answer for ${pkg}, so its published version could not be read`,
      measuredAt
    );
  }
  if (args.publishedComponents === null) {
    // The version is a real measurement and is named here rather than dropped,
    // but the row's value column stays an em dash: half the claim is missing,
    // and a row that prints a number is a row that claims to have checked one.
    return unknownCheck(
      id,
      label,
      `npm serves ${pkg} at ${version}, but the ${indexFile} inside that published version could not be read, so how many components it ships is unknown`,
      measuredAt
    );
  }
  const components = args.publishedComponents;

  // Local and published disagreeing means a release is sitting unpublished (or
  // a publish landed ahead of this build). Both sides get named — a row that
  // says "drift" without saying drift from what is not a check.
  const drifts = driftOf({
    version,
    localVersion: args.localVersion,
    components,
    buildComponents: args.buildComponents,
  });

  return {
    id,
    label,
    state: drifts.length > 0 ? "degraded" : "ok",
    detail:
      drifts.length > 0
        ? drifts.join("; ")
        : `npm dist-tags latest matches this repo's package.json, and the ${indexFile} it ships indexes every component in this build`,
    value: `${version} · ${components} components`,
    measuredAt,
  };
}

// -------------------------------------------------------------------------
// §4 NOT MEASURED — the permanently unmeasurable, as a claim, not an apology.
// Each of these is `unknown` because nothing in this repo can produce it, not
// because a fetch failed. Presenting them beats omitting them: the omissions
// are what a conventional status page would quietly fake.
// -------------------------------------------------------------------------

export function notMeasuredChecks(measuredAt: string): StatusCheck[] {
  return [
    ["uptime-history", "uptime and availability history", "no time-series store exists in this repo"],
    ["incident-history", "incident history and error rates", "no analytics or error reporting is wired here"],
    ["latency", "response-time percentiles", "one request from one machine is not a measurement"],
    ["shadcn-add", "whether `npx shadcn add` succeeds in a terminal", "only the payload is checked"],
    ["ungated-render", "whether the ungated components render", "scripts/verify.ts needs a running server"],
    ["vercel-deploy", "Vercel deployment state", "no code path in this repo reads a Vercel token"],
  ].map(([id, label, reason]) => unknownCheck(id, label, reason, measuredAt));
}

// -------------------------------------------------------------------------
// RUNTIME READS. Every one follows the lib/github-stars.ts precedent: any
// throw, non-200, or unexpected body shape collapses to `null`, which renders
// as UNKNOWN. None of them can produce a failure state, by construction.
// -------------------------------------------------------------------------

const NPM_REGISTRY = "https://registry.npmjs.org";
const HOUR = 3600;

/**
 * Ceiling on any single external read. Next's per-page build budget is 60s and
 * this page fires up to four independent chains (§3) that themselves make up
 * to two sequential hops each (fetchPublishedIndex) — bounding every fetch
 * here at 8s keeps the slowest possible chain (~16s) well inside that budget
 * even if a host never answers, instead of hanging until the platform's own
 * (much longer) default and taking the build down with it. A timeout collapses
 * to the same `null` every other failure here does, so it renders as UNKNOWN,
 * never as a fabricated failure or a fabricated pass.
 */
const FETCH_TIMEOUT_MS = 8_000;

/**
 * R1: the live registry index, the exact artifact the component count claims.
 * `origin` is passed in (callers use REGISTRY_ORIGIN from lib/registry-origin)
 * so this module keeps its zero-import property.
 */
export async function fetchLiveOriginCount(origin: string): Promise<number | null> {
  // ponytail: 1.24 MB once an hour, server-side only, never shipped to the
  // client. Ceiling: it is the whole index for one integer. Upgrade path is a
  // Range request for the first 401 bytes of /llms.txt, whose header line
  // reads "· Components: 298 ·" (verified 206 + accept-ranges: bytes).
  // Rejected for now because registry.json is the artifact the claim is about
  // and the llms header is only a proxy for it.
  try {
    const res = await fetch(`${origin}/r/registry.json`, {
      next: { revalidate: HOUR },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const items = (data as { items?: unknown })?.items;
    return Array.isArray(items) ? items.length : null;
  } catch {
    return null;
  }
}

/**
 * `dist-tags.latest`, via the abbreviated packument (~2.4 KB instead of the
 * full one). The only honest source for a published version: the two booleans
 * in lib/package-publish-status.ts are hand-flipped and one release stale.
 */
export async function fetchPublishedVersion(pkg: string): Promise<string | null> {
  try {
    const res = await fetch(`${NPM_REGISTRY}/${pkg}`, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
      next: { revalidate: HOUR },
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

export const CLI_PACKAGE = "@nikolas.sapa/ns-ui";
export const MCP_PACKAGE = "@nikolas.sapa/ns-ui-mcp";

/** The file inside each published package whose `components` array is counted.
 *  Declared once because the row's UNKNOWN reason names the same path the fetch
 *  asked for, and two copies of the literal can drift into a row that names a
 *  file nobody read. */
export const CLI_INDEX_FILE = "data/registry-index.json";
export const MCP_INDEX_FILE = "data/registry-snapshot.json";

export type PublishedPackage = { version: string; components: number };

/**
 * A published package's version AND the component count inside that SAME
 * resolved version's own embedded index. Two hops, one artifact.
 *
 * Either hop failing returns null for both, because a version from one
 * resolution and a count from another are two facts pretending to be one. A
 * caller that wants to tell "npm did not answer" apart from "the index did not
 * parse" reads the version separately with `fetchPublishedVersion` — which is
 * what /status does, so its two package rows carry different UNKNOWN reasons.
 *
 * `dist-tags.latest` is resolved first rather than a bare `@latest` URL on
 * purpose: the version is the thing the row reports, and reading it from the
 * registry means the row survives the next publish without an edit here.
 */
async function fetchPublishedIndex(
  pkg: string,
  indexFile: string
): Promise<PublishedPackage | null> {
  // ponytail: unpkg is an external host with no precedent in this repo.
  // Ceiling: unpkg availability, plus a staleness window between the two hops
  // if a publish lands between them, plus the download itself — the CLI's
  // index is under a megabyte (566 KB measured 2026-08-20) and the MCP's
  // snapshot is multiple megabytes and growing with the registry (measured
  // 2026-08-20: 8.98 MB read directly, 11,974,538 bytes as this build's own
  // fetch reported it — the two methods disagree by enough that neither
  // number should be trusted to the byte, but both agree it is comfortably
  // multi-megabyte and was 5.8 MB when this comment was first written), once
  // an hour, server-side only and never shipped to a client. The MCP file is
  // over Next's 2 MB data cache ceiling, so it is refetched per ISR
  // revalidation rather than cached.
  // Bounded by FETCH_TIMEOUT_MS on both hops now: unpkg was measured hanging
  // past two minutes cold and taking the whole build down with it (Next's
  // per-page budget is 60s); a slow host now times out into the same UNKNOWN
  // this function already returns on any other failure, rather than hanging.
  // Upgrade path: emit the component count into each package's own manifest at
  // publish time and read it straight off the packument, dropping the second
  // host and both downloads entirely.
  const version = await fetchPublishedVersion(pkg);
  if (version === null) return null;
  try {
    const res = await fetch(`https://unpkg.com/${pkg}@${version}/${indexFile}`, {
      next: { revalidate: HOUR },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const components = (data as { components?: unknown })?.components;
    return Array.isArray(components)
      ? { version, components: components.length }
      : null;
  } catch {
    return null;
  }
}

/** R2: the published CLI package — `data/registry-index.json` is the offline
 *  index `npx ns-ui` falls back to, so its length is what the published CLI
 *  can install without the network. */
export function fetchPublishedCli(): Promise<PublishedPackage | null> {
  return fetchPublishedIndex(CLI_PACKAGE, CLI_INDEX_FILE);
}

/** R3: the published MCP server, measured from ITS own artifact.
 *  `data/registry-snapshot.json` is the file the MCP server reads to answer an
 *  agent, and the CLI's index is not evidence about it: they are built by
 *  different scripts, shipped in different packages and published separately. */
export function fetchPublishedMcp(): Promise<PublishedPackage | null> {
  return fetchPublishedIndex(MCP_PACKAGE, MCP_INDEX_FILE);
}

/**
 * R4: the public Convex read path, with the probe injected so this module
 * stays importable by plain `node` (and so the page keeps ownership of the
 * `fetchQuery` call, avoiding an origin round-trip during ISR render).
 *
 * Returns `true` on success and `null` on any throw. Never `false`: this
 * check cannot prove the backend is down, only that it could not be read.
 */
export async function probeConvex(
  probe: () => Promise<unknown>
): Promise<true | null> {
  try {
    await probe();
    return true;
  } catch {
    return null;
  }
}
