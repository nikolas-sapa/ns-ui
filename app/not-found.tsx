import { Knockout404 } from "@/registry/loud/not-found-knockout/component";
import { CopyButton } from "./_components/copy-button";
import { ThemeReassert } from "./_components/theme-reassert";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

const INSTALL = `npx shadcn add ${REGISTRY_ORIGIN}/r/not-found-knockout.json`;

// Dogfooding, same reason /changelog is drawn with timeline-changelog-wave: the 404 a
// visitor actually hits IS the not-found-knockout demo, running in production on a
// real miss. The chrome is deliberately thin — the component is the page.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <ThemeReassert />
      {/* pl-14 clears the fixed mobile nav toggle (SiteShell, 44px at left-3
          top-3) — this page renders its own thin header instead of
          SiteShell's, so it needs the same clearance that header's own
          wordmark row gives itself. Reset to the header's normal px-10 left
          inset at `lg`, where the toggle is `lg:hidden`. */}
      <header className="border-b border-border py-4 pl-14 pr-6 sm:pr-10 lg:pl-10">
        <a
          href="/"
          className="rounded-sm font-mono text-xs uppercase tracking-[0.18em] text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
        >
          ns-ui
        </a>
      </header>

      {/* Move the cursor along the numerals — the stencil rim springs outward. */}
      <Knockout404
        className="min-h-0 flex-1"
        message="No component lives at this address."
        primaryLabel="Back to the grid"
        primaryHref="/"
        secondaryLabel="See what shipped"
        secondaryHref="/changelog"
      />

      {/* Recovery links, for the visitor that isn't a person: a 404 that only
          says "not found" is a dead end for a crawler or an agent following a
          stale URL, and the two links it needs (the catalog index and the
          machine-readable feeds) are otherwise nowhere on this page. A client
          asking for `Accept: text/markdown` gets the same thing as a real
          markdown document instead — see lib/markdown-pages.ts. */}
      <nav
        aria-label="Where to go next"
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border px-6 py-3 font-mono text-xs text-ns-muted sm:justify-start sm:px-10"
      >
        <a href="/" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none">
          All components
        </a>
        <a href="/sitemap.xml" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none">
          /sitemap.xml
        </a>
        <a href="/llms.txt" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none">
          /llms.txt
        </a>
        <a href="/registry.json" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none">
          /registry.json
        </a>
        <a href="/connect" className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none">
          For agents
        </a>
      </nav>

      <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-border px-6 py-3 font-mono text-xs leading-relaxed text-ns-muted sm:justify-start sm:px-10">
        <span>
          This page is{" "}
          <a
            href="/components/not-found-knockout"
            className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            not-found-knockout
          </a>
          , a component from this registry:
        </span>
        <code className="min-w-0 break-all text-foreground">
          npx shadcn add {REGISTRY_ORIGIN}
          <wbr />
          /r/not-found-knockout.json
        </code>
        <CopyButton
          variant="inline"
          value={INSTALL}
          label="Copy install command for not-found-knockout"
        />
      </footer>
    </main>
  );
}
