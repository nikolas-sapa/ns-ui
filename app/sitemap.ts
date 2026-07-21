import type { MetadataRoute } from "next";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// Minimal by design: the showcase is a single indexable page. /preview/[name]
// is an internal embed target for the showcase's demo cards, not content
// worth a search engine crawling on its own — see app/preview/[name]/page.tsx.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: REGISTRY_ORIGIN,
      lastModified: new Date(),
    },
  ];
}
