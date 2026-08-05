"use client";

// Signed-out state for `/submit` — deliberately its own component rather
// than reusing `app/_components/account-signed-out.tsx` (out of scope for
// this change, and its copy is `/account`-specific). GitHub sign-in only,
// per community-spec.md §2 Phase C — the incremental `public_repo` consent
// this page needs is only obtainable from a GitHub-authenticated session,
// so Google/email sign-in isn't offered here the way `/account` offers all
// three.
//
// Same rule as `account-signin.tsx`: `useAuthActions` is the auth *action*
// hook, not the client auth-state hook A27 forbids under `app/` (§6.1a) —
// it only dispatches `signIn`, it holds no "am I signed in" state. This
// component never decides signed-in/out itself; `app/submit/page.tsx` does
// that on the server via `isAuthenticatedNextjs()`.
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import Link from "next/link";

export function SubmitSignedOut() {
  const { signIn } = useAuthActions();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setError("");
    setPending(true);
    try {
      await signIn("github", { redirectTo: "/submit" });
    } catch {
      setError("Sign-in failed. Try again.");
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <h1 className="text-xl font-medium text-foreground">Propose a component</h1>
      <p className="mt-2 text-sm text-ns-muted">
        Submitting opens a pull request under your own GitHub identity, so this needs a GitHub
        sign-in — Google and email sign-in have no GitHub account to open the PR as.
      </p>
      <button
        type="button"
        onClick={start}
        disabled={pending}
        className="mt-6 inline-flex items-center gap-2 rounded-sm border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-60"
      >
        <GitHubMark />
        {pending ? "Redirecting…" : "Sign in with GitHub"}
      </button>
      <p aria-live="polite" className="mt-2 text-xs">
        {error ? <span className="text-[var(--error)]">{error}</span> : null}
      </p>
      <p className="mt-6 text-xs text-ns-muted">
        Read{" "}
        <Link
          href="/guidelines"
          className="underline decoration-border underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent"
        >
          the guidelines
        </Link>{" "}
        first — the taste bar this registry holds new components to.
      </p>
    </main>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
