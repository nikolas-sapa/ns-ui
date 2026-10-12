import type { Metadata } from "next";
import Link from "next/link";
import { loadWritingPosts } from "@/lib/writing";
import { jsonLdScript } from "@/lib/json-ld";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

export const metadata: Metadata = {
  alternates: { canonical: "/writing" },
  title: "Writing · ns-ui",
  description: "Notes on building ns-ui, its registry, and the tools around it.",
};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function WritingIndexPage() {
  const posts = loadWritingPosts();

  // `Blog` rather than the `CollectionPage` the other index pages use
  // (app/page.tsx, app/categories/page.tsx): this listing IS a blog, and
  // `blogPost` is the property schema.org documents for it. The @id is the one
  // each post's `isPartOf` points back at, so the index and the four post
  // pages resolve to a single graph.
  //
  // Each entry repeats only what frontmatter actually carries — no `author` or
  // `image` per entry here, since the post's own page is the authoritative
  // node for those and this listing would just be restating it.
  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${REGISTRY_ORIGIN}/writing#blog`,
    name: "Writing · ns-ui",
    description: "Notes on building ns-ui, its registry, and the tools around it.",
    url: `${REGISTRY_ORIGIN}/writing`,
    inLanguage: "en",
    publisher: { "@id": `${REGISTRY_ORIGIN}/#organization` },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      "@id": `${REGISTRY_ORIGIN}/writing/${post.slug}#post`,
      headline: post.title,
      description: post.description,
      url: `${REGISTRY_ORIGIN}/writing/${post.slug}`,
      datePublished: post.iso,
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ns-ui", item: REGISTRY_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Writing", item: `${REGISTRY_ORIGIN}/writing` },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-32 sm:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(blogJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />

      <header className="pt-20 sm:pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
          ns-ui / writing
        </p>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          Writing.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ns-muted">
          Notes on building the registry, one at a time.
        </p>
      </header>

      <ol className="mt-16 space-y-10">
        {posts.map((post) => (
          <li key={post.slug} className="border-b border-border pb-10 last:border-none">
            <Link
              href={`/writing/${post.slug}`}
              className="group block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
            >
              <p className="font-mono text-[11px] uppercase tracking-wider text-ns-muted">
                {formatDate(post.iso)}
              </p>
              <h2 className="mt-2 text-lg font-medium tracking-tight text-foreground transition-colors group-hover:text-ns-accent">
                {post.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ns-muted">{post.description}</p>
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
