"use client";

// Sign-out control for `/account`. Same reasoning as `account-signin.tsx`:
// `useAuthActions` dispatches an action, it holds no client auth state, so
// it's fine under §6.1a's `storage="inMemory"` constraint.
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountSignOut() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        // Confirm server-side, on our own origin, BEFORE `signOut()` clears
        // the cookies — the library's own sign-out proxy reports success
        // whether or not it actually deleted the session, so this is the
        // only place that can still tell the difference. Never blocks or
        // conditions what follows: sign-out proceeds no matter what this
        // reports or whether it fails outright.
        try {
          await fetch("/api/auth/confirm-signout", { method: "POST" });
        } catch {
          // Ignored — this is a diagnostic, not a precondition for sign-out.
        }
        await signOut();
        // Signed-in state on this page is server-derived
        // (`isAuthenticatedNextjs()`), so a client-only sign-out needs a
        // server round trip to reflect it — `refresh()` re-runs the server
        // component instead of a client-side auth-state read.
        router.refresh();
      }}
      className="rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
