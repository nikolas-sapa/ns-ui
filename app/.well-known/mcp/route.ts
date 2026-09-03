import registry from "@/registry.json";
import pkg from "@/package.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { problem, rateLimit, rateLimited } from "@/lib/api-response";

// Live MCP endpoint + manifest for the ns-ui registry.
//
// The published server (`npx -y @nikolas.sapa/ns-ui-mcp`, source in `mcp/`)
// is stdio-only: an agent has to install it before it can ask anything. This
// route is the same catalog over Streamable HTTP at a discoverable address,
// so an agent that has only ever seen the domain can hand-shake and search
// without installing anything.
//
// Deliberately NOT the SDK server from `mcp/src/index.ts`: that pulls the
// MCP SDK and zod into the site's dependency tree for four hand-written
// JSON-RPC methods. This is a stateless subset — no sessions, no SSE, no
// resources, no prompts — which is all `initialize` + `tools/list` +
// `tools/call` needs. The tool NAMES and shapes mirror the stdio server on
// purpose; an agent should not be able to tell which one it is talking to.
// ponytail: hand-rolled JSON-RPC, swap in the SDK's
// StreamableHTTPServerTransport if this ever needs sessions or sampling.
export const runtime = "nodejs";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_NAME = "ns-ui";
// The site's own version, so the handshake cannot drift from what shipped.
const SERVER_VERSION = pkg.version;

type JsonRpcId = string | number | null;
type JsonRpcRequest = { jsonrpc: "2.0"; id?: JsonRpcId; method: string; params?: unknown };

const TOOLS = [
  {
    name: "search_components",
    title: "Search ns-ui components",
    description:
      `Search the ns-ui registry (${registry.items.length} self-contained React/Tailwind ` +
      "components) by name, title, description and tags. Returns compact results. Call " +
      "get_component with a result's name for the install command and full metadata.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free-text query, e.g. 'otp input'. Tokens are matched independently, so word order does not matter. Empty string lists everything up to `limit`.",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (1-100, default 20).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_component",
    title: "Get one ns-ui component",
    description:
      "Full detail for one component by name: description, tags, usage instruction, install " +
      "command, and the URL of its registry item (which carries the real source).",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Component name, e.g. 'undo-ghost-row'." } },
      required: ["name"],
    },
  },
  {
    name: "install_command",
    title: "Install command for a component",
    description: "The exact shell command that installs one component into a project.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", description: "Component name." } },
      required: ["name"],
    },
  },
];

const byName = new Map(registry.items.map((i) => [i.name, i]));
const installFor = (name: string) => `npx shadcn add ${REGISTRY_ORIGIN}/r/${name}.json`;

const haystack = (item: (typeof registry.items)[number]) =>
  [item.name, item.title, item.description ?? "", (item.meta?.tags ?? []).join(" ")]
    .join(" ")
    .toLowerCase();

function search(query: string, limit: number) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return registry.items
    .filter((item) => {
      const text = haystack(item);
      return tokens.every((t) => text.includes(t));
    })
    .slice(0, Math.min(Math.max(limit, 1), 100))
    .map((item) => ({
      name: item.name,
      title: item.title,
      description: item.description,
      collection: item.meta?.collection ?? "core",
      url: `${REGISTRY_ORIGIN}/components/${item.name}`,
    }));
}

const text = (s: string) => ({ content: [{ type: "text", text: s }] });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));

function callTool(name: string, args: Record<string, unknown>) {
  if (name === "search_components") {
    const query = typeof args.query === "string" ? args.query : "";
    const limit = typeof args.limit === "number" ? args.limit : 20;
    const results = search(query, limit);
    return json({ count: results.length, results });
  }

  const target = typeof args.name === "string" ? byName.get(args.name) : undefined;
  if (!target) {
    // Tool-level failure, not a protocol error: the model should see the miss
    // and try another name rather than the client throwing.
    return { ...text(`No component named "${String(args.name)}". Try search_components first.`), isError: true };
  }

  if (name === "install_command") return text(installFor(target.name));

  return json({
    name: target.name,
    title: target.title,
    description: target.description,
    collection: target.meta?.collection ?? "core",
    tags: target.meta?.tags ?? [],
    instruction: target.meta?.instruction ?? null,
    installCommand: installFor(target.name),
    page: `${REGISTRY_ORIGIN}/components/${target.name}`,
    registryItem: `${REGISTRY_ORIGIN}/r/${target.name}.json`,
  });
}

