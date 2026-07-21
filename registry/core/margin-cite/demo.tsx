"use client";

import { MarginCite, type CiteSource } from "./component";

// Three separate citations at realistic size: a lone source, a pair, and a
// trio behind one claim — the trio is the case the component exists for. The
// prose block is deliberately wrapped in an overflow-hidden card (a common
// real-world ancestor: a bordered content panel) to demonstrate the card
// escapes that clip instead of being cut off, same hazard tooltips hit.

const LATENCY_SOURCES: CiteSource[] = [
  {
    id: "cdn-report",
    title: "State of the Edge, 2026",
    excerpt:
      "Median time-to-first-byte across the sampled edge network dropped 38% year over year, driven almost entirely by regional cache warm-up changes shipped in Q1.",
    url: "https://cdn-report.example.com/state-of-the-edge-2026",
  },
];

const PARSER_SOURCES: CiteSource[] = [
  {
    id: "parser-bench",
    title: "Streaming parsers vs. buffered: a benchmark",
    excerpt:
      "Across payload sizes from 1KB to 50MB, the streaming implementation held a flat memory profile while the buffered baseline scaled linearly with input size.",
    url: "https://bench.example.dev/streaming-vs-buffered",
  },
  {
    id: "spec-note",
    title: "Editor's note on incremental parsing",
    excerpt:
      "The working group's rationale for preferring incremental tokenizers centers on latency-sensitive consumers that cannot wait for a full document to arrive.",
    url: "https://spec.example.org/notes/incremental-parsing",
  },
];

const CACHE_SOURCES: CiteSource[] = [
  {
    id: "cache-postmortem",
    title: "Postmortem: the March cache stampede",
    excerpt:
      "Root cause was a synchronized TTL across nearly every key, so expiry landed within the same 400ms window under peak traffic and the origin took the full load at once.",
    url: "https://eng.example.com/postmortems/march-cache-stampede",
  },
  {
    id: "jitter-pattern",
    title: "TTL jitter as a stampede mitigation",
    excerpt:
      "Adding ±10% random jitter to every cache TTL spreads expirations across a window instead of a point, which is usually enough on its own without request coalescing.",
    url: "https://patterns.example.io/ttl-jitter",
  },
  {
    id: "coalescing-rfc",
    title: "RFC: request coalescing at the cache layer",
    excerpt:
      "Concurrent misses for the same key should collapse into a single origin request, with the remaining waiters served from the result once it lands rather than each dialing the origin.",
    url: "https://rfcs.example.net/request-coalescing",
  },
];

export default function MarginCiteDemo() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl overflow-hidden rounded-md border border-border bg-background p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Engineering notes / caching
        </p>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Why we jitter cache TTLs
        </h2>
        <div className="flex flex-col gap-4 text-sm leading-relaxed text-foreground">
          <p>
            A synchronized-TTL stampede in March made it clear that uniform expiry is a liability
            at scale, and jittered TTLs combined with request coalescing at the cache layer are
            now the standard mitigation
            <MarginCite sources={CACHE_SOURCES} />. Neither change is exotic on its own; together
            they moved p99 origin load from a recurring incident to a non-issue.
          </p>
          <p>
            The rest of the win came from elsewhere. Edge response times improved considerably
            after last quarter&rsquo;s cache changes
            <MarginCite sources={LATENCY_SOURCES} />, and parsing overhead on the misses that
            remained dropped once a streaming approach replaced the buffered one we started with
            <MarginCite sources={PARSER_SOURCES} />.
          </p>
        </div>
      </div>
    </div>
  );
}
