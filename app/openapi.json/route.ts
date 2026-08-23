import registry from "@/registry.json";
import pkg from "@/package.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// OpenAPI 3.1 description of the public, anonymous, read-only surface —
// exactly the endpoints /docs lists, at the URL a tool looking for a spec
// tries first.
//
// Hand-written rather than generated: this API is four endpoints that change
// on the scale of years, and a generator would need a decorator layer on
// route handlers that otherwise have none. What DOES change — the component
// count, the origin — is interpolated from the same sources the rest of the
// app reads, so the spec cannot drift into claiming a stale number.
//
// Account routes under /api are deliberately absent. They exist, but they are
// session-cookie internals for this site's own UI, not a public API, and
// documenting them here would invite exactly the integration they do not
// support.
export const runtime = "nodejs";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "ns-ui registry API",
    version: pkg.version,
    summary: `Public read-only API for the ns-ui component registry (${registry.items.length} React components).`,
    description:
      "Every endpoint is public, anonymous and read-only — no key, no account, no rate limit worth documenting. " +
      "The registry follows the shadcn registry schema, so `npx shadcn add <item url>` works directly against it.",
    license: { name: "MIT", identifier: "MIT" },
    contact: { name: "ns-ui", url: `${REGISTRY_ORIGIN}/about` },
  },
  servers: [{ url: REGISTRY_ORIGIN }],
  externalDocs: { description: "Developer docs", url: `${REGISTRY_ORIGIN}/docs` },
  paths: {
    "/registry.json": {
      get: {
        operationId: "getRegistryIndex",
        summary: "The registry index",
        description:
          "Every item in the registry with its name, title, description and tags. Conforms to https://ui.shadcn.com/schema/registry.json. Also served at /r/registry.json.",
        responses: {
          "200": {
            description: "The registry index",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    $schema: { type: "string" },
                    name: { type: "string" },
                    homepage: { type: "string", format: "uri" },
                    items: { type: "array", items: { $ref: "#/components/schemas/RegistryItem" } },
                  },
                  required: ["name", "items"],
                },
              },
            },
          },
        },
      },
    },
    "/r/{name}.json": {
      get: {
        operationId: "getComponent",
        summary: "One component's registry item, including its real source",
        description:
          "What `npx shadcn add` reads: dependencies, CSS variables, and the component source in files[].content. Conforms to https://ui.shadcn.com/schema/registry-item.json.",
        parameters: [
          {
            name: "name",
            in: "path",
            required: true,
            description: "Component name, e.g. `undo-ghost-row`.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "The registry item",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RegistryItem" } },
            },
          },
          "404": { description: "No component with that name" },
        },
      },
    },
    "/.well-known/mcp": {
      get: {
        operationId: "getMcpManifest",
        summary: "MCP server manifest",
        description:
          "Transport, protocol version and tool list. Answers 405 to a request whose Accept asks for text/event-stream: this server is stateless and offers no server-to-client stream. Also reachable at /mcp and /.well-known/mcp.json.",
        responses: {
          "200": { description: "Manifest", content: { "application/json": {} } },
          "405": { description: "No server-to-client stream is offered" },
        },
      },
      post: {
        operationId: "callMcp",
        summary: "MCP over Streamable HTTP (JSON-RPC 2.0)",
        description:
          "Supports initialize, ping, tools/list and tools/call. Notifications (no id) return 202 with no body. Tools: search_components, get_component, install_command.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  jsonrpc: { type: "string", const: "2.0" },
                  id: { type: ["string", "number", "null"] },
                  method: { type: "string" },
                  params: { type: "object" },
                },
                required: ["jsonrpc", "method"],
              },
            },
          },
        },
        responses: {
          "200": { description: "JSON-RPC response", content: { "application/json": {} } },
          "202": { description: "Notification accepted; no response body" },
          "400": { description: "Body was not valid JSON" },
        },
      },
    },
    "/llms.txt": {
      get: {
        operationId: "getLlmsTxt",
        summary: "Agent quickstart",
        description:
          "Install command, the CSS token contract components require, and one block per component. /llms-full.txt is the same catalog with a full paragraph of behavioral detail each.",
        responses: {
          "200": { description: "Plain text", content: { "text/plain": {} } },
        },
      },
    },
  },
  components: {
    schemas: {
      RegistryItem: {
        type: "object",
        description: "A shadcn registry item. See https://ui.shadcn.com/schema/registry-item.json.",
        properties: {
          name: { type: "string" },
          type: { type: "string", examples: ["registry:ui"] },
          title: { type: "string" },
          description: { type: "string" },
          dependencies: { type: "array", items: { type: "string" } },
          files: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                content: { type: "string", description: "The component's real source." },
                type: { type: "string" },
                target: { type: "string" },
              },
            },
          },
        },
        required: ["name", "type"],
      },
    },
  },
};

export function GET(): Response {
  return Response.json(spec, {
    headers: { "cache-control": "public, max-age=0, must-revalidate" },
  });
}
