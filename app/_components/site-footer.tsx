import { AskAI } from "./ask-ai";

/**
 * Launch-directory badges. These are a verification mechanism, not
 * decoration: each directory fetches the page at the URL it has on file and
 * checks for its own badge image wrapped in a followable link back to the
 * listing. A `nofollow`, `sponsored` or `ugc` rel cancels the backlink, and
 * removing the badge later can get the listing delisted — so they live in the
 * footer, which renders on the homepage (the URL directories actually list)
 * and on every other page, rather than on a dedicated page a directory would
 * never look at.
 *
 * Plain <img> rather than next/image: each would otherwise need its own
 * remotePatterns entry. Lazy because the footer is below the fold everywhere,
 * and explicitly sized so a slow or offline directory cannot shift the layout
 * — which is not hypothetical, letslaunch.today was returning 504s when its
 * badge was added. A directory that is down degrades to alt text and heals
 * itself when it comes back.
 *
 * Only dark variants are published by both, so they stay dark in either
 * theme. Their artwork, not ours to recolour.
 */
const DIRECTORY_BADGES = [
  {
    href: "https://launchnest.io/p/ns-ui-react-components-one-interaction-each",
    src: "https://launchnest.io/badge/ns-ui-react-components-one-interaction-each.svg?variant=featured",
    alt: "ns-ui: React components on LaunchNest",
    width: 220,
    height: 56,
  },
  {
    href: "https://letslaunch.today/product/ns-ui",
    src: "https://letslaunch.today/badge/ns-ui.svg",
    alt: "NS UI on LetsLaunch",
    width: 250,
    height: 54,
  },
] as const;

const COLUMN_LABEL = "font-mono text-[10px] uppercase tracking-wider text-ns-muted";

// Same link idiom as the sidebar's own bottom bar (site-shell.tsx) — plain
// mono text, no underline, colour shift on hover/focus — not the underlined
// FOOTER_LINK a flat inline list needed to read as clickable. Padding here
// is real layout (this is a from-scratch column list, not a retrofit), sized
// past the 44px touch-target floor so a column of stacked links doesn't need
// aim.
const COLUMN_LINK =
  "-mx-2 block min-h-11 rounded-sm px-2 py-2.5 leading-tight outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none";

type FooterLink = { href: string; label: string; external?: boolean };

/**
 * Four columns, grouped by what a visitor is trying to do rather than the
 * flat pile this replaced:
 *  - Browse: the catalog itself and what changed in it.
 *  - Build with it: install + theme it into your own app.
 *  - For AI agents: the machine-readable surface (generated at build time by
 *    scripts/build-llms.ts into public/llms.txt and public/llms-full.txt —
 *    real routes, not aspirational ones).
 *  - Community: everywhere a visitor becomes a contributor or a follower.
 * Every href below resolves to a route that exists under app/ (verified
 * against `find app -name page.tsx` and the sitemap) or, for GitHub links,
 * a real repo/issue-template path.
 */
const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Browse",
    links: [
      { href: "/categories", label: "Categories" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    heading: "Build with it",
    links: [
      { href: "/install", label: "Install" },
      { href: "/theming", label: "Theming" },
    ],
  },
  {
    heading: "For AI agents",
    links: [
      // Named "Developer docs", not "/docs": this is the row someone scans
      // for when they are looking for an API, and the path alone did not say
      // that.
      { href: "/docs", label: "Developer docs" },
      { href: "/llms.txt", label: "/llms.txt" },
      { href: "/llms-full.txt", label: "/llms-full.txt" },
    ],
  },
  {
    heading: "Community",
    links: [
      { href: "/writing", label: "Writing" },
      { href: "/community", label: "Community" },
      { href: "/connect", label: "Connect" },
      // The two pages an agent looks for before it will recommend this
      // registry to anyone — /about carries the contact address, /privacy
      // what is stored. Filed here rather than in a fifth column: the grid is
      // sm:grid-cols-4 and a fifth would rewrap it.
      { href: "/about", label: "About" },
      { href: "/feedback", label: "Feedback" },
      { href: "/suggest", label: "Suggest a feature" },
      { href: "/privacy", label: "Privacy" },
      { href: "https://github.com/nikolas-sapa/ns-ui", label: "GitHub", external: true },
      {
        href: "https://github.com/nikolas-sapa/ns-ui/issues/new?template=component_request.yml",
        label: "Request a component",
        external: true,
      },
    ],
  },
];

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
    <footer className="mt-16 border-t border-border px-6 py-8 font-mono text-xs text-ns-muted sm:px-10">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <p className={COLUMN_LABEL}>{col.heading}</p>
            <ul className="mt-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={COLUMN_LINK}
                    {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            {col.heading === "For AI agents" && (
              <div className="mt-3">
                <AskAI variant="compact" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border pt-6">
        <a href="https://nikolas.helpmarq.com" className={`${COLUMN_LINK} -mx-2 inline-block`}>
          Built by Nikolas Sapa
        </a>
        <p>Built with love for developers, with Claude Code.</p>
        <ul className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {DIRECTORY_BADGES.map((badge) => (
            <li key={badge.href}>
              <a
                href={badge.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <img
                  src={badge.src}
                  alt={badge.alt}
                  width={badge.width}
                  height={badge.height}
                  loading="lazy"
                  decoding="async"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
