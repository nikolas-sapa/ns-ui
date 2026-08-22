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

// Highest q for `type`, honouring the "*/*" and "text/*" wildcard ranges.
function qFor(ranked: Ranked[], type: string): number {
  const [group] = type.split("/");
  let best = 0;
  for (const r of ranked) {
    if (r.type === type || r.type === `${group}/*` || r.type === "*/*") {
      best = Math.max(best, r.q);
    }
  }
  return best;
}

/**
 * True only when the client named `text/markdown` explicitly AND ranked it at
 * least as high as `text/html`.
 *
 * Explicitly, not "no text/html found": a bare `curl` sends the catch-all
 * wildcard range, and
 * every unknown crawler that omits the header entirely resolves to the same
 * wildcard. Serving those markdown would change what the site returns to most
 * non-browser traffic, which is a far bigger blast radius than the one this
 * feature is for.
 *
 * Ties go to markdown: a client that bothered to list `text/markdown` at equal
 * weight is asking for it.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const ranked = parseAccept(accept);
  const markdown = ranked.find(
    (r) => r.type === "text/markdown" || r.type === "text/x-markdown",
  );
  if (!markdown || markdown.q === 0) return false;
  return markdown.q >= qFor(ranked, "text/html");
}
