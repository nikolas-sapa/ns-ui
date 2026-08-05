import { notFound } from "next/navigation";
import { demos } from "@/registry/index";
import autoplayMap from "@/lib/autoplay.generated.json";
import { parseAutoplay } from "@/lib/autoplay";
import { AutoplayDriver } from "@/app/_components/autoplay-driver";

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
  bounded,
}: {
  name: string;
  embed?: string;
  autoplay?: string;
  interactive?: string;
  /**
   * `/components/<name>` only. The demo sits directly under the header there,
   * so a full `min-h-screen` box — 285 of the 298 demo roots are some flavour
   * of `flex min-h-screen items-center justify-center` — centres the component
   * in a viewport-tall well and pushes it out of the first screen.
   *
   * The well is therefore a *definite-height* box rather than a minimum: only
   * a real `height` bounds a demo whose root is `h-screen` (5 of them) or
   * whose own content is taller than the box, and only a definite height lets
   * the root's `h-full`/`min-h-full` override below resolve. `relative` makes
   * the well the containing block for the full-bleed demos (20 files carry an
   * `absolute inset-0` layer) so their canvases fill the well instead of
   * resolving against the page, and `overflow-auto` clips what is left rather
   * than letting it spill over the header or the sections below.
   *
   * The two child overrides are property-based on purpose: `h-full!` beats
   * `h-screen`, `min-h-full!` beats `min-h-screen` (a min-height floors the
   * used height, so setting `height` alone would not shrink those roots), and
   * between them they bound any root regardless of which utility spelled its
   * height. Deliberately *not* `min-h-0`: that removed the floor but left the
   * root free to collapse to nothing (a root sized only by absolute children
   * became 0px tall) or to grow past the well and overlap the next section.
   *
   * The last two overrides fix what the definite height introduced. A demo
   * root that centres content taller than the well overflows it in BOTH
   * directions, and the slice above the root's top edge is unreachable —
   * a scroll container cannot scroll to a negative offset, so the top line
   * of sparkline-automaton's caption was sliced in half with no way to see
   * it (measured on 96 of the 298 pages, up to 1662px hidden on
   * toc-minimap-mercury). `safe` centring is exactly the CSS answer: it
   * centres while the content fits and falls back to start alignment the
   * moment it would overflow, so nothing moves on the pages that were
   * already correct. Both axes are covered because 158 roots are
   * `flex-col` (vertical overflow is justify-content there) and 83 are
   * `flex-row` (align-items). The selectors are keyed on the class the demo
   * itself declares — `[&>*.items-center]`, not `[&>*]` — so the 19 roots
   * that deliberately do NOT centre keep their own alignment instead of
   * being dragged to the middle.
   *
   * The preview/recording fixture keeps the untouched full-height render —
   * `/preview/<name>` and its `/embed` never pass this prop.
   */
  bounded?: boolean;
}) {
  const Demo = demos[name];
  if (!Demo) notFound();

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
      className={
        bounded
          ? "relative h-[520px] overflow-auto [&>*]:h-full! [&>*]:min-h-full! [&>*.items-center]:items-center-safe! [&>*.justify-center]:justify-center-safe!"
          : "min-h-screen"
      }
      inert={embedded && !interactiveEmbed}
      data-autoplay-root={spec ? "" : undefined}
    >
      <Demo />
      {spec ? <AutoplayDriver spec={spec} /> : null}
    </div>
  );
}
