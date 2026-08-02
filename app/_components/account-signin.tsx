"use client";

// Sign-in surface for `/account`. Client component because it needs
// `useAuthActions` (the auth *action* hook — not the client auth-state hook
// A27 forbids anywhere under `app/`, per §6.1a). `useAuthActions` only
// dispatches `signIn`/`signOut`; it carries no client-side "am I signed in"
// state, so it doesn't hit the §6.1a stale-closure defect. This component
// itself never decides signed-in/out — `app/account/page.tsx` does that on
// the server via `isAuthenticatedNextjs()` and renders this only when
// signed out.
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

// Provider id is "email", not "email-otp" — §2's Phase 0 narrative names
// the latter, but `Email()`'s returned config hardcodes `id: "email"`
// (confirmed against installed 0.0.94 in convex/auth.ts's own header
// comment). Flagged in the spec's §10 as a from-memory error; installed
// source wins.
const EMAIL_PROVIDER_ID = "email";

type OtpStep = "request" | "verify";

export function AccountSignIn() {
  const { signIn } = useAuthActions();
  const [oauthPending, setOauthPending] = useState<"github" | "google" | null>(
    null,
  );
  const [step, setStep] = useState<OtpStep>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const startOAuth = async (provider: "github" | "google") => {
    setError("");
    setOauthPending(provider);
    try {
      // Explicit `redirectTo` is required: without it Convex Auth sends the
      // browser back to `SITE_URL` (the site root `/`) once the OAuth
      // provider completes. `/` is deliberately off the middleware allowlist
      // in `proxy.ts` (so `convexAuthNextjsMiddleware` can never set a
      // cookie on the CDN-cached homepage) and mounts no Convex client, so
      // that redemption can never happen there — the provider signs the
      // user in but no session is ever created. `/account` is on the
      // allowlist and mounts the Convex client, so it can actually redeem
      // the code. Do not delete this as "redundant" — that reintroduces the
      // silent failure.
      await signIn(provider, { redirectTo: "/account" });
    } catch {
      setError("Sign-in failed. Try again.");
      setOauthPending(null);
    }
  };

  const requestCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await signIn(EMAIL_PROVIDER_ID, { email });
      setStep("verify");
    } catch {
      setError("Could not send a code. Try again.");
    } finally {
      setPending(false);
    }
  };

  const submitCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await signIn(EMAIL_PROVIDER_ID, { email, code });
    } catch {
      setError("That code didn't work. It may be wrong or expired.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => startOAuth("github")}
          disabled={oauthPending !== null}
          className="w-full rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          {oauthPending === "github" ? "Redirecting…" : "Continue with GitHub"}
        </button>
        <button
          type="button"
          onClick={() => startOAuth("google")}
          disabled={oauthPending !== null}
          className="w-full rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          {oauthPending === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      {step === "request" ? (
        <form onSubmit={requestCode} className="space-y-2">
          <label htmlFor="account-email" className="sr-only">
            Email address
          </label>
          <input
            id="account-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-2">
          <p className="text-xs text-muted">
            Enter the code sent to {email}.
          </p>
          <label htmlFor="account-code" className="sr-only">
            Sign-in code
          </label>
          <input
            id="account-code"
            name="code"
            type="text"
            inputMode="numeric"
            required
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={pending}
            className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          >
            {pending ? "Verifying…" : "Verify code"}
          </button>
          <button
            type="button"
            onClick={() => setStep("request")}
            className="text-xs text-muted underline-offset-2 hover:underline"
          >
            Use a different email
          </button>
        </form>
      )}

      <p aria-live="polite" className="text-xs">
        {error ? <span className="text-[var(--error)]">{error}</span> : null}
      </p>
    </div>
  );
}
