// §6.1a's load-bearing rule, same as `/account`: signed-in state here comes
// from the server — `isAuthenticatedNextjs()` — never from the client-side
// auth-state hook. A27 greps `app/` for that hook's name and requires zero
// matches.
//
// The approved list is read with `fetchQuery` WITHOUT a token: it is a public
// query returning only approved rows (§6.3), so the page renders the same for
// a signed-out visitor as for a signed-in one.
import Link from "next/link";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ALEX_TESTIMONIAL, type Testimonial } from "@/lib/testimonials";
import { CommunityTestimonials } from "@/app/_components/community-testimonials";
import { CommunityGuidelines } from "@/app/_components/community-guidelines";
import { TestimonialForm } from "@/app/_components/testimonial-form";

export const dynamic = "force-dynamic";

const title = "Community";
const description =
  "How developers and designers use ns-ui, in their own words. Share your own experience. Every submission is reviewed before it appears.";

export const metadata = {
  alternates: { canonical: "/community" },
  title,
  description,
  openGraph: { title, description },
};

export default async function CommunityPage() {
  const authed = await isAuthenticatedNextjs();

  // A Convex outage degrades to the built-in seed rather than a 500 — this
  // page is public and mostly static in character, so it should still render.
  let submitted: Testimonial[] = [];
  try {
    const approved = await fetchQuery(api.testimonials.approved, {});
    submitted = approved.map((row) => ({ ...row, id: row.id as string }));
  } catch (error) {
    console.error("community: testimonials unavailable", error);
    submitted = [];
  }

  const items = [ALEX_TESTIMONIAL, ...submitted];

  return (
    <main className="mx-auto flex max-w-5xl flex-col px-6 py-16 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">
        Community
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        In their own words.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ns-muted">
        How developers and designers use ns-ui. Every submission is read before
        it appears here.
      </p>

      <section className="mt-12 max-w-2xl border-t border-border pt-10">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
          What this is for
        </h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          This registry is a shared reference of single-interaction components
          that people actually use, not a showcase of everything that could be
          built. The goal for the community side of it is the same: a place
          to hear how those components get used in practice, and a way for
          anyone who contributes one to be credited for it.
        </p>
        <p className="mt-3 text-sm leading-6 text-ns-muted">
          Contributing means opening a pull request, the same as any open
          source project. There is no submission form that runs your code on
          this site. What you submit is read by a person against a real bar
          (see{" "}
          <Link
            href="/guidelines"
            className="underline decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
          >
            Guidelines
          </Link>
          ), and a merged component carries your GitHub identity in its
          history for good. This page isn&rsquo;t a forum: there are no
          comments, ratings, or discussion threads, just the testimonials
          people chose to write and the credit contributors earned.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="sr-only">Experiences</h2>
        <CommunityTestimonials items={items} />
      </section>

      <section className="mt-16 max-w-xl border-t border-border pt-10">
        <CommunityGuidelines />
      </section>

      <section className="mt-14 max-w-xl">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
          Share your experience
        </h2>
        {authed ? (
          <>
            <p className="mt-2 text-sm leading-6 text-ns-muted">
              Tell us how you use the registry. Submissions are reviewed before
              they appear.
            </p>
            <div className="mt-8">
              <TestimonialForm />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-ns-muted">
              Sign in to submit your experience.
            </p>
            <Link
              href="/account"
              // Isolated block link with no close neighbors — generous
              // overlay, +1px for its own `border`.
              className="relative mt-6 inline-flex items-center rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent after:absolute after:-inset-[7px] after:content-['']"
            >
              Sign in
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
