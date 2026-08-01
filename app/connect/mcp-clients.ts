import { PACKAGE_PUBLISHED } from "@/lib/package-publish-status";

/**
 * Per-client MCP config shapes. Every shape below was read off that client's
 * own current documentation (not inferred or remembered), fetched
 * 2026-08-01. Source noted per client so a future editor can re-check before
 * trusting this after a client updates its config format.
 */

const LOCAL_ENTRY_POINT = "/path/to/ns-ui/mcp/src/index.ts";
const PKG = "@nikolas.sapa/ns-ui-mcp";

/** command + args for this client, given whether the package is published. */
function commandArgs(): { command: string; args: string[] } {
  return PACKAGE_PUBLISHED.mcp
    ? { command: "npx", args: ["-y", PKG] }
    : { command: "node", args: [LOCAL_ENTRY_POINT] };
}

const json = (obj: unknown) => JSON.stringify(obj, null, 2);

export type MCPClient = {
  id: string;
  label: string;
  /** Where this snippet is pasted, or how it's run for a one-liner. */
  configPath: string;
  /** "command" renders as a single shell line, "config" as a labelled file snippet. */
  kind: "command" | "config";
  language: "bash" | "json" | "toml";
  snippet: string;
  /** Where this shape was verified, for a future editor to re-check. */
  source: string;
};

export function getMcpClients(): MCPClient[] {
  const { command, args } = commandArgs();

  return [
    {
      id: "claude-code",
      label: "Claude Code",
      configPath: "one-liner, no file to edit",
      kind: "command",
      language: "bash",
      snippet: PACKAGE_PUBLISHED.mcp
        ? "claude mcp add ns-ui -- npx -y @nikolas.sapa/ns-ui-mcp"
        : `claude mcp add ns-ui -- node ${LOCAL_ENTRY_POINT}`,
      source: "mcp/README.md (this repo's own documented command)",
    },
    {
      id: "cursor",
      // Verified 2026-08-01 at cursor.com/docs/context/mcp: top-level
      // "mcpServers" key, project file `.cursor/mcp.json`, global file
      // `~/.cursor/mcp.json`. STDIO fields: command, args, env (no `cwd`).
      label: "Cursor",
      configPath: "~/.cursor/mcp.json (global) or .cursor/mcp.json (project)",
      kind: "config",
      language: "json",
      snippet: json({ mcpServers: { "ns-ui": { command, args } } }),
      source: "cursor.com/docs/context/mcp, fetched 2026-08-01",
    },
    {
      id: "vscode",
      // Verified 2026-08-01 at microsoft/vscode-docs
      // docs/agent-customization/mcp-servers.md (DateApproved 2026-07-29):
      // top-level key is "servers", not "mcpServers". File is
      // `.vscode/mcp.json` (workspace) or opened via "MCP: Open User
      // Configuration" (user profile).
      label: "VS Code",
      configPath: ".vscode/mcp.json",
      kind: "config",
      language: "json",
      snippet: json({ servers: { "ns-ui": { command, args } } }),
      source:
        "github.com/microsoft/vscode-docs/blob/main/docs/agent-customization/mcp-servers.md",
    },
    {
      id: "windsurf",
      // Verified 2026-08-01 at docs.windsurf.com/windsurf/cascade/mcp: file
      // is `~/.codeium/windsurf/mcp_config.json`, top-level "mcpServers" key
      // (confirmed via the page's own code-block metadata).
      label: "Windsurf",
      configPath: "~/.codeium/windsurf/mcp_config.json",
      kind: "config",
      language: "json",
      snippet: json({ mcpServers: { "ns-ui": { command, args } } }),
      source: "docs.windsurf.com/windsurf/cascade/mcp, fetched 2026-08-01",
    },
    {
      id: "zed",
      // Verified 2026-08-01 at github.com/zed-industries/zed
      // docs/src/ai/mcp.md: settings key is "context_servers", entries take
      // command/args/env directly (no nested "type" or wrapper key).
      label: "Zed",
      configPath: "settings.json (zed::OpenSettingsFile)",
      kind: "config",
      language: "json",
      snippet: json({ context_servers: { "ns-ui": { command, args, env: {} } } }),
      source: "github.com/zed-industries/zed/blob/main/docs/src/ai/mcp.md",
    },
    {
      id: "cline",
      // Verified 2026-08-01 at github.com/cline/cline docs/mcp/mcp-overview.mdx:
      // top-level "mcpServers" key. CLI reads `~/.cline/mcp.json`; the IDE
      // extension edits the same shape through its own settings JSON (opened
      // from the MCP Servers panel).
      label: "Cline",
      configPath: "~/.cline/mcp.json (CLI) or the extension's MCP settings JSON",
      kind: "config",
      language: "json",
      snippet: json({
        mcpServers: { "ns-ui": { command, args, disabled: false, autoApprove: [] } },
      }),
      source: "github.com/cline/cline/blob/main/docs/mcp/mcp-overview.mdx",
    },
    {
      id: "codex",
      // Verified 2026-08-01 at developers.openai.com/codex/extend/mcp: TOML,
      // not JSON. File `~/.codex/config.toml` (or project `.codex/config.toml`),
      // one `[mcp_servers.<name>]` table per server.
      label: "Codex CLI",
      configPath: "~/.codex/config.toml",
      kind: "config",
      language: "toml",
      snippet: [
        "[mcp_servers.ns-ui]",
        `command = "${command}"`,
        `args = [${args.map((a) => `"${a}"`).join(", ")}]`,
      ].join("\n"),
      source: "developers.openai.com/codex/extend/mcp, fetched 2026-08-01",
    },
    {
      id: "generic",
      label: "Other (generic mcpServers)",
      configPath: "wherever your client reads MCP server config",
      kind: "config",
      language: "json",
      snippet: json({ mcpServers: { "ns-ui": { command, args } } }),
      source: "the shape shared by Claude Desktop, Cursor, Windsurf and Cline above",
    },
  ];
}
