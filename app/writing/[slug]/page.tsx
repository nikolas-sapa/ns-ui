import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWritingPost, loadWritingPosts } from "@/lib/writing";
import { getStarCount } from "@/lib/github-stars";
import { jsonLdScript } from "@/lib/json-ld";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { PostBody } from "../_components/post-body";
import { GitHubStarButton } from "../../_components/github-star-button";
import { EmailCapture } from "../../_components/email-capture";

export function generateStaticParams() {
  return loadWritingPosts().map((post) => ({ slug: post.slug }));
}

// The per-slug opengraph-image.tsx in this same folder is picked up by the
// file-convention automatically — same split as app/components/[name]/page.tsx:
// this only supplies title/description text.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = loadWritingPost(slug);
  if (!post) return {};

  const title = `${post.title} · ns-ui`;
  return {
    title,
    description: post.description,
    alternates: { canonical: `/writing/${slug}` },
    openGraph: { title, description: post.description, type: "article" },
    twitter: { card: "summary_large_image", title, description: post.description },
  };
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function WritingPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = loadWritingPost(slug);
  if (!post) notFound();
  const stars = await getStarCount();

  const pageUrl = `${REGISTRY_ORIGIN}/writing/${post.slug}`;

  // BlogPosting rather than bare Article: these are dated posts on a blog.
  // `isPartOf` carries the same @id app/writing/page.tsx gives the Blog, so a
  // post and the index read as one graph instead of two unrelated blocks —
  // the same @id-linking lib/site-identity.ts uses for SoftwareApplication
  // and Organization.
  //
  // Deliberately absent, because an honest partial beats a fabricated field
  // (same reasoning as the country-only PostalAddress in lib/site-identity.ts):
  // `keywords` and `articleSection` — no such frontmatter key exists;
  // `wordCount` — these posts are table-heavy, so a count scraped off raw
  // markdown would report pipes and `##` as words. `dateModified` appears
  // only when a post declares `updated:` (see lib/writing.ts); no post does
  // today, so it is absent rather than guessed from a file mtime.
  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${pageUrl}#post`,
    headline: post.title,
    description: post.description,
    url: pageUrl,
    datePublished: post.iso,
    // Spread, not a literal: omitted entirely unless frontmatter carries a
    // real `updated:` date. Never a file mtime.
    ...(post.updated ? { dateModified: post.updated } : {}),
    inLanguage: "en",
    isAccessibleForFree: true,
    // The per-slug opengraph-image.tsx in this folder, at its file-convention URL.
    image: `${pageUrl}/opengraph-image`,
    author: {
      "@type": "Person",
      name: "Nikolas Sapalidis",
      url: `${REGISTRY_ORIGIN}/about`,
    },
    publisher: { "@id": `${REGISTRY_ORIGIN}/#organization` },
    isPartOf: { "@id": `${REGISTRY_ORIGIN}/writing#blog` },
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "ns-ui", item: REGISTRY_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Writing", item: `${REGISTRY_ORIGIN}/writing` },
      { "@type": "ListItem", position: 3, name: post.title, item: pageUrl },
    ],
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-32 sm:px-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(blogPostingJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }}
      />

      <header className="pt-20 sm:pt-28">
        <Link
          href="/writing"
          className="rounded-sm font-mono text-xs uppercase tracking-[0.18em] text-ns-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
        >
          ns-ui / writing
        </Link>
        {/* <time dateTime> rather than bare text: the date was already visible
            here, but only a human could read it. The machine-readable
            attribute is the freshness signal — crawlers and assistants weight
            recency, and an unparseable date reads as undated. */}
        <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-ns-muted">
          <time dateTime={post.iso}>{formatDate(post.iso)}</time>
          {post.updated ? (
            <>
              {" · Updated "}
              <time dateTime={post.updated}>{formatDate(post.updated)}</time>
            </>
          ) : null}
        </p>
        {/* 65–75ch measure, generous leading — this page is a reading
            experience, so the title gets the same width constraint as the
            body rather than the wider hero treatment elsewhere in the app. */}
        <h1 className="mt-3 max-w-[36ch] text-3xl font-semibold leading-[1.2] tracking-tight sm:text-4xl">
          {post.title}
        </h1>
      </header>

      <article className="mt-14 max-w-[70ch]">
        <PostBody markdown={post.body} />
      </article>

      <div className="mt-16 border-t border-border pt-10">
        <EmailCapture />
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-border pt-8">
        <Link
          href="/"
          className="rounded-sm font-mono text-xs uppercase tracking-wider text-ns-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors"
        >
          Back to the catalog
        </Link>
        <GitHubStarButton variant="quiet" stars={stars} />
      </div>
    </main>
  );
}
