import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { jsonLdScript } from "@/lib/json-ld";
import { categoryPages } from "@/lib/category-pages";
import { CATEGORY_COPY } from "@/lib/category-copy";
import { ThemeToggle } from "../../_components/theme-toggle";

// Static-only: 12 known ids at build time, no per-request input. Matches
// `/components/[name]`'s `generateStaticParams` for `/preview/[name]/embed`
// and `/writing/[slug]` — an unknown id 404s rather than rendering a thin
// empty page on demand.
export function generateStaticParams() {
  return categoryPages().map((c) => ({ id: c.id }));
}
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const category = categoryPages().find((c) => c.id === id);
  const copy = CATEGORY_COPY[id];
  if (!category || !copy) return {};

  const title = `${copy.h1} — ns-ui`;
  const description = copy.intro;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * One of the 12 category hub pages — the missing middle layer between `/`
 * (one index) and `/components/<name>` (228 leaves). Static/SSG only, built
 * from `categorize()` against real registry tags (see
 * `lib/search-categories.ts`), never a hand-authored list.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = categoryPages().find((c) => c.id === id);
  const copy = CATEGORY_COPY[id];
  if (!category || !copy) notFound();

  const pageUrl = `${REGISTRY_ORIGIN}/categories/${id}`;

  const collectionPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.h1,
    description: copy.intro,
    url: pageUrl,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: category.members.length,
      itemListElement: category.members.map((m, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${REGISTRY_ORIGIN}/components/${m.name}`,
        name: m.title,
      })),
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ns-ui", item: REGISTRY_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Categories", item: `${REGISTRY_ORIGIN}/categories` },
      { "@type": "ListItem", position: 3, name: copy.h1, item: pageUrl },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-32 sm:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(collectionPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />

      <header className="pt-20 sm:pt-28">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
            <Link
              href="/categories"
              className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              ns-ui / categories
            </Link>
          </p>
          <ThemeToggle />
        </div>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          {copy.h1}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ns-muted">{copy.intro}</p>
        <p className="mt-4 font-mono text-xs text-ns-muted">{category.members.length} components</p>
      </header>

      <ol className="mt-16 space-y-10">
        {category.members.map((m) => (
          <li key={m.name} className="border-b border-border pb-10 last:border-none">
            <Link
              href={`/components/${m.name}`}
              className="group block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              <h2 className="text-lg font-medium tracking-tight text-foreground transition-colors group-hover:text-ns-accent">
                {m.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ns-muted">{m.description}</p>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-16 border-t border-border pt-6">
        <Link
          href="/categories"
          className="rounded-sm font-mono text-xs uppercase tracking-wider text-ns-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          All categories
        </Link>
      </div>
    </main>
  );
}
