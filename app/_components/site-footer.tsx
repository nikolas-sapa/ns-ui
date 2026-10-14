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
type DirectoryBadge = {
  href: string;
  src: string;
  /** Only for a badge with no background of its own, where one variant
   *  disappears against one theme. See the render for how it is used. */
  srcDark?: string;
  alt: string;
  width: number;
  height: number;
};

const DIRECTORY_BADGES: readonly DirectoryBadge[] = [
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
  {
    href: "https://www.codehype.ai/product/ns-ui?utm_source=codehype_badge",
    src: "https://www.codehype.ai/badges/ns-ui.svg?variant=find-us&v=20",
    alt: "Featured on CodeHype",
    width: 180,
    height: 65,
  },
  {
    // Their embed code points at badge0-white.svg, which is a white pill
    // (#fff ground, #000 type) and disappears against the light theme. The
    // dark variant they also publish (#131a2b) reads on both, and matches
    // every other badge here, which is a dark pill too.
    href: "https://twelve.tools",
    src: "https://twelve.tools/badge0-dark.svg",
    alt: "Featured on Twelve Tools",
    width: 148,
    height: 40,
  },
  {
    // Optional on their side -- it only moves the free listing into a
    // priority queue. Taken anyway, and deliberately NOT recoloured. The
    // artwork is a white pill with a #006AFF border, so the outline carries
    // it on the dark theme unedited, and its only orange sits inside their
    // own logo mark. Self-hosting a recoloured copy is the obvious "fix" and
    // a bad one: their verifier fetches this page looking for THEIR asset,
    // and a modified file on our origin is how you fail that check.
    //
    // Published at 300x80; drawn at 206x55 so it sits on the same optical
    // line as its neighbours instead of towering over them.
    href: "https://startupbase.io/products/ns-ui?utm_source=startupbase&utm_medium=badge&utm_campaign=launch-badge-light",
    src: "https://statics.startupbase.io/site/badges/launched-on-sb.svg",
    alt: "Launched on StartupBase",
    width: 206,
    height: 55,
  },
  {
    // The only badge here with no background of its own — bare text and a
    // logo — so one variant always loses. Both are published; `srcDark` in
    // the render below picks per theme.
    href: "https://www.directree.io",
    src: "https://www.directree.io/badge/directree-badge-lightmode.svg",
    srcDark: "https://www.directree.io/badge/directree-badge-darkmode.svg",
    alt: "Verified on directree",
    width: 200,
    height: 37,
  },
];

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
      </div>

      {/* Own row, left-aligned, with real bottom clearance.
          Five badges is ~1050px of fixed-width artwork in a ~940px column, so
          `ml-auto` in the credit row above wrapped them — and the wrapped line
          sat under the fixed McpPopup and back-to-top button, hiding CodeHype
          and StartupBase completely (caught in a screenshot, not in review).
          pb-16 is the clearance for those two fixed controls; justify-start so
          growth runs left-to-right into empty space instead of back under
          them. */}
      <div className="mt-6 pb-16">
        <ul className="flex flex-wrap items-center gap-3">
          {DIRECTORY_BADGES.map((badge) => (
            <li key={badge.href}>
              <a
                href={badge.href}
                target="_blank"
                rel="noopener noreferrer"
                // The name lives on the LINK, not the image, whenever two
                // theme variants ship. CSS picks which <img> paints, but it
                // cannot move `alt` — so putting the name on one image gets
                // it right in one theme and backwards in the other. Caught in
                // verification: in light mode the VISIBLE badge carried
                // alt="" aria-hidden while the hidden one was the thing
                // announced. Naming the anchor is theme-independent and
                // announces exactly once.
                aria-label={badge.srcDark ? badge.alt : undefined}
                className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ns-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {/* `srcDark` exists because directree's badge, unlike the
                    four opaque pills above it, has NO background fill — it is
                    bare text plus a logo, so a single variant disappears on
                    one of the two themes (their lightmode art is #0d1b1f,
                    invisible on #0a0a0a; darkmode is #faf5f1, invisible on
                    white). Both are published, so both ship and CSS picks:
                    same `dark:` swap the theme toggle and cursor toggle
                    already use, which means the correct one is right on the
                    first painted frame with no JS. Both are in the markup, so
                    their verifier finds its asset either way. */}
                {badge.srcDark ? (
                  <img
                    src={badge.srcDark}
                    alt=""
                    aria-hidden
                    width={badge.width}
                    height={badge.height}
                    loading="lazy"
                    decoding="async"
                    className="hidden dark:block"
                  />
                ) : null}
                <img
                  src={badge.src}
                  alt={badge.srcDark ? "" : badge.alt}
                  aria-hidden={badge.srcDark ? true : undefined}
                  width={badge.width}
                  height={badge.height}
                  loading="lazy"
                  decoding="async"
                  className={badge.srcDark ? "dark:hidden" : undefined}
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
