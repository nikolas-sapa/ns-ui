// Shared helper for emitting JSON-LD inside a `<script type="application/ld+json">`.
// `JSON.stringify` alone is not safe to inline into HTML: a description field
// containing the literal string `</script>` would close the tag early and let
// the rest run as markup/script. Escaping `<` as its unicode escape defuses
// that without touching the JSON semantics (a JSON string may contain a raw
// `<`, so this only matters for what ends up in the HTML byte stream).
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
