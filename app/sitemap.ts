import type { MetadataRoute } from "next";
import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { loadWritingPosts } from "@/lib/writing";
import { categoryPages } from "@/lib/category-pages";

// Reversed 2026-08-01: the comment this replaced called /preview/[name] "an
// internal embed target... not content worth a search engine crawling on its
// own." That was true when those pages only backed the showcase's demo
// cards. They are now the only pages describing each of the registry's
// components, and excluding them was why `site:design.helpmarq.com`
// returned nothing — this omission wasn't an oversight when it was written,
// the reasoning underneath it changed. Only the honest reference route is
// listed, and as of the same day it is `/components/<name>` rather than
// `/preview/<name>` — the latter is now the verification/recording fixture
// (bare, noindex, canonical back to `/components/<name>` — see
// app/preview/[name]/page.tsx), not a redirect. `/preview/<name>/embed`
// duplicates the fixture's DOM verbatim for iframe use and is marked noindex
// instead (see app/preview/[name]/embed/page.tsx), and `/preview/<name>/play`
// stayed out for the same reason before it was deleted outright
// (`2026-08-06-play-route-fold`): it rendered the same DemoStage as
// `/components/<name>`, and everything it had that page didn't (source,
// build spec) now lives there too, so the route itself is gone and
// `/preview/<name>/play` permanently redirects to `/components/<name>`
// (see `next.config.ts`).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: REGISTRY_ORIGIN,
      lastModified: new Date(),
    },
    {
      url: `${REGISTRY_ORIGIN}/changelog`,
      lastModified: new Date(),
    },
    {
      url: `${REGISTRY_ORIGIN}/install`,
      lastModified: new Date(),
    },
    {
      url: `${REGISTRY_ORIGIN}/theming`,
      lastModified: new Date(),
    },
    {
      url: `${REGISTRY_ORIGIN}/connect`,
      lastModified: new Date(),
    },
    {
      url: `${REGISTRY_ORIGIN}/categories`,
      lastModified: new Date(),
    },
    {
      url: `${REGISTRY_ORIGIN}/status`,
      lastModified: new Date(),
    },
    {
      url: `${REGISTRY_ORIGIN}/community`,
      lastModified: new Date(),
    },
    {
      url: `${REGISTRY_ORIGIN}/guidelines`,
      lastModified: new Date(),
    },
    ...categoryPages().map((c) => ({
      url: `${REGISTRY_ORIGIN}/categories/${c.id}`,
      lastModified: new Date(),
    })),
    ...registry.items.map((item) => ({
      url: `${REGISTRY_ORIGIN}/components/${item.name}`,
      lastModified: new Date(),
    })),
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
