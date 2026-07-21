import { notFound } from "next/navigation";
import { demos } from "@/registry/index";
import autoplayMap from "@/lib/autoplay.generated.json";
import { parseAutoplay } from "@/lib/autoplay";
import { AutoplayDriver } from "./autoplay-driver";

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ embed?: string; autoplay?: string }>;
}) {
  const { name } = await params;
  const { embed, autoplay } = await searchParams;
  const Demo = demos[name];
  if (!Demo) notFound();

  // `?embed=1` is how the landing-page cards load this page inside an iframe.
  // It changes nothing visual — this page stays the reference the cards are
  // matched against — it only makes the demo inert. Without it, a demo that
  // focuses something on mount (event-horizon-command focuses its input) hands
  // focus to the iframe, and the browser scrolls the *host* page to reveal
  // that iframe: the landing page jumped ~1000px on its own. Inert also keeps
  // the demo's own controls out of the host page's tab order.
  const embedded = embed === "1";

  // `&autoplay=1` additionally runs the shared driver (see ./autoplay-driver):
  // it synthesises the input a component needs so a card demonstrates itself
  // instead of freezing on a still frame. Embed-only and descriptor-only —
  // without both params, or without an `autoplay` key in that component's
  // meta.json, nothing mounts and this page behaves exactly as it always has.
  // `inert` is unchanged in autoplay mode: the driver dispatches events
  // directly to target elements, which `inert` does not block.
  // No cast: this is JSON read off disk, so its literal types are widened
  // (`number[]`, not `[number, number]`). Asserting AutoplayMap onto it only
  // lies about a shape TS can't confirm — parseAutoplay already validates at
  // runtime and returns null for anything malformed.
  const spec =
    embedded && autoplay === "1"
      ? parseAutoplay((autoplayMap as Record<string, unknown>)[name])
      : null;

  return (
    <div className="min-h-screen" inert={embedded} data-autoplay-root={spec ? "" : undefined}>
      <Demo />
      {spec ? <AutoplayDriver spec={spec} /> : null}
    </div>
  );
}
