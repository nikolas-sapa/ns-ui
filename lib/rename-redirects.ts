// Permanent redirects from every pre-rename slug to its current one.
//
// WHY THIS EXISTS, because the decision note says redirects were REJECTED:
// `08-Decisions/2026-08-01-freeze-r-json-install-urls.md` rejected a redirect
// layer as an escape hatch bought "for cosmetics", and closed with — "If the
// layer must exist anyway one day for some other reason, fine." This is that
// reason, and it is not cosmetic.
//
// That note assumed the 223-slug rename "landed before publication, which is
// exactly why it was survivable." That assumption is false in production.
// `@nikolas.sapa/ns-ui@0.2.0` ships `data/registry-index.json` containing 223
// slugs, and they are the OLD ones — zero new slugs appear anywhere in the
// tarball. Sampled 12 of them against the live origin: 12/12 returned 404.
// So the published CLI hands users install URLs that do not resolve, which is
// precisely the failure the freeze decision was written to prevent:
//
//   "Breaking an install URL produces a failed `npx shadcn add` inside
//    someone else's terminal or inside an agent's tool call — and there is no
//    analytics, no error reporting and no feedback channel here to surface
//    it. The site would look completely healthy while the actual product
//    silently stopped working."
//
// A published tarball is immutable, so republishing the CLI cannot repair the
// copies already installed. Only the origin can. Hence: permanent (308)
// redirects, generated from `docs/rename-map.tsv` rather than hand-listed, so
// they cannot drift from the rename that caused the problem.
//
// Scope note: this repairs the DISTRIBUTION channel (`/r/<slug>.json`) and the
// page shapes an old link might point at. It does not reopen slug renaming —
// the freeze still holds, and this layer exists to honour it, not to soften
// it. Anything added here is permanent and must survive future routing
// refactors, which is exactly the liability the original note warned about;
// that cost is now unavoidable because the breakage already shipped.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type SlugRedirect = { source: string; destination: string; permanent: true };

/** Parses `docs/rename-map.tsv` (tab-separated, header row, `old_slug` and
 *  `new_slug` first two columns). Pairs where the slug did not actually change
 *  are skipped — a self-redirect is a loop. */
function renamePairs(root: string): Array<[string, string]> {
  const raw = readFileSync(join(root, "docs/rename-map.tsv"), "utf8");
  const pairs: Array<[string, string]> = [];
  for (const line of raw.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const [oldSlug, newSlug] = line.split("\t");
    if (!oldSlug || !newSlug) continue;
    if (oldSlug === newSlug) continue;
    pairs.push([oldSlug.trim(), newSlug.trim()]);
  }
  return pairs;
}

/**
 * Every URL shape a pre-rename slug could appear in:
 *
 * - `/r/<slug>.json` — the install endpoint. THE one that matters; it is what
 *   the published CLI and MCP server construct, and what `npx shadcn add`
 *   fetches.
 * - `/components/<slug>` — the current public page.
 * - `/preview/<slug>` — the pre-move page shape (`2026-08-01-components-route-move`),
 *   which may still exist as a link. It remains a live route for the verify
 *   gate, so this only catches slugs that no longer resolve.
 * - `/preview/<slug>/play` — the pre-move page shape, AND (since
 *   `2026-08-06-play-route-fold`) a dead route for every slug, not just
 *   renamed ones — see the generic `/preview/:name/play` redirect in
 *   `next.config.ts` for current slugs. This one only needs to land an old
 *   slug's `/play` link on the new slug's canonical page in one hop.
 */
export function renameRedirects(root: string): SlugRedirect[] {
  const out: SlugRedirect[] = [];
  for (const [from, to] of renamePairs(root)) {
    out.push(
      { source: `/r/${from}.json`, destination: `/r/${to}.json`, permanent: true },
      { source: `/components/${from}`, destination: `/components/${to}`, permanent: true },
      { source: `/preview/${from}`, destination: `/components/${to}`, permanent: true },
      { source: `/preview/${from}/play`, destination: `/components/${to}`, permanent: true },
    );
  }
  return out;
}
