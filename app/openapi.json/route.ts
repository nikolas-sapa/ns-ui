import registry from "@/registry.json";
import pkg from "@/package.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { rateLimit, rateLimited } from "@/lib/api-response";

// OpenAPI 3.1 description of the public, anonymous, read-only surface —
// exactly the endpoints /docs lists, at the URL a tool looking for a spec
// tries first.
//
// Hand-written rather than generated: this API is five endpoints that change
// on the scale of years, and a generator would need a decorator layer on
// route handlers that otherwise have none. What DOES change — the component
// count, the origin, the version — is interpolated from the same sources the
// rest of the app reads, so the spec cannot drift into claiming a stale
// number.
//
// Every operation carries a typed response schema, a unique operationId and a
// description, because this document is read by function-calling models as
// well as by people: an untyped response there is not a small gap, it is the
// difference between a model knowing what it gets back and guessing.
//
// Account routes under /api are deliberately absent. They exist, but they are
// session-cookie internals for this site's own UI, not a public API, and
// documenting them here would invite exactly the integration they do not
// support.
export const runtime = "nodejs";

/** Applied to every successful response — see lib/api-response.ts. */
const RATE_LIMIT_HEADERS = {
  "RateLimit-Limit": {
    description: "Requests allowed per window.",
    schema: { type: "integer" },
  },
  "RateLimit-Remaining": {
    description: "Requests left in the current window. Pace on this rather than retrying blind.",
    schema: { type: "integer" },
  },
  "RateLimit-Reset": {
    description: "Seconds until the window resets.",
    schema: { type: "integer" },
  },
  "RateLimit-Policy": {
    description: 'Policy in RFC 9331 form, e.g. "120;w=60".',
    schema: { type: "string" },
  },
};

const problemResponse = (description: string) => ({
  description,
  headers: RATE_LIMIT_HEADERS,
  content: {
    "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } },
  },
});

const ERRORS = {
  "404": problemResponse("Not found. `code` names which thing was missing."),
  "429": {
    ...problemResponse("Rate limited."),
    headers: {
      ...RATE_LIMIT_HEADERS,
      "Retry-After": {
        description: "Seconds to wait before retrying.",
        schema: { type: "integer" },
      },
    },
  },
  "500": problemResponse("Unexpected server error."),
};

