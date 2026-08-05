import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ThemeSync } from "./_components/theme-sync";
import { SiteAnalytics } from "./_components/site-analytics";
import { SiteShell } from "./_components/site-shell";
import { SmoothScroll } from "./_components/smooth-scroll";
import { SmoothCursor } from "./_components/smooth-cursor";
import { NO_FLASH_SCRIPT } from "@/lib/theme";
import { NO_FLASH_SIDEBAR_SCRIPT } from "@/lib/sidebar";
import { CATALOG_GATE_SCRIPT } from "@/lib/catalog-gate";
import { navGroups } from "@/lib/nav-data";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

const title = "ns-ui";
// Shown only in the unfurl card, not in the browser tab: `title` stays bare so
// the tab and `siteName` read as the project, not as a pitch. No component
// count on purpose — the card outlives the number, and a stale figure in a
// cached unfurl is worse than no figure.
const socialTitle = "ns-ui: React components, one interaction each";
const description =
  "React components you install by URL. Each is built around a single interaction, and a screenshot suite fails any component whose hover looks identical to its resting state.";

export const metadata: Metadata = {
  // Resolves every relative URL in this metadata object (including the
  // opengraph-image/twitter-image file conventions) against the same
  // env-driven origin the rest of the app uses — so pointing the registry at
  // a new host stays the one-variable change lib/registry-origin.ts promises.
  metadataBase: new URL(REGISTRY_ORIGIN),
  title,
  description,
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/changelog/feed.xml", title: "ns-ui changelog" },
        { url: "/writing/feed.xml", title: "ns-ui writing" },
      ],
    },
  },
  openGraph: {
    title: socialTitle,
    description,
    siteName: title,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: socialTitle,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // No hardcoded "dark" here — the inline script below decides the theme
    // before first paint. suppressHydrationWarning is required because that
    // script mutates this element ahead of React hydration.
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="llms-txt" href="/llms.txt" />
        <link rel="llms-txt" href="/llms-full.txt" title="full" />
        {/* Runs before hydration so there's no flash of the wrong theme. See
            lib/theme.ts for what it does and why it has to stay inlined. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        {/* Same reasoning, for a collapsed sidebar instead of a theme — see
            lib/sidebar.ts. */}
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SIDEBAR_SCRIPT }} />
        {/* Same reasoning again, for the homepage catalog's URL-carried
            filter/sort state — see lib/catalog-gate.ts. This is what keeps a
            shared `/?q=...` link from painting the unfiltered homepage and
            then jumping once React corrects it. */}
        <script dangerouslySetInnerHTML={{ __html: CATALOG_GATE_SCRIPT }} />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <ThemeSync />
        {/* Both bail out inside an iframe (window.self !== window.top) — every
            /preview/<slug> shape, every catalog/embed thumbnail, and every
            component's own playground iframe render this same root layout
            framed, and neither should touch that document's cursor or
            scroll. See the components for the full reasoning. */}
        <SmoothScroll />
        <SmoothCursor />
        {/* Nav data is computed on the server once per build; the shell is a
            client component only because it needs the active pathname. */}
        <SiteShell groups={navGroups()}>{children}</SiteShell>
        {/* Vercel Web Analytics and Speed Insights. Both no-op outside a
            Vercel deployment, so local dev is unaffected. Skipped inside card
            iframes — see the component. */}
        <SiteAnalytics />
      </body>
    </html>
  );
}
