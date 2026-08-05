"use client";

// Testimonial submission form. POSTs to `/api/testimonials` (browser → our
// origin → Convex, §6.1) and never touches Convex directly — `/community`
// mounts no Convex client at all.
//
// Client-side checks here are a UX nicety only (immediate feedback); the
// mutation in `convex/testimonials.ts` is the actual enforcement (§6.3 — that
// endpoint is reachable by a caller who skips this form entirely).
import { useState } from "react";
import { MAX_QUOTE_LENGTH } from "@/lib/testimonial-moderation";

const MESSAGES: Record<string, string> = {
  empty_name: "Add your name.",
  empty_role: "Add your role.",
  empty_company: "Add your company.",
  empty_quote: "Add a few words about how you use ns-ui.",
  name_too_long: "That name is too long.",
  quote_too_long: "That quote is too long.",
  invalid_url: "Check the profile URL.",
  unsupported_url_protocol: "Profile URL must start with https://.",
  url_too_long: "That URL is too long.",
  rate_limited: "You already have a submission awaiting review.",
  unauthenticated: "Your session expired. Sign in again.",
};

export function TestimonialForm() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [quote, setQuote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, company, profileUrl, quote }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          (data.error && MESSAGES[data.error]) ||
            "Could not submit. Check the fields and try again.",
        );
        setPending(false);
        return;
      }
      setPending(false);
      setDone(true);
    } catch {
      setError("Could not submit. Try again.");
      setPending(false);
    }
  };

  if (done) {
    return (
      <p
        // Announced rather than silently swapped in — the form it replaces was
        // what had focus.
        role="status"
        className="rounded-sm border border-border bg-surface px-4 py-3 text-sm leading-6 text-foreground"
      >
        Thanks. Your experience is awaiting review and will appear here once
        approved.
      </p>
    );
  }

  const remaining = MAX_QUOTE_LENGTH - quote.length;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name" value={name} onChange={setName} required autoComplete="name" />
      <Field label="Role" value={role} onChange={setRole} required autoComplete="organization-title" />
      <Field label="Company" value={company} onChange={setCompany} required autoComplete="organization" />
      <Field
        label="Profile URL"
        value={profileUrl}
        onChange={setProfileUrl}
        required
        type="url"
        inputMode="url"
        placeholder="https://"
      />

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
          Your experience
        </span>
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          required
          rows={5}
          maxLength={MAX_QUOTE_LENGTH}
          className="resize-y rounded-sm border border-border bg-surface px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-ns-muted hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent"
        />
        <span
          className={`font-mono text-[10px] ${remaining < 0 ? "text-[var(--error)]" : "text-ns-muted"}`}
        >
          {remaining} characters left
        </span>
      </label>

      {/* aria-live so a validation failure is announced, not just painted. */}
      <p aria-live="polite" className="min-h-5 text-xs leading-5 text-[var(--error)]">
        {error}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:cursor-wait disabled:opacity-60 disabled:pointer-events-none"
        >
          {pending ? "Submitting…" : "Submit for review"}
        </button>
        <span className="text-xs text-ns-muted">Reviewed before it appears.</span>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ns-muted">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-ns-muted hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent"
        {...rest}
      />
    </label>
  );
}
