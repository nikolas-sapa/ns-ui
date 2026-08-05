"use client";

import { NavSiteCondense } from "./component";

const LINKS = [
  { label: "Product", href: "#product" },
  { label: "Docs", href: "#docs" },
  { label: "Pricing", href: "#pricing" },
  { label: "Changelog", href: "#changelog" },
  { label: "Blog", href: "#blog" },
];

export default function NavSiteCondenseDemo() {
  return (
    <div id="top">
      <NavSiteCondense brand="ns-ui" links={LINKS} />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / nav-site-condense
        </p>
        <h1 className="mt-4 max-w-lg text-2xl font-semibold text-foreground sm:text-3xl">
          Scroll to condense the bar. Click the menu button to open the sheet.
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-ns-muted">
          The trigger is present at every width — it doubles as a full
          sitemap even on desktop. Tab to it, press Enter, then try Escape.
        </p>
        {Array.from({ length: 10 }).map((_, i) => (
          <section key={i} className="mt-10 border-t border-border pt-10">
            <h2 className="font-mono text-sm font-semibold text-foreground">
              Section {i + 1}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ns-muted">
              Filler content so the page actually scrolls past the condense
              threshold. Lorem ipsum dolor sit amet, consectetur adipiscing
              elit, sed do eiusmod tempor incididunt ut labore et dolore
              magna aliqua.
            </p>
          </section>
        ))}
      </main>
    </div>
  );
}
