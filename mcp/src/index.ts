#!/usr/bin/env node
// MCP server for the ns-ui component registry (https://design.helpmarq.com).
// stdio transport. All non-protocol output goes to stderr — stdout carries
// only JSON-RPC frames, and a stray console.log here corrupts the stream
// for the client.
import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadSnapshot, findComponent } from "./data.ts";
import { searchComponents } from "./search.ts";
import { CONVENTIONS } from "./conventions.ts";

// `engines` in package.json is advisory only — npx will happily launch this
// on an older Node and fail with an opaque error buried in a log the user
// can't find. Fail loud and specific instead.
const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
  console.error(
    `[ns-ui-mcp] requires Node 18+; found Node ${process.versions.node}.`
  );
  process.exit(1);
}

// Single source of truth for both the handshake version and the catalog size:
// the package's own package.json and the bundled snapshot. Hardcoding either
// one is how they drifted: a stale handshake version and a stale component count.
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
const snapshot = loadSnapshot();

const server = new McpServer({
  name: "ns-ui",
  version,
});

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

function json(value: unknown) {
  return text(JSON.stringify(value, null, 2));
}

server.registerTool(
  "search_components",
  {
    title: "Search ns-ui components",
    description:
      `Search the ns-ui registry (${snapshot.components.length} self-contained React/Tailwind components) by ` +
      "name, title, description, tags and selection guidance ('use when'). Returns " +
      "compact results — name, title, one-line description, category, collection — " +
      "not full source. Call get_component with a result's name for the full detail " +
      "and real source.",
    inputSchema: {
      query: z
        .string()
        .describe(
          "Free-text query, e.g. 'cursor reactive hero' or 'otp input'. Tokens are " +
            "matched independently (all must appear somewhere in the searchable text), " +
            "so word order doesn't matter. Empty string lists everything (subject to " +
            "category/collection filters and limit)."
        ),
      category: z
        .string()
        .optional()
        .describe(
          "Restrict to one browsable category id from list_categories(), e.g. 'forms', 'heroes', 'navigation'."
        ),
      collection: z
        .enum(["core", "loud"])
        .optional()
        .describe(
          "Restrict to one collection: 'core' (restrained, production-facing) or 'loud' (deliberately flashy showcase)."
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Max results to return, default 20."),
    },
  },
  async ({ query, category, collection, limit }) => {
    const snapshot = loadSnapshot();
    const { results, total } = searchComponents(snapshot.components, query, {
      category,
      collection,
      limit,
    });
    return json({ total, returned: results.length, results });
  }
);

server.registerTool(
  "get_component",
  {
    title: "Get full ns-ui component detail",
    description:
      "Full detail for one ns-ui component by exact name: description, selection " +
      "guidance ('use when'), tags, condensed prop signature, npm dependencies, the " +
      "exact install command, and the real source of its component.tsx. Use " +
      "search_components first if you don't know the exact name.",
    inputSchema: {
      name: z
        .string()
        .describe("Exact component name, e.g. 'undo-ghost-row'. Case-sensitive, matches search_components' 'name' field."),
    },
  },
  async ({ name }) => {
    const component = findComponent(name);
    if (!component) {
      const snapshot = loadSnapshot();
      const suggestions = snapshot.components
        .filter((c) => c.name.includes(name) || name.includes(c.name))
        .slice(0, 5)
        .map((c) => c.name);
      return {
        ...json({
          error: `No component named "${name}".`,
          suggestions,
          hint: "Call search_components to find the right name.",
        }),
        isError: true,
      };
    }
    return json(component);
  }
);

server.registerTool(
  "list_components",
  {
    title: "List every ns-ui component",
    description:
      `The complete ns-ui catalog (${snapshot.components.length} components), one entry per component: ` +
      "name, title, collection and categories only — selection guidance and source are " +
      "deliberately omitted so the response stays bounded. Call get_component with any " +
      "name for the full detail and real source; use search_components when you already " +
      "know what you're looking for.",
    inputSchema: {
      collection: z
        .enum(["core", "loud"])
        .optional()
        .describe(
          "Restrict to one collection: 'core' (restrained, production-facing) or 'loud' (deliberately flashy showcase)."
        ),
    },
  },
  async ({ collection }) => {
    const snapshot = loadSnapshot();
    const components = snapshot.components
      .filter((c) => !collection || c.collection === collection)
      .map((c) => ({
        name: c.name,
        title: c.title,
        collection: c.collection,
        categories: c.categories,
      }));
    return json({ total: components.length, components });
  }
);

server.registerTool(
  "list_categories",
  {
    title: "List ns-ui categories",
    description:
      "The browsable taxonomy ns-ui components are organized into, with a count per " +
      "category and per collection (core/loud). Pass a category id to search_components " +
      "to filter by it.",
    inputSchema: {},
  },
  async () => {
    const snapshot = loadSnapshot();
    const byCollection = snapshot.collections.map((collection) => ({
      collection,
      count: snapshot.components.filter((c) => c.collection === collection).length,
    }));
    return json({
      generatedAt: snapshot.generatedAt,
      total: snapshot.components.length,
      categories: snapshot.categories,
      collections: byCollection,
    });
  }
);

server.registerTool(
  "install_command",
  {
    title: "Get the ns-ui install command",
    description:
      "The exact `npx shadcn add <url>` command to install one ns-ui component by name.",
    inputSchema: {
      name: z.string().describe("Exact component name, e.g. 'undo-ghost-row'."),
    },
  },
  async ({ name }) => {
    const component = findComponent(name);
    if (!component) {
      return {
        ...text(`No component named "${name}". Call search_components to find the right name.`),
        isError: true,
      };
    }
    return text(component.installCommand);
  }
);

server.registerTool(
  "get_conventions",
  {
    title: "Get ns-ui design/token conventions",
    description:
      "The token contract and stack assumptions every ns-ui component is built " +
      "against (--background/--foreground/--muted/--border/--accent, Tailwind v4, " +
      "React 19, prefers-reduced-motion, accessibility baseline). Read this before " +
      "writing code alongside an installed component so it doesn't look like a " +
      "foreign element in the same UI.",
    inputSchema: {},
  },
  async () => text(CONVENTIONS)
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[ns-ui-mcp] server ready on stdio");
