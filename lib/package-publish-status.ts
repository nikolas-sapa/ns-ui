/**
 * What's actually on npm right now for the two packages this repo publishes
 * outside the component registry itself: the MCP server (`mcp/`) and the CLI
 * (`cli/`). Checked with `npm show <pkg> version`.
 *
 * Every surface that tells a visitor or an agent to run one of these
 * packages reads from this file — the `/connect` page, `scripts/build-llms.ts`
 * (which writes `public/llms.txt` / `public/llms-full.txt`). README.md and
 * AGENTS.md are hand-maintained prose and can't import this, so they're
 * written to match this state as of the date below; re-check them by hand
 * when either flag flips.
 *
 * Flip a flag to `true` the moment that package's `npm publish` succeeds,
 * then run `npm run registry:build` to regenerate llms.txt. Nothing else
 * needs to change in code.
 */
export const PACKAGE_PUBLISHED = {
  /**
   * @nikolas.sapa/ns-ui-mcp — 0.1.0 published as of 2026-08-01. Verified live:
   * installed from the registry into a scratch dir and driven over stdio,
   * all five tools present (search_components, get_component, list_categories,
   * install_command, get_conventions).
   */
  mcp: true,
  /** @nikolas.sapa/ns-ui — 0.2.0 published as of 2026-08-01. add/list/search/
   *  info/categories/mcp all work. */
  cliSearch: true,
} as const;
