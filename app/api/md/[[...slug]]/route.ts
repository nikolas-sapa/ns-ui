import { prefersMarkdown } from "@/lib/markdown-negotiation";
import { renderMarkdown } from "@/lib/markdown-pages";

// The `Accept: text/markdown` variant of every prose page (acceptmarkdown.com).
//
// Requests never address this route directly: next.config.ts rewrites any
// request whose Accept header mentions `text/markdown` here, preserving the
// original pathname as this catch-all's segments (a `?path=` query was the
// first shape; the rewrite did not interpolate it, so every path silently
// rendered the homepage's markdown — a catch-all cannot fail that way,
// because a missing path is a different route). That routing-layer rewrite
// is deliberate —
// the obvious alternative, doing the negotiation in proxy.ts, would put the
// middleware (and therefore `convexAuthNextjsMiddleware`, and therefore a
// possible Set-Cookie) on `/` and `/components/<name>`, which is exactly the
// cached, anonymous, CDN-served set proxy.ts's own header comment and
// docs/perf-audit-2026-07.md spend their length protecting.
//
// Node runtime, not Edge: this imports registry.json (~9k lines), which is
// well past what belongs in an Edge bundle.
export const runtime = "nodejs";

const MARKDOWN = "text/markdown; charset=utf-8";

// `Accept` is the whole point: one URL now has two bodies, and Vercel's CDN
// does not put the Accept header in its cache key unless the response says
// to. Without this a cached markdown body could be served to a browser (and
// vice versa) depending only on which variant landed in the cache first. The
// HTML side of the same URLs gets the matching header from next.config.ts.
const VARY = "Accept, Accept-Encoding";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
): Promise<Response> {
  const url = new URL(request.url);
  const { slug } = await params;
  const path = slug?.length ? `/${slug.map(decodeURIComponent).join("/")}` : "/";
  const accept = request.headers.get("accept");

  // The rewrite can only match "the string text/markdown appears somewhere in
  // Accept" — it cannot compare q-values. A client that ranked HTML above
  // markdown (`text/html;q=1.0, text/markdown;q=0.5`) lands here anyway, so
  // hand it the HTML it actually asked for. Loop-safe: the sub-request's
  // Accept has no `text/markdown` in it, so the rewrite cannot match it.
  if (!prefersMarkdown(accept)) {
    const html = await fetch(new URL(path, url.origin), {
      headers: { accept: "text/html" },
    });
    return new Response(html.body, {
      status: html.status,
      headers: {
        "content-type": html.headers.get("content-type") ?? "text/html; charset=utf-8",
        vary: VARY,
      },
    });
  }

  const { status, body } = renderMarkdown(path);
  return new Response(body, {
    status,
    headers: {
      "content-type": status === 406 ? "text/plain; charset=utf-8" : MARKDOWN,
      vary: VARY,
      // Same posture as the HTML variant: revalidate every time, let the CDN
      // hold it. The body is derived from build-time data, so it only changes
      // on deploy.
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
