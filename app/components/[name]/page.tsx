import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { jsonLdScript } from "@/lib/json-ld";
import { DemoStage } from "@/app/_components/demo-stage";
import { loadUseWhen } from "@/lib/use-when";
import { loadComponentProps } from "@/lib/component-props";
import { loadSource } from "@/lib/source";
import { CopyButton } from "@/app/_components/copy-button";
import { AskAI } from "@/app/_components/ask-ai";
import { ComponentSave } from "@/app/_components/component-save";
import { categoriesFor } from "@/lib/category-pages";
import { navGroups, flatOrder } from "@/lib/nav-data";
import pkg from "@/package.json";

// All 298 slugs, known at build time from the same registry.json every other
// read on this page uses — nothing here depends on a request. Without this,
// the route has no generateStaticParams at all, which puts EVERY component
// page in the always-dynamic bucket: a fresh render, off disk, on every
// single request (measured: hero-ascii-schlieren field TTFB in the seconds).
// Matches `/categories/[id]` and `/writing/[slug]`, which enumerate their own
// (much smaller) param sets the same way. Unlike `/preview/[name]/embed`,
// which deliberately prerenders NOTHING because it mounts each demo's own
// client component at build time (218+ of them, unexercised, real build-time
// risk) — this page never renders a demo at all: `DemoStage` below is a
//10-line `<iframe src>`, so full enumeration carries none of that risk.
export function generateStaticParams() {
  return registry.items.map((item) => ({ name: item.name }));
}

// package.json's repository.url is the git clone URL (`...ns-ui.git`);
// schema.org's `codeRepository` wants the browsable repo URL instead.
const CODE_REPOSITORY = pkg.repository.url.replace(/\.git$/, "");
const LICENSE_URL =
  pkg.license === "MIT"
    ? "https://opensource.org/licenses/MIT"
    : undefined;

