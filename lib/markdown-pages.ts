import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// The markdown representation of the site, for the `Accept: text/markdown`
// variant served by app/api/md/route.ts.
//
// Deliberately NOT an HTML-to-markdown conversion of the rendered pages: the
// pages are live demos (canvas, WebGL, cursor-reactive) whose DOM says almost
// nothing useful in prose. The registry metadata that already feeds llms.txt
// IS the honest text of this site, so both surfaces are built from it.
//
// Everything here is derived from `registry.json` or a route that exists
// under `app/` — a stale hand-written path in this file would hand agents a
// dead link with the site's own authority behind it.

type Item = (typeof registry.items)[number];

const byName = new Map(registry.items.map((i) => [i.name, i]));

/** The machine-readable surface every page's markdown footer points at. */
const AGENT_ENTRY_POINTS = [
  `- Catalog index (shadcn registry): ${REGISTRY_ORIGIN}/registry.json`,
  `- Agent quickstart: ${REGISTRY_ORIGIN}/llms.txt`,
  `- Full per-component detail: ${REGISTRY_ORIGIN}/llms-full.txt`,
  `- MCP server manifest: ${REGISTRY_ORIGIN}/.well-known/mcp`,
  `- Sitemap: ${REGISTRY_ORIGIN}/sitemap.xml`,
].join("\n");

/**
 * Static routes with a markdown representation, and the one line each says
 * about itself. Anything not listed here (and not a component page) has no
 * markdown variant — see `renderMarkdown`'s 406 branch.
 */
const STATIC_PAGES: Record<string, { title: string; summary: string }> = {
  "/install": {
    title: "Install",
    summary:
      "How to install a component: one `npx shadcn add <url>` command per component, the CSS tokens the host app must already define, and the peer dependencies.",
  },
  "/theming": {
    title: "Theming",
    summary:
      "The CSS custom properties every component reads (--background, --foreground, --ns-muted, --border, --ns-accent, --surface, --error, --warning) and how to map them onto an existing design system.",
  },
  "/connect": {
    title: "Connect ns-ui to an agent",
    summary:
      "Developer resources: the ns-ui MCP server (search_components, get_component, list_categories, install_command, get_conventions), the ns-ui CLI, and the raw text feeds.",
  },
  "/categories": {
    title: "Categories",
    summary: "Every browsable category in the registry, with its component count.",
  },
  "/changelog": {
    title: "Changelog",
    summary: "What shipped, newest first. RSS: /changelog/feed.xml.",
  },
  "/writing": {
    title: "Writing",
    summary: "Notes on building the registry. RSS: /writing/feed.xml.",
  },
  "/community": {
    title: "Community",
    summary: "Contributors, testimonials, and how to propose a component.",
  },
  "/guidelines": {
    title: "Community guidelines",
    summary: "What gets accepted into the registry, and what does not.",
  },
  "/status": {
    title: "Status",
    summary:
      "Live health of the published surfaces: the registry JSON, the npm packages, and the MCP server.",
  },
  "/about": {
    title: "About ns-ui",
    summary:
      "What ns-ui is, who maintains it, how components are built and gated, and how to get in touch.",
  },
  "/privacy": {
    title: "Privacy",
    summary:
      "What this site stores, which third parties process it, and how to have it deleted.",
  },
  "/submit": {
    title: "Submit a component",
    summary: "Propose a component for the registry.",
  },
  "/feedback": {
    title: "Feedback",
    summary:
      "Where to report a bug in a component or on the site, and how to reach the maintainer privately.",
  },
  "/suggest": {
    title: "Suggest a feature",
    summary:
      "Where to propose a component idea or a feature for the CLI, MCP server, or site, and what each is judged on.",
  },
};

/** Routes that exist but are not prose — asking for markdown here is a 406. */
const NO_MARKDOWN = /^\/(api|r|preview|u|account|welcome)(\/|$)/;

const installFor = (name: string) =>
  `npx shadcn add ${REGISTRY_ORIGIN}/r/${name}.json`;

