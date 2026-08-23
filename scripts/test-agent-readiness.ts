// Asserts the agent-facing contract of a running site: markdown content
// negotiation (acceptmarkdown.com), the recoverable 404, the MCP handshake at
// /.well-known/mcp, the homepage identity JSON-LD, canonical URLs, and the
// trust-anchor pages.
//
// Every check here is an HTTP assertion against a real server, not a read of
// the source that produced it — a rewrite rule, a Vary header and a JSON-LD
// block are exactly the things that typecheck fine and are absent in
// production. Run it against localhost after `npm run build && npm start`, and
// against the deployment after it goes live:
//
//   BASE_URL=http://localhost:3000 node scripts/test-agent-readiness.ts
//   BASE_URL=https://design.helpmarq.com node scripts/test-agent-readiness.ts
//
// It must be run against a build WITHOUT these fixes at least once. A green
// readiness check that has never seen red is measuring its own optimism.
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (ok) {
    console.log(`  ✓ ${name}`);
    return;
  }
  failures++;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

const url = (path: string) => `${BASE_URL}${path}`;

/** A failing endpoint answers with an HTML error page, not JSON — parsing it
 *  unguarded turns "this check is red" into "this script crashed", and the
 *  checks after it never run. */
async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Vary is a comma-separated list; the check is membership, not equality —
 *  Next adds its own rsc/router tokens and those must survive alongside it. */
