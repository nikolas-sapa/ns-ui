import type { Metadata } from "next";
import Link from "next/link";
import { loadWritingPosts } from "@/lib/writing";
import { ThemeToggle } from "../_components/theme-toggle";

export const metadata: Metadata = {
  title: "Writing — ns-ui",
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

  return (
    <main className="mx-auto w-full max-w-2xl px-6 pb-32 sm:px-10">
      <header className="pt-20 sm:pt-28">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
            ns-ui / writing
          </p>
          <ThemeToggle />
        </div>
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
          className="rounded-sm font-mono text-xs uppercase tracking-wider text-ns-muted underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          Back to the catalog
        </Link>
      </div>
    </main>
  );
}