function handle(request: JsonRpcRequest): object | null {
  const { method, id } = request;
  const reply = (result: unknown) => ({ jsonrpc: "2.0" as const, id: id ?? null, result });

  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          "Search this registry for a React component, then install it with the returned " +
          "`npx shadcn add` command. Components are plain source with no runtime package.",
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const params = (request.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (!params.name || !TOOLS.some((t) => t.name === params.name)) {
        return { jsonrpc: "2.0", id: id ?? null, error: { code: -32602, message: `Unknown tool: ${params.name}` } };
      }
      return reply(callTool(params.name, params.arguments ?? {}));
    }
    default:
      // Notifications (no id) get no response at all, per JSON-RPC 2.0 —
      // including `notifications/initialized`, which every client sends.
      if (id === undefined || id === null) return null;
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

/**
 * Discovery: what this endpoint is, for anything that only does a GET.
 *
 * Streamable HTTP reserves GET for the server-to-client SSE stream, and a
 * server that does not offer one must answer 405 — so a client asking for
 * `text/event-stream` gets exactly that, and everything else (a browser, a
 * directory crawler, `curl`) gets the manifest. Both readings of GET are
 * satisfied without pretending to hold a stream this stateless handler has
 * no way to feed.
 */
export function GET(request: Request): Response {
  const state = rateLimit(request);
  if (!state.ok) return rateLimited(state, "/.well-known/mcp");

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream") && !accept.includes("application/json")) {
    return problem(
      {
        status: 405,
        code: "stream_not_supported",
        title: "No server-to-client stream",
        detail: "This MCP server is stateless and does not open an SSE stream on GET.",
        resolution: "POST JSON-RPC to this same URL, or GET it without text/event-stream in Accept to read the manifest.",
        instance: "/.well-known/mcp",
      },
      { allow: "POST", ...state.headers },
    );
  }

  return Response.json(
    {
      name: SERVER_NAME,
      description: `MCP server for the ns-ui component registry (${registry.items.length} React components).`,
      protocolVersion: PROTOCOL_VERSION,
      transport: "streamable-http",
      endpoint: `${REGISTRY_ORIGIN}/.well-known/mcp`,
      documentation: `${REGISTRY_ORIGIN}/connect`,
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
      alternatives: [
        {
          transport: "stdio",
          package: "@nikolas.sapa/ns-ui-mcp",
          command: "npx -y @nikolas.sapa/ns-ui-mcp",
        },
      ],
    },
    { headers: { "cache-control": "public, max-age=0, must-revalidate", ...state.headers } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const state = rateLimit(request);
  if (!state.ok) return rateLimited(state, "/.well-known/mcp");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    // JSON-RPC's own error envelope, not a problem document: a client that
    // POSTs here speaks JSON-RPC and parses `error.code`, and handing it a
    // different shape for one failure mode is how a client crashes on the
    // path it least expects to.
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: state.headers },
    );
  }

  // Batches are legal JSON-RPC and some clients still send them.
  const requests = Array.isArray(payload) ? payload : [payload];
  const responses = requests
    .map((r) => handle(r as JsonRpcRequest))
    .filter((r): r is object => r !== null);

  // All-notifications batch: 202 with no body, as the transport spec requires.
  if (responses.length === 0) return new Response(null, { status: 202, headers: state.headers });

  return Response.json(Array.isArray(payload) ? responses : responses[0], {
    headers: state.headers,
  });
}
