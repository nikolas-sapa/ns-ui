import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demos } from "@/registry/index";
import autoplayMap from "@/lib/autoplay.generated.json";
import { parseAutoplay } from "@/lib/autoplay";
import { AutoplayDriver } from "@/app/_components/autoplay-driver";
import { ANIMATION_GATE_SCRIPT } from "./animation-gate";

/**
 * The card thumbnail route — what every catalog and featured card loads in its
 * iframe.
 *
 * It exists only to be *cacheable*. `/preview/<name>` — the verification/
 * recording fixture, see that route's own docblock — renders the identical
 * thing for `?embed=1&autoplay=1`, but reading `searchParams` makes that
 * route fully dynamic: it never enters the prerender manifest, so every card
 * frame was a function invocation serving `no-store` (measured:
 * `x-vercel-cache: MISS` on every one, ~4-12 of them per homepage view). Same
 * markup with the two flags baked into the path instead of the query string
 * prerenders and serves from the CDN.
 *
 * `/preview/<name>` is deliberately left untouched — `scripts/verify.ts` and
 * `scripts/record.ts` screenshot it directly (not this route: `inert` and the
 * unconditional autoplay below would break the gate's Tab-reachability and
 * hover/focus screenshot diffs — see `/preview/<name>`'s docblock for the
 * measured reasons), and `?embed=1&interactive=1` (the playground frame)
 * still needs the dynamic variant.
 *
 * Kept in lockstep with the fixture by hand rather than sharing `DemoFrame`:
 * it is five lines of JSX, always `inert` and always autoplaying regardless
 * of query params (unlike `DemoFrame`'s conditional logic), and the
 * shared-component indirection costs more than it saves. The invariant is
 * that a card and the reference fixture render the same DOM for
 * `?embed=1&autoplay=1` — if that drifts, the screenshot gate catches it.
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
      {/* Plain inline script, not a client component: it has to install its
          `requestAnimationFrame` patch before `<Demo/>` (or `AutoplayDriver`)
          ever calls the real one, and a server-rendered `<script>` runs in
          document order during initial parse — ahead of React hydrating any
          client component's effects. See the docblock at the top of
          `animation-gate.ts` for what it does and why. */}
      <script dangerouslySetInnerHTML={{ __html: ANIMATION_GATE_SCRIPT }} />
      <Demo />
      {spec ? <AutoplayDriver spec={spec} /> : null}
    </div>
  );
}
