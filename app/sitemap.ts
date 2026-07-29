import type { MetadataRoute } from "next";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { loadWritingPosts } from "@/lib/writing";

// Minimal by design: the showcase is a single indexable page. /preview/[name]
// is an internal embed target for the showcase's demo cards, not content
// worth a search engine crawling on its own — see app/preview/[name]/page.tsx.
// /writing is a real content surface (linked from Reddit/X/Instagram), so its
// index and each post are listed too.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: REGISTRY_ORIGIN,
      lastModified: new Date(),
    },
    {
      url: `${REGISTRY_ORIGIN}/writing`,
      lastModified: new Date(),
    },
    ...loadWritingPosts().map((post) => ({
      url: `${REGISTRY_ORIGIN}/writing/${post.slug}`,
      lastModified: new Date(`${post.iso}T00:00:00Z`),
    })),
  ];
}
