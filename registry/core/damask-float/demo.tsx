"use client";

import { DamaskFloatCard, DamaskFloatGrid } from "./component";

// Filled solid glyphs, not stroke outlines — component.tsx rasterises
// `iconPath` with ctx.fill(), so a hairline stroke path would fill to
// nothing. Each is a single closed (or compound) path in a 0 0 24 24
// viewBox, sized and weighted to read clearly once woven into cloth at
// card scale.
const CIRCLE_PATH = "M12 2a10 10 0 100 20 10 10 0 000-20z";
const DIAMOND_PATH = "M12 2l10 10-10 10L2 12z";
const TRIANGLE_PATH = "M12 3l9 18H3z";
const BOLT_PATH = "M13 2L4 14h6l-1 8 10-12h-6l1-8z";
const HEXAGON_PATH = "M12 2l8.7 5v10L12 22l-8.7-5V7z";
const PLUS_PATH = "M9 2h6v7h7v6h-7v7H9v-7H2V9h7z";

const FEATURES = [
  {
    heading: "Reciprocal structure",
    body: "Ground and figure are the same thread in the same colour, only the float direction reverses.",
    iconPath: CIRCLE_PATH,
  },
  {
    heading: "Anisotropic read",
    body: "Reflectance is carried by thread azimuth, not by pigment, so the surface has no hue to remove.",
    iconPath: DIAMOND_PATH,
  },
  {
    heading: "Binding points",
    body: "Every fifth end breaks the float on a counter-step of two, which is what keeps a face from going flat.",
    iconPath: TRIANGLE_PATH,
  },
  {
    heading: "Loom sway",
    body: "The grain's azimuth wanders on two incommensurate periods, so the shimmer never repeats a beat.",
    iconPath: BOLT_PATH,
  },
  {
    heading: "Take-up",
    body: "The cloth advances under tension and wraps continuously, entering the frame new every pass.",
    iconPath: HEXAGON_PATH,
  },
  {
    heading: "Front reversal",
    body: "Hover flips figure and ground from the pointer outward, no fade, no translate, no crossfade.",
    iconPath: PLUS_PATH,
  },
];

export default function DamaskFloatDemo() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-6 py-20">
        <header className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-widest text-ns-muted">ns-ui / damask-float</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">One cloth, six cells</h1>
          <p className="mt-3 text-sm leading-relaxed text-ns-muted">
            Every card below is a piece of the same woven surface — the take-up and the loom&apos;s sway run
            across the whole grid unforced. Hover a card and its satin reverses: figure becomes ground with
            no fade and no translate, exactly as a real damask flips when you turn it.
          </p>
        </header>

        <DamaskFloatGrid
          aria-label="Feature grid woven as one reversible damask cloth"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((f) => (
            <DamaskFloatCard key={f.heading} heading={f.heading} body={f.body} iconPath={f.iconPath} />
          ))}
        </DamaskFloatGrid>
      </section>
    </main>
  );
}
