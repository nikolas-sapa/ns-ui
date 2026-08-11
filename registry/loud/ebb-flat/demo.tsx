"use client";

import { EbbFlat } from "./component";

// The pinned stage is the first thing on the page, so the un-scrolled frame is
// slack high water: the flat entirely under, one bar just tripping the swell,
// the sea running on its own clock. Scrolling drops the level; the copy below
// the section is ordinary flow, which is what proves the pin releases.
export default function EbbFlatDemo() {
  return (
    <main className="w-full bg-background">
      <EbbFlat />

      <section className="mx-auto flex max-w-3xl flex-col items-start gap-5 px-6 py-24 sm:px-10 sm:py-32">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ns-muted">
          ns-ui / ebb-flat
        </p>
        <h2 className="text-balance text-2xl font-medium leading-tight text-foreground sm:text-3xl">
          The pin releases here, with the page in its hand
        </h2>
        <p className="max-w-prose text-sm leading-relaxed text-ns-muted sm:text-base">
          The flat is a fixed field and the water level is the only thing the
          scroll touches, so scrolling back floods it in exactly the order it
          drained. Nothing latches on the way out.
        </p>
        <a
          href="#docs"
          className="mt-1 inline-flex w-fit items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Read the docs
        </a>
      </section>
    </main>
  );
}
