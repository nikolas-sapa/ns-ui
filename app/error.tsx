"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ThemeReassert } from "./_components/theme-reassert";
import { ThemeToggle } from "./_components/theme-toggle";

// Deliberately plain: no registry component runs here. An error boundary that
// renders a 266-component-library animation risks throwing inside the boundary
// that is meant to catch throws.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <ThemeReassert />
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 sm:px-10">
        <a
          href="/"
          className="rounded-sm font-mono text-xs uppercase tracking-[0.18em] text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
        >
          ns-ui
        </a>
        <ThemeToggle />
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center sm:px-10">
        <h1 className="text-2xl font-medium tracking-tight text-foreground">
          Something went wrong.
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-sm border border-border px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-foreground outline-none transition-colors hover:text-ns-accent focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-sm px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-ns-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ns-accent motion-reduce:transition-none"
          >
            Back to components
          </Link>
        </div>
        {error.digest ? (
          <p className="font-mono text-[10px] text-ns-muted">{error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}
