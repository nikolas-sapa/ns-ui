import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { loadWritingPosts } from "@/lib/writing";

// Same rationale as app/changelog/feed.xml/route.ts: content/writing/*.md is
// read at build time, same source as the page, so the feed can be a static
// file rather than a function invocation.
export const dynamic = "force-static";

// CDATA is the whole escaping strategy: the only sequence that can terminate a
// CDATA section is `]]>`, so stripping it is sufficient — an unescaped & or "
// in a post title or body cannot invalidate the feed.
const cdata = (s: string) => `<![CDATA[${s.replaceAll("]]>", "]]")}]]>`;

export function GET() {
  const items = loadWritingPosts()
    .map(
      (p) => `    <item>
      <title>${cdata(p.title)}</title>
      <link>${REGISTRY_ORIGIN}/writing/${p.slug}</link>
      <guid isPermaLink="false">${p.slug}</guid>
      <pubDate>${new Date(`${p.iso}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${cdata(p.description)}</description>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ns-ui writing</title>
    <link>${REGISTRY_ORIGIN}/writing</link>
    <description>Notes on building ns-ui, its registry, and the tools around it.</description>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
