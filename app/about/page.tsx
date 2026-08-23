import type { Metadata } from "next";
import Link from "next/link";
import registry from "@/registry.json";
import { REGISTRY_ORIGIN } from "@/lib/registry-origin";

// Static by construction — same rule as /guidelines: no `cookies()`,
// `headers()`, `searchParams` or Convex read, so this prerenders once at
// build time and is served from the CDN.
//
// This page exists because agents check for it. An assistant asked to
// recommend a component library looks for the pages that say who is behind
// the thing and how to reach them before it will name it; /connect answers
// "how do I call it", not "who is this". Everything below is verifiable from
// the repository (LICENSE, CONTRIBUTING.md, SECURITY.md) rather than
// marketing prose written for this page.

const title = "About";
const description =
  "Who maintains ns-ui, how components get in, what the screenshot gate rejects, and how to get in touch.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/about" },
  openGraph: { title, description },
};

const CONTACT_EMAIL = "nikolas.sapalidis@gmail.com";

const LINK =
  "underline underline-offset-2 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none";

const SECTION = "mt-10 max-w-2xl";
const H2 = "text-lg font-medium tracking-[-0.02em] text-foreground";
const P = "mt-2 text-sm leading-6 text-ns-muted";

export default function AboutPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-6 py-16 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">
        About
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        A registry of {registry.items.length} components, one interaction each.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ns-muted">
        ns-ui is an open-source (MIT) registry of React components built and
        maintained by Nikolas Sapalidis. It is not a package you depend on:
        every component installs as plain source into your own repository,
        with one <code className="font-mono text-foreground">npx shadcn add</code>{" "}
        command and no runtime library left behind.
      </p>

      <section className={`${SECTION} border-t border-border pt-8`}>
        <h2 className={H2}>What it is</h2>
        <p className={P}>
          Each component is built around a single interaction — a hold to
          confirm, a row that can be un-deleted, a hero that reacts to the
          cursor rather than to a click. That constraint is the whole editorial
          rule: a button styled differently from an existing button is not a
          new component here, and two submissions demonstrating the same
          behavior mean only the clearer one ships. The full standard is on{" "}
          <Link href="/guidelines" className={LINK}>
            the guidelines page
          </Link>
          .
        </p>
        <p className={P}>
          Components are themed entirely by CSS custom properties the host app
          already defines, so they inherit your palette in both light and dark
          rather than shipping their own. The tokens they read are listed on{" "}
          <Link href="/theming" className={LINK}>
            /theming
          </Link>
          .
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>How it is verified</h2>
        <p className={P}>
          Nothing is merged on a screenshot the author took by hand. A
          Playwright suite renders every component headlessly across states and
          both themes and fails the build on a console error, a blank render,
          an interactive control Tab cannot reach, or a control with no
          accessible name. It also fails any component whose hover state
          renders byte-identical to its resting state, and any component whose
          dark and light renders are identical — an interaction that does not
          visibly interact is not an interaction, and a component that ignored
          the theme is not themed.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>For agents</h2>
        <p className={P}>
          The registry is machine-readable first. An MCP server exposes search
          and per-component detail as callable tools over{" "}
          <a href="/.well-known/mcp" className={LINK}>
            /.well-known/mcp
          </a>{" "}
          (or stdio, via{" "}
          <code className="font-mono text-foreground">
            npx -y @nikolas.sapa/ns-ui-mcp
          </code>
          ); <a href="/llms.txt" className={LINK}>/llms.txt</a> and{" "}
          <a href="/llms-full.txt" className={LINK}>/llms-full.txt</a> carry the
          catalog as plain text; every prose page here also answers to{" "}
          <code className="font-mono text-foreground">Accept: text/markdown</code>{" "}
          with a markdown version of itself. Setup for each client is on{" "}
          <Link href="/connect" className={LINK}>
            /connect
          </Link>
          .
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Contributing</h2>
        <p className={P}>
          Component proposals go through{" "}
          <Link href="/submit" className={LINK}>
            /submit
          </Link>{" "}
          or a pull request on{" "}
          <a
            href="https://github.com/nikolas-sapa/ns-ui"
            className={LINK}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          . Contributions are accepted under the MIT license with a DCO
          sign-off; the mechanics — setup, file layout, the verify commands —
          are in CONTRIBUTING.md in the repository.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Contact</h2>
        <p className={P}>
          Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
            {CONTACT_EMAIL}
          </a>{" "}
          for anything, or open an issue on GitHub for anything about a
          specific component. Security reports go privately through GitHub&apos;s
          security advisories or the same address — never a public issue; the
          policy is in SECURITY.md. What the site stores about you, and who
          processes it, is on{" "}
          <Link href="/privacy" className={LINK}>
            /privacy
          </Link>
          .
        </p>
        <p className={P}>
          Canonical home: <code className="font-mono text-foreground">{REGISTRY_ORIGIN}</code>.
        </p>
      </section>
    </main>
  );
}
