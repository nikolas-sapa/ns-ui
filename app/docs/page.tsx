import type { Metadata } from "next";
import Link from "next/link";
import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// Static by construction — same rule as /about and /guidelines.
//
// /connect already explains how to wire the registry into an agent, and it
// stays the page for that. This one exists for a different reader: something
// looking up "ns-ui developer docs" or "ns-ui API" by name and expecting a
// predictable URL to exist. It is a flat index of every machine-readable
// surface with its literal URL — no prose an agent has to interpret, and
// nothing here that isn't reachable.

const title = "ns-ui developer docs — API, registry JSON, MCP server, CLI";
const description =
  "Every machine-readable ns-ui endpoint at its literal URL: the shadcn registry index, per-component JSON, the OpenAPI spec, the MCP server handshake, llms.txt, and markdown content negotiation.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/docs" },
  openGraph: { title, description },
};

const LINK =
  "underline underline-offset-2 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none";

const H2 = "text-lg font-medium tracking-[-0.02em] text-foreground";
const P = "mt-2 text-sm leading-6 text-ns-muted";
const URL_ROW = "font-mono text-xs text-foreground";

type Entry = { url: string; what: string; note?: string };

const REGISTRY_API: Entry[] = [
  {
    url: "/v1/registry.json",
    what: "Versioned base URL. Every path below also answers under /v1 — same handler, so the two can never disagree.",
    note: "The unversioned paths stay supported; /v1 is the one to integrate against.",
  },
  {
    url: "/registry.json",
    what: `The shadcn registry index — all ${registry.items.length} items with names, titles, descriptions and tags.`,
    note: "Also served at /r/registry.json; both are the same file.",
  },
  {
    url: "/r/<name>.json",
    what: "One component's registry item: dependencies, CSS variables, and the real source in files[].content.",
    note: "This is what `npx shadcn add` reads.",
  },
  {
    url: "/openapi.json",
    what: "OpenAPI 3.1 description of every endpoint on this page.",
  },
];

const AGENT_SURFACE: Entry[] = [
  {
    url: "/.well-known/mcp",
    what: "MCP server. POST JSON-RPC (Streamable HTTP) for initialize, tools/list and tools/call; GET returns the manifest.",
    note: "Also answers at /mcp and /.well-known/mcp.json.",
  },
  {
    url: "/llms.txt",
    what: "Agent quickstart: install command, token contract, and one block per component.",
  },
  {
    url: "/llms-full.txt",
    what: "The long form — a full paragraph of behavioral detail per component.",
  },
  {
    url: "Accept: text/markdown",
    what: "Send that header to any page on this site and it answers with a markdown version of itself.",
    note: "acceptmarkdown.com-compliant, including the Vary header and q-values.",
  },
  {
    url: "/sitemap.xml",
    what: "Every indexed page, including one per component.",
  },
];

const PACKAGES: Entry[] = [
  {
    url: "npx -y @nikolas.sapa/ns-ui-mcp",
    what: "The same MCP server over stdio, for clients that do not speak HTTP transport.",
  },
  {
    url: "npx @nikolas.sapa/ns-ui add <name>",
    what: "CLI: search, inspect and install components from a terminal.",
  },
];

