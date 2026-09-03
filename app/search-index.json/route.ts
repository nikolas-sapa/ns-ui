import { buildSearchCorpus } from "@/lib/search-corpus";

// The catalog's search corpus, prerendered into a static file at build time
// and fetched by <Showcase> on the first sign of a search — see
// lib/search-corpus.ts for what it holds and why it is not props.
//
// A route handler, not a file written into `public/`: `.vercelignore`
// excludes generated `public/` artefacts (`public/r/`, `public/llms.txt`),
// so a build-script emitter would 404 in production while working perfectly
// in dev. `force-static` prerenders this into `.next` alongside the pages,
// which is what actually ships.
export const dynamic = "force-static";

/**
 * Stable, unhashed URL — nothing in the filename changes when a deploy adds
 * components, so the freshness window has to say so explicitly. Same values
 * as `/nav-tree.json`, and the same reasoning: staleness here means a
 * just-added component matches on its name and title but not yet on its tags,
 * for at most one request after a deploy.
 */
const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400";

export function GET() {
  return new Response(JSON.stringify(buildSearchCorpus()), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": CACHE_CONTROL,
    },
  });
}
