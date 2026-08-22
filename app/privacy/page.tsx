import type { Metadata } from "next";
import Link from "next/link";

// Static by construction — same rule as /guidelines and /about.
//
// Every claim below is a restatement of something the code or SECURITY.md
// already establishes (Convex Auth tables, the cookie names and flags,
// EmailOctopus in lib/actions/subscribe.ts, Vercel Analytics + Speed Insights
// in app/_components/site-analytics.tsx, GitHub OAuth in the submit flow).
// Nothing here invents a retention period, a legal basis or a data controller
// entity that the project has not actually established — a privacy page that
// overstates is worse than one that is narrow and true. See the change
// summary for what still needs a legal review before this can claim GDPR or
// CCPA compliance in those words.

const title = "Privacy";
const description =
  "What this site stores, which third parties process it, what the cookies are for, and how to have your data removed.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { title, description },
};

const CONTACT_EMAIL = "nikolas.sapalidis@gmail.com";

const LINK =
  "underline underline-offset-2 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none";

const SECTION = "mt-10 max-w-2xl";
const H2 = "text-lg font-medium tracking-[-0.02em] text-foreground";
const P = "mt-2 text-sm leading-6 text-ns-muted";
const LI = "mt-2 text-sm leading-6 text-ns-muted";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-6 py-16 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">
        Privacy
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        What this site stores, and what it does not.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ns-muted">
        You can browse, copy an install command and install any component
        without an account, and nothing on this page applies to you. Everything
        below describes what happens only if you sign in, save a component,
        submit one, leave a testimonial, or subscribe to the email list.
      </p>

      <section className={`${SECTION} border-t border-border pt-8`}>
        <h2 className={H2}>Browsing without an account</h2>
        <p className={P}>
          No sign-in, no session cookie, no personal data. The site records
          anonymous, aggregate page analytics through Vercel Web Analytics and
          Vercel Speed Insights — page views and Core Web Vitals timings, no
          cross-site tracking cookie and no advertising profile. Those two
          scripts do not load inside component preview iframes.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>If you sign in</h2>
        <p className={P}>
          Accounts are handled by Convex Auth: GitHub, Google, or a one-time
          code emailed to you. No passwords are stored. What is stored is your
          email address (or the provider identity you signed in with) and the
          session and refresh token records needed to keep you signed in. If
          you fill in a profile: a display name, an optional bio and link, and
          up to three category tags. If you save components: which ones, and
          which collections you put them in.
        </p>
        <p className={P}>
          Two additional records exist only to rate-limit abuse and hold no
          personal data on their own: a salted, non-reversible hash of any
          email address that requests a sign-in code, and a per-account counter
          for save requests.
        </p>
        <p className={P}>
          Everything you create is private until you publish it. A profile, a
          save or a collection is invisible to everyone but you from the moment
          it is created — that default is enforced in the database, not just in
          the interface.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Cookies</h2>
        <p className={P}>
          Only session cookies, only after you sign in:{" "}
          <code className="font-mono text-foreground">__Host-__convexAuthJWT</code>{" "}
          and{" "}
          <code className="font-mono text-foreground">
            __Host-__convexAuthRefreshToken
          </code>
          , both <code className="font-mono text-foreground">HttpOnly</code>,{" "}
          <code className="font-mono text-foreground">Secure</code> and{" "}
          <code className="font-mono text-foreground">SameSite=Lax</code>. There
          are no advertising or analytics cookies. Session tokens are
          deliberately kept out of <code className="font-mono text-foreground">localStorage</code>{" "}
          so that component code running on the page cannot read them. Your
          theme and sidebar preferences are stored in your own browser and
          never sent anywhere.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Third parties that process data</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li className={LI}>
            <strong className="font-medium text-foreground">Vercel</strong> —
            hosting; serves every request, and provides the anonymous analytics
            and performance timings described above.
          </li>
          <li className={LI}>
            <strong className="font-medium text-foreground">Convex</strong> —
            the database and authentication backend that stores accounts,
            profiles, saves, collections, submissions and testimonials.
          </li>
          <li className={LI}>
            <strong className="font-medium text-foreground">GitHub and Google</strong>{" "}
            — only if you choose one of them to sign in, or connect GitHub to
            open a submission pull request on your behalf.
          </li>
          <li className={LI}>
            <strong className="font-medium text-foreground">EmailOctopus</strong>{" "}
            — only if you submit the email form; your address is stored on that
            list until you unsubscribe, using the link in any email it sends.
          </li>
        </ul>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>What is never collected</h2>
        <p className={P}>
          No uploaded files or avatar images, no payment details (nothing here
          is paid for), no cross-site tracking, and nothing sold or shared with
          advertisers. Provider avatars are not fetched in your browser, so
          viewing a page never sends your IP address to GitHub or Google.
        </p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>Deleting your data</h2>
        <p className={P}>
          Self-service account deletion is specified but not yet built. Until
          it ships, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
            {CONTACT_EMAIL}
          </a>{" "}
          from the address on the account and every record tied to it —
          profile, saves, collections, submissions and testimonials — will be
          deleted manually. The same address handles any question about what is
          held about you, and any request for a copy of it.
        </p>
        <p className={P}>
          Security issues go through the process in SECURITY.md rather than
          this address. More about the project is on{" "}
          <Link href="/about" className={LINK}>
            /about
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