const varies = (res: Response, field: string) =>
  (res.headers.get("vary") ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .includes(field.toLowerCase());

async function markdownNegotiation() {
  console.log("\nMarkdown content negotiation (acceptmarkdown.com)");

  const md = await fetch(url("/"), { headers: { accept: "text/markdown" } });
  const type = md.headers.get("content-type") ?? "";
  const body = await md.text();
  check("GET / with Accept: text/markdown → 200", md.status === 200, `got ${md.status}`);
  check(
    "  serves text/markdown; charset=utf-8",
    type.replace(/\s/g, "") === "text/markdown;charset=utf-8",
    `got "${type}"`,
  );
  check("  Vary lists Accept", varies(md, "accept"), `got "${md.headers.get("vary")}"`);
  check("  body is markdown with an H1", body.startsWith("# "), body.slice(0, 40));
  check("  body links the machine-readable surface", body.includes("/llms.txt"));

  // The q-value rule: HTML ranked above markdown must still get HTML.
  const html = await fetch(url("/"), {
    headers: { accept: "text/html;q=1.0, text/markdown;q=0.5" },
  });
  check(
    "HTML outranking markdown by q-value still gets HTML",
    (html.headers.get("content-type") ?? "").includes("text/html"),
    `got "${html.headers.get("content-type")}"`,
  );

  // The tie rule. An indexer saying "markdown is fine, so is anything else"
  // must get the real page — serving it markdown replaces the document (and
  // its <h1>) with a text file, which is what an audit read as a missing
  // heading.
  const wildcard = await fetch(url("/"), { headers: { accept: "text/markdown, */*" } });
  check(
    "markdown tied with a wildcard still gets HTML",
    (wildcard.headers.get("content-type") ?? "").includes("text/html"),
    `got "${wildcard.headers.get("content-type")}"`,
  );

  // ...but naming markdown above the wildcard is a real preference.
  const explicit = await fetch(url("/"), {
    headers: { accept: "text/markdown, */*;q=0.5" },
  });
  check(
    "markdown ranked above a wildcard gets markdown",
    (explicit.headers.get("content-type") ?? "").includes("text/markdown"),
    `got "${explicit.headers.get("content-type")}"`,
  );

  // A browser (or a bare `curl`, which sends the wildcard) must be untouched.
  const plain = await fetch(url("/"), { headers: { accept: "*/*" } });
  check(
    "Accept: */* still gets HTML",
    (plain.headers.get("content-type") ?? "").includes("text/html"),
    `got "${plain.headers.get("content-type")}"`,
  );
  // NOT a hard check: Next writes its own router `Vary` over a config-set one
  // on page responses (measured under `next start`), so the HTML variant may
  // not carry `Accept` no matter what next.config.ts asks for. It does not
  // matter here — the two variants are different ROUTES, so they never share
  // a cache key — and the spec-required header is on the markdown response,
  // asserted above. Reported so a change in either direction is visible.
  console.log(
    `  · HTML variant Vary: "${plain.headers.get("vary")}" (Accept ${
      varies(plain, "accept") ? "present" : "absent — expected under next start"
    })`,
  );

  const component = await fetch(url("/components/not-found-knockout"), {
    headers: { accept: "text/markdown" },
  });
  const componentBody = await component.text();
  check(
    "a component page has a markdown variant",
    component.status === 200 &&
      (component.headers.get("content-type") ?? "").includes("text/markdown"),
    `${component.status} ${component.headers.get("content-type")}`,
  );
  check("  it carries the install command", componentBody.includes("npx shadcn add"));

  // A real path inside the route's own NO_MARKDOWN set, so the 406 branch
  // actually executes — /api/* is excluded from the rewrite entirely and
  // never reaches the markdown route to be refused.
  const unsupported = await fetch(url("/preview/hero-particles-webgl"), {
    headers: { accept: "text/markdown" },
  });
  check(
    "a route with no markdown representation answers 406",
    unsupported.status === 406,
    `got ${unsupported.status}`,
  );

  // The machine-readable files are the reason this feature exists; a
  // `beforeFiles` rewrite runs ahead of the filesystem and once served all of
  // them as a markdown 404 to exactly the clients they are for.
  for (const [path, expected] of [
    ["/llms.txt", "text/plain"],
    ["/registry.json", "application/json"],
    ["/sitemap.xml", "xml"],
    ["/robots.txt", "text/plain"],
  ] as const) {
    const file = await fetch(url(path), { headers: { accept: "text/markdown, */*" } });
    check(
      `${path} survives an Accept that mentions markdown`,
      file.status === 200 && (file.headers.get("content-type") ?? "").includes(expected),
      `${file.status} ${file.headers.get("content-type")}`,
    );
  }
}

async function agentFriendly404() {
  console.log("\nAgent-friendly 404");

  const path = "/this-path-does-not-exist-9d3f";
  const res = await fetch(url(path));
  const html = await res.text();
  check("nonexistent path returns 404", res.status === 404, `got ${res.status}`);
  check("  HTML 404 points at the sitemap", html.includes("/sitemap.xml"));
  check("  HTML 404 points at llms.txt", html.includes("/llms.txt"));

  const md = await fetch(url(path), { headers: { accept: "text/markdown" } });
  const body = await md.text();
  check("markdown 404 keeps the 404 status", md.status === 404, `got ${md.status}`);
  check(
    "  markdown 404 is markdown",
    (md.headers.get("content-type") ?? "").includes("text/markdown"),
    `got "${md.headers.get("content-type")}"`,
  );
  check("  markdown 404 says where to go next", body.includes("/llms.txt") && body.includes("#"));
}

async function mcpEndpoint() {
  console.log("\nMCP server / manifest");

  const manifest = await fetch(url("/.well-known/mcp"));
  check("GET /.well-known/mcp → 200", manifest.status === 200, `got ${manifest.status}`);
  const doc = (await safeJson<Record<string, unknown>>(manifest)) ?? {};
  check("  declares a transport", typeof doc.transport === "string", String(doc.transport));
  check("  lists tools", Array.isArray(doc.tools) && doc.tools.length > 0);

  const stream = await fetch(url("/.well-known/mcp"), { headers: { accept: "text/event-stream" } });
  check("GET asking for an SSE stream → 405", stream.status === 405, `got ${stream.status}`);

  const rpc = async (body: unknown) =>
    fetch(url("/.well-known/mcp"), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });

  const init = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-agent-readiness", version: "1" },
    },
  });
  const initBody =
    (await safeJson<{ result?: { protocolVersion?: string; serverInfo?: { name?: string } } }>(init)) ?? {};
  check("initialize handshake succeeds", init.status === 200 && !!initBody.result, `got ${init.status}`);
  check("  returns a protocolVersion", !!initBody.result?.protocolVersion);
  check("  names the server", initBody.result?.serverInfo?.name === "ns-ui", String(initBody.result?.serverInfo?.name));

  const notified = await rpc({ jsonrpc: "2.0", method: "notifications/initialized" });
  check("notification gets 202 and no body", notified.status === 202, `got ${notified.status}`);

  const list = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const listBody = (await safeJson<{ result?: { tools?: { name: string }[] } }>(list)) ?? {};
  const toolNames = (listBody.result?.tools ?? []).map((t) => t.name);
  check("tools/list returns the catalog tools", toolNames.includes("search_components"), toolNames.join(", "));

  const call = await rpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "search_components", arguments: { query: "", limit: 3 } },
  });
  const callBody = (await safeJson<{ result?: { content?: { text?: string }[] } }>(call)) ?? {};
  const text = callBody.result?.content?.[0]?.text ?? "";
  check("tools/call returns results", text.includes('"results"'), text.slice(0, 60));

  // Clients disagree about where an MCP server lives; all three URLs are the
  // same handler, so all three must hand-shake.
  for (const alias of ["/mcp", "/.well-known/mcp.json"]) {
    const aliased = await fetch(url(alias), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/list" }),
    });
    const body = (await safeJson<{ result?: { tools?: unknown[] } }>(aliased)) ?? {};
    check(`${alias} answers the same handshake`, (body.result?.tools?.length ?? 0) > 0, `got ${aliased.status}`);
  }

  const unknown = await rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "nope" } });
  const unknownBody = (await safeJson<{ error?: { code?: number } }>(unknown)) ?? {};
  check("unknown tool is a JSON-RPC error", unknownBody.error?.code === -32602, JSON.stringify(unknownBody.error));
}

