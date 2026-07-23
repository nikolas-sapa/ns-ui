import type { Metadata } from "next";
import Link from "next/link";
import { Strandline } from "@/registry/core/strandline/component";
import { ThemeToggle } from "../_components/theme-toggle";
import { loadChangelog } from "./entries";

export const metadata: Metadata = {
  title: "Changelog — ns-ui",
  description:
    "What shipped in ns-ui, drawn with strandline — a component from the registry itself.",
};

export default function ChangelogPage() {
  // CHANGELOG.md is written newest first; strandline wants oldest first, so the
  // oldest release breaks nearest the now edge.
  const entries = loadChangelog();
  const events = [...entries].reverse().map((e) => ({
    date: e.date,
    version: e.version,
    title: e.title,
    body: e.body,
  }));

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
          {entries.length} releases since {entries[entries.length - 1]?.iso}.
          The tide below is <span className="font-mono text-foreground">strandline</span>,
          a component from this registry, running on the real release history.
        </p>
      </header>

      <section className="mt-12 rounded-md border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">
            Release tide
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {events.length} releases
          </p>
        </div>
        {/* Strandline lays 8 markers along the strand with mono labels under
            each. Below ~560px those labels collide, so the strand gets its own
            scroll rail rather than being squeezed. */}
        <div className="-mx-1 overflow-x-auto px-1">
          <Strandline
            events={events}
            // Every release breaks on load — the whole history, not a teaser.
            autoplay={events.length}
            className="mt-1 h-72 min-w-[560px] sm:h-80"
            aria-label="ns-ui release timeline"
          />
        </div>
        <p className="mt-3 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
          Scrub with the arrows · hover a mark to replay its swash
        </p>
      </section>

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
