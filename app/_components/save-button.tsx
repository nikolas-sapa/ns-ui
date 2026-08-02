"use client";

import { useRouter } from "next/navigation";

export function SaveButton({
  name,
  saved,
  authenticated,
  pending,
  onToggle,
}: {
  name: string;
  saved: boolean;
  authenticated: boolean | null;
  pending: boolean;
  onToggle: (name: string) => void;
}) {
  const router = useRouter();
  const label = authenticated === false ? "Sign in to save" : saved ? "Saved" : "Save";

  return (
    <button
      type="button"
      aria-pressed={authenticated !== false ? saved : undefined}
      aria-busy={pending}
      disabled={pending || authenticated === null}
      title={authenticated === false ? "Sign in to save this component" : label}
      onClick={() => {
        if (authenticated === false) {
          router.push("/account");
          return;
        }
        onToggle(name);
      }}
      className="relative z-20 inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-surface/90 text-foreground outline-none backdrop-blur-sm transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60"
    >
      <BookmarkIcon filled={saved} />
      <span className="sr-only">{pending ? "Saving…" : label}</span>
    </button>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.25" aria-hidden>
      <path d="M4 2.25h8a.75.75 0 0 1 .75.75v10.25L8 10.75l-4.75 2.5V3a.75.75 0 0 1 .75-.75Z" strokeLinejoin="round" />
    </svg>
  );
}
