// Accept-header parsing for the markdown variant (acceptmarkdown.com).
//
// Kept out of the route handler so the q-value rule is testable on its own —
// the route itself is a thin body-builder around `prefersMarkdown`.
//
// Only three outcomes matter here, and the third is the reason this file
// isn't a one-liner: a client can list BOTH types with q-values
// (`text/html;q=1.0, text/markdown;q=0.5`), and the routing rewrite in
// next.config.ts can only match on "the string text/markdown appears" — it
// cannot compare two numbers. So the rewrite over-matches on purpose and this
// function is what decides, per request, whether markdown actually won.

type Ranked = { type: string; q: number };

/** RFC 9110 §12.5.1 — media ranges with an optional `q` parameter. */
function parseAccept(header: string): Ranked[] {
  return header
    .split(",")
    .map((part) => {
      const [type, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      // A malformed q ("q=" or "q=abc") is not a zero — RFC 9110 treats an
      // unparseable parameter as absent, and defaulting to 0 would silently
      // drop a type the client did ask for.
      const parsed = qParam ? Number.parseFloat(qParam.trim().slice(2)) : NaN;
      const q = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 1;
      return { type: type.trim().toLowerCase(), q };
    })
    .filter((r) => r.type.length > 0);
}

/**
 * True only when the client named `text/markdown` explicitly AND ranked it
 * STRICTLY above whatever else it will accept.
 *
 * Explicitly, because a bare `curl` and every crawler that omits the header
 * resolve to the catch-all range, and serving those markdown would change
 * what most non-browser traffic gets.
 *
 * Strictly, because of what ties mean in practice. `Accept: text/markdown`
 * on its own is a client that wants markdown and nothing else — the exact
 * request acceptmarkdown.com's conformance check sends, and it still gets
 * markdown here. A markdown listing alongside the catch-all range is a
 * different animal: an
 * indexer saying "markdown is fine, so is anything else", and handing that
 * one markdown swaps the page's real HTML — headings, structured data, the
 * whole document — for a text file, which is how an agent audit came to
 * report "no H1" on this site. Equal weight is not a preference, so the
 * catch-all wins and HTML is served.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const ranked = parseAccept(accept);
  const markdown = ranked.find(
    (r) => r.type === "text/markdown" || r.type === "text/x-markdown",
  );
  if (!markdown || markdown.q === 0) return false;

  // Everything the client would also take: HTML by name, plus either wildcard
  // range. The markdown entry itself is excluded so it never outranks itself.
  const alternatives = ranked.filter(
    (r) => r !== markdown && (r.type === "text/html" || r.type === "text/*" || r.type === "*/*"),
  );
  if (alternatives.length === 0) return true;
  return markdown.q > Math.max(...alternatives.map((r) => r.q));
}
