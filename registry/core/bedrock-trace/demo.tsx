"use client";

import { BedrockTrace, type TraceSentence, type TraceSource } from "./component";

// A realistic RAG answer card: six sentences, three grounded against two
// different sources, one flat inference with nothing behind it, and one
// that a retrieved source actually contradicts — the exact "dangerous
// middle" citation pills alone never surface. `streaming` is on so the
// trace visibly catches up to the (already-present) prose on mount, the
// way it would while tokens are still arriving.

const SOURCES: TraceSource[] = [
  {
    id: "src-a",
    label: "Source A — Q3 infra report",
    excerpt:
      "Median cold-start latency across the fleet fell to 210ms in Q3, down from 480ms in Q2, after the scheduler migrated to region-local warm pools.",
    match: [0, 66],
  },
  {
    id: "src-b",
    label: "Source B — release notes v4.2",
    excerpt:
      "v4.2 removes the legacy connection-pool cap entirely; pools now grow to demand and are reclaimed on a 90-second idle timer.",
    match: [4, 55],
  },
  {
    id: "src-c",
    label: "Source C — capacity postmortem",
    excerpt:
      "The October incident review found autoscaling actually lagged demand by 40-90 seconds under bursty load, the opposite of instantaneous.",
    match: [26, 92],
  },
];

const SENTENCES: TraceSentence[] = [
  {
    id: "s1",
    text: "Cold-start latency dropped sharply this quarter, falling to 210ms from 480ms after the scheduler switched to region-local warm pools.",
    status: "grounded",
    sourceId: "src-a",
  },
  {
    id: "s2",
    text: "That change alone accounts for most of the improvement teams have noticed in edge response times.",
    status: "unsupported",
  },
  {
    id: "s3",
    text: "Connection pooling was also reworked in v4.2, which removed the old fixed pool-size cap so pools now scale to demand.",
    status: "grounded",
    sourceId: "src-b",
  },
  {
    id: "s4",
    text: "Idle connections are reclaimed on a 90-second timer rather than being held open indefinitely.",
    status: "grounded",
    sourceId: "src-b",
  },
  {
    id: "s5",
    text: "Autoscaling now reacts to load essentially instantaneously, closing the gap that used to cause bursty-traffic slowdowns.",
    status: "contradicted",
    sourceId: "src-c",
  },
  {
    id: "s6",
    text: "Together these changes are why p99 latency has been the most stable it has ever been.",
    status: "unsupported",
  },
];

export default function BedrockTraceDemo() {
  // streaming reveal plays once on mount (and replays whenever the preview
  // iframe remounts on scroll-in). No forced remount timer: it would reset an
  // open detail panel out from under the reader every few seconds.
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-md border border-border bg-background p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Assistant answer / grounding trace
        </p>
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
          Why did latency improve this quarter?
        </h2>
        <BedrockTrace sentences={SENTENCES} sources={SOURCES} streaming />
      </div>
    </div>
  );
}
