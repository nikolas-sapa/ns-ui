import type { Metadata } from "next";
import { Strandline } from "@/registry/core/timeline-changelog-wave/component";
import { loadChangelog } from "./entries";
import { ChangelogEntryList } from "./entry-list";
import { TimelineScrub } from "./timeline-scrub";

export const metadata: Metadata = {
  alternates: { canonical: "/changelog" },
  title: "Changelog · ns-ui",
  description:
    "What shipped in ns-ui, drawn with timeline-changelog-wave, a component from the registry itself.",
};

export default function ChangelogPage() {
  // CHANGELOG.md is written newest first; timeline-changelog-wave wants oldest first, so the
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
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ns-muted">
          ns-ui / changelog
        </p>
        <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-4xl">
          What shipped.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ns-muted">
          {entries.length} releases since {entries[entries.length - 1]?.iso}.
          The tide below is <span className="font-mono text-foreground">timeline-changelog-wave</span>,
          a component from this registry, running on the real release history.
        </p>
      </header>

      <section className="mt-12 rounded-md border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="font-mono text-xs uppercase tracking-[0.14em] text-foreground">
            Release tide
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ns-muted">
            {events.length} releases
          </p>
        </div>
        {/* Strandline spaces its markers evenly across whatever width it's
            given, with a fixed mono label under each — it does not thin
            labels out on its own. A fixed min-width (560px) worked while the
            changelog had 6-8 releases; at 18+ the same 560px squeezes labels
            close enough to overprint ("v0.18.v0.17.v0.16…"). Scale the
            strand's width with the event count instead — ~64px per marker is
            enough room for a "v0.18.0" mono label not to touch its
            neighbour. TimelineScrub carries whatever doesn't fit the
            viewport (scroll rail + on-screen/keyboard arrows) instead of
            letting it render off past the visible edge unreachable. */}
        <TimelineScrub
          minWidth={Math.max(560, events.length * 64)}
          eventCount={events.length}
        >
          <Strandline
            events={events}
            // Every release breaks on load — the whole history, not a teaser.
            autoplay={events.length}
            className="mt-1 h-72 sm:h-80"
            aria-label="ns-ui release timeline"
          />
        </TimelineScrub>
        <p className="mt-3 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-wider text-ns-muted">
          Scrub with the arrows · hover a mark to replay its swash
        </p>
      </section>

      <ChangelogEntryList entries={entries} />
    </main>
  );
}
