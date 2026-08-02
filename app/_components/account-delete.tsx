"use client";

// Account deletion. Two-click confirm (no modal — a second, differently
// worded button in place of the first) rather than a single destructive
// button, since this is the one control on the site with real teeth (§6.7).
//
// `useAuthActions` for the post-delete `signOut()` — same reasoning as
// `account-signout.tsx`: it dispatches an action and holds no client auth
// state, so it's unaffected by §6.1a's stale-closure defect. Calling it
// after the DELETE succeeds clears the `__Host-` cookies through the
// library's own logic rather than this component re-deriving cookie names.
import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountDelete() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const deleteAccount = async () => {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete your account. Try again.");
        setPending(false);
        return;
      }
      await signOut();
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not delete your account. Try again.");
      setPending(false);
    }
  };

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-muted underline-offset-2 hover:text-[var(--error)] hover:underline"
      >
        Delete account
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-sm border border-[var(--error)]/40 bg-surface p-3">
      <p className="text-sm text-foreground">
        This deletes your profile, saves and sessions. It cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={deleteAccount}
          className="rounded-sm border border-[var(--error)] bg-[var(--error)] px-3.5 py-2 text-sm font-medium text-white outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
      <p aria-live="polite" className="text-xs">
        {error ? <span className="text-[var(--error)]">{error}</span> : null}
      </p>
    </div>
  );
}