// Same disclosure treatment /preview/[name]/play used for Source and Build
// spec, ported over now that both live here — see that route's docblock for
// why it no longer owns this content.
const SUMMARY =
  "cursor-pointer select-none rounded-sm font-mono text-xs uppercase tracking-[0.14em] text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none";

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

  const title = `${item.title} · ns-ui`;
  const description = item.description;

  return {
    title,
    description,
    alternates: { canonical: `${REGISTRY_ORIGIN}/components/${name}` },
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * The canonical, indexed, chrome-wrapped page for a component — one of the
 * `registry.items.length` pages `site:design.helpmarq.com` should actually
 * return. This is what
 * `app/sitemap.ts` lists, what `app/page.tsx`'s CollectionPage JSON-LD points
 * at, and what carries the SoftwareSourceCode/BreadcrumbList structured data
 * below.
 *
 * The demo itself is a `DemoStage` iframe onto `/preview/<name>` (see that
 * route's own docblock), not `DemoFrame` mounted inline. Inline mounting is
 * what regressed here before:
 * a demo root's own `min-h-screen` resolves against the *real* page
 * viewport when mounted directly, which is why the old inline render needed
 * a fixed-height well plus `h-full!`/`min-h-full!` overrides to bound it,
 * and why demos taller than that well (e.g. `hero-ascii-reaction-front`)
 * had their own title/CTA scrolled out of view by default. Iframing sidesteps
 * that class of bug entirely: inside the iframe, `min-h-screen` resolves
 * against the iframe's own box, so the demo renders at its natural height
 * with nothing left to override or crop.
 */
export default async function ComponentPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;

  const item = registry.items.find((i) => i.name === name);
  // Previously implicit: `DemoFrame`'s `demos[name]` lookup called this for
  // us whenever a bad slug had no registry entry. Now that the demo is an
  // iframe onto `/preview/<name>` rather than an inline mount, nothing else
  // 404s on a missing item, so it has to happen here.
  if (!item) notFound();
  const pageUrl = `${REGISTRY_ORIGIN}/components/${name}`;
  const installCommand = `npx shadcn add ${REGISTRY_ORIGIN}/r/${name}.json`;

  // Hand-authored only, not every component — see lib/use-when.ts. The rest
  // have no meta.useWhen, so llms.txt's `deriveUseWhen`
  // (scripts/build-llms.ts) falls back to a tag restatement for them — that
  // fallback is not guidance, so it is left off this page entirely rather
  // than rendered as if it were.
  const useWhen = item ? loadUseWhen()[item.name] : undefined;
  const props = item ? loadComponentProps(item.name) : null;
  const source = item ? loadSource(item.name) : null;
  const instruction = item
    ? (item.meta as { instruction?: string } | undefined)?.instruction
    : undefined;
  // Tags aren't category ids (most, like "hasp"/"svg", have no category) —
  // this is the same categorize() call the sidebar and /categories/[id] use,
  // rendered as its own link row rather than turning the tag chips into
  // links two-thirds of which would have nowhere to go.
  const categories = item ? categoriesFor(item.name, item.meta?.tags ?? []) : [];

  // Prev/next in the exact order the sidebar tree reads top-to-bottom
  // (category -> kind -> loose item) — "where am I in the catalog I was
  // just browsing", not recency.
  const flat = flatOrder(navGroups());
  const flatIndex = item ? flat.findIndex((i) => i.name === item.name) : -1;
  const prevItem = flatIndex > 0 ? flat[flatIndex - 1] : null;
  const nextItem =
    flatIndex >= 0 && flatIndex < flat.length - 1 ? flat[flatIndex + 1] : null;

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
    <main>
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
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
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
          <div className="mt-4 flex items-start gap-3">
            <p className="max-w-[65ch] flex-1 text-[17px] leading-[1.75] text-foreground/90">
              {item.description}
            </p>
            <CopyButton
              variant="prose"
              value={item.description}
              label={`Copy ${item.title} description`}
              className="mt-1 shrink-0"
            />
          </div>
        </header>
      ) : null}

      {/* The subject first: the demo sits directly under the title and
          description, so the component itself is in the opening viewport.
          Everything that describes it (use-when, install, links, chips) is
          below — deliberately not hoisted above the demo, where three wrapped
          install lines on mobile would push it off screen again. */}
      {item ? (
        <div className="mx-auto w-full max-w-[1400px] px-6 pt-10 sm:px-10">
          <DemoStage name={name} title={item.title} />
        </div>
      ) : null}

      {item ? (
        <section className="mx-auto w-full max-w-3xl px-6 pt-10 sm:px-10">
          {useWhen ? (
            <p className="mt-4 max-w-[65ch] text-sm leading-relaxed text-ns-muted">
              <span className="font-mono text-[11px] uppercase tracking-wider text-foreground">
                Use when
              </span>{" "}
              {useWhen}
            </p>
          ) : null}

          <div className="mt-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
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

          <div className="mt-8">
            <AskAI component={{ title: item.title, slug: name }} />
          </div>

          {source || instruction ? (
            <div className="mt-8 divide-y divide-border border-y border-border">
              {source ? (
                <details className="py-3">
                  <summary className={SUMMARY}>Source</summary>
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3">
                      <code className="font-mono text-[11px] text-ns-muted">
                        {source.file}
                      </code>
                      <CopyButton
                        variant="inline"
                        value={source.code}
                        label={`Copy ${item.title} source`}
                      />
                    </div>
                    {/* No highlighter: one <pre> of real source, the same
                        bytes the CLI would write, nothing to keep in sync
                        with a theme. */}
                    <pre className="mt-2 max-h-[60vh] overflow-auto rounded-md border border-border bg-surface p-4 font-mono text-[11px] leading-relaxed text-foreground">
                      <code>{source.code}</code>
                    </pre>
                  </div>
                </details>
              ) : null}

              {instruction ? (
                <details className="py-3">
                  <summary className={SUMMARY}>Build spec</summary>
                  <div className="mt-3 flex max-w-3xl items-start gap-3">
                    <p className="flex-1 whitespace-pre-wrap font-mono text-xs leading-relaxed text-ns-muted">
                      {instruction}
                    </p>
                    <CopyButton
                      variant="prose"
                      value={instruction}
                      label={`Copy ${item.title} build spec`}
                      className="mt-0.5 shrink-0"
                    />
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          {categories.length ? (
            <ul className="mt-6 flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/categories/${c.id}`}
                    className="block rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-ns-muted outline-none transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
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
                <li key={tag}>
                  <Link
                    href={`/?q=${encodeURIComponent(tag)}`}
                    className="block rounded-sm border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-ns-muted outline-none transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
                  >
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {item ? (
        <section className="mx-auto w-full max-w-3xl px-6 pb-24 sm:px-10">
          {props && props.length > 0 ? (
            <div className="border-t border-border pt-10">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Props</h2>
                <CopyButton
                  variant="prose"
                  value={props
                    .map(
                      (p) =>
                        `${p.name}${p.optional ? "?" : ""}: ${p.type}` +
                        (p.default ? ` = ${p.default}` : "") +
                        (p.comment ? `  // ${p.comment}` : ""),
                    )
                    .join("\n")}
                  label={`Copy ${item.title} props`}
                />
              </div>
              <div className="mt-4 overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface font-mono text-[11px] uppercase tracking-wider text-ns-muted">
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
                        <td className="px-3 py-2 align-top font-mono text-xs text-ns-muted">
                          {prop.type}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs text-ns-muted">
                          {prop.default ?? "—"}
                        </td>
                        <td className="px-3 py-2 align-top text-xs leading-relaxed text-ns-muted">
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
                      className="rounded-sm border border-border px-2 py-1 font-mono text-xs text-foreground outline-none transition-colors hover:border-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
                    >
                      {dep}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {prevItem || nextItem ? (
            <nav
              aria-label="Adjacent components"
              className="mt-10 grid grid-cols-2 gap-4 border-t border-border pt-8"
            >
              {prevItem ? (
                <Link
                  href={`/components/${prevItem.name}`}
                  // -my-3 py-3: the padding grows the link's own click box,
                  // the matching negative margin cancels it back out of the
                  // grid's flow, so neighbors above/below don't shift. The
                  // grid column already gives full width, so only height
                  // needed the help — ~35px -> ~59px tall.
                  className="group -my-3 block rounded-sm py-3 outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
                >
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ns-muted">
                    Previous
                  </span>
                  <span className="mt-1 block truncate text-sm text-foreground underline-offset-2 transition-colors group-hover:text-ns-accent group-hover:underline">
                    {prevItem.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {nextItem ? (
                <Link
                  href={`/components/${nextItem.name}`}
                  className="group -my-3 block rounded-sm py-3 text-right outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
                >
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ns-muted">
                    Next
                  </span>
                  <span className="mt-1 block truncate text-sm text-foreground underline-offset-2 transition-colors group-hover:text-ns-accent group-hover:underline">
                    {nextItem.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}

          <div className="mt-10 border-t border-border pt-8">
            <Link
              href="/"
              className="rounded-sm font-mono text-xs uppercase tracking-wider text-ns-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
            >
              Back to the catalog
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
