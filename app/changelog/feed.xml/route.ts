import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { loadChangelog } from "../entries";

// CHANGELOG.md is read at build time, same source as the page, so the feed can
// be a static file rather than a function invocation.
export const dynamic = "force-static";

// CDATA is the whole escaping strategy: the only sequence that can terminate a
// CDATA section is `]]>`, so stripping it is sufficient — an unescaped & or "
// in a release title cannot invalidate the feed.
const cdata = (s: string) => `<![CDATA[${s.replaceAll("]]>", "]]")}]]>`;

export function GET() {
  const items = loadChangelog()
    .map(
      (e) => `    <item>
      <title>${cdata(e.title)}</title>
      <link>${REGISTRY_ORIGIN}/changelog#${e.version}</link>
      <guid isPermaLink="false">${e.version}</guid>
      <pubDate>${new Date(e.iso).toUTCString()}</pubDate>
      <description>${cdata(e.body)}</description>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ns-ui changelog</title>
    <link>${REGISTRY_ORIGIN}/changelog</link>
    <description>What shipped in ns-ui.</description>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
