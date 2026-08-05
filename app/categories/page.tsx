import type { Metadata } from "next";
import Link from "next/link";
import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { jsonLdScript } from "@/lib/json-ld";
import { categoryPages } from "@/lib/category-pages";
import { CATEGORY_COPY } from "@/lib/category-copy";

// Same `registry.items.length` the home page and sidebar count from, so the
// hub can never quote a total the rest of the site disagrees with.
const COMPONENT_COUNT = registry.items.length;

export const metadata: Metadata = {
  title: "Categories — ns-ui",
  description: `Browse ns-ui's ${COMPONENT_COUNT} React components by category — heroes, navigation, forms, charts, feedback and more.`,
};

/**
 * The hub `/categories` points at, and the only page that lists all 12
 * category URLs in one place — see `app/categories/[id]/page.tsx` for the
 * per-category page each entry links to.
 */
export default function CategoriesIndexPage() {
  const categories = categoryPages();

  const collectionPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "ns-ui categories",
    url: `${REGISTRY_ORIGIN}/categories`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: categories.length,
      itemListElement: categories.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${REGISTRY_ORIGIN}/categories/${c.id}`,
        name: CATEGORY_COPY[c.id]?.h1 ?? c.label,
      })),
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ns-ui", item: REGISTRY_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Categories", item: `${REGISTRY_ORIGIN}/categories` },
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
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
          ns-ui / categories
        </p>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          Categories.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ns-muted">
          {COMPONENT_COUNT} components grouped by the role a developer already has a word
          for — pick one to see everything in it.
        </p>
      </header>

      <ol className="mt-16 space-y-8">
        {categories.map((c) => (
          <li key={c.id} className="border-b border-border pb-8 last:border-none">
            <Link
              href={`/categories/${c.id}`}
              className="group block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-medium tracking-tight text-foreground transition-colors group-hover:text-ns-accent">
                  {CATEGORY_COPY[c.id]?.h1 ?? c.label}
                </h2>
                <span className="font-mono text-xs text-ns-muted">{c.members.length}</span>
              </div>
              {CATEGORY_COPY[c.id] ? (
                <p className="mt-2 text-sm leading-relaxed text-ns-muted">
                  {CATEGORY_COPY[c.id].intro}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-16 border-t border-border pt-6">
        <Link
          href="/"
          className="rounded-sm font-mono text-xs uppercase tracking-wider text-ns-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
        >
          Back to the catalog
        </Link>
      </div>
    </main>
  );
}
