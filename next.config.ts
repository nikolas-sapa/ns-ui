import type { NextConfig } from "next";
import { renameRedirects } from "./lib/rename-redirects";

const nextConfig: NextConfig = {
  // keep corpus screenshots clean
  devIndicators: false,
  // `/registry.json` is the conventional root path a shadcn-registry-aware
  // agent tries first; the actual index is emitted (by `shadcn build`) at
  // `/r/registry.json` alongside the per-component files. Rewrite so both
  // paths serve the same static file instead of hand-copying it — this runs
  // at request time so it works on a clean Vercel build with no extra script
  // step, and can't drift from the file `shadcn build` regenerates.
  async rewrites() {
    // `beforeFiles`, not the plain array form: `/` is prerendered to a static
    // file, and an `afterFiles` rewrite (what a bare array becomes) loses to
    // the filesystem — the homepage kept serving HTML to an
    // `Accept: text/markdown` request while every non-prerendered path
    // negotiated correctly. Only the negotiation rules move; the
    // `/registry.json` alias stays in `afterFiles`, where a real file at that
    // path should still win.
    return {
      beforeFiles: [
        // acceptmarkdown.com: a request that names `text/markdown` in Accept
        // gets the markdown variant of the same URL, served by
        // `app/api/md/[[...slug]]/route.ts`. Matched at the routing layer
        // rather than in proxy.ts on purpose — see that route's header
        // comment for why the middleware must not grow a matcher covering
        // `/`.
        //
        // The `has` regex can only test "the string appears"; the route
        // itself re-reads Accept and falls back to HTML when a q-value ranked
        // HTML higher. Over-matching here is the cheap half of that split.
        {
          source: "/",
          has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }],
          destination: "/api/md",
        },
        // Everything else, minus the prefixes with no prose to serve. `/api/`
        // in particular is what keeps the rewrite from pointing at itself.
        //
        // `[^.]*`, not `.*`: `beforeFiles` runs AHEAD of the filesystem, so a
        // `.*` here rewrote /llms.txt, /llms-full.txt, /registry.json,
        // /sitemap.xml and /robots.txt to the markdown route — which has no
        // entry for them — and handed a 404 to any client sending
        // `Accept: text/markdown, */*`. That is the exact audience these files
        // exist for. Prose routes never contain a dot; every static file does,
        // so excluding dotted paths is the whole rule.
        {
          source: "/:path((?!api/|_next/|r/|v1/|mcp|\\.well-known/)[^.]*)",
          has: [{ type: "header", key: "accept", value: ".*text/markdown.*" }],
          destination: "/api/md/:path",
        },
      ],
      afterFiles: [
        { source: "/registry.json", destination: "/r/registry.json" },
        // Two aliases onto the one MCP handler, because clients disagree about
        // where a server lives: `/mcp` is what most config snippets use, and
        // `.json` is what a crawler expecting a static manifest tries. Same
        // route, so GET and POST behave identically at all three URLs and
        // there is no second copy of the handshake to drift.
        { source: "/mcp", destination: "/.well-known/mcp" },
        { source: "/.well-known/mcp.json", destination: "/.well-known/mcp" },
        // `/v1` — URL-path versioning for the public read-only API. These are
        // aliases, not copies: one handler each, so the versioned and
        // unversioned URLs cannot answer differently. What the prefix buys is
        // a promise — `/v1` keeps its current shapes, and a breaking change
        // becomes `/v2` with the old prefix carrying `Deprecation`/`Sunset`
        // headers for the documented window (see /docs and openapi.json).
        // Unmatched `/v1/*` falls through to app/v1/[...path], which answers
        // with the same JSON problem document as the rest of the API.
        { source: "/v1/registry.json", destination: "/r/registry.json" },
        { source: "/v1/r/:name.json", destination: "/r/:name.json" },
        { source: "/v1/openapi.json", destination: "/openapi.json" },
        { source: "/v1/llms.txt", destination: "/llms.txt" },
        { source: "/v1/mcp", destination: "/.well-known/mcp" },
      ],
    };
  },
  // The HTML half of the same negotiation, best-effort.
  //
  // Measured under `next start` (Next 16.2): custom headers ARE applied — a
  // probe header set alongside this one came back on the response — but Next
  // then writes its own `Vary` for the router (`rsc, next-router-*`) over the
  // top, so `Accept` does not survive on a page response. Kept anyway,
  // because it costs nothing and Vercel's edge applies config headers at the
  // routing layer rather than in the Next server.
  //
  // Nothing depends on it: the two variants are split by ROUTE (`/` vs
  // `/api/md`) before any cache lookup, so they cannot collide on one cache
  // key the way a same-URL negotiation would. The spec-required
  // `Vary: Accept` is on the markdown response, which the markdown route
  // sets itself and Next does not touch.
  async headers() {
    return [
      {
        source: "/",
        headers: [{ key: "Vary", value: "Accept" }],
      },
      {
        source: "/components/:name",
        headers: [{ key: "Vary", value: "Accept" }],
      },
    ];
  },
  // Repairs the 223 pre-rename slugs that the published CLI still hands out
  // and that 404 today. Generated from `docs/rename-map.tsv`, never
  // hand-listed — see `lib/rename-redirects.ts` for why this layer exists
  // despite the freeze decision having rejected redirects.
  async redirects() {
    return [
      // Rename-specific pairs first: an old, renamed slug's `/play` link has
      // its own one-hop rule straight to the new slug's component page (see
      // `lib/rename-redirects.ts`). Ordered ahead of the generic rule below
      // so it wins the match instead of bouncing through `/components/<old>`
      // first.
      ...renameRedirects(process.cwd()),
      // `/preview/<name>/play` no longer exists for any current slug —
      // everything it uniquely had (source, build spec) moved onto
      // `/components/<name>`, which already rendered the same DemoStage.
      // Permanent, not just for old external links and the owner's own
      // recordings, but because `/components/<name>` is genuinely the
      // correct destination now, not a temporary detour.
      {
        source: "/preview/:name/play",
        destination: "/components/:name",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