function Section({ heading, entries }: { heading: string; entries: Entry[] }) {
  return (
    <section className="mt-10 max-w-2xl">
      <h2 className={H2}>{heading}</h2>
      <dl className="mt-4 space-y-5">
        {entries.map((entry) => (
          <div key={entry.url}>
            <dt className={URL_ROW}>{entry.url}</dt>
            <dd className="mt-1 text-sm leading-6 text-ns-muted">
              {entry.what}
              {entry.note ? <span className="block text-ns-muted/80">{entry.note}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function DocsPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-6 py-16 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">
        ns-ui / docs
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        ns-ui developer docs.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ns-muted">
        Every endpoint below is public, needs no key and no account, and is
        relative to{" "}
        <code className="font-mono text-foreground">{REGISTRY_ORIGIN}</code>. If
        you want the walkthrough version — per-client MCP config, CLI examples —
        that is on{" "}
        <Link href="/connect" className={LINK}>
          /connect
        </Link>
        .
      </p>

      <div className="mt-8 border-t border-border pt-2">
        <Section heading="Registry API" entries={REGISTRY_API} />
        <Section heading="Agent surface" entries={AGENT_SURFACE} />
        <Section heading="Packages" entries={PACKAGES} />
      </div>

      <section className="mt-10 max-w-2xl" id="errors">
        <h2 className={H2}>Errors</h2>
        <p className={P}>
          Every error is an{" "}
          <a href="https://www.rfc-editor.org/rfc/rfc9457" className={LINK} target="_blank" rel="noreferrer">
            RFC 9457
          </a>{" "}
          problem document, served as{" "}
          <code className="font-mono text-foreground">application/problem+json</code>
          . Never an HTML page — a client that asked for JSON gets JSON, including
          on a 404.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-surface p-3 font-mono text-xs leading-6 text-foreground">
{`{
  "type": "${REGISTRY_ORIGIN}/docs#errors",
  "title": "No such component",
  "status": 404,
  "detail": "No component named \"acordion-latch\" exists in this registry.",
  "code": "component_not_found",
  "resolution": "Check the index at ${REGISTRY_ORIGIN}/registry.json…",
  "instance": "/r/acordion-latch.json",
  "requestedName": "acordion-latch"
}`}
        </pre>
        <p className={P}>
          <code className="font-mono text-foreground">code</code> is the field to
          branch on — it is stable, unlike the prose in{" "}
          <code className="font-mono text-foreground">title</code> and{" "}
          <code className="font-mono text-foreground">detail</code>. Current codes:{" "}
          <code className="font-mono text-foreground">not_found</code>,{" "}
          <code className="font-mono text-foreground">component_not_found</code>,{" "}
          <code className="font-mono text-foreground">rate_limited</code>,{" "}
          <code className="font-mono text-foreground">stream_not_supported</code>.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className={H2}>Rate limits</h2>
        <p className={P}>
          Every response carries{" "}
          <code className="font-mono text-foreground">RateLimit-Limit</code>,{" "}
          <code className="font-mono text-foreground">RateLimit-Remaining</code>,{" "}
          <code className="font-mono text-foreground">RateLimit-Reset</code> and{" "}
          <code className="font-mono text-foreground">RateLimit-Policy</code> (
          <a href="https://www.rfc-editor.org/rfc/rfc9331" className={LINK} target="_blank" rel="noreferrer">
            RFC 9331
          </a>{" "}
          field names), so a client can pace itself instead of discovering the
          limit by hitting it. Going over returns{" "}
          <code className="font-mono text-foreground">429</code> with{" "}
          <code className="font-mono text-foreground">Retry-After</code> and the
          same problem-document shape.
        </p>
        <p className={P}>
          The window is 120 requests per minute per client, counted per serving
          instance — deliberately generous. It exists so agents can self-throttle,
          not to meter usage; the registry files themselves are static and
          CDN-cached.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className={H2}>Versioning and deprecation</h2>
        <p className={P}>
          Integrate against{" "}
          <code className="font-mono text-foreground">/v1</code>. Within it,
          response shapes only ever gain fields; anything that would break an
          existing client becomes <code className="font-mono text-foreground">/v2</code>{" "}
          instead. The unversioned paths are aliases onto the same handlers and
          stay supported.
        </p>
        <p className={P}>
          If an endpoint is ever retired, its responses carry{" "}
          <code className="font-mono text-foreground">Deprecation</code> and{" "}
          <code className="font-mono text-foreground">Sunset</code> headers for at
          least 180 days before removal, and the change is announced in the{" "}
          <Link href="/changelog" className={LINK}>
            changelog
          </Link>
          . Nothing is deprecated today.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className={H2}>Authentication</h2>
        <p className={P}>
          There is none. Every endpoint above is public, anonymous and read-only;
          nothing here accepts a write. Account features (saving components,
          collections) exist on the site but have no public API — see{" "}
          <Link href="/privacy" className={LINK}>
            /privacy
          </Link>{" "}
          for what they store.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className={H2}>Licensing</h2>
        <p className={P}>
          MIT, components included. Install them, edit them, ship them — the
          source lands in your repository and there is no runtime package to
          depend on. More about the project on{" "}
          <Link href="/about" className={LINK}>
            /about
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
