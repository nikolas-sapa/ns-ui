"use client";

// `/account`'s handle display + the one free change (§8.3: "One free change
// later from `/account` (`handleChangedAt`), then it is a support request").
// Posts to the same `/api/profile` POST `claimHandle` uses for the initial
// claim — one mutation enforces both (see `convex/profiles.ts`'s header
// comment on `claimHandle`).
import { useState } from "react";

const HANDLE_ERROR_MESSAGES: Record<string, string> = {
  invalid_type: "Enter a handle.",
  invalid_length: "Handles are 2-30 characters.",
  invalid_format:
    "Lowercase letters, numbers and single hyphens only — no leading, trailing or double hyphens.",
  reserved: "That handle is reserved.",
  name_not_allowed: "That handle is not allowed.",
  owner_name_reserved: "That name is reserved for the site owner.",
  handle_taken: "That handle is already taken.",
  handle_change_used:
    "You've already used your one free handle change — contact support for another.",
};

export function AccountHandle({
  handle,
  canChange,
}: {
  handle: string;
  canChange: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(handle);
  const [current, setCurrent] = useState(handle);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-foreground">@{current}</span>
        {canChange ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-ns-muted underline-offset-2 hover:underline"
          >
            Change (one-time)
          </button>
        ) : (
          <span className="text-xs text-ns-muted">
            Already changed once — contact support to change again.
          </span>
        )}
      </div>
    );
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          (data.error && HANDLE_ERROR_MESSAGES[data.error]) ||
            "Could not change your handle. Try again.",
        );
        setPending(false);
        return;
      }
      setCurrent(value);
      setEditing(false);
      setPending(false);
    } catch {
      setError("Could not change your handle. Try again.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
        className="w-40 rounded-sm border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ns-accent disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:border-ns-muted focus-visible:ring-2 focus-visible:ring-ns-accent disabled:pointer-events-none disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setValue(current);
          setEditing(false);
        }}
        className="text-xs text-ns-muted underline-offset-2 hover:underline"
      >
        Cancel
      </button>
      {error ? (
        <span className="text-xs text-[var(--error)]" aria-live="polite">
          {error}
        </span>
      ) : null}
    </form>
  );
}
