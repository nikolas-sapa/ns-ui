import { PACKAGE_PUBLISHED } from "@/lib/package-publish-status";

/**
 * Per-client MCP config shapes. Every shape below was read off that client's
 * own current documentation (not inferred or remembered), fetched
 * 2026-08-01. Source noted per client so a future editor can re-check before
 * trusting this after a client updates its config format.
 *
 * `kind: "command"` means a real one-shot install exists — a CLI subcommand
 * that writes the client's own config file for you, verified against that
 * client's current docs or source (never guessed): Claude Code, VS Code
 * (`code --add-mcp`), Codex CLI (`codex mcp add`). Every other client was
 * checked for the same thing (CLI flag, deeplink, marketplace one-click) and
 * came up short for an arbitrary custom package — see the per-client comment
 * for what was checked and why it didn't qualify — so those stay
 * `kind: "config"`, the shortest manual path: file path, JSON, one sentence.
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
      // Also checked cursor.com/docs/reference/deeplinks and the CLI docs
      // (cursor.com/docs/cli/using) for a one-shot path: Cursor's deeplinks
      // cover prompts/commands/rules only (not MCP servers), the CLI has no
      // `--add-mcp`-style flag, and the marketplace's "one-click install" is
      // for servers already listed there, not an arbitrary custom package —
      // so there's no verified one-liner for Cursor, only this file.
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
      // `code --add-mcp` takes the same JSON server shape as `.vscode/mcp.json`
      // (top-level "servers" key) as a single CLI argument and installs it to
      // the user profile with no file to open by hand — this is VS Code's
      // real equivalent of `claude mcp add`.
      label: "VS Code",
      configPath: "one-liner, no file to edit",
      kind: "command",
      language: "bash",
      snippet: `code --add-mcp "${JSON.stringify({ name: "ns-ui", command, args }).replace(/"/g, '\\"')}"`,
      source:
        "github.com/microsoft/vscode-docs/blob/main/docs/agent-customization/mcp-servers.md, fetched 2026-08-01",
    },
    {
      id: "windsurf",
      // Verified 2026-08-01 at docs.windsurf.com/windsurf/cascade/mcp: file
      // is `~/.codeium/windsurf/mcp_config.json`, top-level "mcpServers" key
      // (confirmed via the page's own code-block metadata). Windsurf does have
      // a deeplink (windsurf://windsurf-mcp-registry?serverName=<name>), but
      // it only opens a server that's already listed in Windsurf's own MCP
      // registry page — it can't carry an arbitrary command+args for an
      // unlisted package like this one, so it isn't usable here.
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
      // command/args/env directly (no nested "type" or wrapper key). Zed's own
      // cli.md has no MCP-related flag and the docs describe adding a server
      // only through Settings → AI → MCP Servers or by hand in settings.json —
      // no CLI or deeplink install path exists to verify.
      label: "Zed",
      configPath: "settings.json (zed::OpenSettingsFile)",
      kind: "config",
      language: "json",
      snippet: json({ context_servers: { "ns-ui": { command, args, env: {} } } }),
      source: "github.com/zed-industries/zed/blob/main/docs/src/ai/mcp.md",
    },
    {
      id: "cline",
      // Verified 2026-08-01 at docs.cline.bot/mcp/configuring-mcp-servers:
      // top-level "mcpServers" key. CLI reads `~/.cline/mcp.json`; the IDE
      // extension edits the same shape through its own settings JSON (opened
      // from the MCP Servers panel). Cline CLI does have `cline mcp`, but it's
      // an interactive wizard (prompts for name/command/args one at a time,
      // no non-interactive add) — not a paste-and-done one-liner, so this
      // stays the file, kept as short as the shape allows.
      label: "Cline",
      configPath: "~/.cline/mcp.json (CLI) or the extension's MCP settings JSON",
      kind: "config",
      language: "json",
      snippet: json({
        mcpServers: { "ns-ui": { command, args, disabled: false, autoApprove: [] } },
      }),
      source: "docs.cline.bot/mcp/configuring-mcp-servers, fetched 2026-08-01",
    },
    {
      id: "codex",
      // Verified 2026-08-01 against github.com/openai/codex
      // codex-rs/cli/src/mcp_cmd.rs: a real `codex mcp add <name> -- <command>
      // [args...]` subcommand exists (clap `AddArgs` / `AddMcpStdioArgs`,
      // trailing_var_arg command), the same shape as `claude mcp add` — writes
      // straight to ~/.codex/config.toml, no file to edit by hand.
      label: "Codex CLI",
      configPath: "one-liner, no file to edit",
      kind: "command",
      language: "bash",
      snippet: `codex mcp add ns-ui -- ${command} ${args.join(" ")}`,
      source:
        "github.com/openai/codex/blob/main/codex-rs/cli/src/mcp_cmd.rs, fetched 2026-08-01",
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
