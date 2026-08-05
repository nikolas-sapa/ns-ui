import type { Metadata } from "next";
import Link from "next/link";

// Static by construction: no `dynamic`/`revalidate` export, no `cookies()`,
// `headers()`, `searchParams`, Convex fetch, or auth import. This route
// prerenders once at build time — the same guarantee `/community` deliberately
// gives up (it needs `force-dynamic` for its own sign-in state), and the one
// this route must keep (docs/community-spec.md §2, Phase B "Done means").

const title = "Guidelines";
const description =
  "The taste this registry is held to: what counts as one interaction, why both themes are non-negotiable, why the card matters as much as the preview, and what gets rejected.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description },
};

const REJECTED = [
  "A console error on either theme, at any state.",
  "A blank render — nothing painted where the component should be.",
  "Hover that looks byte-identical to resting, or keyboard focus that looks byte-identical to unfocused. An interaction that doesn't visibly interact isn't one.",
  "Dark and light rendered as the same bytes — a component that ignored the theme rather than one that happens to look similar.",
  "An interactive control with no accessible name, a role of switch/checkbox/radio with no aria-checked, or a visible dialog with no accessible name.",
  "Controls that Tab cannot reach.",
  "Hardcoded hex in markup or in canvas/SVG draw code, instead of the CSS custom properties already in scope.",
];

export default function GuidelinesPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col px-6 py-16 sm:px-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ns-muted">
        Guidelines
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
        The taste, not the mechanics.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ns-muted">
        This page is what the repository asks of a submission and why.{" "}
        <Link
          href="https://github.com/nikolassapalidis/ns-ui/blob/main/CONTRIBUTING.md"
          className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          CONTRIBUTING.md
        </Link>{" "}
        stays the mechanical how-to — setup, the file layout, the verify gate
        commands. Read this one first; it's shorter and it's the part that
        actually decides whether something gets merged.
      </p>

      <section className="mt-12 max-w-2xl border-t border-border pt-8">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
          One interaction
        </h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          The bar for a new component is an interaction that does not already
          exist here — not a component that merely works. A button styled
          differently from an existing button is not a new interaction. A
          button that reveals a hold-to-confirm affordance, or that reacts to
          the cursor's position rather than its click, is. If two submissions
          would demonstrate the same behavior, only the clearer one belongs.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
          Both themes are non-negotiable
        </h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          Every component ships in dark and light, and both are graded, not
          just the one your terminal defaults to. A component can read
          perfectly in dark and fall apart in light — a gradient that
          inverts, ink that vanishes into the background, a shadow that
          becomes a smear. The gate only fails a component whose two themes
          render byte-identical, so a light theme that is merely wrong sails
          straight through it. Look at both yourself.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
          The card matters as much as the preview
        </h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          The homepage renders your component live, scaled down into a card
          roughly 660px wide. A demo that reads fine at full size can arrive
          in the grid as a speck of interface adrift in empty background, or
          with the interesting part outside the frame. A submission is judged
          on what a stranger sees in that card before they ever click through
          to the full page — if the card doesn't say what the component does,
          the component isn't done yet.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
          The token rule
        </h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          Color comes from the CSS custom properties already in scope —{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            --background
          </code>
          ,{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            --foreground
          </code>
          ,{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            --ns-muted
          </code>
          ,{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            --border
          </code>
          , and{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            --ns-accent
          </code>
          — never a hardcoded hex, in markup or in canvas/SVG draw code. This
          broke the light theme across the whole registry once already. A
          component that derives ink for a canvas reads it with{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            getComputedStyle
          </code>{" "}
          at mount and on theme change, rather than baking a color literal in.
        </p>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
          What gets rejected
        </h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          A person reads every submission; the automated gate is the floor,
          not the bar. It hard-fails on:
        </p>
        <ul className="mt-5 flex flex-col gap-2.5">
          {REJECTED.map((reason) => (
            <li key={reason} className="flex gap-2.5 text-sm leading-6 text-ns-muted">
              <span
                aria-hidden
                className="mt-2 size-1 shrink-0 rounded-full bg-border"
              />
              {reason}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
          License and sign-off
        </h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          A merged submission is contributed under the repository's MIT
          license — you keep authorship, the project keeps the right to
          distribute it under those terms. Every pull request certifies its
          own origin with a Developer Certificate of Origin: a checkbox and a{" "}
          <code className="rounded-sm bg-surface px-1 py-0.5 font-mono text-[13px] text-foreground">
            Signed-off-by
          </code>{" "}
          line in the commit, confirming you have the right to submit the
          code under that license. No sign-off, no merge.
        </p>
      </section>

      <section className="mt-10 max-w-2xl border-t border-border pt-8">
        <h2 className="text-lg font-medium tracking-[-0.02em] text-foreground">
          Contributor credit and privacy
        </h2>
        <p className="mt-2 text-sm leading-6 text-ns-muted">
          Nothing you save, and nothing you write on your profile, is visible
          to anyone unless you publish it. Publishing is per collection, and
          it is off until you turn it on.
        </p>
        <p className="mt-3 text-sm leading-6 text-ns-muted">
          Contributing a component to the repository is different: it is
          public git history under the GitHub identity you opened the pull
          request with. It is not covered by the privacy setting above, it is
          not something this site stores about you, and it survives deleting
          your account.
        </p>
        <p className="mt-3 text-sm leading-6 text-ns-muted">
          Credit for a contribution links to that contributor's profile only
          when one exists and is public. Otherwise it renders as their plain
          GitHub login, with no link — the same degradation a deleted account
          takes.
        </p>
      </section>

      <footer className="mt-16 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-border pt-6 font-mono text-xs text-ns-muted">
        <Link
          href="/"
          className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          Back to the grid
        </Link>
        <Link
          href="/community"
          className="underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          Community
        </Link>
      </footer>
    </main>
  );
}
