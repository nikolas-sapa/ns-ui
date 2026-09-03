import type { Metadata } from "next";
import Link from "next/link";

// Static by construction — same rule as /about: no `cookies()`, `headers()`,
// `searchParams` or Convex read, so this prerenders once and is served from
// the CDN.
//
// ponytail: no form and no table behind it. Every route below is a GitHub
// issue template that already exists (.github/ISSUE_TEMPLATE/*.yml), so
// feedback lands where it gets triaged instead of in a second inbox nobody
// reads. Add a first-party form when GitHub sign-in is demonstrably the
// thing stopping people from writing in.

const title = "Feedback";
const description =
  "Report a bug, flag something wrong on the site, or say what is not working: where each kind of feedback goes.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/feedback" },
  openGraph: { title, description },
};

const CONTACT_EMAIL = "nikolas.sapalidis@gmail.com";
const ISSUES = "https://github.com/nikolas-sapa/ns-ui/issues";

const LINK =
  "underline underline-offset-2 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none";

const SECTION = "mt-10 max-w-2xl";
const H2 = "text-lg font-medium tracking-[-0.02em] text-foreground";
const P = "mt-2 text-sm leading-6 text-ns-muted";

export default function FeedbackPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-6 py-16 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">
        Feedback
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        Tell me what is broken.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ns-muted">
        There is no form here on purpose. Everything below goes to the issue
        tracker the components are actually fixed in, so you can watch the fix
        land instead of wondering whether the message arrived.
      </p>

      <section className={`${SECTION} border-t border-border pt-8`}>
        <h2 className={H2}>A component renders wrong or throws</h2>
        <p className={P}>
          Open a{" "}
          <a
            href={`${ISSUES}/new?template=bug_report.yml`}
            className={LINK}
            target="_blank"
            rel="noreferrer"
          >
            bug report
          </a>
          . Include the registry name as used in the install command, the
          browser, and whether it happens in light, dark, or both. The
          screenshot gate compares those separately, so which one it is
          narrows the cause immediately.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Something on this site is wrong</h2>
        <p className={P}>
          Broken link, wrong install command, a docs page that contradicts the
          code: same{" "}
          <a
            href={`${ISSUES}/new?template=bug_report.yml`}
            className={LINK}
            target="_blank"
            rel="noreferrer"
          >
            bug report
          </a>
          , with the URL instead of a component name.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>An idea rather than a defect</h2>
        <p className={P}>
          Feature ideas and component ideas have their own page:{" "}
          <Link href="/suggest" className={LINK}>
            /suggest
          </Link>
          .
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Anything you would rather not post publicly</h2>
        <p className={P}>
          Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
            {CONTACT_EMAIL}
          </a>
          . Security reports go privately through GitHub&apos;s{" "}
          <a
            href="https://github.com/nikolas-sapa/ns-ui/security/advisories/new"
            className={LINK}
            target="_blank"
            rel="noreferrer"
          >
            security advisories
          </a>{" "}
          or the same address, never a public issue. What the site stores
          about you is on{" "}
          <Link href="/privacy" className={LINK}>
            /privacy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
