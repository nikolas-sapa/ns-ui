import { Knockout404 } from "@/registry/loud/not-found-knockout/component";
import { CopyButton } from "./_components/copy-button";
import { ThemeReassert } from "./_components/theme-reassert";
import { ThemeToggle } from "./_components/theme-toggle";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

const INSTALL = `npx shadcn add ${REGISTRY_ORIGIN}/r/not-found-knockout.json`;

// Dogfooding, same reason /changelog is drawn with timeline-changelog-wave: the 404 a
// visitor actually hits IS the not-found-knockout demo, running in production on a
// real miss. The chrome is deliberately thin — the component is the page.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <ThemeReassert />
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 sm:px-10">
        <a
          href="/"
          className="rounded-sm font-mono text-xs uppercase tracking-[0.18em] text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none"
        >
          ns-ui
        </a>
        <ThemeToggle />
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

      <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-border px-6 py-3 font-mono text-xs leading-relaxed text-muted sm:justify-start sm:px-10">
        <span>
          This page is{" "}
          <a
            href="/preview/not-found-knockout"
            className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
