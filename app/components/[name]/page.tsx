import type { Metadata } from "next";
import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { jsonLdScript } from "@/lib/json-ld";
import { DemoFrame } from "@/app/_components/demo-frame";
import pkg from "@/package.json";

// package.json's repository.url is the git clone URL (`...ns-ui.git`);
// schema.org's `codeRepository` wants the browsable repo URL instead.
const CODE_REPOSITORY = pkg.repository.url.replace(/\.git$/, "");
const LICENSE_URL =
  pkg.license === "MIT"
    ? "https://opensource.org/licenses/MIT"
    : undefined;

// The per-component opengraph-image.tsx in this same folder is picked up by
// the file-convention automatically — this only needs to supply the title
// and description text, both openGraph and twitter fall back to `title`/
// `description` unless overridden, so they're set explicitly instead to
// guarantee og:title/twitter:title are correct rather than relying on that
// implicit resolution.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const item = registry.items.find((i) => i.name === name);
  if (!item) return {};

  const title = `${item.title} — ns-ui`;
  const description = item.description;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * The canonical, indexed, chrome-wrapped page for a component — one of the
 * 228 pages `site:design.helpmarq.com` should actually return. This is what
 * `app/sitemap.ts` lists, what `app/page.tsx`'s CollectionPage JSON-LD points
 * at, and what carries the SoftwareSourceCode/BreadcrumbList structured data
 * below.
 *
 * `/preview/<name>` (see that route's own docblock) renders the identical
 * `DemoFrame`, chrome-less, noindex, canonical back to this URL — it exists
 * only as the verification/recording fixture. Deliberately not this file:
 * see `/preview/<name>` for why the gate cannot run against this chrome-full
 * page or against `/preview/<name>/embed`.
 */
export default async function ComponentPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ embed?: string; autoplay?: string; interactive?: string }>;
}) {
  const { name } = await params;
  const { embed, autoplay, interactive } = await searchParams;

  const item = registry.items.find((i) => i.name === name);
  const pageUrl = `${REGISTRY_ORIGIN}/components/${name}`;

  // Only fields populated from real registry/package data — nothing here is
  // invented to fill out the schema. Server-rendered (this is an async
  // Server Component), so crawlers see it in the initial HTML.
  const softwareSourceCodeJsonLd = item
    ? {
        "@context": "https://schema.org",
        "@type": "SoftwareSourceCode",
        name: item.title,
        description: item.description,
        url: pageUrl,
        programmingLanguage: "TypeScript",
        codeRepository: CODE_REPOSITORY,
        ...(LICENSE_URL ? { license: LICENSE_URL } : {}),
      }
    : null;

  const breadcrumbJsonLd = item
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "ns-ui", item: REGISTRY_ORIGIN },
          { "@type": "ListItem", position: 2, name: item.title, item: pageUrl },
        ],
      }
    : null;

  return (
    <>
      {softwareSourceCodeJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(softwareSourceCodeJsonLd) }}
        />
      ) : null}
      {breadcrumbJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
        />
      ) : null}
      <DemoFrame name={name} embed={embed} autoplay={autoplay} interactive={interactive} />
    </>
  );
}