async function homepageMetadata() {
  console.log("\nHomepage metadata and structured data");

  const res = await fetch(url("/"));
  const html = await res.text();

  const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)?.[1];
  check("homepage declares a canonical URL", !!canonical, String(canonical));

  const blocks = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)].map(
    (m) => m[1],
  );
  check("homepage carries JSON-LD", blocks.length > 0, `${blocks.length} block(s)`);
  const types = new Set<string>();
  for (const block of blocks) {
    try {
      // The blocks escape `<` as < for HTML safety; JSON.parse undoes it.
      const parsed = JSON.parse(block) as Record<string, unknown>;
      const nodes = (parsed["@graph"] as Record<string, unknown>[] | undefined) ?? [parsed];
      for (const node of nodes) if (typeof node["@type"] === "string") types.add(node["@type"]);
    } catch (error) {
      check("  JSON-LD block parses", false, String(error));
    }
  }
  check("  declares an identity type", types.has("SoftwareApplication"), [...types].join(", "));
  check("  declares an Organization", types.has("Organization"), [...types].join(", "));

  // The Organization is only useful to an agent if it can act on it.
  const org = blocks
    .map((b) => {
      try {
        return JSON.parse(b) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .flatMap((p) => (p?.["@graph"] as Record<string, unknown>[] | undefined) ?? (p ? [p] : []))
    .find((n) => n["@type"] === "Organization");
  check("  Organization has a contactPoint", Array.isArray(org?.contactPoint) && org.contactPoint.length > 0);
  check(
    "  Organization has an address with a country",
    typeof (org?.address as { addressCountry?: string } | undefined)?.addressCountry === "string",
    JSON.stringify(org?.address),
  );
  // The spaced spelling is what people type into a search box; it appears
  // nowhere in the visible copy, so the markup is the only place it lives.
  check(
    "  Organization lists the spaced brand spelling",
    JSON.stringify(org?.alternateName ?? "").includes("ns ui"),
    JSON.stringify(org?.alternateName),
  );

  // The H1 has always been server-rendered; what regressed was where. An
  // agent that truncates a fetch has to reach it — the sidebar tree used to
  // put it ~290KB in.
  const h1 = html.indexOf("<h1");
  check("homepage has an H1 in raw HTML", h1 !== -1);
  // 20KB, not 100: the catalog's ItemList JSON-LD is ~55KB on its own, and
  // while it sat above the markup the heading was at byte 63,882. Anything
  // that large creeping back in front of the content fails here.
  check("  H1 is within the first 20KB", h1 !== -1 && h1 < 20_000, `at byte ${h1}`);

  for (const tag of ['property="og:image"', 'property="og:type"', 'lang="en"']) {
    check(`homepage has ${tag}`, html.includes(tag));
  }
}

async function developerResources() {
  console.log("\nDeveloper resource discoverability");

  const docs = await fetch(url("/docs"));
  const html = await docs.text();
  check("/docs responds 200", docs.status === 200, `got ${docs.status}`);
  // The audit's complaint was name-based: a search for the product's docs
  // found nothing. The product name has to be IN the title and the heading,
  // not just implied by the domain.
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  check("  /docs names the product in its <title>", /ns-ui/i.test(title), title);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, "") ?? "";
  check("  /docs names the product in its H1", /ns-ui/i.test(h1), h1.trim());
  for (const path of ["/openapi.json", "/.well-known/mcp", "/llms.txt", "/registry.json"]) {
    check(`  /docs links ${path}`, html.includes(path));
  }

  const spec = await fetch(url("/openapi.json"));
  const doc = (await safeJson<Record<string, unknown>>(spec)) ?? {};
  check("/openapi.json responds 200", spec.status === 200, `got ${spec.status}`);
  check("  is an OpenAPI 3.1 document", String(doc.openapi ?? "").startsWith("3.1"), String(doc.openapi));
  const paths = Object.keys((doc.paths as Record<string, unknown>) ?? {});
  check("  documents the registry index", paths.includes("/registry.json"), paths.join(", "));
  check("  documents the MCP endpoint", paths.includes("/.well-known/mcp"), paths.join(", "));

  const llms = await (await fetch(url("/llms.txt"))).text();
  check("llms.txt names the docs index", llms.includes("/docs"));
  check("llms.txt names the OpenAPI spec", llms.includes("/openapi.json"));

  const sitemap = await (await fetch(url("/sitemap.xml"))).text();
  check("sitemap lists /docs", sitemap.includes("/docs"));
}

async function trustAnchors() {
  console.log("\nTrust anchor pages");

  for (const path of ["/about", "/privacy"]) {
    const res = await fetch(url(path));
    const html = await res.text();
    // Text content only — a 500-char threshold measured against markup would
    // pass on an empty page with a big class attribute.
    const textLength = html
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<style[\s\S]*?<\/style>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim().length;
    check(`${path} responds 200`, res.status === 200, `got ${res.status}`);
    check(`  ${path} has 500+ characters of text`, textLength >= 500, `${textLength} chars`);
    check(`  ${path} declares a canonical URL`, html.includes('rel="canonical"'));
  }

  const sitemap = await fetch(url("/sitemap.xml"));
  const xml = await sitemap.text();
  check("sitemap lists /about", xml.includes("/about"));
  check("sitemap lists /privacy", xml.includes("/privacy"));

  const llms = await fetch(url("/llms.txt"));
  const txt = await llms.text();
  check("llms.txt names the MCP endpoint", txt.includes("/.well-known/mcp"));
  check("llms.txt names the registry index", txt.includes("/registry.json"));
}

console.log(`agent readiness — ${BASE_URL}`);
await markdownNegotiation();
await agentFriendly404();
await mcpEndpoint();
await homepageMetadata();
await developerResources();
await trustAnchors();

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} failing`);
  process.exit(1);
}

// Module marker: this file has no imports, and top-level await needs one.
export {};
