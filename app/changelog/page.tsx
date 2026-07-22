import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "../_components/theme-toggle";
import { loadChangelog } from "./entries";

export const metadata: Metadata = {
  title: "Changelog — ns-ui",
  description: "What shipped in ns-ui, release by release.",
};

export default function ChangelogPage() {
  const entries = loadChangelog();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-32 sm:px-10">
      <header className="pt-20 sm:pt-28">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            ns-ui / changelog
          </p>
          <ThemeToggle />
        </div>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          What shipped.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          {entries.length} releases since {entries[entries.length - 1]?.iso},
          newest first.
        </p>
      </header>

      <ol className="mt-16 space-y-12">
        {entries.map((entry) => (
          <li key={entry.version} id={entry.version}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-base font-medium tracking-tight">
                {entry.title}
              </h2>
              <span className="font-mono text-xs text-muted">
                {entry.version}
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted">
              <time dateTime={entry.iso}>{entry.iso}</time>
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
              {entry.body}
            </p>
          </li>
        ))}
      </ol>

      <footer className="mt-24 border-t border-border pt-6 font-mono text-xs text-muted">
        <Link
          href="/"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Back to the grid
        </Link>
      </footer>
    </main>
  );
}
