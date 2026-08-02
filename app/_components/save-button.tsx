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
      className="relative z-20 shrink-0 rounded-sm border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors hover:border-muted focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
