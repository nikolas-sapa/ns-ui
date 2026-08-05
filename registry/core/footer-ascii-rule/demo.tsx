"use client";

import { FooterAsciiRule } from "./component";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Overview", href: "#overview" },
      { label: "Pricing", href: "#pricing" },
      { label: "Changelog", href: "#changelog" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Docs", href: "#docs" },
      { label: "Guides", href: "#guides" },
      { label: "API", href: "#api" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Blog", href: "#blog" },
      { label: "Careers", href: "#careers" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#privacy" },
      { label: "Terms", href: "#terms" },
    ],
  },
];

export default function FooterAsciiRuleDemo() {
  return (
    <div className="flex min-h-[130vh] flex-col">
      <main className="mx-auto max-w-5xl flex-1 px-4 py-16 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ns-muted">
          ns-ui / footer-ascii-rule
        </p>
        <h1 className="mt-4 max-w-lg text-2xl font-semibold text-foreground sm:text-3xl">
          Scroll down, then use "back to top" — the rail beside it is a real
          scroll readout the whole time, and the button springs the page
          back rather than jumping.
        </h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-ns-muted">
          Grab the wheel mid-flight and the spring yields immediately.
        </p>
      </main>
      <FooterAsciiRule brand="ns-ui" columns={COLUMNS} />
    </div>
  );
}
