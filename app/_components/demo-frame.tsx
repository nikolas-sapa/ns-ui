import { notFound } from "next/navigation";
import registry from "@/registry.json";
import autoplayMap from "@/lib/autoplay.generated.json";
import { parseAutoplay } from "@/lib/autoplay";
import { AutoplayDriver } from "@/app/_components/autoplay-driver";
import { DemoLazy } from "@/app/_components/demo-lazy";

// Existence check only — never `import { demos }` here. `demos` is a
// Record<string, ComponentType> of 389 `lazy(() => import(...))` entries; a
// Server Component that renders `demos[name]` directly makes every one of
// those 389 targets look "reachable" to Next's client-reference-manifest
// (it can't know which key a runtime string picks), so all 389 shipped
// eagerly in one ~3MB chunk on every `/preview/<name>` request. The actual
// lookup+render now happens in `DemoLazy`, a Client Component, where
// Turbopack can genuinely code-split per demo. See that file's docblock.
const registryNames = new Set(registry.items.map((i) => i.name));

/**
 * The single implementation shared by both routes that render a component:
 * `/components/<name>` (canonical, indexed, full site chrome, carries the
 * JSON-LD) and `/preview/<name>` (the verification/recording fixture — bare,
 * noindex, no structured data). Extracted so the actual demo-rendering logic
 * — embed/interactive/autoplay handling — has one source of truth instead of
 * drifting between the two page files. Metadata and JSON-LD stay in each
 * page.tsx: they differ per route on purpose (see each file's docblock).
 */
export function DemoFrame({
  name,
  embed,
  autoplay,
  interactive,
}: {
  name: string;
  embed?: string;
  autoplay?: string;
  interactive?: string;
}) {
  if (!registryNames.has(name)) notFound();

  // `?embed=1` is how the landing-page cards load this page inside an iframe.
  // It changes nothing visual — this stays the reference the cards are
  // matched against — it only makes the demo inert. Without it, a demo that
  // focuses something on mount (command-palette-orbit focuses its input) hands
  // focus to the iframe, and the browser scrolls the *host* page to reveal
  // that iframe: the landing page jumped ~1000px on its own. Inert also keeps
  // the demo's own controls out of the host page's tab order.
  const embedded = embed === "1";

  // `&interactive=1` is the featured-card "Interact" gesture: the visitor
  // already clicked to opt in, so the mount-time-focus hazard above cannot
  // recur (the frame is already on screen and focus does not have to scroll
  // anything into view). Only takes effect inside an embed; a bare route with
  // `?interactive=1` behaves exactly like the honest reference render.
  const interactiveEmbed = embedded && interactive === "1";

  // `&autoplay=1` additionally runs the shared driver (see ./autoplay-driver):
  // it synthesises the input a component needs so a card demonstrates itself
  // instead of freezing on a still frame. Embed-only and descriptor-only —
  // without both params, or without an `autoplay` key in that component's
  // meta.json, nothing mounts and this behaves exactly as it always has.
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
      <DemoLazy name={name} interactive={!(embedded && !interactiveEmbed)} />
      {spec ? <AutoplayDriver spec={spec} /> : null}
    </div>
  );
}
