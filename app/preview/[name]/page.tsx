import type { Metadata } from "next";
import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";
import { DemoFrame } from "@/app/_components/demo-frame";

/**
 * The verification/recording fixture. Chrome-less (matched by
 * `isBarePreview` in `app/_components/site-shell.tsx`), noindex, and
 * canonical back to `/components/<name>` — deliberately not the page a
 * visitor or a crawler is meant to land on. `scripts/verify.ts` and
 * `scripts/record.ts` navigate here directly, and nowhere else in the app
 * links to it.
 *
 * `/components/<name>` (the canonical, chrome-full, indexed page — see that
 * route's own docblock) shares this exact rendering via `DemoFrame`; this
 * file differs from it only in metadata (noindex + canonical, no JSON-LD)
 * and in staying outside site chrome.
 *
 * Two measured reasons neither of the other candidate gate targets works —
 * recorded here so the next person doesn't redo the experiment:
 *
 *  - Pointing the gate at `/components/<name>` (chrome-full) breaks the
 *    "first visible interactive element" locator that drives the hover/
 *    press/focus/`gate.openBy` screenshots in `verify.ts`: measured, it
 *    resolves to the sidebar's own wordmark link, not anything belonging to
 *    the component.
 *  - Pointing it at `/preview/<name>/embed` breaks Tab-reachability:
 *    `/embed` is always `inert` (see `demo-frame.tsx`'s embed handling) and
 *    always runs autoplay unconditionally, so `verify.ts`'s "Tab up to 12
 *    times and land on something" check never lands (focus measured staying
 *    on `document.body`), and any interaction screenshot would be
 *    contaminated by motion the driver is already running on its own.
 *
 * So this route stays a plain, uninert, non-autoplaying render — the only
 * shape that satisfies what the gate actually asserts — while `/components/
 * <name>` carries the chrome and the structured data that make the page
 * worth indexing.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const item = registry.items.find((i) => i.name === name);
  if (!item) return {};

  const canonical = `${REGISTRY_ORIGIN}/components/${name}`;
  return {
    title: `${item.title} — ns-ui`,
    description: item.description,
    robots: { index: false, follow: false },
    alternates: { canonical },
  };
}

export default async function PreviewFixturePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ embed?: string; autoplay?: string; interactive?: string }>;
}) {
  const { name } = await params;
  const { embed, autoplay, interactive } = await searchParams;
  return <DemoFrame name={name} embed={embed} autoplay={autoplay} interactive={interactive} />;
}
