const FOOTER_LINK =
  "rounded-sm underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent transition-colors";

/**
 * The one site footer, rendered once from `SiteShell` so every page gets it
 * — before this, this exact link set only lived hand-copied on the homepage
 * (showcase.tsx), a smaller subset was copied into five more pages
 * (changelog, connect, guidelines, not-found, the playground), and the
 * other ~305 pages (every `/components/<name>`, `/categories`,
 * `/categories/<id>`, `/community`, `/status`, `/writing`) had none at all.
 * A page with its own closing content (the playground's "Component page"
 * jump, not-found's dogfood install line) keeps that as page-specific
 * content above this — this is only ever the last thing on the page.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 flex flex-wrap items-baseline gap-x-12 gap-y-3 border-t border-border px-6 py-6 font-mono text-xs text-ns-muted sm:px-10">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
        <p>
          For AI agents:{" "}
          <a href="/llms.txt" className={FOOTER_LINK}>
            /llms.txt
          </a>{" "}
          ·{" "}
          <a href="/llms-full.txt" className={FOOTER_LINK}>
            /llms-full.txt
          </a>
        </p>
        <p>
          <a href="/categories" className={FOOTER_LINK}>
            Categories
          </a>{" "}
          ·{" "}
          <a href="/changelog" className={FOOTER_LINK}>
            Changelog
          </a>{" "}
          ·{" "}
          <a href="/writing" className={FOOTER_LINK}>
            Writing
          </a>{" "}
          ·{" "}
          <a href="/community" className={FOOTER_LINK}>
            Community
          </a>{" "}
          ·{" "}
          <a href="/connect" className={FOOTER_LINK}>
            Connect
          </a>{" "}
          ·{" "}
          <a href="https://github.com/nikolas-sapa/ns-ui" className={FOOTER_LINK}>
            GitHub
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/nikolas-sapa/ns-ui/issues/new?template=component_request.yml"
            className={FOOTER_LINK}
          >
            Request a component
          </a>{" "}
          ·{" "}
          <a href="https://nikolas.helpmarq.com" className={FOOTER_LINK}>
            Built by Nikolas Sapa
          </a>
        </p>
      </div>
      <p>Built with love for developers, with Claude Code.</p>
    </footer>
  );
}
