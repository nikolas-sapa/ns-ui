import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demos } from "@/registry/index";
import autoplayMap from "@/lib/autoplay.generated.json";
import { parseAutoplay } from "@/lib/autoplay";
import { AutoplayDriver } from "../autoplay-driver";

/**
 * The card thumbnail route — what every catalog and featured card loads in its
 * iframe.
 *
 * It exists only to be *cacheable*. The sibling `/preview/<name>` renders the
 * identical thing for `?embed=1&autoplay=1`, but reading `searchParams` makes
 * that route fully dynamic: it never enters the prerender manifest, so every
 * card frame was a function invocation serving `no-store` (measured:
 * `x-vercel-cache: MISS` on every one, ~4-12 of them per homepage view). Same
 * markup with the two flags baked into the path instead of the query string
 * prerenders and serves from the CDN.
 *
 * `/preview/<name>` is deliberately left untouched — `scripts/verify.ts` and
 * `scripts/record.ts` screenshot it directly, and `?embed=1&interactive=1`
 * (the playground frame) still needs the dynamic variant.
 *
 * Kept in lockstep with the sibling by hand: it is five lines of JSX, and the
 * shared-component indirection costs more than it saves. The invariant is that
 * a card and the reference page render the same DOM — if that drifts, the
 * screenshot gate catches it.
 */
export const revalidate = 3600;

// This route's DOM is byte-for-byte what `/preview/<name>` renders for
// `?embed=1&autoplay=1` (see the docblock above) — a genuine duplicate, not
// an independent page, so it is excluded from indexing to avoid competing
// with the real page for the same content.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  // Empty: the 218 demos are client components that have never been exercised
  // by the build, so prerendering all of them at once is a build-time risk for
  // no runtime gain. Declaring the function at all is what moves this route out
  // of the always-dynamic bucket and into ISR — the first request for a slug
  // renders it, every later one is a CDN hit until `revalidate` expires.
  return [];
}

export default async function EmbedPreviewPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const Demo = demos[name];
  if (!Demo) notFound();

  const spec = parseAutoplay((autoplayMap as Record<string, unknown>)[name]);

  return (
    <div className="min-h-screen" inert data-autoplay-root={spec ? "" : undefined}>
      <Demo />
      {spec ? <AutoplayDriver spec={spec} /> : null}
    </div>
  );
}
