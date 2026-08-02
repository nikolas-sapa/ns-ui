"use client";

// Profile-fields editor (§8.2): display name, bio, up to 3 tags from the
// fixed vocabulary, url. Shared by `/welcome` step 2 and `/account`'s later
// edit — same fields, same validation, same PATCH endpoint. Posts to
// `/api/profile` (browser -> our origin -> Convex, §6.1), never touches
// Convex directly — this component never mounts under a page that has a
// Convex client unless its parent already does (`/account`, `/welcome`).
//
// Client-side checks here are a UX nicety only (immediate feedback); the
// mutation (`convex/profiles.ts`) is the actual enforcement (§6.3 — this
// endpoint is reachable directly by a caller who skips this form entirely).
import { useState } from "react";
import { CATEGORIES } from "@/lib/search-categories";

type Props = {
  initial: {
    displayName: string | null;
    bio: string | null;
    url: string | null;
    tags: string[];
  };
  onSaved?: () => void;
  submitLabel?: string;
  skippable?: boolean;
  onSkip?: () => void;
};

export function AccountProfileForm({
  initial,
  onSaved,
  submitLabel = "Save",
  skippable = false,
  onSkip,
}: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [url, setUrl] = useState(initial.url ?? "");
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const toggleTag = (id: string) => {
    setTags((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= 3) return prev; // A23: reject over 3, but the chip
      // row simply refuses to add a 4th rather than needing a server round
      // trip to find out.
      return [...prev, id];
    });
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, url, tags }),
      });
      if (!res.ok) {
        setError("Could not save. Check the URL and try again.");
        setPending(false);
        return;
      }
      setPending(false);
      onSaved?.();
    } catch {
      setError("Could not save. Try again.");
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div className="space-y-1">
        <label htmlFor="profile-display-name" className="text-xs text-muted">
          Display name
        </label>
        <input
          id="profile-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          disabled={pending}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="profile-bio" className="text-xs text-muted">
          Bio
        </label>
        <textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={4}
          disabled={pending}
          className="w-full whitespace-pre-wrap rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        />
        <p className="text-right text-xs text-muted">
          {[...bio].length}/280
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="profile-url" className="text-xs text-muted">
          Website
        </label>
        <input
          id="profile-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          maxLength={200}
          placeholder="https://…"
          disabled={pending}
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        />
      </div>

      <div className="space-y-1">
        <span className="text-xs text-muted">Tags (up to 3)</span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => {
            const active = tags.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                disabled={pending}
                onClick={() => toggleTag(c.id)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface text-foreground hover:border-muted"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {skippable ? (
          <button
            type="button"
            disabled={pending}
            onClick={onSkip}
            className="rounded-sm border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
          >
            Skip
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="text-xs">
        {error ? <span className="text-[var(--error)]">{error}</span> : null}
      </p>
    </form>
  );
}
