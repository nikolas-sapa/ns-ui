import type { Metadata } from "next";
import Link from "next/link";
import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { jsonLdScript } from "@/lib/json-ld";
import { DemoFrame } from "@/app/_components/demo-frame";
import { loadUseWhen } from "@/lib/use-when";
import { loadComponentProps } from "@/lib/component-props";
import { CopyButton } from "@/app/_components/copy-button";
import { ComponentSave } from "@/app/_components/component-save";
import { categoriesFor } from "@/lib/category-pages";
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
  const installCommand = `npx shadcn add ${REGISTRY_ORIGIN}/r/${name}.json`;

  // Hand-authored only (106 of 228 today) — see lib/use-when.ts. The other
  // 122 have no meta.useWhen, so llms.txt's `deriveUseWhen`
  // (scripts/build-llms.ts) falls back to a tag restatement for them — that
  // fallback is not guidance, so it is left off this page entirely rather
  // than rendered as if it were.
  const useWhen = item ? loadUseWhen()[item.name] : undefined;
  const props = item ? loadComponentProps(item.name) : null;
  // Tags aren't category ids (most, like "hasp"/"svg", have no category) —
  // this is the same categorize() call the sidebar and /categories/[id] use,
  // rendered as its own link row rather than turning the tag chips into
  // links two-thirds of which would have nowhere to go.
  const categories = item ? categoriesFor(item.name, item.meta?.tags ?? []) : [];

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

      {item ? (
        <header className="mx-auto w-full max-w-3xl px-6 pt-16 sm:px-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {item.meta?.collection === "loud" ? "ns-ui / loud" : "ns-ui"}
          </p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {item.title}
            </h1>
            <div className="mt-1.5 shrink-0">
              <ComponentSave name={name} />
            </div>
          </div>
          <p className="mt-4 max-w-[65ch] text-[17px] leading-[1.75] text-foreground/90">
            {item.description}
          </p>

          {useWhen ? (
            <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-muted">
              <span className="font-mono text-[11px] uppercase tracking-wider text-foreground">
                Use when
              </span>{" "}
              {useWhen}
            </p>
          ) : null}

          <div className="mt-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
              Install
            </p>
            <div className="mt-3 flex w-full items-start gap-2 rounded-md border border-border bg-surface py-2 pl-3.5 pr-1.5">
              {/* explicit <wbr> so a wrap lands after the origin, not mid-domain */}
              <code className="min-w-0 flex-1 break-words font-mono text-xs leading-6 text-foreground">
                npx shadcn add {REGISTRY_ORIGIN}
                <wbr />
                /r/{name}.json
              </code>
              <CopyButton
                variant="inline"
                value={installCommand}
                label={`Copy install command for ${item.title}`}
              />
            </div>
          </div>

          {categories.length ? (
            <ul className="mt-6 flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/categories/${c.id}`}
                    className="block rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted outline-none transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {item.meta?.tags?.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {item.meta.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-muted"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </header>
      ) : null}

      <DemoFrame name={name} embed={embed} autoplay={autoplay} interactive={interactive} />

      {item ? (
        <section className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-10">
          {props && props.length > 0 ? (
            <div className="border-t border-border pt-10">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Props</h2>
              <div className="mt-4 overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface font-mono text-[11px] uppercase tracking-wider text-muted">
                      <th scope="col" className="px-3 py-2 font-medium">Prop</th>
                      <th scope="col" className="px-3 py-2 font-medium">Type</th>
                      <th scope="col" className="px-3 py-2 font-medium">Default</th>
                      <th scope="col" className="px-3 py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.map((prop) => (
                      <tr key={prop.name} className="border-b border-border last:border-b-0">
                        <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs text-foreground">
                          {prop.name}
                          {prop.optional ? "?" : ""}
                        </td>
                        <td className="px-3 py-2 align-top font-mono text-xs text-muted">
                          {prop.type}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs text-muted">
                          {prop.default ?? "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-xs leading-relaxed text-muted">
                          {prop.comment ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {item.dependencies.length ? (
            <div className="mt-10 border-t border-border pt-10">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Dependencies
              </h2>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {item.dependencies.map((dep) => (
                  <li key={dep}>
                    <a
                      href={`https://www.npmjs.com/package/${dep}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-sm border border-border px-2 py-1 font-mono text-xs text-foreground outline-none transition-colors hover:border-foreground focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {dep}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-10 border-t border-border pt-8">
            <Link
              href="/"
              className="rounded-sm font-mono text-xs uppercase tracking-wider text-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
            >
              Back to the catalog
            </Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
