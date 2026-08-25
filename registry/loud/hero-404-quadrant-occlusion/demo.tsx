"use client";

import { QuadrantOcclusion404 } from "./component";

export default function QuadrantOcclusion404Demo() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          ns://ui
        </span>
        <span className="font-mono text-xs tracking-[0.25em] text-ns-muted">
          ns-ui / hero-404-quadrant-occlusion
        </span>
      </header>

      {/* the disc orbiting the numerals is drawn from the same half-cell
          quadrant-glyph grid as the "404" itself — watch its curved edge
          stay crisp where every other ASCII component in this registry
          would stair-step at one glyph per cell */}
      <QuadrantOcclusion404 className="min-h-0 flex-1">
        <p className="max-w-md font-mono text-sm text-ns-muted">
          This route doesn't resolve. The occluder above is rendered at the
          same sub-cell precision as the numerals — no image, no SVG, just
          glyphs.
        </p>
        <a
          href="#docs"
          className="mt-2 inline-flex items-center justify-center rounded-sm bg-ns-accent px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ns-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ns-accent"
        >
          Back to safety
        </a>
      </QuadrantOcclusion404>

      <footer className="flex items-center justify-between border-t border-border px-6 py-3">
        <span className="font-mono text-xs text-ns-muted">
          ERR 404 / route unresolved
        </span>
        <span className="font-mono text-xs text-ns-muted">
          trace: quadrant grid / half-cell occlusion
        </span>
      </footer>
    </main>
  );
}
