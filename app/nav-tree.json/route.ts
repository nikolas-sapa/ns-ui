import { navGroups, packNavTree } from "@/lib/nav-data";

/**
 * The sidebar's full component tree, prerendered into one static file and
 * fetched by `SiteShell` on the first sign that someone wants it — see
 * `lib/nav-tree.ts` for the wire shape.
 *
 * It used to travel as props from `app/layout.tsx` into a Client Component,
 * which means it was serialized into the inline RSC flight payload of every
 * document the site prerenders: 562 of them, including `/about` (a text page
 * with no components on it) and all twelve card iframes a gallery view mounts
 * at once. Same bytes, re-sent on every navigation, uncacheable because they
 * are part of the HTML. Here they are one CDN-cached response instead.
 *
 * A route handler, not a file written into `public/`: `.vercelignore`
 * excludes generated `public/` artefacts, so a build-script emitter would 404
 * in production while working perfectly in dev. `force-static` prerenders this
 * into `.next` alongside the pages, which is what actually ships.
 */
export const dynamic = "force-static";

/**
 * Unlike the hashed JS chunk this replaces, the URL is stable — so a deploy
 * that adds components cannot rely on a new filename to invalidate it. Five
 * minutes of hard freshness keeps same-session navigations from re-requesting
 * it at all; a day of `stale-while-revalidate` means the worst case after a
 * deploy is one visitor seeing the previous tree once while the new one is
 * fetched behind them. Staleness here is "a component added in the last few
 * minutes is missing from the sidebar", not a broken page.
 */
const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400";

export function GET() {
  return new Response(JSON.stringify(packNavTree(navGroups())), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": CACHE_CONTROL,
    },
  });
}
