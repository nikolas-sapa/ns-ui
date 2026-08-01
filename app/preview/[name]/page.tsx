import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demos } from "@/registry/index";
import registry from "@/registry.json";
import autoplayMap from "@/lib/autoplay.generated.json";
import { parseAutoplay } from "@/lib/autoplay";
import { AutoplayDriver } from "./autoplay-driver";

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

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ embed?: string; autoplay?: string; interactive?: string }>;
}) {
  const { name } = await params;
  const { embed, autoplay, interactive } = await searchParams;
  const Demo = demos[name];
  if (!Demo) notFound();

  // `?embed=1` is how the landing-page cards load this page inside an iframe.
  // It changes nothing visual — this page stays the reference the cards are
  // matched against — it only makes the demo inert. Without it, a demo that
  // focuses something on mount (command-palette-orbit focuses its input) hands
  // focus to the iframe, and the browser scrolls the *host* page to reveal
  // that iframe: the landing page jumped ~1000px on its own. Inert also keeps
  // the demo's own controls out of the host page's tab order.
  const embedded = embed === "1";

  // `&interactive=1` is the featured-card "Interact" gesture: the visitor
  // already clicked to opt in, so the mount-time-focus hazard above cannot
  // recur (the frame is already on screen and focus does not have to scroll
  // anything into view). Only takes effect inside an embed; a bare
  // `/preview/<name>?interactive=1` behaves exactly like the honest
  // reference page.
  const interactiveEmbed = embedded && interactive === "1";

  // `&autoplay=1` additionally runs the shared driver (see ./autoplay-driver):
  // it synthesises the input a component needs so a card demonstrates itself
  // instead of freezing on a still frame. Embed-only and descriptor-only —
  // without both params, or without an `autoplay` key in that component's
  // meta.json, nothing mounts and this page behaves exactly as it always has.
  // `inert` is unchanged in autoplay mode: the driver dispatches events
  // directly to target elements, which `inert` does not block. Interactive
  // mode never autoplays — the visitor is driving directly.
  // No cast: this is JSON read off disk, so its literal types are widened
  // (`number[]`, not `[number, number]`). Asserting AutoplayMap onto it only
  // lies about a shape TS can't confirm — parseAutoplay already validates at
  // runtime and returns null for anything malformed.
  const spec =
    embedded && autoplay === "1" && !interactiveEmbed
      ? parseAutoplay((autoplayMap as Record<string, unknown>)[name])
      : null;

  return (
    <div
      className="min-h-screen"
      inert={embedded && !interactiveEmbed}
      data-autoplay-root={spec ? "" : undefined}
    >
      <Demo />
      {spec ? <AutoplayDriver spec={spec} /> : null}
    </div>
  );
}
