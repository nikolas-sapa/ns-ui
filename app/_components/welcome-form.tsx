"use client";

// `/welcome` onboarding, capped at two steps (§8.3). Posts to `/api/profile`
// — never mounts a Convex client here (no `ConvexAuthNextjsProvider` on this
// route; see `app/welcome/page.tsx`'s header comment for why that's a
// deliberate choice, not an oversight).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccountProfileForm } from "./account-profile-form";

const HANDLE_ERROR_MESSAGES: Record<string, string> = {
  invalid_type: "Enter a handle.",
  invalid_length: "Handles are 2-30 characters.",
  invalid_format:
    "Lowercase letters, numbers and single hyphens only: no leading, trailing or double hyphens.",
  reserved: "That handle is reserved.",
  name_not_allowed: "That handle is not allowed.",
  owner_name_reserved: "That name is reserved for the site owner.",
  handle_taken: "That handle is already taken.",
  handle_change_used:
    "You've already used your one free handle change. Contact support for another.",
};

export function WelcomeForm({ candidateHandle }: { candidateHandle: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"handle" | "profile">("handle");
  const [handle, setHandle] = useState(candidateHandle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // §8.3's checkbox: "an unchecked email-list checkbox... it lives nowhere
  // else." Rendered here only, unchecked by default. Deliberately NOT wired
  // to anything — §9 open question 4 leaves whether this list is connected
  // to EmailOctopus as the owner's call, still unanswered. `profiles` has no
  // field for it (§3's schema), so there is nothing to persist even if it
  // were checked; wiring it to a real mailing list is a decision this step
  // doesn't make on the owner's behalf.
  const [subscribe, setSubscribe] = useState(false);

  const claimHandle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          (data.error && HANDLE_ERROR_MESSAGES[data.error]) ||
            "Could not claim that handle. Try again.",
        );
        setPending(false);
        return;
      }
      setPending(false);
      setStep("profile");
    } catch {
      setError("Could not claim that handle. Try again.");
      setPending(false);
    }
  };

  const finish = () => {
    router.push("/account");
    router.refresh();
  };

  if (step === "handle") {
    return (
      <form onSubmit={claimHandle} className="w-full max-w-sm space-y-3">
        <div className="space-y-1">
          <label htmlFor="welcome-handle" className="text-xs text-ns-muted">
            Handle
          </label>
          <input
            id="welcome-handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            required
            autoFocus
            disabled={pending}
            className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? "Claiming…" : "Continue"}
        </button>
        <p aria-live="polite" className="text-xs">
          {error ? <span className="text-[var(--error)]">{error}</span> : null}
        </p>
      </form>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <AccountProfileForm
        initial={{ displayName: null, bio: null, url: null, tags: [] }}
        submitLabel="Continue"
        skippable
        onSaved={finish}
        onSkip={finish}
      />
      <label className="flex items-start gap-2 text-xs text-ns-muted">
        <input
          type="checkbox"
          checked={subscribe}
          onChange={(e) => setSubscribe(e.target.checked)}
          className="mt-0.5 accent-[var(--ns-accent)]"
        />
        <span>New components, occasionally. No spam.</span>
      </label>
    </div>
  );
}