const spec = {
  openapi: "3.1.0",
  info: {
    title: "ns-ui registry API",
    version: pkg.version,
    summary: `Public read-only API for the ns-ui component registry (${registry.items.length} React components).`,
    description: [
      "Every endpoint is public, anonymous and read-only. There is no authentication: no key, no token, no account.",
      "",
      "**Versioning.** The API is served under `/v1`, and also without a prefix for backward compatibility — the two are aliases onto the same handlers, so they cannot answer differently. Within `/v1`, response shapes only ever gain fields; a breaking change becomes `/v2`.",
      "",
      "**Deprecation.** If an endpoint is ever retired, its responses carry `Deprecation` and `Sunset` headers (RFC 9745 / RFC 8594) for at least 180 days before removal, and the change is announced in the changelog at " +
        `${REGISTRY_ORIGIN}/changelog. No endpoint is deprecated today.`,
      "",
      "**Rate limits.** Every response carries RFC 9331 `RateLimit-*` headers; exceeding the window returns 429 with `Retry-After`. The limit is per client per instance and generous — it exists so an agent can self-throttle, not to meter usage.",
      "",
      "**Errors.** Every error is `application/problem+json` (RFC 9457) with a machine-readable `code`, a human-readable `detail`, and a `resolution` naming the next step.",
    ].join("\n"),
    license: { name: "MIT", identifier: "MIT" },
    contact: { name: "ns-ui", url: `${REGISTRY_ORIGIN}/about` },
  },
  servers: [
    { url: `${REGISTRY_ORIGIN}/v1`, description: "Versioned base. Recommended." },
    { url: REGISTRY_ORIGIN, description: "Unversioned alias of the same handlers." },
  ],
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
            headers: RATE_LIMIT_HEADERS,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RegistryIndex" } },
            },
          },
          ...ERRORS,
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
            headers: RATE_LIMIT_HEADERS,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/RegistryItem" } },
            },
          },
          ...ERRORS,
          "404": problemResponse(
            'No component with that name. `code` is "component_not_found" and `requestedName` echoes what was asked for.',
          ),
        },
      },
    },
    "/openapi.json": {
      get: {
        operationId: "getOpenApiSpec",
        summary: "This document",
        description: "The OpenAPI 3.1 description of every endpoint listed here.",
        responses: {
          "200": {
            description: "An OpenAPI 3.1 document",
            headers: RATE_LIMIT_HEADERS,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  description: "An OpenAPI 3.1 document.",
                  properties: {
                    openapi: { type: "string", examples: ["3.1.0"] },
                    info: { type: "object" },
                    servers: { type: "array", items: { type: "object" } },
                    paths: { type: "object" },
                    components: { type: "object" },
                  },
                  required: ["openapi", "info", "paths"],
                },
              },
            },
          },
          ...ERRORS,
        },
      },
    },
    "/mcp": {
      get: {
        operationId: "getMcpManifest",
        summary: "MCP server manifest",
        description:
          "Transport, protocol version and tool list. Also reachable at /.well-known/mcp and /.well-known/mcp.json. Answers 405 to a request whose Accept asks for text/event-stream: this server is stateless and offers no server-to-client stream.",
        responses: {
          "200": {
            description: "The manifest",
            headers: RATE_LIMIT_HEADERS,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/McpManifest" } },
            },
          },
          "405": problemResponse("No server-to-client stream is offered; POST instead."),
          ...ERRORS,
        },
      },
      post: {
        operationId: "callMcp",
        summary: "MCP over Streamable HTTP (JSON-RPC 2.0)",
        description:
          "Supports initialize, ping, tools/list and tools/call. Tools: search_components, get_component, install_command. Notifications (a request with no id) return 202 with no body.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/JsonRpcRequest" } },
          },
        },
        responses: {
          "200": {
            description: "JSON-RPC response",
            headers: RATE_LIMIT_HEADERS,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/JsonRpcResponse" } },
            },
          },
          "202": { description: "Notification accepted; no response body", headers: RATE_LIMIT_HEADERS },
          "400": {
            description: "Body was not valid JSON. Answered in JSON-RPC's own error envelope, not as a problem document, because the caller speaks JSON-RPC.",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/JsonRpcResponse" } },
            },
          },
          "429": ERRORS["429"],
          "500": ERRORS["500"],
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
          "200": {
            description: "Plain text",
            headers: RATE_LIMIT_HEADERS,
            content: { "text/plain": { schema: { type: "string" } } },
          },
          ...ERRORS,
        },
      },
    },
  },
  components: {
    schemas: {
      Problem: {
        type: "object",
        description:
          "RFC 9457 problem document. Every error on this API has this shape, served as application/problem+json.",
        properties: {
          type: { type: "string", format: "uri", description: "Link to the docs section for this error." },
          title: { type: "string", description: "Short, human-readable summary." },
          status: { type: "integer", description: "HTTP status code." },
          detail: { type: "string", description: "What went wrong, in this specific case." },
          code: {
            type: "string",
            description: "Machine-readable error code — the field to branch on.",
            examples: ["not_found", "component_not_found", "rate_limited", "stream_not_supported"],
          },
          resolution: { type: "string", description: "The next step that would make this request succeed." },
          instance: { type: "string", description: "The path that produced the error." },
          requestedName: {
            type: "string",
            description: "Only on component_not_found: the name that did not resolve.",
          },
        },
        required: ["type", "title", "status", "detail", "code"],
      },
      RegistryIndex: {
        type: "object",
        description: "The shadcn registry index.",
        properties: {
          $schema: { type: "string" },
          name: { type: "string" },
          homepage: { type: "string", format: "uri" },
          items: { type: "array", items: { $ref: "#/components/schemas/RegistryItem" } },
        },
        required: ["name", "items"],
      },
      RegistryItem: {
        type: "object",
        description: "A shadcn registry item. See https://ui.shadcn.com/schema/registry-item.json.",
        properties: {
          name: { type: "string" },
          type: { type: "string", examples: ["registry:ui"] },
          title: { type: "string" },
          description: { type: "string" },
          dependencies: { type: "array", items: { type: "string" } },
          cssVars: { type: "object" },
          meta: {
            type: "object",
            properties: {
              collection: { type: "string", enum: ["core", "loud"] },
              tags: { type: "array", items: { type: "string" } },
            },
          },
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
              required: ["path"],
            },
          },
        },
        required: ["name", "type"],
      },
      McpManifest: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          protocolVersion: { type: "string" },
          transport: { type: "string", examples: ["streamable-http"] },
          endpoint: { type: "string", format: "uri" },
          documentation: { type: "string", format: "uri" },
          tools: {
            type: "array",
            items: {
              type: "object",
              properties: { name: { type: "string" }, description: { type: "string" } },
              required: ["name"],
            },
          },
          alternatives: { type: "array", items: { type: "object" } },
        },
        required: ["name", "protocolVersion", "transport", "tools"],
      },
      JsonRpcRequest: {
        type: "object",
        properties: {
          jsonrpc: { type: "string", const: "2.0" },
          id: { type: ["string", "number", "null"], description: "Omit for a notification." },
          method: {
            type: "string",
            examples: ["initialize", "tools/list", "tools/call", "ping"],
          },
          params: { type: "object" },
        },
        required: ["jsonrpc", "method"],
      },
      JsonRpcResponse: {
        type: "object",
        properties: {
          jsonrpc: { type: "string", const: "2.0" },
          id: { type: ["string", "number", "null"] },
          result: { type: "object", description: "Present on success." },
          error: {
            type: "object",
            description: "Present on failure.",
            properties: {
              code: { type: "integer", examples: [-32700, -32601, -32602] },
              message: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
        required: ["jsonrpc"],
      },
    },
  },
};

export function GET(request: Request): Response {
  const state = rateLimit(request);
  if (!state.ok) return rateLimited(state, "/openapi.json");
  return Response.json(spec, {
    headers: { "cache-control": "public, max-age=0, must-revalidate", ...state.headers },
  });
}
