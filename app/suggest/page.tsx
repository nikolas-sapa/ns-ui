import type { Metadata } from "next";
import Link from "next/link";

// Static by construction — same rule as /about and /feedback.
//
// ponytail: routes to the two issue templates that already exist rather than
// adding a suggestions table. The split it enforces is the editorial one
// from /guidelines: a component idea is judged on whether it is a single
// distinct interaction, a feature idea is judged on the CLI/MCP/site, and
// they are reviewed by different criteria — so they are not one inbox.

const title = "Suggest a feature";
const description =
  "Propose a feature for the CLI, MCP server, or site (or a component idea), and what each proposal is judged on.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/suggest" },
  openGraph: { title, description },
};

const ISSUES = "https://github.com/nikolas-sapa/ns-ui/issues";

const LINK =
  "underline underline-offset-2 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none";

const SECTION = "mt-10 max-w-2xl";
const H2 = "text-lg font-medium tracking-[-0.02em] text-foreground";
const P = "mt-2 text-sm leading-6 text-ns-muted";

export default function SuggestPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-6 py-16 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">
        Suggest
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        Ask for the thing that is missing.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ns-muted">
        Ideas are public, so other people can add to yours instead of opening a
        second copy of it. Which of the two below you pick decides what the
        idea is judged on.
      </p>

      <section className={`${SECTION} border-t border-border pt-8`}>
        <h2 className={H2}>A component that should exist</h2>
        <p className={P}>
          Open a{" "}
          <a
            href={`${ISSUES}/new?template=component_request.yml`}
            className={LINK}
            target="_blank"
            rel="noreferrer"
          >
            component request
          </a>
          . Describe the interaction, not the styling: a button styled
          differently from an existing button is not a new component here, and
          two ideas demonstrating the same behavior mean only the clearer one
          ships. The full standard is on{" "}
          <Link href="/guidelines" className={LINK}>
            the guidelines page
          </Link>
          .
        </p>
        <p className={P}>
          Already built it? Skip the request and open the pull request through{" "}
          <Link href="/submit" className={LINK}>
            /submit
          </Link>
          .
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>A feature in the tooling</h2>
        <p className={P}>
          The CLI, the MCP server, this site, or the build tooling: open a{" "}
          <a
            href={`${ISSUES}/new?template=feature_request.yml`}
            className={LINK}
            target="_blank"
            rel="noreferrer"
          >
            feature request
          </a>
          . Say what you were trying to do and where the current surface stopped
          you. That is the part that cannot be guessed later.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Before you open one</h2>
        <p className={P}>
          Search the{" "}
          <a href={ISSUES} className={LINK} target="_blank" rel="noreferrer">
            open issues
          </a>{" "}
          first, and add to the existing thread if the idea is already there. A
          reaction on someone else&apos;s issue is a real signal; a duplicate is
          not. Something broken rather than missing goes to{" "}
          <Link href="/feedback" className={LINK}>
            /feedback
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
