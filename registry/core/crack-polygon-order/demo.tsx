"use client";

import { CrackPolygonOrder } from "./component";

// A section of a page that would otherwise sit under a flat divider panel —
// here the fill is a mud-crack tessellation that keeps re-tiling itself,
// generation by generation, forever.
export default function CrackPolygonOrderDemo() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
        ns-ui / crack-polygon-order
      </p>

      <section className="mt-6">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          Built to dry out, and re-crack
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ns-muted">
          Every layer sheds its own tension in order — widest cracks first,
          then the cells between them splitting again, and again, until the
          surface can't subdivide any further.
        </p>
      </section>

      <div className="my-10 h-72 w-full overflow-hidden rounded-lg border border-border">
        <CrackPolygonOrder className="h-full w-full" />
      </div>

      <section>
        <h2 className="text-lg font-semibold text-foreground">
          Rewets, and starts again
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ns-muted">
          Once the panel is fully tiled it holds, softens back to blank, and
          a new, unrelated set of cracks begins the next cycle.
        </p>
      </section>
    </main>
  );
}
