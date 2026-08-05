import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWritingPost, loadWritingPosts } from "@/lib/writing";
import { getStarCount } from "@/lib/github-stars";
import { PostBody } from "../_components/post-body";
import { ThemeToggle } from "../../_components/theme-toggle";
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

  const title = `${post.title} — ns-ui`;
  return {
    title,
    description: post.description,
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

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-32 sm:px-10">
      <header className="pt-20 sm:pt-28">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/writing"
            className="rounded-sm font-mono text-xs uppercase tracking-[0.18em] text-ns-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            ns-ui / writing
          </Link>
          <ThemeToggle />
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-ns-muted">
          {formatDate(post.iso)}
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
          className="rounded-sm font-mono text-xs uppercase tracking-wider text-ns-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          Back to the catalog
        </Link>
        <GitHubStarButton variant="quiet" stars={stars} />
      </div>
    </main>
  );
}
