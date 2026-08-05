"use client";

import { useActionState, useEffect, useRef } from "react";
import { subscribe, type SubscribeState } from "@/lib/actions/subscribe";

const INITIAL_STATE: SubscribeState = { status: "idle", message: "" };

/**
 * Quiet, single-field capture. No modal, no popup — a form that sits in the
 * page flow at whichever spot the caller renders it (catalog footer, end of
 * a writing post).
 */
export function EmailCapture({ className = "" }: { className?: string }) {
  const [state, formAction, pending] = useActionState(subscribe, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <div className={`w-full max-w-sm ${className}`}>
      <form ref={formRef} action={formAction} className="flex items-start gap-2">
        <label htmlFor="email-capture-input" className="sr-only">
          Email address
        </label>
        <input
          id="email-capture-input"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          disabled={pending}
          className="w-full min-w-0 rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-60"
        />
        {/* Honeypot: hidden from sighted and screen-reader users alike, so a
            human never has a reason to touch it. A filled value is treated as
            a bot in the action above. */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute h-0 w-0 opacity-0"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? "Adding…" : "Subscribe"}
        </button>
      </form>
      <p className="mt-2 text-xs text-ns-muted">New components, occasionally. No spam.</p>
      <p aria-live="polite" className="mt-2 text-xs">
        {state.status === "success" ? (
          <span className="text-[var(--success)]">{state.message}</span>
        ) : state.status === "error" ? (
          <span className="text-[var(--error)]">{state.message}</span>
        ) : null}
      </p>
    </div>
  );
}
