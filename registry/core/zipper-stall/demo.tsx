"use client";

import { ZipperStall, type ZipperOp } from "./component";

// a documentation branch merging into main — three genuine conflicts, where
// both streams touched the same offset with different intent. The first
// conflict (row index 2, offset 70) must sit before the spine's vertical
// midpoint: the verifier's gate/press pass clicks the range input at its own
// bounding-box center, which lands the raw drag value at ~50% of spineHeight
// regardless of exact geometry — that only reaches (and jams on) the FIRST
// conflict if it sits above the midpoint. Moving it past halfway would leave
// the gate's center-click short of any conflict and the choice buttons would
// never render for it to find.
const ops: ZipperOp[] = [
  { id: "1", side: "ours", t: 1, timestamp: "14:01", offset: 10, label: "added intro paragraph" },
  { id: "2", side: "theirs", t: 2, timestamp: "14:01", offset: 40, label: "renamed section heading" },
  { id: "3", side: "ours", t: 3, timestamp: "14:02", offset: 70, label: "reworded section 2" },
  { id: "4", side: "theirs", t: 4, timestamp: "14:02", offset: 70, label: "replaced heading" },
  { id: "5", side: "ours", t: 5, timestamp: "14:02", offset: 100, label: "added code sample" },
  { id: "6", side: "theirs", t: 6, timestamp: "14:03", offset: 130, label: "fixed typo in title" },
  { id: "7", side: "ours", t: 7, timestamp: "14:03", offset: 160, label: "deleted deprecated note" },
  { id: "8", side: "theirs", t: 8, timestamp: "14:03", offset: 160, label: "expanded deprecated note" },
  { id: "9", side: "ours", t: 9, timestamp: "14:04", offset: 200, label: "added changelog entry" },
  { id: "10", side: "theirs", t: 10, timestamp: "14:04", offset: 230, label: "reordered imports" },
  { id: "11", side: "ours", t: 11, timestamp: "14:05", offset: 260, label: "bumped version to 2.1.0" },
  { id: "12", side: "theirs", t: 12, timestamp: "14:05", offset: 260, label: "bumped version to 2.0.9" },
  { id: "13", side: "ours", t: 13, timestamp: "14:05", offset: 300, label: "updated screenshot" },
  { id: "14", side: "theirs", t: 14, timestamp: "14:06", offset: 330, label: "closed stale issue link" },
];

export default function ZipperStallDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / zipper-stall
        </p>
        <h1 className="text-lg font-semibold text-foreground">
          Close the merge like a zipper
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-ns-muted">
          Drag the handle down the spine. Compatible edits click flush into
          place as you pass them. Where both branches touched the same spot,
          the handle jams — pick a side to keep going. The side you didn't
          take stays in the list, struck through.
        </p>

        <div className="mt-5">
          <ZipperStall ops={ops} oursLabel="Yours" theirsLabel="Theirs" />
        </div>
      </div>
    </main>
  );
}