function componentMarkdown(item: Item): string {
  const meta = item.meta as
    | { collection?: string; tags?: string[]; instruction?: string }
    | undefined;
  const lines = [
    `# ${item.title}`,
    "",
    item.description ?? "",
    "",
    "## Install",
    "",
    "```sh",
    installFor(item.name),
    "```",
    "",
    `- Name: \`${item.name}\``,
    `- Collection: ${meta?.collection ?? "core"}`,
  ];
  if (meta?.tags?.length) lines.push(`- Tags: ${meta.tags.join(", ")}`);
  lines.push(`- Page: ${REGISTRY_ORIGIN}/components/${item.name}`);
  lines.push(`- Registry item: ${REGISTRY_ORIGIN}/r/${item.name}.json`);
  if (meta?.instruction) {
    lines.push("", "## How to use it", "", meta.instruction);
  }
  lines.push("", "---", "", AGENT_ENTRY_POINTS, "");
  return lines.join("\n");
}

function homeMarkdown(): string {
  return [
    "# ns-ui",
    "",
    `A personal registry of ${registry.items.length} React components, each built around a single interaction.`,
    "Install any of them as plain source you own — no runtime package, no account, no API key.",
    "",
    "## Install",
    "",
    "```sh",
    `npx shadcn add ${REGISTRY_ORIGIN}/r/<name>.json`,
    "```",
    "",
    "## Developer resources",
    "",
    AGENT_ENTRY_POINTS,
    `- MCP server on npm: \`npx -y @nikolas.sapa/ns-ui-mcp\` (setup: ${REGISTRY_ORIGIN}/connect)`,
    `- CLI on npm: \`npx @nikolas.sapa/ns-ui add <name>\``,
    `- Source: https://github.com/nikolas-sapa/ns-ui`,
    "",
    "## Pages",
    "",
    ...Object.entries(STATIC_PAGES).map(
      ([path, page]) => `- [${page.title}](${REGISTRY_ORIGIN}${path}) — ${page.summary}`,
    ),
    "",
    "## Components",
    "",
    ...registry.items.map(
      (i) => `- [${i.title}](${REGISTRY_ORIGIN}/components/${i.name}) — ${i.description ?? ""}`,
    ),
    "",
  ].join("\n");
}

function staticMarkdown(path: string): string {
  const page = STATIC_PAGES[path];
  return [
    `# ${page.title}`,
    "",
    page.summary,
    "",
    `Rendered page: ${REGISTRY_ORIGIN}${path}`,
    "",
    "---",
    "",
    AGENT_ENTRY_POINTS,
    "",
  ].join("\n");
}

/** The 404 body — the one an agent can actually recover from. */
export function notFoundMarkdown(path: string): string {
  return [
    "# 404 — no page at this address",
    "",
    `\`${path}\` does not exist on ${REGISTRY_ORIGIN}.`,
    "",
    "## Where to look instead",
    "",
    `- Component pages live at \`/components/<name>\` — every name is listed in ${REGISTRY_ORIGIN}/llms.txt`,
    `- Registry JSON for one component: \`/r/<name>.json\``,
    "",
    AGENT_ENTRY_POINTS,
    "",
  ].join("\n");
}

export type MarkdownResult =
  | { status: 200; body: string }
  | { status: 404; body: string }
  | { status: 406; body: string };

/** Resolve one pathname to its markdown representation. */
export function renderMarkdown(path: string): MarkdownResult {
  // Trailing slash is the same page; `/` itself is the homepage.
  const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;

  if (clean === "/") return { status: 200, body: homeMarkdown() };

  if (NO_MARKDOWN.test(clean)) {
    return {
      status: 406,
      body: `${clean} has no markdown representation. Prose pages that do are listed in ${REGISTRY_ORIGIN}/llms.txt.\n`,
    };
  }

  if (STATIC_PAGES[clean]) return { status: 200, body: staticMarkdown(clean) };

  const component = clean.match(/^\/components\/([^/]+)$/)?.[1];
  const item = component ? byName.get(component) : undefined;
  if (item) return { status: 200, body: componentMarkdown(item) };

  return { status: 404, body: notFoundMarkdown(clean) };
}
