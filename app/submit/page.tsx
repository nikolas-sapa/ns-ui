// `/submit` — the PR-opening portal (community-spec.md §2 Phase C).
//
// §6.1a's load-bearing rule: signed-in state here comes from the server —
// `isAuthenticatedNextjs()` — never the client-side auth-state hook. A27
// greps `app/` for that hook's name and requires zero matches.
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { SubmitSignedOut } from "@/app/_components/submit-signed-out";
import { SubmitForm } from "@/app/_components/submit-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Submit a component · ns-ui",
  robots: { index: false, follow: false },
};

export default async function SubmitPage() {
  const authed = await isAuthenticatedNextjs();

  if (!authed) {
    return <SubmitSignedOut />;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-medium text-foreground">Propose a component</h1>
      <p className="mt-2 text-sm text-ns-muted">
        This opens a pull request on your behalf, on your own GitHub account. Nothing you submit
        here is ever imported, built or rendered on this site. A maintainer reviews it on GitHub
        like any other PR.
      </p>
      <SubmitForm />
    </main>
  );
}
